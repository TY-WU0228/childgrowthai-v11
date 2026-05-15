ChildGrowth AI V42 - Single Source + Home Reminders

Based on V41.

Fix:
- The app previously showed today's Friday schedule in one summary, but the weekly overview still showed Friday as 0 activities.
- This happened because older overview blocks were showing stale rendered content.
- V42 hides old stale weekly blocks and renders a new weekly overview from the same routine data source used by the summary.

UX decision:
- Home page shows Today's / Tomorrow's reminders because this is action-oriented and parents need it first.
- Profile / 我的 shows the full weekly routine overview because it is for management/review.

Changes:
1. Home:
   - Adds 今日 / 明日提醒.
   - Uses cg_v33_weekly_routines.

2. Profile / 我的:
   - Adds a new single-source 一週固定行程總覽.
   - Uses the exact same cg_v33_weekly_routines data.
   - Friday school/chess should show in both places after sync.
   - Old stale v36/v40 blocks are hidden.

3. Sync Janice schedule:
   - Monday-Friday School 8:45 AM - 3:30 PM.
   - Thursday Soccer and Swimming.
   - Friday Chess.
   - Duplicate routines are skipped.

No data deletion.
Existing routines and records are preserved.
