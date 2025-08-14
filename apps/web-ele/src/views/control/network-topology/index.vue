<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import html2canvas from 'html2canvas';
import DevicePreviewRender from '#/views/control/device-preview/DevicePreviewRender.vue';

// === Cabinet constants ===
const U_HEIGHT = 50; // px per U  (adjust slot height for clearer visibility)

import CanvasRightPanel from './components/CanvasRightPanel.vue';
import ExternalLines from './components/ExternalLines.vue';
import InternalLines from './components/InternalLines.vue';
import TopoToolbar from './components/TopoToolbar.vue';

const router = useRouter();

interface PortLayer {
  id: string;
  type: 'port' | 'port-adv';
  config: {
    height: number;
    width: number;
    x: number;
    y: number;
    src?: string;
    [key: string]: any;
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
  /** 设备名称 */
  deviceName: string;
  width: number;
  height: number;
  layers: (ImageLayer | PortLayer)[];
  materialsTree: any[];
  apiList: any[];
}

// ========= Runtime Device =========
interface RuntimeDevice extends DeviceTemplate {
  _uuid: string;
  position: { x: number; y: number };
  /** 宽度缩放 */
  scaleX?: number;
  /** 高度缩放 */
  scaleY?: number;
  /** 旋转角度 */
  rotate?: number;
  /** 所属机柜 UUID；顶层设备为 null */
  parentCabinetId?: string | null;
}

// ====== Cabinet Template ======
function createCabinetTemplate(): DeviceTemplate {
  return {
    deviceId: 'CABINET-42U',
    deviceName: '42U机柜',
    width: 480,
    height: 42 * U_HEIGHT,
    layers: [],              // 纯结构化渲染，无背景图层
    materialsTree: [],
    apiList: [],
  };
}

function createPowerCabinetTemplate(): DeviceTemplate {
  return {
    deviceId: 'POWER-CABINET',
    deviceName: '配电柜',
    width: 480,
    height: 700,
    layers: [],
    materialsTree: [],
    apiList: [],
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
  width?: number;
  height?: number;
}

// 状态
const allDeviceOptions = ref<DeviceTemplate[]>([]);
const devicesOnCanvas = ref<RuntimeDevice[]>([]);
const selectedDeviceId = ref<string>('');
const edges = ref<
  {
    external?: boolean;
    color?: string;
    source: { devUUid: string; portId: string; canvas?: string };
    target:
      | { devUUid: string; portId: string; canvas?: string }
      | { externalRoom: string };
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
const resizing = ref(false);
const resizeHandle = ref<'tl' | 'tr' | 'bl' | 'br' | null>(null);
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 });
const resizeDevice = ref<RuntimeDevice | null>(null);
const canvasRef = ref<HTMLElement | null>(null);
const canvasDomRef = ref<HTMLElement | null>(null);
const canvasWidth = ref(1920);
const canvasHeight = ref(1080);
const activeDeviceId = ref<string | null>(null);
function deviceTransform(dev: RuntimeDevice) {
  return `rotate(${dev.rotate || 0}deg) scale(${dev.scaleX ?? 1}, ${dev.scaleY ?? 1})`;
}

function handleStyle(dev: RuntimeDevice, dir: 'tl' | 'tr' | 'bl' | 'br') {
  const size = 8;
  const half = size / 2;
  const scaleX = dev.scaleX ?? 1;
  const scaleY = dev.scaleY ?? 1;
  const left = dir.includes('r')
    ? dev.width - half / scaleX
    : -half / scaleX;
  const top = dir.includes('b')
    ? dev.height - half / scaleY
    : -half / scaleY;
  const cursorMap: Record<'tl' | 'tr' | 'bl' | 'br', string> = {
    tl: 'nwse-resize',
    tr: 'nesw-resize',
    bl: 'nesw-resize',
    br: 'nwse-resize',
  };
  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: `scale(${1 / scaleX}, ${1 / scaleY})`,
    transformOrigin: 'top left',
    cursor: cursorMap[dir],
  };
}

// 画布保存
const topoConfigs = ref<Record<string, TopoConfig>>({});
const newConfigName = ref('');
const TOPO_CONFIGS_KEY = 'topo_configs_store';

// 当前打开的画布名称
const currentCanvasName = ref<string | null>(null);
// 外部连线时暂存的源画布信息
const sourceCanvasBackup = ref<
  | null
  | {
      name: string | null;
      devices: RuntimeDevice[];
      edges: any[];
      sourcePort: { devUUid: string; portId: string };
    }
>(null);

// 连线模式
const connectMode = ref<'external' | 'internal'>('internal');
const pendingExternalRoom = ref<null | string>(null);
const linkEnabled = ref(true);
const lineColor = ref('#01E6FF');
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
      rotate: dev.rotate,
      parentCabinetId: dev.parentCabinetId,
    })),
    edges: deepClone(edges.value),
    saveTime: Date.now(),
    cover: coverBase64,
    width: canvasWidth.value,
    height: canvasHeight.value,
  };
  topoConfigs.value[name] = config;
  saveConfigsToStorage();
  currentCanvasName.value = name;
  newConfigName.value = '';
  alert(`画布【${name}】已保存`);

  // 清空当前画布方便继续新建
  devicesOnCanvas.value = [];
  edges.value = [];
  currentCanvasName.value = null;
}

function restoreConfigToCanvas(name: string, config: TopoConfig) {
  currentCanvasName.value = name;
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
    dev.rotate = devCfg.rotate ?? 0;
    dev.parentCabinetId = devCfg.parentCabinetId ?? null;
    return dev;
  });
  edges.value = deepClone(config.edges);
  if (config.width) canvasWidth.value = config.width;
  if (config.height) canvasHeight.value = config.height;
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

function syncApiPush(cfg: any) {
  const map = new Map<string, any>();
  (cfg.apiList || []).forEach((api: any) => map.set(api.id, api));
  (cfg.layers || []).forEach((layer: any) => {
    const id = layer.config?.apiId;
    if (!id) return;
    const api = map.get(id);
    if (!api) return;
    if (typeof api.usePush === 'boolean') {
      layer.config.usePush = api.usePush;
      layer.config.pushService = api.usePush ? api.pushUrl || '' : '';
    } else if (typeof layer.config.usePush === 'boolean') {
      api.usePush = layer.config.usePush;
      api.pushUrl = layer.config.usePush ? layer.config.pushService || '' : '';
    }
  });
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
    syncApiPush(cfg);
    return {
      deviceId: String(row.deviceId),
      deviceName: row.deviceName ?? String(row.deviceId),
      width: cfg.width ?? 1920,
      height: cfg.height ?? 1080,
      layers: Array.isArray(cfg.layers) ? cfg.layers : [],
      materialsTree: Array.isArray(cfg.materialsTree)
        ? cfg.materialsTree
        : [],
      apiList: Array.isArray(cfg.apiList) ? cfg.apiList : [],
    } as DeviceTemplate;
  });

    // 确保机柜模板存在
    if (!allDeviceOptions.value.find((d) => d.deviceId === 'CABINET-42U')) {
      allDeviceOptions.value.push(createCabinetTemplate());
    }
    // 配电柜模板
    if (!allDeviceOptions.value.find((d) => d.deviceId === 'POWER-CABINET')) {
      allDeviceOptions.value.push(createPowerCabinetTemplate());
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
  if (tmpl.deviceId === 'POWER-CABINET') {
    const w =
      Number(window.prompt('配电柜宽度(px)', String(tmpl.width))) || tmpl.width;
    const h =
      Number(window.prompt('配电柜高度(px)', String(tmpl.height))) || tmpl.height;
    newDev.scaleX = w / tmpl.width;
    newDev.scaleY = h / tmpl.height;
  } else {
    newDev.scaleX = 1;
    newDev.scaleY = 1;
  }
  newDev.rotate = 0;
  newDev.parentCabinetId = null;
  devicesOnCanvas.value.push(newDev);
}

function openDeviceView(dev: RuntimeDevice) {
  if (
    dev.deviceId !== 'CABINET-42U' &&
    dev.deviceId !== 'POWER-CABINET'
  ) {
    router.push(`/control/device-view/${dev.deviceId}`);
  }
}

// 设备拖拽
function startDragDevice(dev: any, evt: MouseEvent) {
  if ((evt.target as HTMLElement).closest('.resize-handle')) return;
  activeDeviceId.value = dev._uuid;
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
  if (!dragging.value || !dragDevice.value || resizing.value) return;
  let nx = e.clientX - dragStart.value.x;
  let ny = e.clientY - dragStart.value.y;
  nx = Math.max(0, Math.min(nx, canvasWidth.value - 100));
  ny = Math.max(0, Math.min(ny, canvasHeight.value - 100));
  // 如果拖动的是机柜，同步移动其子设备
  if (
    dragDevice.value &&
    (dragDevice.value.deviceId === 'CABINET-42U' ||
      dragDevice.value.deviceId === 'POWER-CABINET')
  ) {
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
  if (
    dragDevice.value &&
    dragDevice.value.deviceId !== 'CABINET-42U' &&
    dragDevice.value.deviceId !== 'POWER-CABINET'
  ) {
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
  if (
    dragDevice.value &&
    dragDevice.value.deviceId !== 'CABINET-42U' &&
    dragDevice.value.deviceId !== 'POWER-CABINET'
  ) {
    const device = dragDevice.value as RuntimeDevice;

    // 找覆盖该设备左上角的机柜
    const cabinet = devicesOnCanvas.value.find(
      (d) =>
        (d.deviceId === 'CABINET-42U' || d.deviceId === 'POWER-CABINET') &&
        device.position.x >= d.position.x &&
        device.position.x <= d.position.x + d.width &&
        device.position.y >= d.position.y &&
        device.position.y <= d.position.y + d.height,
    ) as RuntimeDevice | undefined;

    if (cabinet) {
      if (cabinet.deviceId === 'CABINET-42U') {
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
          cabinet.position.x +
          (cabinet.width - device.width * device.scaleX) / 2;
        device.position.y = cabinet.position.y + startIdx * U_HEIGHT;

        // 高亮更新（松手后显示实际占用行）
        hoveredUSlots.value = Array.from(
          { length: units },
          (_, i) => startIdx + i,
        );
      }

      // 绑定父机柜
      device.parentCabinetId = cabinet._uuid;
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

function startResize(dev: RuntimeDevice, handle: 'tl' | 'tr' | 'bl' | 'br', evt: MouseEvent) {
  activeDeviceId.value = dev._uuid;
  resizing.value = true;
  resizeHandle.value = handle;
  resizeDevice.value = dev;
  const actualWidth = dev.width * (dev.scaleX ?? 1);
  const actualHeight = dev.height * (dev.scaleY ?? 1);
  resizeStart.value = {
    x: evt.clientX,
    y: evt.clientY,
    width: actualWidth,
    height: actualHeight,
    left: dev.position.x,
    top: dev.position.y,
  };
  window.addEventListener('mousemove', onResizeMove);
  window.addEventListener('mouseup', stopResize);
}

function onResizeMove(e: MouseEvent) {
  if (!resizing.value || !resizeDevice.value || !resizeHandle.value) return;
  const dx = e.clientX - resizeStart.value.x;
  const dy = e.clientY - resizeStart.value.y;
  let newWidth = resizeStart.value.width;
  let newHeight = resizeStart.value.height;
  let newLeft = resizeStart.value.left;
  let newTop = resizeStart.value.top;
  switch (resizeHandle.value) {
    case 'br':
      newWidth += dx;
      newHeight += dy;
      break;
    case 'tr':
      newWidth += dx;
      newHeight -= dy;
      newTop += dy;
      break;
    case 'tl':
      newWidth -= dx;
      newHeight -= dy;
      newLeft += dx;
      newTop += dy;
      break;
    case 'bl':
      newWidth -= dx;
      newHeight += dy;
      newLeft += dx;
      break;
  }
  const minSize = 20;
  newWidth = Math.max(minSize, newWidth);
  newHeight = Math.max(minSize, newHeight);
  resizeDevice.value.scaleX = newWidth / resizeDevice.value.width;
  resizeDevice.value.scaleY = newHeight / resizeDevice.value.height;
  resizeDevice.value.position.x = newLeft;
  resizeDevice.value.position.y = newTop;
}

function stopResize() {
  resizing.value = false;
  resizeDevice.value = null;
  resizeHandle.value = null;
  window.removeEventListener('mousemove', onResizeMove);
  window.removeEventListener('mouseup', stopResize);
}

function removeSelectedDevice() {
  if (!activeDeviceId.value) return;
  const id = activeDeviceId.value;
  devicesOnCanvas.value = devicesOnCanvas.value.filter((d) => d._uuid !== id);
  edges.value = edges.value.filter((e) => {
    const tgt = (e.target as any).devUUid;
    return e.source.devUUid !== id && (tgt ? tgt !== id : true);
  });
  activeDeviceId.value = null;
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
    let x = dev.position.x + port.config.x * sx + (port.config.width * sx) / 2;
    let y = dev.position.y + port.config.y * sy + (port.config.height * sy) / 2;
    const angle = dev.rotate || 0;
    if (angle) {
      const rad = (angle * Math.PI) / 180;
      const ox = dev.position.x;
      const oy = dev.position.y;
      const dx = x - ox;
      const dy = y - oy;
      x = ox + dx * Math.cos(rad) - dy * Math.sin(rad);
      y = oy + dx * Math.sin(rad) + dy * Math.cos(rad);
    }
    return { x, y };
  };

  let source = null;
  let target = null;
  if (edge.source.devUUid && edge.source.portId) {
    source = portPos(edge.source.devUUid, edge.source.portId);
  }
  if ((edge.target as any).devUUid && (edge.target as any).portId) {
    target = portPos((edge.target as any).devUUid, (edge.target as any).portId);
  }

  const roomList = Object.keys(topoConfigs.value);
  const canvasRect = canvasDomRef.value?.getBoundingClientRect?.();
  const canvasWidth = canvasRect?.width || 1920;
  const canvasHeight = canvasRect?.height || 1080;
  const gapY = Math.max(60, (canvasHeight - 240) / Math.max(1, roomList.length));

  let externalName = '';
  let externalPoint = null;
  if (!source) {
    const name = edge.source.canvas || edge.source.externalRoom || '';
    const idx = roomList.indexOf(name);
    source = {
      x: canvasWidth - 30,
      y: 120 + (idx >= 0 ? idx : 0) * gapY,
    };
    externalName = name;
    externalPoint = source;
  }
  if (!target) {
    const name =
      (edge.target as any).canvas ||
      (edge.target as any).externalRoom ||
      '';
    const idx = roomList.indexOf(name);
    target = {
      x: canvasWidth - 30,
      y: 120 + (idx >= 0 ? idx : 0) * gapY,
    };
    externalName = name;
    externalPoint = target;
  }

  if (!source || !target) return null;
  return {
    source,
    target,
    color: edge.external ? '#FFA500' : '#01E6FF',
    externalName,
    externalPoint,
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

function toggleLinkEnabled() {
  linkEnabled.value = !linkEnabled.value;
  if (!linkEnabled.value) {
    drawingLine.value = null;
    selectedPort.value = null;
    mousePos.value = null;
    pendingExternalRoom.value = null;
  }
}

// 端口点击
function onPortClick(devUUid: string, portId: string) {
  if (!linkEnabled.value) return;
  if (connectMode.value === 'internal') {
    const dev = devicesOnCanvas.value.find((d) => d._uuid === devUUid);
    if (!dev) return;
    const port = (dev.layers || []).find((l: any) => l.id === portId);
    if (!port) return;
    let posX = dev.position.x + port.config.x + port.config.width / 2;
    let posY = dev.position.y + port.config.y + port.config.height / 2;
    if (dev.rotate) {
      const rad = (dev.rotate * Math.PI) / 180;
      const ox = dev.position.x;
      const oy = dev.position.y;
      const dx = posX - ox;
      const dy = posY - oy;
      posX = ox + dx * Math.cos(rad) - dy * Math.sin(rad);
      posY = oy + dx * Math.sin(rad) + dy * Math.cos(rad);
    }
    const pos = { x: posX, y: posY };
    if (drawingLine.value) {
      if (
        drawingLine.value.devUUid !== devUUid ||
        drawingLine.value.portId !== portId
      ) {
        edges.value.push({
          color: lineColor.value,
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
    let posX = dev.position.x + port.config.x + port.config.width / 2;
    let posY = dev.position.y + port.config.y + port.config.height / 2;
    if (dev.rotate) {
      const rad = (dev.rotate * Math.PI) / 180;
      const ox = dev.position.x;
      const oy = dev.position.y;
      const dx = posX - ox;
      const dy = posY - oy;
      posX = ox + dx * Math.cos(rad) - dy * Math.sin(rad);
      posY = oy + dx * Math.sin(rad) + dy * Math.cos(rad);
    }
    const pos = { x: posX, y: posY };
    if (pendingExternalRoom.value && sourceCanvasBackup.value) {
      // 在目标画布选择端口，完成外部连线
      const source = sourceCanvasBackup.value;
      const edge = {
        external: true,
        color: lineColor.value,
        source: {
          canvas: source.name || '',
          devUUid: source.sourcePort.devUUid,
          portId: source.sourcePort.portId,
        },
        target: {
          canvas: currentCanvasName.value || '',
          devUUid,
          portId,
        },
      };
      // 在源画布记录原向连线
      source.edges.push(deepClone(edge));
      // 在当前(目标)画布记录反向连线
      edges.value.push({
        external: true,
        color: lineColor.value,
        source: {
          canvas: currentCanvasName.value || '',
          devUUid,
          portId,
        },
        target: {
          canvas: source.name || '',
          devUUid: source.sourcePort.devUUid,
          portId: source.sourcePort.portId,
        },
      });
      if (currentCanvasName.value && topoConfigs.value[currentCanvasName.value]) {
        topoConfigs.value[currentCanvasName.value].edges = deepClone(edges.value);
      }
      // 还原源画布并保存
      devicesOnCanvas.value = source.devices;
      edges.value = source.edges;
      if (source.name && topoConfigs.value[source.name]) {
        topoConfigs.value[source.name].edges = deepClone(source.edges);
      }
      currentCanvasName.value = source.name;
      pendingExternalRoom.value = null;
      sourceCanvasBackup.value = null;
      drawingLine.value = null;
      selectedPort.value = null;
      mousePos.value = null;
    } else {
      drawingLine.value = { devUUid, portId, from: pos };
      selectedPort.value = { devUUid, portId };
    }
  }
}

// 外部模式下，点击缩略图进入指定画布选择端口
function connectToExternalRoom(roomName: string) {
  if (
    !linkEnabled.value ||
    connectMode.value !== 'external' ||
    !drawingLine.value ||
    !selectedPort.value
  ) {
    return;
  }
  // 备份当前画布信息
  sourceCanvasBackup.value = {
    name: currentCanvasName.value,
    devices: deepClone(devicesOnCanvas.value),
    edges: deepClone(edges.value),
    sourcePort: {
      devUUid: drawingLine.value.devUUid,
      portId: drawingLine.value.portId,
    },
  };
  pendingExternalRoom.value = roomName;
  // 切换到目标画布进行端口选择
  const cfg = topoConfigs.value[roomName];
  if (cfg) restoreConfigToCanvas(roomName, cfg);
  drawingLine.value = null;
  selectedPort.value = null;
  mousePos.value = null;
}

onMounted(() => {
  fetchDevices();
  loadConfigsFromStorage();
  window.addEventListener('keydown', onKeyDown);
});
onUnmounted(() => window.removeEventListener('keydown', onKeyDown));

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Delete') removeSelectedDevice();
}
</script>

<template>
  <div style="display: flex; flex-direction: row; width: 100%">
    <!-- 画布区域 -->
    <div
      class="canvas-bg"
      ref="canvasDomRef"
      :style="{ position: 'relative', width: canvasWidth + 'px', height: canvasHeight + 'px' }"
      @mousemove="onMouseMove"
      @mouseup="onCanvasMouseUp"
      @click.self="activeDeviceId = null"
    >
      <!-- 控制栏 -->
      <TopoToolbar
        style="z-index: 10000"
        :selected-device-id="selectedDeviceId"
        :all-device-options="allDeviceOptions"
        :new-config-name="newConfigName"
        :connect-mode="connectMode"
        :canvas-width="canvasWidth"
        :canvas-height="canvasHeight"
        :line-color="lineColor"
        :link-enabled="linkEnabled"
        @update:selected-device-id="(val) => (selectedDeviceId = val)"
        @update:new-config-name="(val) => (newConfigName = val)"
        @add-device="addDevice"
        @save-current-canvas-to-configs="saveCurrentCanvasToConfigs"
        @set-connect-mode="setConnectMode"
        @update:canvas-width="(val: number) => (canvasWidth = val)"
        @update:canvas-height="(val: number) => (canvasHeight = val)"
        @remove-selected-device="removeSelectedDevice"
        @update:line-color="(val: string) => (lineColor.value = val)"
        @toggle-link-enabled="toggleLinkEnabled"
      />
      <!-- 设备实例渲染 -->
      <template v-for="dev in devicesOnCanvas" :key="dev._uuid">
        <div
          class="device-wrap"
          :class="{ 'active-device': activeDeviceId === dev._uuid }"
          @click.stop="activeDeviceId = dev._uuid"
          @dblclick.stop="openDeviceView(dev)"
          :style="{
            position: 'absolute',
            left: `${dev.position.x}px`,
            top: `${dev.position.y}px`,
            transform: deviceTransform(dev),
            transformOrigin: 'top left',
            zIndex:
              activeDeviceId === dev._uuid
                ? 100
                : dev.deviceId === 'CABINET-42U' || dev.deviceId === 'POWER-CABINET'
                  ? 10
                  : 20,
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
          <template v-else-if="dev.deviceId === 'POWER-CABINET'">
            <div class="power-cabinet">配电柜</div>
          </template>
          <template v-else>
            <DevicePreviewRender
              :config="dev"
              with-redis-state
              style="pointer-events: none"
            />
            <div
              v-for="port in (dev.layers || []).filter(
                (l) => l.type === 'port' || l.type === 'port-adv',
              )"
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
                background: 'transparent',
                transform: `rotate(${port.config.rotate || 0}deg)`,
                transformOrigin: 'center center',
              }"
              @click.stop="onPortClick(dev._uuid, port.id)"
            ></div>
          </template>
          <template v-if="activeDeviceId === dev._uuid">
            <div
              class="resize-handle tl"
              :style="handleStyle(dev, 'tl')"
              @mousedown.stop.prevent="startResize(dev, 'tl', $event)"
            />
            <div
              class="resize-handle tr"
              :style="handleStyle(dev, 'tr')"
              @mousedown.stop.prevent="startResize(dev, 'tr', $event)"
            />
            <div
              class="resize-handle bl"
              :style="handleStyle(dev, 'bl')"
              @mousedown.stop.prevent="startResize(dev, 'bl', $event)"
            />
            <div
              class="resize-handle br"
              :style="handleStyle(dev, 'br')"
              @mousedown.stop.prevent="startResize(dev, 'br', $event)"
            />
          </template>
        </div>
      </template>
      <!-- SVG连线层（内部线、外部线） -->
      <svg
        :width="canvasDomRef?.offsetWidth || 1920"
        :height="canvasDomRef?.offsetHeight || 1080"
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
          :stroke="lineColor"
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
            <path d="M0,0 L8,4 L0,8" fill="currentColor" />
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
  transition: transform 0.2s;
}
.active-device {
  outline: 2px dashed #f44;
}
.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #fff;
  border: 1px solid #f44;
  box-sizing: border-box;
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
.power-cabinet {
  width: 480px;
  height: 700px;
  background: #2d2d2d;
  border: 2px solid #888;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
</style>
