ChildGrowth AI V35 - Routine Manager + Voice

Based on V34.

Fixes / changes:
1. Fixed routine list UX:
   - Profile / 我的 now only shows a short fixed-routine summary.
   - Delete buttons no longer appear directly on the main Profile page.
   - Add/delete/edit-style management is moved into a Routine Manager bottom sheet.

2. Voice routine input:
   - Parents can speak routine details.
   - Example: "Sunday 9am to 12pm QS school, prepare homework and water bottle."
   - The app parses:
     day, start time, end time, activity name, prep items.
   - Missing required info:
     day/date, start time, activity name.
   - If required info is missing, the routine is NOT added and the app asks for the missing info.
   - Reminder defaults to "前一晚 8:00 PM" if not provided.

3. Text input fallback:
   - If browser voice recognition is unavailable, parents can type the sentence and press "讀取文字".

4. Existing data:
   - Uses existing cg_v33_weekly_routines.
   - Does not delete existing routines or records.

Testing:
- Go to Profile / 我的.
- You should see only a short "固定行程" summary.
- Press 管理固定行程.
- Add a routine by template, text, or voice.
- Delete should only be inside the manager.
- Try typing: Sunday 9am to 12pm QS school 準備功課同水樽
