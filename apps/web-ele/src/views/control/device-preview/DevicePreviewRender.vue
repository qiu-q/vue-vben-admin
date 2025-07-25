<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useWs } from '#/services/ws';
import { parseSnmpContent } from '@vben/utils';

// props
const props = defineProps<{ config: any; withRedisState?: boolean }>();

// 数据存储
const apiDataMap = ref<Record<string, any>>({});
const apiTimers = ref<Record<string, number>>({});
const wsUnsubs = ref<Record<string, () => void>>({});
const router = useRouter();

// 用于显示 IP 气泡
const hoveredPortInfo = ref<null | {
  x: number;
  y: number;
  port: string;
  ips: string[];
  found: Set<string>;
}>(null);

async function queryExistingIps(ips: string[]): Promise<Set<string>> {
  const exists = new Set<string>();
  if (!ips.length) return exists;
  try {
    const resp = await fetch('/api/jx-device/Device/listByIps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ips),
    });
    const json = await resp.json();
    if (json.code === 200 && Array.isArray(json.data)) {
      json.data.forEach((d: any) => exists.add(d.deviceIpAddress));
    }
  } catch {
    /* ignore */
  }
  return exists;
}

// ========== API 轮询 ==========
async function fetchApi(api: any) {
  try {
    if (api.method === 'POST') {
      let params: any = {};
      if (api.params) {
        try { params = JSON.parse(api.params); } catch { params = {}; }
      }
      if (props.withRedisState && api.usePush) params.redisState = '1';
      const resp = await fetch(api.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      apiDataMap.value[api.id] = await resp.json();
    } else {
      let url = api.url;
      if (props.withRedisState && api.usePush) {
        url += (url.includes('?') ? '&' : '?') + 'redisState=1';
      }
      const resp = await fetch(url);
      apiDataMap.value[api.id] = await resp.json();
    }
  } catch {
    apiDataMap.value[api.id] = { error: '请求失败' };
  }
}
function cleanupTimers() {
  Object.values(apiTimers.value).forEach((t) => clearInterval(t));
  apiTimers.value = {};
}
function startPollingApis() {
  cleanupTimers();
  if (!props.config?.apiList) return;
  for (const api of props.config.apiList) {
    fetchApi(api);
    const usePush = Boolean((api as any).usePush);
    if (!usePush && api.interval && api.interval > 0) {
      apiTimers.value[api.id] = window.setInterval(
        () => fetchApi(api),
        api.interval,
      );
    }
  }
}

// ========== WS 推送 ==========
function cleanupPush() {
  Object.values(wsUnsubs.value).forEach((off) => off && off());
  wsUnsubs.value = {};
}
function startPush() {
  cleanupPush();
  const pushApis = (props.config.apiList || []).filter(api => api.usePush && api.pushUrl);
  if (pushApis.length === 0) return;
  const pushKeys = [...new Set(pushApis.map(api => api.pushUrl))];
  pushKeys.forEach((key) => {
    wsUnsubs.value[key] = useWs(key, (payload) => {
      // 设备ID判定
      const deviceId = typeof payload === 'object'
        ? String(payload.deviceId)
        : String(payload);
      if (!deviceId) return;
      pushApis
        .filter(api => api.pushUrl === key && String(api.deviceId) === deviceId)
        .forEach(api => {
          fetchApi(api);
        });
    });
  });
}

// ========== 端口状态提取 ==========
function extractPortMap(sample: any): Record<string, any> {
  if (sample?.portstatuslist && typeof sample.portstatuslist === 'object') {
    return sample.portstatuslist;
  }
  if (
    sample?.data?.portNameAndState &&
    typeof sample.data.portNameAndState === 'object'
  ) {
    return sample.data.portNameAndState;
  }
  return {};
}
function extractPortIpMap(sample: any): Record<string, string> {
  if (
    sample?.data?.portNameAndIpAddress &&
    typeof sample.data.portNameAndIpAddress === 'object'
  ) {
    return sample.data.portNameAndIpAddress;
  }
  return {};
}

// ========== 状态映射 ==========
function getPortStatus(layer: any) {
  if (!layer.config.dynamic) return null;
  const { apiId, portKey, statusMapping = {} } = layer.config;
  const apiResp = apiDataMap.value[apiId];
  if (!apiResp || apiResp.error) return null;
  const portMap = extractPortMap(apiResp);
  const val = portMap[portKey];
  return statusMapping[val] || null;
}
function bindDeviceIdToApis() {
  const deviceId = props.config?.deviceId;
  if (!deviceId || !props.config?.apiList) return;
  props.config.apiList.forEach((api: any) => {
    api.deviceId = deviceId;
  });
}

function getTableData(layer: any) {
  let data: any;
  if (layer.config.apiId) {
    const apiResp = apiDataMap.value[layer.config.apiId];
    if (!apiResp || apiResp.error) return [];
    data = layer.config.dataKey ? getByKey(apiResp, layer.config.dataKey) : apiResp;
  } else {
    data = layer.config.data;
  }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (data && typeof data === 'object') return parseSnmpContent(data);
  return [];
}

function getTableColumns(layer: any) {
  if (Array.isArray(layer.config.columns) && layer.config.columns.length) {
    return layer.config.columns;
  }
  const data = getTableData(layer);
  if (Array.isArray(data) && data.length) {
    return Object.keys(data[0]).map((k) => ({ field: k, title: k }));
  }
  return [];
}

function getTableHeaders(layer: any) {
  return getTableColumns(layer).map((c: any) => c.title || c.field);
}

function getByKey(obj: any, path: string): any {
  if (!obj) return undefined;
  if (path.includes('.')) {
    const [head, ...rest] = path.split('.');
    const next = getByKey(obj, head);
    return rest.length ? getByKey(next, rest.join('.')) : next;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const val = getByKey(item, path);
      if (val !== undefined) return val;
    }
    return undefined;
  }
  if (obj && typeof obj === 'object') {
    if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
    for (const key of Object.keys(obj)) {
      const val = getByKey(obj[key], path);
      if (val !== undefined) return val;
    }
  }
  return undefined;
}

function getLayerText(layer: any) {
  if (layer.config.apiId && layer.config.dataKey) {
    const apiResp = apiDataMap.value[layer.config.apiId];
    if (apiResp && !apiResp.error) {
      const val = getByKey(apiResp, layer.config.dataKey);
      if (val !== undefined && val !== null) return String(val);
    }
  }
  return layer.config.text || '';
}

// ========== 端口移入/移出事件 ==========
async function handlePortMouseEnter(layer: any) {
  if (!layer.config.dynamic) return;
  const { apiId, portKey } = layer.config;
  const apiResp = apiDataMap.value[apiId];
  if (!apiResp || apiResp.error) return;
  const x = layer.config.x + (layer.config.width || 0) / 2;
  const y = layer.config.y;
  const ipMap = extractPortIpMap(apiResp);
  let ips: string[] = [];
  const val = ipMap[portKey];
  if (Array.isArray(val)) ips = val.filter(Boolean);
  else if (val) ips = [String(val)];
  const found = await queryExistingIps(ips);
  hoveredPortInfo.value = {
    x,
    y,
    port: portKey,
    ips,
    found,
  };
}
function handlePortMouseLeave() {
  hoveredPortInfo.value = null;
}

async function handlePortClick(layer: any) {
  if (!layer.config.dynamic) return;
  const { apiId, portKey } = layer.config;
  const apiResp = apiDataMap.value[apiId];
  if (!apiResp || apiResp.error) return;
  const ipMap = extractPortIpMap(apiResp);
  let ips: string[] = [];
  const val = ipMap[portKey];
  if (Array.isArray(val)) ips = val.filter(Boolean);
  else if (val) ips = [String(val)];
  const exist = await queryExistingIps(ips);
  const targets = ips.filter((ip) => exist.has(ip));
  if (!targets.length) {
    window.alert('没有找到对应设备');
    return;
  }
  for (const ip of targets) {
    try {
      const resp = await fetch(
        `/api/jx-device/Device/list?deviceIpAddress=${encodeURIComponent(ip)}`,
      );
      const json = await resp.json();
      const row = Array.isArray(json.rows) && json.rows[0];
      if (row && row.deviceId) {
        router.push(`/control/device-view/${row.deviceId}`);
        return;
      }
    } catch (err) {
      console.error(err);
    }
  }
  window.alert('没有找到对应设备');
}

async function handlePortDblClick(layer: any) {
  if (!layer.config.dynamic) return;
  const { apiId, portKey } = layer.config;
  const apiResp = apiDataMap.value[apiId];
  if (!apiResp || apiResp.error) return;
  const portMap = extractPortMap(apiResp);
  const raw = portMap[portKey];
  if (String(raw) !== '3') return;
  if (!window.confirm('端口状态异常，确认已恢复正常？')) return;
  try {
    await fetch('/api/jx-device/Port/deviceIdAndPortNameUpdate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: props.config.deviceId, portName: portKey }),
    });
  } catch (err) {
    console.error(err);
  }
  startPollingApis();
}

// ========== 生命周期 ==========
onMounted(() => {
  bindDeviceIdToApis();
  startPollingApis();
  startPush();
});
onUnmounted(() => {
  cleanupTimers();
  cleanupPush();
});
watch(
  () => props.config,
  () => {
    bindDeviceIdToApis();
    startPollingApis();
    startPush();
  },
);
</script>

<template>
  <div
    v-if="config && Array.isArray(config.layers)"
    :style="{
      position: 'relative',
      width: `${config.width || 1920}px`,
      height: `${config.height || 1080}px`,
      background: '#20222a',
      overflow: 'hidden',
    }"
  >
    <template
      v-for="layer in config.layers
        .slice()
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))"
      :key="layer.id"
    >
      <!-- 普通图片 -->
      <img
        v-if="layer.type === 'image'"
        :src="layer.config.src"
        :style="{
          position: 'absolute',
          left: `${layer.config.x}px`,
          top: `${layer.config.y}px`,
          width: `${layer.config.width}px`,
          height: `${layer.config.height}px`,
          zIndex: layer.zIndex,
        }"
        draggable="false"
      />
      <!-- 端口 -->
      <template v-else-if="layer.type === 'port'">
        <img
          :src="
            layer.config.dynamic
              ? getPortStatus(layer)?.iconUrl || layer.config.src
              : layer.config.src
          "
          :title="layer.config.dynamic ? getPortStatus(layer)?.label : ''"
          :style="{
            position: 'absolute',
            left: `${layer.config.x}px`,
            top: `${layer.config.y}px`,
            width: `${layer.config.width}px`,
            height: `${layer.config.height}px`,
            zIndex: layer.zIndex,
            border: layer.config.dynamic ? '2px solid #0ff8' : 'none',
            borderRadius: layer.config.dynamic ? '7px' : '0',
          cursor: layer.config.dynamic ? 'pointer' : 'default'
          }"
          draggable="false"
          @click="handlePortClick(layer)"
          @dblclick="handlePortDblClick(layer)"
          @mouseenter="handlePortMouseEnter(layer)"
          @mouseleave="handlePortMouseLeave"
        />
      </template>
      <!-- 表格 -->
      <div
        v-else-if="layer.type === 'table'"
        :style="{
          position: 'absolute',
          left: `${layer.config.x}px`,
          top: `${layer.config.y}px`,
          width: `${layer.config.width}px`,
          height: `${layer.config.height}px`,
          zIndex: layer.zIndex,
          background: '#2d323c',
          color: '#fff',
          fontSize: layer.config.fontSize || '11px',
          overflowX: 'auto',
          overflowY: layer.config.scrollY ? 'auto' : 'hidden',
        }"
        class="text-xs"
      >
        <table class="w-full border-collapse">
        <thead
          v-if="getTableColumns(layer).length"
          :style="{ lineHeight: layer.config.headerSize || undefined }"
        >
          <tr>
            <th
              v-for="col in getTableColumns(layer)"
              :key="col.field"
              class="border px-1 py-0.5"
            >
              {{ col.title || col.field }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rIdx) in getTableData(layer)" :key="rIdx">
            <td
              v-for="col in getTableColumns(layer)"
              :key="col.field"
              class="border px-1 py-0.5"
            >
              {{ row[col.field] }}
            </td>
          </tr>
        </tbody>
        </table>
      </div>
      <!-- 卡片 -->
      <div
        v-else-if="layer.type === 'card'"
        :style="{
          position: 'absolute',
          left: `${layer.config.x}px`,
          top: `${layer.config.y}px`,
          width: `${layer.config.width}px`,
          height: `${layer.config.height}px`,
          zIndex: layer.zIndex,
          background: layer.config.background,
          color: layer.config.color,
          fontSize: layer.config.fontSize + 'px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }"
      >
        {{ getLayerText(layer) }}
      </div>
    </template>
    <!-- 悬浮 IP 气泡 -->
    <div
      v-if="hoveredPortInfo"
      :style="{
        position: 'absolute',
        left: hoveredPortInfo.x + 'px',
        top: (hoveredPortInfo.y - 28) + 'px',
        background: '#232f3b',
        color: '#0ff',
        padding: '4px 16px',
        borderRadius: '7px',
        border: '1px solid #1ad0ff',
        fontSize: '13px',
        pointerEvents: 'none',
        zIndex: 99,
        minWidth: '80px',
        textAlign: 'center',
        whiteSpace: 'pre-wrap'
      }"
    >
      <div>{{ hoveredPortInfo.port }}</div>
      <div v-if="hoveredPortInfo.ips.length">
        <span
          v-for="ip in hoveredPortInfo.ips"
          :key="ip"
          :style="{ color: hoveredPortInfo.found.has(ip) ? 'red' : '#0ff', marginRight: '4px' }"
        >{{ ip }}</span>
      </div>
    </div>
  </div>
  <div v-else class="p-8 text-center text-gray-500">
    暂无有效设备数据 / 请检查配置
  </div>
</template>
