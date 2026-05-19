
exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'OPENAI_API_KEY missing' }) };

    const body = JSON.parse(event.body || '{}');
    const text = body.text || '';
    const mode = body.mode || 'text';
    const image = body.image || '';
    const child = body.child || {};
    const today = new Date().toISOString().slice(0,10);

    const instruction = `
You are ChildGrowth AI Universal Capture router.
Current date: ${today}
Child: ${child.name || 'child'}, year: ${child.year || ''}

Classify the parent's capture into ONE route:
schoolNotice, teacherComment, activityProgress, homework, routine.

Return ONLY valid JSON:
{
  "result":{
    "route":"schoolNotice | teacherComment | activityProgress | homework | routine",
    "confidence":"high | medium | low",
    "title":"",
    "summary":"",
    "date":"YYYY-MM-DD or empty",
    "time":"",
    "activity":"Piano | Swimming | Tennis | Chess | Soccer | Art | Custom",
    "bringItems":[]
  }
}

Routing hints:
- Compass/school notices, bring items, payment, excursion, dress-up, deadline => schoolNotice.
- School teacher/classroom/reading/math behaviour comments => teacherComment.
- Coach/extracurricular/piano/swimming/tennis/chess/activity practice => activityProgress.
- Worksheet/homework/photo of school work => homework.
- Repeating lessons/classes/reminders with day/time => routine.
- If image only and unclear, route homework with low confidence unless it looks like notice.
- Keep Traditional Chinese/Cantonese parent-friendly title/summary.
Input mode: ${mode}
Text:
${text}
`;

    const content = [{ type: "input_text", text: instruction }];
    if (image && /^data:image\//.test(image)) content.push({ type: "input_image", image_url: image });

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini',
        input: [{ role: 'user', content }],
        temperature: 0.1,
        max_output_tokens: 700
      })
    });

    const raw = await response.text();
    if (!response.ok) return { statusCode: response.status, body: JSON.stringify({ error: 'OpenAI failed', detail: raw }) };

    const data = JSON.parse(raw);
    let out = data.output_text || '';
    if (!out && Array.isArray(data.output)) {
      for (const item of data.output) for (const c of (item.content || [])) if (c.text) out += c.text;
    }
    out = String(out || '').trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(JSON.parse(out)) };
  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};
