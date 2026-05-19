ChildGrowth AI V84 - Trial-ready QA + Report Wow Layer

Based on V83.

Purpose:
- Move from prototype debugging to friendly-parent trial readiness.
- Make the first screen of every homework report feel useful and parent-facing.
- Add internal QA so Irene can decide if a report is good enough before showing testers.

Key changes:
1. Parent Wow Summary:
   - New top section: "今日最值得留意".
   - Gives one clear sentence about the child's strongest evidence or the main review point.
   - If AI did not complete analysis, it clearly says upload saved / AI incomplete instead of pretending.

2. Trial QA Check:
   - Collapsed internal QA panel in every homework report.
   - Scores trial quality with reasons:
     AI completion, clean evidence, contradictions, strong skills, review rules, parent interpretation, next step, technical noise.

3. Fail-safe report:
   - If AI times out or fails, the report is marked as incomplete and not scored as complete.

4. Report Quality Framework v2:
   - Confidence Low and incomplete reports are capped.
   - Goal is honest readiness for small parent trials, not 100/100.

5. Trial checklist:
   - Homework page includes smoke-test scenarios for clear maths, wrong maths, English reading, multi-page homework, and unclear photo.

Kept:
- V83 backend reliability / retry
- V82 parent-facing layout
- V81 JSON / timeout handling
- V80 clean evidence
- Up to 6 photos
- Calendar and official slogan

No data deletion.
