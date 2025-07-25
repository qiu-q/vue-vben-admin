<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  config: any;
  selectedLayerId?: null | string;
}>();
const emit = defineEmits(['select', 'update']);

// 拖动相关
const dragging = ref(false);
const dragIndex = ref<null | number>(null);
const dropIndex = ref<null | number>(null);

function handleDragStart(idx: number) {
  dragging.value = true;
  dragIndex.value = idx;
}
function handleDragEnter(idx: number) {
  if (dragging.value) {
    dropIndex.value = idx;
  }
}
function handleDragEnd() {
  if (
    dragging.value &&
    dragIndex.value !== null &&
    dropIndex.value !== null &&
    dragIndex.value !== dropIndex.value
  ) {
    const layers = props.config.layers;
    const moved = layers.splice(dragIndex.value, 1)[0];
    layers.splice(dropIndex.value, 0, moved);
    // **关键：同步重写 zIndex，保持顺序和视觉一致**
    layers.forEach((l: any, i: number) => {
      l.zIndex = i + 1;
    });
    emit('update', JSON.parse(JSON.stringify(props.config)));
  }
  dragging.value = false;
  dragIndex.value = null;
  dropIndex.value = null;
}

// 选中
function handleSelect(layerId: string) {
  emit('select', layerId);
}

// 右键菜单
const menuVisible = ref(false);
const menuPos = ref({ x: 0, y: 0 });
const rightLayer = ref<any>(null);

function handleContextMenu(e: MouseEvent, layer: any) {
  e.preventDefault();
  rightLayer.value = layer;
  menuPos.value = { x: e.clientX, y: e.clientY };
  menuVisible.value = true;
  document.addEventListener('click', closeMenu);
}
function closeMenu() {
  menuVisible.value = false;
  document.removeEventListener('click', closeMenu);
}

// 操作：复制、删除、置顶、置底
function copyLayer() {
  if (!rightLayer.value) return;
  const newLayer = JSON.parse(JSON.stringify(rightLayer.value));
  newLayer.id = `img-${Date.now()}`;
  newLayer.config.x += 20;
  newLayer.config.y += 20;
  props.config.layers.push(newLayer);
  emit('update', JSON.parse(JSON.stringify(props.config)));
  closeMenu();
}
function deleteLayer() {
  if (!rightLayer.value) return;
  const idx = props.config.layers.findIndex(
    (l: any) => l.id === rightLayer.value.id,
  );
  if (idx !== -1) {
    props.config.layers.splice(idx, 1);
    emit('update', JSON.parse(JSON.stringify(props.config)));
  }
  closeMenu();
}
function moveTop() {
  if (!rightLayer.value) return;
  const idx = props.config.layers.findIndex(
    (l: any) => l.id === rightLayer.value.id,
  );
  if (idx !== -1) {
    const layer = props.config.layers.splice(idx, 1)[0];
    props.config.layers.push(layer);
    emit('update', JSON.parse(JSON.stringify(props.config)));
  }
  closeMenu();
}
function moveBottom() {
  if (!rightLayer.value) return;
  const idx = props.config.layers.findIndex(
    (l: any) => l.id === rightLayer.value.id,
  );
  if (idx !== -1) {
    const layer = props.config.layers.splice(idx, 1)[0];
    props.config.layers.unshift(layer);
    emit('update', JSON.parse(JSON.stringify(props.config)));
  }
  closeMenu();
}
</script>

<template>
  <div>
    <h3 class="mb-2 font-bold">图层列表</h3>
    <div
      v-for="(layer, idx) in config.layers"
      :key="layer.id"
      class="mb-2 flex cursor-pointer select-none items-center rounded p-1"
      :class="[
        selectedLayerId === layer.id
          ? 'bg-[#20294a] text-[#3ae0ff]'
          : 'hover:bg-[#23242a]',
        dragging && dropIndex === idx ? 'ring-2 ring-[#3ae0ff]' : '',
      ]"
      draggable="true"
      @dragstart="handleDragStart(idx)"
      @dragenter="handleDragEnter(idx)"
      @dragend="handleDragEnd"
      @drop="handleDragEnd"
      @click="handleSelect(layer.id)"
      @contextmenu="handleContextMenu($event, layer)"
    >
      <img
        v-if="layer.type === 'image'"
        :src="layer.config.src"
        class="mr-2 h-8 w-8 rounded border object-cover"
      />
      <span class="truncate" style="max-width: 100px">{{
        layer.name || `图层-${layer.id.slice(-4)}`
      }}</span>
    </div>
    <!-- 右键菜单 -->
    <ul
      v-if="menuVisible"
      :style="{
        position: 'fixed',
        left: `${menuPos.x}px`,
        top: `${menuPos.y}px`,
        zIndex: 9999,
      }"
      class="w-28 rounded border border-[#3ae0ff] bg-[#23242a] px-2 py-1 text-white shadow"
    >
      <li
        class="cursor-pointer rounded px-2 py-1 hover:bg-[#154c8a]"
        @click="copyLayer"
      >
        复制
      </li>
      <li
        class="cursor-pointer rounded px-2 py-1 hover:bg-[#154c8a]"
        @click="deleteLayer"
      >
        删除
      </li>
      <li
        class="cursor-pointer rounded px-2 py-1 hover:bg-[#154c8a]"
        @click="moveTop"
      >
        置顶
      </li>
      <li
        class="cursor-pointer rounded px-2 py-1 hover:bg-[#154c8a]"
        @click="moveBottom"
      >
        置底
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* 你可以自定义更多样式美化体验 */
</style>
