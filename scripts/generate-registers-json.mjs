#!/usr/bin/env node
/**
 * Parse apps/web-ele/设备示例/jx-sql.sql and generate a JSON for a device's
 * all register modules and registers that can be used to render status.
 *
 * Usage:
 *   node scripts/generate-registers-json.mjs --deviceId 25 \
 *     --sql apps/web-ele/设备示例/jx-sql.sql \
 *     --out apps/web-ele/设备示例/device_25_registers.json
 */
import fs from 'fs';
import path from 'path';

function parseArgs() {
  const args = process.argv.slice(2);
  const opt = { deviceId: 25, sql: 'apps/web-ele/设备示例/jx-sql.sql', out: '' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--deviceId' || a === '-d') {
      opt.deviceId = Number(args[++i]);
    } else if (a === '--sql') {
      opt.sql = args[++i];
    } else if (a === '--out' || a === '-o') {
      opt.out = args[++i];
    }
  }
  if (!opt.out) {
    opt.out = `apps/web-ele/设备示例/device_${opt.deviceId}_registers.json`;
  }
  return opt;
}

function readFile(fp) {
  const abs = path.resolve(process.cwd(), fp);
  return fs.readFileSync(abs, 'utf8');
}

function extractDeviceInfo(sql, deviceId) {
  // Match: INSERT INTO `device` (...) VALUES (25, ..., 'name', 'ip', ...);
  const re = new RegExp(
    String.raw`INSERT INTO\s+\`device\`\s*\([^\)]*\)\s*VALUES\s*\(\s*${deviceId}\s*,[^\)]*?\'([^']*)\'\s*,\s*\'([^']*)\'`,
    'm'
  );
  const m = sql.match(re);
  if (!m) return { deviceId, name: String(deviceId), ip: '' };
  const name = m[1];
  const ip = m[2];
  return { deviceId, name, ip };
}

function extractRegisters(sql, deviceId) {
  // Regex to capture values for this device from register_table inserts.
  // Groups:
  // 1: register_id
  // 2: register_model_name
  // 3: register_address
  // 4: register_address_state (0/1)
  // 5: register_describe
  // 6: register_number
  // 7: register_module_index
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
      registerDescribe: describe,
      registerNumber: Number(number),
      registerModuleIndex: Number(moduleIndex),
    });
  }
  return regs;
}

function groupByModule(regs) {
  const byIdx = new Map();
  for (const r of regs) {
    const key = r.registerModuleIndex;
    if (!byIdx.has(key)) byIdx.set(key, []);
    byIdx.get(key).push(r);
  }
  // Build module list with inferred model name and sorted registers
  const modules = [];
  for (const [index, list] of byIdx.entries()) {
    list.sort((a, b) => a.registerNumber - b.registerNumber || a.registerId - b.registerId);
    const modelName = list[0]?.registerModelName || '';
    modules.push({ index, name: modelName, count: list.length, registers: list });
  }
  modules.sort((a, b) => a.index - b.index);
  return modules;
}

function buildApiForModule(baseUrl, deviceId, moduleIndex) {
  const qs = `deviceId=${deviceId}&registerModuleIndex=${moduleIndex}&pageSize=0`;
  return {
    directUrl: `${baseUrl}/jx-device/registerTable/list?${qs}`,
    proxyUrl: `/api/jx-device/registerTable/list?${qs}`,
    method: 'GET',
    curl: `curl -s '${baseUrl}/jx-device/registerTable/list?${qs}' | jq .`,
    curlProxy: `curl -s 'http://localhost:5777/api/jx-device/registerTable/list?${qs}' | jq .`,
  };
}

function main() {
  const { deviceId, sql: sqlPath, out } = parseArgs();
  const sql = readFile(sqlPath);
  const device = extractDeviceInfo(sql, deviceId);
  const regs = extractRegisters(sql, deviceId);
  if (!regs.length) {
    console.error(`No registers found for deviceId=${deviceId}. Check SQL path or ID.`);
    process.exit(2);
  }
  const modules = groupByModule(regs);

  const baseUrl = 'http://192.168.0.101:8080';
  const apis = modules.map(m => ({ index: m.index, ...buildApiForModule(baseUrl, deviceId, m.index) }));

  const outJson = {
    device: { deviceId, name: device.name, ip: device.ip },
    modules: modules.map(m => ({
      index: m.index,
      name: m.name,
      url: buildApiForModule(baseUrl, deviceId, m.index).directUrl,
      registers: m.registers.map(r => ({
        registerId: r.registerId,
        registerAddress: r.registerAddress,
        registerAddressState: r.registerAddressState,
        registerDescribe: r.registerDescribe,
        registerNumber: r.registerNumber,
      })),
    })),
    apis,
    meta: {
      source: path.relative(process.cwd(), sqlPath),
      generatedAt: new Date().toISOString(),
      note: 'registerAddressState values reflect the snapshot in SQL sample; runtime values should come from the API endpoints in apis[].',
    },
  };

  fs.writeFileSync(path.resolve(process.cwd(), out), JSON.stringify(outJson, null, 2));
  console.log(`Written ${out}`);
}

main();

