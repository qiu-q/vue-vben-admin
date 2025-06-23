<!-- src/components/business/ports/PortComponent.vue -->
<script setup lang="ts">
import type { PortInstance } from '#/models/device';

import { computed } from 'vue';

import { useDeviceStore } from '#/store/deviceStore';

const props = defineProps<{
  port: PortInstance;
}>();

const store = useDeviceStore();

/** 根据最新 status 映射图标与样式 */
const render = computed(() => {
  const raw = store.status?.ports.find(
    (p) => p.portIndex === props.port.portIndex,
  )?.rawValue;

  const mapping = props.port.statusMapping;
  return mapping?.[String(raw)] || mapping?.default || {};
});

const iconUrl = computed(() => render.value.iconUrl ?? '/imgs/port-gray.png');
</script>

<template>
  <img
    :src="iconUrl"
    :class="render.className"
    :style="{ left: `${port.x}px`, top: `${port.y}px` }"
    class="pointer-events-none select-none"
    draggable="false"
  />
</template>
