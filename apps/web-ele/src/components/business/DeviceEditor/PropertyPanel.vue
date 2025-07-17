<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { uploadFile } from '#/api/device';
import { WS_URLS } from '#/constants/ws';


const uOptions = [1, 2, 3, 4, 6, 8, 10];
const uCount = ref<number | 'custom'>(1); // 当前选择的U数
const customU = ref<number>(1);           // 自定义U数输入


// =============================================
// props & emits
// =============================================
type MaterialItem = { id: string; name: string; url: string };
const props = defineProps<{
  config: any;
  materialsList?: MaterialItem[];
  selectedLayerId?: null | string;
  allApiList?: any[];
}>();
const emit = defineEmits(['update']);

// =============================================
// 当前选中图层
// =============================================
const selectedLayer = computed(() => {
  if (!props.selectedLayerId) return null;
  return props.config.layers.find((l: any) => l.id === props.selectedLayerId);
});

const availableApis = computed(() => {
  const map = new Map<string, any>();
  (props.allApiList || []).forEach((api) => map.set(api.id, api));
  apiList.value.forEach((api) => map.set(api.id, api));
  return Array.from(map.values());
});

function getKeyOptions(apiId: string): string[] {
  const api = availableApis.value.find((a) => a.id === apiId);
  if (!api || !api.lastSample) return [];
  return collectKeys(api.lastSample);
}

const cardKeyOptions = computed(() => getKeyOptions(cardApiId.value));
const tableKeyOptions = computed(() => getKeyOptions(tableApiId.value));

// =============================================
// 页面级接口（apiList）管理
// =============================================
const apiList = ref<Array<any>>(
  props.config.apiList ? JSON.parse(JSON.stringify(props.config.apiList)) : [],
);

watch(
  () => props.config.apiList,
  (val) => {
    apiList.value = val ? JSON.parse(JSON.stringify(val)) : [];
  },
  { immediate: true },
);

function syncApiList() {
  props.config.apiList = JSON.parse(JSON.stringify(apiList.value));
  emit('update', props.config);
}

function addApi() {
  apiList.value.push({
    id: `api-${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    name: '新接口',
    url: '',
    method: 'GET',
    interval: 3000,
    params: '',
    lastSample: null,
    usePush: false,               // ✅ 新增
    pushUrl: '',                  // ✅ 新增，默认未选择
  });
  syncApiList();
}
function removeApi(idx: number) {
  apiList.value.splice(idx, 1);
  syncApiList();
}
async function testApi(idx: number) {
  const api = apiList.value[idx];
  try {
    const resp = await (api.method === 'POST'
      ? fetch(api.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: api.params || '{}',
      })
      : fetch(api.url));
    api.lastSample = await resp.json();
  } catch {
    api.lastSample = { error: '请求失败' };
  }
  syncApiList();
}
function updateApiField(idx: number, field: string, val: any) {
  apiList.value[idx][field] = val;
  syncApiList();
}

// =============================================
// ⚡ 新增：解析接口返回中的 “端口 → 状态” 字典
// =============================================
function extractPortMap(sample: any): Record<string, any> {
  if (sample?.portstatuslist && typeof sample.portstatuslist === 'object') {
    // 兼容旧格式
    return sample.portstatuslist;
  }
  if (
    sample?.data?.portNameAndState &&
    typeof sample.data.portNameAndState === 'object'
  ) {
    // 兼容新格式
    return sample.data.portNameAndState;
  }
  return {};
}

function collectKeys(obj: any, prefix = ''): string[] {
  const results: string[] = [];
  if (prefix) results.push(prefix);
  if (Array.isArray(obj)) {
    // 若数组元素为对象，递归其首个元素以暴露子路径
    if (obj.length && typeof obj[0] === 'object') {
      results.push(...collectKeys(obj[0], prefix));
    }
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      results.push(...collectKeys(v, p));
    }
  }
  return Array.from(new Set(results));
}

// =============================================
// 动态端口 & 推送设置
// =============================================
const dynamicPort = ref(false);
const selectedApiId = ref('');
const portKey = ref('');
const testResult = ref<any>(null);

// ⚡ 新增：保存解析后的端口字典
const portMap = ref<Record<string, any>>({});

const statusList = ref<
  Array<{ iconUrl: string; label: string; value: number | string }>
>([]);

// ----- 表格配置 -----
const tableDataStr = ref('');
const tableApiId = ref('');
const tableScrollY = ref(false);
const tableDataKey = ref('');

// ----- 卡片配置 -----
const cardText = ref('文本');
const cardFontSize = ref(14);
const cardColor = ref('#ffffff');
const cardBackground = ref('#2d323c');
const cardApiId = ref('');
const cardDataKey = ref('');

// —— 推送相关
const usePush = ref(false);
const pushServices = Object.keys(WS_URLS) as Array<keyof typeof WS_URLS>;
const pushService = ref<'' | keyof typeof WS_URLS>('');

// =============================================
// 端口状态测试 & 映射
// =============================================
function handleApiTestUse(idx: number) {
  selectedApiId.value = apiList.value[idx].id;

  // 保存完整响应做调试
  testResult.value = apiList.value[idx].lastSample;

  // 抽取 “端口 → 状态” 映射
  portMap.value = extractPortMap(testResult.value);

  // 预选第一个端口
  const keys = Object.keys(portMap.value);
  portKey.value = keys[0] || '';

  updateStatusList();
}

function updateStatusList() {
  if (!portMap.value || !Object.keys(portMap.value).length) return;

  // 去重得到所有状态值，如 "1"、"2"
  const uniq = Array.from(new Set(Object.values(portMap.value)));
  statusList.value = uniq.map((v) => ({
    value: v,
    label: '',
    iconUrl: '',
  }));
}
function addStatus() {
  statusList.value.push({ value: '', label: '', iconUrl: '' });
}
function removeStatus(idx: number) {
  statusList.value.splice(idx, 1);
}

// 选择 & 上传图标
const iconSelectVisible = ref(false);
const iconSelectIdx = ref(-1);
function selectIcon(idx: number) {
  iconSelectIdx.value = idx;
  iconSelectVisible.value = true;
}
function handlePickIcon(url: string) {
  if (iconSelectIdx.value >= 0)
    statusList.value[iconSelectIdx.value].iconUrl = url;
  iconSelectVisible.value = false;
}
async function handleUploadIcon(e: Event, idx: number) {
  const files = (e.target as HTMLInputElement).files;
  if (!files?.length) return;
  const formData = new FormData();
  formData.append('file', files[0]);
  const res = await uploadFile(formData);
  const url = res?.data;
  if (url) statusList.value[idx].iconUrl = url;
}

// =============================================
// 保存到图层
// =============================================
function handleSave() {
  if (!selectedLayer.value) return;
  selectedLayer.value.type = 'port';
  selectedLayer.value.config.dynamic = true;
  selectedLayer.value.config.apiId = selectedApiId.value;
  selectedLayer.value.config.portKey = portKey.value;
  selectedLayer.value.config.usePush = usePush.value;
  selectedLayer.value.config.pushService = pushService.value;

  // 状态映射
  const mapping: Record<number | string, any> = {};
  for (const row of statusList.value) {
    mapping[row.value] = { iconUrl: row.iconUrl, label: row.label };
  }
  selectedLayer.value.config.statusMapping = mapping;
// 同步 push 设置到 apiList 中对应接口
  const api = apiList.value.find(a => a.id === selectedApiId.value);
  if (api) {
    api.usePush = usePush.value;
    if (usePush.value && pushService.value) {
      api.pushUrl = pushService.value;
    } else {
      delete api.pushUrl;
    }
  }
  syncApiList(); // 记得同步回 props.config.apiList


  emit('update', props.config);

}

function handleSaveTable() {
  if (!selectedLayer.value) return;
  selectedLayer.value.type = 'table';
  try {
    selectedLayer.value.config.data = tableDataStr.value
      ? JSON.parse(tableDataStr.value)
      : [];
  } catch {
    alert('JSON 格式错误');
    return;
  }
  selectedLayer.value.config.apiId = tableApiId.value;
  selectedLayer.value.config.dataKey = tableDataKey.value;
  selectedLayer.value.config.scrollY = tableScrollY.value;
  emit('update', props.config);
  alert('属性已保存！');
}

function handleSaveCard() {
  if (!selectedLayer.value) return;
  selectedLayer.value.type = 'card';
  selectedLayer.value.config.text = cardText.value;
  selectedLayer.value.config.fontSize = cardFontSize.value;
  selectedLayer.value.config.color = cardColor.value;
  selectedLayer.value.config.background = cardBackground.value;
  selectedLayer.value.config.apiId = cardApiId.value;
  selectedLayer.value.config.dataKey = cardDataKey.value;
  emit('update', props.config);
  alert('属性已保存！');
}

function updateField(field: string, value: any) {
  if (!selectedLayer.value) return;
  selectedLayer.value.config[field] = value;
  emit('update', props.config);
}

// 推送设置 watch ⽀持及时写回图层
watch([usePush, pushService], () => {
  if (!selectedLayer.value) return;
  selectedLayer.value.config.usePush = usePush.value;
  selectedLayer.value.config.pushService = pushService.value;
  emit('update', props.config);
});

watch(tableApiId, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'table') return;
  selectedLayer.value.config.apiId = tableApiId.value;
  const opts = getKeyOptions(tableApiId.value);
  if (!tableDataKey.value && opts.length) tableDataKey.value = opts[0];
  emit('update', props.config);
});

watch(tableScrollY, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'table') return;
  selectedLayer.value.config.scrollY = tableScrollY.value;
  emit('update', props.config);
});

watch(tableDataKey, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'table') return;
  selectedLayer.value.config.dataKey = tableDataKey.value;
  emit('update', props.config);
});

watch(cardDataKey, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'card') return;
  selectedLayer.value.config.dataKey = cardDataKey.value;
  emit('update', props.config);
});

watch(cardApiId, () => {
  const opts = getKeyOptions(cardApiId.value);
  if (!cardDataKey.value && opts.length) cardDataKey.value = opts[0];
});

watch(tableApiId, () => {
  const opts = getKeyOptions(tableApiId.value);
  if (!tableDataKey.value && opts.length) tableDataKey.value = opts[0];
});

watch(selectedApiId, () => {
  const api = availableApis.value.find((a) => a.id === selectedApiId.value);
  if (api && api.lastSample) {
    portMap.value = extractPortMap(api.lastSample);
    const keys = Object.keys(portMap.value);
    portKey.value = keys[0] || '';
    updateStatusList();
  } else {
    portMap.value = {};
    portKey.value = '';
    statusList.value = [];
  }
});

watch([cardText, cardFontSize, cardColor, cardBackground, cardApiId, cardDataKey], () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'card') return;
  selectedLayer.value.config.text = cardText.value;
  selectedLayer.value.config.fontSize = cardFontSize.value;
  selectedLayer.value.config.color = cardColor.value;
  selectedLayer.value.config.background = cardBackground.value;
  selectedLayer.value.config.apiId = cardApiId.value;
  selectedLayer.value.config.dataKey = cardDataKey.value;
  emit('update', props.config);
});

// 初始化时恢复
watch(
  () => selectedLayer.value,
  (layer) => {
    if (!layer) return;
    dynamicPort.value = layer.type === 'port' && !!layer.config.dynamic;
    selectedApiId.value = layer.config.apiId || '';
    portKey.value = layer.config.portKey || '';
    usePush.value = !!layer.config.usePush;
    pushService.value = layer.config.pushService || '';

    tableApiId.value = layer.type === 'table' ? layer.config.apiId || '' : '';
    tableDataStr.value = layer.type === 'table'
      ? JSON.stringify(layer.config.data || [], null, 2)
      : '';
    tableDataKey.value = layer.type === 'table' ? layer.config.dataKey || '' : '';
    tableScrollY.value = layer.type === 'table' ? !!layer.config.scrollY : false;

    cardText.value = layer.type === 'card' ? layer.config.text || '文本' : '文本';
    cardFontSize.value = layer.type === 'card' ? layer.config.fontSize || 14 : 14;
    cardColor.value = layer.type === 'card' ? layer.config.color || '#ffffff' : '#ffffff';
    cardBackground.value = layer.type === 'card' ? layer.config.background || '#2d323c' : '#2d323c';
    cardApiId.value = layer.type === 'card' ? layer.config.apiId || '' : '';
    cardDataKey.value = layer.type === 'card' ? layer.config.dataKey || '' : '';

    // 恢复映射
    const mapping = layer.config.statusMapping || {};
    statusList.value = Object.keys(mapping).map((k) => ({
      value: k,
      label: mapping[k].label || '',
      iconUrl: mapping[k].iconUrl || '',
    }));

    const api = availableApis.value.find(a => a.id === selectedApiId.value);
    if (api && api.lastSample) {
      portMap.value = extractPortMap(api.lastSample);
    } else {
      portMap.value = {};
    }
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <h3 class="mb-2 font-bold">属性面板</h3>

    <!-- ================== 选择了图层 ================== -->
    <div v-if="selectedLayer">
      <!-- 通用属性 -->
      <div class="mb-2">
        <label>名称：</label>
        <input v-model="selectedLayer.name" class="border p-1" />
      </div>

      <div v-if="selectedLayer.config">
        <!-- 位置信息 -->
        <div class="mb-2">
          <label>X：</label>
          <input
            type="number"
            :value="selectedLayer.config.x"
            @input="updateField('x', ($event.target as HTMLInputElement).valueAsNumber)"
            class="w-16 border p-1"
          />
          <label class="ml-2">Y：</label>
          <input
            type="number"
            :value="selectedLayer.config.y"
            @input="updateField('y', ($event.target as HTMLInputElement).valueAsNumber)"
            class="w-16 border p-1"
          />
        </div>
        <div class="mb-2 flex items-center">
          <label>宽：</label>
          <input
            type="number"
            min="1"
            :value="selectedLayer.config.width"
            @input="updateField('width', ($event.target as HTMLInputElement).valueAsNumber)"
            class="w-20 border p-1"
            style="width:90px"
            placeholder="宽度px"
          />
          <button
            type="button"
            class="ml-1 border px-2 py-1 text-xs"
            @click="updateField('width', 600)"
            v-if="selectedLayer.config.width !== 600"
          >600标准</button>

          <label class="ml-4">高：</label>
          <select
            v-model="uCount"
            @change="onUCountChange"
            class="border p-1"
            style="width:80px"
          >
            <option v-for="u in uOptions" :key="u" :value="u">{{ u }}U</option>
            <option value="custom">自定义</option>
          </select>
          <input
            v-if="uCount === 'custom'"
            type="number"
            min="1"
            :value="customU"
            @input="onCustomUInput"
            class="w-16 border p-1 ml-1"
            placeholder="U数"
            style="width:70px"
          />
          <span class="ml-2 text-xs text-gray-400">= {{ selectedLayer.config.height || 0 }} px</span>
        </div>
        <div class="mb-2">
          <label>Z-Index：</label>
          <input
            type="number"
            :value="selectedLayer.zIndex"
            @input="
              selectedLayer.zIndex = ($event.target as HTMLInputElement).valueAsNumber;
              emit('update', props.config);
            "
            class="w-16 border p-1"
          />
        </div>

        <!-- ================== 动态端口设置 ================== -->
        <div v-if="selectedLayer.type === 'port'" class="mt-4 border-t pt-3">
          <label>
            <input type="checkbox" v-model="dynamicPort" /> 启用动态端口
          </label>

        <div v-if="dynamicPort" class="mt-2">
          <div class="mb-2">
            <label>绑定接口：</label>
            <select v-model="selectedApiId" class="border p-1 w-44">
              <option value="">(无)</option>
              <option v-for="api in availableApis" :key="api.id" :value="api.id">
                {{ api.url || api.name }}
              </option>
            </select>
          </div>
          <!-- 推送设置 -->



            <!-- 端口 key & 状态映射 -->
            <div v-if="selectedApiId && Object.keys(portMap).length" class="mt-2">
              <label>选择端口 key：</label>
              <select
                v-model="portKey"
                @change="updateStatusList"
                class="w-44 border p-1"
              >
                <option v-for="k in Object.keys(portMap)" :key="k" :value="k">
                  {{ k }}
                </option>
              </select>
            </div>

            <div v-if="portKey" class="mt-3">
              <div class="mb-1 flex items-center font-bold">
                状态映射
                <button
                  class="ml-2 rounded border px-2 py-1 text-xs"
                  @click="addStatus"
                >
                  +新增状态
                </button>
              </div>

              <div
                v-for="(row, idx) in statusList"
                :key="idx"
                class="mb-1 flex items-center"
              >
                <input
                  v-model="row.value"
                  placeholder="值"
                  class="mr-2 w-12 border p-1"
                />
                <input
                  v-model="row.label"
                  placeholder="标签"
                  class="mr-2 w-20 border p-1"
                />
                <img v-if="row.iconUrl" :src="row.iconUrl" class="mr-2 h-7 w-7" />
                <button
                  class="mr-1 rounded border px-2 py-1 text-xs"
                  @click="selectIcon(idx)"
                >
                  选择图标
                </button>
                <input
                  type="file"
                  accept="image/*"
                  style="width: 60px"
                  class="mr-2"
                  @change="(e) => handleUploadIcon(e, idx)"
                />
                <button @click="removeStatus(idx)" class="text-xs text-red-600">
                  删除
                </button>
              </div>
            </div>

            <button class="mt-4 rounded border px-3 py-1" @click="handleSave">
              保存配置
            </button>
          </div>
        </div>

        <!-- ================== 表格数据设置 ================== -->
        <div v-else-if="selectedLayer.type === 'table'" class="mt-4 border-t pt-3">
          <div class="mb-2">
            <label>绑定接口：</label>
            <select v-model="tableApiId" class="border p-1">
              <option value="">(无)</option>
              <option v-for="api in availableApis" :key="api.id" :value="api.id">
                {{ api.url || api.name }}
              </option>
            </select>
          </div>
          <div class="mb-2" v-if="tableApiId">
            <label>取值 Key：</label>
            <select v-model="tableDataKey" class="border p-1">
              <option value="">(根)</option>
              <option v-for="k in tableKeyOptions" :key="k" :value="k">{{ k }}</option>
            </select>
          </div>
          <div class="mb-2">
            <label>
              <input type="checkbox" v-model="tableScrollY" /> 启用纵向滚动
            </label>
          </div>
          <div class="mb-2">
            <label class="mb-1 block">静态 JSON 数据：</label>
            <textarea v-model="tableDataStr" rows="4" class="w-full border p-1 text-xs"></textarea>
          </div>
          <button class="mt-2 rounded border px-3 py-1" @click="handleSaveTable">保存配置</button>
        </div>
        <!-- ================== 卡片设置 ================== -->
        <div v-else-if="selectedLayer.type === 'card'" class="mt-4 border-t pt-3">
          <div class="mb-2">
            <label>文本：</label>
            <input v-model="cardText" class="border p-1 w-full" />
          </div>
          <div class="mb-2">
            <label>绑定接口：</label>
            <select v-model="cardApiId" class="border p-1">
              <option value="">(无)</option>
              <option v-for="api in availableApis" :key="api.id" :value="api.id">
                {{ api.url || api.name }}
              </option>
            </select>
          </div>
          <div class="mb-2">
            <label>取值 Key：</label>
            <select v-model="cardDataKey" class="border p-1" :disabled="!cardApiId">
              <option value="">(无)</option>
              <option v-for="k in cardKeyOptions" :key="k" :value="k">{{ k }}</option>
            </select>
          </div>
          <div class="mb-2">
            <label>字体大小：</label>
            <input type="number" v-model.number="cardFontSize" class="w-20 border p-1" />
          </div>
          <div class="mb-2">
            <label>文字颜色：</label>
            <input type="color" v-model="cardColor" />
          </div>
          <div class="mb-2">
            <label>背景颜色：</label>
            <input type="color" v-model="cardBackground" />
          </div>
          <button class="mt-2 rounded border px-3 py-1" @click="handleSaveCard">保存配置</button>
        </div>
      </div>

      <div v-else class="text-gray-400">该图层无可编辑属性</div>
    </div>

    <!-- ================== 未选择图层 ================== -->
    <div v-else class="text-gray-400">请先点击选择一个图层</div>

<div class="mt-4 border-t pt-3">
  <div>
    <b>页面数据源接口列表：</b>
    <button @click="addApi" class="ml-2 rounded border px-2 py-1 text-xs">+新增接口</button>
  </div>
  <div v-for="(api, idx) in apiList" :key="api.id" class="mb-1 rounded border p-2">
    <div class="mt-1">
      <label>
        <input type="checkbox" v-model="api.usePush" /> 启用 WebSocket 推送
      </label>
      <select v-if="api.usePush" v-model="api.pushUrl" class="ml-2 w-44 border p-1">
        <option value="">选择推送通道</option>
        <option v-for="s in pushServices" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>
    <div>
      <input v-model="api.name" placeholder="接口名" class="mr-2 w-28 border px-2 py-1" />
      <select v-model="api.method" class="mr-2 w-16 border px-2 py-1">
        <option value="GET">GET</option>
        <option value="POST">POST</option>
      </select>
      <input v-model="api.url" placeholder="URL" class="mr-2 w-60 border px-2 py-1" />
      <input type="number" v-model="api.interval" :disabled="usePush" min="100" step="100" class="mr-2 w-20 border px-2 py-1" placeholder="轮询ms" />
      <button @click="testApi(idx)" class="rounded border px-2 py-1 text-xs">测试</button>
      <button @click="removeApi(idx)" class="ml-1 rounded border px-2 py-1 text-xs text-red-600">删除</button>
    </div>
    <div v-if="api.method === 'POST'" class="mt-1">
      <textarea v-model="api.params" class="w-full border p-1 text-xs" rows="2" placeholder="POST body JSON"></textarea>
    </div>
    <div v-if="api.lastSample" class="mt-1 text-xs text-gray-400 break-all">
      <span v-if="api.lastSample.error" style="color: #e55757">{{ api.lastSample.error }}</span>
      <span v-else>返回：{{ JSON.stringify(api.lastSample) }}</span>
      <button @click="handleApiTestUse(idx)" class="ml-2 text-xs text-blue-500">选择本接口进行映射</button>
    </div>
  </div>
</div>
    <!-- ================== 图标选择弹窗 ================== -->
    <div
      v-if="iconSelectVisible"
      class="fixed inset-0 z-[6000] bg-[rgba(0,0,0,0.35)]"
    >
      <div
        class="pointer-events-auto m-20 mx-auto w-[480px] rounded-lg bg-[#24283b] p-5 shadow-lg"
      >
        <div class="mb-2 font-bold">选择素材库图标</div>
        <div class="max-h-[220px] overflow-auto">
          <template v-for="mat in props.materialsList || []" :key="mat.id">
            <img
              :src="mat.url"
              class="m-1 inline-block h-14 w-14 cursor-pointer rounded border bg-white p-1 hover:shadow-lg"
              @click="handlePickIcon(mat.url)"
            />
          </template>
        </div>
        <div class="text-right">
          <button
            class="mt-2 rounded border px-4 py-1"
            @click="iconSelectVisible = false"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
