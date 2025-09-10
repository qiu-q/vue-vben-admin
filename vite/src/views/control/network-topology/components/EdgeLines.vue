<!-- components/EdgeLines.vue -->
<template>
  <svg width="100%" height="100%" style="position: absolute; top: 0; left: 0; z-index: 50; pointer-events: none;">
    <defs>
      <linearGradient id="blueWhiteDash" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#01E6FF" />
        <stop offset="25%" stop-color="#aefcff" />
        <stop offset="50%" stop-color="white" />
        <stop offset="75%" stop-color="#aefcff" />
        <stop offset="100%" stop-color="#01E6FF" />
      </linearGradient>
      <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L8,4 L0,8" fill="#01E6FF" />
      </marker>
    </defs>
    <template v-for="(edge, idx) in edges" :key="idx">
      <g v-if="getEdgePositions(edge)">
        <path :d="bezierPath(getEdgePositions(edge).source, getEdgePositions(edge).target)" :stroke="edge.external ? '#FFA500' : '#19baff66'" stroke-width="2" fill="none" stroke-linecap="round" marker-end="url(#arrowhead)" />
        <path v-if="!edge.external" :d="bezierPath(getEdgePositions(edge).source, getEdgePositions(edge).target)" stroke="url(#blueWhiteDash)" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="18 12" stroke-dashoffset="0">
          <animate attributeName="stroke-dashoffset" from="0" to="-60" dur="1.2s" repeatCount="indefinite" />
        </path>
        <text v-if="edge.external" :x="getEdgePositions(edge).target.x + 7" :y="getEdgePositions(edge).target.y + 12" font-size="14" fill="#FFA500" style="pointer-events: none; font-weight: bold">{{ getEdgePositions(edge).externalName }}</text>
      </g>
    </template>
    <path v-if="drawingLine && drawingLine.from && mousePos" :d="bezierPath(drawingLine.from, mousePos)" stroke="#01E6FF" stroke-width="2" fill="none" stroke-dasharray="5,4" />
  </svg>
</template>

<script setup lang="ts">
const props = defineProps({ edges: Array, drawingLine: Object, mousePos: Object, getEdgePositions: Function, bezierPath: Function });
</script>
