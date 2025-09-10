<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{ config: any; selectedLayerId?: null | string }>();
const emit = defineEmits(['select', 'update']);

const dragging = ref(false);
const dragIndex = ref<null | number>(null);
const dropIndex = ref<null | number>(null);
function handleDragStart(idx: number) { dragging.value = true; dragIndex.value = idx; }
function handleDragEnter(idx: number) { if (dragging.value) dropIndex.value = idx; }
function handleDragEnd() {
  if (dragging.value && dragIndex.value !== null && dropIndex.value !== null && dragIndex.value !== dropIndex.value) {
    const layers = props.config.layers; const moved = layers.splice(dragIndex.value, 1)[0]; layers.splice(dropIndex.value, 0, moved); layers.forEach((l: any, i: number) => { l.zIndex = i + 1; }); emit('update', JSON.parse(JSON.stringify(props.config)));
  }
  dragging.value = false; dragIndex.value = null; dropIndex.value = null;
}
function handleSelect(layerId: string) { emit('select', layerId); }

const menuVisible = ref(false);
const menuPos = ref({ x: 0, y: 0 });
const rightLayer = ref<any>(null);
function handleContextMenu(e: MouseEvent, layer: any) { e.preventDefault(); rightLayer.value = layer; menuPos.value = { x: e.clientX, y: e.clientY }; menuVisible.value = true; document.addEventListener('click', closeMenu); }
function closeMenu() { menuVisible.value = false; document.removeEventListener('click', closeMenu); }
function copyLayer() { if (!rightLayer.value) return; const newLayer = JSON.parse(JSON.stringify(rightLayer.value)); newLayer.id = `img-${Date.now()}`; newLayer.config.x += 20; newLayer.config.y += 20; props.config.layers.push(newLayer); emit('update', JSON.parse(JSON.stringify(props.config))); closeMenu(); }
function deleteLayer() { if (!rightLayer.value) return; const idx = props.config.layers.findIndex((l: any) => l.id === rightLayer.value.id); if (idx !== -1) { props.config.layers.splice(idx, 1); emit('update', JSON.parse(JSON.stringify(props.config))); } closeMenu(); }
function moveTop() { if (!rightLayer.value) return; const idx = props.config.layers.findIndex((l: any) => l.id === rightLayer.value.id); if (idx !== -1) { const layer = props.config.layers.splice(idx, 1)[0]; props.config.layers.push(layer); emit('update', JSON.parse(JSON.stringify(props.config))); } closeMenu(); }
function moveBottom() { if (!rightLayer.value) return; const idx = props.config.layers.findIndex((l: any) => l.id === rightLayer.value.id); if (idx !== -1) { const layer = props.config.layers.splice(idx, 1)[0]; props.config.layers.unshift(layer); emit('update', JSON.parse(JSON.stringify(props.config))); } closeMenu(); }
</script>

<template>
  <div>
    <h3 style="margin-bottom:8px; font-weight:700;">图层列表</h3>
    <div v-for="(layer, idx) in config.layers" :key="layer.id"
         :style="{
           marginBottom: '8px', display: 'flex', alignItems: 'center', userSelect: 'none', cursor: 'pointer',
           padding: '4px', borderRadius: '6px',
           background: selectedLayerId === layer.id ? '#20294a' : (dragging && dropIndex === idx ? '#1b2a40' : 'transparent'),
           color: selectedLayerId === layer.id ? '#3ae0ff' : '#cde',
           outline: dragging && dropIndex === idx ? '2px solid #3ae0ff' : 'none'
         }"
         draggable="true"
         @dragstart="handleDragStart(idx)" @dragenter="handleDragEnter(idx)" @dragend="handleDragEnd" @drop="handleDragEnd"
         @click="handleSelect(layer.id)" @contextmenu="handleContextMenu($event, layer)">
      <img v-if="layer.type === 'image'" :src="layer.config.src" style="margin-right:8px; width:32px; height:32px; object-fit:cover; border:1px solid #3a415a; border-radius:4px;" />
      <span style="display:inline-block; max-width: 120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ layer.name || `图层-${layer.id.slice(-4)}` }}</span>
    </div>
    <ul v-if="menuVisible" :style="{ position: 'fixed', left: `${menuPos.x}px`, top: `${menuPos.y}px`, zIndex: 9999, width: '180px', borderRadius:'6px', border: '1px solid #3ae0ff', background:'#23242a', color:'#fff', padding:'6px 8px', boxShadow:'0 4px 14px #0008' }">
      <li style="cursor:pointer; border-radius:4px; padding:6px 8px;" @click="copyLayer" onmouseover="this.style.background='#154c8a'" onmouseout="this.style.background='transparent'">复制</li>
      <li style="cursor:pointer; border-radius:4px; padding:6px 8px;" @click="deleteLayer" onmouseover="this.style.background='#154c8a'" onmouseout="this.style.background='transparent'">删除</li>
      <li style="cursor:pointer; border-radius:4px; padding:6px 8px;" @click="moveTop" onmouseover="this.style.background='#154c8a'" onmouseout="this.style.background='transparent'">置顶</li>
      <li style="cursor:pointer; border-radius:4px; padding:6px 8px;" @click="moveBottom" onmouseover="this.style.background='#154c8a'" onmouseout="this.style.background='transparent'">置底</li>
    </ul>
  </div>
</template>

<style scoped>
</style>
