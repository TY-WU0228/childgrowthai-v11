ChildGrowth AI V47 - Compact Header + Time Picker

Based on V46 Stable Clean Build.

Fixes:
1. Removed the large sticky top heading.
   - The previous global ChildGrowth AI / version heading took too much screen space.
   - V47 hides the sticky header.
   - Home now only has a small brand chip inside the first card.

2. Time inputs now use native time picker.
   - Today Task time uses <input type="time">.
   - Routine start time uses <input type="time">.
   - Routine end time uses <input type="time">.
   - On iPhone this should show the time picker instead of Chinese keyboard.

3. Time data still displays parent-friendly format.
   - Internally time picker uses HH:MM.
   - Saved/displayed times convert back to 8:45 AM / 3:30 PM / 8:00 PM style.

4. Quick-add and edit still work.
   - Quick add piano avoids past time.
   - Editing today task converts saved time to time-picker value.
   - Editing routine converts saved start/end time to time-picker values.

No data deletion:
- Uses same cg_app_v46 data model.
- Existing routines/tasks remain available.
