ChildGrowth AI V48 - UI Polish + Report Quality

Based on V47 Compact Header + Time Picker.

Focus:
- No major new architecture.
- Polish the app so it feels less empty after the clean build.
- Improve report usefulness without adding clutter.

Changes:
1. Home Today Snapshot
   - Adds a compact summary card near the top:
     tasks, routines, school notices, school time, after-school, prep items.
   - Helps parent understand the day without scrolling.

2. Better Parent Insight
   - Uses routines, today tasks and school notices to generate a more logical insight.

3. Notice Manager
   - Adds School Notice Manager under Record.
   - Notices can be marked Done / Not done, edited or deleted.
   - Home notices respect done status.

4. Weekly Review Quality
   - Replaces simple counts with:
     - 本週資料
     - AI 觀察
     - 家長下一步
   - Uses routines, emotions, school notices, homework and teacher comments.

5. Homework Report Format
   - Uses a clearer 5-part parent-friendly format:
     - 我睇到嘅內容
     - Level awareness
     - 做得好
     - 需要覆核
     - 今晚只做一件事

6. UI Polish
   - Slightly reduced font weight/size.
   - Added report blocks, section tags and better visual hierarchy.
   - Keeps V47 compact header and time picker.

No data deletion:
- Still uses cg_app_v46 data model.
- Existing data is preserved.
