ChildGrowth AI V93 - Report Integrity + Parent Fail-safe Fix

Based on V92.

Fixes from V92 testing:
1. Fail-safe consistency
   - If AI only partly analyses the upload or any image fails, parent mode will NOT show a full report.
   - It shows a short "images saved / AI incomplete" card instead.
   - Green "analysis complete" is only shown when the analysis is complete.

2. Parent-facing technical filter
   - Parent reports hide JSON, function, model, route, debug, API, timeout/retry and version language.
   - Technical details remain visible only in admin mode.

3. Review detail integrity
   - "需要覆核的位置" now filters out summary sentences.
   - It only keeps specific wrong/unclear/missing items with question/position and answer evidence.
   - Correct or positive items are removed from review.

4. Section parser fixed
   - Server function now parses sections 2/3/4/5/6 using the current report headings.
   - This prevents Section 3 from accidentally including Section 4 or summary text.

5. Parent report length
   - Wow summary and parent interpretation are shortened and sanitized for beta parents.

Links:
- Parent beta: https://childgrowthai.com.au/?v=93&beta=1
- Irene normal mode: https://childgrowthai.com.au/?v=93
- Admin debug: https://childgrowthai.com.au/?v=93&admin=1

Deploy advice:
- Test on staging first.
- Try one 1-photo maths report and one 4-6 photo report.
- Confirm that partial failure does not show a full report.
