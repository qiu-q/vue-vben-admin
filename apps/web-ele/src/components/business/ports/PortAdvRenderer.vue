<script setup lang="ts">
import { computed } from 'vue';
import { useDeviceStore } from '#/store/deviceStore';

// config: { x, y, width, height, apiId, portDataKey, portKey, statusMapping }
const props = defineProps<{ config: any }>();

const store = useDeviceStore();

function getByPath(obj: any, path: string) {
  const keys = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  return keys.reduce((o: any, k: string) => {
    if (o && typeof o === 'object') {
      if (Array.isArray(o)) {
        const idx = Number(k);
        if (!Number.isNaN(idx)) return o[idx];
        return o.length ? o[0][k] : undefined;
      }
      return o[k];
    }
    return undefined;
  }, obj);
}

const stateValue = computed(() => {
  const data = (store.status as any) || {};
  const apiData = props.config.portDataKey ? getByPath(data, props.config.portDataKey) : data;
  if (apiData && typeof apiData === 'object') {
    return apiData[props.config.portKey || ''];
  }
  return undefined;
});

const iconUrl = computed(() => {
  const mapping = props.config.statusMapping || {};
  const key = stateValue.value;
  return mapping[String(key)]?.iconUrl || '/imgs/port-gray.png';
});
</script>

<template>
  <img
    :src="iconUrl"
    :style="{ left: `${config.x}px`, top: `${config.y}px` }"
    class="absolute pointer-events-none select-none"
    draggable="false"
  />
</template>
