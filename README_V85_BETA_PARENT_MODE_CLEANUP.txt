ChildGrowth AI V85 - Beta Parent Mode Clean-up

Based on V84.

Purpose:
- Make the homework report suitable for friendly parent beta testing.
- Hide internal QA/debug/version/model details by default.
- Keep admin diagnostics available with ?admin=1.

Key changes:
1. Parent mode:
   - Hides QA passed badges, model, route, timeout, quality score, Trial QA, technical evidence, Growth Memory engine cards and version notes.
   - Parent sees only useful report sections.

2. Admin mode:
   - Add ?admin=1 to URL to see QA panel, debug pills, Growth Memory tags, technical evidence and quality scores.

3. Strong / review conflict cleanup:
   - Normalises skill tags.
   - Removes duplicate skills from both strong and review unless real wrong/unclear evidence supports review.
   - Filters generic tags such as handwriting/photo unclear/careless/general.

4. Section heading leak cleanup:
   - Removes headings like "3. 需要覆核的位置" from bullet lists.
   - Cleans bullet text before rendering.

5. Better parent insight for past/present worksheets:
   - Detects instruction misunderstanding where the child changes verbs instead of writing "past" or "present".
   - Next step becomes concrete.

Kept:
- V84 wow summary and QA internally
- V83 backend reliability/retry
- V82 parent-facing layout
- V81 JSON/timeout handling
- V80 clean evidence
- Up to 6 photos

No data deletion.
