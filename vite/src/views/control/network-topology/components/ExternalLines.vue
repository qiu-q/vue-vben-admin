<template>
  <defs>
    <template v-for="(edge, idx) in edges" :key="idx">
      <linearGradient :id="`ext-dash-${idx}`" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" :stop-color="getEdgePositions(edge).color"/>
        <stop offset="50%" stop-color="#fff"/>
        <stop offset="100%" :stop-color="getEdgePositions(edge).color"/>
      </linearGradient>
      <marker :id="`ext-arrow-${idx}`" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L8,4 L0,8" :fill="getEdgePositions(edge).color" />
      </marker>
    </template>
  </defs>
  <template v-for="(edge, idx) in edges" :key="idx">
    <g v-if="getEdgePositions(edge)">
      <path :d="bezierPath(getEdgePositions(edge).source, getEdgePositions(edge).target)" :stroke="getEdgePositions(edge).color + '55'" stroke-width="2" fill="none" stroke-linecap="round" :marker-end="`url(#ext-arrow-${idx})`" />
      <path :d="bezierPath(getEdgePositions(edge).source, getEdgePositions(edge).target)" :stroke="`url(#ext-dash-${idx})`" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="18 12" stroke-dashoffset="0">
        <animate attributeName="stroke-dashoffset" from="0" to="-60" dur="1.2s" repeatCount="indefinite" />
      </path>
      <text :x="getEdgePositions(edge).externalPoint.x + 7" :y="getEdgePositions(edge).externalPoint.y + 12" font-size="14" :fill="getEdgePositions(edge).color" style="pointer-events: none; font-weight: bold">{{ getEdgePositions(edge).externalName }}</text>
    </g>
  </template>
</template>

<script setup lang="ts">
defineProps<{ edges: any[]; getEdgePositions: (edge: any) => any; bezierPath: (from: any, to: any) => string }>();
</script>

