ChildGrowth AI V67 - Conservative Homework Vision

Based on V66.

Why this version:
- V66 report quality improved, but AI Vision still sometimes misread pencil handwriting.
- Example: a correct 6×6=36 or 18+9+10=37 could be put under "needs review".
- V67 makes the report engine more conservative.

Changes:
1. Prompt now instructs AI:
   - Do not claim a handwritten answer is wrong unless both printed question and written answer are 95% clear.
   - If handwriting is unclear, mark as 【需家長確認】 rather than "wrong".
   - If the AI itself says an item is correct, it must not place it under needs review.
   - Correct examples like 6×6=36 / 18+9+10=37 / correct number patterns should be listed as strengths, not review points.

2. Frontend and backend post-processing:
   - Lines containing 正確 / 答對 / 成功推算 are moved away from checkPoints.
   - "明顯計錯" is softened to "AI 視覺疑似需要家長確認".
   - Review section title now reminds parents that AI vision may need confirmation.

3. Kept:
   - V66 structured report.
   - V64 image compression and "只分析第一張".
   - Multi-photo upload and homework history.
   - Calendar / Routine / Smart Prep / Capture / Activity Progress unchanged.

No data deletion.
