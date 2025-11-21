#!/usr/bin/env node
/**
 * Build a device JSON from SQL for given deviceId.
 * - Parse apps/web-ele/设备示例/jx-sql.sql for register_table rows
 * - Discover module indices and row counts for deviceId
 * - Place one background per module, then rows[i] ports using a shared offsets template
 * - Shift each subsequent module by stepX horizontally
 * - Write front/back/detail JSON (importable by editor)
 *
 * Usage:
 *   node scripts/build-from-sql.mjs --deviceId 24 \
 *     --out apps/web-ele/设备示例/device_24.json \
 *     [--base http://192.168.0.101:8080]
 */
import fs from 'fs';
import path from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opt = { deviceId: 24, sql: 'apps/web-ele/设备示例/jx-sql.sql', out: '', base: 'http://192.168.0.101:8080' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--deviceId' || a === '-d') opt.deviceId = Number(args[++i]);
    else if (a === '--sql') opt.sql = args[++i];
    else if (a === '--out' || a === '-o') opt.out = args[++i];
    else if (a === '--base') opt.base = args[++i];
  }
  if (!opt.out) opt.out = `apps/web-ele/设备示例/device_${opt.deviceId}.json`;
  return opt;
}

function readFile(fp) { return fs.readFileSync(path.resolve(fp), 'utf8'); }

function extractModules(sql, deviceId) {
  const counts = new Map();
  const lines = sql.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes("INSERT INTO `register_table`")) continue;
    const vi = line.indexOf('VALUES (');
    if (vi === -1) continue;
    const rest = line.slice(vi + 8); // after 'VALUES ('
    const close = rest.indexOf(')');
    const tuple = (close !== -1 ? rest.slice(0, close) : rest).trim();
    // naive split by comma; quoted fields do not contain commas in sample
    const parts = tuple.split(',').map(s => s.trim());
    if (parts.length < 11) continue;
    const dev = Number(parts[1]);
    if (dev !== deviceId) continue;
    const modIdx = Number(parts[10]);
    if (!Number.isFinite(modIdx)) continue;
    counts.set(modIdx, (counts.get(modIdx) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
}

async function build(opt) {
  const GREEN = 'http://192.168.0.101:9000/qiuqiu/green.gif';
  const NULLPNG = 'http://192.168.0.101:9000/qiuqiu/null.png';
  const bg = { x: 682.7040372799738, y: 7.8986575643110655, width: 197, height: 768, src: 'http://192.168.0.101:9000/qiuqiu/微信图片_20251114114113_982_8.png' };
  const stepX = 479;
  // Offsets template relative to bg (16 slots)
  const OFFS = [
    { dx: 45.2959627200262, dy: 150.10134243568893 },
    { dx: 44.2959627200262, dy: 187.10134243568893 },
    { dx: 45.2959627200262, dy: 225.10134243568893 },
    { dx: 44.2959627200262, dy: 262.10134243568893 },
    { dx: 45.2959627200262, dy: 296.10134243568893 },
    { dx: 44.2959627200262, dy: 331.10134243568893 },
    { dx: 44.2959627200262, dy: 369.10134243568893 },
    { dx: 45.2959627200262, dy: 406.10134243568893 },
    { dx: 45.2959627200262, dy: 441.10134243568893 },
    { dx: 46.2959627200262, dy: 478.10134243568893 },
    { dx: 46.2959627200262, dy: 512.10134243568893 },
    { dx: 46.2959627200262, dy: 549.1013424356889 },
    { dx: 45.2959627200262, dy: 585.1013424356889 },
    { dx: 46.2959627200262, dy: 621.1013424356889 },
    { dx: 48.2959627200262, dy: 656.1013424356889 },
    { dx: 46.2959627200262, dy: 687.1013424356889 },
  ];

  const sql = readFile(opt.sql);
  const mods = extractModules(sql, opt.deviceId);
  if (!mods.length) throw new Error(`No modules found for deviceId=${opt.deviceId}`);
  const layers = [];
  const apis = [];
  for (let k = 0; k < mods.length; k++) {
    const [mod, count] = mods[k];
    const apiId = `api-module-${mod}`;
    const url = `${opt.base}/jx-device/registerTable/list?deviceId=${opt.deviceId}&registerModuleIndex=${mod}&pageSize=0`;
    apis.push({ id: apiId, name: `模块${mod}`, url, method: 'GET', interval: 3000, params: '', usePush: false, pushUrl: '' });
    const colX = Math.round(bg.x + stepX * k);
    // background image
    layers.push({ id: `bg-mod-${mod}`, type: 'image', zIndex: 1, groupId: `mod-${mod}`, config: { x: colX, y: bg.y, width: bg.width, height: bg.height, src: bg.src, rotate: 0, apiId: '', dataKey: '' } });
    // fetch rows to extract registerDescribe as name (best-effort)
    let rows = [];
    try {
      const resp = await fetch(url);
      const json = await resp.json();
      if (json && Array.isArray(json.rows)) rows = json.rows;
    } catch {}
    const n = Math.min(count, OFFS.length, rows.length || count);
    for (let i = 0; i < n; i++) {
      const { dx, dy } = OFFS[i];
      const x = Math.round(colX + dx);
      const y = Math.round(bg.y + dy);
      const desc = (rows[i]?.registerDescribe ?? '').trim();
      const addr = (rows[i]?.registerAddress ?? '').trim();
      const name = desc || addr;
      layers.push({
        id: `mod-${mod}-port-${i}`,
        name,
        type: 'port-adv',
        zIndex: 2 + i,
        groupId: `mod-${mod}`,
        config: {
          x, y, width: 22, height: 22, rotate: 0, src: GREEN,
          apiId,
          portDataKey: `rows[${i}].registerAddressState`,
          portKey: 'value',
          statusMapping: { true: { iconUrl: GREEN, label: '' }, false: { iconUrl: NULLPNG, label: '' } },
          events: { hover: { apiId, dataKey: `rows[${i}].registerDescribe` } },
          usePush: false,
          pushService: '',
        },
      });
    }
  }

  const width = Math.max(1920, Math.ceil(bg.x + stepX * mods.length + 240));
  const height = Math.max(1080, Math.ceil(bg.y + bg.height + 40));
  const out = {
    front: { deviceId: String(opt.deviceId), width, height, layers, materialsTree: [], apiList: apis },
    back: { deviceId: String(opt.deviceId), width, height, layers: [], materialsTree: [], apiList: [] },
    detail: { deviceId: String(opt.deviceId), width, height, layers: [], materialsTree: [], apiList: [] },
    meta: { generatedAt: new Date().toISOString(), source: path.relative(process.cwd(), opt.sql) },
  };
  fs.writeFileSync(path.resolve(opt.out), JSON.stringify(out, null, 2));
  console.log(`Written ${opt.out} with ${mods.length} modules`);
}

const opt = parseArgs();
await build(opt);
