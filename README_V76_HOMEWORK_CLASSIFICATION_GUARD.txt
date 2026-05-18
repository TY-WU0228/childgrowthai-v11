ChildGrowth AI V76 - Homework Classification Guard

Based on V75.

Problem fixed:
- AI report could still put correct answers inside "需要覆核".
- AI could mention a clear wrong answer in "可能出錯原因" (e.g. 18+13寫咗21) but fail to list it under "需要覆核".

V76 fixes:
1. Frontend + backend hard guard:
   - Positive-only lines such as "正確 / 暫無錯 / 答對 / 寫得正確" are moved out of Review.
   - Clear arithmetic errors mentioned anywhere in reasons/raw text are added to Review.

2. Arithmetic verification guard:
   - Detects simple expressions such as:
     18+13寫咗21 -> computes 31 -> adds 【明確錯】18+13=21，正確應為31.
   - Correct expressions such as 3x6=18 or 2x9=18 are not kept as Review.

3. Prompt tightened:
   - Correct answers cannot be placed in Review.
   - Any explicit wrong answer must appear in Review.

Kept:
- V75 Homework AI reliability fixes.
- V74 Report Engine v1.
- V72 Calendar Prep Event.
- V70 classification rules.
- Official slogan.

No data deletion.
