ChildGrowth AI V69 - Review Separation Fix

Based on V68.

Fix:
- V68 correctly placed clear wrong answers in "需要覆核", but still allowed positive lines such as
  "Janice 寫得正確" to appear inside the review section.
- V69 strictly separates:
  1. "已做得好的地方" = correct answers, successful patterns, no-error observations.
  2. "需要覆核的位置" = only clear errors, unclear handwriting needing parent confirmation, or unfinished work.

Specific examples:
- 18+13=21, correct answer 31 -> "需要覆核".
- 70,63,56,49,42,35,28 Janice 寫得正確 -> "已做得好的地方", not review.
- "其餘答案暫時未見錯誤" -> not review.

Kept:
- V68 raw AI text collapsed by default.
- Recent homework shows latest 3 by default.
- School Teacher Comment wording.
- V64 image compression and "只分析第一張".
- Calendar / Routine / Smart Prep / Capture / Activity Progress retained.

No data deletion.
