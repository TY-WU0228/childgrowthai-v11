ChildGrowth AI V26 - Bug Fix + UX Polish

Based on V25.

Fixes:
1. Home schedule now shows time ranges:
   - School: 8:45 AM – 3:30 PM
   - Friday Chess: 3:30 PM – 4:30 PM
   - Other activities use start/end times where known.

2. Date/input overflow fixed:
   - All input/select/textarea use border-box and max-width 100%.

3. Emotion duplicate bug fixed:
   - Same-day emotion tap now updates the existing record instead of creating many duplicates.
   - Old repeated same-day emotion taps are migrated/deduplicated on load.

4. Analysis chart overflow fixed:
   - Bar chart is normalized and capped, so one high day cannot break the layout.
   - Counts are based on cleaned daily records.

5. AI report contradiction fixed:
   - Backend prompt now says not to list correct examples as suspected mistakes.
   - "可能錯題" changed to "需要覆核的位置".
   - AI must verify arithmetic before using examples.

Deploy:
1. Extract ZIP.
2. Upload all files to GitHub.
3. Commit changes.
4. Netlify auto deploy.
5. Test:
   - Home schedule time ranges.
   - Record page date input does not overflow.
   - Tap emotion repeatedly: one daily record only.
   - Analysis chart does not overflow.
   - Upload homework: report should avoid contradictory examples.
