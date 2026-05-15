ChildGrowth AI V44 - School Notice AI

Based on V43.

New feature:
- Adds School Notice AI.
- Parents can upload a Compass / school notice screenshot or paste notice text.
- AI extracts:
  title, date, time, category, bring items, payment, deadline, reminders, parent action.
- Parent must Confirm Add before anything is saved.
- Confirmed notices appear on Home as School Notice reminders.
- Confirmed notices are also added as one-off school notice routine events using the same routine storage.

Where:
- School Notice AI card is added to Record / Timeline if available, otherwise Home.
- Home shows upcoming school notice reminders.

Backend:
- Adds Netlify function:
  netlify/functions/analyze-school-notice.js
- Requires OPENAI_API_KEY already set in Netlify.
- Uses OPENAI_VISION_MODEL if set, otherwise gpt-4.1-mini.

Fallback:
- If AI call fails and pasted text exists, local parser tries to extract basic event/payment/date info.
- If image OCR fails, parent can paste text.

Important:
- This does NOT connect directly to Compass API.
- It does NOT ask for Compass username/password.
- This is safer for beta: screenshot/text -> AI extract -> parent confirmation.

No data deletion:
- Existing routines and records are preserved.
