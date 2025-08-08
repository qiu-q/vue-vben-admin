<!-- src/components/business/DeviceDisplay/DeviceDisplay.vue -->
<script setup lang="ts">
import type { DeviceConfig } from '#/models/device';

import { computed } from 'vue';

import IconsLayer from '../layers/IconsLayer.vue';
import ImageLayer from '../layers/ImageLayer.vue';
import PortsLayer from '../layers/PortsLayer.vue';
import PortComponent from '../ports/PortComponent.vue';
import PortAdvRenderer from '../ports/PortAdvRenderer.vue';

defineProps<{
  config: DeviceConfig;
}>();

const layerComponentMap = {
  image: ImageLayer,
  ports: PortsLayer,
  icons: IconsLayer,
  port: PortComponent,
  'port-adv': PortAdvRenderer,
} as const;

const orderedLayers = computed(() =>
  [...props.config.layers].sort((a, b) => a.zIndex - b.zIndex),
);
</script>

<template>
  <div
    class="device-display relative"
    :style="{ width: `${config.width}px`, height: `${config.height}px` }"
  >
    <component
      v-for="layer in orderedLayers"
      :key="layer.id"
      :is="layerComponentMap[layer.type]"
      :config="layer.config"
      :device-id="config.deviceId"
      v-show="layer.visible"
    />
  </div>
</template>
