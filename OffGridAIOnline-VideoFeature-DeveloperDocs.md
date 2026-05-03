# OffGrid AI Online: Video Frame Extraction Feature
## Developer Master Technical Documentation

**Version:** 1.0 (Reflects v5.6.3-codex / Commit `5abb121`)
**Date:** May 03, 2026
**Author:** Manus AI

---

## 1. Feature Overview and Purpose

The Video Upload and Frame Extraction feature is a core multimodal capability of the OffGrid AI Online platform, designed specifically for field-research, survival, and emergency contexts. It allows users to upload short video clips (up to 20 seconds) for multi-angle identification of plants, tracks, vehicle issues, or terrain.

In alignment with the OffGrid AI "Privacy First, Always" mandate, **no video files are ever uploaded to the server**. Instead, the platform utilizes a sophisticated client-side JavaScript extraction pipeline to pull a representative sample of static frames from the user's video entirely within the browser. These frames are then down-sampled, compressed into Base64 JPEG strings, and transmitted to the Node.js backend as a sequence of images for the Gemma 4 26B model to analyze.

This approach provides three distinct advantages:
1.  **Privacy:** Sensitive video data never leaves the user's device.
2.  **Bandwidth Efficiency:** Transmitting 8 compressed JPEG frames requires significantly less bandwidth than uploading an HD video file, fulfilling the platform's "Built for weak signals" promise.
3.  **Model Compatibility:** By converting video into sequential images, the platform leverages the powerful image-analysis capabilities of multimodal LLMs without requiring native video-ingestion endpoints.

## 2. Client-Side Implementation (`index.html`)

The client-side implementation is responsible for accepting the file, validating it, extracting the frames, and managing the UI state. The current implementation represents a highly refined, cross-platform approach developed after extensive testing against iOS Safari limitations.

### 2.1 File Input and Validation

The feature utilizes two hidden file inputs: one for standard file selection (`#videoInput`) and one explicitly configured for live camera capture (`#videoRecordInput` with `capture="environment"`). Both inputs utilize `accept="video/*"` to ensure native compatibility with iOS camera formats (such as HEVC and MOV), which often fail to trigger when specific MIME types are enforced.

When a file is selected, the `handleVideoSelect(event)` function performs initial validation:
*   **Type Check:** Verifies the file against a list of allowed types or extensions (MP4, WebM, MOV, MPEG).
*   **Size Limit:** Enforces a hard 50MB file size limit to prevent browser memory exhaustion.

### 2.2 DOM Placement and the `<source>` Element Strategy

The core challenge of client-side frame extraction is forcing the browser's media engine to decode the video so frames can be drawn to a `<canvas>`. iOS Safari is notoriously aggressive about conserving resources and will refuse to decode videos that are hidden (`display: none` or `opacity: 0`) or unattached to the Document Object Model (DOM).

To guarantee decoding across all platforms, the implementation employs the following strategy:
1.  **Object URL:** Creates a temporary URL representing the local file using `URL.createObjectURL(file)`.
2.  **Barely On-Screen Placement:** The video element is appended directly to `document.body` with CSS styling that makes it functionally invisible but technically on-screen: `position:fixed; right:0; bottom:0; width:2px; height:2px; opacity:0.02; pointer-events:none; z-index:0;`.
3.  **The `<source>` Element:** Instead of assigning the Object URL directly to `videoEl.src` (which fails silently on iOS for blob URLs), the code creates a `<source>` child element, explicitly sets its `type` attribute via the `inferVideoType()` helper, and appends it to the video element.

### 2.3 Event Listeners and Initialization

Because browser event lifecycles vary wildly (especially on iOS), the code utilizes a "triple listener" approach. It attaches the `startExtractionOnce` handler to `loadedmetadata`, `loadeddata`, and `canplay`. Whichever event fires first triggers the extraction process, while a boolean flag (`extractionStarted`) prevents duplicate executions.

A 12-second safety timeout is initialized concurrently. If the browser fails to decode the video within this window, the process is aborted, cleanup occurs, and the user is presented with a clear error message.

### 2.4 Duration Validation and Frame Calculation

Once metadata is loaded, the script verifies the video duration. If it exceeds the 20-second limit, the process is aborted. 

For valid videos, the script calculates the exact timestamps for extraction. The target is **8 evenly spaced frames**. The timestamps are calculated to capture the center point of each chronological segment, ensuring a representative sample of the entire clip:
`frameTimes[index] = Math.min(duration - 0.05, Math.max(0, ((index + 0.5) / targetFrames) * duration))`

### 2.5 Dual-Path Extraction Architecture

The extraction logic splits into two distinct paths based on the user's platform, optimizing for reliability.

#### Method A: Playthrough Extraction (iOS Safari)
Seeking (`videoEl.currentTime = x`) is fundamentally broken for blob-backed videos on iOS Safari. Therefore, iOS devices utilize a "playthrough" method.
*   The video is played from start to finish at `1x` speed (faster speeds cause frame dropping on iOS).
*   The primary capture mechanism is `requestVideoFrameCallback` (rVFC), which fires precisely when the browser renders a new frame to the screen.
*   **`timeupdate` Fallback:** If rVFC fails to fire, a secondary `timeupdate` event listener acts as a fallback.
*   As the video plays, the script continuously checks the current playback time against the calculated `frameTimes`. When the playback time enters the tolerance window for the next target frame, `drawFrameToCanvas()` is called.

#### Method B: Seek-Based Extraction (Android / Desktop)
Non-iOS platforms utilize a faster, seek-based approach.
*   The script programmatically advances the video by setting `videoEl.currentTime = targetTime`.
*   It listens for the `onseeked` event (or utilizes a timeout fallback).
*   Once the seek completes, the frame is drawn to the canvas, and the script immediately seeks to the next timestamp.

### 2.6 Canvas Drawing and Cleanup

The `drawFrameToCanvas()` function handles the actual image extraction. It calculates the aspect ratio to fit the video frame within a 512x384 boundary, draws the current video state to a hidden `<canvas>`, and exports it as a Base64 JPEG string at 62% quality (`0.62`) to balance visual fidelity with token size.

Crucially, the `cleanupVideoEl()` function ensures no memory leaks occur. It pauses the video, removes the `src` attributes, calls `.load()` to flush the decoder, revokes the Object URL, and removes the video element from the DOM.

## 3. Server-Side Implementation (`index.js`)

The Node.js/Express backend is responsible for receiving the extracted frames, formatting them for the OpenRouter API, and injecting the necessary behavioral conditioning via the system prompt.

### 3.1 Frame Reception and Down-sampling

When the client submits a chat message containing a video, the frames are included in the payload as an array of Base64 strings (`msg.videoFrames`). 

Inside the `buildOpenRouterMessages()` function, the server enforces a hard limit of `maxFrames = 8`. If a client sends more than 8 frames (e.g., due to a modified client or legacy code), the server mathematically down-samples the array to exactly 8 evenly spaced frames. This ensures the payload remains within the token limits of the Gemma 4 26B model while maintaining a cohesive visual timeline.

### 3.2 Vision System Prompt Injection

To guide the AI's analysis of the frames, the backend injects two layers of prompting.

First, the global `OFFGRID_SYSTEM_PROMPT` contains a dedicated "Image and video analysis" section. This conditions the model's overall behavior:
> *   When analyzing images or video frames, always provide your best assessment even when uncertain.
> *   If you cannot make a confident identification, provide a short list of the most likely possibilities with brief reasoning for each...
> *   For video frame sequences, treat the frames as a cohesive visual narrative. Note changes between frames and use the full sequence to build a more complete picture than any single frame could provide.

Second, a specific instruction is prepended directly to the user's message payload alongside the image array:
> "These images are sequential frames extracted from a short video clip recorded by the user. Analyze each frame and describe what you observe across all of them, noting any changes or details between frames. Treat them as a cohesive visual sequence, not separate unrelated images."

This dual-prompting strategy ensures the AI understands it is looking at a timeline of events (a video) rather than 8 disjointed photographs.

## 4. Known Limitations and Edge Cases

*   **iOS Frame Accuracy:** Because iOS relies on a real-time playthrough method rather than precise seeking, the captured frames may deviate slightly from the exact mathematical timestamps, depending on device load and frame rendering speed.
*   **Base64 Token Limits:** While 8 frames at 512x384 JPEG (62% quality) fit comfortably within Gemma 4's 256K context window, repeated video uploads within a single long conversation could theoretically approach token limits. The platform currently utilizes a `stripBase64FromContent()` helper on the Command Center to mitigate this by stripping older images from the history array, a pattern that may need to be ported to the free tier if users experience context exhaustion.
*   **HEVC/HDR Color Space:** Videos recorded in HDR on newer iPhones may appear slightly washed out or color-shifted when drawn to a standard standard-gamut HTML `<canvas>`.

## 5. Version History

| Version | Date | Key Changes |
| :--- | :--- | :--- |
| **v5.6.3-codex** | May 2026 | **Current Implementation.** Replaced direct `src` assignment with `<source>` element. Implemented triple event listeners (`loadedmetadata`, `loadeddata`, `canplay`). Changed video placement to barely on-screen (`2x2px`, `opacity: 0.02`). Unified iOS rVFC + `timeupdate` fallback with 1x playback speed. |
| **v5.6.3** | Apr 2026 | Appended video element to DOM (hidden off-screen) to force iOS decoding. Added `timeupdate` fallback for rVFC. |
| **v5.6.2** | Apr 2026 | Introduced hybrid extraction: rVFC playthrough for iOS, seek-based extraction for Android/Desktop. |
| **v5.6.1** | Apr 2026 | Attempted iOS fix using `loadeddata` and play/pause buffering. Added pixel-check validation to avoid duplicate frames. |
| **v5.5.1** | Apr 2026 | Added vision-specific instructions to system prompt. Increased server-side frame limit from 5 to 8. |
| **< v5.5.0** | Apr 2026 | Initial implementation. 1fps extraction up to 5 frames. Seeking method only (failed on iOS). |

---
*End of Document*
