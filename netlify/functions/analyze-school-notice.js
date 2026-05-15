
exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'OPENAI_API_KEY missing' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const text = body.text || '';
    const image = body.image || '';

    const schemaInstruction = `
You are School Notice AI for parents.
Read Compass / school notices from text or screenshot.
Extract ONE actionable reminder for a parent.
Return ONLY valid JSON with this shape:
{
  "notice": {
    "title": "short event title",
    "date": "YYYY-MM-DD or empty if unknown",
    "time": "short time or empty",
    "location": "location or empty",
    "category": "school event | payment | permission | excursion | dress-up | sports | photo day | homework | other",
    "bringItems": ["items parent/child must bring or prepare"],
    "payment": "amount or empty",
    "deadline": "YYYY-MM-DD or empty",
    "reminders": ["前一晚 8:00 PM", "當日早上 7:30 AM"],
    "confidence": "high | medium | low",
    "summary": "brief parent friendly summary in Traditional Chinese/Cantonese style",
    "parentAction": "one clear next action for parent"
  }
}

Rules:
- Do not invent dates. If date is not visible, date should be empty and confidence low.
- If notice says next Monday, calculate relative to current date ${new Date().toISOString().slice(0,10)}.
- If money is required, include it in bringItems and payment.
- If clothing/dress-up is required, include it in bringItems.
- Keep wording practical for a busy parent.
`;

    const content = [
      { type: "input_text", text: schemaInstruction + "\n\nNotice text pasted by parent:\n" + text }
    ];

    if (image && /^data:image\//.test(image)) {
      content.push({ type: "input_image", image_url: image });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini',
        input: [{ role: 'user', content }],
        temperature: 0.1,
        max_output_tokens: 900
      })
    });

    const raw = await response.text();
    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: 'OpenAI request failed', detail: raw }) };
    }

    const data = JSON.parse(raw);
    let out = '';
    if (data.output_text) out = data.output_text;
    else if (Array.isArray(data.output)) {
      for (const item of data.output) {
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (c.text) out += c.text;
          }
        }
      }
    }

    out = String(out || '').trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
    const parsed = JSON.parse(out);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || String(err) })
    };
  }
};
