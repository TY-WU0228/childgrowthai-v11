ChildGrowth AI V27 - Weekly Report + Cloud Polish

Based on V26.

Changes:
1. Weekly Review is now a parent-friendly report:
   - Data confidence
   - Weekly summary
   - Learning observation
   - Emotion / energy observation
   - Teacher comment status
   - 3 next actions
   - No more long raw emotion tap list

2. Cloud Save status is user-friendly:
   - No scary JSON as the main message
   - Shows clear explanation if family_records table is missing
   - Technical details hidden inside expandable section

3. Cloud-save function is service-role ready:
   - If SUPABASE_SERVICE_ROLE_KEY exists, it uses safer server service role mode.
   - Otherwise it uses anon MVP mode.

4. Added Supabase setup files:
   - SUPABASE_SETUP_MVP.sql
   - SUPABASE_SETUP_SAFER_SERVICE_ROLE_NOTES.txt

Deploy:
1. Extract ZIP.
2. Upload all files to GitHub.
3. Commit changes.
4. Netlify auto deploy.
5. Test Weekly Review and Test Cloud Save again.
