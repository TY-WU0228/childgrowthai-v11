ChildGrowth AI V77 - Review Contradiction Guard

Based on V76.

Problem fixed:
- V76 found true wrong answers, but some review lines still contradicted themselves:
  Example:
  【明確錯】15+4=19，正確應為19（正確，無需覆核）
  This should not be Review.
  Example:
  【明確錯】number pattern ... 35,28，目前答案正確
  This should not be Review.

V77 fixes:
1. If a line says "明確錯" but also says:
   - 正確
   - 無需覆核
   - 目前答案正確
   - 暫無錯
   and arithmetic is correct or there is no arithmetic mismatch, it is moved out of Review.

2. 18+13=21, correct answer 31 remains Review.

3. Correct lines such as:
   - 15+4=19, correct is 19
   - number pattern answer currently correct
   no longer stay in Review.

Kept:
- V76 arithmetic error guard.
- V75 Homework AI reliability fixes.
- V74 Report Engine v1.
- V72 Calendar Prep Event.
- Official slogan.

No data deletion.
