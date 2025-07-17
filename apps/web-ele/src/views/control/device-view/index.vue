<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import DevicePreviewRender from '#/views/control/device-preview/DevicePreviewRender.vue';

const route = useRoute();
const deviceId = ref((route.params.deviceId as string) || '');
const config = ref<any>(null);
const loading = ref(true);
const error = ref('');

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
      config.value = { deviceId: deviceId.value, width: 900, height: 600, ...parsed };
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
</script>

<template>
  <div class="device-view-page">
    <div v-if="loading" class="status">加载中…</div>
    <div v-else-if="error" class="status text-red-400">{{ error }}</div>
    <div v-else class="flex h-full items-center justify-center bg-[#181a20]">
      <DevicePreviewRender :config="config" />
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
