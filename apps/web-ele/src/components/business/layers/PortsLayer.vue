<!-- src/components/business/layers/PortsLayer.vue -->
<script setup lang="ts">
import type { PortInstance } from '#/models/device';

import PortComponent from '../ports/PortComponent.vue';

defineProps<{
  config: {
    ports: PortInstance[];
  };
}>();
</script>

<template>
  <PortComponent
    v-for="port in config.ports"
    :key="port.id"
    :port="port"
    class="absolute"
  />
</template>
