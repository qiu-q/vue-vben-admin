<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
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
const selectedDeviceId = ref(deviceIdFromRoute ?? '');
// 是否处于新增模式
const creatingNew = ref(false);

const config = ref<Config>({
  deviceId: '',
  width: 900,
  height: 600,
  layers: [],
  materialsTree: [],
});

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

/* -------------------- 预览 -------------------- */
const showPreview = ref(false);
const previewConfig = ref<Config>(deepClone(config.value));
const handleClosePreview = () => (showPreview.value = false);

async function fetchDeviceList() {
  try {
    const resp = await fetch('/api/jx-device/Device/list?pageSize=0');
    const json = await resp.json();
    if (json.code === 200) {
      const rows = Array.isArray(json.rows) ? json.rows : [];
      deviceOptions.value = rows.map((r: any) => ({
        value: String(r.deviceId),
        label: r.deviceName || `设备${r.deviceId}`,
      }));
      if (!selectedDeviceId.value && deviceOptions.value.length > 0)
        selectedDeviceId.value = deviceOptions.value[0].value;
    }
  } catch (error) {
    console.error('fetchDeviceList error', error);
  }
}

function startNewDevice() {
  creatingNew.value = true;
  selectedDeviceId.value = '';
  config.value = {
    deviceId: '',
    width: 900,
    height: 600,
    layers: [],
    materialsTree: [],
  };
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
      let parsed: Partial<Config> = {};
      try {
        parsed = JSON.parse(json.data.deviceJson);
      } catch {
        console.error('deviceJson 解析失败，使用默认空配置');
      }

      // 保证字段安全
      parsed.layers = Array.isArray(parsed.layers) ? parsed.layers : [];
      parsed.materialsTree = Array.isArray(parsed.materialsTree)
        ? parsed.materialsTree
        : [];

      config.value = { ...config.value, ...parsed } as Config;
      config.value.deviceId = id;

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
    }
  } catch (error) {
    console.error('加载设备配置失败', error);
  }
}

onMounted(() => {
  fetchDeviceList();
  if (selectedDeviceId.value) loadConfig(selectedDeviceId.value);
});

watch(selectedDeviceId, (id) => {
  if (id) {
    creatingNew.value = false;
    loadConfig(id);
  }
});

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
    deviceJson: JSON.stringify(config.value),
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
  previewConfig.value = deepClone(config.value);
  showPreview.value = true;
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
        预览
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
    <main class="relative flex-1 overflow-hidden bg-[#181a20]">
      <CanvasEditor
        :config="config"
        :selected-layer-id="selectedLayerId"
        @select="handleSelectLayer"
        @update="handleConfigUpdate"
      />
      <div
        v-if="!config"
        class="flex h-full items-center justify-center text-gray-400"
      >
        加载中…
      </div>

      <!-- 预览弹窗 -->
      <div
        v-if="showPreview"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      >
        <div
          class="relative rounded-lg bg-[#20222a] p-6 shadow-xl"
          style="width: 920px; min-height: 640px"
        >
          <button
            @click="handleClosePreview"
            class="absolute right-3 top-2 text-lg font-bold text-[#888] hover:text-[#f44]"
            title="关闭"
          >
            ×
          </button>
          <h3 class="mb-4 text-lg font-bold text-white">预览效果</h3>
          <CanvasEditor
            :config="previewConfig"
            style="pointer-events: none; opacity: 1"
          />
        </div>
      </div>
    </main>

    <!-- 属性面板 -->
    <aside class="w-1/4 overflow-y-auto border-l bg-[#23242a] p-2">
      <template v-if="selectedLayerId">
        <PropertyPanel
          :config="config"
          :selected-layer-id="selectedLayerId"
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
