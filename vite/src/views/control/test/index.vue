<template>
  <CabinetView>
    <template #default="{ u }">
      <span v-if="u === 21">设备A</span>
      <span v-else-if="u === 10">服务器B</span>
    </template>
  </CabinetView>
</template>

<script setup lang="ts">
import CabinetView from './CabinetView.vue'
</script>

