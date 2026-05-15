ChildGrowth AI V53 - Voice + Activity Mode Fix

Based on V52.

Fixes requested:
1. Teacher Comment voice input restored.
   - Teacher Comment card now has voice input.
   - Supports Cantonese / English mix, English, Mandarin.
   - Voice text goes into teacherText textarea before Save Comment.

2. Activity mode buttons fixed.
   - Photo / Short video / Voice note / Coach comment buttons now have robust click handlers.
   - The selected mode becomes visually active.
   - File input changes based on selected mode:
     Photo = image
     Short video = video
     Voice note = audio
     Coach comment = text only

3. Activity parent/coach comment voice input added.
   - The parent observation / coach comment textarea now also has voice input.
   - This is separate from Teacher Comment:
     Teacher Comment = school/classroom general comments.
     Activity Comment = extracurricular parent/coach observation.

4. Coach Voice Note old buttons mapped to the new generic voice system.
   - Uses Web Speech API where supported.
   - If speech is not supported, text input fallback remains.

Kept:
- V52 splash timeout + purple cover.
- V51 Home repair.
- V49 Activity Progress AI.
- V48 report polish.
- V47 time picker.
- V46 clean data model.

No data deletion.
