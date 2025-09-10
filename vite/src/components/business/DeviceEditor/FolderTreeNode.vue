<script setup lang="ts">
const props = defineProps<{ folder: any; selectedFolderId: string }>();
const emit = defineEmits(['select', 'toggle', 'contextmenu', 'dragover', 'drop']);
</script>

<template>
  <div>
    <div :style="{ padding: '2px 8px', background: selectedFolderId === folder.id ? '#1f2a44' : 'transparent', color: '#cde', cursor: 'pointer' }" @click.stop="emit('select', folder.id)" @contextmenu="emit('contextmenu', 'folder', folder, $event)" @dragover="emit('dragover', folder, $event)" @drop="emit('drop', folder, $event)">
      <span @click.stop="emit('toggle', folder)" style="margin-right:6px; color:#8ab">{{ folder.expanded ? '▾' : '▸' }}</span>
      {{ folder.name }}
    </div>
    <div v-show="folder.expanded" style="margin-left: 16px;">
      <FolderTreeNode v-for="child in folder.children" :key="child.id" :folder="child" :selected-folder-id="selectedFolderId" @select="emit('select', $event)" @toggle="emit('toggle', $event)" @contextmenu="emit('contextmenu', $event)" @dragover="emit('dragover', $event)" @drop="emit('drop', $event)" />
    </div>
  </div>
</template>

