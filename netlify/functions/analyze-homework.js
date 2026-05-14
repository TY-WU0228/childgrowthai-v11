exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return json(500, { error: 'OPENAI_API_KEY missing or not starting with sk-' });
    }

    const body = JSON.parse(event.body || '{}');
    const rawImages = Array.isArray(body.images) ? body.images.slice(0, 3) : [];
    const images = rawImages.map(cleanImageDataUrl).filter(Boolean);

    if (!images.length) {
      return json(400, { error: 'No valid image data received. Please try one clear JPG/PNG photo.' });
    }

    const prompt = buildPrompt(body);

    const responseModel = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
    const responsePayload = {
      model: responseModel,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          ...images.map(url => ({ type: 'input_image', image_url: url }))
        ]
      }],
      max_output_tokens: 1100
    };

    const first = await callOpenAI('https://api.openai.com/v1/responses', apiKey, responsePayload, 28000);
    if (first.ok) {
      const text = first.data.output_text || extractResponsesText(first.data) || 'No analysis returned.';
      return json(200, { analysis: text, model: responseModel, route: 'responses', imageCount: images.length });
    }

    const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini';
    const chatPayload = {
      model: fallbackModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...images.map(url => ({ type: 'image_url', image_url: { url } }))
        ]
      }],
      max_tokens: 1100,
      temperature: 0.2
    };

    const second = await callOpenAI('https://api.openai.com/v1/chat/completions', apiKey, chatPayload, 28000);
    if (second.ok) {
      const text = second.data.choices?.[0]?.message?.content || 'No analysis returned.';
      return json(200, { analysis: text, model: fallbackModel, route: 'chat-fallback', imageCount: images.length });
    }

    return json(second.status || first.status || 500, {
      error: friendlyError(second.data?.error?.message || first.data?.error?.message || 'OpenAI request failed'),
      firstError: first.data?.error?.message || '',
      fallbackError: second.data?.error?.message || ''
    });

  } catch (e) {
    return json(500, { error: friendlyError(e.message || String(e)) });
  }
};

function buildPrompt(body) {
  return `You are ChildGrowth AI, an education-focused assistant for parents.

Analyse the uploaded homework / worksheet image(s).

Child profile:
${JSON.stringify(body.child || {})}

Subject: ${body.subject || ''}
Completion status: ${body.status || ''}
Parent note: ${body.note || ''}

Instructions:
- Use Traditional Chinese.
- If the image is blurry, cropped, too small, or unreadable, say this clearly.
- Do not invent details you cannot see.
- Focus on useful parent insight: careless mistakes, concept gaps, reading comprehension, fatigue/confidence, and next action.
- Keep it practical and not too long.

Return exactly in this structure:

📌 1. 我睇到嘅內容 / OCR 重點
-

⚠️ 2. 可能錯題 / 需要留意位置
-

🧠 3. 錯因分類
- careless:
- concept gap:
- reading comprehension:
- fatigue / confidence:

💡 4. 對家長嘅重點 insight
-

✅ 5. 下次最少摩擦記錄建議
-`;
}

function cleanImageDataUrl(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/\s/g, '');
  const match = s.match(/^data:image\/(png|jpg|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if (match) {
    const ext = match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
    const b64 = match[2];
    if (b64.length < 100) return null;
    return `data:image/${ext};base64,${b64}`;
  }
  if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 100) return `data:image/jpeg;base64,${s}`;
  return null;
}

async function callOpenAI(url, apiKey, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, data };
  } catch (e) {
    return { ok: false, status: 500, data: { error: { message: e.name === 'AbortError' ? 'AI request timed out. Please try one clear photo first.' : e.message } } };
  } finally {
    clearTimeout(timer);
  }
}

function extractResponsesText(data) {
  try {
    const out = [];
    for (const item of data.output || []) {
      for (const c of item.content || []) if (c.text) out.push(c.text);
    }
    return out.join('\n').trim();
  } catch { return ''; }
}

function friendlyError(msg) {
  if (!msg) return 'Unknown AI error.';
  if (/credit|quota|billing|insufficient/i.test(msg)) return 'OpenAI credit / billing issue. Please check API credit balance.';
  if (/Incorrect API key|invalid api key|Unauthorized|401/i.test(msg)) return 'OpenAI API key invalid. Please create a fresh secret key and redeploy.';
  if (/pattern/i.test(msg)) return 'Image/API format issue. V11 tried both OpenAI routes; please use one clear JPG photo and redeploy once.';
  return msg;
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(obj) };
}
