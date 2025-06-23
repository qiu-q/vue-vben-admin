<!-- src/components/business/DeviceEditor/DeviceEditorPanel.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';

import CategorySidebar from './CategorySidebar.vue';
import LayerList from './LayerList.vue';
import PalettePanel from './PalettePanel.vue';

// TODO: 按分类获取 items（可以通过 props 注入）
// 假设 props.images, props.ports, props.logs
const props = defineProps<{
  images?: any[];
  layers: any[];
  logs?: any[];
  ports?: any[];
}>();
// 组件分类配置
const categories = [
  { key: 'image', label: '底图', icon: 'i-lucide-image' },
  { key: 'port', label: '端口', icon: 'i-lucide-plug' },
  { key: 'log', label: '日志区', icon: 'i-lucide-list' },
  { key: 'picture', label: '图片', icon: 'i-lucide-file-image' },
];
const selectedCategory = ref('image');
function selectCategory(key: string) {
  selectedCategory.value = key;
}

const categoryItems = computed(() => {
  switch (selectedCategory.value) {
    case 'image':
    case 'picture': {
      return props.images || [];
    }
    case 'log': {
      return props.logs || [];
    }
    case 'port': {
      return props.ports || [];
    }
    default: {
      return [];
    }
  }
});

function handleSelectItem(item: any) {
  // TODO: 处理选中/拖拽添加
}

function handleSelectLayer(layer: any) {
  // TODO: 图层选中处理
}

const layers = computed(() => props.layers || []);
</script>

<template>
  <div class="flex h-full bg-gray-50">
    <!-- 1. 分类栏 -->
    <CategorySidebar
      :categories="categories"
      :selected="selectedCategory"
      @select="selectCategory"
    />

    <!-- 2. Palette 展示当前分类组件 -->
    <PalettePanel
      :type="selectedCategory"
      :items="categoryItems"
      @select="handleSelectItem"
      class="w-56 overflow-y-auto border-r bg-gray-50 px-2 py-3"
    />

    <!-- 3. 图层区，条件渲染 -->
    <section
      v-if="layers && layers.length > 0"
      class="w-48 overflow-y-auto border-r bg-white px-2 py-3"
    >
      <h3 class="mb-2 text-sm font-semibold">图层</h3>
      <LayerList :layers="layers" @select="handleSelectLayer" />
    </section>

    <!-- 4. 画布和属性区由主页面控制 -->
    <slot></slot>
  </div>
</template>
