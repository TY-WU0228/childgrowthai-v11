ChildGrowth AI V64 - Homework AI Stable Restore

Based on V63.

Why this version exists:
- Earlier versions (around V40/V50) could analyze homework.
- Later multi-photo/history changes made the flow more fragile, especially when several full iPhone photos were sent at once.
- V64 restores the older stable Homework AI backend style and adds safer front-end image compression.

Fixes:
1. Homework AI uses the V40/V50-style analyze-homework function again.
2. Front-end compresses iPhone photos before sending to AI.
   - Max dimension ~1400px
   - JPEG quality ~0.72
   - Sends up to first 3 pages
3. Added “只分析第一張” button.
   - Use this to confirm AI connection if multi-photo fails.
4. Still saves homeworkReports even if AI fails.
5. Error details are shown in a Debug box instead of only saying API key may be missing.

Kept:
- V63/V62 Calendar title fix.
- Multi-photo upload.
- Homework history / 最近功課分析.
- V61 smart prep suggestions.
- V60 routine restore/click fix.
- V57 Capture + Calendar.
- Activity Progress / Teacher Comment / School Notice.

No data deletion.
