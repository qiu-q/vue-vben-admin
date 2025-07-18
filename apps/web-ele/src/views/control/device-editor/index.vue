<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import CanvasEditor from '#/components/business/DeviceEditor/CanvasEditor.vue';
import LayerList from '#/components/business/DeviceEditor/LayerList.vue';
import PalettePanel from '#/components/business/DeviceEditor/PalettePanel.vue';
import PropertyPanel from '#/components/business/DeviceEditor/PropertyPanel.vue';

/* -------------------------------------------------------------------------- */
/* 工具函数                                                                    */
/* -------------------------------------------------------------------------- */
/**
 * 安全深拷贝：优先使用 `structuredClone`，当遇到无法克隆（包含函数 / 循环引用等）
 * 的对象时自动回退到 JSON 方法。
 */
function deepClone<T>(source: T): T {
  try {
    return structuredClone(source);
  } catch {
    return JSON.parse(JSON.stringify(source));
  }
}

/** 键盘组合键监听（自动注册 / 反注册） */
function useKeyStroke(
  target: HTMLElement | Window,
  keymap: (e: KeyboardEvent) => void,
) {
  onMounted(() => target.addEventListener('keydown', keymap));
  onUnmounted(() => target.removeEventListener('keydown', keymap));
}

/* -------------------------------------------------------------------------- */
/* 类型定义                                                                    */
/* -------------------------------------------------------------------------- */
interface DeviceInfo {
  cabinetId: number;
  deviceName: string;
  deviceIpAddress: string;
  deviceSerialNumber: string;
  deviceGateway: string;
  deviceMacAddress: string;
  deviceCommunity: string;
}

interface Config {
  deviceId: string;
  width: number;
  height: number;
  layers: any[];
  materialsTree: any[];
  apiList?: any[];
}

interface MaterialItem {
  id: string;
  name: string;
  url: string;
}

/* -------------------------------------------------------------------------- */
/* 基础状态                                                                    */
/* -------------------------------------------------------------------------- */
const router = useRouter();
const route = useRoute();

const palettePanelRef = ref<InstanceType<typeof PalettePanel>>();

// 路由携带的初始 deviceId（可为空）
const deviceIdFromRoute = route.params.deviceId as string | undefined;

const deviceOptions = ref<{ label: string; value: string }[]>([]);
const deviceRows = ref<any[]>([]);
const selectedDeviceId = ref(deviceIdFromRoute ?? '');
// 是否处于新增模式
const creatingNew = ref(false);

function createDefaultConfig(): Config {
  return {
    deviceId: '',
    width: 1920,
    height: 1080,
    layers: [],
    materialsTree: [],
    apiList: [],
  };
}

const frontConfig = ref<Config>(createDefaultConfig());
const backConfig = ref<Config>(createDefaultConfig());
const detailConfig = ref<Config>(createDefaultConfig());

type ViewType = 'front' | 'back' | 'detail';
const viewType = ref<ViewType>('front');

const config = computed<Config>({
  get() {
    return viewType.value === 'front'
      ? frontConfig.value
      : viewType.value === 'back'
        ? backConfig.value
        : detailConfig.value;
  },
  set(val: Config) {
    if (viewType.value === 'front') frontConfig.value = val;
    else if (viewType.value === 'back') backConfig.value = val;
    else detailConfig.value = val;
  },
});

const allApis = ref<any[]>([]);

function rebuildAllApis() {
  const map = new Map<string, any>();
  for (const row of deviceRows.value) {
    for (const field of ['deviceJson', 'deviceBack', 'deviceDetails']) {
      if (row[field]) {
        try {
          const parsed = JSON.parse(row[field]);
          if (Array.isArray(parsed.apiList)) {
            for (const api of parsed.apiList) {
              map.set(api.id, api);
            }
          }
        } catch {}
      }
    }
  }
  if (Array.isArray(config.value.apiList)) {
    for (const api of config.value.apiList) map.set(api.id, api);
  }
  allApis.value = Array.from(map.values());
}

const deviceInfo = ref<DeviceInfo>({
  cabinetId: 0,
  deviceName: '',
  deviceIpAddress: '',
  deviceSerialNumber: '',
  deviceGateway: '',
  deviceMacAddress: '',
  deviceCommunity: '',
});

const showDeviceInfoModal = ref(false);

const editorWrapRef = ref<HTMLElement | null>(null);
const editorScale = ref(1);
function updateEditorScale() {
  if (!editorWrapRef.value) return;
  const { clientWidth, clientHeight } = editorWrapRef.value;
  const w = config.value.width + 32;
  const h = config.value.height + 32;
  editorScale.value = Math.min(clientWidth / w, clientHeight / h, 1);
}

const PORT_ICON_URL = 'http://192.168.1.99:9000/qiuqiu/green.gif';
const TABLE_ICON_URL =
  'data:image/svg+xml,%3Csvg xmlns%3D"http://www.w3.org/2000/svg" width%3D"56" height%3D"56"%3E%3Crect x%3D"1" y%3D"1" width%3D"54" height%3D"54" fill%3D"%23fff" stroke%3D"%23ccc"/%3E%3Cline x1%3D"1" y1%3D"19" x2%3D"55" y2%3D"19" stroke%3D"%23ccc"/%3E%3Cline x1%3D"1" y1%3D"37" x2%3D"55" y2%3D"37" stroke%3D"%23ccc"/%3E%3Cline x1%3D"19" y1%3D"1" x2%3D"19" y2%3D"55" stroke%3D"%23ccc"/%3E%3Cline x1%3D"37" y1%3D"1" x2%3D"37" y2%3D"55" stroke%3D"%23ccc"/%3E%3C/svg%3E';
const CARD_ICON_URL =
  'data:image/svg+xml,%3Csvg xmlns%3D"http://www.w3.org/2000/svg" width%3D"56" height%3D"56"%3E%3Crect x%3D"1" y%3D"1" width%3D"54" height%3D"54" fill%3D"%23fff" stroke%3D"%23ccc"/%3E%3Ctext x%3D"28" y%3D"34" font-size%3D"20" text-anchor%3D"middle" fill%3D"%23ccc"%3ET%3C/text%3E%3C/svg%3E';

const materialsList = computed<MaterialItem[]>(() => {
  const list: MaterialItem[] = [];
  const tree =
    Array.isArray(config.value.materialsTree) && config.value.materialsTree.length
      ? config.value.materialsTree
      : [
          {
            id: 'root',
            materials: [
              { id: 'port-default', name: '端口', url: PORT_ICON_URL },
              { id: 'table-default', name: '表格', url: TABLE_ICON_URL },
              { id: 'card-default', name: '卡片', url: CARD_ICON_URL },
            ],
            children: [],
          },
        ];
  function walk(nodes: any[]) {
    for (const n of nodes || []) {
      if (Array.isArray(n.materials)) {
        for (const m of n.materials) {
          list.push({ id: m.id, name: m.name, url: m.url });
        }
      }
      if (Array.isArray(n.children)) walk(n.children);
    }
  }
  walk(tree);
  return list;
});

async function fetchDeviceList() {
  try {
    const resp = await fetch('/api/jx-device/Device/list?pageSize=0');
    const json = await resp.json();
    if (json.code === 200) {
      const rows = Array.isArray(json.rows) ? json.rows : [];
      deviceRows.value = rows;
      deviceOptions.value = rows.map((r: any) => ({
        value: String(r.deviceId),
        label: r.deviceName || `设备${r.deviceId}`,
      }));
      if (!selectedDeviceId.value && deviceOptions.value.length > 0)
        selectedDeviceId.value = deviceOptions.value[0].value;
      rebuildAllApis();
    }
  } catch (error) {
    console.error('fetchDeviceList error', error);
  }
}

function startNewDevice() {
  creatingNew.value = true;
  selectedDeviceId.value = '';
  viewType.value = 'front';
  frontConfig.value = createDefaultConfig();
  backConfig.value = createDefaultConfig();
  detailConfig.value = createDefaultConfig();
  deviceInfo.value = {
    cabinetId: 0,
    deviceName: '',
    deviceIpAddress: '',
    deviceSerialNumber: '',
    deviceGateway: '',
    deviceMacAddress: '',
    deviceCommunity: '',
  };
  showDeviceInfoModal.value = true;
  rebuildAllApis();
}

function cloneView(type: ViewType): Config {
  return deepClone(
    type === 'front'
      ? frontConfig.value
      : type === 'back'
        ? backConfig.value
        : detailConfig.value,
  );
}

function copyView(from: ViewType, to: ViewType) {
  const data = cloneView(from);
  if (to === 'front') frontConfig.value = data;
  else if (to === 'back') backConfig.value = data;
  else detailConfig.value = data;
  pushHistory();
  rebuildAllApis();
}

function moveView(from: ViewType, to: ViewType) {
  copyView(from, to);
  const empty = createDefaultConfig();
  if (from === 'front') frontConfig.value = empty;
  else if (from === 'back') backConfig.value = empty;
  else detailConfig.value = empty;
  pushHistory();
  rebuildAllApis();
}

function handleCopyView() {
  const target = prompt(
    '选择要复制到的页面(front/back/detail)',
    viewType.value === 'front' ? 'back' : 'front',
  );
  if (!target) return;
  const t = target.trim() as ViewType;
  if (t === viewType.value || !['front', 'back', 'detail'].includes(t)) return;
  copyView(viewType.value, t);
  alert('复制成功！');
}

function handleMoveView() {
  const target = prompt(
    '选择要迁移到的页面(front/back/detail)',
    viewType.value === 'front' ? 'back' : 'front',
  );
  if (!target) return;
  const t = target.trim() as ViewType;
  if (t === viewType.value || !['front', 'back', 'detail'].includes(t)) return;
  moveView(viewType.value, t);
  alert('迁移成功！');
}

/* -------------------------------------------------------------------------- */
/* 历史撤销栈                                                                  */
/* -------------------------------------------------------------------------- */
const history = ref<Config[]>([deepClone(config.value)]);
const historyIndex = ref(0);

function pushHistory() {
  if (
    JSON.stringify(config.value) ===
    JSON.stringify(history.value[historyIndex.value])
  )
    return;
  history.value = history.value.slice(0, historyIndex.value + 1);
  history.value.push(deepClone(config.value));
  historyIndex.value++;
}
function undo() {
  if (historyIndex.value > 0) {
    historyIndex.value--;
    config.value = deepClone(history.value[historyIndex.value]);
  }
}
function redo() {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++;
    config.value = deepClone(history.value[historyIndex.value]);
  }
}

/* -------------------------------------------------------------------------- */
/* 加载服务器配置                                                              */
/* -------------------------------------------------------------------------- */
async function loadConfig(id: string) {
  if (!id) return;

  try {
    const resp = await fetch(`/api/jx-device/Device/${id}`);
    const json = await resp.json();

    if (json.code === 200 && json.data) {
      const parseCfg = (val: any): Partial<Config> => {
        try {
          const obj = JSON.parse(val ?? '{}');
          return obj && typeof obj === 'object' ? obj : {};
        } catch {
          return {};
        }
      };
      const front = parseCfg(json.data.deviceJson);
      const back = parseCfg(json.data.deviceBack);
      const detail = parseCfg(json.data.deviceDetails);

      for (const obj of [front, back, detail]) {
        obj.layers = Array.isArray(obj.layers) ? obj.layers : [];
        obj.materialsTree = Array.isArray(obj.materialsTree)
          ? obj.materialsTree
          : [];
        obj.apiList = Array.isArray(obj.apiList) ? obj.apiList : [];
      }

      frontConfig.value = { ...createDefaultConfig(), ...front, deviceId: id };
      backConfig.value = { ...createDefaultConfig(), ...back, deviceId: id };
      detailConfig.value = { ...createDefaultConfig(), ...detail, deviceId: id };

      deviceInfo.value = {
        cabinetId: json.data.cabinetId ?? 0,
        deviceName: json.data.deviceName ?? '',
        deviceIpAddress: json.data.deviceIpAddress ?? '',
        deviceSerialNumber: json.data.deviceSerialNumber ?? '',
        deviceGateway: json.data.deviceGateway ?? '',
        deviceMacAddress: json.data.deviceMacAddress ?? '',
        deviceCommunity: json.data.deviceCommunity ?? '',
      };
      creatingNew.value = false;
      rebuildAllApis();
    }
  } catch (error) {
    console.error('加载设备配置失败', error);
  }
}

onMounted(() => {
  fetchDeviceList();
  if (selectedDeviceId.value) loadConfig(selectedDeviceId.value);
  updateEditorScale();
  window.addEventListener('resize', updateEditorScale);
});

watch(selectedDeviceId, (id) => {
  if (id) {
    creatingNew.value = false;
    loadConfig(id);
  }
});
watch(viewType, () => {
  selectedLayerId.value = null;
  rebuildAllApis();
  updateEditorScale();
});
watch(
  () => [config.value.width, config.value.height],
  updateEditorScale,
);
onUnmounted(() => window.removeEventListener('resize', updateEditorScale));

/* -------------------------------------------------------------------------- */
/* 编辑区交互                                                                  */
/* -------------------------------------------------------------------------- */
const selectedLayerId = ref<null | string>(null);

function handleMaterialsTreeUpdate(newTree: any[]) {
  config.value.materialsTree = deepClone(newTree);
  pushHistory();
}
function handleConfigUpdate(updated: Config) {
  config.value = deepClone(updated);
  pushHistory();
  rebuildAllApis();
}
function handleSelectLayer(layerId: string) {
  selectedLayerId.value = layerId;
}
function handleCanvasSizeChange(field: 'height' | 'width', value: number) {
  (config.value as any)[field] = value;
  pushHistory();
}

/* 快捷键撤销 / 重做 */
useKeyStroke(window, (e) => {
  if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
    e.shiftKey ? redo() : undo();
    e.preventDefault();
  } else if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
    redo();
    e.preventDefault();
  }
});

/* -------------------------------------------------------------------------- */
/* 保存到后端                                                                  */
/* -------------------------------------------------------------------------- */
const BASE_URL = '/api/jx-device/Device' as const;

function syncMaterialsTree() {
  if (palettePanelRef.value?.getMaterialsTree) {
    config.value.materialsTree = palettePanelRef.value.getMaterialsTree();
  }
}

async function handleSave() {
  if (!selectedDeviceId.value && !creatingNew.value) {
    alert('请选择设备或点击新增后再保存！');
    return;
  }

  syncMaterialsTree();

  const payload = {
    deviceId: selectedDeviceId.value,
    ...deviceInfo.value,
    deviceJson: JSON.stringify(frontConfig.value),
    deviceBack: JSON.stringify(backConfig.value),
    deviceDetails: JSON.stringify(detailConfig.value),
  };

  try {
    const resp = await fetch(`${BASE_URL}`, {
      method: creatingNew.value ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();

    if (json.code === 200) {
      alert('保存成功！');
      if (creatingNew.value && json.data?.deviceId) {
        selectedDeviceId.value = String(json.data.deviceId);
        creatingNew.value = false;
        fetchDeviceList();
      }
    } else {
      alert(`保存失败：${json.msg ?? '未知错误'}`);
    }
  } catch {
    alert('保存请求失败，请检查网络或服务器');
  }
}

/* -------------------------------------------------------------------------- */
/* 预览                                                                       */
/* -------------------------------------------------------------------------- */
async function handlePreview() {
  await handleSave();
  if (!selectedDeviceId.value) return;
  router.push({ name: 'DeviceView', params: { deviceId: selectedDeviceId.value } });
}
</script>

<template>
  <div class="device-editor flex h-full bg-[#181a20]">
    <!-- 工具栏 -->
    <div
      class="fixed bottom-0 left-0 z-50 flex w-full justify-center gap-3 pb-4"
    >
      <select
        v-model="selectedDeviceId"
        class="rounded bg-white/90 px-2 py-1 text-black"
      >
        <option
          v-for="opt in deviceOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>
      <select v-model="viewType" class="rounded bg-white/90 px-2 py-1 text-black">
        <option value="front">正面</option>
        <option value="back">背面</option>
        <option value="detail">详情</option>
      </select>
      <button
        @click="handleCopyView"
        class="btn-primary border-[#3ae0ff] hover:bg-[#23242a]"
      >
        复制
      </button>
      <button
        @click="handleMoveView"
        class="btn-primary border-[#ff6384] hover:bg-[#23242a]"
      >
        迁移
      </button>
      <button
        @click="startNewDevice"
        class="btn-primary border-[#38dbb8] bg-[#2ba672] hover:bg-[#225a45]"
      >
        新增
      </button>
      <button
        @click="undo"
        :disabled="historyIndex === 0"
        title="Ctrl+Z"
        class="btn-primary border-[#3ae0ff] hover:bg-[#23242a] disabled:opacity-50"
      >
        撤销
      </button>
      <button
        @click="redo"
        :disabled="historyIndex === history.length - 1"
        title="Ctrl+Shift+Z / Ctrl+Y"
        class="btn-primary border-[#3ae0ff] hover:bg-[#23242a] disabled:opacity-50"
      >
        反撤销
      </button>
      <button
        @click="handleSave"
        class="btn-primary border-[#38dbb8] bg-[#2ba672] hover:bg-[#225a45]"
      >
        保存
      </button>
      <button
        @click="handlePreview"
        class="btn-primary border-[#3ae0ff] bg-[#2a69d7] hover:bg-[#154c8a]"
      >
        阅览
      </button>
      <button
        @click="showDeviceInfoModal = true"
        class="btn-primary border-[#ffb638] bg-[#d78a2a] hover:bg-[#8a5b15]"
      >
        设备信息
      </button>
    </div>

    <!-- 设备信息弹窗 -->
    <div
      v-if="showDeviceInfoModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div class="w-[600px] rounded-lg bg-[#20222a] p-6">
        <h3 class="mb-4 text-lg font-bold text-white">设备信息</h3>
        <form @submit.prevent="showDeviceInfoModal = false">
          <div
            class="mb-3"
            v-for="(label, key) in {
              cabinetId: '机柜ID',
              deviceName: '设备名称',
              deviceIpAddress: 'IP地址',
              deviceSerialNumber: '序列号',
              deviceGateway: '网关',
              deviceMacAddress: 'MAC地址',
              deviceCommunity: '设备SNMP',
            }"
            :key="key"
          >
            <label class="block text-sm text-gray-400">{{ label }}</label>
            <input
              v-model="(deviceInfo as any)[key]"
              :type="key === 'cabinetId' ? 'number' : 'text'"
              class="w-full rounded border border-[#444] bg-[#1d1e24] p-2 text-white"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              @click="showDeviceInfoModal = false"
              class="rounded bg-gray-500 px-4 py-2 text-white"
            >
              取消
            </button>
            <button
              type="submit"
              class="rounded bg-blue-500 px-4 py-2 text-white"
            >
              确定
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 左侧面板：素材 & 图层 -->
    <aside class="w-1/6 overflow-y-auto border-r bg-[#181a20] p-2">
      <PalettePanel
        ref="palettePanelRef"
        :config="config"
        @update="handleMaterialsTreeUpdate"
      />
    </aside>
    <aside class="w-1/6 overflow-y-auto border-r bg-[#181a20] p-2">
      <LayerList
        :config="config"
        :selected-layer-id="selectedLayerId"
        @select="handleSelectLayer"
        @update="handleConfigUpdate"
      />
    </aside>

    <!-- 画布编辑区 -->
    <main ref="editorWrapRef" class="relative flex-1 overflow-hidden bg-[#181a20]">
      <div
        :style="{
          transform: `scale(${editorScale})`,
          transformOrigin: 'top left',
          width: `${config.width + 32}px`,
          height: `${config.height + 32}px`,
        }"
      >
        <CanvasEditor
          :config="config"
          :selected-layer-id="selectedLayerId"
          @select="handleSelectLayer"
          @update="handleConfigUpdate"
        />
      </div>
      <div
        v-if="!config"
        class="flex h-full items-center justify-center text-gray-400"
      >
        加载中…
      </div>

    </main>

    <!-- 属性面板 -->
    <aside class="w-1/4 overflow-y-auto border-l bg-[#23242a] p-2">
      <template v-if="selectedLayerId">
        <PropertyPanel
          :config="config"
          :selected-layer-id="selectedLayerId"
          :materials-list="materialsList"
          :all-api-list="allApis"
          @update="handleConfigUpdate"
        />
      </template>
      <template v-else>
        <div>
          <h3 class="mb-2 font-bold">画布设置</h3>
          <div class="mb-2 flex items-center">
            <label>宽度：</label>
            <input
              type="number"
              :value="config.width"
              @input="
                handleCanvasSizeChange(
                  'width',
                  ($event.target as HTMLInputElement).valueAsNumber,
                )
              "
              class="w-20 border p-1"
            />
            <label class="ml-2">高度：</label>
            <input
              type="number"
              :value="config.height"
              @input="
                handleCanvasSizeChange(
                  'height',
                  ($event.target as HTMLInputElement).valueAsNumber,
                )
              "
              class="w-20 border p-1"
            />
          </div>
          <div class="text-gray-400">
            请先选择一个图层，或拖入素材到画布上。
          </div>
        </div>
      </template>
    </aside>
  </div>
</template>

<style scoped>
.btn-primary {
  @apply rounded border bg-[#303848] px-3 py-1 text-white;
}
</style>
