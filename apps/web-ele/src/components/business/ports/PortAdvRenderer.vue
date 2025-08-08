<script setup lang="ts">
import { computed } from 'vue';

interface StatusMapItem {
  label: string;
  iconUrl: string;
}

interface PortAdvConfig {
  x: number;
  y: number;
  apiId: string;
  portDataKey: string;
  portKey?: string;
  statusMapping: Record<string | number, StatusMapItem>;
}

const props = defineProps<{
  config: PortAdvConfig;
  data?: any;
}>();

function getValueByPath(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((o, k) => (o ? (o as any)[k] : undefined), obj);
}

const currentState = computed(() => {
  const source = props.data || {};
  let map: any = {};
  if (props.config.portDataKey) {
    const val = getValueByPath(source, props.config.portDataKey);
    map = val && typeof val === 'object' ? val : {};
  } else {
    map = source || {};
  }
  return map[props.config.portKey || ''];
});

const render = computed(() => {
  const mapping = props.config.statusMapping || {};
  return mapping[String(currentState.value)] || mapping.default || {};
});

const iconUrl = computed(() => render.value.iconUrl || '/imgs/port-gray.png');
</script>

<template>
  <img
    :src="iconUrl"
    :class="render.className"
    :style="{ left: `${config.x}px`, top: `${config.y}px` }"
    class="pointer-events-none select-none"
    draggable="false"
  />
</template>
