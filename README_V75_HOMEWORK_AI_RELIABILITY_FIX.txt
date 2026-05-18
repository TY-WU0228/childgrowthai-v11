ChildGrowth AI V75 - Homework AI Reliability Fix

Based on V74.

Problem:
- V74 added Report Engine v1, but Homework AI analysis could fail and fall back to offline report.
- Likely causes:
  1. Backend prompt became too long after many version rules accumulated.
  2. Same uploaded image could be sent multiple times through images / imageDataList / image fields.
  3. Error message on the phone was too generic to debug.

Fixes:
1. Simplified analyze-homework prompt while keeping the core rules:
   - level awareness
   - correct vs review separation
   - parent-friendly report
   - Growth Memory Tags
   - safety rules

2. De-duplicated uploaded images in backend collectImages().
   - One uploaded image is now sent once, not repeated.

3. Clearer frontend error display.
   - If analysis fails, the app shows the actual error message so it can be fixed.

4. Kept:
   - V74 Report Engine v1 / Growth Memory
   - V72 Calendar Prep Event Fix
   - V70 Report Classification Stable
   - Official slogan
   - Routine / Smart Prep / Capture / Activity Progress / School Teacher Comment

No data deletion.
