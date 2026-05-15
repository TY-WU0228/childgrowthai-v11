ChildGrowth AI V54 - Activity Input Cleanup

Based on V53.

Main fix:
- Activity Progress AI no longer shows duplicated Coach Voice Note + Parent/Coach Comment Voice boxes.
- Keeps the 4 mode buttons:
  Photo / Short video / Voice note / Coach comment.
- Below the mode buttons, only ONE unified input area is shown.

How mode works:
1. Photo
   - Shows file upload for photo.
   - Hides voice controls.
   - Textarea asks for optional parent observation.

2. Short video
   - Shows video upload.
   - Extracts frames for beta visual analysis.
   - Hides voice controls.
   - Textarea asks for optional explanation.

3. Voice note
   - Hides file upload.
   - Shows voice controls.
   - Textarea is parent observation.

4. Coach comment
   - Shows optional coach note photo upload.
   - Shows voice controls.
   - Textarea is coach comment / parent retelling.
   - Includes small safety note, not a large duplicate warning box.

Also:
- Old duplicate Activity voice boxes are hidden.
- Teacher Comment Voice remains visible and separate.
- Analyze Activity uses the unified input.
- Existing data is not deleted.

No data deletion.
