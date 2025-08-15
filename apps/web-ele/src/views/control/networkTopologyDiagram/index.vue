<script setup lang="ts">
import { ref } from 'vue';

import TopologyGraph from './components/TopologyGraph.vue';

const lineColor = ref('#4cafef');
</script>

<template>
  <div class="p-4">
    <input type="color" v-model="lineColor" class="mb-4" />
    <TopologyGraph :topology-data="{}" :line-color="lineColor" />
  </div>
</template>
