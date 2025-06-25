<script setup lang="ts">
import { defineEmits, defineProps } from 'vue';

const props = defineProps<{
  folder: any;
  selectedFolderId: string;
}>();
const emit = defineEmits([
  'select',
  'toggle',
  'contextmenu',
  'dragover',
  'drop',
]);
</script>

<template>
  <div :style="{ marginLeft: '12px' }">
    <div
      :style="{
        background:
          props.selectedFolderId === props.folder.id ? '#234' : 'transparent',
        color: '#fff',
        borderRadius: '4px',
        padding: '2px 4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
      }"
      @click="emit('select', props.folder.id)"
      @contextmenu="emit('contextmenu', 'folder', props.folder, $event)"
      @dragover="emit('dragover', props.folder, $event)"
      @drop="emit('drop', props.folder, $event)"
    >
      <span
        style="user-select: none"
        @click.stop="emit('toggle', props.folder)"
      >
        <template v-if="props.folder.children.length > 0">
          {{ props.folder.expanded ? '▼' : '▶' }}
        </template>
        <template v-else>•</template>
      </span>
      <span style="margin-left: 6px">{{ props.folder.name }}</span>
    </div>
    <div v-show="props.folder.expanded">
      <FolderTreeNode
        v-for="child in props.folder.children"
        :key="child.id"
        :folder="child"
        :selected-folder-id="props.selectedFolderId"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
        @contextmenu="emit('contextmenu', $event)"
        @dragover="emit('dragover', $event)"
        @drop="emit('drop', $event)"
      />
    </div>
  </div>
</template>
