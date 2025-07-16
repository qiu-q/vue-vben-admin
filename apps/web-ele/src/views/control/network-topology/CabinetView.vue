<script setup lang="ts">
import { computed } from 'vue';

/* props */
const props = defineProps<{
  cabinet: any; // 实例
  hoverInfo: null | { cabinetId: string; uHeight: number; uStart: number };
  templatesMap: Record<string, any>;
}>();
const tpl = computed(
  () =>
    props.templatesMap[props.cabinet.deviceId] || {
      width: 480,
      height: 900,
      totalU: 42,
    },
);
const slotH = computed(() => tpl.value.height / tpl.value.totalU);
const hoverVisible = computed(
  () => props.hoverInfo && props.hoverInfo.cabinetId === props.cabinet._uuid,
);
</script>

<template>
  <div
    class="cabinet"
    :style="{
      left: `${cabinet.position.x}px`,
      top: `${cabinet.position.y}px`,
      width: `${tpl.width}px`,
      height: `${tpl.height}px`,
    }"
    @mousedown="$emit('start-drag-cabinet', $event)"
  >
    <!-- U 槽：U42 在最上方 → U1 在最下 -->
    <div
      v-for="u in tpl.totalU"
      :key="u"
      class="u-slot"
      :style="{ height: `${slotH}px` }"
      :class="{ hover: hoverVisible && hoverInfo.uStart === u }"
    >
      <span class="u-label"></span>
      <!-- 占位高亮（内部已吸附设备）-->
      <div
        v-for="inner in cabinet.inner"
        :key="inner._uuid"
        v-if="u >= inner.uStart && u < inner.uStart + inner.uHeight"
        class="inner-fill"
        :style="{
          height: `${inner.uHeight * slotH - 2}px`,
          lineHeight: `${inner.uHeight * slotH - 2}px`,
        }"
      ></div>
    </div>

    <!-- 动态 U 指示 -->
    <transition name="fade">
      <div
        v-if="hoverVisible"
        class="u-indicator"
        :style="{ fontSize: `${slotH * 1.2}px` }"
      >
        {{ hoverInfo.uHeight }}U
      </div>
    </transition>
  </div>
</template>

<style scoped>
.cabinet {
  position: absolute;
  cursor: move;
  user-select: none;
  background: #1c2027;
  border: 2px solid #00e5ff;
  box-shadow: 0 0 8px #00e5ff33;
}

.u-slot {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  border-top: 1px dashed #2f333b;
}

.u-slot.hover {
  background: rgb(0 255 255 / 12%);
}

.u-label {
  position: absolute;
  top: 0;
  left: 4px;
  font-size: 10px;
  color: #444;
}

.inner-fill {
  position: absolute;
  top: 1px;
  right: 1px;
  left: 1px;
  background: #0f669933;
  border: 1px solid #3cf5ff33;
}

.u-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  padding: 4px 16px;
  font-weight: 700;
  color: #38d9ff;
  pointer-events: none;
  background: #0bcfff22;
  border: 1px solid #38d9ff99;
  border-radius: 6px;
  opacity: 0;
  transform: translate(-50%, -50%);
  animation: fadein 0.4s ease 1s forwards;
}

@keyframes fadein {
  to {
    opacity: 1;
  }
}

.fade-leave-active {
  transition: opacity 0.25s;
}

.fade-leave-to {
  opacity: 0;
}
</style>
