import asyncio
import unittest
import httpx
from e4b import create_api, MODEL, ARTIFACT


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.calls = []

        async def generate(payload):
            self.calls.append(payload)
            return {"model": MODEL, "done": True, "done_reason": "stop", "response": "  Original text.  ",
                    "prompt_eval_count": 100, "eval_count": 30}

        self.client = httpx.AsyncClient(transport=httpx.ASGITransport(app=create_api("0.21.0", generate)), base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_matched_payload_and_raw_text(self):
        baseline = await self.client.post("/generate", json={"prompt": "Question", "seed": 9})
        offgrid = await self.client.post("/generate", json={"prompt": "Question", "system": "OffGrid instructions", "seed": 9})
        self.assertEqual(baseline.status_code, 200)
        self.assertEqual(offgrid.json()["text"], "  Original text.  ")
        self.assertEqual(offgrid.json()["artifactDigest"], ARTIFACT)
        a, b = self.calls
        self.assertEqual(a.pop("system"), "")
        self.assertEqual(b.pop("system"), "OffGrid instructions")
        self.assertEqual(a, b)
        self.assertFalse(a["think"])
        self.assertEqual(a["options"]["num_ctx"], 4096)

    async def test_invalid_requests_do_not_generate(self):
        for body in ({}, {"prompt": ""}, {"prompt": "q", "seed": -1}, {"prompt": "q", "image": "https://example.com"},
                     {"prompt": "q", "grading": "yes"}, {"prompt": "x" * 4001}):
            response = await self.client.post("/generate", json=body)
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.calls, [])

    async def test_history_and_arbitrary_model_options_are_ignored(self):
        await self.client.post("/generate", json={"prompt": "q", "model": "other", "context": [3, 4], "options": {"temperature": 5}})
        self.assertEqual(self.calls[0]["model"], MODEL)
        self.assertNotIn("context", self.calls[0])
        self.assertEqual(self.calls[0]["options"]["temperature"], 1)

    async def test_judge_has_separate_context_without_candidate_prompt(self):
        await self.client.post("/generate", json={"prompt": "answers", "system": "independent rubric", "grading": True})
        self.assertEqual(self.calls[0]["system"], "independent rubric")
        self.assertEqual(self.calls[0]["options"]["num_ctx"], 32768)
        self.assertEqual(self.calls[0]["format"], "json")

    async def test_context_overflow_is_not_a_complete_answer(self):
        async def generate(payload):
            return {"model": MODEL, "done": True, "done_reason": "stop", "response": "answer", "prompt_eval_count": 3000, "eval_count": 2000}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_api("0.21.0", generate)), base_url="http://test") as client:
            response = await client.post("/generate", json={"prompt": "q"})
            self.assertEqual(response.json()["finishReason"], "context_limit")

    async def test_concurrent_work_is_rejected(self):
        ready, finish = asyncio.Event(), asyncio.Event()
        async def generate(payload):
            ready.set()
            await finish.wait()
            return {"model": MODEL, "done": True, "done_reason": "stop", "response": "answer"}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=create_api("0.21.0", generate)), base_url="http://test") as client:
            first = asyncio.create_task(client.post("/generate", json={"prompt": "q"}))
            await ready.wait()
            second = await client.post("/generate", json={"prompt": "q"})
            self.assertEqual(second.status_code, 429)
            finish.set()
            self.assertEqual((await first).status_code, 200)


if __name__ == "__main__":
    unittest.main()
