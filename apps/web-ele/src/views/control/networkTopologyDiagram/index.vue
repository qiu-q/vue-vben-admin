<script setup lang="ts">
import { ref } from 'vue';

import TopologyGraph from './components/TopologyGraph.vue';

const pickerColor = ref('#4cafef');
const lineColor = ref('#4cafef');
function applyColor() {
  lineColor.value = pickerColor.value;
}
</script>

<template>
  <div class="p-4">
    <input type="color" v-model="pickerColor" class="mb-2" />
    <button class="ml-2 rounded border px-2 py-1" @click="applyColor">
      确认
    </button>
    <TopologyGraph :topology-data="{}" :line-color="lineColor" />
  </div>
</template>
