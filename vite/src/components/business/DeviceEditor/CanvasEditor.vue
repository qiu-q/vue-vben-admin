<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { parseSnmpContent } from '@vben/utils';

const props = defineProps<{ config: any; modelValue?: null | string; canvasScale?: number }>();
const emit = defineEmits(['select', 'update']);

const layers = computed(() => Array.isArray(props.config.layers) ? props.config.layers : []);
const selectedId = ref<null | string>(props.modelValue ?? null);
watch(() => props.modelValue, (val) => { selectedId.value = val ?? null; });

const moving = ref(false);
const resizing = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const resizeOrigin = ref({ mouseX: 0, mouseY: 0, width: 0, height: 0 });
const activeLayer = computed(() => layers.value.find((l: any) => l.id === selectedId.value));

let rafId: null | number = null;
let nextPos = { x: 0, y: 0 };
let nextSize = { width: 0, height: 0 };

// 当前画布容器，用于坐标换算
const contentRef = ref<HTMLElement | null>(null);
function toCanvasPoint(e: MouseEvent | DragEvent) {
  const el = contentRef.value;
  const rect = el?.getBoundingClientRect();
  const scale = props.canvasScale ?? 1;
  const left = rect?.left ?? 0;
  const top = rect?.top ?? 0;
  const x = (e.clientX - left) / scale;
  const y = (e.clientY - top) / scale;
  return { x, y, scale };
}

const gridSize = 32;
function drawGrid(canvas: HTMLCanvasElement | null, width: number, height: number) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#3980c6';
  for (let x = 0; x <= width; x += gridSize) {
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 2 * Math.PI); ctx.fill();
    }
  }
}

const rulerMajorStep = 160;
const rulerColor = '#7faaff';
const rulerMinorColor = '#476bb7';

const apiDataMap = ref<Record<string, any>>({});
const apiTimers = ref<Record<string, number>>({});
async function fetchApi(api: any) {
  try {
    const resp = await (api.method === 'POST'
      ? fetch(api.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: api.params || '{}' })
      : fetch(api.url));
    apiDataMap.value[api.id] = await resp.json();
  } catch { apiDataMap.value[api.id] = { error: '请求失败' }; }
}
function cleanupApiTimers() { Object.values(apiTimers.value).forEach((t) => clearInterval(t)); apiTimers.value = {}; }
function startPollingApis() {
  cleanupApiTimers();
  if (!props.config?.apiList) return;
  for (const api of props.config.apiList) {
    fetchApi(api);
    if (api.interval && api.interval > 0) apiTimers.value[api.id] = window.setInterval(() => fetchApi(api), api.interval);
  }
}

function getByKey(obj: any, path: string): any {
  if (!obj) return undefined;
  if (path.includes('.')) { const [h, ...r] = path.split('.'); const n = getByKey(obj, h); return r.length ? getByKey(n, r.join('.')) : n; }
  if (Array.isArray(obj)) { for (const it of obj) { const v = getByKey(it, path); if (v !== undefined) return v; } return undefined; }
  if (obj && typeof obj === 'object') { if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path]; for (const k of Object.keys(obj)) { const v = getByKey(obj[k], path); if (v !== undefined) return v; } }
  return undefined;
}
function getTableData(layer: any) {
  let data: any;
  if (layer.config.apiId) { const apiResp = apiDataMap.value[layer.config.apiId]; if (!apiResp || apiResp.error) return []; data = layer.config.dataKey ? getByKey(apiResp, layer.config.dataKey) : apiResp; }
  else { data = layer.config.data; }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (data && typeof data === 'object') return parseSnmpContent(data);
  return [];
}
function getTableColumns(layer: any) { if (Array.isArray(layer.config.columns) && layer.config.columns.length) return layer.config.columns; const data = getTableData(layer); if (Array.isArray(data) && data.length) return Object.keys(data[0]).map((k) => ({ field: k, title: k })); return [] }
function getTableHeaders(layer: any) { return getTableColumns(layer).map((c: any) => c.title || c.field); }
function getLayerText(layer: any) {
  if (layer.config.apiId && layer.config.dataKey) { const apiResp = apiDataMap.value[layer.config.apiId]; if (apiResp && !apiResp.error) { const val = getByKey(apiResp, layer.config.dataKey); if (val !== undefined && val !== null) return String(val); } }
  return layer.config.text || '';
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
}
function onDragEnter(e: DragEvent) {
  e.preventDefault();
}
function onDrop(e: DragEvent) {
  e.preventDefault();
  const { x, y } = toCanvasPoint(e);
  const url = e.dataTransfer?.getData('image-url');
  const matType = e.dataTransfer?.getData('mat-type') || 'image';
  let layer: any;
  if (matType === 'table') {
    const DEFAULT_TABLE_DATA = [
      { 设备名称: '设备A', 设备: '型号A', 序列号: 'SN001', ip: '192.168.1.10' },
      { 设备名称: '设备B', 设备: '型号B', 序列号: 'SN002', ip: '192.168.1.11' },
      { 设备名称: '设备C', 设备: '型号C', 序列号: 'SN003', ip: '192.168.1.12' },
      { 设备名称: '设备D', 设备: '型号D', 序列号: 'SN004', ip: '192.168.1.13' },
      { 设备名称: '设备E', 设备: '型号E', 序列号: 'SN005', ip: '192.168.1.14' },
    ];
    layer = { id: `table-${Date.now()}`, type: 'table', zIndex: layers.value.length + 1, name: `表格-${Date.now().toString().slice(-4)}`, config: { x: x - 40, y: y - 20, width: 160, height: 120, rotate: 0, data: DEFAULT_TABLE_DATA, apiId: '', dataKey: '', scrollY: false } };
  } else if (matType === 'card') {
    layer = { id: `card-${Date.now()}`, type: 'card', zIndex: layers.value.length + 1, name: `卡片-${Date.now().toString().slice(-4)}`, config: { x: x - 40, y: y - 20, width: 160, height: 60, rotate: 0, text: '文本', fontSize: 14, color: '#ffffff', background: '#2d323c', apiId: '', dataKey: '' } };
  } else if (url) {
    if (matType === 'port') {
      layer = { id: `port-${Date.now()}`, type: 'port', zIndex: layers.value.length + 1, name: `端口-${Date.now().toString().slice(-4)}`, config: { x: x - 20, y: y - 20, width: 32, height: 32, src: url, rotate: 0, dynamic: false, dataSource: null, statusMap: {}, apiId: '', dataKey: '' } };
    } else if (matType === 'port-adv') {
      layer = { id: `port-adv-${Date.now()}`, type: 'port-adv', zIndex: layers.value.length + 1, name: `高级端口-${Date.now().toString().slice(-4)}`, config: { x: x - 20, y: y - 20, width: 32, height: 32, src: url, rotate: 0, apiId: '', portDataKey: '', portKey: '', statusMapping: {}, usePush: false, pushService: '' } };
    } else {
      layer = { id: `img-${Date.now()}`, type: 'image', zIndex: layers.value.length + 1, config: { x: x - 40, y: y - 40, width: 120, height: 80, src: url, rotate: 0, apiId: '', dataKey: '' } };
    }
  }
  if (layer) { props.config.layers.push(layer); selectedId.value = layer.id; emit('select', layer.id); emit('update', JSON.parse(JSON.stringify(props.config))); }
}

function selectLayer(id: string) { if (moving.value || resizing.value) return; selectedId.value = id; emit('select', id); }

const hoverGuide = ref({ x: null as null | number, y: null as null | number });
function onMouseDownLayer(e: MouseEvent, layer: any) {
  if (resizing.value) return;
  selectLayer(layer.id);
  moving.value = true;
  const p = toCanvasPoint(e);
  dragOffset.value = { x: p.x - layer.config.x, y: p.y - layer.config.y };
  nextPos = { x: layer.config.x, y: layer.config.y };
  document.body.style.cursor = 'move';
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  e.stopPropagation();
}
function onMove(e: MouseEvent) {
  if (moving.value && activeLayer.value) {
    const p = toCanvasPoint(e);
    const newX = p.x - dragOffset.value.x; const newY = p.y - dragOffset.value.y;
    hoverGuide.value.x = Math.abs(newX % gridSize) < 8 ? Math.round(newX / gridSize) * gridSize : null;
    hoverGuide.value.y = Math.abs(newY % gridSize) < 8 ? Math.round(newY / gridSize) * gridSize : null;
    nextPos = { x: hoverGuide.value.x ?? newX, y: hoverGuide.value.y ?? newY };
  }
  if (resizing.value && activeLayer.value) {
    const p = toCanvasPoint(e);
    const dx = (p.x - resizeOrigin.value.mouseX);
    const dy = (p.y - resizeOrigin.value.mouseY);
    nextSize = { width: Math.max(20, resizeOrigin.value.width + dx), height: Math.max(20, resizeOrigin.value.height + dy) };
  }
  if (!rafId) rafId = requestAnimationFrame(applyFrame);
}
function applyFrame() {
  rafId = null;
  if (activeLayer.value) {
    if (moving.value) { activeLayer.value.config.x = nextPos.x; activeLayer.value.config.y = nextPos.y; emit('update', JSON.parse(JSON.stringify(props.config))); }
    if (resizing.value) { activeLayer.value.config.width = nextSize.width; activeLayer.value.config.height = nextSize.height; emit('update', JSON.parse(JSON.stringify(props.config))); }
  }
}
function onUp() {
  moving.value = false; resizing.value = false; document.body.style.cursor = 'default';
  window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
  hoverGuide.value = { x: null, y: null };
}

function onResizeMouseDown(e: MouseEvent, layer: any) {
  selectLayer(layer.id);
  resizing.value = true;
  const p = toCanvasPoint(e);
  resizeOrigin.value = { mouseX: p.x, mouseY: p.y, width: layer.config.width, height: layer.config.height };
  nextSize = { width: layer.config.width, height: layer.config.height };
  document.body.style.cursor = 'se-resize';
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  e.stopPropagation();
}

onBeforeUnmount(() => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); if (rafId) cancelAnimationFrame(rafId); cleanupApiTimers(); });

const bgCanvas = ref<HTMLCanvasElement | null>(null);
watch(() => [props.config.width, props.config.height], () => nextTick(() => drawGrid(bgCanvas.value, props.config.width, props.config.height)), { immediate: true });
onMounted(() => { startPollingApis(); });
watch(() => props.config.apiList, () => startPollingApis(), { immediate: true, deep: true });
</script>

<template>
  <div class="canvas-editor-wrap relative" :style="{ background: '#23242a', borderRadius: '8px', width: `${config.width + 32}px`, height: `${config.height + 32}px` }">
    <div class="canvas-ruler-x">
      <svg :width="config.width" height="32">
        <g v-for="i in Math.ceil(config.width / gridSize)" :key="i">
          <line :x1="i * gridSize" y1="0" :x2="i * gridSize" :y2="i % (rulerMajorStep / gridSize) === 0 ? 24 : 12" :stroke="i % (rulerMajorStep / gridSize) === 0 ? rulerColor : rulerMinorColor" stroke-width="1" />
          <text v-if="i % (rulerMajorStep / gridSize) === 0" :x="i * gridSize + 2" y="22" fill="#7faaff" font-size="12">{{ i * gridSize }}</text>
        </g>
      </svg>
    </div>
    <div class="canvas-ruler-y">
      <svg width="32" :height="config.height">
        <g v-for="i in Math.ceil(config.height / gridSize)" :key="i">
          <line x1="0" :y1="i * gridSize" :x2="i % (rulerMajorStep / gridSize) === 0 ? 24 : 12" :y2="i * gridSize" :stroke="i % (rulerMajorStep / gridSize) === 0 ? rulerColor : rulerMinorColor" stroke-width="1" />
          <text v-if="i % (rulerMajorStep / gridSize) === 0" x="2" :y="i * gridSize + 12" fill="#7faaff" font-size="12">{{ i * gridSize }}</text>
        </g>
      </svg>
    </div>

    <div ref="contentRef" class="canvas-content" :style="{ position: 'absolute', left: '32px', top: '32px', width: `${config.width}px`, height: `${config.height}px` }" @dragenter="onDragEnter" @dragover="onDragOver" @drop="onDrop">
      <canvas ref="bgCanvas" class="bg-grid" :width="config.width" :height="config.height" style="position:absolute; left:0; top:0; width: 100%; height: 100%; z-index: 0; pointer-events: none"></canvas>
      <template v-for="layer in layers" :key="layer.id">
        <img v-if="layer.type === 'image' || layer.type === 'port' || layer.type === 'port-adv'" :src="layer.config.src" :style="{ position:'absolute', left: `${layer.config.x}px`, top: `${layer.config.y}px`, width: `${layer.config.width}px`, height: `${layer.config.height}px`, zIndex: layer.zIndex, transform: `rotate(${layer.config.rotate || 0}deg)`, transformOrigin: 'center center', outline: selectedId === layer.id ? '2px solid #1976d2' : '', boxShadow: selectedId === layer.id ? '0 0 0 3px #90caf9aa' : '' }" @mousedown="onMouseDownLayer($event, layer)" @click.stop="selectLayer(layer.id)" draggable="false" @dragstart.prevent />
        <div v-else-if="layer.type === 'table'" class="text-white" :style="{ position:'absolute', left: `${layer.config.x}px`, top: `${layer.config.y}px`, width: `${layer.config.width}px`, height: `${layer.config.height}px`, zIndex: layer.zIndex, background:'#2d323c', border:'1px solid #444', fontSize: layer.config.fontSize || '11px', transform: `rotate(${layer.config.rotate || 0}deg)`, transformOrigin: 'center center', outline: selectedId === layer.id ? '2px solid #1976d2' : '', boxShadow: selectedId === layer.id ? '0 0 0 3px #90caf9aa' : '', overflowX: 'auto', overflowY: layer.config.scrollY ? 'auto' : 'hidden' }" @mousedown="onMouseDownLayer($event, layer)" @click.stop="selectLayer(layer.id)" draggable="false" @dragstart.prevent>
          <table class="w-full border-collapse">
            <thead v-if="getTableColumns(layer).length" :style="{ lineHeight: layer.config.headerSize || undefined }">
              <tr>
                <th v-for="col in getTableColumns(layer)" :key="col.field" class="border px-1 py-0.5">{{ col.title || col.field }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rIdx) in getTableData(layer)" :key="rIdx">
                <td v-for="col in getTableColumns(layer)" :key="col.field" class="border px-1 py-0.5">{{ row[col.field] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else-if="layer.type === 'card'" :style="{ position:'absolute', display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #444', left: `${layer.config.x}px`, top: `${layer.config.y}px`, width: `${layer.config.width}px`, height: `${layer.config.height}px`, zIndex: layer.zIndex, background: layer.config.background, color: layer.config.color, fontSize: layer.config.fontSize + 'px', transform: `rotate(${layer.config.rotate || 0}deg)`, transformOrigin: 'center center', outline: selectedId === layer.id ? '2px solid #1976d2' : '', boxShadow: selectedId === layer.id ? '0 0 0 3px #90caf9aa' : '' }" @mousedown="onMouseDownLayer($event, layer)" @click.stop="selectLayer(layer.id)" draggable="false" @dragstart.prevent>{{ getLayerText(layer) }}</div>
        <div v-if="selectedId === layer.id && (layer.type === 'image' || layer.type === 'port' || layer.type === 'port-adv' || layer.type === 'table' || layer.type === 'card')" class="resize-handle" :style="{ left: `${layer.config.x + layer.config.width - 10}px`, top: `${layer.config.y + layer.config.height - 10}px` }" @mousedown="onResizeMouseDown($event, layer)"></div>
      </template>
      <div v-if="hoverGuide.x !== null" :style="{ position: 'absolute', left: `${hoverGuide.x}px`, top: 0, height: `${config.height}px`, width: '1.5px', background: '#3091ff', zIndex: 20, opacity: 0.7 }"></div>
      <div v-if="hoverGuide.y !== null" :style="{ position: 'absolute', top: `${hoverGuide.y}px`, left: 0, width: `${config.width}px`, height: '1.5px', background: '#3091ff', zIndex: 20, opacity: 0.7 }"></div>
    </div>
  </div>
</template>

<style scoped>
.canvas-editor-wrap { user-select: none; position: relative; overflow: visible; }
.canvas-ruler-x { position: absolute; left: 32px; top: 0; right: 0; height: 32px; z-index: 10; background: #23242a; border-radius: 8px 8px 0 0; }
.canvas-ruler-y { position: absolute; left: 0; top: 32px; width: 32px; bottom: 0; z-index: 10; background: #23242a; border-radius: 0 0 0 8px; }
.canvas-content { background: transparent; border-radius: 0 0 8px 0; }
.bg-grid { pointer-events: none; }
.resize-handle { position: absolute; width: 18px; height: 18px; background: #fff; border: 2px solid #1976d2; border-radius: 2px; cursor: se-resize; z-index: 100; box-shadow: 0 0 2px #1976d299; }
</style>
