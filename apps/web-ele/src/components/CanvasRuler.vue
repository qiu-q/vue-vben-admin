<script setup lang="ts">
const props = defineProps<{
  direction: 'horizontal' | 'vertical';
  length: number;
  majorStep?: number;
  step?: number;
}>();

const step = props.step ?? 32; // 小刻度间隔 px
const majorStep = props.majorStep ?? 160; // 主刻度间隔 px
</script>
<template>
  <svg
    :width="direction === 'horizontal' ? length : 32"
    :height="direction === 'vertical' ? length : 32"
    style="display: block"
  >
    <g v-for="i in Math.ceil(length / step)" :key="i">
      <line
        v-if="direction === 'horizontal'"
        :x1="i * step"
        y1="0"
        :x2="i * step"
        :y2="i % (majorStep / step) === 0 ? 24 : 12"
        :stroke="i % (majorStep / step) === 0 ? '#7faaff' : '#476bb7'"
        stroke-width="1"
      />
      <text
        v-if="direction === 'horizontal' && i % (majorStep / step) === 0"
        :x="i * step + 2"
        y="22"
        fill="#7faaff"
        font-size="12"
      >
        {{ i * step }}
      </text>

      <line
        v-if="direction === 'vertical'"
        x1="0"
        :y1="i * step"
        :x2="i % (majorStep / step) === 0 ? 24 : 12"
        :y2="i * step"
        :stroke="i % (majorStep / step) === 0 ? '#7faaff' : '#476bb7'"
        stroke-width="1"
      />
      <text
        v-if="direction === 'vertical' && i % (majorStep / step) === 0"
        x="2"
        :y="i * step + 12"
        fill="#7faaff"
        font-size="12"
      >
        {{ i * step }}
      </text>
    </g>
  </svg>
</template>
