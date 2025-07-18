<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import DevicePreviewRender from '#/views/control/device-preview/DevicePreviewRender.vue';

const route = useRoute();
const deviceId = ref((route.params.deviceId as string) || '');
const config = ref<any>(null);
const loading = ref(true);
const error = ref('');
const viewRef = ref<HTMLElement | null>(null);
const scale = ref(1);
function updateScale() {
  if (!viewRef.value || !config.value) return;
  const { clientWidth, clientHeight } = viewRef.value;
  const w = config.value.width || 1920;
  const h = config.value.height || 1080;
  // 不限制放大倍率，小尺寸配置也能全屏展示
  scale.value = Math.min(clientWidth / w, clientHeight / h);
}

async function loadConfig() {
  loading.value = true;
  error.value = '';
  try {
    const resp = await fetch(`/api/jx-device/Device/${deviceId.value}`);
    const json = await resp.json();
    if (json.code === 200 && json.data?.deviceJson) {
      let parsed: any = {};
      try {
        parsed = JSON.parse(json.data.deviceJson);
      } catch {
        console.warn('deviceJson parse failed');
      }
      parsed.layers = Array.isArray(parsed.layers) ? parsed.layers : [];
      parsed.materialsTree = Array.isArray(parsed.materialsTree)
        ? parsed.materialsTree
        : [];
      config.value = { deviceId: deviceId.value, width: 1920, height: 1080, ...parsed };
    } else {
      error.value = json.msg || '未找到设备配置';
    }
  } catch (err) {
    error.value = '加载失败';
    console.error(err);
  }
  loading.value = false;
}

onMounted(loadConfig);
watch(
  () => route.params.deviceId,
  (id) => {
    deviceId.value = (id as string) || '';
    loadConfig();
  },
);
watch(config, updateScale);
onMounted(() => {
  window.addEventListener('resize', updateScale);
  updateScale();
});
onUnmounted(() => window.removeEventListener('resize', updateScale));
</script>

<template>
  <div class="device-view-page">
    <div v-if="loading" class="status">加载中…</div>
    <div v-else-if="error" class="status text-red-400">{{ error }}</div>
    <div
      v-else
      ref="viewRef"
      class="flex h-full items-center justify-center bg-[#181a20]"
    >
      <div
        :style="{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${config.width}px`,
          height: `${config.height}px`,
        }"
      >
        <DevicePreviewRender :config="config" with-redis-state />
      </div>
    </div>
  </div>
</template>

<style scoped>
.device-view-page {
  position: fixed;
  inset: 0;
}
.status {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #ccc;
  background: #181a20;
}
</style>
