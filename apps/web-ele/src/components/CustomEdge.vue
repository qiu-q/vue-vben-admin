<script setup lang="ts">
import type { EdgeProps } from '@vue-flow/core';

import { computed } from 'vue';

import { getBezierPath } from '@vue-flow/core';

const props = defineProps<EdgeProps>();

const edgePath = computed(() => {
  return getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  })[0];
});
</script>

<template>
  <g>
    <!-- 渐变定义，放在组内，避免语法问题 -->
    <defs>
      <linearGradient id="blueWhiteDash" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#01E6FF" />
        <stop offset="50%" stop-color="white" />
        <stop offset="100%" stop-color="#01E6FF" />
      </linearGradient>
    </defs>

    <!-- 主路径 -->
    <path
      :d="edgePath"
      stroke="#01E6FF"
      stroke-width="4"
      fill="none"
      stroke-linecap="round"
      class="vue-flow__edge-path"
    />

    <!-- 蓝白渐变虚线路径 -->
    <path
      :d="edgePath"
      stroke="url(#blueWhiteDash)"
      stroke-width="2"
      fill="none"
      stroke-linecap="round"
      stroke-dasharray="10 6"
      stroke-dashoffset="0"
    >
      <animate
        attributeName="stroke-dashoffset"
        from="0"
        to="-32"
        dur="1.2s"
        repeatCount="indefinite"
      />
    </path>
  </g>
</template>
