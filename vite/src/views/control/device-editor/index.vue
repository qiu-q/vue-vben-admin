<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import CanvasEditor from '#/components/business/DeviceEditor/CanvasEditor.vue';
import LayerList from '#/components/business/DeviceEditor/LayerList.vue';
import PalettePanel from '#/components/business/DeviceEditor/PalettePanel.vue';
import PropertyPanel from '#/components/business/DeviceEditor/PropertyPanel.vue';

function deepClone<T>(source: T): T { try { return structuredClone(source); } catch { return JSON.parse(JSON.stringify(source)); } }
function useKeyStroke(target: HTMLElement | Window, keymap: (e: KeyboardEvent) => void) { onMounted(() => target.addEventListener('keydown', keymap)); onUnmounted(() => target.removeEventListener('keydown', keymap)); }

interface Config { deviceId: string; width: number; height: number; layers: any[]; materialsTree: any[]; apiList?: any[]; }
interface MaterialItem { id: string; name: string; url: string; }

const router = useRouter();
const route = useRoute();
const palettePanelRef = ref<InstanceType<typeof PalettePanel>>();
const deviceIdFromRoute = route.params.deviceId as string | undefined;
const deviceOptions = ref<{ label: string; value: string }[]>([]);
const deviceRows = ref<any[]>([]);
const selectedDeviceId = ref(deviceIdFromRoute ?? '');
const creatingNew = ref(false);
function createDefaultConfig(): Config { return { deviceId: '', width: 1920, height: 1080, layers: [], materialsTree: [], apiList: [] }; }
function syncApiPush(cfg: Config) { const map = new Map<string, any>(); (cfg.apiList || []).forEach((api) => map.set(api.id, api)); (cfg.layers || []).forEach((layer: any) => { const id = layer.config?.apiId; if (!id) return; const api = map.get(id); if (!api) return; if (typeof api.usePush === 'boolean') { layer.config.usePush = api.usePush; layer.config.pushService = api.usePush ? api.pushUrl || '' : ''; } else if (typeof layer.config.usePush === 'boolean') { api.usePush = layer.config.usePush; api.pushUrl = layer.config.usePush ? layer.config.pushService || '' : ''; } }); }

const frontConfig = ref<Config>(createDefaultConfig());
const backConfig = ref<Config>(createDefaultConfig());
const detailConfig = ref<Config>(createDefaultConfig());
type ViewType = 'front' | 'back' | 'detail';
const viewType = ref<ViewType>('front');
const config = computed<Config>({ get() { return viewType.value === 'front' ? frontConfig.value : viewType.value === 'back' ? backConfig.value : detailConfig.value; }, set(val) { if (viewType.value === 'front') frontConfig.value = val; else if (viewType.value === 'back') backConfig.value = val; else detailConfig.value = val; } });
const allApis = ref<any[]>([]);
function rebuildAllApis() { const map = new Map<string, any>(); for (const row of deviceRows.value) { for (const field of ['deviceJson', 'deviceBack', 'deviceDetails']) { if (row[field]) { try { const parsed = JSON.parse(row[field]); if (Array.isArray(parsed.apiList)) { parsed.apiList.forEach((api: any) => map.set(api.id, api)); } } catch {} } } } config.value.apiList?.forEach((api) => map.set(api.id, api)); allApis.value = Array.from(map.values()); }

const deviceCategory = ref<'network' | 'industrial'>('network');
const deviceInfo = ref({ cabinetId: 0, deviceName: '', deviceIpAddress: '', deviceSerialNumber: '', deviceGateway: '', deviceMacAddress: '', deviceCommunity: '', deviceType: 1, deviceMasterStation: 0, deviceSlaveStation: 0, devicePort: 502 });
const networkFieldMap: Record<string, string> = { cabinetId: '机柜ID', deviceName: '设备名称', deviceIpAddress: 'IP地址', deviceSerialNumber: '序列号', deviceGateway: '网关', deviceMacAddress: 'MAC地址', deviceCommunity: '设备SNMP' };
const industrialFieldMap: Record<string, string> = { cabinetId: '机柜ID', deviceName: '设备名称', deviceIpAddress: 'IP地址', deviceType: '设备类型', deviceMasterStation: '主站', deviceSlaveStation: '从站', devicePort: '端口' };
const showDeviceInfoModal = ref(false);
watch(deviceCategory, (cat) => { if (cat === 'network') deviceInfo.value.deviceType = 1; });

const editorWrapRef = ref<HTMLElement | null>(null);
const editorScale = ref(1);
const userScale = ref(1);
function updateEditorScale() { if (!editorWrapRef.value) return; const { clientWidth, clientHeight } = editorWrapRef.value; editorScale.value = Math.min(clientWidth / (config.value.width + 32), clientHeight / (config.value.height + 32), 1); }
function handleWheel(e: WheelEvent) { if (!e.ctrlKey) return; e.preventDefault(); const factor = e.deltaY > 0 ? 0.9 : 1.1; userScale.value = Math.min(Math.max(userScale.value * factor, 0.5), 4); }
onMounted(() => editorWrapRef.value?.addEventListener('wheel', handleWheel, { passive: false }));
onUnmounted(() => editorWrapRef.value?.removeEventListener('wheel', handleWheel));

const PORT_ICON_URL = `${import.meta.env.VITE_PORT_ICON_BASE || ''}/qiuqiu/green.gif`;
const TABLE_ICON_URL = 'data:image/svg+xml,...';
const CARD_ICON_URL = 'data:image/svg+xml,...';
const materialsList = computed<MaterialItem[]>(() => { const list: MaterialItem[] = []; const tree = config.value.materialsTree?.length ? config.value.materialsTree : [{ id: 'root', materials: [{ id: 'port-default', name: '端口', url: PORT_ICON_URL }, { id: 'table-default', name: '表格', url: TABLE_ICON_URL }, { id: 'card-default', name: '卡片', url: CARD_ICON_URL }], children: [], }]; function walk(nodes: any[]) { for (const n of nodes || []) { if (Array.isArray(n.materials)) list.push(...n.materials); if (Array.isArray(n.children)) walk(n.children); } } walk(tree); return list; });

async function fetchDeviceList() { try { const resp = await fetch('/api/jx-device/Device/list?pageSize=0'); const json = await resp.json(); if (json.code === 200) { deviceRows.value = Array.isArray(json.rows) ? json.rows : []; deviceOptions.value = deviceRows.value.map((r) => ({ value: String(r.deviceId), label: r.deviceName || `设备${r.deviceId}` })); if (!selectedDeviceId.value && deviceOptions.value.length > 0) { selectedDeviceId.value = deviceOptions.value[0].value; } rebuildAllApis(); } } catch (err) { console.error('fetchDeviceList error', err); } }
function startNewDevice() { creatingNew.value = true; selectedDeviceId.value = ''; frontConfig.value = createDefaultConfig(); backConfig.value = createDefaultConfig(); detailConfig.value = createDefaultConfig(); deviceInfo.value = { cabinetId: 0, deviceName: '', deviceIpAddress: '', deviceSerialNumber: '', deviceGateway: '', deviceMacAddress: '', deviceCommunity: '', deviceType: 1, deviceMasterStation: 0, deviceSlaveStation: 0, devicePort: 502 }; deviceCategory.value = 'network'; viewType.value = 'front'; showDeviceInfoModal.value = true; rebuildAllApis(); }
async function loadConfig(id: string) { if (!id) return; try { const resp = await fetch(`/api/jx-device/Device/${id}`); const json = await resp.json(); if (json.code === 200 && json.data) { const parseCfg = (val: any): Partial<Config> => { try { const obj = JSON.parse(val ?? '{}'); return obj && typeof obj === 'object' ? obj : {}; } catch { return {}; } }; const front = parseCfg(json.data.deviceJson); const back = parseCfg(json.data.deviceBack); const detail = parseCfg(json.data.deviceDetails); for (const cfg of [front, back, detail]) { cfg.layers = Array.isArray(cfg.layers) ? cfg.layers : []; cfg.materialsTree = Array.isArray(cfg.materialsTree) ? cfg.materialsTree : []; cfg.apiList = Array.isArray(cfg.apiList) ? cfg.apiList : []; syncApiPush(cfg); } frontConfig.value = { ...createDefaultConfig(), ...front, deviceId: id }; backConfig.value = { ...createDefaultConfig(), ...back, deviceId: id }; detailConfig.value = { ...createDefaultConfig(), ...detail, deviceId: id }; deviceInfo.value = { cabinetId: json.data.cabinetId ?? 0, deviceName: json.data.deviceName ?? '', deviceIpAddress: json.data.deviceIpAddress ?? '', deviceSerialNumber: json.data.deviceSerialNumber ?? '', deviceGateway: json.data.deviceGateway ?? '', deviceMacAddress: json.data.deviceMacAddress ?? '', deviceCommunity: json.data.deviceCommunity ?? '', deviceType: json.data.deviceType ?? 1, deviceMasterStation: json.data.deviceMasterStation ?? 0, deviceSlaveStation: json.data.deviceSlaveStation ?? 0, devicePort: json.data.devicePort ?? 0 }; deviceCategory.value = deviceInfo.value.deviceType === 1 ? 'network' : 'industrial'; creatingNew.value = false; rebuildAllApis(); } } catch (err) { console.error('loadConfig error', err); } }
onMounted(() => { fetchDeviceList(); if (selectedDeviceId.value) loadConfig(selectedDeviceId.value); updateEditorScale(); window.addEventListener('resize', updateEditorScale); });
onUnmounted(() => window.removeEventListener('resize', updateEditorScale));
const lastLoadedDeviceId = ref<string>('');
watch(selectedDeviceId, (id, prev) => { if (prev) lastLoadedDeviceId.value = prev; if (id) loadConfig(id); });
watch(viewType, () => { selectedLayerId.value = null; rebuildAllApis(); updateEditorScale(); });
watch(() => [config.value.width, config.value.height], updateEditorScale);

const selectedLayerId = ref<null | string>(null);
function handleSelectLayer(id: string | null) { selectedLayerId.value = id; }
function handleUpdateConfig(newCfg: Config) { config.value = deepClone(newCfg); pushHistory(); }

const history = ref<Config[]>([]);
const historyIndex = ref(-1);
function pushHistory() { const snapshot = deepClone(config.value); history.value.splice(historyIndex.value + 1); history.value.push(snapshot); historyIndex.value = history.value.length - 1; }
function undo() { if (historyIndex.value > 0) { historyIndex.value -= 1; config.value = deepClone(history.value[historyIndex.value]); } }
function redo() { if (historyIndex.value < history.value.length - 1) { historyIndex.value += 1; config.value = deepClone(history.value[historyIndex.value]); } }
useKeyStroke(window, (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { if (e.shiftKey) redo(); else undo(); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') redo(); });

function handleCopyView() { const target = prompt('复制到视图(front/back/detail)?', 'back') as ViewType | null; if (!target) return; const src = deepClone(config.value); if (target === 'front') frontConfig.value = { ...frontConfig.value, ...src }; if (target === 'back') backConfig.value = { ...backConfig.value, ...src }; if (target === 'detail') detailConfig.value = { ...detailConfig.value, ...src }; pushHistory(); alert('复制完成'); }
function handleMoveView() { const target = prompt('迁移到视图(front/back/detail)?', 'detail') as ViewType | null; if (!target) return; const src = deepClone(config.value); config.value.layers = []; if (target === 'front') frontConfig.value.layers.push(...src.layers); if (target === 'back') backConfig.value.layers.push(...src.layers); if (target === 'detail') detailConfig.value.layers.push(...src.layers); pushHistory(); alert('迁移完成'); }
async function handleSave() { const id = selectedDeviceId.value; try { const payload = { deviceJson: JSON.stringify(frontConfig.value), deviceBack: JSON.stringify(backConfig.value), deviceDetails: JSON.stringify(detailConfig.value), ...deviceInfo.value, }; const method = id ? 'PUT' : 'POST'; const url = '/api/jx-device/Device' + (id ? '' : ''); const resp = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(id ? { deviceId: Number(id) } : {}), ...payload }), }); const json = await resp.json(); if (json.code === 200) { alert('保存成功'); fetchDeviceList(); } else { alert(`保存失败：${json.msg || '未知错误'}`); } } catch (err) { console.error(err); alert('保存失败'); } }
function handlePreview() { if (!selectedDeviceId.value) { alert('请先选择或保存设备'); return; } router.push(`/control/device-view/${selectedDeviceId.value}`); }
async function handleReuseDevice() { const reuseId = prompt('输入要复用的设备ID')?.trim(); if (!reuseId) return; try { const resp = await fetch(`/api/jx-device/Device/${reuseId}`); const json = await resp.json(); if (json.code === 200 && json.data) { const parseCfg = (val: any): Partial<Config> => { try { const obj = JSON.parse(val ?? '{}'); return obj && typeof obj === 'object' ? obj : {}; } catch { return {}; } }; const front = parseCfg(json.data.deviceJson); const back = parseCfg(json.data.deviceBack); const detail = parseCfg(json.data.deviceDetails); for (const cfg of [front, back, detail]) { cfg.layers = Array.isArray(cfg.layers) ? cfg.layers : []; cfg.materialsTree = Array.isArray(cfg.materialsTree) ? cfg.materialsTree : []; cfg.apiList = Array.isArray(cfg.apiList) ? cfg.apiList : []; syncApiPush(cfg); } frontConfig.value = { ...createDefaultConfig(), ...front, deviceId: selectedDeviceId.value }; backConfig.value = { ...createDefaultConfig(), ...back, deviceId: selectedDeviceId.value }; detailConfig.value = { ...createDefaultConfig(), ...detail, deviceId: selectedDeviceId.value }; pushHistory(); rebuildAllApis(); alert('复用成功！'); } else { alert(`复用失败：${json.msg ?? '未知错误'}`); } } catch (err) { console.error('reuse device error', err); alert('复用请求失败，请检查网络或服务器'); } }
function handleExportJson() { const data = JSON.stringify({ front: frontConfig.value, back: backConfig.value, detail: detailConfig.value, }, null, 2); const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `device_${selectedDeviceId.value || 'new'}.json`; a.click(); URL.revokeObjectURL(url); }
const importInputRef = ref<HTMLInputElement>(); function triggerImport() { importInputRef.value?.click(); }
async function handleImportJson(e: Event) { const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return; try { const text = await file.text(); const obj = JSON.parse(text); if (obj.front) frontConfig.value = { ...createDefaultConfig(), ...obj.front }; if (obj.back) backConfig.value = { ...createDefaultConfig(), ...obj.back }; if (obj.detail) detailConfig.value = { ...createDefaultConfig(), ...obj.detail }; pushHistory(); rebuildAllApis(); alert('导入成功！'); } catch (err) { console.error('import json error', err); alert('导入失败，文件格式错误'); } finally { (e.target as HTMLInputElement).value = ''; } }
</script>

<template>
  <div class="device-editor" style="display:flex; height:100vh; background:#181a20;">
    <div style="position:fixed; bottom:0; left:0; z-index:50; display:flex; width:100%; justify-content:center; gap:12px; padding: 0 12px 16px; box-sizing:border-box;">
      <select v-model="selectedDeviceId" style="border-radius:6px; background:rgba(255,255,255,0.9); padding:4px 8px; color:#111;">
        <option v-for="opt in deviceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <select v-model="viewType" style="border-radius:6px; background:rgba(255,255,255,0.9); padding:4px 8px; color:#111;">
        <option value="front">正面</option>
        <option value="back">背面</option>
        <option value="detail">详情</option>
      </select>
      <button @click="handleCopyView" class="btn-primary border-[#3ae0ff] hover:bg-[#23242a]">复制</button>
      <button @click="handleMoveView" class="btn-primary border-[#ff6384] hover:bg-[#23242a]">迁移</button>
      <button @click="startNewDevice" class="btn-primary border-[#38dbb8] bg-[#2ba672] hover:bg-[#225a45]">新增</button>
      <button @click="handleReuseDevice" class="btn-primary border-[#38dbb8] hover:bg-[#23242a]">复用设备</button>
      <button @click="handleExportJson" class="btn-primary border-[#3ae0ff] hover:bg-[#23242a]">导出JSON</button>
      <button @click="triggerImport" class="btn-primary border-[#3ae0ff] hover:bg-[#23242a]">导入JSON</button>
      <input ref="importInputRef" type="file" accept=".json" class="hidden" @change="handleImportJson" />
      <button @click="undo" :disabled="historyIndex === 0" title="Ctrl+Z" class="btn-primary border-[#3ae0ff] hover:bg-[#23242a] disabled:opacity-50">撤销</button>
      <button @click="redo" :disabled="historyIndex === history.length - 1" title="Ctrl+Shift+Z / Ctrl+Y" class="btn-primary border-[#3ae0ff] hover:bg-[#23242a] disabled:opacity-50">反撤销</button>
      <button @click="handleSave" class="btn-primary border-[#38dbb8] bg-[#2ba672] hover:bg-[#225a45]">保存</button>
      <button @click="handlePreview" class="btn-primary border-[#3ae0ff] bg-[#2a69d7] hover:bg-[#154c8a]">阅览</button>
      <button @click="showDeviceInfoModal = true" class="btn-primary border-[#ffb638] bg-[#d78a2a] hover:bg-[#8a5b15]">设备信息</button>
    </div>

    <div ref="editorWrapRef" style="flex:1; padding:12px; overflow:auto;">
      <div :style="{ transform: `scale(${editorScale * userScale})`, transformOrigin: 'top left' }">
        <CanvasEditor :config="config" :model-value="selectedLayerId" :canvas-scale="editorScale * userScale" @select="handleSelectLayer" @update="handleUpdateConfig" />
      </div>
    </div>

    <div style="width: 260px; padding: 12px; border-left: 1px solid #29304b; background: #20222a; box-sizing: border-box;">
      <LayerList :config="config" :selected-layer-id="selectedLayerId" @select="handleSelectLayer" @update="handleUpdateConfig" />
      <div style="height: 12px"></div>
      <PropertyPanel :config="config" :materials-list="materialsList" :selected-layer-id="selectedLayerId" :all-api-list="allApis" @update="handleUpdateConfig" />
    </div>

    <div style="width: 360px; border-left: 1px solid #29304b; background: #1d1f27; box-sizing: border-box;">
      <PalettePanel ref="palettePanelRef" :config="config" />
    </div>
  </div>
</template>

<style scoped>
.btn-primary { border: 1px solid; padding: 6px 10px; border-radius: 6px; color: #cde; background: #223; }
</style>
