ChildGrowth AI V34 - Profile Cleanup

Based on V33.

Fix:
- Removes duplicate profile cards in the Profile / 我的 tab.
- Hides older hard-coded "Child Profile" form that asked again for:
  Child nickname, Year level, Main focus, Most busy day.
- Hides old Janice Profile patch cards.
- Adds one consolidated profile card at the top:
  child name, year level, school, age, strengths, watch areas, parent goals, counts.
- Keeps "修改小朋友設定" button for editing onboarding/profile.
- Keeps Weekly Routine Setup for activities.
- Does not delete existing data.

Deploy:
1. Extract ZIP.
2. Upload all files to GitHub.
3. Commit changes.
4. Netlify auto deploy.

Test:
- Go to Profile / 我的.
- You should see only one main Janice Profile card.
- You should NOT see another "Child Profile" form asking for nickname/year level.
- Weekly Routine Setup should still appear below.
