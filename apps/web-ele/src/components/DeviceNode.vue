<script setup lang="ts">
import { defineProps } from 'vue';

import { Handle } from '@vue-flow/core';

interface Props {
  data: { id: string; label: string; type: string };
}
const { data } = defineProps<Props>();
</script>

<template>
  <div class="device-node">
    <!-- 目标端点：其他连线可连入 -->
    <Handle type="target" position="top" />
    <Handle type="target" position="left" />

    <!-- 节点内容 -->
    <div class="icon" :class="data.type"></div>
    <div class="label">{{ data.label }}</div>

    <!-- 源端点：可从此拖出连线 -->
    <Handle type="source" position="right" />
    <Handle type="source" position="bottom" />
  </div>
</template>

<style scoped>
.device-node {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 60px;
  font-weight: bold;
  color: #0ff;
  background: rgb(0 200 255 / 20%);
  border: 2px solid #00e6ff;
  border-radius: 8px;
}

.icon {
  font-size: 1.4rem;
}

.icon.pc {
  /* 可用背景图或 emoji */
}

.icon.switch {
}

.icon.gateway {
}

.icon.plc {
}
</style>
