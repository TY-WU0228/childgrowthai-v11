ChildGrowth AI V32 - Existing User Onboarding Fix

Based on V31.

Problem fixed:
- Some existing users were incorrectly shown the first-time onboarding screen.
- The cause was older app data being stored under different localStorage keys.
- V32 checks multiple historical keys:
  childgrowthai-v8
  childgrowth-v8
  childgrowth_records
  cg_v24_custom_activities
  cg_child_current_year
  cg_child_profile_v30

Behavior:
- Existing users will NOT be forced into onboarding.
- Existing data is NOT deleted.
- A V30 profile is created/mirrored from existing data where possible.
- New users with no ChildGrowth data will still see onboarding.

Testing:
- On Irene's existing phone: app should go to Home after splash, not full-screen setup.
- In private browsing or after clearing site data: onboarding should still appear for new users.
- Profile page still has 修改小朋友設定 if user wants to edit setup.

Deploy:
1. Extract ZIP.
2. Upload all files to GitHub.
3. Commit changes.
4. Netlify auto deploy.
