<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import JsonPreviewModal from '#/components/common/JsonPreviewModal.vue';

import { uploadFile } from '#/api/device';
import { WS_URLS } from '#/constants/ws';

const pushServices = Object.keys(WS_URLS) as Array<keyof typeof WS_URLS>;

// 允许直接设置像素高度，不再限制 U 数


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

// 当接口启用或修改推送通道时，同步到引用它的所有图层
watch(
  apiList,
  (list) => {
    const map = new Map(list.map((a) => [a.id, a]));
    let changed = false;
    props.config.layers.forEach((layer: any) => {
      const cfg = layer.config || {};
      const api = map.get(cfg.apiId);
      if (api && typeof api.usePush === 'boolean') {
        const pushUrl = api.usePush ? api.pushUrl || '' : '';
        if (cfg.usePush !== api.usePush || cfg.pushService !== pushUrl) {
          cfg.usePush = api.usePush;
          cfg.pushService = pushUrl;
          changed = true;
        }
      }
    });
    if (changed) emit('update', props.config);
  },
  { deep: true },
);

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
    if (obj.length) {
      // 兼容旧行为，保留不带索引的路径
      results.push(...collectKeys(obj[0], prefix));
      obj.forEach((item, idx) => {
        const p = prefix ? `${prefix}[${idx}]` : `[${idx}]`;
        results.push(...collectKeys(item, p));
      });
    }
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      results.push(...collectKeys(v, p));
    }
  }
  return Array.from(new Set(results));
}

function getValueByPath(obj: any, path: string) {
  const keys = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  return keys.reduce((o: any, k: string) => {
    if (o && typeof o === 'object') {
      if (Array.isArray(o)) {
        const idx = Number(k);
        if (!Number.isNaN(idx)) return o[idx];
        return o.length ? o[0][k] : undefined;
      }
      return o[k];
    }
    return undefined;
  }, obj);
}

// =============================================
// 动态端口 & 推送设置
// =============================================
const dynamicPort = ref(false);
const selectedApiId = ref('');
const portKey = ref('');
const testResult = ref<any>(null);
// JSON 预览弹窗
const jsonPreviewVisible = ref(false);
const jsonPreviewData = ref<any>(null);
const jsonPreviewTitle = ref('');

function openJsonPreview(api: any) {
  jsonPreviewData.value = api?.lastSample ?? null;
  jsonPreviewTitle.value = api?.name || api?.url || 'JSON 预览';
  jsonPreviewVisible.value = true;
}

function openJsonPreviewRaw(data: any, title = 'JSON 预览') {
  jsonPreviewData.value = data ?? null;
  jsonPreviewTitle.value = title;
  jsonPreviewVisible.value = true;
}

async function handlePreviewClick(idx: number) {
  const api = apiList.value[idx];
  if (!api.lastSample) {
    await testApi(idx);
  }
  openJsonPreview(api);
}

function handleRowDblClick(e: MouseEvent, idx: number) {
  const t = e.target as HTMLElement | null;
  if (!t) return;
  const tag = t.closest('input, textarea, select, button, img, label');
  if (tag) return; // 避免编辑时误触
  handlePreviewClick(idx);
}

// ⚡ 新增：保存解析后的端口字典
const portMap = ref<Record<string, any>>({});

const statusList = ref<
  Array<{ iconUrl: string; label: string; value: number | string }>
>([]);

// ========= 高级端口配置 =========
const advApiId = ref('');
const advPortDataKey = ref('');
const advPortKey = ref('');
const advPortMap = ref<Record<string, any>>({});
const advStatusList = ref<
  Array<{ iconUrl: string; label: string; value: number | string }>
>([]);
const advTestResult = ref<any>(null);

// ======== 高级端口事件配置 ========
const advHoverApiId = ref('');
const advHoverDataKey = ref('');
const advClickApiId = ref('');
const advClickDataKey = ref('');
const advDblApiId = ref('');
const advDblDataKey = ref('');
const advTripleApiId = ref('');
const advTripleDataKey = ref('');
const advHoverKeyOptions = computed(() => getKeyOptions(advHoverApiId.value));
const advClickKeyOptions = computed(() => getKeyOptions(advClickApiId.value));
const advDblKeyOptions = computed(() => getKeyOptions(advDblApiId.value));
const advTripleKeyOptions = computed(() => getKeyOptions(advTripleApiId.value));

// ----- 表格配置 -----
const tableDataStr = ref('');
const tableApiId = ref('');
const tableScrollY = ref(false);
const tableDataKey = ref('');
const tableHeaderSize = ref('');
const tableFontSize = ref('');
const tableColumnsStr = ref('');

// ----- 卡片配置 -----
const cardText = ref('文本');
const cardFontSize = ref(14);
const cardColor = ref('#ffffff');
const cardBackground = ref('#2d323c');
const cardApiId = ref('');
const cardDataKey = ref('');


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

  const prevRows = new Map(
    statusList.value.map((row) => [String(row.value), { label: row.label, iconUrl: row.iconUrl }]),
  );
  const cfgMap =
    (selectedLayer.value && selectedLayer.value.config.statusMapping) || ({} as Record<string, any>);

  // 合并当前端口状态和手动添加的状态，避免丢失用户配置
  const values = [
    ...Object.values(portMap.value),
    ...statusList.value.map((r) => r.value),
  ];
  const uniq = Array.from(new Set(values.map((v) => String(v))));

  statusList.value = uniq.map((v) => ({
    value: v,
    label: prevRows.get(v)?.label || cfgMap[v]?.label || '',
    iconUrl: prevRows.get(v)?.iconUrl || cfgMap[v]?.iconUrl || '',
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
const isAdvIcon = ref(false);
function selectIcon(idx: number) {
  iconSelectIdx.value = idx;
  isAdvIcon.value = false;
  iconSelectVisible.value = true;
}
function handlePickIcon(url: string) {
  if (iconSelectIdx.value >= 0) {
    if (isAdvIcon.value) advStatusList.value[iconSelectIdx.value].iconUrl = url;
    else statusList.value[iconSelectIdx.value].iconUrl = url;
  }
  iconSelectVisible.value = false;
}
async function handleUploadIcon(e: Event, idx: number) {
  const files = (e.target as HTMLInputElement).files;
  if (!files?.length) return;
  const formData = new FormData();
  formData.append('file', files[0]);
  const res = await uploadFile(formData);
  const url = res?.data;
  if (url) {
    if (isAdvIcon.value) advStatusList.value[idx].iconUrl = url;
    else statusList.value[idx].iconUrl = url;
  }
}

// ======== 高级端口：状态映射与图标 ========
function updateAdvStatusList() {
  const prev = new Map(
    advStatusList.value.map((row) => [String(row.value), { label: row.label, iconUrl: row.iconUrl }]),
  );
  const cfgMap =
    (selectedLayer.value && selectedLayer.value.config.statusMapping) || ({} as Record<string, any>);

  // 若选中端口的状态可解析，则仅使用该值；否则使用整个映射对象的值
  const sample =
    advPortKey.value && advPortMap.value[advPortKey.value] !== undefined
      ? advPortMap.value[advPortKey.value]
      : undefined;

  const values = [] as any[];
  if (sample !== undefined) {
    Array.isArray(sample) ? values.push(...sample) : values.push(sample);
  } else if (advPortMap.value && Object.keys(advPortMap.value).length) {
    values.push(...Object.values(advPortMap.value));
  }

  // 合并手动添加的状态值，避免保存后丢失
  values.push(...advStatusList.value.map((r) => r.value));
  const uniq = Array.from(new Set(values.map((v) => String(v))));

  advStatusList.value = uniq.map((v) => ({
    value: v,
    label: prev.get(v)?.label || cfgMap[v]?.label || '',
    iconUrl: prev.get(v)?.iconUrl || cfgMap[v]?.iconUrl || '',
  }));
}
function addAdvStatus() {
  advStatusList.value.push({ value: '', label: '', iconUrl: '' });
}
function removeAdvStatus(idx: number) {
  advStatusList.value.splice(idx, 1);
}
function selectAdvIcon(idx: number) {
  iconSelectIdx.value = idx;
  isAdvIcon.value = true;
  iconSelectVisible.value = true;
}
async function handleUploadAdvIcon(e: Event, idx: number) {
  isAdvIcon.value = true;
  await handleUploadIcon(e, idx);
}

// =============================================
// 保存到图层
// =============================================
function handleSave() {
  if (!selectedLayer.value) return;
  selectedLayer.value.type = dynamicPort.value ? 'port' : 'image';
  selectedLayer.value.config.dynamic = dynamicPort.value;
  selectedLayer.value.config.apiId = selectedApiId.value;
  selectedLayer.value.config.portKey = portKey.value;
  // 状态映射
  const mapping: Record<number | string, any> = {};
  for (const row of statusList.value) {
    mapping[row.value] = { iconUrl: row.iconUrl, label: row.label };
  }
  selectedLayer.value.config.statusMapping = mapping;
  syncApiList(); // 记得同步回 props.config.apiList

  emit('update', props.config);
  alert('属性已保存！');

}

function handleSaveAdv() {
  if (!selectedLayer.value) return;
  selectedLayer.value.type = 'port-adv';
  selectedLayer.value.config.apiId = advApiId.value;
  selectedLayer.value.config.portDataKey = advPortDataKey.value;
  selectedLayer.value.config.portKey = advPortKey.value;
  const mapping: Record<number | string, any> = {};
  for (const row of advStatusList.value) {
    mapping[row.value] = { iconUrl: row.iconUrl, label: row.label };
  }
  selectedLayer.value.config.statusMapping = mapping;
  const events: Record<string, any> = {};
  if (advHoverApiId.value)
    events.hover = { apiId: advHoverApiId.value, dataKey: advHoverDataKey.value };
  if (advClickApiId.value)
    events.click = { apiId: advClickApiId.value, dataKey: advClickDataKey.value };
  if (advDblApiId.value)
    events.dblclick = { apiId: advDblApiId.value, dataKey: advDblDataKey.value };
  if (advTripleApiId.value)
    events.triple = { apiId: advTripleApiId.value, dataKey: advTripleDataKey.value };
  selectedLayer.value.config.events = events;
  syncApiList();
  emit('update', props.config);
  alert('属性已保存！');
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
  let columns: any = [];
  if (tableColumnsStr.value) {
    try {
      columns = JSON.parse(tableColumnsStr.value);
      if (!Array.isArray(columns)) throw new Error();
    } catch {
      alert('列配置 JSON 格式错误');
      return;
    }
  }
  selectedLayer.value.config.apiId = tableApiId.value;
  selectedLayer.value.config.dataKey = tableDataKey.value;
  selectedLayer.value.config.scrollY = tableScrollY.value;
  selectedLayer.value.config.columns = columns;
  selectedLayer.value.config.headerSize = tableHeaderSize.value;
  selectedLayer.value.config.fontSize = tableFontSize.value;
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


watch(tableApiId, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'table') return;
  const opts = getKeyOptions(tableApiId.value);
  if (!tableDataKey.value && opts.length) tableDataKey.value = opts[0];
  if (selectedLayer.value.config.apiId !== tableApiId.value) {
    selectedLayer.value.config.apiId = tableApiId.value;
    emit('update', props.config);
  }
});

watch(tableScrollY, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'table') return;
  if (selectedLayer.value.config.scrollY !== tableScrollY.value) {
    selectedLayer.value.config.scrollY = tableScrollY.value;
    emit('update', props.config);
  }
});

watch(tableDataKey, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'table') return;
  if (selectedLayer.value.config.dataKey !== tableDataKey.value) {
    selectedLayer.value.config.dataKey = tableDataKey.value;
    emit('update', props.config);
  }
});

watch(cardDataKey, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'card') return;
  if (selectedLayer.value.config.dataKey !== cardDataKey.value) {
    selectedLayer.value.config.dataKey = cardDataKey.value;
    emit('update', props.config);
  }
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
    testResult.value = api.lastSample;
    portMap.value = extractPortMap(api.lastSample);
    const keys = Object.keys(portMap.value);
    portKey.value = keys[0] || '';
    updateStatusList();
  } else {
    testResult.value = null;
    portMap.value = {};
    portKey.value = '';
    statusList.value = [];
  }
});

function updateAdvPortMap() {
  const api = availableApis.value.find((a) => a.id === advApiId.value);
  if (api && api.lastSample) {
    advTestResult.value = api.lastSample;
    const data = advPortDataKey.value
      ? getValueByPath(api.lastSample, advPortDataKey.value)
      : extractPortMap(api.lastSample);
    if (data && typeof data === 'object') {
      advPortMap.value = data;
      const keys = Object.keys(data);
      advPortKey.value = advPortKey.value && keys.includes(advPortKey.value)
        ? advPortKey.value
        : keys[0] || '';
    } else if (data !== undefined) {
      advPortMap.value = { value: data } as Record<string, any>;
      advPortKey.value = 'value';
    } else {
      advPortMap.value = {};
      advPortKey.value = '';
    }
    updateAdvStatusList();
  } else {
    advTestResult.value = null;
    advPortMap.value = {};
    advPortKey.value = '';
    advStatusList.value = [];
  }
}

watch(advApiId, updateAdvPortMap);
watch(advPortDataKey, updateAdvPortMap);
watch(advPortKey, updateAdvStatusList);

watch(dynamicPort, () => {
  if (!selectedLayer.value) return;
  selectedLayer.value.config.dynamic = dynamicPort.value;
  if (dynamicPort.value) selectedLayer.value.type = 'port';
  else if (selectedLayer.value.type === 'port') selectedLayer.value.type = 'image';
  emit('update', props.config);
});

watch([cardText, cardFontSize, cardColor, cardBackground, cardApiId, cardDataKey], () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'card') return;
  const cfg = selectedLayer.value.config;
  if (
    cfg.text !== cardText.value ||
    cfg.fontSize !== cardFontSize.value ||
    cfg.color !== cardColor.value ||
    cfg.background !== cardBackground.value ||
    cfg.apiId !== cardApiId.value ||
    cfg.dataKey !== cardDataKey.value
  ) {
    cfg.text = cardText.value;
    cfg.fontSize = cardFontSize.value;
    cfg.color = cardColor.value;
    cfg.background = cardBackground.value;
    cfg.apiId = cardApiId.value;
    cfg.dataKey = cardDataKey.value;
    emit('update', props.config);
  }
});

watch(tableApiId, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'table') return;
  selectedLayer.value.config.apiId = tableApiId.value;
  const opts = getKeyOptions(tableApiId.value);
  if (!tableDataKey.value && opts.length) tableDataKey.value = opts[0];
  const api = availableApis.value.find((a) => a.id === tableApiId.value);
  testResult.value = api?.lastSample || null;
  emit('update', props.config);
});

watch(tableScrollY, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'table') return;
  selectedLayer.value.config.scrollY = tableScrollY.value;
  emit('update', props.config);
});

watch(tableHeaderSize, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'table') return;
  selectedLayer.value.config.headerSize = tableHeaderSize.value;
  emit('update', props.config);
});

watch(tableFontSize, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'table') return;
  selectedLayer.value.config.fontSize = tableFontSize.value;
  emit('update', props.config);
});

watch(tableColumnsStr, () => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'table') return;
  try {
    const cols = tableColumnsStr.value ? JSON.parse(tableColumnsStr.value) : [];
    if (!Array.isArray(cols) && tableColumnsStr.value) return;
    selectedLayer.value.config.columns = cols;
    emit('update', props.config);
  } catch {}
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
    dynamicPort.value = !!layer.config.dynamic;
    selectedApiId.value = layer.config.apiId || '';
    portKey.value = layer.config.portKey || '';
    tableApiId.value = layer.type === 'table' ? layer.config.apiId || '' : '';
    tableDataStr.value = layer.type === 'table'
      ? JSON.stringify(layer.config.data || [], null, 2)
      : '';
    tableDataKey.value = layer.type === 'table' ? layer.config.dataKey || '' : '';
    tableScrollY.value = layer.type === 'table' ? !!layer.config.scrollY : false;
    tableHeaderSize.value = layer.type === 'table' ? layer.config.headerSize || '' : '';
    tableFontSize.value = layer.type === 'table' ? layer.config.fontSize || '' : '';
    tableColumnsStr.value = layer.type === 'table'
      ? JSON.stringify(layer.config.columns || [], null, 2)
      : '';

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
      testResult.value = api.lastSample;
      portMap.value = extractPortMap(api.lastSample);
    } else {
      testResult.value = null;
      portMap.value = {};
    }

    // ====== 高级端口恢复 ======
    advApiId.value = layer.type === 'port-adv' ? layer.config.apiId || '' : '';
    advPortDataKey.value = layer.type === 'port-adv' ? layer.config.portDataKey || '' : '';
    advPortKey.value = layer.type === 'port-adv' ? layer.config.portKey || '' : '';
    advStatusList.value = layer.type === 'port-adv'
      ? Object.keys(mapping).map((k) => ({
          value: k,
          label: mapping[k].label || '',
          iconUrl: mapping[k].iconUrl || '',
        }))
      : [];
    if (layer.type === 'port-adv') {
      const apiAdv = availableApis.value.find((a) => a.id === advApiId.value);
      if (apiAdv && apiAdv.lastSample) {
        advTestResult.value = apiAdv.lastSample;
        const data = advPortDataKey.value
          ? getValueByPath(apiAdv.lastSample, advPortDataKey.value)
          : extractPortMap(apiAdv.lastSample);
        if (data && typeof data === 'object') {
          advPortMap.value = data;
          const keys = Object.keys(data);
          advPortKey.value = advPortKey.value && keys.includes(advPortKey.value)
            ? advPortKey.value
            : keys[0] || '';
        } else if (data !== undefined) {
          advPortMap.value = { value: data } as Record<string, any>;
          advPortKey.value = 'value';
        } else {
          advPortMap.value = {};
          advPortKey.value = '';
        }
        updateAdvStatusList();
      } else {
        advTestResult.value = null;
        advPortMap.value = {};
        advPortKey.value = '';
        advStatusList.value = [];
      }
    }

    const events = layer.type === 'port-adv' ? layer.config.events || {} : {};
    advHoverApiId.value = events.hover?.apiId || '';
    advHoverDataKey.value = events.hover?.dataKey || '';
    advClickApiId.value = events.click?.apiId || '';
    advClickDataKey.value = events.click?.dataKey || '';
    advDblApiId.value = events.dblclick?.apiId || '';
    advDblDataKey.value = events.dblclick?.dataKey || '';
    advTripleApiId.value = events.triple?.apiId || '';
    advTripleDataKey.value = events.triple?.dataKey || '';
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
          <input
            type="number"
            min="1"
            :value="selectedLayer.config.height"
            @input="updateField('height', ($event.target as HTMLInputElement).valueAsNumber)"
            class="w-20 border p-1"
            style="width:90px"
            placeholder="高度px"
          />
          <label class="ml-4">旋转：</label>
          <input
            type="number"
            :value="selectedLayer.config.rotate || 0"
            @input="updateField('rotate', ($event.target as HTMLInputElement).valueAsNumber)"
            class="w-20 border p-1"
            style="width:90px"
            placeholder="角度"
          />
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
        <div v-if="selectedLayer.type === 'port' || selectedLayer.type === 'image'" class="mt-4 border-t pt-3">
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
        <!-- ================== 高级端口映射 ================== -->
        <div v-else-if="selectedLayer.type === 'port-adv'" class="mt-4 border-t pt-3">
          <div class="mb-2">
            <label>绑定接口：</label>
            <select v-model="advApiId" class="border p-1 w-44">
              <option value="">(无)</option>
              <option v-for="api in availableApis" :key="api.id" :value="api.id">
                {{ api.url || api.name }}
              </option>
            </select>
          </div>
          <div class="mb-2" v-if="advApiId">
            <label>取值 Key：</label>
            <select v-model="advPortDataKey" class="border p-1 w-44">
              <option value="">(回退)</option>
              <option v-for="k in getKeyOptions(advApiId)" :key="k" :value="k">{{ k }}</option>
            </select>
          </div>
          <div v-if="advApiId && Object.keys(advPortMap).length" class="mt-2">
            <label>端口选择：</label>
            <select v-model="advPortKey" class="w-44 border p-1">
              <option v-for="k in Object.keys(advPortMap)" :key="k" :value="k">{{ k }}</option>
            </select>
          </div>
          <div v-if="advPortKey" class="mt-3">
            <div class="mb-1 flex items-center font-bold">
              状态映射
              <button class="ml-2 rounded border px-2 py-1 text-xs" @click="addAdvStatus">+新增状态</button>
            </div>
            <div v-for="(row, idx) in advStatusList" :key="idx" class="mb-1 flex items-center">
              <input v-model="row.value" placeholder="值" class="mr-2 w-12 border p-1" />
              <input v-model="row.label" placeholder="标签" class="mr-2 w-20 border p-1" />
              <img v-if="row.iconUrl" :src="row.iconUrl" class="mr-2 h-7 w-7" />
              <button class="mr-1 rounded border px-2 py-1 text-xs" @click="selectAdvIcon(idx)">选择图标</button>
              <input type="file" accept="image/*" style="width: 60px" class="mr-2" @change="(e) => handleUploadAdvIcon(e, idx)" />
              <button @click="removeAdvStatus(idx)" class="text-xs text-red-600">删除</button>
            </div>
          </div>
          <div class="mt-3">
            <div class="mb-1 font-bold">事件弹窗</div>
            <div class="mb-2">
              <label>鼠标移入接口：</label>
              <select v-model="advHoverApiId" class="border p-1 w-44">
                <option value="">(无)</option>
                <option v-for="api in availableApis" :key="api.id" :value="api.id">{{ api.url || api.name }}</option>
              </select>
              <div v-if="advHoverApiId" class="mt-1">
                <label>取值 Key：</label>
                <select v-model="advHoverDataKey" class="border p-1 w-44">
                  <option value="">(根)</option>
                  <option v-for="k in advHoverKeyOptions" :key="k" :value="k">{{ k }}</option>
                </select>
              </div>
            </div>
            <div class="mb-2">
              <label>单击接口：</label>
              <select v-model="advClickApiId" class="border p-1 w-44">
                <option value="">(无)</option>
                <option v-for="api in availableApis" :key="api.id" :value="api.id">{{ api.url || api.name }}</option>
              </select>
              <div v-if="advClickApiId" class="mt-1">
                <label>取值 Key：</label>
                <select v-model="advClickDataKey" class="border p-1 w-44">
                  <option value="">(根)</option>
                  <option v-for="k in advClickKeyOptions" :key="k" :value="k">{{ k }}</option>
                </select>
              </div>
            </div>
            <div class="mb-2">
              <label>双击接口：</label>
              <select v-model="advDblApiId" class="border p-1 w-44">
                <option value="">(无)</option>
                <option v-for="api in availableApis" :key="api.id" :value="api.id">{{ api.url || api.name }}</option>
              </select>
              <div v-if="advDblApiId" class="mt-1">
                <label>取值 Key：</label>
                <select v-model="advDblDataKey" class="border p-1 w-44">
                  <option value="">(根)</option>
                  <option v-for="k in advDblKeyOptions" :key="k" :value="k">{{ k }}</option>
                </select>
              </div>
            </div>
            <div class="mb-2">
              <label>三击接口：</label>
              <select v-model="advTripleApiId" class="border p-1 w-44">
                <option value="">(无)</option>
                <option v-for="api in availableApis" :key="api.id" :value="api.id">{{ api.url || api.name }}</option>
              </select>
              <div v-if="advTripleApiId" class="mt-1">
                <label>取值 Key：</label>
                <select v-model="advTripleDataKey" class="border p-1 w-44">
                  <option value="">(根)</option>
                  <option v-for="k in advTripleKeyOptions" :key="k" :value="k">{{ k }}</option>
                </select>
              </div>
            </div>
          </div>
          <button class="mt-4 rounded border px-3 py-1" @click="handleSaveAdv">保存配置</button>
          <div v-if="advTestResult" class="mt-2">
            <div class="mb-1 flex items-center justify-between">
              <label class="block">接口返回：</label>
              <button class="rounded border px-2 py-1 text-xs" @click="openJsonPreviewRaw(advTestResult, '接口返回预览')">在弹窗预览</button>
            </div>
            <pre class="max-h-40 overflow-auto bg-[#1e1e1e] p-1 text-xs text-white">{{ JSON.stringify(advTestResult, null, 2) }}</pre>
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
            <label>表头高度：</label>
            <input v-model="tableHeaderSize" class="w-24 border p-1" placeholder="如 2.4em" />
          </div>
          <div class="mb-2">
            <label>字体大小：</label>
            <input v-model="tableFontSize" class="w-24 border p-1" placeholder="如 14px" />
          </div>
          <div class="mb-2">
            <label>
              <input type="checkbox" v-model="tableScrollY" /> 启用纵向滚动
            </label>
          </div>
          <div class="mb-2">
            <label class="mb-1 block">列配置(JSON)：</label>
            <textarea v-model="tableColumnsStr" rows="2" class="w-full border p-1 text-xs"></textarea>
          </div>
          <div class="mb-2">
            <label class="mb-1 block">静态 JSON 数据：</label>
            <textarea v-model="tableDataStr" rows="4" class="w-full border p-1 text-xs"></textarea>
          </div>
          <div v-if="testResult" class="mb-2">
            <div class="mb-1 flex items-center justify-between">
              <label class="block">接口返回：</label>
              <button class="rounded border px-2 py-1 text-xs" @click="openJsonPreviewRaw(testResult, '接口返回预览')">在弹窗预览</button>
            </div>
            <pre class="max-h-40 overflow-auto bg-[#1e1e1e] p-1 text-xs text-white">{{ JSON.stringify(testResult, null, 2) }}</pre>
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
  <div
    v-for="(api, idx) in apiList"
    :key="api.id"
    class="mb-1 rounded border p-2"
    @dblclick="(e) => handleRowDblClick(e, idx)"
  >
    <div class="mt-1">
      <label>
        <input
          type="checkbox"
          :checked="api.usePush"
          @change="
            updateApiField(
              idx,
              'usePush',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        启用 WebSocket 推送
      </label>
      <select
        v-if="api.usePush"
        :value="api.pushUrl"
        @change="
          updateApiField(
            idx,
            'pushUrl',
            ($event.target as HTMLSelectElement).value,
          )
        "
        class="ml-2 w-44 border p-1"
      >
        <option value="">选择推送通道</option>
        <option v-for="s in pushServices" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>
    <div>
      <input
        :value="api.name"
        @input="
          updateApiField(idx, 'name', ($event.target as HTMLInputElement).value)
        "
        placeholder="接口名"
        class="mr-2 w-28 border px-2 py-1"
      />
      <select
        :value="api.method"
        @change="
          updateApiField(idx, 'method', ($event.target as HTMLSelectElement).value)
        "
        class="mr-2 w-16 border px-2 py-1"
      >
        <option value="GET">GET</option>
        <option value="POST">POST</option>
      </select>
      <input
        :value="api.url"
        @input="
          updateApiField(idx, 'url', ($event.target as HTMLInputElement).value)
        "
        placeholder="URL"
        class="mr-2 w-60 border px-2 py-1"
      />
      <input
        type="number"
        :value="api.interval"
        :disabled="api.usePush"
        min="100"
        step="100"
        class="mr-2 w-20 border px-2 py-1"
        placeholder="轮询ms"
        @input="
          updateApiField(
            idx,
            'interval',
            ($event.target as HTMLInputElement).valueAsNumber,
          )
        "
      />
      <button @click="testApi(idx)" class="rounded border px-2 py-1 text-xs">测试</button>
      <button @click="removeApi(idx)" class="ml-1 rounded border px-2 py-1 text-xs text-red-600">删除</button>
    </div>
    <div v-if="api.method === 'POST'" class="mt-1">
      <textarea
        :value="api.params"
        class="w-full border p-1 text-xs"
        rows="2"
        placeholder="POST body JSON"
        @input="
          updateApiField(idx, 'params', ($event.target as HTMLTextAreaElement).value)
        "
      ></textarea>
    </div>
    <div class="mt-1 text-xs text-gray-400">
      <span v-if="api.lastSample?.error" style="color: #e55757">{{ api.lastSample.error }}</span>
      <button
        class="ml-2 rounded border px-2 py-1 text-xs"
        @click="handlePreviewClick(idx)"
        title="如未测试，将自动测试后预览"
      >
        预览返回
      </button>
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

    <!-- JSON 预览弹窗 -->
    <JsonPreviewModal
      v-model="jsonPreviewVisible"
      :data="jsonPreviewData"
      :title="jsonPreviewTitle"
    />
  </div>
</template>
