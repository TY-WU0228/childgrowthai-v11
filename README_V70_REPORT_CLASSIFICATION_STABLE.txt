ChildGrowth AI V70 - Report Classification Stable

Based on V69.

Purpose:
- Stop patching one homework example at a time.
- Introduce a stable classification rule:
  GOOD -> 已做得好的地方
  REVIEW / UNCLEAR -> 需要覆核的位置

Rules:
1. 已做得好的地方:
   - correct answers
   - 寫得正確
   - 答對 / 答啱
   - 成功推算
   - 暫未見錯誤
   - good effort / positive observations

2. 需要覆核的位置:
   - 【明確錯】
   - 【需家長確認】
   - 未完成 / 漏做 / 空白

3. If a sentence contains:
   - "正確應該係31"
   - "應該係31"
   - "Janice 寫21"
   then it is REVIEW, not GOOD.

4. If a sentence contains:
   - "Janice 寫得正確"
   - "答案正確"
   - "暫未見錯誤"
   then it is GOOD, not REVIEW.

What changed:
- Backend and frontend both sanitize report categories.
- Correct/no-error lines are moved out of Review.
- Clear error lines are moved out of Good.
- UI wording updated to explain the fixed rule.

Kept:
- V68 raw AI text collapsed by default.
- Recent homework shows latest 3 by default.
- School Teacher Comment wording.
- V64 image compression and "只分析第一張".
- Calendar / Routine / Smart Prep / Capture / Activity Progress retained.

No data deletion.
