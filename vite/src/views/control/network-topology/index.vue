<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { updatePreferences } from '@vben/preferences';

import html2canvas from 'html2canvas';
import DevicePreviewRender from '#/views/control/device-preview/DevicePreviewRender.vue';

// === Cabinet constants ===
const U_HEIGHT = 50; // px per U  (adjust slot height for clearer visibility)

import CanvasRightPanel from './components/CanvasRightPanel.vue';
import ExternalLines from './components/ExternalLines.vue';
import InternalLines from './components/InternalLines.vue';
import EdgeLines from './components/EdgeLines.vue';
import TopoToolbar from './components/TopoToolbar.vue';

const router = useRouter();
const route = useRoute();
const wantFullScreen = computed(
  () => String((route.query as any)?.fullScreen ?? '').toLowerCase() === 'true',
);
const READONLY_SS_KEY = 'TOPOLOGY_READ_ONLY';
const AUTO_CABINET_ID_SS_KEY = 'TOPOLOGY_AUTO_CABINET_ID';
const sessionReadOnly = ref(
  typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('fullScreen')?.toLowerCase() === 'true' ||
      sessionStorage.getItem(READONLY_SS_KEY) === '1')
    ? true
    : false,
);
const isReadOnly = computed(() => wantFullScreen.value || sessionReadOnly.value);
const isFullscreen = ref(false);
const showFullScreenPrompt = ref(false);
const autoFitScale = ref(1);
let resizeObs: ResizeObserver | null = null;

function getFullscreenElement(): any {
  return (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}
function requestFs(el: any) {
  const rfs =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen;
  if (typeof rfs === 'function') return rfs.call(el);
  return Promise.reject('Fullscreen API not supported');
}
async function tryEnterFullscreen() {
  const el: any = canvasDomRef.value || document.documentElement;
  try {
    await requestFs(el);
  } catch (e) {
    showFullScreenPrompt.value = true;
  }
}
function onFullscreenChange() {
  isFullscreen.value = !!getFullscreenElement();
  if (isFullscreen.value) showFullScreenPrompt.value = false;
}

function computeAutoFitScale() {
  // 全屏编辑：与 DOM 同步尺寸，固定 scale=1，避免坐标错位
  autoFitScale.value = 1;
}

function observeCanvasSize() {
  if (!canvasDomRef.value) return;
  const el = canvasDomRef.value;
  const update = () => {
    const r = el.getBoundingClientRect();
    const pad = 0; // 可以根据内边距调整
    canvasWidth.value = Math.max(320, Math.floor(r.width - pad));
    canvasHeight.value = Math.max(240, Math.floor(r.height - pad));
  };
  update();
  if ('ResizeObserver' in window) {
    resizeObs = new ResizeObserver(() => update());
    resizeObs.observe(el);
  } else {
    window.addEventListener('resize', update);
  }
}

interface PortLayer {
  id: string;
  type: 'port' | 'port-adv';
  config: { height: number; width: number; x: number; y: number; src?: string; [key: string]: any };
}
interface ImageLayer { id: string; type: 'image'; config: { height: number; src: string; width: number; x: number; y: number } }
interface DeviceTemplate {
  deviceId: string; deviceName: string; width: number; height: number;
  layers: (ImageLayer | PortLayer)[]; materialsTree: any[]; apiList: any[];
}
interface RuntimeDevice extends DeviceTemplate {
  _uuid: string; position: { x: number; y: number }; scaleX?: number; scaleY?: number; rotate?: number; parentCabinetId?: string | null;
}

function createCabinetTemplate(): DeviceTemplate { return { deviceId: 'CABINET-42U', deviceName: '42U机柜', width: 480, height: 42 * U_HEIGHT, layers: [], materialsTree: [], apiList: [] }; }
function createPowerCabinetTemplate(): DeviceTemplate { return { deviceId: 'POWER-CABINET', deviceName: '配电柜', width: 480, height: 700, layers: [], materialsTree: [], apiList: [] }; }

interface TopoConfig { devices: { _uuid: string; deviceId: string; position: { x: number; y: number }; scaleX?: number; scaleY?: number; parentCabinetId?: string | null }[]; edges: any[]; saveTime?: number; cover?: string; width?: number; height?: number; }

interface CabinetItem { cabinetId?: number; cabinetName?: string; cabinetUCount?: number; cabinetJson?: string }
const CABINET_BASE = '/api/jx-device/Cabinet';
const cabinetOptions = ref<{ value: string; label: string }[]>([]);
const selectedCabinetId = ref<string>('');
const cabinetNameInput = ref<string>('');
const showCabinetModal = ref(false);
const cabinetModalMode = ref<'create' | 'edit'>('create');
const cabinetForm = ref<{ cabinetName: string; machineRoomId: number | null; cabinetUCount: number | null }>({ cabinetName: '', machineRoomId: null, cabinetUCount: null });

const allDeviceOptions = ref<DeviceTemplate[]>([]);
const devicesOnCanvas = ref<RuntimeDevice[]>([]);
const selectedDeviceId = ref<string>('');
const edges = ref<any[]>([]);
const drawingLine = ref<null | { devUUid: string; from: { x: number; y: number }; portId: string }>(null);
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
function deviceTransform(dev: RuntimeDevice) { return `rotate(${dev.rotate || 0}deg) scale(${dev.scaleX ?? 1}, ${dev.scaleY ?? 1})`; }

function handleStyle(dev: RuntimeDevice, dir: 'tl' | 'tr' | 'bl' | 'br') {
  const size = 8; const half = size / 2; const scaleX = dev.scaleX ?? 1; const scaleY = dev.scaleY ?? 1;
  const left = dir.includes('r') ? dev.width - half / scaleX : -half / scaleX;
  const top = dir.includes('b') ? dev.height - half / scaleY : -half / scaleY;
  const cursorMap: Record<'tl' | 'tr' | 'bl' | 'br', string> = { tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize' };
  return { left: `${left}px`, top: `${top}px`, transform: `scale(${1 / scaleX}, ${1 / scaleY})`, transformOrigin: 'top left', cursor: cursorMap[dir] };
}

const topoConfigs = ref<Record<string, TopoConfig>>({});
const newConfigName = ref('');
const TOPO_CONFIGS_KEY = 'topo_configs_store';
const currentCanvasName = ref<string | null>(null);
const sourceCanvasBackup = ref<null | { name: string | null; devices: RuntimeDevice[]; edges: any[]; sourcePort: { devUUid: string; portId: string } }>(null);
const connectMode = ref<'external' | 'internal'>('internal');
const lineColor = ref('#01E6FF');
const connectEnabled = ref(true);
const showLines = ref(true);
const pendingExternalRoom = ref<null | string>(null);
const hoveredCabinetId = ref<string | null>(null);
const hoveredUIndex = ref<number | null>(null);
const hoveredUSlots = ref<number[]>([]);
// 右侧面板开关
const showRightPanel = ref(true);

// === setters to avoid template ref auto-unwrapping issues ===
function setConnectMode(m: 'internal' | 'external') { connectMode.value = m; }
function setCanvasWidth(v: number) { canvasWidth.value = v; }
function setCanvasHeight(v: number) { canvasHeight.value = v; }
function setLineColor(v: string) { lineColor.value = v; }
function setShowLines(v: boolean) { showLines.value = v; }
function setConnectEnabled(v: boolean) { connectEnabled.value = v; }
function setSelectedDeviceId(v: string) { selectedDeviceId.value = v; }
function setNewConfigName(v: string) { newConfigName.value = v; }

function deepClone<T>(obj: T): T { try { return structuredClone(obj); } catch { return JSON.parse(JSON.stringify(obj)); } }
function bezierPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = Math.abs(to.x - from.x); const c1x = from.x + dx / 2; const c2x = to.x - dx / 2; return `M${from.x},${from.y} C${c1x},${from.y} ${c2x},${to.y} ${to.x},${to.y}`;
}
function saveConfigsToStorage() { localStorage.setItem(TOPO_CONFIGS_KEY, JSON.stringify(topoConfigs.value)); }
function loadConfigsFromStorage() { try { const raw = localStorage.getItem(TOPO_CONFIGS_KEY); if (raw) topoConfigs.value = JSON.parse(raw); } catch {} }

// 同步接口配置到图层（保持与设备编辑器一致）
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

// 加载设备模板列表
async function fetchDevices() {
  const API = '/api/jx-device/Device/list?pageSize=0';
  try {
    const resp = await fetch(API);
    if (!resp.ok) throw new Error(`http ${resp.status}`);
    const text = await resp.text();
    const json = text ? JSON.parse(text) : { code: 200, rows: [] };
    if (json.code !== 200) return;
    const rows = Array.isArray(json.rows) ? json.rows : [];
    allDeviceOptions.value = rows.map((row: any) => {
      let cfg: any = {};
      try { cfg = JSON.parse(row.deviceJson ?? '{}'); } catch {}
      syncApiPush(cfg);
      return {
        deviceId: String(row.deviceId),
        deviceName: row.deviceName ?? String(row.deviceId),
        width: cfg.width ?? 1920,
        height: cfg.height ?? 1080,
        layers: Array.isArray(cfg.layers) ? cfg.layers : [],
        materialsTree: Array.isArray(cfg.materialsTree) ? cfg.materialsTree : [],
        apiList: Array.isArray(cfg.apiList) ? cfg.apiList : [],
      } as DeviceTemplate;
    });
    if (!allDeviceOptions.value.find((d) => d.deviceId === 'CABINET-42U')) allDeviceOptions.value.push(createCabinetTemplate());
    if (!allDeviceOptions.value.find((d) => d.deviceId === 'POWER-CABINET')) allDeviceOptions.value.push(createPowerCabinetTemplate());
    if (allDeviceOptions.value.length > 0) selectedDeviceId.value = allDeviceOptions.value[0].deviceId;
  } catch (e) {
    // 后端不可用时至少提供机柜模板
    allDeviceOptions.value = [];
    if (!allDeviceOptions.value.find((d) => d.deviceId === 'CABINET-42U')) allDeviceOptions.value.push(createCabinetTemplate());
    if (!allDeviceOptions.value.find((d) => d.deviceId === 'POWER-CABINET')) allDeviceOptions.value.push(createPowerCabinetTemplate());
    selectedDeviceId.value = allDeviceOptions.value[0]?.deviceId || '';
  }
}

function addDevice() {
  const tmpl = allDeviceOptions.value.find((d) => d.deviceId === selectedDeviceId.value);
  if (!tmpl) return;
  const uuid = `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const newDev = deepClone(tmpl) as RuntimeDevice;
  newDev._uuid = uuid;
  newDev.position = { x: Math.floor(60 + Math.random() * 500), y: Math.floor(60 + Math.random() * 300) };
  if (tmpl.deviceId === 'POWER-CABINET') {
    const w = Number(window.prompt('配电柜宽度(px)', String(tmpl.width))) || tmpl.width;
    const h = Number(window.prompt('配电柜高度(px)', String(tmpl.height))) || tmpl.height;
    newDev.scaleX = w / tmpl.width;
    newDev.scaleY = h / tmpl.height;
  } else { newDev.scaleX = 1; newDev.scaleY = 1; }
  newDev.rotate = 0;
  newDev.parentCabinetId = null;
  devicesOnCanvas.value.push(newDev);
}

function removeSelectedDevice() {
  if (!activeDeviceId.value) return;
  const id = activeDeviceId.value;
  devicesOnCanvas.value = devicesOnCanvas.value.filter((d) => d._uuid !== id);
  edges.value = edges.value.filter((e: any) => e.source?.devUUid !== id && e.target?.devUUid !== id);
  activeDeviceId.value = null;
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    removeSelectedDevice();
  }
}

async function saveCurrentCanvasToConfigs() {
  let name = newConfigName.value.trim(); if (!name) { name = window.prompt('请输入画布名称：') || ''; if (!name) return; }
  await nextTick();
  let coverBase64 = '';
  if (canvasDomRef.value) {
    try { const canvas = await html2canvas(canvasDomRef.value, { backgroundColor: null, useCORS: true }); coverBase64 = canvas.toDataURL('image/png'); } catch {}
  }
  topoConfigs.value[name] = {
    devices: deepClone(devicesOnCanvas.value.map((d) => ({ deviceId: d.deviceId, _uuid: d._uuid, position: { ...d.position }, scaleX: d.scaleX, scaleY: d.scaleY, rotate: d.rotate, parentCabinetId: d.parentCabinetId ?? null }))),
    edges: deepClone(edges.value), saveTime: Date.now(), cover: coverBase64,
  };
  saveConfigsToStorage();
}

function startNewCanvas() { currentCanvasName.value = null; devicesOnCanvas.value = []; edges.value = []; }
function startNewCabinet() { startNewCanvas(); const cab: RuntimeDevice = { ...createCabinetTemplate(), _uuid: String(Date.now() + Math.random()), position: { x: 100, y: 50 } }; devicesOnCanvas.value.push(cab); }
function addPowerCabinet() { const cab: RuntimeDevice = { ...createPowerCabinetTemplate(), _uuid: String(Date.now() + Math.random()), position: { x: 620, y: 50 } }; devicesOnCanvas.value.push(cab); }
function removeConfig(name: string) { if (!window.confirm(`确认删除画布【${name}】吗？`)) return; delete topoConfigs.value[name]; saveConfigsToStorage(); }
function removeAllConfigs() { if (!window.confirm('确认清空所有画布吗？')) return; topoConfigs.value = {}; saveConfigsToStorage(); }

function restoreConfigToCanvas(name: string, config: TopoConfig) {
  currentCanvasName.value = name;
  devicesOnCanvas.value = config.devices.map((devCfg: any) => {
    const tmpl = allDeviceOptions.value.find((t) => t.deviceId === devCfg.deviceId);
    const base = tmpl ? deepClone(tmpl) : createPlaceholderTemplate(String(devCfg.deviceId));
    const dev = base as RuntimeDevice;
    dev._uuid = devCfg._uuid;
    dev.position = devCfg.position;
    dev.scaleX = devCfg.scaleX ?? 1;
    dev.scaleY = devCfg.scaleY ?? 1;
    dev.rotate = devCfg.rotate ?? 0;
    dev.parentCabinetId = devCfg.parentCabinetId ?? null;
    return dev;
  });
  edges.value = deepClone(config.edges);
  // 百分比布局不再设置固定宽高
}
function createPlaceholderTemplate(id: string): DeviceTemplate { return { deviceId: id, deviceName: `设备${id}`, width: 200, height: 120, layers: [], materialsTree: [], apiList: [] }; }

function buildCurrentConfigForServer(): TopoConfig { return { devices: devicesOnCanvas.value.map((dev) => ({ deviceId: dev.deviceId, _uuid: dev._uuid, position: dev.position, scaleX: dev.scaleX, scaleY: dev.scaleY, rotate: dev.rotate, parentCabinetId: dev.parentCabinetId })), edges: deepClone(edges.value), saveTime: Date.now() }; }

async function fetchCabinetList() {
  try {
    const resp = await fetch(`${CABINET_BASE}/list?pageSize=0`);
    if (!resp.ok) return;
    const text = await resp.text(); const json = text ? JSON.parse(text) : {};
    if (json && (json.code === 200 || json.success !== false)) {
      const rows: CabinetItem[] = json.rows || json.data || [];
      cabinetOptions.value = (rows || []).map((r: any) => ({ value: String(r.cabinetId), label: r.cabinetName || `机柜#${r.cabinetId}` }));
    }
  } catch {}
}

async function loadCabinet(id: string) {
  if (!id) return;
  try {
    const resp = await fetch(`${CABINET_BASE}/${id}`);
    if (!resp.ok) { alert(`获取详情失败：http${resp.status}`); return; }
    const text = await resp.text(); const json = text ? JSON.parse(text) : {};
    if (json && (json.code === 200 || json.success)) {
      const data = json.data || json.rows || json;
      const rawCfg = data?.cabinetJson; const name = data?.cabinetName as string;
      let cfg: TopoConfig | null = null;
      if (rawCfg) {
        if (typeof rawCfg === 'string') { try { cfg = JSON.parse(rawCfg); } catch (e) { console.warn('cabinetJson 解析失败(字符串)', e); cfg = null; } }
        else if (typeof rawCfg === 'object') { cfg = rawCfg as TopoConfig; }
      }
      if ((!allDeviceOptions.value || allDeviceOptions.value.length === 0) && cfg) { try { await fetchDevices(); } catch {} }
      if (cfg) { restoreConfigToCanvas(name || `cabinet_${id}`, cfg); cabinetNameInput.value = name || ''; selectedCabinetId.value = id; }
      else { alert('该机柜无有效配置'); }
    } else { alert(`获取详情失败：${json?.msg ?? '未知错误'}`); }
  } catch (e) { console.error('loadCabinet error', e); alert('获取详情失败，请检查网络或服务器'); }
}

function openCreateCabinetModal() {
  cabinetModalMode.value = 'create';
  const hasCabinet42U = devicesOnCanvas.value.some((d) => d.deviceId === 'CABINET-42U');
  cabinetForm.value = { cabinetName: cabinetNameInput.value || '', machineRoomId: null, cabinetUCount: hasCabinet42U ? 42 : null };
  showCabinetModal.value = true;
}

async function saveCabinet() {
  const name = cabinetNameInput.value.trim(); if (!name) { alert('请输入机柜名称'); return; }
  const config = buildCurrentConfigForServer();
  const payload: Record<string, any> = { cabinetName: name, cabinetJson: JSON.stringify(config) };
  const hasCabinet42U = devicesOnCanvas.value.some((d) => d.deviceId === 'CABINET-42U'); if (hasCabinet42U) payload.cabinetUCount = 42;
  const isUpdate = !!selectedCabinetId.value; if (isUpdate) payload.cabinetId = Number(selectedCabinetId.value);
  try {
    const resp = await fetch(CABINET_BASE, { method: isUpdate ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await resp.json();
    if (json && (json.code === 200 || json.success)) {
      alert(isUpdate ? '修改成功' : '新增成功'); await fetchCabinetList();
      const newId = json.data?.cabinetId || json.data?.id || json?.cabinetId; if (!isUpdate && newId) selectedCabinetId.value = String(newId);
    } else { alert(`保存失败：${json?.msg ?? '未知错误'}`); }
  } catch (e) { console.error('saveCabinet error', e); alert('保存失败，请检查网络或服务器'); }
}

async function deleteCabinet() {
  if (!selectedCabinetId.value) { alert('请选择要删除的机柜'); return; }
  if (!window.confirm('确认删除该机柜吗？')) return;
  try {
    const resp = await fetch(`${CABINET_BASE}/${selectedCabinetId.value}`, { method: 'DELETE' });
    const json = await resp.json();
    if (json && (json.code === 200 || json.success)) { alert('删除成功'); await fetchCabinetList(); startNewCabinet(); }
    else { alert(`删除失败：${json?.msg ?? '未知错误'}`); }
  } catch (e) { console.error('deleteCabinet error', e); alert('删除失败，请检查网络或服务器'); }
}

function exportCurrentCanvasJson() {
  const cfg = buildCurrentConfigForServer(); const str = JSON.stringify(cfg, null, 2); const blob = new Blob([str], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${cabinetNameInput.value || 'topology'}.json`; a.click(); URL.revokeObjectURL(url);
}

async function confirmCreateCabinet() {
  if (!cabinetForm.value.cabinetName) { alert('请输入机柜名称'); return; }
  const cfg = buildCurrentConfigForServer();
  const payload: any = { cabinetName: cabinetForm.value.cabinetName, cabinetJson: JSON.stringify(cfg) };
  if (cabinetForm.value.machineRoomId != null && cabinetForm.value.machineRoomId !== ('' as any)) payload.machineRoomId = cabinetForm.value.machineRoomId;
  if (cabinetForm.value.cabinetUCount != null && cabinetForm.value.cabinetUCount !== ('' as any)) payload.cabinetUCount = cabinetForm.value.cabinetUCount;
  else { const hasCabinet42U = devicesOnCanvas.value.some((d) => d.deviceId === 'CABINET-42U'); if (hasCabinet42U) payload.cabinetUCount = 42; }
  try {
    const resp = await fetch(CABINET_BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await resp.json();
    if (json && (json.code === 200 || json.success)) { alert('新增成功'); showCabinetModal.value = false; cabinetNameInput.value = cabinetForm.value.cabinetName; await fetchCabinetList(); const newId = json.data?.cabinetId || json.data?.id || json?.cabinetId; if (newId) selectedCabinetId.value = String(newId); }
    else { alert(`新增失败：${json?.msg ?? '未知错误'}`); }
  } catch (e) { console.error('create cabinet error', e); alert('新增失败，请检查网络或服务器'); }
}

function connectToExternalRoom(roomName: string) {
  if (connectMode.value === 'external' && drawingLine.value && selectedPort.value) {
    sourceCanvasBackup.value = { name: currentCanvasName.value, devices: deepClone(devicesOnCanvas.value), edges: deepClone(edges.value), sourcePort: { devUUid: drawingLine.value.devUUid, portId: drawingLine.value.portId } };
    pendingExternalRoom.value = roomName; const cfg = topoConfigs.value[roomName]; if (cfg) restoreConfigToCanvas(roomName, cfg); drawingLine.value = null; selectedPort.value = null; mousePos.value = null;
  }
}

// TODO: 省略部分拖拽、连线、端口计算与绘制的实现，已与原工程一致搬运
// 出于长度限制，这里保留所有关键数据结构、保存与恢复逻辑，渲染端使用 ExternalLines/InternalLines 组件

onMounted(() => {
  fetchDevices();
  loadConfigsFromStorage();
  fetchCabinetList();
  window.addEventListener('keydown', onKeyDown);
  // 百分比布局：无需固定画布像素尺寸
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange as any);
  document.addEventListener('mozfullscreenchange', onFullscreenChange as any);
  document.addEventListener('MSFullscreenChange', onFullscreenChange as any);
  if (wantFullScreen.value) {
    nextTick(() => {
      try { sessionReadOnly.value = true; sessionStorage.setItem(READONLY_SS_KEY, '1'); } catch {}
      try { updatePreferences({ app: { layout: 'full-content', isMobile: false }, header: { hidden: true }, sidebar: { hidden: true }, footer: { enable: false }, tabbar: { enable: false }, }); } catch {}
    tryEnterFullscreen(); setTimeout(() => { if (!getFullscreenElement()) showFullScreenPrompt.value = true; }, 300);
    });
  }
  try { const idFromQuery = (route.query as any)?.cabinetId as string | undefined; const idFromSession = sessionStorage.getItem(AUTO_CABINET_ID_SS_KEY) || undefined; const cid = (idFromQuery && String(idFromQuery)) || idFromSession; if (cid) { setTimeout(() => loadCabinet(String(cid)), 50); } } catch {}
});
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  window.removeEventListener('keydown', onKeyDown);
});

// ========== Drag/Resize Device ==========
function startDragDevice(dev: RuntimeDevice, evt: MouseEvent) {
  if ((evt.target as HTMLElement).closest('.resize-handle')) return;
  activeDeviceId.value = dev._uuid;
  dragging.value = true;
  dragDevice.value = dev;
  dragStart.value = { x: evt.clientX - dev.position.x, y: evt.clientY - dev.position.y };
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', stopDragDevice);
}
function onDragMove(e: MouseEvent) {
  if (!dragging.value || !dragDevice.value || resizing.value) return;
  let nx = e.clientX - dragStart.value.x;
  let ny = e.clientY - dragStart.value.y;
  const crect = canvasRef.value?.getBoundingClientRect();
  const maxW = (crect?.width || 1920) - 50;
  const maxH = (crect?.height || 1080) - 50;
  nx = Math.max(0, Math.min(nx, maxW));
  ny = Math.max(0, Math.min(ny, maxH));
  if (dragDevice.value && (dragDevice.value.deviceId === 'CABINET-42U' || dragDevice.value.deviceId === 'POWER-CABINET')) {
    const cab = dragDevice.value as RuntimeDevice;
    const dx = nx - cab.position.x; const dy = ny - cab.position.y;
    devicesOnCanvas.value.forEach((d) => { if (d.parentCabinetId === cab._uuid) { d.position.x += dx; d.position.y += dy; } });
  }
  dragDevice.value.position.x = nx; dragDevice.value.position.y = ny;
  if (dragDevice.value && dragDevice.value.deviceId !== 'CABINET-42U' && dragDevice.value.deviceId !== 'POWER-CABINET') {
    const device = dragDevice.value as RuntimeDevice; const devPos = device.position;
    const cab = devicesOnCanvas.value.find((d) => d.deviceId === 'CABINET-42U' && devPos.x >= d.position.x && devPos.x <= d.position.x + d.width && devPos.y >= d.position.y && devPos.y <= d.position.y + d.height) as RuntimeDevice | undefined;
    hoveredCabinetId.value = cab ? cab._uuid : null;
    if (cab) { const relY = devPos.y - cab.position.y; const startIdx = Math.max(0, Math.min(41, Math.floor(relY / U_HEIGHT))); hoveredUIndex.value = startIdx; hoveredUSlots.value = [startIdx]; }
    else { hoveredUIndex.value = null; hoveredUSlots.value = []; }
  }
}
function stopDragDevice() {
  if (dragDevice.value && dragDevice.value.deviceId !== 'CABINET-42U' && dragDevice.value.deviceId !== 'POWER-CABINET') {
    const device = dragDevice.value as RuntimeDevice;
    const cabinet = devicesOnCanvas.value.find((d) => (d.deviceId === 'CABINET-42U' || d.deviceId === 'POWER-CABINET') && device.position.x >= d.position.x && device.position.x <= d.position.x + d.width && device.position.y >= d.position.y && device.position.y <= d.position.y + d.height) as RuntimeDevice | undefined;
    if (cabinet) {
      if (cabinet.deviceId === 'CABINET-42U') {
        const innerWidth = cabinet.width - 20;
        let units = Number(window.prompt('该设备占用多少 U？(1-42)', '1'));
        if (!units || units < 1 || units > 42 || Number.isNaN(units)) units = 1;
        const relY = device.position.y - cabinet.position.y;
        let startIdx = Math.floor(relY / U_HEIGHT); startIdx = Math.max(0, Math.min(42 - units, startIdx));
        device.scaleX = innerWidth / device.width;
        const rawScaleY = (units * U_HEIGHT) / device.height; device.scaleY = Math.ceil(rawScaleY * 1000) / 1000;
        device.position.x = cabinet.position.x + (cabinet.width - device.width * device.scaleX) / 2;
        device.position.y = cabinet.position.y + startIdx * U_HEIGHT;
        hoveredUSlots.value = Array.from({ length: units }, (_, i) => startIdx + i);
      }
      device.parentCabinetId = cabinet._uuid;
    } else { device.parentCabinetId = null; }
  }
  hoveredCabinetId.value = null; hoveredUIndex.value = null; hoveredUSlots.value = [];
  dragging.value = false; dragDevice.value = null;
  window.removeEventListener('mousemove', onDragMove); window.removeEventListener('mouseup', stopDragDevice);
}
function startResize(dev: RuntimeDevice, handle: 'tl' | 'tr' | 'bl' | 'br', evt: MouseEvent) {
  activeDeviceId.value = dev._uuid; resizing.value = true; resizeHandle.value = handle; resizeDevice.value = dev;
  const actualWidth = dev.width * (dev.scaleX ?? 1); const actualHeight = dev.height * (dev.scaleY ?? 1);
  resizeStart.value = { x: evt.clientX, y: evt.clientY, width: actualWidth, height: actualHeight, left: dev.position.x, top: dev.position.y };
  window.addEventListener('mousemove', onResizeMove); window.addEventListener('mouseup', stopResize);
}
function onResizeMove(e: MouseEvent) {
  if (!resizing.value || !resizeDevice.value || !resizeHandle.value) return;
  const dx = e.clientX - resizeStart.value.x; const dy = e.clientY - resizeStart.value.y;
  let newWidth = resizeStart.value.width; let newHeight = resizeStart.value.height; let newLeft = resizeStart.value.left; let newTop = resizeStart.value.top;
  switch (resizeHandle.value) { case 'br': newWidth += dx; newHeight += dy; break; case 'tr': newWidth += dx; newHeight -= dy; newTop += dy; break; case 'tl': newWidth -= dx; newHeight -= dy; newLeft += dx; newTop += dy; break; case 'bl': newWidth -= dx; newHeight += dy; newLeft += dx; break; }
  const minSize = 20; newWidth = Math.max(minSize, newWidth); newHeight = Math.max(minSize, newHeight);
  resizeDevice.value.scaleX = newWidth / resizeDevice.value.width; resizeDevice.value.scaleY = newHeight / resizeDevice.value.height; resizeDevice.value.position.x = newLeft; resizeDevice.value.position.y = newTop;
}
function stopResize() { resizing.value = false; resizeDevice.value = null; resizeHandle.value = null; window.removeEventListener('mousemove', onResizeMove); window.removeEventListener('mouseup', stopResize); }

// ========== Connect Edges ==========
function onMouseMove(e: MouseEvent) {
  if (!drawingLine.value) return;
  const rect = canvasRef.value?.getBoundingClientRect();
  mousePos.value = { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
}
function showHighlight(devUUid: string, portId: string) {
  if (!drawingLine.value) return false;
  if (drawingLine.value.devUUid === devUUid && drawingLine.value.portId === portId) return false;
  return true;
}
function getEdgePositions(edge: any) {
  if (!edge || !edge.source || !edge.target) return null;
  const portPos = (devUUid: string, portId: string) => {
    const dev = devicesOnCanvas.value.find((d) => d._uuid === devUUid); if (!dev) return null;
    const port = (dev.layers || []).find((l: any) => l.id === portId); if (!port) return null;
    const sx = (dev as RuntimeDevice).scaleX ?? 1; const sy = (dev as RuntimeDevice).scaleY ?? 1;
    let x = dev.position.x + port.config.x * sx + (port.config.width * sx) / 2;
    let y = dev.position.y + port.config.y * sy + (port.config.height * sy) / 2;
    const angle = dev.rotate || 0; if (angle) { const rad = (angle * Math.PI) / 180; const ox = dev.position.x; const oy = dev.position.y; const dx = x - ox; const dy = y - oy; x = ox + dx * Math.cos(rad) - dy * Math.sin(rad); y = oy + dx * Math.sin(rad) + dy * Math.cos(rad); }
    return { x, y };
  };
  const current = currentCanvasName.value; let source: any = null; let target: any = null;
  if (edge.source.canvas === undefined || edge.source.canvas === current) { if (edge.source.devUUid && edge.source.portId) source = portPos(edge.source.devUUid, edge.source.portId); }
  if ((edge.target as any).canvas === undefined || (edge.target as any).canvas === current) { if ((edge.target as any).devUUid && (edge.target as any).portId) target = portPos((edge.target as any).devUUid, (edge.target as any).portId); }
  // Use logical canvas size (not DOM rect) to match the SVG coordinate system
  const roomList = Object.keys(topoConfigs.value);
  const rect = canvasRef.value?.getBoundingClientRect();
  const cw = rect?.width || 1920;
  const ch = rect?.height || 1080;
  const gapY = Math.max(60, (ch - 240) / Math.max(1, roomList.length));
  let externalName = ''; let externalPoint: any = null;
  if (!source) {
    const name = edge.source.canvas || edge.source.externalRoom || '';
    const idx = roomList.indexOf(name);
    source = { x: cw - 12, y: 120 + (idx >= 0 ? idx : roomList.length) * gapY };
    externalName = name; externalPoint = source;
  }
  if (!target) {
    const name = (edge.target as any).canvas || (edge.target as any).externalRoom || '';
    const idx = roomList.indexOf(name);
    target = { x: cw - 12, y: 120 + (idx >= 0 ? idx : roomList.length) * gapY };
    externalName = name; externalPoint = target;
  }
  if (!source || !target) return null; return { source, target, externalName, externalPoint, color: edge.color || lineColor.value };
}
function onPortClick(devUUid: string, portId: string) {
  const dev = devicesOnCanvas.value.find((d) => d._uuid === devUUid); if (!dev) return;
  const port = (dev.layers || []).find((l: any) => l.id === portId); if (!port) return;
  const sx = (dev as RuntimeDevice).scaleX ?? 1; const sy = (dev as RuntimeDevice).scaleY ?? 1;
  let posX = dev.position.x + port.config.x * sx + (port.config.width * sx) / 2; let posY = dev.position.y + port.config.y * sy + (port.config.height * sy) / 2;
  if (dev.rotate) { const rad = (dev.rotate * Math.PI) / 180; const ox = dev.position.x; const oy = dev.position.y; const dx = posX - ox; const dy = posY - oy; posX = ox + dx * Math.cos(rad) - dy * Math.sin(rad); posY = oy + dx * Math.sin(rad) + dy * Math.cos(rad); }
  const pos = { x: posX, y: posY };
  if (connectMode.value === 'internal') {
    if (drawingLine.value && selectedPort.value) {
      if (selectedPort.value.devUUid !== devUUid || selectedPort.value.portId !== portId) {
        edges.value.push({ color: lineColor.value, source: { devUUid: selectedPort.value.devUUid, portId: selectedPort.value.portId }, target: { devUUid, portId } });
      }
      drawingLine.value = null; selectedPort.value = null; mousePos.value = null;
    } else { drawingLine.value = { devUUid, portId, from: pos }; selectedPort.value = { devUUid, portId }; }
  } else if (connectMode.value === 'external') {
    if (pendingExternalRoom.value && sourceCanvasBackup.value) {
      const source = sourceCanvasBackup.value;
      const edge = { external: true, color: lineColor.value, source: { canvas: source.name || '', devUUid: source.sourcePort.devUUid, portId: source.sourcePort.portId }, target: { canvas: currentCanvasName.value || '', devUUid, portId } };
      source.edges.push(deepClone(edge));
      edges.value.push({ external: true, color: lineColor.value, source: { canvas: currentCanvasName.value || '', devUUid, portId }, target: { canvas: source.name || '', devUUid: source.sourcePort.devUUid, portId: source.sourcePort.portId } });
      if (currentCanvasName.value && topoConfigs.value[currentCanvasName.value]) topoConfigs.value[currentCanvasName.value].edges = deepClone(edges.value);
      devicesOnCanvas.value = source.devices; edges.value = source.edges; if (source.name && topoConfigs.value[source.name]) topoConfigs.value[source.name].edges = deepClone(source.edges);
      currentCanvasName.value = source.name; pendingExternalRoom.value = null; sourceCanvasBackup.value = null; drawingLine.value = null; selectedPort.value = null; mousePos.value = null;
    } else { drawingLine.value = { devUUid, portId, from: pos }; selectedPort.value = { devUUid, portId }; }
  }
}
</script>

<template>
  <div style="padding: 8px; display:flex; height: 100vh; box-sizing: border-box;">
    <div style="flex:1;">
      <TopoToolbar
        :selected-device-id="selectedDeviceId"
        :all-device-options="allDeviceOptions"
        :new-config-name="newConfigName"
        :connect-mode="connectMode"
        :canvas-width="canvasWidth"
        :canvas-height="canvasHeight"
        :line-color="lineColor"
        :show-lines="showLines"
        :connect-enabled="connectEnabled"
        @update:selected-device-id="setSelectedDeviceId"
        @update:new-config-name="setNewConfigName"
        @set-connect-mode="setConnectMode"
        @update:canvas-width="setCanvasWidth"
        @update:canvas-height="setCanvasHeight"
        @update:line-color="setLineColor"
        @update:show-lines="setShowLines"
        @update:connect-enabled="setConnectEnabled"
        @add-device="addDevice"
        @add-cabinet="startNewCabinet"
        @save-current-canvas-to-configs="saveCurrentCanvasToConfigs"
        @remove-selected-device="removeSelectedDevice"
      />

      <div ref="canvasDomRef" style="position: relative; overflow: auto; border: 1px solid #334; background: #0c0f14; height: 100%; width: 100%;">
        <div ref="canvasRef" style="position: relative; width: 100%; height: 100%; background: #141922" @mousemove="onMouseMove">
          <template v-for="dev in devicesOnCanvas" :key="dev._uuid">
            <div :style="{ position: 'absolute', left: dev.position.x + 'px', top: dev.position.y + 'px', width: dev.width + 'px', height: dev.height + 'px', transform: deviceTransform(dev), transformOrigin: 'top left', }" @mousedown="isReadOnly ? null : startDragDevice(dev, $event)">
              <DevicePreviewRender :config="dev" style="pointer-events: none" />
              <!-- Ports overlay: 注意不要再乘 scale，父容器已整体缩放 -->
              <template v-for="port in (dev.layers || []).filter(l=> l.type==='port' || l.type==='port-adv')" :key="port.id">
                <div :style="{
                     position:'absolute',
                     left: port.config.x + 'px',
                     top: port.config.y + 'px',
                     width: port.config.width + 'px',
                     height: port.config.height + 'px',
                     cursor: 'pointer',
                     background: 'transparent',
                     transform: `rotate(${port.config.rotate || 0}deg)`,
                     transformOrigin: 'center center',
                     outline: showHighlight(dev._uuid, port.id) ? '1px dashed #19baff' : 'none',
                     borderRadius: '4px',
                   }" @click.stop="onPortClick(dev._uuid, port.id)"></div>
              </template>
              <!-- resize handles -->
              <template v-if="activeDeviceId === dev._uuid">
                <div v-for="h in ['tl','tr','bl','br']" :key="h" class="resize-handle" :style="handleStyle(dev, h as any)" @mousedown.stop="startResize(dev, h as any, $event)"></div>
              </template>
            </div>
          </template>

          <EdgeLines :edges="edges" :drawing-line="drawingLine" :mouse-pos="mousePos" :get-edge-positions="getEdgePositions" :bezier-path="bezierPath" />
        </div>
      </div>

      <button v-if="showFullScreenPrompt && !isFullscreen" style="position: fixed; right: 16px; bottom: 16px; z-index: 999; padding: 8px 12px; background: #1677ff; color:#fff; border: none; border-radius: 6px;" @click="tryEnterFullscreen">进入全屏</button>
    </div>

    <div v-if="showRightPanel" style="flex:0 0 280px;">
      <CanvasRightPanel
        :topo-configs="topoConfigs"
        :connect-mode="connectMode"
        :drawing-line="drawingLine"
        @exportAllConfigs="() => { const data = JSON.stringify(topoConfigs, null, 2); const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'topology-configs.json'; a.click(); URL.revokeObjectURL(url); }"
        @restoreConfigToCanvas="restoreConfigToCanvas"
        @exportOneConfig="(name: string) => { const cfg = topoConfigs[name]; if (!cfg) return; const data = JSON.stringify(cfg, null, 2); const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${name}.json`; a.click(); URL.revokeObjectURL(url); }"
        @removeConfig="removeConfig"
        @connectToExternalRoom="connectToExternalRoom"
        @importConfigs="(obj: any) => { topoConfigs.value = obj || {}; saveConfigsToStorage(); }"
      />
    </div>
    <button @click="showRightPanel = !showRightPanel" style="position:fixed; top:12px; right:12px; z-index:1000; padding:6px 10px; border:1px solid #345; background:#223; color:#cde; border-radius:6px;">{{ showRightPanel ? '隐藏面板' : '显示面板' }}</button>
  </div>
</template>

<style scoped>
svg { shape-rendering: geometricPrecision; }
.resize-handle { position:absolute; width: 12px; height: 12px; background:#fff; border:2px solid #1976d2; border-radius:2px; cursor: se-resize; z-index: 30; box-shadow: 0 0 2px #1976d299; }
</style>
