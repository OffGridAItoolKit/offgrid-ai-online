"""Pinned, private Gemma 4 E4B pilot. Set the Modal $10 workspace budget BEFORE deploying."""

import hashlib
import json
import os
from pathlib import Path
import time
import urllib.request

import modal

MODEL = "gemma4:e4b"
ARTIFACT = "sha256:4c27e0f5b5adf02ac956c7322bd2ee7636fe3f45a8512c9aba5385242cb6e09a"
MANIFEST = "c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb"
CONFIG = "sha256:f0988ff50a2458c598ff6b1b87b94d0f5c44d73061c2795391878b00b2285e11"
PARAMS = "sha256:56380ca2ab89f1f68c283f4d50863c0bcab52ae3f1b9a88e4ab5617b176f71a3"
OLLAMA_VERSION = "0.33.3"
OLLAMA_IMAGE = "ollama/ollama@sha256:32931b46719f673c05fdbaa81ccb26da18ea4a1c57590a754874ab28ba269eb2"
MODELS_PATH = "/opt/offgrid-models"
REVIEW_FORMAT = "matched-review-v1"


def review_schema():
    # Keep identical to server/open-arena/review-schema.js; cross-language parity is tested.
    def obj(properties):
        return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}
    labels = ["A", "B", "C", "D"]
    criteria = ["accuracy", "prioritization", "actionability"]
    ranking = {"type": "array", "minItems": 1, "maxItems": 4,
               "items": {"type": "array", "minItems": 1, "maxItems": 4,
                         "items": {"type": "string", "enum": labels}}}
    return obj({"rankings": obj({c: ranking for c in criteria}),
                "reasons": obj({label: obj({c: {"type": "string", "minLength": 12, "maxLength": 2400}
                                          for c in criteria}) for label in labels})})


def download_model():
    """CPU image build only. Verify every blob; do not pull a mutable tag at GPU startup."""
    base = "https://registry.ollama.ai/v2/library/gemma4"
    with urllib.request.urlopen(f"{base}/manifests/e4b", timeout=60) as response:
        manifest_bytes = response.read()
    manifest = json.loads(manifest_bytes)
    assert hashlib.sha256(manifest_bytes).hexdigest() == MANIFEST, "E4B manifest has changed"
    assert manifest["config"]["digest"] == CONFIG, "Model configuration has changed"
    model_layers = [x for x in manifest["layers"] if x["mediaType"] == "application/vnd.ollama.image.model"]
    assert len(model_layers) == 1 and model_layers[0]["digest"] == ARTIFACT, "E4B model artifact has changed"
    params = [x for x in manifest["layers"] if x["mediaType"] == "application/vnd.ollama.image.params"]
    assert len(params) == 1 and params[0]["digest"] == PARAMS, "Generation defaults have changed"
    allowed_types = {"application/vnd.ollama.image.model", "application/vnd.ollama.image.params", "application/vnd.ollama.image.license"}
    assert all(x["mediaType"] in allowed_types for x in manifest["layers"]), "Unexpected embedded system/template layer"
    root = Path(MODELS_PATH)
    (root / "blobs").mkdir(parents=True, exist_ok=True)
    for descriptor in [manifest["config"], *manifest["layers"]]:
        digest = descriptor["digest"]
        destination = root / "blobs" / digest.replace(":", "-")
        sha = hashlib.sha256()
        size = 0
        with urllib.request.urlopen(f"{base}/blobs/{digest}", timeout=180) as response, destination.open("wb") as output:
            while chunk := response.read(4 * 1024 * 1024):
                output.write(chunk)
                sha.update(chunk)
                size += len(chunk)
        assert f"sha256:{sha.hexdigest()}" == digest and size == descriptor["size"], "Artifact integrity check failed"
    path = root / "manifests/registry.ollama.ai/library/gemma4/e4b"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(manifest_bytes)


image = (
    modal.Image.from_registry(OLLAMA_IMAGE, add_python="3.12")
    .entrypoint([])
    .pip_install("fastapi==0.141.1", "httpx==0.28.1")
    .env({"OLLAMA_HOST": "127.0.0.1:11434", "OLLAMA_MODELS": MODELS_PATH,
          "OLLAMA_NUM_PARALLEL": "1", "OLLAMA_MAX_LOADED_MODELS": "1", "OLLAMA_MAX_QUEUE": "1",
          "OLLAMA_NO_CLOUD": "1", "OLLAMA_DEBUG": "0"})
    .run_function(download_model, timeout=1800, cpu=1, memory=2048)
    .env({"OLLAMA_FLASH_ATTENTION": "0"})
)
app = modal.App("offgrid-gemma4-e4b-pilot")


def create_api(runtime, generate):
    """Small fixed interface: no model pulls, arbitrary options, history, or public Ollama API."""
    import asyncio
    import base64
    from fastapi import FastAPI, HTTPException, Request

    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    busy = asyncio.Lock()

    @api.get("/health")
    async def health():
        return {"model": MODEL, "artifactDigest": ARTIFACT, "runtime": runtime, "verified": True}

    @api.post("/generate")
    async def respond(request: Request):
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > 3000000:
                raise HTTPException(413, "Request too large")
        try:
            body = json.loads(raw)
            grading = body.get("grading", False)
            review_format = body.get("reviewFormat")
            if review_format is not None and (review_format != REVIEW_FORMAT or grading is not True):
                raise ValueError()
            if not isinstance(grading, bool):
                raise ValueError()
            prompt = body["prompt"]
            system = body.get("system", "")
            seed = body.get("seed", 0)
            if (not isinstance(prompt, str) or not prompt.strip() or len(prompt) > (100000 if grading else 4000)
                    or not isinstance(system, str) or len(system) > 16000
                    or type(seed) is not int or not 0 <= seed <= 2147483647):
                raise ValueError()
            images = []
            if body.get("image"):
                header, encoded = body["image"].split(",", 1)
                if header not in {"data:image/png;base64", "data:image/jpeg;base64", "data:image/webp;base64"}:
                    raise ValueError()
                decoded = base64.b64decode(encoded, validate=True)
                if not decoded or len(decoded) > 2 * 1024 * 1024:
                    raise ValueError()
                images = [encoded]
        except (ValueError, KeyError, TypeError, AttributeError):
            raise HTTPException(400, "Invalid inference request") from None
        if busy.locked():
            raise HTTPException(429, "Pilot model is busy")
        options = {"temperature": 0.2 if grading else 1, "top_k": 64, "top_p": 0.95,
                   "num_ctx": 32768 if grading else 4096, "num_predict": 4096 if grading else 2048, "seed": seed,
                   "num_thread": 4}
        payload = {"model": MODEL, "prompt": prompt, "system": system, "images": images,
                   "think": False, "stream": False, "keep_alive": "3m", "options": options}
        if grading:
            payload["format"] = review_schema() if review_format == REVIEW_FORMAT else "json"
        async with busy:
            try:
                data = await asyncio.wait_for(generate(payload), timeout=110)
            except (TimeoutError, asyncio.TimeoutError):
                raise HTTPException(504, "Inference timed out") from None
            except Exception:
                raise HTTPException(502, "Inference failed") from None
        finish = data.get("done_reason")
        # Context exhaustion is a technical invalidity, never an inferior benchmark answer.
        if data.get("prompt_eval_count", 0) + data.get("eval_count", 0) > options["num_ctx"]:
            finish = "context_limit"
        return {"text": data.get("response", ""), "finishReason": finish if data.get("done") else "incomplete",
                "model": data.get("model"), "artifactDigest": ARTIFACT,
                "runtime": runtime, "verified": data.get("model") == MODEL,
                "settings": {**options, "think": False},
                **({"reviewFormat": review_format} if review_format else {}),
                "usage": {k: data.get(k) for k in ("prompt_eval_count", "eval_count", "total_duration", "load_duration", "eval_duration")}}
    return api


@app.cls(image=image, gpu="L4", cpu=4, memory=16384, min_containers=0, max_containers=1,
         scaledown_window=180, timeout=140, startup_timeout=180, retries=0)
@modal.concurrent(max_inputs=2)
class E4B:
    @modal.enter()
    def start(self):
        import subprocess
        import httpx

        # The artifact was checksum-verified in the immutable image build.
        manifest = json.loads(Path(f"{MODELS_PATH}/manifests/registry.ollama.ai/library/gemma4/e4b").read_text())
        assert manifest["config"]["digest"] == CONFIG
        assert manifest["layers"][0]["digest"] == ARTIFACT
        self.runtime_log = open('/tmp/offgrid-ollama.log', 'w')
        self.process = subprocess.Popen(["ollama", "serve"], stdout=self.runtime_log, stderr=self.runtime_log)
        for _ in range(120):
            try:
                response = httpx.get("http://127.0.0.1:11434/api/version", timeout=1)
                response.raise_for_status()
                self.runtime = response.json()["version"]
                assert self.runtime == OLLAMA_VERSION, "Ollama runtime mismatch"
                return
            except (httpx.HTTPError, KeyError):
                time.sleep(0.5)
        raise RuntimeError("Ollama did not become ready")

    @modal.exit()
    def stop(self):
        self.process.terminate()
        self.runtime_log.close()

    @modal.method()
    def diagnostics(self):
        import subprocess
        import httpx
        return {"loaded": httpx.get("http://127.0.0.1:11434/api/ps", timeout=5).json(),
                "processes": subprocess.check_output(["ps", "-eo", "pid,comm,pcpu,rss"], text=True),
                "gpu": subprocess.check_output(["nvidia-smi", "--query-gpu=name,memory.used,utilization.gpu", "--format=csv,noheader"], text=True),
                "startupLog": Path('/tmp/offgrid-ollama.log').read_text()[-16000:]}

    @modal.asgi_app(requires_proxy_auth=True)
    def api(self):
        import httpx

        async def generate(payload):
            async with httpx.AsyncClient(timeout=110) as client:
                response = await client.post("http://127.0.0.1:11434/api/generate", json=payload)
                response.raise_for_status()
                return response.json()

        return create_api(self.runtime, generate)
