<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';

import html2canvas from 'html2canvas';

// === Cabinet constants ===
const U_HEIGHT = 50; // px per U  (adjust slot height for clearer visibility)

import CanvasRightPanel from './components/CanvasRightPanel.vue';
import ExternalLines from './components/ExternalLines.vue';
import InternalLines from './components/InternalLines.vue';
import TopoToolbar from './components/TopoToolbar.vue';

interface PortLayer {
  id: string;
  type: 'port';
  config: {
    height: number;
    src: string;
    width: number;
    x: number;
    y: number;
  };
}
interface ImageLayer {
  id: string;
  type: 'image';
  config: {
    height: number;
    src: string;
    width: number;
    x: number;
    y: number;
  };
}
interface DeviceTemplate {
  deviceId: string;
  width: number;
  height: number;
  layers: (ImageLayer | PortLayer)[];
  materialsTree: any[];
}

// ========= Runtime Device =========
interface RuntimeDevice extends DeviceTemplate {
  _uuid: string;
  position: { x: number; y: number };
  /** 宽度缩放 */
  scaleX?: number;
  /** 高度缩放 */
  scaleY?: number;
  /** 所属机柜 UUID；顶层设备为 null */
  parentCabinetId?: string | null;
}

// ====== Cabinet Template ======
function createCabinetTemplate(): DeviceTemplate {
  return {
    deviceId: 'CABINET-42U',
    width: 480,
    height: 42 * U_HEIGHT,
    layers: [],              // 纯结构化渲染，无背景图层
    materialsTree: [],
  };
}

interface TopoConfig {
  devices: {
    _uuid: string;
    deviceId: string;
    position: { x: number; y: number };
    scaleX?: number;
    scaleY?: number;
    parentCabinetId?: string | null;
  }[];
  edges: any[];
  saveTime?: number;
  cover?: string;
}

// 状态
const allDeviceOptions = ref<DeviceTemplate[]>([]);
const devicesOnCanvas = ref<RuntimeDevice[]>([]);
const selectedDeviceId = ref<string>('');
const edges = ref<
  {
    external?: boolean;
    source: { devUUid: string; portId: string };
    target: { devUUid: string; portId: string } | { externalRoom: string };
  }[]
>([]);
const drawingLine = ref<null | {
  devUUid: string;
  from: { x: number; y: number };
  portId: string;
}>(null);
const mousePos = ref<null | { x: number; y: number }>(null);
const selectedPort = ref<null | { devUUid: string; portId: string }>(null);
const dragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const dragDevice = ref<any>(null);
const canvasRef = ref<HTMLElement | null>(null);
const canvasDomRef = ref<HTMLElement | null>(null);

// 画布保存
const topoConfigs = ref<Record<string, TopoConfig>>({});
const newConfigName = ref('');
const TOPO_CONFIGS_KEY = 'topo_configs_store';

// 连线模式
const connectMode = ref<'external' | 'internal'>('internal');
const pendingExternalRoom = ref<null | string>(null);
// 当前拖拽指针悬停的机柜 _uuid
const hoveredCabinetId = ref<string | null>(null);
// 当前悬停机柜中的 U 索引(0 = 顶部 U42)
const hoveredUIndex = ref<number | null>(null);
// 该设备当前将占用的 U 索引集合
const hoveredUSlots = ref<number[]>([]);

// 工具函数
function deepClone<T>(obj: T): T {
  try {
    return structuredClone(obj);
  } catch {
    return JSON.parse(JSON.stringify(obj));
  }
}
function bezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const dx = Math.abs(to.x - from.x);
  const c1x = from.x + dx / 2;
  const c2x = to.x - dx / 2;
  return `M${from.x},${from.y} C${c1x},${from.y} ${c2x},${to.y} ${to.x},${to.y}`;
}

function saveConfigsToStorage() {
  localStorage.setItem(TOPO_CONFIGS_KEY, JSON.stringify(topoConfigs.value));
}
function loadConfigsFromStorage() {
  try {
    const raw = localStorage.getItem(TOPO_CONFIGS_KEY);
    if (raw) topoConfigs.value = JSON.parse(raw);
  } catch {}
}

async function saveCurrentCanvasToConfigs() {
  let name = newConfigName.value.trim();
  if (!name) {
    name = window.prompt('请输入画布名称：') || '';
    if (!name) return;
  }
  await nextTick();
  let coverBase64 = '';
  if (canvasDomRef.value) {
    try {
      const canvas = await html2canvas(canvasDomRef.value, {
        backgroundColor: null,
        useCORS: true,
        allowTaint: false,
        crossOrigin: 'anonymous',
      });
      coverBase64 = canvas.toDataURL('image/png');
    } catch (error) {
      console.warn('画布截图失败', error);
    }
  }
  const config: TopoConfig = {
    devices: devicesOnCanvas.value.map((dev) => ({
      deviceId: dev.deviceId,
      _uuid: dev._uuid,
      position: dev.position,
      scaleX: dev.scaleX,
      scaleY: dev.scaleY,
      parentCabinetId: dev.parentCabinetId,
    })),
    edges: deepClone(edges.value),
    saveTime: Date.now(),
    cover: coverBase64,
  };
  topoConfigs.value[name] = config;
  saveConfigsToStorage();
  newConfigName.value = '';
  alert(`画布【${name}】已保存`);

  // 清空当前画布方便继续新建
  devicesOnCanvas.value = [];
  edges.value = [];
}

function restoreConfigToCanvas(config: TopoConfig) {
  devicesOnCanvas.value = config.devices.map((devCfg: any) => {
    const tmpl = allDeviceOptions.value.find(
      (t) => t.deviceId === devCfg.deviceId,
    );
    if (!tmpl) throw new Error(`找不到模板: ${devCfg.deviceId}`);
    const dev = deepClone(tmpl);
    dev._uuid = devCfg._uuid;
    dev.position = devCfg.position;
    dev.scaleX = devCfg.scaleX ?? 1;
    dev.scaleY = devCfg.scaleY ?? 1;
    dev.parentCabinetId = devCfg.parentCabinetId ?? null;
    return dev;
  });
  edges.value = deepClone(config.edges);
}

function removeConfig(name: string) {
  if (!window.confirm(`确认删除画布【${name}】吗？`)) return;
  delete topoConfigs.value[name];
  saveConfigsToStorage();
}

function exportOneConfig(name: string) {
  const str = JSON.stringify(topoConfigs.value[name], null, 2);
  const blob = new Blob([str], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function exportAllConfigs() {
  const str = JSON.stringify(topoConfigs.value, null, 2);
  const blob = new Blob([str], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `all_topo_configs.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importConfigs(data: any) {
  if (data && data.devices && data.edges) {
    const name = window.prompt('导入的画布名称', `imported_${Date.now()}`) || '';
    if (name) topoConfigs.value[name] = data as TopoConfig;
  } else if (typeof data === 'object') {
    Object.assign(topoConfigs.value, data);
  } else {
    window.alert('未知的配置格式');
    return;
  }
  saveConfigsToStorage();
}

// API: 获取全部设备模板
async function fetchDevices() {
  const API = '/api/jx-device/Device/list?pageSize=0';
  try {
    const resp = await fetch(API);
    const json = await resp.json();
    if (json.code !== 200) {
      console.error('获取设备列表失败', json.msg);
      return;
    }
    const rows = Array.isArray(json.rows) ? json.rows : [];
    allDeviceOptions.value = rows.map((row: any) => {
      let cfg: any = {};
      try {
        cfg = JSON.parse(row.deviceJson ?? '{}');
      } catch {}
      return {
        deviceId: String(row.deviceId),
        width: cfg.width ?? 1920,
        height: cfg.height ?? 1080,
        layers: Array.isArray(cfg.layers) ? cfg.layers : [],
        materialsTree: Array.isArray(cfg.materialsTree)
          ? cfg.materialsTree
          : [],
      } as DeviceTemplate;
    });

    // 确保机柜模板存在
    if (!allDeviceOptions.value.find((d) => d.deviceId === 'CABINET-42U')) {
      allDeviceOptions.value.push(createCabinetTemplate());
    }

    if (allDeviceOptions.value.length > 0)
      selectedDeviceId.value = allDeviceOptions.value[0].deviceId;
  } catch (error) {
    console.error('fetchDevices error', error);
  }
}

function addDevice() {
  console.log('addDevice');

  const tmpl = allDeviceOptions.value.find(
    (d) => d.deviceId === selectedDeviceId.value,
  );
  console.log(tmpl)
  if (!tmpl) return;
  const uuid = `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const newDev = deepClone(tmpl) as RuntimeDevice;
  newDev._uuid = uuid;
  newDev.position = {
    x: Math.floor(60 + Math.random() * 500),
    y: Math.floor(60 + Math.random() * 300),
  };
  newDev.scaleX = 1;
  newDev.scaleY = 1;
  newDev.parentCabinetId = null;
  devicesOnCanvas.value.push(newDev);
}

// 设备拖拽
function startDragDevice(dev: any, evt: MouseEvent) {
  dragging.value = true;
  dragDevice.value = dev;
  dragStart.value = {
    x: evt.clientX - dev.position.x,
    y: evt.clientY - dev.position.y,
  };
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', stopDragDevice);
}
function onDragMove(e: MouseEvent) {
  if (!dragging.value || !dragDevice.value) return;
  let nx = e.clientX - dragStart.value.x;
  let ny = e.clientY - dragStart.value.y;
  nx = Math.max(0, Math.min(nx, 1100));
  ny = Math.max(0, Math.min(ny, 700));
  // 如果拖动的是机柜，同步移动其子设备
  if (dragDevice.value && dragDevice.value.deviceId === 'CABINET-42U') {
    const cab = dragDevice.value as RuntimeDevice;
    const dx = nx - cab.position.x;
    const dy = ny - cab.position.y;
    devicesOnCanvas.value.forEach((dev) => {
      if (dev.parentCabinetId === cab._uuid) {
        dev.position.x += dx;
        dev.position.y += dy;
      }
    });
  }
  dragDevice.value.position.x = nx;
  dragDevice.value.position.y = ny;
  // 计算当前悬停的机柜（仅拖普通设备时）
  if (dragDevice.value && dragDevice.value.deviceId !== 'CABINET-42U') {
    const device = dragDevice.value as RuntimeDevice;
    const devPos = device.position;

    const cab = devicesOnCanvas.value.find(
      (d) =>
        d.deviceId === 'CABINET-42U' &&
        devPos.x >= d.position.x &&
        devPos.x <= d.position.x + d.width &&
        devPos.y >= d.position.y &&
        devPos.y <= d.position.y + d.height,
    ) as RuntimeDevice | undefined;

    hoveredCabinetId.value = cab ? cab._uuid : null;

    if (cab) {
      const relY = devPos.y - cab.position.y;
      const startIdx = Math.max(0, Math.min(41, Math.floor(relY / U_HEIGHT)));
      hoveredUIndex.value = startIdx;
      // 只高亮 1 行 (拖拽预览阶段不知道 units)
      hoveredUSlots.value = [startIdx];
    } else {
      hoveredUIndex.value = null;
      hoveredUSlots.value = [];
    }
  }
}
function stopDragDevice() {
  // -------- Auto‑scale when dropping into cabinet -------
  if (dragDevice.value && dragDevice.value.deviceId !== 'CABINET-42U') {
    const device = dragDevice.value as RuntimeDevice;

    // 找覆盖该设备左上角的机柜
    const cabinet = devicesOnCanvas.value.find(
      (d) =>
        d.deviceId === 'CABINET-42U' &&
        device.position.x >= d.position.x &&
        device.position.x <= d.position.x + d.width &&
        device.position.y >= d.position.y &&
        device.position.y <= d.position.y + d.height,
    ) as RuntimeDevice | undefined;

    if (cabinet) {
      const innerWidth = cabinet.width - 20; // 可用宽度
      const promptTxt = '该设备占用多少 U？(1-42)';
      let units = Number(window.prompt(promptTxt, '1'));
      if (!units || units < 1 || units > 42 || Number.isNaN(units)) units = 1;

      // 计算吸附起始行
      const relY = device.position.y - cabinet.position.y;
      let startIdx = Math.floor(relY / U_HEIGHT);
      startIdx = Math.max(0, Math.min(42 - units, startIdx));

      // X/Y 独立缩放：先按宽度铺满，再按高度向上取整到整数像素，避免空隙
      device.scaleX = innerWidth / device.width;

      const rawScaleY = (units * U_HEIGHT) / device.height;
      // 向上取整到千分位，确保视觉完全覆盖
      device.scaleY = Math.ceil(rawScaleY * 1000) / 1000;

      // 重新定位
      device.position.x =
        cabinet.position.x + (cabinet.width - device.width * device.scaleX) / 2;
      device.position.y = cabinet.position.y + startIdx * U_HEIGHT;

      // 绑定父机柜
      device.parentCabinetId = cabinet._uuid;

      // 高亮更新（松手后显示实际占用行）
      hoveredUSlots.value = Array.from({ length: units }, (_, i) => startIdx + i);
    }
    else {
      device.parentCabinetId = null;
    }
  }
  hoveredCabinetId.value = null;
  hoveredUIndex.value = null;
  hoveredUSlots.value = [];
  dragging.value = false;
  dragDevice.value = null;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', stopDragDevice);
}

// 连线时鼠标
function onMouseMove(e: MouseEvent) {
  if (!drawingLine.value) return;
  const rect = canvasRef.value?.getBoundingClientRect();
  mousePos.value = {
    x: e.clientX - (rect?.left ?? 0),
    y: e.clientY - (rect?.top ?? 0),
  };
}
function onCanvasMouseUp() {}

function showHighlight(devUUid: string, portId: string) {
  if (!drawingLine.value) return false;
  if (
    drawingLine.value.devUUid === devUUid &&
    drawingLine.value.portId === portId
  )
    return false;
  return true;
}

// 获取线坐标（端口端口 or 端口-缩略图）
// 外部线终点锚点根据画布宽度和数量自动适配
function getEdgePositions(edge: any) {
  if (!edge || !edge.source || !edge.target) return null;
  const portPos = (devUUid: string, portId: string) => {
    const dev = devicesOnCanvas.value.find((d) => d._uuid === devUUid);
    if (!dev) return null;
    const port = (dev.layers || []).find((l) => l.id === portId);
    if (!port) return null;
    const sx = (dev as RuntimeDevice).scaleX ?? 1;
    const sy = (dev as RuntimeDevice).scaleY ?? 1;
    return {
      x: dev.position.x + port.config.x * sx + (port.config.width * sx) / 2,
      y: dev.position.y + port.config.y * sy + (port.config.height * sy) / 2,
    };
  };

  let source = null;
  let target = null;
  if (edge.source.devUUid && edge.source.portId) {
    source = portPos(edge.source.devUUid, edge.source.portId);
  }
  if ((edge.target as any).devUUid && (edge.target as any).portId) {
    target = portPos((edge.target as any).devUUid, (edge.target as any).portId);
  } else if ((edge.target as any).externalRoom) {
    // 动态根据 canvas 宽高，自动靠右、自动分布
    const roomList = Object.keys(topoConfigs.value);
    const idx = roomList.indexOf((edge.target as any).externalRoom);
    const canvasRect = canvasDomRef.value?.getBoundingClientRect?.();
    const canvasWidth = canvasRect?.width || 1200;
    const canvasHeight = canvasRect?.height || 800;
    const roomCount = roomList.length;
    const gapY = Math.max(60, (canvasHeight - 240) / Math.max(1, roomCount));
    target = {
      x: canvasWidth - 30,
      y: 120 + idx * gapY,
    };
  }
  if (!source || !target) return null;
  return {
    source,
    target,
    color: (edge.target as any).externalRoom ? '#FFA500' : '#01E6FF',
    externalName: (edge.target as any).externalRoom ?? '',
  };
}

// 内部/外部连线模式切换
function setConnectMode(mode: 'external' | 'internal') {
  connectMode.value = mode;
  drawingLine.value = null;
  selectedPort.value = null;
  mousePos.value = null;
  pendingExternalRoom.value = null;
}

// 端口点击
function onPortClick(devUUid: string, portId: string) {
  if (connectMode.value === 'internal') {
    const dev = devicesOnCanvas.value.find((d) => d._uuid === devUUid);
    if (!dev) return;
    const port = (dev.layers || []).find((l: any) => l.id === portId);
    if (!port) return;
    const pos = {
      x: dev.position.x + port.config.x + port.config.width / 2,
      y: dev.position.y + port.config.y + port.config.height / 2,
    };
    if (drawingLine.value) {
      if (
        drawingLine.value.devUUid !== devUUid ||
        drawingLine.value.portId !== portId
      ) {
        edges.value.push({
          source: {
            devUUid: drawingLine.value.devUUid,
            portId: drawingLine.value.portId,
          },
          target: { devUUid, portId },
        });
      }
      drawingLine.value = null;
      selectedPort.value = null;
      mousePos.value = null;
    } else {
      drawingLine.value = { devUUid, portId, from: pos };
      selectedPort.value = { devUUid, portId };
    }
  } else if (connectMode.value === 'external') {
    const dev = devicesOnCanvas.value.find((d) => d._uuid === devUUid);
    if (!dev) return;
    const port = (dev.layers || []).find((l: any) => l.id === portId);
    if (!port) return;
    const pos = {
      x: dev.position.x + port.config.x + port.config.width / 2,
      y: dev.position.y + port.config.y + port.config.height / 2,
    };
    drawingLine.value = { devUUid, portId, from: pos };
    selectedPort.value = { devUUid, portId };
  }
}

// 外部模式下，点击缩略图添加一条线
function connectToExternalRoom(roomName: string) {
  if (
    connectMode.value === 'external' &&
    drawingLine.value &&
    selectedPort.value
  ) {
    edges.value.push({
      source: {
        devUUid: drawingLine.value.devUUid,
        portId: drawingLine.value.portId,
      },
      target: { externalRoom: roomName },
      external: true,
    });
    drawingLine.value = null;
    selectedPort.value = null;
    mousePos.value = null;
    pendingExternalRoom.value = null;
  }
}

onMounted(() => {
  fetchDevices();
  loadConfigsFromStorage();
});
</script>

<template>
  <div style="display: flex; flex-direction: row; width: 100%">
    <!-- 画布区域 -->
    <div
      class="canvas-bg"
      ref="canvasDomRef"
      style="position: relative; width: 100%; height: 100vh"
      @mousemove="onMouseMove"
      @mouseup="onCanvasMouseUp"
    >
      <!-- 控制栏 -->
      <TopoToolbar
        style="z-index: 10000"
        :selected-device-id="selectedDeviceId"
        :all-device-options="allDeviceOptions"
        :new-config-name="newConfigName"
        :connect-mode="connectMode"
        @update:selected-device-id="(val) => (selectedDeviceId = val)"
        @update:new-config-name="(val) => (newConfigName = val)"
        @add-device="addDevice"
        @save-current-canvas-to-configs="saveCurrentCanvasToConfigs"
        @set-connect-mode="setConnectMode"
      />
      <!-- 设备实例渲染 -->
      <template v-for="dev in devicesOnCanvas" :key="dev._uuid">
        <div
          class="device-wrap"
          :style="{
            position: 'absolute',
            left: `${dev.position.x}px`,
            top: `${dev.position.y}px`,
            transform: `scale(${dev.scaleX ?? 1}, ${dev.scaleY ?? 1})`,
            transformOrigin: 'top left',
            zIndex: dev.deviceId === 'CABINET-42U' ? 10 : 20,
          }"
          @mousedown="startDragDevice(dev, $event)"
        >
          <!-- 机柜视图：结构化 42U -->
          <template v-if="dev.deviceId === 'CABINET-42U'">
            <div
              class="cabinet-container"
              :class="{ 'cabinet-hover-target': hoveredCabinetId === dev._uuid }"
            >
              <div
                v-for="(u, idx) in 42"
                :key="u"
                :class="[
                  'cabinet-slot',
                  {
                    'cabinet-slot-hover-u':
                      hoveredCabinetId === dev._uuid && hoveredUSlots.includes(idx),
                  },
                ]"
              >
                <div class="u-label">U{{ 42 - u + 1 }}</div>
                <div class="slot-content" :data-u="42 - u + 1"></div>
              </div>
            </div>
          </template>
          <template v-else>
            <!-- 底图层 -->
            <img
              v-for="layer in (dev.layers || []).filter(
                (l) => l.type === 'image',
              )"
              :key="layer.id"
              :src="layer.config.src"
              :style="{
                width: `${layer.config.width}px`,
                height: `${layer.config.height}px`,
                pointerEvents: 'none',
              }"
              draggable="false"
            />
            <!-- 端口层 -->
            <div
              v-for="port in (dev.layers || []).filter((l) => l.type === 'port')"
              :key="port.id"
              class="port-spot"
              :class="[
                selectedPort &&
                selectedPort.devUUid === dev._uuid &&
                selectedPort.portId === port.id
                  ? 'selected-port'
                  : '',
                drawingLine && showHighlight(dev._uuid, port.id)
                  ? 'can-connect-highlight'
                  : '',
              ]"
              :style="{
                position: 'absolute',
                left: `${port.config.x}px`,
                top: `${port.config.y}px`,
                width: `${port.config.width}px`,
                height: `${port.config.height}px`,
                cursor: 'pointer',
              }"
              @click.stop="onPortClick(dev._uuid, port.id)"
            >
              <img
                :src="port.config.src"
                style="width: 100%; height: 100%"
                draggable="false"
              />
            </div>
          </template>
        </div>
      </template>
      <!-- SVG连线层（内部线、外部线） -->
      <svg
        :width="canvasDomRef?.offsetWidth || 1200"
        :height="canvasDomRef?.offsetHeight || 800"
        style="
          position: absolute;
          top: 0;
          left: 0;
          z-index: 50;
          pointer-events: none;
        "
      >
        <InternalLines
          :edges="edges.filter((e) => !e.external)"
          :get-edge-positions="getEdgePositions"
          :bezier-path="bezierPath"
        />
        <ExternalLines
          :edges="edges.filter((e) => e.external)"
          :get-edge-positions="getEdgePositions"
          :bezier-path="bezierPath"
        />
        <!-- 正在画线预览 -->
        <path
          v-if="drawingLine && drawingLine.from && mousePos"
          :d="bezierPath(drawingLine.from, mousePos)"
          stroke="#01E6FF"
          stroke-width="2"
          fill="none"
          stroke-dasharray="5,4"
        />
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="8"
            refY="4"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,4 L0,8" fill="#01E6FF" />
          </marker>
        </defs>
      </svg>
    </div>
    <!-- 右侧：全部画布列表（支持外部连线模式下点击） -->
    <CanvasRightPanel
      :topo-configs="topoConfigs"
      :connect-mode="connectMode"
      :drawing-line="drawingLine"
      @export-all-configs="exportAllConfigs"
      @restore-config-to-canvas="restoreConfigToCanvas"
      @export-one-config="exportOneConfig"
      @remove-config="removeConfig"
      @connect-to-external-room="connectToExternalRoom"
      @import-configs="importConfigs"
    />
  </div>
</template>

<style scoped>
.canvas-bg {
  position: relative;
  width: 1200px; height: 800px
}
.canvas-bg::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('../../../assets/network-topology/bg.png');
  background-size: cover;
  opacity: 0.3;
}
.device-wrap {
  user-select: none;
}
.port-spot {
  box-sizing: border-box;
  transition: border 0.18s;
}
.selected-port {
  border: 2px solid #01e6ff !important;
}
.can-connect-highlight {
  border: 2px solid #ff2d51 !important;
  box-shadow: 0 0 12px 3px #ff2d51;
  animation: port-glow 0.7s linear infinite alternate;
}
@keyframes port-glow {
  0% {
    border-color: #ff2d51;
    box-shadow: 0 0 7px 2px #ff2d51;
  }
  100% {
    border-color: #fff;
    box-shadow: 0 0 24px 8px #ff2d51;
  }
}
/* ===== Cabinet View Styles ===== */
.cabinet-container {
  width: 480px;
  margin: 0 auto;
  background-color: #333;
  padding: 10px;
  border-radius: 8px;
  overflow-y: auto;
  border: 2px solid #444;
}
.cabinet-slot {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #555;
    height: 50px;
  background-color: #2d2d2d;
  padding: 0 5px;
  font-size: 12px;
  color: #fff;
}
.u-label {
  width: 40px;
  text-align: right;
  margin-right: 10px;
  color: #ccc;
  font-family: monospace;
}
.slot-content {
  flex: 1;
  display: flex;
  align-items: center;
  height: 100%;
}
.cabinet-hover-target {
  border-color: #ff2d51 !important;
  box-shadow: 0 0 14px 4px #ff2d51;
}

.cabinet-slot-hover-u {
  border: 1px solid #01aaff !important;
  box-shadow: inset 0 0 8px 2px #01aaff;
}
</style>
