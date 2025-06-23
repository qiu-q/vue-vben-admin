<template>
  <defs>
    <linearGradient id="blueWhiteDash" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#01E6FF" />
      <stop offset="50%" stop-color="white" />
      <stop offset="100%" stop-color="#01E6FF" />
    </linearGradient>
  </defs>
  <template v-for="(edge, idx) in edges" :key="idx">
    <g v-if="getEdgePositions(edge)">
      <path
        :d="bezierPath(getEdgePositions(edge).source, getEdgePositions(edge).target)"
        stroke="#19baff66"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
        marker-end="url(#arrowhead)"
      />
      <path
        :d="bezierPath(getEdgePositions(edge).source, getEdgePositions(edge).target)"
        stroke="url(#blueWhiteDash)"
        stroke-width="4"
        fill="none"
        stroke-linecap="round"
        stroke-dasharray="18 12"
        stroke-dashoffset="0"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-60"
          dur="1.2s"
          repeatCount="indefinite"
        />
      </path>
    </g>
  </template>
</template>

<script setup lang="ts">
defineProps<{
  edges: any[];
  getEdgePositions: (edge: any) => any;
  bezierPath: (from: any, to: any) => string;
}>();
</script>
