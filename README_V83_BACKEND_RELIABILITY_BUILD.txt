ChildGrowth AI V83 - Backend Reliability Build

Based on V82.

Main purpose:
- Fix recurring "AI analysis timeout" even when the function returns JSON.
- Make homework analysis more likely to complete by using fast model, longer backend timeout, one-image batches, and automatic retry.

What changed:
1. Frontend reliability:
   - Homework images are now analyzed one by one.
   - If an image times out, the app automatically retries using ultra-compressed image data.
   - If some images fail but others succeed, it still returns a partial report instead of failing the whole upload.
   - Status now shows model / route / timeout / image size debug pills.

2. Backend reliability:
   - Default homework model is forced to OPENAI_FAST_MODEL or gpt-4.1-mini.
   - It no longer uses OPENAI_MODEL in fast mode, so an env value like gpt-4.1 will not slow normal homework analysis.
   - Longer timeout: 22s for one image, 18s for multiple images, configurable with OPENAI_HOMEWORK_TIMEOUT_MS.
   - Lower token budget in fast mode for faster completion.
   - JSON error is still returned on timeout.

3. Still available:
   - Quality mode support in backend if future UI sends aiMode='quality'.
   - OPENAI_QUALITY_MODEL can be set to gpt-4.1 for slower/high-quality tests.

Kept:
- V82 Parent-facing report polish
- V81 JSON parsing / compression
- V80 Clean Evidence + Reading Intelligence
- V79 Homework Engine v2
- Up to 6 photos
- Calendar and official slogan

No data deletion.
