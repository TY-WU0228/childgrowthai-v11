ChildGrowth AI V72 - Calendar Prep Event Fix

Based on V70 Report Classification Stable.

Why:
- iPhone Calendar import interprets "1 day before" as 24 hours before event start, not previous night 8:00pm.
- Custom alarm triggers may still display/import as standard "1 day before" on iPhone.
- V72 uses a more reliable method: create a separate preparation event.

What V72 does:
1. When exporting a routine / school notice to Calendar, it creates TWO calendar events:
   A. Formal event
      Example: QS school
      Time: Sunday 9:00am-12:00pm
      Alert: 1 hour before

   B. Preparation event
      Example: 準備：QS school
      Time: Saturday 8:00pm-8:05pm
      Alert: At time of event
      Notes: bring items / prep list

2. Weekly routines:
   - Formal event repeats weekly.
   - Prep event also repeats weekly on the previous day at 8:00pm.

3. One-off school notices:
   - Formal event is one-off.
   - Prep event is one-off on the previous day at 8:00pm.

Important:
- Existing old iPhone Calendar events will not update automatically.
- Delete old imported QS school / routines from iPhone Calendar, then re-import from V72.
- iPhone may show two items during import. This is intended.

Kept:
- V70 Homework report classification stable.
- V68 raw AI text collapsed and recent homework limited.
- School Teacher Comment wording.
- Multi-photo upload and "只分析第一張".
- Routine / Smart Prep / Capture / Activity Progress retained.

Future official version:
- Should use app-native reminders / push notifications instead of relying on iPhone Calendar export.
- That requires a proper app shell / PWA notification permission / backend scheduler, and later probably user accounts + cloud database.

No data deletion.
