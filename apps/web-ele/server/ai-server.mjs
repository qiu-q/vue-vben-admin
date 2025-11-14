import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// Lightweight .env loader (no external deps)
function loadDotenv(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      if (!line || /^\s*#/.test(line)) continue;
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let [, key, val] = m;
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {}
}

// Load env from local files (prefer .env.local)
const envFiles = [
  '.env.local',
  '.env.development.local',
  '.env.development',
  '.env',
];
for (const f of envFiles) {
  const p = path.resolve(process.cwd(), f);
  if (fs.existsSync(p)) {
    loadDotenv(p);
    break;
  }
}

const PORT = process.env.AI_SERVER_PORT ? Number(process.env.AI_SERVER_PORT) : 8787;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_TOKEN || '';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEBUG = (process.env.AI_DEBUG || '1') !== '0';
const LOG_FILE = process.env.AI_LOG_FILE || path.resolve(process.cwd(), 'server', 'ai-server.log');

function log(...args) {
  if (!DEBUG) return;
  const ts = new Date().toISOString();
  const line = `[ai-server ${ts}] ` + args.map(a => {
    try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
  }).join(' ') + '\n';
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
  console.log(line.trimEnd());
}

function ok(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function bad(res, code, msg) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: msg }));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (d) => chunks.push(d));
    req.on('end', () => {
      const buf = Buffer.concat(chunks).toString('utf8');
      if (!buf) return resolve({});
      try {
        resolve(JSON.parse(buf));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function trimSample(obj, opts = { maxLen: 20000 }) {
  try {
    const str = JSON.stringify(obj);
    if (str.length <= opts.maxLen) return obj;
    // naive truncation with safe JSON
    return { _note: `truncated for prompt, length=${str.length}` };
  } catch {
    return { _note: 'unserializable sample' };
  }
}

function inferExpansionHints(apis = []) {
  const hints = [];
  for (const a of apis) {
    const s = a?.lastSample || {};
    const rows = s?.rows || s?.data?.rows || null;
    if (Array.isArray(rows) && rows.length) {
      const item = rows[0] || {};
      const valueKey =
        Object.keys(item).find((k) => /state|status/i.test(k) && typeof item[k] !== 'object') ||
        null;
      const labelKey =
        ['registerDescribe', 'name', 'title', 'desc'].find((k) => k in item) || null;
      hints.push({ apiId: a.id, arrayPath: (s.rows ? 'rows' : 'data.rows'), valueKey, labelKey });
    }
  }
  return hints;
}

function buildPrompt({ apis, goal, sampleConfigSummary, sampleJson, statusStyles, maxItems }) {
  const apiBrief = (apis || []).map((a) => ({
    id: a.id,
    name: a.name,
    url: a.url,
    method: a.method,
    params: a.params || '',
    lastSample: trimSample(a.lastSample),
  }));

  const system = `你是工业/网络设备可视化的产品工程师。根据接口样本与示例机型，生成适合的渲染方案和交互，输出严格且可被 JSON.parse 解析的 JSON。不要输出任何 Markdown、代码块、注释或自然语言，不要使用 \`\`\` 代码围栏，只输出纯 JSON。`;
  const expansionHints = inferExpansionHints(apis);
  const user = {
    goal: goal || '以端口状态为主，hover 显示设备名与状态',
    sampleConfigSummary: sampleConfigSummary || null,
    sampleJson: sampleJson || null,
    apis: apiBrief,
    statusStyles: Array.isArray(statusStyles) ? statusStyles : [],
    iconsAllowList: Array.isArray(statusStyles) ? statusStyles.map((s) => s?.iconUrl).filter(Boolean) : [],
    expansionHints,
    maxItems: typeof maxItems === 'number' ? maxItems : 200,
    schema: {
      deviceMeta: { category: 'industrial|network', name: 'string?', width: 'number?', height: 'number?' },
      apis: [{ id: 'string', name: 'string?', url: 'string', method: 'GET|POST', interval: 'number?', usePush: 'boolean?', pushUrl: 'string?' }],
      layers: [{
        type: 'port|port-adv|table|card|image',
        name: 'string?', zIndex: 'number?',
        config: {
          x: 'number', y: 'number', width: 'number', height: 'number', rotate: 'number?', src: 'string?',
          apiId: 'string?', dataKey: 'string?', portDataKey: 'string?', portKey: 'string? (value)',
          statusMapping: '{[value:string]: { iconUrl:string, label?:string }}?',
          events: '{ hover?: { apiId?:string, dataKey?:string, text?:string }, click?:..., dblclick?:..., triple?:... }?'
        }
      }],
      suggestions: ['string']
    },
    constraints: [
      'statusMapping 的键一律用字符串',
      'apiId 必须存在于 apis 中，如可复用请引用已存在 id',
      '端口状态优先使用 port-adv，portDataKey 支持 rows[n].field 访问',
      '未给出画布尺寸时不要覆盖现有画布尺寸',
      '只允许使用 iconsAllowList 中提供的图标 URL，不要虚构或引用其他外部域名（如 example.com）。尽可能使用 statusStyles 中提供的 iconUrl 和 label 来构造 statusMapping；如果接口值为布尔，请映射到 "true"/"false"',
      '如 sampleJson 提供了端口状态/事件示例，可参考其组织方式（不要复制坐标，避免遮挡）',
      '当 lastSample 中存在数组（如 rows 或 data.rows）时，请为该数组的每个元素生成一个独立的 port-adv 图层（不超过 maxItems 个），其：\n- name 使用 labelKey 对应的字段（若无则拼接索引）\n- config.portDataKey 指向该元素的状态值字段（例如 rows[0].registerAddressState）\n- 对于该值为原始类型（布尔/数字）的情况，请将 config.portKey 固定为 "value"\n- 事件 hover 显示名称与状态，可使用模板 {{...}} 占位（例如 {{registerDescribe}} {{registerAddressState}}）',
      '布局：采用网格排布，元素大小 32x32，从 (200,100) 起，每行 8 个，间距 12px（允许微调）',
    ],
  };

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(user) },
  ];
}

function extractJsonFromString(content) {
  if (typeof content !== 'string') return null;
  // Try fenced code block first
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) {
    try { return JSON.parse(fence[1].trim()); } catch {}
  }
  // Try first {...} block
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const sub = content.slice(start, end + 1);
    try { return JSON.parse(sub); } catch {}
  }
  // Try strip backticks and parse
  const stripped = content.replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch {}
  return null;
}

async function callDeepseek(messages) {
  if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY missing');
  const url = `${DEEPSEEK_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`;
  const payload = { model: MODEL, messages, temperature: 0.2, max_tokens: 4000 };
  log('deepseek request:', {
    url,
    model: MODEL,
    messagesCount: messages?.length,
    userBytes: Buffer.byteLength(messages?.[1]?.content || '', 'utf8'),
  });
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  log('deepseek response:', { status: resp.status, bytes: Buffer.byteLength(text, 'utf8') });
  if (!resp.ok) throw new Error(`Deepseek error ${resp.status}: ${text}`);
  let json = null;
  try { json = JSON.parse(text); } catch (e) { log('deepseek JSON parse error:', e?.message); }
  const content = json?.choices?.[0]?.message?.content || '';
  log('deepseek content head:', content?.slice(0, 200));
  // try parse JSON with multiple strategies
  const parsed = extractJsonFromString(content);
  if (!parsed) log('extractJsonFromString failed. raw content head:', content?.slice(0, 200));
  return { content, parsed, raw: json };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  // health
  if (req.method === 'GET' && url.pathname === '/ai/health') return ok(res, { ok: true });
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    return res.end();
  }

  // server-side fetch to bypass CORS during development
  if (req.method === 'POST' && url.pathname === '/ai/fetch') {
    try {
      const body = await readBody(req);
      const target = body?.url;
      if (!target) return bad(res, 400, 'url required');
      const method = (body?.method || 'GET').toUpperCase();
      const headers = body?.headers || {};
      const fetchBody = method === 'POST' ? (body?.body || undefined) : undefined;
      log('proxy fetch ->', { method, url: target, hasBody: !!fetchBody });
      const r = await fetch(target, { method, headers, body: fetchBody });
      const ct = r.headers.get('content-type') || '';
      let data = null;
      if (ct.includes('application/json')) data = await r.json();
      else data = await r.text();
      log('proxy fetch <-', { status: r.status, type: ct, bytes: typeof data === 'string' ? Buffer.byteLength(data) : -1 });
      return ok(res, { status: r.status, data });
    } catch (e) {
      log('proxy fetch error:', e?.message);
      return bad(res, 500, e.message || String(e));
    }
  }

  if (req.method === 'POST' && url.pathname === '/ai/generate') {
    try {
      const body = await readBody(req);
      log('generate body digest:', {
        apis: Array.isArray(body?.apis) ? body.apis.length : 0,
        styles: Array.isArray(body?.statusStyles) ? body.statusStyles.length : 0,
        hasSampleJson: !!body?.sampleJson,
        hasSummary: !!body?.sampleConfigSummary,
        maxItems: body?.maxItems,
      });
      const messages = buildPrompt(body || {});
      log('prompt sizes:', {
        system: messages?.[0]?.content?.length,
        user: messages?.[1]?.content?.length,
      });
      const result = await callDeepseek(messages);
      log('generate parse:', { parsed: !!result.parsed, contentHead: result.content?.slice(0, 120) });
      return ok(res, { result: result.parsed || null, raw: result.content });
    } catch (e) {
      log('generate error:', e?.message);
      return bad(res, 500, e.message || String(e));
    }
  }

  bad(res, 404, 'not found');
});

server.listen(PORT, () => {
  console.log(`[ai-server] listening on http://localhost:${PORT}`);
});
