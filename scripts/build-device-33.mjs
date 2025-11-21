#!/usr/bin/env node
/**
 * Build apps/web-ele/设备示例/device_33 (2).json
 * Source: apps/web-ele/设备示例/device_25_editor.json (generated earlier)
 * - Flattens to { deviceId, layers, apis, meta }
 * - Preserves per-module grouping via layer.groupId = "mod-{index}"
 * - Keeps statusMapping and hover events as-is
 */
import fs from 'fs';
import path from 'path';

const SRC = 'apps/web-ele/设备示例/device_25_editor.json';
const OUT = 'apps/web-ele/设备示例/device_33 (2).json';

function main() {
  const srcAbs = path.resolve(SRC);
  const raw = fs.readFileSync(srcAbs, 'utf8');
  const src = JSON.parse(raw);
  const front = src.front || src;
  const srcLayers = Array.isArray(front.layers) ? front.layers : [];
  const apis = Array.isArray(front.apiList) ? front.apiList : [];

  // Build per-module ports from source layers
  const byMod = new Map(); // index -> port layers list
  for (const l of srcLayers) {
    const apiId = l?.config?.apiId;
    if (!apiId) continue;
    const m = String(apiId).match(/module-(\d+)/);
    if (!m) continue;
    const mod = Number(m[1]);
    if (!byMod.has(mod)) byMod.set(mod, []);
    byMod.get(mod).push(l);
  }

  // Desired anchor pattern (from user's example)
  const bg = {
    width: 197,
    height: 768,
    x: 682.7040372799738,
    y: 7.8986575643110655,
    src: 'http://192.168.0.101:9000/qiuqiu/微信图片_20251114114113_982_8.png',
  };
  const sampleXs = [728, 727, 728, 727, 728, 727, 727, 728, 728, 729, 730, 729, 729, 728, 729, 731, 729];
  const sampleYs = [158, 195, 233, 270, 304, 339, 339+38, 414, 449, 486, 520, 557, 593, 629, 664, 695];
  // normalize lengths
  const len = Math.max(sampleXs.length, sampleYs.length);
  const relXs = Array.from({ length: len }, (_, i) => (sampleXs[i] ?? sampleXs[sampleXs.length-1]) - bg.x);
  const relYs = Array.from({ length: len }, (_, i) => (sampleYs[i] ?? sampleYs[sampleYs.length-1]) - bg.y);
  const stepX = 479; // right shift for next module (approx from earlier sample)

  const GREEN = 'http://192.168.0.101:9000/qiuqiu/green.gif';
  const NULLPNG = 'http://192.168.0.101:9000/qiuqiu/null.png';

  // Compose new layers with background + ports per module, columns laid out horizontally
  const layers = [];
  const sortedMods = Array.from(byMod.keys()).sort((a, b) => a - b);
  sortedMods.forEach((mod, idx) => {
    const colX = bg.x + stepX * idx;
    // background
    layers.push({
      id: `bg-mod-${mod}`,
      type: 'image',
      zIndex: 1,
      groupId: `mod-${mod}`,
      config: { x: colX, y: bg.y, width: bg.width, height: bg.height, src: bg.src, rotate: 0, apiId: '', dataKey: '' },
    });
    // ports: sort by registerNumber if present, else keep order
    const arr = byMod.get(mod).slice();
    arr.sort((a, b) => (a.config?.registerNumber || 0) - (b.config?.registerNumber || 0));
    arr.forEach((orig, i) => {
      const apiId = orig.config.apiId;
      const name = orig.name || '';
      const portDataKey = orig.config.portDataKey || `rows[${i}].registerAddressState`;
      const hoverKey = (orig.config.events?.hover?.dataKey) || `rows[${i}].registerDescribe`;
      const x = Math.round((colX + (relXs[i] ?? relXs[relXs.length - 1])));
      const y = Math.round((bg.y + (relYs[i] ?? relYs[relYs.length - 1])));
      layers.push({
        id: `mod-${mod}-port-${i}`,
        name,
        type: 'port-adv',
        zIndex: 2 + i,
        groupId: `mod-${mod}`,
        config: {
          x, y, width: 22, height: 22, rotate: 0, src: GREEN,
          apiId,
          portDataKey,
          portKey: 'value',
          statusMapping: { true: { iconUrl: GREEN, label: '' }, false: { iconUrl: NULLPNG, label: '' } },
          events: { hover: { apiId, dataKey: hoverKey } },
          usePush: false,
          pushService: '',
        },
      });
    });
  });

  const width = Number(front.width || 1920);
  const height = Number(front.height || 1080);
  const materialsTree = Array.isArray(front.materialsTree) ? front.materialsTree : [];
  const out = {
    front: {
      deviceId: '33',
      width: Math.max(width, Math.ceil(bg.x + stepX * sortedMods.length + 240)),
      height: Math.max(height, bg.y + bg.height + 40),
      layers,
      materialsTree,
      apiList: apis,
    },
    back: { deviceId: '33', width, height, layers: [], materialsTree: [], apiList: [] },
    detail: { deviceId: '33', width, height, layers: [], materialsTree: [], apiList: [] },
    meta: { generatedAt: new Date().toISOString(), source: path.relative(process.cwd(), SRC) },
  };
  fs.writeFileSync(path.resolve(OUT), JSON.stringify(out, null, 2));
  console.log(`Written ${OUT}`);
}

main();
