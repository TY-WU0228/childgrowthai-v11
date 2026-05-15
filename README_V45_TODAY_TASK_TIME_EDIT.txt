ChildGrowth AI V45 - Today Task Time + Edit

Based on V44.

Fixes:
1. Quick-add piano task time:
   - Previously quick-add piano always used 6:30 PM, even if current local time was already after 6:30 PM.
   - V45 reads the phone/browser local timezone using new Date().
   - If 6:30 PM has passed, it uses the next sensible 30-minute slot.
   - Example: if current time is 6:45 PM, piano quick-add becomes about 7:00 PM.

2. Today task edit:
   - Today tasks now show 修改 + 刪除.
   - Press 修改 to load task into input fields.
   - Edit task name/time/note.
   - Press 保存修改.
   - Can cancel edit.

3. Time explanation:
   - Adds a hint explaining that default quick-add time is adjusted by current device time.
   - User can edit to 7:30 PM or any preferred time.

Data:
- Uses existing localStorage keys where possible:
  cg_v28_today_tasks / cg_today_tasks / cg_v45_today_tasks.
- Mirrors updated task list across these keys.
- Does not delete existing routines, notices, or homework records.

Test:
- At a time later than 6:30 PM, press 快速加練琴.
- It should not create a 6:30 PM task.
- Press 修改 and change time to 7:30 PM.
- Save and confirm the displayed task updates.
