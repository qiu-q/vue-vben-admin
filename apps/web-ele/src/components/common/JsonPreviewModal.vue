<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import JsonTree from '#/components/common/JsonTree.vue';

const props = defineProps<{
  modelValue: boolean;
  data: any;
  title?: string;
}>();
const emit = defineEmits(['update:modelValue']);

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

type JsonPrimitive = string | number | boolean | null;

function isObjectLike(val: any) {
  return val !== null && typeof val === 'object';
}

function typeOf(val: any): 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'unknown' {
  if (val === null) return 'null';
  if (Array.isArray(val)) return 'array';
  const t = typeof val;
  if (t === 'string') return 'string';
  if (t === 'number') return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'object') return 'object';
  return 'unknown';
}

function stringifyPrimitive(val: JsonPrimitive) {
  if (val === null) return 'null';
  if (typeof val === 'string') return `"${val}"`;
  return String(val);
}

const expanded = ref<Set<string>>(new Set());

function toggle(path: string) {
  const s = expanded.value;
  if (s.has(path)) s.delete(path);
  else s.add(path);
  // trigger reactivity
  expanded.value = new Set(s);
}

function collectAllPaths(val: any, base = '', acc: string[] = []) {
  if (!isObjectLike(val)) return acc;
  acc.push(base);
  if (Array.isArray(val)) {
    val.forEach((v, i) => collectAllPaths(v, `${base}[${i}]`, acc));
  } else {
    Object.keys(val).forEach((k) => collectAllPaths(val[k], base ? `${base}.${k}` : k, acc));
  }
  return acc;
}

function initExpanded(depth = 1) {
  const next = new Set<string>();
  function walk(val: any, base: string, d: number) {
    if (!isObjectLike(val)) return;
    if (d <= depth) next.add(base);
    if (Array.isArray(val)) {
      val.forEach((v, i) => walk(v, `${base}[${i}]`, d + 1));
    } else {
      Object.keys(val).forEach((k) => walk(val[k], base ? `${base}.${k}` : k, d + 1));
    }
  }
  walk(props.data, '', 0);
  expanded.value = next;
}

watch(
  () => props.data,
  () => initExpanded(1),
  { immediate: true },
);

async function copyJson() {
  const text = JSON.stringify(props.data, null, 2);
  try {
    await navigator.clipboard.writeText(text);
    alert('已复制 JSON');
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('已复制 JSON');
    } catch {}
  }
}

function expandAll() {
  const all = collectAllPaths(props.data);
  expanded.value = new Set(all);
}
function collapseAll() {
  expanded.value = new Set();
}

// Use external recursive tree component
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[6200] flex items-center justify-center bg-[rgba(0,0,0,0.65)]">
    <div class="max-h-[82vh] w-[860px] max-w-[92vw] overflow-hidden rounded-lg bg-[#1f2430] text-white shadow-xl">
      <div class="flex items-center justify-between border-b border-[#3a3f52] px-4 py-3">
        <div class="truncate font-semibold">{{ title || 'JSON 预览' }}</div>
        <button class="rounded border border-gray-500 px-2 py-1 text-sm" @click="visible = false">关闭</button>
      </div>
      <div class="flex items-center gap-2 border-b border-[#3a3f52] px-4 py-2 text-sm">
        <button class="rounded border border-gray-500 px-2 py-1" @click="expandAll">展开全部</button>
        <button class="rounded border border-gray-500 px-2 py-1" @click="collapseAll">折叠全部</button>
        <button class="rounded border border-gray-500 px-2 py-1" @click="copyJson">复制 JSON</button>
      </div>
      <div class="max-h-[70vh] overflow-auto px-4 py-3 text-sm">
        <JsonTree :value="data" path="" :depth="0" :expanded="expanded" @toggle="toggle" />
      </div>
    </div>
  </div>
  
</template>

<style scoped>
/* Simple scrollbar styling for dark theme */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: #1a1e27; }
::-webkit-scrollbar-thumb { background: #3b4254; border-radius: 6px; }
::-webkit-scrollbar-thumb:hover { background: #4a5166; }
</style>
