ChildGrowth AI V78 - Homework UI + Capture Fix

Based on V77.

Fixes included:
1. Homework report readability:
   - "我睇到嘅內容" is now compacted into 2-3 parent-friendly bullet points.
   - Long raw summary is hidden inside "查看原本詳細內容".

2. Review contradiction guard strengthened:
   - If a line says 明確錯 but also says 正確 / 答案正確 / 目前答案正確 / 無需覆核 / 其實是正確答案, it is moved out of Review.
   - English multiple-choice lines are handled better:
     selected C + correct C -> Good
     selected A + correct B -> Review

3. Quick Capture first-click fix:
   - Exposes openCapture() on initial boot.
   - Adds delegated click handler so the Home quick capture button works immediately after app opens.

4. Homework upload:
   - Analysis now sends up to 6 images instead of 3.
   - Backend accepts up to 6 de-duplicated images.

Kept:
- V77 contradiction guard.
- V76 arithmetic guard.
- V75 reliability fix.
- V74 Report Engine v1.
- V72 Calendar Prep Event.
- Official slogan.

No data deletion.
