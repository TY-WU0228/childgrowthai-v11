ChildGrowth AI V60 - Routine Restore + Click Fix

Based on V59 Safe Deploy.

Fixes:
1. Activity Progress buttons not responding.
   - Inline onclick functions are now exposed to window.
   - Photo / Short video / Voice note / Coach comment clicks are also handled by delegated click listener.
   - Old duplicate Activity DOM is cleaned after render.

2. Missing Janice routines.
   - If Monday–Friday school schedule is missing, V60 automatically restores core Janice routines:
     Mon–Fri Oakleigh South Primary School 8:45 AM–3:30 PM
     Tuesday Minecraft coding
     Thursday Soccer
     Thursday Swimming
     Friday Chess
     Saturday Chinese class
     Sunday QS school
   - Existing routines are not deleted.
   - Any accidental “All Prime School” routine name is corrected to “Oakleigh South Primary School”.
   - A manual “修復固定行程” button is available near 管理固定行程.

3. Cache control.
   - Added _headers and netlify.toml no-cache for index.html.
   - Open with ?v=60 after deploy.

Kept:
- V59 safe deploy minimal package
- V58 Activity final cleanup
- V57 Capture + Calendar
- Teacher Comment Voice / School Notice / Homework AI

No data deletion.
