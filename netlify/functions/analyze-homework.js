exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return json(500, { error: 'OPENAI_API_KEY missing or invalid' });
    }

    const body = JSON.parse(event.body || '{}');
    const images = collectImages(body).slice(0, 3);

    if (!images.length) {
      return json(400, { error: '未收到有效圖片。請先用一張清晰 JPG/PNG 功課相測試。' });
    }

    const prompt = buildHKParentTonePrompt(body);

    const model = process.env.OPENAI_MODEL || 'gpt-4.1';
    const payload = {
      model,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          ...images.map(url => ({ type: 'input_image', image_url: url }))
        ]
      }],
      max_output_tokens: 2200
    };

    const first = await callOpenAI('https://api.openai.com/v1/responses', apiKey, payload, 35000);
    if (first.ok) {
      const text = first.data.output_text || extractResponsesText(first.data) || '未能生成分析。';
      const analysis = cleanParentText(text);
      return json(200, { analysis, report: buildStructuredHomeworkReport(analysis), model, route: 'responses', imageCount: images.length });
    }

    // Fallback route
    const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4.1-mini';
    const chatPayload = {
      model: fallbackModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...images.map(url => ({ type: 'image_url', image_url: { url } }))
        ]
      }],
      max_tokens: 2200,
      temperature: 0.15
    };

    const second = await callOpenAI('https://api.openai.com/v1/chat/completions', apiKey, chatPayload, 35000);
    if (second.ok) {
      const text = second.data.choices?.[0]?.message?.content || '未能生成分析。';
      const analysis = cleanParentText(text);
      return json(200, { analysis, report: buildStructuredHomeworkReport(analysis), model: fallbackModel, route: 'chat-fallback', imageCount: images.length });
    }

    return json(second.status || first.status || 500, {
      error: friendlyError(second.data?.error?.message || first.data?.error?.message || second.error || first.error || 'OpenAI request failed'),
      debug: {responses:first.data?.error || first.error || null, chat:second.data?.error || second.error || null}
    });
  } catch (e) {
    return json(500, { error: friendlyError(e.message || String(e)) });
  }
};


function collectImages(body) {
  const raw = [];
  if (Array.isArray(body.images)) raw.push(...body.images);
  if (Array.isArray(body.imageDataList)) raw.push(...body.imageDataList);
  if (body.image) raw.push(body.image);
  if (body.homeworkImage) raw.push(body.homeworkImage);

  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const cleaned = cleanImageDataUrl(item);
    if (!cleaned) continue;
    const key = cleaned.length + ':' + cleaned.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

function buildHKParentTonePrompt(body) {
  const child = body.child || {};
  const context = body.learningContext || {};
  return `你是 ChildGrowth AI 的「香港小學補習老師 + 家長學習顧問」。

請分析上傳的功課 / worksheet 圖片，用香港家長容易明白的自然中文回覆。
語氣：清楚、溫和、實用、可信。不要像機械翻譯。

小朋友資料：
${JSON.stringify(child)}

家長備註：
${body.note || body.text || ''}

Learning context：
${JSON.stringify(context, null, 2)}

最高優先規則：
1. 先看圖片上是否有 Year / Level / Grade / Term / worksheet 標題。看不到就講「相片上未見明確年級」。
2. 比較 worksheet level 和小朋友目前年級，但不要講「資優 / 智力高 / 智力低」。
3. 你不是正式批改老師；鉛筆字、陰影、角度可能令你誤讀。看不清就寫【需家長確認】。
4. 「已做得好的地方」只放正確 / 做得好 / 成功推算 / 暫未見錯誤。不要把任何錯題放入這裡。
5. 「需要覆核的位置」只放【明確錯】、【需家長確認】、未完成 / 漏做。正確題、暫無錯、答案正確不可放入這裡。
6. 如果你在任何段落提到「18+13寫咗21」或「正確應該係31」，一定要在需要覆核列出【明確錯】18+13=21，正確應為31。
7. 如果一句有「寫得正確 / 答對 / 成功推算 / 暫未見錯誤」，不可放入需要覆核。
8. 每個判斷要有證據：我見到咩，所以推論咩。
9. 不作醫療、心理、讀寫障礙、ADHD 或資優診斷。
10. 最後一定要有「今晚只做一件事」，要非常具體。

請按以下格式完整輸出，不要漏章節：

🌟 0. Learning level awareness
- 圖片上是否見到 worksheet 年級 / 程度：
- 以小朋友目前年級來看：
- 以呢份 worksheet 程度來看：
- 今次值得肯定的位置：
- 需要避免過度解讀的位置：

📌 1. 我大約睇到嘅功課內容
- 請列出具體題型，例如 addition / multiplication / number patterns / reading comprehension / spelling 等。

✅ 2. 已做得好的地方
- 只列真正做對、掌握到、值得肯定的位置。

⚠️ 3. 需要覆核的位置
- 【明確錯】清楚錯題，寫出正確答案和可能原因。
- 【需家長確認】看不清、手寫有陰影、未能肯定。
- 【未完成】漏做 / 空白。
- 如果沒有明確錯，請寫「暫未見明確錯題」。

🧠 4. 可能出錯原因
- 粗心 / 心急：
- 理解位：
- 閱讀題目：
- 做題狀態：

💬 5. 給家長的簡短解讀
- 2-4 句，像補習老師 WhatsApp feedback。

✅ 6. 今晚只做一件事
- 只列一個今晚可以做到的小步驟。

🏷️ 7. Growth Memory Tags
- subject:
- worksheetLevel:
- skillsStrong:
- skillsToReview:
- errorTypes:
- confidence: High / Medium / Low`;
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
    return { ok: false, status: 500, data: { error: { message: e.name === 'AbortError' ? 'AI 分析逾時，請先用一張清晰相片再試。' : e.message } } };
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

function cleanParentText(text) {
  return String(text || '')
    .replace(/confidence_signal/gi, '答題狀態')
    .replace(/fatigue_signal/gi, '精神狀態')
    .replace(/concept gap/gi, '理解位')
    .replace(/friction|摩擦/gi, '操作阻力')
    .replace(/pattern inconsistency/gi, '規律掌握不穩')
    .trim();
}


function sectionBetween(raw, startMarkers, endMarkers) {
  const text = String(raw || '');
  let start = -1;
  let marker = '';
  for (const m of startMarkers) {
    const i = text.indexOf(m);
    if (i >= 0 && (start < 0 || i < start)) { start = i; marker = m; }
  }
  if (start < 0) return '';
  const from = start + marker.length;
  let end = text.length;
  for (const m of endMarkers) {
    const i = text.indexOf(m, from);
    if (i >= 0 && i < end) end = i;
  }
  return text.slice(from, end).replace(/^[:：\s-]+/, '').trim();
}
function bulletsFrom(section, max = 5) {
  return String(section || '')
    .split(/\n+/)
    .map(x => x.replace(/^[\s\-•*]+/, '').trim())
    .filter(Boolean)
    .slice(0, max);
}
function firstUsefulLine(section) {
  return String(section || '')
    .split(/\n+/)
    .map(x => x.replace(/^[\s\-•*]+/, '').trim())
    .find(Boolean) || '';
}

function isPositiveReviewLine(line) {
  const s = String(line || '');
  if (/明確錯|需家長確認|需要覆核|應該係|應為|應是|正確應該|Janice 寫\s*\d+|AI 疑似讀到|疑似錯|計錯|錯誤/.test(s)) return false;
  return /答對|答啱|正確|寫得正確|答案正確|已做對|全部正確|成功推算|順利找到|未見錯誤|暫時未見到錯誤|未見到錯誤|值得肯定|做得好|right|correct/i.test(s);
}
function isClearErrorLine(line) {
  const s = String(line || '');
  return /正確應該係|應該係|應為|應是|Janice\s*寫|寫\s*\d+|明確錯/.test(s) && /[0-9]/.test(s);
}
function softenReviewLine(line) {
  let s = String(line || '').trim();
  if (!s) return '';
  if (isClearErrorLine(s)) {
    return s.replace(/請家長確認：/g, '').replace(/【需家長確認】/g, '【明確錯】');
  }
  s = s.replace(/明顯計錯/g, 'AI 視覺疑似需要家長確認');
  s = s.replace(/明確計錯/g, 'AI 視覺疑似需要家長確認');
  s = s.replace(/計錯/g, '疑似需覆核');
  s = s.replace(/Janice 寫/g, 'AI 疑似讀到 Janice 寫');
  if (!/(家長|覆核|確認|看不清|不清|疑似)/.test(s)) {
    s = '請家長確認：' + s;
  }
  return s;
}
function classifyReviewLineV69(line) {
  const s = String(line || '').trim();
  if (!s) return 'empty';
  if (isPositiveReviewLine(s)) return 'positive';
  if (/未見錯誤|暫時未見到錯誤|其餘答案|都能清楚看到|大部分.*正確/.test(s)) return 'positive';
  if (/明確錯|正確應該係|應該係|應為|應是|Janice\s*寫|寫\s*\d+/.test(s) && /[0-9]/.test(s)) return 'review';
  if (/需家長確認|看不清|不清楚|未完成|漏|空白/.test(s)) return 'review';
  return 'review';
}
function cleanReviewPoints(points) {
  const movedToGood = [];
  const review = [];
  (Array.isArray(points) ? points : []).forEach(p => {
    const s = String(p || '').trim();
    if (!s) return;
    const cls = classifyReviewLineV69(s);
    if (cls === 'positive') movedToGood.push(s.replace(/^[-•\s]+/, ''));
    else if (cls === 'review') review.push(softenReviewLine(s));
  });
  return { review, movedToGood };
}


function normalizeReportLine(line) {
  return String(line || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}
function classifyReportLineV70(line, source = '') {
  const s = normalizeReportLine(line);
  if (!s) return 'empty';
  if (/明確錯|正確應該係|正確應是|正確是|應該係|應為|應是|答案應該|答案應為/.test(s) && /[0-9]/.test(s)) return 'review';
  if (/Janice\s*(寫|答).{0,12}\d+/.test(s) && /(正確應該|應該係|應為|應是|明確錯)/.test(s)) return 'review';
  if (/需家長確認|需要家長確認|看不清|睇唔清|不清楚|未完成|漏做|空白|未填|漏填/.test(s)) return 'review';
  if (/答對|答啱|寫得正確|答案正確|正確完成|已做對|全部正確|成功推算|順利找到|未見錯誤|暫未見錯誤|暫時未見到錯誤|未見到錯誤|都正確|做得好|值得肯定|right|correct/i.test(s)) return 'good';
  if (/其餘答案|其他答案|大部分答案/.test(s) && /正確|未見錯|清楚/.test(s)) return 'good';
  return source === 'review' ? 'review' : 'good';
}
function reviewLineV70(line) {
  const s = normalizeReportLine(line);
  if (!s) return '';
  if (/明確錯|需家長確認/.test(s)) return s;
  if (/正確應該係|正確應是|正確是|應該係|應為|應是|答案應該|答案應為/.test(s) && /[0-9]/.test(s)) return '【明確錯】 ' + s;
  if (/看不清|睇唔清|不清楚|未完成|漏做|空白|未填|漏填/.test(s)) return '【需家長確認】 ' + s;
  return '【需家長確認】 ' + s;
}
function uniqueLinesV70(arr) {
  const seen = new Set();
  return (arr || []).map(normalizeReportLine).filter(Boolean).filter(x => {
    const key = x.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function sanitizeStructuredReportV70(report) {
  const goods = [];
  const reviews = [];
  const sourceGood = Array.isArray(report.strengths) ? report.strengths : bulletsFrom(report.strengths || '', 4);
  const sourceReview = Array.isArray(report.checkPoints) ? report.checkPoints : bulletsFrom(report.checkPoints || '', 6);
  sourceGood.forEach(line => {
    const cls = classifyReportLineV70(line, 'good');
    if (cls === 'review') reviews.push(reviewLineV70(line));
    else if (cls === 'good') goods.push(normalizeReportLine(line));
  });
  sourceReview.forEach(line => {
    const cls = classifyReportLineV70(line, 'review');
    if (cls === 'good') goods.push(normalizeReportLine(line));
    else if (cls === 'review') reviews.push(reviewLineV70(line));
  });
  report.strengths = uniqueLinesV70(goods).slice(0, 6);
  report.checkPoints = uniqueLinesV70(reviews).slice(0, 6);
  return report;
}


function calcExpressionV76(expr) {
  try {
    const cleaned = String(expr || '').replace(/×/g, '*').replace(/x/gi, '*').replace(/÷/g, '/').replace(/[^0-9+\-*/(). ]/g, '');
    if (!cleaned || !/[+\-*/]/.test(cleaned)) return null;
    if (!/^[0-9+\-*/().\s]+$/.test(cleaned)) return null;
    const val = Function('"use strict";return (' + cleaned + ')')();
    if (Number.isFinite(val) && Math.abs(val - Math.round(val)) < 1e-9) return Math.round(val);
    return null;
  } catch (e) {
    return null;
  }
}
function extractArithmeticErrorsV76(text) {
  const s = String(text || '').replace(/×/g, 'x').replace(/\s+/g, ' ');
  const out = [];
  const patterns = [
    /((?:\d+\s*[+xX*]\s*)+\d+)\s*(?:=|＝)?\s*(?:寫咗|寫了|寫|答咗|答了|答|Janice\s*(?:寫|答))\s*(\d+)/g,
    /((?:\d+\s*[+xX*]\s*)+\d+)\s*(?:=|＝)\s*(\d+)/g
  ];
  patterns.forEach(rx => {
    let m;
    while ((m = rx.exec(s)) !== null) {
      const expr = m[1];
      const childAns = parseInt(m[2], 10);
      const correct = calcExpressionV76(expr);
      if (correct === null) continue;
      if (childAns !== correct) {
        out.push(`【明確錯】${expr.replace(/\s+/g, '')} = ${childAns}，正確應為 ${correct}`);
      }
    }
  });
  return out;
}
function isPositiveOnlyLineV76(line) {
  const s = String(line || '');
  const hasPositive = /正確|暫無錯|暫未見錯|暫時未見錯|暫時未見到錯|未見錯誤|答案正確|寫得正確|暫無錯誤|暫未見明確錯|答對|答啱|成功推算|掌握|順利/i.test(s);
  const hasError = /明確錯|正確應該|正確應為|應該係|應為|應是|錯誤|計錯|寫咗\s*\d+|寫了\s*\d+|寫\s*\d+.*正確應/i.test(s);
  return hasPositive && !hasError;
}
function hardGuardReportV76(report) {
  report = report || {};
  const good = [];
  const review = [];
  (Array.isArray(report.strengths) ? report.strengths : []).forEach(x => {
    const s = normalizeReportLine ? normalizeReportLine(x) : String(x || '').trim();
    if (!s) return;
    const errs = extractArithmeticErrorsV76(s);
    if (errs.length) review.push(...errs);
    else good.push(s);
  });
  (Array.isArray(report.checkPoints) ? report.checkPoints : []).forEach(x => {
    const s = normalizeReportLine ? normalizeReportLine(x) : String(x || '').trim();
    if (!s) return;
    const errs = extractArithmeticErrorsV76(s);
    if (errs.length) { review.push(...errs); return; }
    if (isPositiveOnlyLineV76(s)) {
      good.push(s.replace(/^\s*請家長確認[:：]?\s*/, '').replace(/^\s*【明確錯】\s*/, '').replace(/^\s*【需家長確認】\s*/, ''));
      return;
    }
    review.push(s);
  });
  const scanText = [
    ...(Array.isArray(report.reasons) ? report.reasons : []),
    report.parentInterpretation,
    report.rawAnalysis
  ].filter(Boolean).join(' ');
  review.push(...extractArithmeticErrorsV76(scanText));
  report.strengths = uniqueLinesV70 ? uniqueLinesV70(good).slice(0, 6) : [...new Set(good)].slice(0, 6);
  report.checkPoints = uniqueLinesV70 ? uniqueLinesV70(review).slice(0, 6) : [...new Set(review)].slice(0, 6);
  return report;
}

function buildStructuredHomeworkReport(raw) {
  const text = cleanParentText(raw || '');
  const level = sectionBetween(text, ['🌟 0. Learning level awareness', '0. Learning level awareness', 'Learning level awareness'], ['📌 1.', '1. 我大約', '⚠️ 2.']);
  const content = sectionBetween(text, ['📌 1. 我大約睇到嘅功課內容', '1. 我大約睇到嘅功課內容', '我大約睇到嘅功課內容'], ['⚠️ 2.', '✅ 2b.', '🧠 3.']);
  const check = sectionBetween(text, ['⚠️ 2. 需要覆核的位置', '2. 需要覆核的位置', '需要覆核的位置'], ['✅ 2b.', '🧠 3.', '💬 4.']);
  const good = sectionBetween(text, ['✅ 2b. 已做得好的地方', '2b. 已做得好的地方', '已做得好的地方'], ['🧠 3.', '💬 4.', '📈 5.']);
  const reason = sectionBetween(text, ['🧠 3. 可能出錯原因', '3. 可能出錯原因', '可能出錯原因'], ['💬 4.', '📈 5.', '✅ 6.']);
  const parent = sectionBetween(text, ['💬 4. 給家長的簡短解讀', '4. 給家長的簡短解讀', '給家長的簡短解讀'], ['📈 5.', '✅ 6.']);
  const longTerm = sectionBetween(text, ['📈 5. 長期觀察重點', '5. 長期觀察重點', '長期觀察重點'], ['✅ 6.']);
  const tips = sectionBetween(text, ['✅ 6. 下次做題小貼士', '6. 下次做題小貼士', '下次做題小貼士'], []);
  const rawStrengths = bulletsFrom(good, 4);
  const cleanedReview = cleanReviewPoints(bulletsFrom(check, 6));
  const report = {
    title: 'AI 功課分析',
    shortSummary: firstUsefulLine(parent) || firstUsefulLine(level) || text.slice(0, 180),
    summary: content || text.slice(0, 420),
    levelAwareness: level || '已按圖片內容和目前年級作初步觀察；如圖片清楚顯示 Year 3 / extension，應肯定孩子正在挑戰較高水平。',
    strengths: [...rawStrengths, ...cleanedReview.movedToGood].slice(0, 6),
    checkPoints: cleanedReview.review,
    reasons: bulletsFrom(reason, 5),
    parentInterpretation: parent,
    longTermFocus: bulletsFrom(longTerm, 4),
    nextStep: firstUsefulLine(tips) || '今晚只揀一題最有代表性的題目慢慢講解。',
    confidence: 'medium',
    rawAnalysis: text
  };
  return hardGuardReportV76(sanitizeStructuredReportV70(report));
}

function friendlyError(msg) {
  if (!msg) return '未知 AI 錯誤。';
  if (/credit|quota|billing|insufficient/i.test(msg)) return 'OpenAI credit / billing 可能不足，請檢查 API credit。';
  if (/Incorrect API key|invalid api key|Unauthorized|401/i.test(msg)) return 'OpenAI API key 無效，請重新建立 secret key 後 redeploy。';
  if (/pattern/i.test(msg)) return '圖片格式或 API 格式問題。請先用一張清晰 JPG 相片測試。';
  return msg;
}

function json(statusCode, obj) {
  return { statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(obj) };
}
