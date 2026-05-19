ChildGrowth AI V81 - Homework AI JSON + Timeout Fix

Based on V80.

Problem fixed:
- User saw "Function did not return JSON".
- This usually means Netlify returned an HTML timeout/error page before the function could return JSON.
- Common causes: too many large base64 images, long AI request, or serverless timeout.

V81 fixes:
1. Frontend chunking:
   - More than 2 homework images are analyzed in batches of 2.
   - This still supports up to 6 photos, but avoids one huge request.

2. Stronger image compression:
   - Default compression reduced to 1200px / 0.66 quality.
   - Adaptive extra compression if each image is too large.

3. Backend timeout protection:
   - OpenAI calls abort earlier and return a JSON timeout error before Netlify returns HTML.
   - Default model changed to gpt-4.1-mini for speed unless OPENAI_MODEL overrides it.
   - Max output reduced to 1800 tokens.

4. Payload guard:
   - If images are still too large, backend returns JSON 413 with a clear message.

5. Better frontend error message:
   - If non-JSON still happens, it shows HTTP status and a cleaned raw snippet.

Kept:
- V80 Clean Evidence + Reading Intelligence
- V79 Homework Engine v2
- V78 quick capture fix
- Up to 6 photos
- V72 Calendar Prep Event
- Official slogan
