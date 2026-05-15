ChildGrowth AI V41 - Profile No-Jump Fix

Based on V40.

Problem fixed:
- Profile / 我的 page was moving up and down by itself.
- Cause: older patch scripts were re-rendering profile/routine/weekly overview every few seconds.
- V41 disables these periodic re-renders and changes the page to render once when needed.

Changes:
1. Removed periodic profile/routine setInterval re-renders.
2. Added manual "刷新總覽" button.
3. Routine add/delete/import will refresh once only.
4. Weekly overview expanded/collapsed state remains stable.
5. Added scroll guard to prevent sudden jumps if any older mutation still happens.

Intervals disabled: 12

No data deletion:
- Existing routines and records are preserved.

Deploy:
1. Extract ZIP.
2. Upload all files to GitHub.
3. Commit changes.
4. Netlify auto deploy.

Test:
- Open Profile / 我的 and do not touch anything for 10 seconds.
- The page should not jump up/down.
- Expand weekly overview; it should stay expanded.
- Add/delete routine; the overview should refresh once, not keep jumping.
