ChildGrowth AI V71 - Calendar 8PM Reminder Fix

Based on V70.

Problem fixed:
- iPhone Calendar displays imported alerts as "1 hour before" and "1 day before".
- "1 day before" means 24 hours before event start, not previous night at 8:00pm.
- For a 9:00am event, 1 day before is 9:00am the day before, so the user would not receive a reminder at 8:00pm.

V71 fix:
- The exported .ics reminder now calculates a relative alarm that triggers at the previous day's 8:00pm.
- Example:
  - Event starts Sunday 9:00am
  - Reminder trigger becomes 13 hours before
  - Notification should occur Saturday 8:00pm
- Keeps a second alert at 1 hour before the event.

Important:
- Existing imported iPhone Calendar events will NOT change automatically.
- Delete the old imported event from iPhone Calendar and re-import from V71.

Kept:
- V70 Homework report classification stable.
- V68 raw AI text collapsed and recent homework limited.
- School Teacher Comment wording.
- Multi-photo upload and "只分析第一張".
- Calendar / Routine / Smart Prep / Capture / Activity Progress retained.

No data deletion.
