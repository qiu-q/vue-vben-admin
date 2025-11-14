<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import JsonPreviewModal from '#/components/common/JsonPreviewModal.vue';
import { uploadFile } from '#/api/device';

type ApiItem = { id: string; name?: string; url: string; method: 'GET'|'POST'; params?: string; lastSample?: any };

type MaterialItem = { id: string; name: string; url: string };

const props = defineProps<{
  config: any;
  availableApis: ApiItem[];
  materialsList?: MaterialItem[];
}>();
const emit = defineEmits(['update', 'applied']);

const open = ref(true);
const selectedApiIds = ref<string[]>([]);
const goal = ref('偏向端口状态，hover 显示设备名与状态');
const useCurrentAsSample = ref(true);
const sampleJson = ref<any>(null);
const sampleFileName = ref('');
const suggestion = ref<any>(null);
const previewVisible = ref(false);
const apiPreviewVisible = ref(false);
const apiPreviewData = ref<any>(null);
const apiPreviewTitle = ref('');
const loading = ref(false);
const errorMsg = ref('');
const replaceMode = ref(false);

const availableApisList = computed(() => Array.isArray((props as any).availableApis) ? (props as any).availableApis as ApiItem[] : []);
const selectedApis = computed(() => availableApisList.value.filter(a => selectedApiIds.value.includes(a.id)));

// 下拉多选状态
const selectOpen = ref(false);
const apiFilter = ref('');
const filteredApis = computed(() => {
  const f = apiFilter.value.trim().toLowerCase();
  const list = availableApisList.value;
  if (!f) return list;
  return list.filter((a) => (a.url || a.name || a.id).toLowerCase().includes(f));
});

function selectAll() { selectedApiIds.value = availableApisList.value.map((a) => a.id); }
function selectNone() { selectedApiIds.value = []; }

// 采集接口样本
const collecting = ref(false);
const sampleMap = ref<Record<string, any>>({});
const sampleStats = ref({ ok: 0, fail: 0 });

async function fetchApiSample(api: ApiItem): Promise<any> {
  try {
    if (api.method === 'POST') {
      const resp = await fetch(api.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: api.params || '{}',
      });
      return await resp.json();
    }
    const resp = await fetch(api.url);
    return await resp.json();
  } catch (e) {
    // fallback via server to bypass CORS
    try {
      const resp = await fetch('/ai/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: api.url, method: api.method || 'GET', body: api.method === 'POST' ? (api.params || '{}') : undefined }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || 'server fetch error');
      return json.data;
    } catch (err) {
      return { _error: String(err) };
    }
  }
}

async function collectSamples() {
  if (!selectedApis.value.length) return;
  collecting.value = true;
  sampleStats.value = { ok: 0, fail: 0 };
  const map: Record<string, any> = {};
  for (const api of selectedApis.value) {
    const data = await fetchApiSample(api);
    map[api.id] = data;
    if (data && !data._error) sampleStats.value.ok += 1;
    else sampleStats.value.fail += 1;
  }
  sampleMap.value = map;
  collecting.value = false;
}

watch(open, (v) => { if (v) collectSamples(); });
onMounted(() => { if (open.value) collectSamples(); });

function handleSampleJsonChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  if (!f) { sampleJson.value = null; sampleFileName.value = ''; return; }
  f.text().then((t) => {
    try { sampleJson.value = JSON.parse(t); sampleFileName.value = f.name; }
    catch { sampleJson.value = null; alert('示例 JSON 解析失败'); }
  });
}

function openApiPreview(api: ApiItem) {
  const data = sampleMap.value[api.id] ?? api.lastSample ?? null;
  apiPreviewData.value = data;
  apiPreviewTitle.value = api.url || api.name || api.id;
  apiPreviewVisible.value = true;
}

// 端口状态样式（用户上传/选择）
const statusStyles = ref<Array<{ value: string; label: string; iconUrl: string }>>([
  { value: 'true', label: '开', iconUrl: '' },
  { value: 'false', label: '关', iconUrl: '' },
]);
function addStyle() { statusStyles.value.push({ value: '', label: '', iconUrl: '' }); }
function removeStyle(i: number) { statusStyles.value.splice(i, 1); }
async function handleUploadIcon(e: Event, idx: number) {
  const files = (e.target as HTMLInputElement).files;
  if (!files?.length) return;
  const formData = new FormData();
  formData.append('file', files[0]);
  try {
    const res = await uploadFile(formData);
    const url = res?.data;
    if (url) statusStyles.value[idx].iconUrl = url;
  } catch {}
}

// 默认选中全部接口
onMounted(() => {
  if (!selectedApiIds.value.length && availableApisList.value?.length) {
    selectedApiIds.value = availableApisList.value.map(a => a.id);
  }
});

function summarizeCurrentConfig() {
  const cfg = props.config || {};
  const layers = Array.isArray(cfg.layers) ? cfg.layers : [];
  const byType: Record<string, number> = {};
  for (const l of layers) byType[l.type] = (byType[l.type] || 0) + 1;
  const samples = layers.slice(0, 5).map((l: any) => ({
    type: l.type,
    name: l.name,
    zIndex: l.zIndex,
    config: {
      x: l.config?.x, y: l.config?.y, width: l.config?.width, height: l.config?.height, rotate: l.config?.rotate,
      apiId: l.config?.apiId, dataKey: l.config?.dataKey, portDataKey: l.config?.portDataKey, portKey: l.config?.portKey,
      statusMapping: l.config?.statusMapping ? Object.keys(l.config.statusMapping).slice(0, 3) : undefined,
      events: l.config?.events ? Object.keys(l.config.events) : undefined,
    },
  }));
  return { deviceMeta: { width: cfg.width, height: cfg.height }, layersSummary: byType, layerSamples: samples };
}

function getSampleForPrompt() {
  // 优先使用用户上传的样例 JSON，否则使用当前画布摘要
  if (sampleJson.value) return { sampleJson: sampleJson.value, sampleConfigSummary: useCurrentAsSample.value ? summarizeCurrentConfig() : null };
  return { sampleJson: null, sampleConfigSummary: useCurrentAsSample.value ? summarizeCurrentConfig() : null };
}

function buildStylesForPrompt() {
  return statusStyles.value.filter(s => s.value !== '' && s.iconUrl !== '');
}

function validateSuggestion(sug: any): string[] {
  const errs: string[] = [];
  if (!sug || typeof sug !== 'object') return ['返回内容不是 JSON 对象'];
  if (!Array.isArray(sug.apis)) errs.push('apis 必须是数组');
  if (!Array.isArray(sug.layers)) errs.push('layers 必须是数组');
  if (Array.isArray(sug.layers)) {
    sug.layers.forEach((l: any, idx: number) => {
      if (!l?.type) errs.push(`layers[${idx}].type 缺失`);
      const c = l?.config;
      if (!c) errs.push(`layers[${idx}].config 缺失`);
      else {
        ['x','y','width','height'].forEach((k) => { if (typeof c[k] !== 'number') errs.push(`layers[${idx}].config.${k} 需为 number`); });
        if ((l.type === 'port' || l.type === 'port-adv') && c.apiId && c.statusMapping) {
          for (const [k,v] of Object.entries(c.statusMapping||{})) {
            if (!v || typeof v !== 'object' || typeof (v as any).iconUrl !== 'string') errs.push(`layers[${idx}].config.statusMapping['${k}'].iconUrl 缺失`);
          }
        }
      }
    });
  }
  return errs;
}

async function generate() {
  errorMsg.value = '';
  loading.value = true;
  try {
    // 估算展开数量（尽量覆盖所有 rows）
    let maxItems = 200;
    for (const a of selectedApis.value) {
      const s = sampleMap.value[a.id] || a.lastSample || {};
      const rows = s?.rows || s?.data?.rows || [];
      if (Array.isArray(rows)) maxItems = Math.max(maxItems, rows.length);
    }
    const body = {
      apis: selectedApis.value.map(a => ({ ...a, lastSample: sampleMap.value[a.id] ?? a.lastSample })),
      goal: goal.value,
      ...getSampleForPrompt(),
      statusStyles: buildStylesForPrompt(),
      maxItems,
    };
    const resp = await fetch('/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json?.error || 'AI 请求失败');
    const resultRaw = json.result || json.raw;
    const parsed = typeof resultRaw === 'string' ? parseLooseJson(resultRaw) : resultRaw;
    let result = expandSuggestionUsingSamples(parsed);
    result = normalizeSuggestionAssets(result);
    const errs = validateSuggestion(result || {});
    if (errs.length) {
      errorMsg.value = 'AI 返回不符合预期：\n' + errs.join('\n');
    }
    suggestion.value = result;
    previewVisible.value = true;
  } catch (e: any) {
    errorMsg.value = e.message || String(e);
  } finally {
    loading.value = false;
  }
}

function parseLooseJson(input: string): any | null {
  if (!input || typeof input !== 'string') return null;
  // fenced code block
  let m = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m && m[1]) {
    try { return JSON.parse(m[1].trim()); } catch {}
  }
  // first {...}
  const s = input.indexOf('{');
  const e = input.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) {
    const sub = input.slice(s, e + 1);
    try { return JSON.parse(sub); } catch {}
  }
  // strip backticks
  const stripped = input.replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch {}
  return null;
}

function expandSuggestionUsingSamples(sug: any) {
  try {
    if (!sug || !Array.isArray(sug.layers)) return sug;
    const out = { ...sug, layers: [] as any[] };
    const baseLayers = sug.layers as any[];
    const cols = 8, gap = 12;
    for (const L of baseLayers) {
      const c = L?.config || {};
      const apiId = c.apiId;
      const sample = apiId ? (sampleMap.value[apiId] || {}) : {};
      const arrPath = (typeof c.portDataKey === 'string' && /(^|\.)rows$/.test(c.portDataKey))
        ? c.portDataKey
        : null;
      if (L.type === 'port-adv' && arrPath && (sample?.rows || sample?.data?.rows)) {
        const arr = arrPath === 'rows' ? (sample.rows || []) : (sample?.data?.rows || []);
        const baseX = Number(c.x || 200), baseY = Number(c.y || 100);
        const w = Number(c.width || 32), h = Number(c.height || 32);
        for (let i = 0; i < arr.length; i++) {
          const item = arr[i] || {};
          const valueKey = Object.keys(item).find(k => /state|status/i.test(k) && typeof item[k] !== 'object') || 'registerAddressState';
          const labelKey = 'registerDescribe' in item ? 'registerDescribe' : (('name' in item) ? 'name' : null);
          const nx = baseX + (i % cols) * (w + gap);
          const ny = baseY + Math.floor(i / cols) * (h + gap);
          const layer = {
            ...L,
            name: labelKey ? String(item[labelKey]) || L.name : (L.name || `端口-${i+1}`),
            config: {
              ...c,
              x: nx, y: ny, width: w, height: h,
              portDataKey: `${arrPath}[${i}].${valueKey}`,
              portKey: 'value',
              events: c.events ? {
                ...c.events,
                hover: c.events.hover ? {
                  ...c.events.hover,
                  dataKey: labelKey ? `${arrPath}[${i}].${labelKey}` : c.events.hover.dataKey
                } : undefined
              } : undefined,
            }
          };
          out.layers.push(layer);
        }
      } else {
        out.layers.push(L);
      }
    }
    return out;
  } catch {
    return sug;
  }
}

function normalizeSuggestionAssets(sug: any) {
  try {
    if (!sug || !Array.isArray(sug.layers)) return sug;
    const styleMap = new Map<string, { label: string; iconUrl: string }>();
    for (const s of statusStyles.value) {
      if (!s.value) continue;
      styleMap.set(String(s.value), { label: s.label || '', iconUrl: sanitizeUrl(s.iconUrl || '') });
    }
    const allowedIcons = new Set(Array.from(styleMap.values()).map((v) => v.iconUrl).filter(Boolean));
    const fallbackIcon = styleMap.get('true')?.iconUrl || styleMap.values().next().value?.iconUrl || '/imgs/port-gray.png';
    const layers = [] as any[];
    for (const L of sug.layers) {
      if ((L.type === 'port' || L.type === 'port-adv')) {
        // 丢弃无 apiId / 无状态映射的占位层
        const c = L.config || {};
        const hasApi = !!c.apiId;
        const mapping = c.statusMapping || {};
        const hasMapping = Object.keys(mapping).length > 0;
        if (!hasApi || !hasMapping) continue;
        // 规范化 mapping，优先使用用户样式
        const nextMapping: Record<string, any> = {};
        const candidateKeys = Object.keys(mapping);
        const restrictToUser = styleMap.size > 0;
        const keysToUse = restrictToUser ? Array.from(styleMap.keys()) : candidateKeys;
        for (const key of keysToUse) {
          const style = styleMap.get(key);
          if (style) {
            nextMapping[key] = { iconUrl: style.iconUrl, label: style.label };
            continue;
          }
          const v = (mapping as any)[key];
          const proposed = sanitizeUrl(v?.iconUrl || '');
          const label = v?.label ?? '';
          if (proposed && allowedIcons.has(proposed)) nextMapping[key] = { iconUrl: proposed, label };
        }
        // 兜底：仍然没有任何键，则复制用户提供的样式；再没有就放置灰图
        if (!Object.keys(nextMapping).length) {
          if (styleMap.size) {
            for (const [k, s] of styleMap.entries()) nextMapping[k] = { iconUrl: s.iconUrl, label: s.label };
          } else {
            nextMapping['true'] = { iconUrl: fallbackIcon, label: '' };
            nextMapping['false'] = { iconUrl: '/imgs/port-gray.png', label: '' };
          }
        }
        const src = c.src || nextMapping['true']?.iconUrl || fallbackIcon;
        layers.push({ ...L, config: { ...c, src, statusMapping: nextMapping } });
      } else {
        layers.push(L);
      }
    }
    return { ...sug, layers };
  } catch {
    return sug;
  }
}

function sanitizeUrl(u: string) {
  if (!u) return u;
  try {
    // don't double-encode existing encodings
    const decoded = decodeURI(u);
    return encodeURI(decoded);
  } catch {
    return encodeURI(u);
  }
}

// 从素材库选择图标
const iconSelectVisible = ref(false);
const iconSelectIdx = ref(-1);
function selectIcon(idx: number) { iconSelectIdx.value = idx; iconSelectVisible.value = true; }
function handlePickIcon(url: string) {
  if (iconSelectIdx.value >= 0) statusStyles.value[iconSelectIdx.value].iconUrl = url;
  iconSelectVisible.value = false;
}

function ensureId(prefix = 'ai') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
}

function applySuggestion() {
  if (!suggestion.value) return;
  const sug = suggestion.value;
  const errs = validateSuggestion(sug);
  if (errs.length) {
    alert('建议 JSON 校验失败，已拦截应用：\n' + errs.join('\n'));
    return;
  }
  const cfg = props.config;
  if (replaceMode.value) {
    cfg.layers = [];
    cfg.apiList = [];
  }
  // merge apis
  if (Array.isArray(sug.apis)) {
    const map = new Map<string, any>();
    (cfg.apiList || []).forEach((a: any) => map.set(a.id, a));
    sug.apis.forEach((a: any) => {
      if (!a?.id) a.id = ensureId('api');
      map.set(a.id, { ...(map.get(a.id) || {}), ...a });
    });
    cfg.apiList = Array.from(map.values());
  }
  // merge layers
  if (!Array.isArray(cfg.layers)) cfg.layers = [];
  if (Array.isArray(sug.layers)) {
    let maxZ = cfg.layers.reduce((m: number, l: any) => Math.max(m, Number(l.zIndex || 0)), 0);
    for (const l of sug.layers) {
      const layer = { id: ensureId('layer'), name: l.name || '', type: l.type, zIndex: l.zIndex ?? (maxZ += 1), config: { ...(l.config || {}) } };
      // ensure apiId exists
      if (layer.config.apiId) {
        const exists = (cfg.apiList || []).some((a: any) => a.id === layer.config.apiId);
        if (!exists && Array.isArray(sug.apis)) {
          // if not exist, try attach first api id
          if (sug.apis[0]?.id) layer.config.apiId = sug.apis[0].id;
        }
      }
      cfg.layers.push(layer);
    }
  }
  emit('update', cfg);
  emit('applied', { save: false });
  alert('AI 建议已应用到当前视图');
}

function applyAndSave() {
  applySuggestion();
  emit('applied', { save: true });
}
</script>

<template>
  <div class="rounded border border-[#3a3f52] bg-[#20222a] p-3 text-white">
    <div class="mb-2 flex items-center justify-between">
      <div class="text-base font-semibold">AI 推荐（实验功能）</div>
      <button class="rounded border px-2 py-1 text-xs" @click="open = !open">{{ open ? '收起' : '展开' }}</button>
    </div>
    <div v-if="open">
      <div class="mb-2 text-sm text-gray-300">选择要参与分析的接口（设备级隔离）。</div>
      <div class="mb-2">
        <div class="relative inline-block">
          <button class="rounded border px-3 py-1 text-xs" @click="selectOpen = !selectOpen">
            已选 {{ selectedApiIds.length }}/{{ availableApisList.length }}（下拉选择）
          </button>
          <div v-if="selectOpen" class="absolute z-[6600] mt-1 w-[640px] max-w-[92vw] rounded border border-[#3a3f52] bg-[#1f2330] p-2 shadow-lg">
            <div class="mb-2 flex items-center gap-2">
              <input v-model="apiFilter" placeholder="搜索 URL/名称" class="w-full rounded border bg-[#1d1e24] p-1 text-xs text-white" />
              <button class="rounded border px-2 py-1 text-xs" @click="selectAll">全选</button>
              <button class="rounded border px-2 py-1 text-xs" @click="selectNone">清空</button>
            </div>
            <div class="max-h-64 overflow-auto">
              <div v-for="api in filteredApis" :key="api.id" class="flex items-center gap-2 border-b border-[#333a] py-1 text-xs">
                <label class="flex flex-1 items-center gap-2">
                  <input type="checkbox" v-model="selectedApiIds" :value="api.id" />
                  <span class="truncate">{{ api.url || api.name || api.id }}</span>
                </label>
                <span v-if="sampleMap[api.id] && !sampleMap[api.id]._error" class="text-green-400">已采样</span>
                <span v-else-if="sampleMap[api.id]?._error" class="text-red-400">失败</span>
                <button class="rounded border px-2 py-1" @click="openApiPreview(api)">预览返回</button>
              </div>
            </div>
            <div class="mt-2 text-right">
              <button class="rounded border px-3 py-1 text-xs" @click="collectSamples">采集所选</button>
              <button class="ml-2 rounded border px-3 py-1 text-xs" @click="selectOpen = false">关闭</button>
            </div>
          </div>
        </div>
      </div>
      <div class="mb-2 text-sm">
        <button class="rounded border px-2 py-1 text-xs" :disabled="collecting || !selectedApiIds.length" @click="collectSamples">{{ collecting ? '采集中…' : '采集接口样本' }}</button>
        <span class="ml-2 text-xs text-gray-300">已采集：{{ sampleStats.ok }} 成功 / {{ sampleStats.fail }} 失败</span>
      </div>
      <!-- 示例 JSON 上传 -->
      <div class="mb-2 text-sm">
        <div class="mb-1">示例 JSON（可选）：上传一个设备示例 JSON，AI 会参考其结构。</div>
        <input type="file" accept="application/json" @change="handleSampleJsonChange" />
        <div class="mt-1 text-xs text-gray-300" v-if="sampleFileName">已加载：{{ sampleFileName }}</div>
      </div>
      <!-- 端口状态样式 -->
      <div class="mb-2 text-sm">
        <div class="mb-1 flex items-center justify-between">
          <div>端口状态样式（值/标签/图标）</div>
          <button class="rounded border px-2 py-1 text-xs" @click="addStyle">+新增样式</button>
        </div>
        <div v-for="(row,idx) in statusStyles" :key="idx" class="mb-1 flex items-center gap-2">
          <input v-model="row.value" placeholder="值，如 true/false/1/0" class="w-28 rounded border bg-[#1d1e24] p-1 text-xs text-white"/>
          <input v-model="row.label" placeholder="标签，如 开/关" class="w-28 rounded border bg-[#1d1e24] p-1 text-xs text-white"/>
          <img v-if="row.iconUrl" :src="row.iconUrl" class="h-6 w-6" />
          <button class="rounded border px-2 py-1 text-xs" @click="selectIcon(idx)">选择素材</button>
          <input type="file" accept="image/*" @change="(e)=>handleUploadIcon(e, idx)" />
          <button class="text-xs text-red-400" @click="removeStyle(idx)">删除</button>
        </div>
        <div class="text-xs text-gray-400">AI 将优先使用这里的图标与标签生成 statusMapping</div>
      </div>
      <div class="mb-2">
        <label class="mr-2 text-sm">目标/偏好：</label>
        <input v-model="goal" class="w-[520px] rounded border bg-[#1d1e24] p-1 text-sm text-white" />
      </div>
      <div class="mb-3 text-sm">
        <label><input type="checkbox" v-model="useCurrentAsSample" /> 附带当前画布结构摘要作为 few-shot</label>
      </div>
      <div class="flex items-center gap-2">
        <button class="rounded border px-3 py-1" :disabled="loading || !selectedApiIds.length" @click="generate">{{ loading ? '生成中…' : '生成AI推荐' }}</button>
        <span class="text-red-400 text-xs" v-if="errorMsg">{{ errorMsg }}</span>
      </div>
      <div class="mt-2" v-if="suggestion">
        <label class="mr-3 inline-flex items-center gap-1 text-xs"><input type="checkbox" v-model="replaceMode" /> 覆盖当前视图</label>
        <button class="rounded border px-3 py-1" @click="applySuggestion">应用建议</button>
        <button class="ml-2 rounded border px-3 py-1" @click="applyAndSave">应用并保存</button>
        <button class="ml-2 rounded border px-3 py-1" @click="previewVisible = true">预览JSON</button>
      </div>
    </div>

    <JsonPreviewModal
      v-model="previewVisible"
      :data="suggestion"
      title="AI 建议 JSON 预览"
      :actions="[
        { label: (replaceMode ? '覆盖' : '应用') + '建议', onClick: applySuggestion },
        { label: (replaceMode ? '覆盖并保存' : '应用并保存'), onClick: applyAndSave }
      ]"
    />
    <JsonPreviewModal v-model="apiPreviewVisible" :data="apiPreviewData" :title="apiPreviewTitle" />

    <!-- 素材选择弹窗 -->
    <div v-if="iconSelectVisible" class="fixed inset-0 z-[6500] bg-[rgba(0,0,0,0.35)]">
      <div class="pointer-events-auto m-20 mx-auto w-[480px] rounded-lg bg-[#24283b] p-5 shadow-lg">
        <div class="mb-2 font-bold">选择素材库图标</div>
        <div class="max-h-[240px] overflow-auto">
          <template v-for="mat in (props.materialsList || [])" :key="mat.id">
            <img :src="mat.url" class="m-1 inline-block h-14 w-14 cursor-pointer rounded border bg-white p-1 hover:shadow-lg" @click="handlePickIcon(mat.url)" />
          </template>
        </div>
        <div class="text-right">
          <button class="mt-2 rounded border px-4 py-1" @click="iconSelectVisible = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>
