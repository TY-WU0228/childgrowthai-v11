ChildGrowth AI V49 - Activity Progress AI

Based on V48 UI Polish + Report Quality.

New feature:
- Activity Progress AI for extracurricular activities.

Not duplicate with Teacher Comment:
- Teacher Comment remains a general school/classroom observation record.
- Activity Progress AI is specific to extracurricular progress: Piano, Swimming, Tennis, Chess, Soccer, Art, Dance/Gymnastics, Custom.
- Coach comment can be used as an input mode inside Activity Progress AI; it turns activity-specific coach feedback into a structured progress report.

Input modes:
1. Photo mode: piano score, chess board, art work, certificate, coach note photo.
2. Short video mode beta: browser extracts 3 frames from the video and AI uses frames + parent note for broad parent-level observations.
3. Voice note mode: parent types/summarises what was said or observed. Future version can add live voice recording.
4. Coach comment mode: paste or type coach feedback.

AI output:
1. 今日活動
2. 我睇到 / 家長提供咗咩
3. 做得好
4. 需要留意
5. 下次練習重點
6. 可以問教練一句

Backend:
- Adds netlify/functions/analyze-activity-progress.js
- Requires OPENAI_API_KEY.
- Uses OPENAI_VISION_MODEL if set, otherwise gpt-4.1-mini.

No data deletion:
- Adds activityReports under existing cg_app_v46 data model.
