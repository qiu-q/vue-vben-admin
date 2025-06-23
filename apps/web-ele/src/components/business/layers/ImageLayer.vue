<!-- src/components/business/layers/ImageLayer.vue -->
<script setup lang="ts">
defineProps<{
  config: {
    offset: { x: number; y: number };
    scale: number;
    src: string;
  };
}>();
</script>

<template>
  <img
    class="absolute"
    :src="config.src"
    :style="{
      transform: `scale(${config.scale})`,
      left: `${config.offset.x}px`,
      top: `${config.offset.y}px`,
      userSelect: 'none',
    }"
    draggable="false"
  />
</template>
