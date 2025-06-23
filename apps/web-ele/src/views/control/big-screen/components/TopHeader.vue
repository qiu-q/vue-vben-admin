<script setup lang="ts">
import { Decoration7, Decoration5 } from '@kjgl77/datav-vue3'
</script>
<template>
  <div class="top-header-row">
    <Decoration5 style="width:300px; height:40px;" />
    <Decoration7 style="width:300px; height:30px;">🏭 XX厂 · 工业网络运行总览</Decoration7>

  </div>
</template>
<style scoped>
.top-header-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #001529;
  color: white;
  padding: 20px;
  gap: 12px;
}

.title-text {
  font-size: 26px;
  font-weight: bold;
}
</style>
