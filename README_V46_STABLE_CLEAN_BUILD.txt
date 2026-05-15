ChildGrowth AI V46 - Stable Clean Build

This is a clean rebuild based on V45, not another patch layer.

Main goal:
- Stop stacking old V10/V20/V30/V40 scripts.
- Replace index.html with a single clean renderer.
- Use one main data model: cg_app_v46.
- Migrate old localStorage data into the new model.
- Keep useful features from previous versions.

Kept features:
- Child profile
- Home Today / Tomorrow reminders
- Today Task with quick add + edit/delete
- Routine Manager with add/edit/delete
- Monday-Friday school schedule
- Weekly routine overview
- School Notice AI
- Homework AI
- Teacher Comment
- Emotion Check
- Analytics / Weekly Review
- Beta privacy note

Important clean-up:
- No setInterval auto-refresh loops.
- No page jumping from repeated re-render.
- Each page has one renderer only.
- Add/edit/delete triggers refresh once only.
- Home = action reminders.
- Profile / 我的 = settings + weekly routine overview.
- Record = input data + School Notice AI.
- Homework = homework upload and AI report.
- Analytics = dashboard + weekly review.

Data:
- New main key: cg_app_v46.
- Old keys are migrated:
  cg_child_profile_v30
  cg_v33_weekly_routines
  cg_v24_custom_activities
  cg_v28_today_tasks
  cg_today_tasks
  cg_v44_school_notices
  childgrowth_records
- V46 also mirrors key data back to common old keys for safety.

Deploy:
1. Extract ZIP.
2. Upload ALL extracted files to GitHub.
3. Commit changes.
4. Wait for Netlify to publish.
5. Open with ?v=46 if phone cache is stubborn.

Test checklist:
1. Home loads without jumping for 15 seconds.
2. Quick add piano after 6:30 PM uses future time.
3. Edit today task works.
4. Profile weekly overview opens and stays stable.
5. Routine manager can add/edit/delete.
6. Mon-Fri school creates 5 days.
7. School Notice AI can paste text and Confirm Add.
8. Homework AI can upload photo.
9. No duplicate old profile/routine blocks should appear.


V47 patch:
- Compact header.
- Native time picker for Today Task and Routine time fields.


V48 patch:
- Home Today Snapshot.
- School Notice Manager with Done status.
- Better weekly review and homework report format.
- UI polish.


V49 patch:
- Activity Progress AI.
- Photo / video frame / voice note text / coach comment modes.
- Activity reports in Analytics and Weekly Review.
