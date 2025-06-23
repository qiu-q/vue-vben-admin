<!-- src/components/business/layers/IconsLayer.vue -->
<script setup lang="ts">
defineProps<{
  config: {
    icons: Array<{
      iconUrl: string;
      id: string;
      xPct: number;
      yPct: number;
    }>;
  };
}>();
</script>

<template>
  <img
    v-for="icon in config.icons"
    :key="icon.id"
    :src="icon.iconUrl"
    class="absolute cursor-pointer"
    :style="{ left: `${icon.xPct}%`, top: `${icon.yPct}%` }"
  />
</template>
