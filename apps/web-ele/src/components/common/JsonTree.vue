<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ name: 'JsonTree' });

type JsonPrimitive = string | number | boolean | null;

const props = defineProps<{
  name?: string;
  value: any;
  path: string;
  depth: number;
  expanded: Set<string>;
  selectable?: boolean;
  highlightPath?: string;
}>();
const emit = defineEmits(['toggle', 'select']);

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

const t = computed(() => typeOf(props.value));
const isExpandable = computed(() => t.value === 'object' || t.value === 'array');
const isOpen = computed(() => props.expanded.has(props.path));
const size = computed(() => {
  if (t.value === 'array') return (props.value as any[]).length;
  if (t.value === 'object') return Object.keys(props.value).length;
  return 0;
});
function onToggle() {
  emit('toggle', props.path);
}
function valueClass() {
  return t.value === 'string'
    ? 'text-green-300'
    : t.value === 'number'
    ? 'text-yellow-300'
    : t.value === 'boolean'
    ? 'text-orange-300'
    : 'text-gray-300';
}
const isActive = computed(() => props.highlightPath === props.path);
function handleSelect() {
  emit('select', props.path);
}
</script>

<template>
  <div class="leading-6">
    <div class="flex items-start">
      <button
        v-if="isExpandable"
        class="mr-1 h-5 w-5 select-none rounded border border-gray-500 text-xs text-gray-200"
        :title="isOpen ? '折叠' : '展开'"
        @click="onToggle"
      >
        {{ isOpen ? '-' : '+' }}
      </button>
      <span v-else class="mr-1 inline-block h-5 w-5"></span>
      <div class="flex flex-wrap gap-2 text-sm">
        <span v-if="name !== undefined" class="text-blue-300">{{ name }}:</span>
        <span v-if="t === 'array'" class="text-purple-300">Array({{ size }})</span>
        <span v-else-if="t === 'object'" class="text-purple-300">Object({{ size }})</span>
        <span v-else :class="valueClass()">{{ stringifyPrimitive(value) }}</span>
        <span v-if="selectable && path" class="text-xs text-gray-400">{{ path }}</span>
      </div>
      <button
        v-if="selectable && path"
        class="ml-2 rounded border px-2 py-0.5 text-xs"
        :class="isActive ? 'border-blue-400 text-blue-300' : 'border-gray-600 text-gray-200'"
        @click.stop="handleSelect"
      >
        {{ isActive ? '已选' : '选择' }}
      </button>
    </div>
    <div v-if="isExpandable && isOpen" class="ml-5 border-l border-gray-600 pl-3">
      <JsonTree
        v-if="Array.isArray(value)"
        v-for="(v, i) in value"
        :key="i"
        :name="String(i)"
        :value="v"
        :path="path + '[' + i + ']'"
        :depth="depth + 1"
        :expanded="expanded"
        :selectable="selectable"
        :highlight-path="highlightPath"
        @toggle="$emit('toggle', $event)"
        @select="$emit('select', $event)"
      />
      <JsonTree
        v-else
        v-for="(v, k) in value"
        :key="k as string"
        :name="k as string"
        :value="v"
        :path="path ? path + '.' + (k as string) : (k as string)"
        :depth="depth + 1"
        :expanded="expanded"
        :selectable="selectable"
        :highlight-path="highlightPath"
        @toggle="$emit('toggle', $event)"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>
