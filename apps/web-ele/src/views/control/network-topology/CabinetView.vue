<template>
  <div
    class="cabinet"
    :style="{
      left: cabinet.position.x + 'px',
      top: cabinet.position.y + 'px',
      width: tpl.width + 'px',
      height: tpl.height + 'px'
    }"
    @mousedown="$emit('start-drag-cabinet',$event)"
  >
    <!-- U 槽：U42 在最上方 → U1 在最下 -->
    <div
      v-for="u in tpl.totalU"
      :key="u"
      class="u-slot"
      :style="{height:slotH+'px'}"
      :class="{hover:hoverVisible && hoverInfo.uStart===u}"
    >
      <span class="u-label"></span>
      <!-- 占位高亮（内部已吸附设备）-->
      <div
        v-for="inner in cabinet.inner"
        :key="inner._uuid"
        v-if="u >= inner.uStart && u < inner.uStart + inner.uHeight"
        class="inner-fill"
        :style="{
          height: inner.uHeight * slotH - 2 + 'px',
          lineHeight: inner.uHeight * slotH - 2 + 'px'
        }"
      ></div>
    </div>

    <!-- 动态 U 指示 -->
    <transition name="fade">
      <div
        v-if="hoverVisible"
        class="u-indicator"
        :style="{fontSize: slotH*1.2 + 'px'}"
      >
        {{ hoverInfo.uHeight }}U
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/* props */
const props = defineProps<{
  cabinet     : any            // 实例
  templatesMap: Record<string,any>
  hoverInfo   : null|{cabinetId:string;uStart:number;uHeight:number}
}>()
const tpl     = computed(()=> props.templatesMap[props.cabinet.deviceId] || {width:480,height:900,totalU:42})
const slotH   = computed(()=> tpl.value.height / tpl.value.totalU )
const hoverVisible = computed(()=> props.hoverInfo && props.hoverInfo.cabinetId===props.cabinet._uuid)
</script>

<style scoped>
.cabinet{
  position:absolute;user-select:none;cursor:move;
  border:2px solid #00e5ff;background:#1c2027;box-shadow:0 0 8px #00e5ff33;
}
.u-slot{
  position:relative;border-top:1px dashed #2f333b;width:100%;box-sizing:border-box;
}
.u-slot.hover{background:#0ff3/12}
.u-label{position:absolute;left:4px;top:0;font-size:10px;color:#444}
.inner-fill{
  position:absolute;left:1px;top:1px;right:1px;
  background:#0f669933;border:1px solid #3cf5ff33;
}
.u-indicator{
  position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
  padding:4px 16px;background:#0bcfff22;border:1px solid #38d9ff99;
  color:#38d9ff;font-weight:700;border-radius:6px;opacity:0;
  animation:fadein 0.4s ease 1s forwards;
  pointer-events:none;
}
@keyframes fadein{to{opacity:1}}
.fade-leave-active{transition:opacity .25s}
.fade-leave-to{opacity:0}
</style>
