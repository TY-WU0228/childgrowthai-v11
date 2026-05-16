ChildGrowth AI V55 - Activity Clean DOM

Based on V54.

Fix:
- Removed the old Activity Progress DOM instead of only hiding it.
- The duplicate old block caused:
  - Upload photo / short video / audio showing twice.
  - Analyze Activity button showing twice.
  - old activityNote textarea and old voice boxes still appearing.
- V55 replaces activityProgressCardHTML with a clean single-input-card version.

Activity Progress now has:
- 4 mode buttons:
  Photo / Short video / Voice note / Coach comment
- Only one input area below the mode buttons.
- Only one Analyze Activity button.
- Only one Clear button.
- Status/result area below the unified input card.

Teacher Comment vs Activity Comment:
- Teacher Comment = school teacher / classroom observation.
- Activity Progress = extracurricular activity progress, parent observation or coach feedback.
- They are intentionally separated and not duplicate.

No data deletion.
