<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps<{
  config: any;
  modelValue?: null | string;
}>();
const emit = defineEmits(['select', 'update']);

const layers = computed(() =>
  Array.isArray(props.config.layers) ? props.config.layers : [],
);
const selectedId = ref<null | string>(props.modelValue ?? null);

watch(
  () => props.modelValue,
  (val) => {
    selectedId.value = val ?? null;
  },
);

// 拖动和缩放状态
const moving = ref(false);
const resizing = ref(false);
const dragOffset = ref({ x: 0, y: 0 });
const resizeOrigin = ref({ mouseX: 0, mouseY: 0, width: 0, height: 0 });
const activeLayer = computed(() =>
  layers.value.find((l: any) => l.id === selectedId.value),
);

let rafId: null | number = null;
let nextPos = { x: 0, y: 0 };
let nextSize = { width: 0, height: 0 };

// --------- 网格与刻度 ---------
const gridSize = 32;

function drawGrid(
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);
  // 画网格点
  ctx.fillStyle = '#3980c6';
  for (let x = 0; x <= width; x += gridSize) {
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

// 刻度
const rulerMajorStep = 160;
const rulerColor = '#7faaff';
const rulerMinorColor = '#476bb7';

// --------- 拖拽进画布 ---------
function onDragOver(e: DragEvent) {
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'copy';
}
function onDrop(e: DragEvent) {
  e.preventDefault();
  // 画布左上的实际 offset（考虑刻度的 32px 偏移）
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const url = e.dataTransfer?.getData('image-url');
  const matType = e.dataTransfer?.getData('mat-type') || 'image'; // 关键：识别类型
  let layer;
  if (matType === 'table') {
    const DEFAULT_TABLE_DATA = [
      { 设备名称: '设备A', 设备: '型号A', 序列号: 'SN001', ip: '192.168.1.10' },
      { 设备名称: '设备B', 设备: '型号B', 序列号: 'SN002', ip: '192.168.1.11' },
      { 设备名称: '设备C', 设备: '型号C', 序列号: 'SN003', ip: '192.168.1.12' },
      { 设备名称: '设备D', 设备: '型号D', 序列号: 'SN004', ip: '192.168.1.13' },
      { 设备名称: '设备E', 设备: '型号E', 序列号: 'SN005', ip: '192.168.1.14' },
    ];
    layer = {
      id: `table-${Date.now()}`,
      type: 'table',
      zIndex: layers.value.length + 1,
      name: `表格-${Date.now().toString().slice(-4)}`,
      config: {
        x: x - 40,
        y: y - 20,
        width: 160,
        height: 120,
        data: DEFAULT_TABLE_DATA,
        apiId: '',
        scrollY: false,
      },
    };
  } else if (matType === 'card') {
    layer = {
      id: `card-${Date.now()}`,
      type: 'card',
      zIndex: layers.value.length + 1,
      name: `卡片-${Date.now().toString().slice(-4)}`,
      config: {
        x: x - 40,
        y: y - 20,
        width: 160,
        height: 60,
        text: '文本',
        fontSize: 14,
        color: '#ffffff',
        background: '#2d323c',
      },
    };
  } else if (url) {
    if (matType === 'port') {
      // 拖入端口组件
      layer = {
        id: `port-${Date.now()}`,
        type: 'port',
        zIndex: layers.value.length + 1,
        name: `端口-${Date.now().toString().slice(-4)}`,
        config: {
          x: x - 20,
          y: y - 20,
          width: 32,
          height: 32,
          src: url,
          // 下面可扩展端口相关配置
          dynamic: false, // 默认不开启动态端口
          dataSource: null,
          statusMap: {},
        },
      };
    } else {
      // 普通图片
      layer = {
        id: `img-${Date.now()}`,
        type: 'image',
        zIndex: layers.value.length + 1,
        config: {
          x: x - 40,
          y: y - 40,
          width: 120,
          height: 80,
          src: url,
        },
      };
    }
  }
  if (layer) {
    props.config.layers.push(layer);
    emit('update', JSON.parse(JSON.stringify(props.config)));
  }
}

// --------- 选中 ---------
function selectLayer(id: string) {
  if (moving.value || resizing.value) return; // 拖动缩放时不能切换
  selectedId.value = id;
  emit('select', id);
}

// --------- 拖动图层（带辅助线） ---------
const hoverGuide = ref({ x: null as null | number, y: null as null | number });

function onMouseDownLayer(e: MouseEvent, layer: any) {
  if (resizing.value) return;
  selectLayer(layer.id);
  moving.value = true;
  dragOffset.value = {
    x: e.clientX - layer.config.x,
    y: e.clientY - layer.config.y,
  };
  nextPos = { x: layer.config.x, y: layer.config.y };
  document.body.style.cursor = 'move';
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  e.stopPropagation();
}

function onMove(e: MouseEvent) {
  if (moving.value && activeLayer.value) {
    const newX = e.clientX - dragOffset.value.x;
    const newY = e.clientY - dragOffset.value.y;

    // 提示靠近整数刻度线
    hoverGuide.value.x =
      Math.abs(newX % gridSize) < 8
        ? Math.round(newX / gridSize) * gridSize
        : null;
    hoverGuide.value.y =
      Math.abs(newY % gridSize) < 8
        ? Math.round(newY / gridSize) * gridSize
        : null;

    nextPos.x = newX;
    nextPos.y = newY;
    if (!rafId) {
      rafId = requestAnimationFrame(updateLayerPosition);
    }
  }
  if (resizing.value && activeLayer.value) {
    const dx = e.clientX - resizeOrigin.value.mouseX;
    const dy = e.clientY - resizeOrigin.value.mouseY;
    nextSize.width = Math.max(10, resizeOrigin.value.width + dx);
    nextSize.height = Math.max(10, resizeOrigin.value.height + dy);
    if (!rafId) {
      rafId = requestAnimationFrame(updateLayerSize);
    }
  }
}

function updateLayerPosition() {
  if (activeLayer.value) {
    activeLayer.value.config.x = nextPos.x;
    activeLayer.value.config.y = nextPos.y;
  }
  rafId = null;
}

function updateLayerSize() {
  if (activeLayer.value) {
    activeLayer.value.config.width = nextSize.width;
    activeLayer.value.config.height = nextSize.height;
  }
  rafId = null;
}

function onUp() {
  if (moving.value || resizing.value) {
    emit('update', JSON.parse(JSON.stringify(props.config)));
  }
  moving.value = false;
  resizing.value = false;
  hoverGuide.value.x = null;
  hoverGuide.value.y = null;
  document.body.style.cursor = '';
  window.removeEventListener('mousemove', onMove);
  window.removeEventListener('mouseup', onUp);
}

// --------- 缩放 ---------
function onResizeMouseDown(e: MouseEvent, layer: any) {
  selectLayer(layer.id);
  resizing.value = true;
  resizeOrigin.value = {
    mouseX: e.clientX,
    mouseY: e.clientY,
    width: layer.config.width,
    height: layer.config.height,
  };
  nextSize = { width: layer.config.width, height: layer.config.height };
  document.body.style.cursor = 'se-resize';
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  e.stopPropagation();
}

// 清理事件
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMove);
  window.removeEventListener('mouseup', onUp);
  if (rafId) cancelAnimationFrame(rafId);
});

// 画布背景（网格点）用 canvas 提高性能
const bgCanvas = ref<HTMLCanvasElement | null>(null);
watch(
  () => [props.config.width, props.config.height],
  () =>
    nextTick(() =>
      drawGrid(bgCanvas.value, props.config.width, props.config.height),
    ),
  { immediate: true },
);
</script>

<template>
  <div
    class="canvas-editor-wrap relative"
    :style="{
      background: '#23242a',
      borderRadius: '8px',
      width: `${config.width + 32}px`,
      height: `${config.height + 32}px`,
    }"
  >
    <!-- 横向刻度 -->
    <div class="canvas-ruler-x">
      <svg :width="config.width" height="32">
        <g v-for="i in Math.ceil(config.width / gridSize)" :key="i">
          <line
            :x1="i * gridSize"
            y1="0"
            :x2="i * gridSize"
            :y2="i % (rulerMajorStep / gridSize) === 0 ? 24 : 12"
            :stroke="
              i % (rulerMajorStep / gridSize) === 0
                ? rulerColor
                : rulerMinorColor
            "
            stroke-width="1"
          />
          <text
            v-if="i % (rulerMajorStep / gridSize) === 0"
            :x="i * gridSize + 2"
            y="22"
            fill="#7faaff"
            font-size="12"
          >
            {{ i * gridSize }}
          </text>
        </g>
      </svg>
    </div>
    <!-- 纵向刻度 -->
    <div class="canvas-ruler-y">
      <svg width="32" :height="config.height">
        <g v-for="i in Math.ceil(config.height / gridSize)" :key="i">
          <line
            x1="0"
            :y1="i * gridSize"
            :x2="i % (rulerMajorStep / gridSize) === 0 ? 24 : 12"
            :y2="i * gridSize"
            :stroke="
              i % (rulerMajorStep / gridSize) === 0
                ? rulerColor
                : rulerMinorColor
            "
            stroke-width="1"
          />
          <text
            v-if="i % (rulerMajorStep / gridSize) === 0"
            x="2"
            :y="i * gridSize + 12"
            fill="#7faaff"
            font-size="12"
          >
            {{ i * gridSize }}
          </text>
        </g>
      </svg>
    </div>

    <!-- 画布内容 -->
    <div
      class="canvas-content"
      :style="{
        position: 'absolute',
        left: '32px',
        top: '32px',
        width: `${config.width}px`,
        height: `${config.height}px`,
      }"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <canvas
        ref="bgCanvas"
        class="bg-grid absolute left-0 top-0"
        :width="config.width"
        :height="config.height"
        style="width: 100%; height: 100%; z-index: 0; pointer-events: none"
      ></canvas>
      <template v-for="layer in layers" :key="layer.id">
        <img
          v-if="layer.type === 'image' || layer.type === 'port'"
          :src="layer.config.src"
          class="absolute transition-all duration-75"
          :style="{
            left: `${layer.config.x}px`,
            top: `${layer.config.y}px`,
            width: `${layer.config.width}px`,
            height: `${layer.config.height}px`,
            zIndex: layer.zIndex,
            outline: selectedId === layer.id ? '2px solid #1976d2' : '',
            boxShadow: selectedId === layer.id ? '0 0 0 3px #90caf9aa' : '',
          }"
          @mousedown="onMouseDownLayer($event, layer)"
          @click.stop="selectLayer(layer.id)"
          draggable="false"
          @dragstart.prevent
        />
        <!-- 表格组件 -->
        <div
          v-else-if="layer.type === 'table'"
          class="absolute text-xs text-white bg-[#2d323c] border border-[#444]"
          :style="{
            left: `${layer.config.x}px`,
            top: `${layer.config.y}px`,
            width: `${layer.config.width}px`,
            height: `${layer.config.height}px`,
            zIndex: layer.zIndex,
            outline: selectedId === layer.id ? '2px solid #1976d2' : '',
            boxShadow: selectedId === layer.id ? '0 0 0 3px #90caf9aa' : '',
            overflowX: 'auto',
            overflowY: layer.config.scrollY ? 'auto' : 'hidden',
          }"
          @mousedown="onMouseDownLayer($event, layer)"
          @click.stop="selectLayer(layer.id)"
          draggable="false"
          @dragstart.prevent
        >
          <table class="w-full border-collapse text-[11px]">
            <thead v-if="Array.isArray(layer.config.data) && layer.config.data.length">
              <tr>
                <th
                  v-for="key in Object.keys(layer.config.data[0])"
                  :key="key"
                  class="border px-1 py-0.5"
                >
                  {{ key }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, rIdx) in layer.config.data"
                :key="rIdx"
              >
                <td
                  v-for="key in Object.keys(layer.config.data[0] || {})"
                  :key="key"
                  class="border px-1 py-0.5"
                >
                  {{ row[key] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- 卡片组件 -->
        <div
          v-else-if="layer.type === 'card'"
          class="absolute flex items-center justify-center border border-[#444]"
          :style="{
            left: `${layer.config.x}px`,
            top: `${layer.config.y}px`,
            width: `${layer.config.width}px`,
            height: `${layer.config.height}px`,
            zIndex: layer.zIndex,
            background: layer.config.background,
            color: layer.config.color,
            fontSize: layer.config.fontSize + 'px',
            outline: selectedId === layer.id ? '2px solid #1976d2' : '',
            boxShadow: selectedId === layer.id ? '0 0 0 3px #90caf9aa' : '',
          }"
          @mousedown="onMouseDownLayer($event, layer)"
          @click.stop="selectLayer(layer.id)"
          draggable="false"
          @dragstart.prevent
        >
          {{ layer.config.text }}
        </div>
        <!-- 右下角缩放点 -->
        <div
          v-if="
            selectedId === layer.id &&
            (layer.type === 'image' || layer.type === 'port' || layer.type === 'table' || layer.type === 'card')
          "
          class="resize-handle"
          :style="{
            left: `${layer.config.x + layer.config.width - 10}px`,
            top: `${layer.config.y + layer.config.height - 10}px`,
          }"
          @mousedown="onResizeMouseDown($event, layer)"
        ></div>
      </template>
      <!-- 拖动辅助线 -->
      <div
        v-if="hoverGuide.x !== null"
        :style="{
          position: 'absolute',
          left: `${hoverGuide.x}px`,
          top: 0,
          height: `${config.height}px`,
          width: '1.5px',
          background: '#3091ff',
          zIndex: 20,
          opacity: 0.7,
        }"
      ></div>
      <div
        v-if="hoverGuide.y !== null"
        :style="{
          position: 'absolute',
          top: `${hoverGuide.y}px`,
          left: 0,
          width: `${config.width}px`,
          height: '1.5px',
          background: '#3091ff',
          zIndex: 20,
          opacity: 0.7,
        }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.canvas-editor-wrap {
  user-select: none;
  position: relative;
  overflow: visible;
}
.canvas-ruler-x {
  position: absolute;
  left: 32px;
  top: 0;
  right: 0;
  height: 32px;
  z-index: 10;
  background: #23242a;
  border-radius: 8px 8px 0 0;
}
.canvas-ruler-y {
  position: absolute;
  left: 0;
  top: 32px;
  width: 32px;
  bottom: 0;
  z-index: 10;
  background: #23242a;
  border-radius: 0 0 0 8px;
}
.canvas-content {
  background: transparent;
  border-radius: 0 0 8px 0;
}
.bg-grid {
  pointer-events: none;
}
.resize-handle {
  position: absolute;
  width: 18px;
  height: 18px;
  background: #fff;
  border: 2px solid #1976d2;
  border-radius: 2px;
  cursor: se-resize;
  z-index: 100;
  box-shadow: 0 0 2px #1976d299;
}
</style>
