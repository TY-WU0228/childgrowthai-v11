ChildGrowth AI V62 - Calendar + Homework History

Based on V61.

Fixes:
1. iPhone Calendar export:
   - Calendar event title should now use the real routine/notice/task name, e.g. QS school, not "新行程".
   - ICS format now uses clean CRLF lines and proper SUMMARY.
   - Notes no longer show literal \n.
   - Reminder alarm order adjusted to try to show 1 day before + 1 hour before more naturally in iPhone Calendar.

2. Homework AI:
   - Upload homework photos now supports multiple images.
   - Preview grid shows selected pages.
   - Frontend sends images[] to Netlify function. This fixes the earlier mismatch where the backend expected images[] but frontend sent image only.
   - If AI fails because OPENAI_API_KEY / function / network is not ready, the upload attempt is still saved into homeworkReports as an offline/fallback record.
   - Recent Homework Analysis now shows image count and saved fallback records.
   - Successful raw AI analysis is displayed in a "完整 AI 分析" box.

3. Long-term report logic:
   - homeworkReports continues to store every homework analysis/fallback record.
   - This is the data source for weekly/growth reports in beta.
   - For true long-term day 1 to day 100 across devices, Supabase/cloud save still needs to be fully connected.

Kept:
- V61 smart prep suggestions.
- V60 routine restore/click fix.
- V57 Capture + Calendar.
- Teacher Comment Voice / School Notice / Activity Progress.

No data deletion.
