<script setup lang="ts">
import DevicePreviewRender from '#/views/control/device-preview/DevicePreviewRender.vue';

defineProps<{ data: { config: any; deviceId: string } }>();
</script>

<template>
  <div class="device-node">
    <DevicePreviewRender :config="data.config" />
  </div>
</template>

<style scoped>
.device-node {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 300px;
  min-height: 200px;
  overflow: hidden;
  pointer-events: auto;
  background: #1d2634e0;
  border: 2px solid #20eaff80;
  border-radius: 12px;
  box-shadow: 0 4px 14px #0006;
}
</style>
