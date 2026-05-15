ChildGrowth AI V51 - Home Repair + Splash

Based on V50.

Fixes:
1. Blank Home screen fixed.
   - V50/V49 inherited a bug in todaySummaryHTML.
   - It referenced "acts" inside Home before acts existed, causing renderHome to fail.
   - This left the Home page blank while bottom nav still showed.

2. Splash screen restored.
   - Shows ChildGrowth AI, Chinese slogan and English slogan for about 1.2 seconds.
   - Then fades out.
   - If the app hits a boot error, it shows a visible error box instead of a blank Home page.

3. Coach Voice Note UI fixed.
   - V50 had voice JS/CSS but the actual Coach Voice Note box could fail to appear.
   - V51 ensures the voice UI is inserted into Activity Progress AI.

Kept:
- V48 UI polish and report quality
- V49 Activity Progress AI
- V50 Coach Voice Notes
- V47 time picker
- V46 clean data model

No data deletion.
