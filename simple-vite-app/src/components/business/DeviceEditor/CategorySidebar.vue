<!-- src/components/business/DeviceEditor/CategorySidebar.vue -->
<script setup lang="ts">
defineProps<{
  categories: { icon: string; key: string; label: string }[];
  selected: string;
}>();
</script>
<template>
  <aside class="flex w-20 flex-col items-center border-r bg-white py-2">
    <button
      v-for="cat in categories"
      :key="cat.key"
      class="mb-4 flex flex-col items-center text-xs focus:outline-none"
      :class="{ 'text-primary font-bold': cat.key === selected }"
      @click="$emit('select', cat.key)"
    >
      <i :class="cat.icon" class="mb-1 text-lg"></i>
      <span>{{ cat.label }}</span>
    </button>
  </aside>
</template>
<style scoped>
.text-primary {
  color: #2563eb;
}
</style>
