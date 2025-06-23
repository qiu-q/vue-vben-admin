<script setup lang="ts">
import { defineProps } from 'vue';

import { Handle } from '@vue-flow/core';

interface Props {
  data: { id: string; label: string; type: string };
}
const { data } = defineProps<Props>();
</script>

<template>
  <div class="sensor-cluster">
    <Handle type="target" position="top" />
    <div class="label">{{ data.label }}</div>
    <Handle type="source" position="bottom" />
  </div>
</template>

<style scoped>
.sensor-cluster {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 140px;
  height: 60px;
  font-weight: bold;
  color: #0f0;
  background: rgb(0 255 100 / 20%);
  border: 2px dashed #0f0;
  border-radius: 8px;
}
</style>
