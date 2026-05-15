ChildGrowth AI V33 - Beta Ready + Routine Setup

Based on V32.

Main new feature:
- Optional Weekly Routine Setup in onboarding.
- Quick templates for Soccer, Swimming, Piano, Chinese class, Tutoring, Coding, Chess, Art, Gymnastics, Playdate.
- Each routine can include:
  day, start time, end time, prep checklist, reminder timing, homework impact.
- Home now shows:
  Today's routine reminders
  Tomorrow prep reminders
  Homework-load suggestion based on activities.
- Profile now has a full Weekly Routine Setup manager.

Other improvements included:
1. Better onboarding flow with optional routine setup.
2. Home reminder system for tomorrow prep.
3. Weekly review now links routines and parent goals.
4. Privacy / beta note added.
5. Non-diagnostic safety language strengthened in AI homework prompt.
6. Existing users keep data; no storage clearing.
7. Old v24 custom activities migrate into V33 routines.
8. Cleaner beta testing direction.

Data note:
- This version does NOT clear existing localStorage.
- Existing routines from cg_v24_custom_activities are migrated.
- New V33 routines are stored in cg_v33_weekly_routines.

Deploy:
1. Extract ZIP.
2. Upload all files to GitHub.
3. Commit changes.
4. Netlify auto deploy.

Test:
- Home: routine reminder card should appear.
- Profile: Weekly Routine Setup card should appear.
- Onboarding for new user: optional routine setup should appear.
- Add Swimming / Piano using quick template and check Home reminder.
