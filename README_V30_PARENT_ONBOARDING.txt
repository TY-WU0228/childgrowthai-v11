ChildGrowth AI V30 - Parent Onboarding

Based on V29.

Important data note:
- This update does NOT clear existing localStorage.
- Existing users keep their homework, teacher comments, moods, custom activities, and profile data.
- New users only will see first-time onboarding automatically.
- Existing users can edit onboarding/profile from Profile > 修改小朋友設定.

New onboarding collects:
- Child name
- Age / birth year
- Current school year
- School
- Region / curriculum
- Main language
- Strengths
- Watch areas
- Optional support needs
- Parent goals

Design:
- Required setup is light.
- Support needs are optional and clearly not diagnostic.
- Regular weekly activities are still added later in Profile > custom activities.
- Today-only tasks remain on Home > Today Plan.

Deploy:
1. Extract ZIP.
2. Upload all files to GitHub.
3. Commit changes.
4. Netlify auto deploy.

Testing:
- Existing device/domain should NOT lose data.
- If existing data is found, onboarding will not block the user.
- To test new-user onboarding, open in private browsing or clear site data.
