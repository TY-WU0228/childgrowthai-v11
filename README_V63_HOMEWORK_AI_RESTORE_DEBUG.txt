ChildGrowth AI V63 - Homework AI Restore + Debug

Based on V62.

Purpose:
- Restore the proven Homework AI behaviour while keeping multi-photo upload and homework history.
- The issue in V62 was not necessarily OPENAI_API_KEY. The frontend error message was too generic.

Fixes:
1. Homework frontend now sends all formats for compatibility:
   - images[]
   - image
   - imageDataList[]
   - note/text

2. analyze-homework.js now accepts:
   - body.images
   - body.imageDataList
   - body.image
   - body.homeworkImage

3. Model fallback is more robust:
   - OPENAI_MODEL if set
   - OPENAI_VISION_MODEL if set
   - gpt-4.1-mini
   - gpt-4o-mini
   - gpt-4.1

4. Error message now shows the real function/OpenAI error instead of only saying API key may be missing.

5. Homework records still save into homeworkReports.

No data deletion.
