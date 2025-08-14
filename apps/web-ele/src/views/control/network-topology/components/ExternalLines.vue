<template>
  <template v-for="(edge, idx) in edges" :key="idx">
    <g v-if="getEdgePositions(edge)">
      <path
        :d="bezierPath(getEdgePositions(edge).source, getEdgePositions(edge).target)"
        :stroke="(edge.color || '#FFA500') + '55'"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
        marker-end="url(#arrowhead)"
        :style="{ color: edge.color || '#FFA500' }"
      />
      <path
        :d="bezierPath(getEdgePositions(edge).source, getEdgePositions(edge).target)"
        :stroke="edge.color || '#FFA500'"
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
        :x="getEdgePositions(edge).externalPoint.x + 7"
        :y="getEdgePositions(edge).externalPoint.y + 12"
        font-size="14"
        :fill="edge.color || '#FFA500'"
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
