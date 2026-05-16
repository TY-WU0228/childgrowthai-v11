exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey || !apiKey.startsWith('sk-')) return json(500, { error: 'OPENAI_API_KEY missing or invalid' });

    const body = JSON.parse(event.body || '{}');
    const rawImages = collectImages(body).slice(0, 4);
    const images = rawImages.map(cleanImageDataUrl).filter(Boolean);
    if (!images.length) return json(400, { error: '未收到有效圖片。請重新選擇一張清晰 JPG/PNG 功課相。' });

    const prompt = buildHKParentTonePrompt(body);

    // Use a stable default that worked in earlier beta builds, while still respecting OPENAI_MODEL if set.
    const modelCandidates = unique([
      process.env.OPENAI_MODEL,
      process.env.OPENAI_VISION_MODEL,
      'gpt-4.1-mini',
      'gpt-4o-mini',
      'gpt-4.1'
    ].filter(Boolean));

    const errors = [];
    for (const model of modelCandidates) {
      const payload = {
        model,
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            ...images.map(url => ({ type: 'input_image', image_url: url }))
          ]
        }],
        max_output_tokens: 1600
      };
      const first = await callOpenAI('https://api.openai.com/v1/responses', apiKey, payload, 45000);
      if (first.ok) {
        const text = first.data.output_text || extractResponsesText(first.data) || '未能生成分析。';
        return json(200, { analysis: cleanParentText(text), model, route: 'responses', imageCount: images.length });
      }
      const msg = first.data?.error?.message || first.error || `HTTP ${first.status}`;
      errors.push(`responses/${model}: ${msg}`);

      // Chat fallback for models that support image_url.
      const chatPayload = {
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...images.map(url => ({ type: 'image_url', image_url: { url } }))
          ]
        }],
        max_tokens: 1600,
        temperature: 0.15
      };
      const second = await callOpenAI('https://api.openai.com/v1/chat/completions', apiKey, chatPayload, 45000);
      if (second.ok) {
        const text = second.data.choices?.[0]?.message?.content || '未能生成分析。';
        return json(200, { analysis: cleanParentText(text), model, route: 'chat-fallback', imageCount: images.length });
      }
      const msg2 = second.data?.error?.message || second.error || `HTTP ${second.status}`;
      errors.push(`chat/${model}: ${msg2}`);
    }

    return json(500, { error: friendlyError(errors.slice(-3).join(' | ')), debug: errors.slice(-6) });
  } catch (e) {
    return json(500, { error: friendlyError(e.message || String(e)) });
  }
};

function collectImages(body) {
  const out = [];
  if (Array.isArray(body.images)) out.push(...body.images);
  if (Array.isArray(body.imageDataList)) out.push(...body.imageDataList);
  if (body.image) out.push(body.image);
  if (body.homeworkImage) out.push(body.homeworkImage);
  return out.filter(Boolean);
}
function unique(arr){ return [...new Set(arr)]; }

function buildHKParentTonePrompt(body) {
  return `你是 ChildGrowth AI 的「香港小學補習老師 + 家長學習顧問」。

請分析上傳的功課 / worksheet 圖片，然後用香港家長容易明白的自然中文回覆。

小朋友資料：
${JSON.stringify(body.child || {})}

科目：${body.subject || ''}
完成狀態：${body.status || ''}
家長備註：${body.note || body.text || ''}

Learning Level Awareness（學習水平資料）：
${JSON.stringify(body.learningContext || {}, null, 2)}

非常重要：
- 家長不需要每次手動填 worksheet level。請優先從圖片上的標題、頁眉、頁腳、logo、書名、題目說明讀取年級或程度，例如 Year 3、Year 4、Grade 5、Extension、Challenge、QS、NAPLAN、Olympiad、Competition。
- 如果圖片上清楚見到 worksheet 年級，請直接使用你讀到的年級，並同 childCurrentYear 比較。
- 如果圖片上看不到年級，請寫「相片上未見到明確年級，因此只能按題目難度作初步估計」，不要亂估。
- 如果小朋友目前是 Year 2，但正在做 Year 3 / Year 4 / extension 題目，請清楚指出：這是高於目前年級常規要求的練習。
- 不要輕易用「天才」、「資優」、「智商很高」等標籤；只可寫「有延伸學習潛力」、「表現高於目前年級要求」、「值得同老師討論是否適合 extension」。
- 不要扮 OCR 100% 準。如果圖片模糊、角度歪、字太細，請講「我未必睇得清楚」。
- 看不到的內容不要當成事實。
- 如果答案可能不清楚，請用「似乎」、「有機會」、「建議再對一對原題」。
- 中文要自然，像補習老師 WhatsApp feedback。
- 在「需要覆核嘅位置」只列：明確計錯 / 未完成 / 圖片看不清。正確算式不要放入可能錯例子。

輸出格式：

🌟 0. Learning level awareness
- 圖片上是否見到 worksheet 年級 / 程度：
- 以小朋友目前年級來看：
- 以呢份 worksheet 程度來看：
- 今次值得肯定的位置：
- 需要避免過度解讀的位置：

📌 1. 我大約睇到嘅功課內容
-

⚠️ 2. 需要覆核的位置
- 只列：明確計錯 / 未完成 / 圖片看不清。

✅ 2b. 已做得好的地方
-

🧠 3. 可能出錯原因
- 粗心：
- 理解位：
- 閱讀題目：
- 做題狀態：

💬 4. 給家長的簡短解讀
-

📈 5. 長期觀察重點
- 科目 / 題型：
- 今次主要小心位：
- 下次可留意：

✅ 6. 下次做題小貼士
- 只列 2-3 個最實用做法。`;
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
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, data };
  } catch (e) {
    return { ok: false, status: 500, error: e.name === 'AbortError' ? 'AI 分析逾時，請先用一張清晰相片再試。' : e.message, data: {} };
  } finally { clearTimeout(timer); }
}

function extractResponsesText(data) {
  try {
    const out = [];
    for (const item of data.output || []) for (const c of item.content || []) if (c.text) out.push(c.text);
    return out.join('\n').trim();
  } catch { return ''; }
}
function cleanParentText(text) {
  return String(text || '')
    .replace(/confidence_signal/gi, '答題狀態')
    .replace(/fatigue_signal/gi, '精神狀態')
    .replace(/concept gap/gi, '理解位')
    .replace(/friction|摩擦/gi, '操作阻力')
    .replace(/pattern inconsistency/gi, '規律掌握不穩')
    .trim();
}
function friendlyError(msg) {
  if (!msg) return '未知 AI 錯誤。';
  if (/credit|quota|billing|insufficient/i.test(msg)) return 'OpenAI credit / billing 可能不足，請檢查 API credit。原始錯誤：' + msg;
  if (/Incorrect API key|invalid api key|Unauthorized|401/i.test(msg)) return 'OpenAI API key 無效，請重新建立 secret key 後 redeploy。原始錯誤：' + msg;
  if (/model.*not.*found|does not exist|access/i.test(msg)) return 'OpenAI model 權限或 model 名稱問題。V63 會嘗試多個模型，但請檢查 OPENAI_MODEL 是否設了不可用 model。原始錯誤：' + msg;
  if (/pattern|image/i.test(msg)) return '圖片格式或 API 格式問題。請先用一張清晰 JPG 相片測試。原始錯誤：' + msg;
  return msg;
}
function json(statusCode, obj) { return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(obj) }; }
