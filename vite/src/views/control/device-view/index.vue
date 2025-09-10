<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import DevicePreviewRender from '#/views/control/device-preview/DevicePreviewRender.vue';

const route = useRoute();
const deviceId = ref((route.params.deviceId as string) || '');
const frontConfig = ref<any>(null);
const backConfig = ref<any>(null);
const detailConfig = ref<any>(null);
type ViewType = 'front' | 'back' | 'detail';
const viewType = ref<ViewType>('detail');
const config = computed(() => viewType.value === 'front' ? frontConfig.value : viewType.value === 'back' ? backConfig.value : detailConfig.value);
const loading = ref(true);
const error = ref('');
const viewRef = ref<HTMLElement | null>(null);
const scale = ref(1);
function updateScale() {
  if (!viewRef.value || !config.value) return;
  const { clientWidth, clientHeight } = viewRef.value;
  const w = config.value.width || 1920; const h = config.value.height || 1080;
  scale.value = Math.min(clientWidth / w, clientHeight / h);
}
function syncApiPush(cfg: any) {
  const map = new Map<string, any>();
  (cfg.apiList || []).forEach((api: any) => map.set(api.id, api));
  (cfg.layers || []).forEach((layer: any) => {
    const id = layer.config?.apiId; if (!id) return; const api = map.get(id); if (!api) return;
    if (typeof api.usePush === 'boolean') { layer.config.usePush = api.usePush; layer.config.pushService = api.usePush ? api.pushUrl || '' : ''; }
    else if (typeof layer.config.usePush === 'boolean') { api.usePush = layer.config.usePush; api.pushUrl = layer.config.usePush ? layer.config.pushService || '' : ''; }
  });
}
async function loadConfig() {
  loading.value = true; error.value = '';
  try {
    const resp = await fetch(`/api/jx-device/Device/${deviceId.value}`);
    const json = await resp.json();
    if (json.code === 200 && json.data) {
      const parseCfg = (str: any) => { if (!str) return {}; try { return JSON.parse(str); } catch { return {}; } };
      const normalize = (cfg: any) => { cfg.layers = Array.isArray(cfg.layers) ? cfg.layers : []; cfg.materialsTree = Array.isArray(cfg.materialsTree) ? cfg.materialsTree : []; cfg.apiList = Array.isArray(cfg.apiList) ? cfg.apiList : []; syncApiPush(cfg); return { deviceId: deviceId.value, width: 1920, height: 1080, ...cfg }; };
      frontConfig.value = normalize(parseCfg(json.data.deviceJson));
      backConfig.value = normalize(parseCfg(json.data.deviceBack));
      detailConfig.value = normalize(parseCfg(json.data.deviceDetails));
    } else { error.value = json.msg || '未找到设备配置'; }
  } catch { error.value = '加载失败'; }
  loading.value = false;
}
onMounted(loadConfig);
watch(config, updateScale);
onMounted(() => { window.addEventListener('resize', updateScale); updateScale(); });
onUnmounted(() => window.removeEventListener('resize', updateScale));
</script>

<template>
  <div class="device-view-page">
    <div v-if="loading" class="status">加载中…</div>
    <div v-else-if="error" class="status text-red-400">{{ error }}</div>
    <div v-else ref="viewRef" class="relative flex h-full items-center justify-content bg-[#181a20]">
      <div class="toolbar">
        <select v-model="viewType" class="rounded bg-white/90 px-2 py-1 text-black">
          <option value="detail">详情</option>
          <option value="front">正面</option>
          <option value="back">背面</option>
        </select>
      </div>
      <div :style="{ transform: `scale(${scale})`, transformOrigin: 'top left', width: `${config.width}px`, height: `${config.height}px` }">
        <DevicePreviewRender :config="config" with-redis-state />
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-view-page { position: fixed; inset: 0; }
.status { display: flex; align-items: center; justify-content: center; height: 100%; color: #ccc; background: #181a20; }
.toolbar { position: absolute; top: 12px; left: 12px; }
</style>

