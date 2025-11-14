#!/usr/bin/env node
/**
 * Generate an editor-friendly JSON for a device that renders all registers.
 * - Builds apiList per registerModuleIndex and one layer per register.
 * - Uses provided red/green icons for ON/OFF mapping.
 *
 * Usage:
 *   node scripts/generate-device-editor-json.mjs --deviceId 25 \
 *     --sql apps/web-ele/设备示例/jx-sql.sql \
 *     --out apps/web-ele/设备示例/device_25_editor.json \
 *     --green http://192.168.0.101:9000/qiuqiu/green.gif \
 *     --red   http://192.168.0.101:9000/qiuqiu/red.gif
 */
import fs from 'fs';
import path from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opt = {
    deviceId: 25,
    sql: 'apps/web-ele/设备示例/jx-sql.sql',
    out: '',
    baseUrl: 'http://192.168.0.101:8080',
    green: 'http://192.168.0.101:9000/qiuqiu/green.gif',
    red: 'http://192.168.0.101:9000/qiuqiu/red.gif',
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--deviceId' || a === '-d') opt.deviceId = Number(args[++i]);
    else if (a === '--sql') opt.sql = args[++i];
    else if (a === '--out' || a === '-o') opt.out = args[++i];
    else if (a === '--base') opt.baseUrl = args[++i];
    else if (a === '--green') opt.green = args[++i];
    else if (a === '--red') opt.red = args[++i];
  }
  if (!opt.out) opt.out = `apps/web-ele/设备示例/device_${opt.deviceId}_editor.json`;
  return opt;
}

function readFile(fp) {
  const abs = path.resolve(process.cwd(), fp);
  return fs.readFileSync(abs, 'utf8');
}

function extractDeviceInfo(sql, deviceId) {
  const re = new RegExp(
    String.raw`INSERT INTO\s+\`device\`\s*\([^\)]*\)\s*VALUES\s*\(\s*${deviceId}\s*,[^\)]*?\'([^']*)\'\s*,\s*\'([^']*)\'`,
    'm'
  );
  const m = sql.match(re);
  if (!m) return { deviceId, name: String(deviceId), ip: '' };
  return { deviceId, name: m[1], ip: m[2] };
}

function extractRegisters(sql, deviceId) {
  const re = new RegExp(
    String.raw`INSERT INTO\s+\`register_table\`[^\n]*?VALUES\s*\(\s*(\d+)\s*,\s*${deviceId}\s*,\s*\'([^']*)\'\s*,\s*\'([^']*)\'\s*,\s*(\d+)\s*,\s*(?:NULL|\'[^']*\')\s*,\s*\'([^']*)\'\s*,\s*(\d+)\s*,\s*(?:NULL|[^,]*)\s*,\s*(?:NULL|[^,]*)\s*,\s*(\d+)\s*,`,
    'g'
  );
  const regs = [];
  let m;
  while ((m = re.exec(sql)) !== null) {
    const [_, id, modelName, address, state, describe, number, moduleIndex] = m;
    regs.push({
      registerId: Number(id),
      registerModelName: modelName,
      registerAddress: address,
      registerAddressState: state === '1',
      registerDescribe: describe || '',
      registerNumber: Number(number),
      registerModuleIndex: Number(moduleIndex),
    });
  }
  return regs;
}

function groupByModule(regs) {
  const map = new Map();
  for (const r of regs) {
    const k = r.registerModuleIndex;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.registerNumber - b.registerNumber || a.registerId - b.registerId);
  }
  return map;
}

function main() {
  const opt = parseArgs();
  const sql = readFile(opt.sql);
  const device = extractDeviceInfo(sql, opt.deviceId);
  const regs = extractRegisters(sql, opt.deviceId);
  if (!regs.length) throw new Error(`No registers for device ${opt.deviceId}`);
  const byModule = groupByModule(regs);

  // Build apiList per module
  const apiList = [];
  const layers = [];
  const width = 1920, height = 1080;

  // grid layout params
  const cellW = 40; // 32 icon + 8 gap
  const cellH = 40;
  const leftPad = 20;
  const topPad = 20;
  const rowGap = 8;
  const transparentIcon = 'http://192.168.0.101:9000/qiuqiu/null.png';

  for (const [moduleIndex, list] of [...byModule.entries()].sort((a, b) => a[0] - b[0])) {
    const apiId = `api-module-${moduleIndex}`;
    const url = `${opt.baseUrl}/jx-device/registerTable/list?deviceId=${opt.deviceId}&registerModuleIndex=${moduleIndex}&pageSize=0`;
    apiList.push({ id: apiId, name: `模块${moduleIndex}`, url, method: 'GET', interval: 3000, params: '' });

    // Positioning per module: each module in its own row band
    const rowY = topPad + (moduleIndex - 1) * (cellH + rowGap);

    list.forEach((r, idxInModule) => {
      const id = `layer-${moduleIndex}-${r.registerId}`;
      const desc = (r.registerDescribe || '').trim();
      const name = desc ? desc : r.registerAddress;
      const x = leftPad + idxInModule * cellW;
      const y = rowY;
      layers.push({
        id,
        name,
        type: 'port-adv',
        zIndex: 1,
        groupId: `mod-${moduleIndex}`,
        config: {
          x, y, width: 32, height: 32, rotate: 0,
          src: opt.green,
          apiId,
          portDataKey: `rows[${idxInModule}].registerAddressState`,
          portKey: 'value',
          statusMapping: {
            // true: 显示绿色；false: 使用透明像素，视觉上“什么也不显示”
            true: { iconUrl: opt.green, label: '' },
            false: { iconUrl: transparentIcon, label: '' },
          },
          // 鼠标移入展示寄存器名称
          events: {
            hover: {
              apiId,
              dataKey: `rows[${idxInModule}].registerDescribe`,
            },
          },
          usePush: false,
          pushService: '',
        },
      });
    });
  }

  const outJson = {
    front: {
      deviceId: String(device.deviceId ?? opt.deviceId),
      width, height,
      layers,
      materialsTree: [],
      apiList,
    },
  };

  fs.writeFileSync(path.resolve(opt.out), JSON.stringify(outJson, null, 2));
  console.log(`Written ${opt.out}`);
}

main();
