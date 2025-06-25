<template>
  <defs>
    <linearGradient id="orangeWhiteDash" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFA500"/>
      <stop offset="50%" stop-color="#fff"/>
      <stop offset="100%" stop-color="#FFA500"/>
    </linearGradient>
  </defs>
  <template v-for="(edge, idx) in edges" :key="idx">
    <g v-if="getEdgePositions(edge)">
      <path
        :d="bezierPath(getEdgePositions(edge).source, getEdgePositions(edge).target)"
        stroke="#ffa50055"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
        marker-end="url(#arrowhead)"
      />
      <path
        :d="bezierPath(getEdgePositions(edge).source, getEdgePositions(edge).target)"
        stroke="url(#orangeWhiteDash)"
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
      <text
        :x="getEdgePositions(edge).target.x + 7"
        :y="getEdgePositions(edge).target.y + 12"
        font-size="14"
        fill="#FFA500"
        style="pointer-events: none; font-weight: bold"
      >
        {{ getEdgePositions(edge).externalName }}
      </text>
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
