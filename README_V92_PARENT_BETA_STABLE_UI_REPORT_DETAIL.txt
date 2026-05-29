ChildGrowth AI V92 - Parent Beta Stable UI + Report Detail

Based on V90.

Purpose:
- Create one unified beta build for parent testers.
- Combine the V91 report-detail idea with parent onboarding UI polish.

Major changes:
1. Homework report review detail
   - "需要覆核的位置" now shows counts:
     明確錯 / 需家長確認 / 未完成.
   - Shows exact review cards with:
     question / child answer / correct answer / skill.
   - Correct items are not shown as review items.
   - If there are many items, first 5 show directly and the rest are under "查看全部".

2. Prompt/report engine rules
   - If AI says there are X review positions, it must list them.
   - Review section must contain exact questions or positions, not only reasons.
   - Math answers must be rechecked before marking wrong/correct.
   - More review points are preserved (up to 30 instead of 6).

3. Beta onboarding UI polish
   - Added "International school" under school type.
   - Shortened language labels:
     Cantonese + English, Mandarin + English, Traditional Chinese + English.
   - Reduced mixed Chinese/English labels:
     老師評語記錄, 課外活動進度, 學校通告 / 提醒, 每週成長報告.
   - Added a short note explaining Hong Kong beta language style.

4. Activity time picker
   - Start/End time fields now use native time picker inputs.
   - Parents no longer need to type times manually.

5. Beta Home Screen flow
   - Manifest start_url updated to /?v=92&beta=1&homescreen=1.
   - Existing V90 forced beta onboarding guard remains.

Testing links:
- Parent beta: https://childgrowthai.com.au/?v=92&beta=1
- Normal / Irene use: https://childgrowthai.com.au/?v=92
- Admin debug: https://childgrowthai.com.au/?v=92&admin=1

Deploy advice:
- Test V92 on a staging Netlify site first.
- If stable, deploy to production and ask beta parents to delete old Home Screen icon and add the new V92 link again.
