<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useWs } from '#/services/ws';
import { callApi } from '#/api/generic';

// props
const props = defineProps<{ config: any }>();

// 数据存储
const apiDataMap = ref<Record<string, any>>({});
const apiTimers = ref<Record<string, number>>({});
const wsUnsubs = ref<Record<string, () => void>>({});

// 用于显示 IP 气泡
const hoveredPortInfo = ref<null | {
  x: number,
  y: number,
  ip: string,
}> (null);

// ========== API 轮询 ==========
async function fetchApi(api: any) {
  try {
    apiDataMap.value[api.id] = await callApi(
      api.url,
      api.method as 'GET' | 'POST',
      api.method === 'POST' ? JSON.parse(api.params || '{}') : undefined,
    );
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
    if (!api.usePush && api.interval && api.interval > 0) {
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

// ========== 端口移入/移出事件 ==========
function handlePortMouseEnter(layer: any) {
  if (!layer.config.dynamic) return;
  const { apiId, portKey } = layer.config;
  const apiResp = apiDataMap.value[apiId];
  if (!apiResp || apiResp.error) return;
  const ipMap = extractPortIpMap(apiResp);
  const x = layer.config.x + (layer.config.width || 0) / 2;
  const y = layer.config.y;
  hoveredPortInfo.value = {
    x,
    y,
    ip: ipMap[portKey] || '无IP',
  };
}
function handlePortMouseLeave() {
  hoveredPortInfo.value = null;
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
      width: `${config.width || 600}px`,
      height: `${config.height || 400}px`,
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
          @mouseenter="handlePortMouseEnter(layer)"
          @mouseleave="handlePortMouseLeave"
        />
      </template>
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
        textAlign: 'center'
      }"
    >
      {{ hoveredPortInfo.ip }}
    </div>
  </div>
  <div v-else class="p-8 text-center text-gray-500">
    暂无有效设备数据 / 请检查配置
  </div>
</template>
