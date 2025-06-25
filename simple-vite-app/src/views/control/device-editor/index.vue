<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getDeviceConfig, saveDeviceConfig } from '#/api/device';

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

// 由路由携带的 deviceId —— 不存在则阻止保存
const deviceIdFromRoute = route.params.deviceId as string | undefined;

const config = ref<Config>({
  deviceId: deviceIdFromRoute ?? '',
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
async function loadConfig() {
  if (!deviceIdFromRoute) return;

  try {
    const json = await getDeviceConfig(deviceIdFromRoute);

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
      if (!config.value.deviceId) config.value.deviceId = deviceIdFromRoute;

      deviceInfo.value = {
        cabinetId: json.data.cabinetId ?? 0,
        deviceName: json.data.deviceName ?? '',
        deviceIpAddress: json.data.deviceIpAddress ?? '',
        deviceSerialNumber: json.data.deviceSerialNumber ?? '',
        deviceGateway: json.data.deviceGateway ?? '',
        deviceMacAddress: json.data.deviceMacAddress ?? '',
        deviceCommunity: json.data.deviceCommunity ?? '',
      };
    }
  } catch (error) {
    console.error('加载设备配置失败', error);
  }
}

onMounted(loadConfig);

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

function syncMaterialsTree() {
  if (palettePanelRef.value?.getMaterialsTree) {
    config.value.materialsTree = palettePanelRef.value.getMaterialsTree();
  }
}

async function handleSave() {
  // 路由中若没有 deviceId，直接阻止保存
  if (!deviceIdFromRoute) {
    alert('当前路由缺少 deviceId，无法保存！');
    return;
  }

  syncMaterialsTree();

  const payload = {
    deviceId: deviceIdFromRoute,
    ...deviceInfo.value,
    deviceJson: JSON.stringify(config.value),
  };

  try {
    const json = await saveDeviceConfig(payload);

    if (json.code === 200) {
      alert('保存成功！');
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
    <div class="fixed bottom-0 left-0 w-full z-50 flex justify-center gap-3 pb-4">
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
