ChildGrowth AI V43 - Edit Routine Manager

Based on V42.

Fix:
- Fixed routine manager only having Delete and no Edit.
- Added Edit / Modify button for each routine.
- User can fix activity name, day, start/end time, prep items, reminder time, and homework impact without deleting/re-adding.

New:
1. Each routine row has:
   - 修改
   - 刪除

2. Edit flow:
   - Press 修改.
   - Fields are filled with existing routine data.
   - Button changes to 保存修改.
   - Press 保存修改 to update the existing routine.
   - Press 取消修改 to exit edit mode.

3. One-click school name fix:
   - Button: 修正學校名為 Oakleigh South PS
   - Renames matching school routines to 🏫 Oakleigh South Primary School.

4. Same data source:
   - Updates cg_v33_weekly_routines.
   - Home reminders and weekly overview refresh after edit/delete.

No data deletion:
- Existing routines and records are preserved.
