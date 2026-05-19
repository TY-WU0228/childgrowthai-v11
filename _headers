
exports.handler = async function(event) {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'OPENAI_API_KEY missing' }) };
    const body = JSON.parse(event.body || '{}');
    const activity = body.activity || 'Activity';
    const mode = body.mode || 'photo';
    const note = body.note || '';
    const images = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
    const child = body.child || {};
    const instruction = `You are Activity Progress AI for parents.
Child: ${child.name || 'child'}, year: ${child.year || ''}
Activity: ${activity}
Mode: ${mode}
Coach Voice Notes v50: The parent may have dictated the coach comment in Cantonese, English, Mandarin, or mixed language. Translate and explain it in parent-friendly Traditional Chinese. Analyse parent-uploaded photo / extracted video frames / voice-note text / coach comment.
Return ONLY valid JSON:
{"report":{"activity":"${activity}","summary":"","strengths":[],"watchPoints":[],"nextPractice":"","coachQuestion":"","confidence":"high | medium | low","safetyNote":"AI only provides parent-level observations and does not replace a qualified coach."}}
Important safety:
- Do NOT give professional diagnosis or precise technique grading.
- For swimming/tennis/soccer/dance/gymnastics, only give broad parent-friendly observations.
- For chess, prefer board/puzzle/coach comment over video.
- For piano, if image is a score, give practice plan; do not claim exact performance accuracy from score alone.
- If evidence is insufficient, say so clearly.
- Keep output Traditional Chinese / Cantonese parent-friendly.
- Always include one small next practice focus and one useful question to ask the coach/teacher.
- If the note contains English coach terminology, explain it simply in Chinese for an Asian parent who may not fully understand the English.`;
    const content = [{ type: 'input_text', text: instruction + '\n\nParent note / coach comment:\n' + note }];
    for (const img of images) if (img && /^data:image\//.test(img)) content.push({ type: 'input_image', image_url: img });
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini', input: [{ role: 'user', content }], temperature: 0.15, max_output_tokens: 900 })
    });
    const raw = await response.text();
    if (!response.ok) return { statusCode: response.status, body: JSON.stringify({ error: 'OpenAI request failed', detail: raw }) };
    const data = JSON.parse(raw);
    let out = data.output_text || '';
    if (!out && Array.isArray(data.output)) for (const item of data.output) for (const c of (item.content || [])) if (c.text) out += c.text;
    out = String(out || '').trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(JSON.parse(out)) };
  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message || String(err) }) };
  }
};
