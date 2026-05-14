ChildGrowth AI V25 - Auto Level Detection

Based on V24.

Main change:
- Parents no longer need to select many learning-level fields every upload.
- Set child current school year once in Profile / 我的.
- Homework upload now shows a simple auto-detect card.
- AI will try to read worksheet title/header from image:
  Year 3, Year 4, Grade 5, Extension, Challenge, QS, Competition, etc.
- If image does not clearly show year/level, AI must say it is not sure instead of guessing.
- Advanced manual input is optional and hidden by default.

Testing:
1. Go to Profile / 我的 and set current year = Year 2.
2. Upload a worksheet that shows Year 3/Year 4/Extension in the image.
3. Press Real AI Vision Preview.
4. Check output includes:
   - 圖片上是否見到 worksheet 年級 / 程度
   - 以小朋友目前年級來看
   - 以呢份 worksheet 程度來看
