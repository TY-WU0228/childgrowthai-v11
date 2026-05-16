ChildGrowth AI V68 - Report Balance + UI Cleanup

Based on V67.

Fixes:
1. Homework report became too conservative in V67.
   - Clear wrong answers like 18+13=21 should be in "需要覆核".
   - Correct answers like 6×6=36, 18+9+10=37, and correct Number Patterns should be in "已做得好的地方".
   - Lines such as "正確應該係31" are treated as errors, not strengths.

2. AI raw text is hidden by default.
   - "完整 AI 原文" is now inside a collapsible details section.
   - Page is shorter and easier for parents to read.

3. Recent homework history is limited.
   - Shows the latest 3 reports by default.
   - Button to "顯示全部" / "收起".

4. Teacher Comment wording clarified.
   - Renamed to "School Teacher Comment".
   - Clarifies that school/classroom teacher comments go here.
   - Extracurricular coach comments should go to Activity Progress AI.

Kept:
- V67 conservative vision safety, but balanced.
- V66 structured report.
- V64 image compression and "只分析第一張".
- Multi-photo upload and homework history.
- Calendar / Routine / Smart Prep / Capture / Activity Progress retained.

No data deletion.
