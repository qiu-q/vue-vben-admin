<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';

import { uploadFile } from '#/api/device';

import FolderTreeNode from './FolderTreeNode.vue';

const props = defineProps<{
  config: any;
}>();

const PORT_ICON_URL = `${import.meta.env.VITE_PORT_ICON_BASE}/qiuqiu/green.gif`;
const TABLE_ICON_URL =
  'data:image/svg+xml,%3Csvg xmlns%3D"http://www.w3.org/2000/svg" width%3D"56" height%3D"56"%3E%3Crect x%3D"1" y%3D"1" width%3D"54" height%3D"54" fill%3D"%23fff" stroke%3D"%23ccc"/%3E%3Cline x1%3D"1" y1%3D"19" x2%3D"55" y2%3D"19" stroke%3D"%23ccc"/%3E%3Cline x1%3D"1" y1%3D"37" x2%3D"55" y2%3D"37" stroke%3D"%23ccc"/%3E%3Cline x1%3D"19" y1%3D"1" x2%3D"19" y2%3D"55" stroke%3D"%23ccc"/%3E%3Cline x1%3D"37" y1%3D"1" x2%3D"37" y2%3D"55" stroke%3D"%23ccc"/%3E%3C/svg%3E';
const CARD_ICON_URL =
  'data:image/svg+xml,%3Csvg xmlns%3D"http://www.w3.org/2000/svg" width%3D"56" height%3D"56"%3E%3Crect x%3D"1" y%3D"1" width%3D"54" height%3D"54" fill%3D"%23fff" stroke%3D"%23ccc"/%3E%3Ctext x%3D"28" y%3D"34" font-size%3D"20" text-anchor%3D"middle" fill%3D"%23ccc"%3ET%3C/text%3E%3C/svg%3E';
const defaultFolderTree = [
  {
    id: 'root',
    name: '全部素材',
    expanded: true,
    parent: null,
    children: [],
    materials: [
      {
        id: 'port-default',
        url: PORT_ICON_URL,
        name: '端口',
        type: 'port',
        isBuiltIn: true,
      },
      {
        id: 'port-adv-default',
        url: PORT_ICON_URL,
        name: '高级端口',
        type: 'port-adv',
        isBuiltIn: true,
      },
      {
        id: 'table-default',
        url: TABLE_ICON_URL,
        name: '表格',
        type: 'table',
        isBuiltIn: true,
      },
      {
        id: 'card-default',
        url: CARD_ICON_URL,
        name: '卡片',
        type: 'card',
        isBuiltIn: true,
      },
    ],
  },
];

// 1. 初始化 folderTree，只在 props.config.materialsTree 变化时赋值一次
const folderTree = ref<any[]>([]);
function initFolderTree() {
  folderTree.value =
    Array.isArray(props.config?.materialsTree) &&
    props.config.materialsTree.length > 0
      ? JSON.parse(JSON.stringify(props.config.materialsTree))
      : JSON.parse(JSON.stringify(defaultFolderTree));
}
onMounted(initFolderTree);
watch(
  () => JSON.stringify(props.config?.materialsTree || []),
  initFolderTree,
  { immediate: true },
);

// ========== 业务逻辑不变 ==========
const selectedFolderId = ref('root');
const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  item: null,
  type: '',
});
const contextMaterial = ref<any>(null);

function findFolder(id, list = folderTree.value) {
  for (const folder of list) {
    if (folder.id === id) return folder;
    const f = findFolder(id, folder.children);
    if (f) return f;
  }
  return null;
}

function createFolder(parentId = 'root') {
  const parent = findFolder(parentId);
  if (!parent) return;
  const name = prompt('请输入文件夹名称');
  if (name) {
    parent.children.push({
      id: `folder-${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      name,
      expanded: true,
      parent: parentId,
      children: [],
      materials: [],
    });
    parent.expanded = true;
  }
}

async function onUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;
  const formData = new FormData();
  formData.append('file', files[0]);

  try {
    const res = await uploadFile(formData);
    console.log('res', res);

    if (res?.code !== 200) {
      alert(`上传失败：${res?.msg || '未知错误'}`);
      return;
    }

    const url = res?.data;
    if (url) {
      const folder = findFolder(selectedFolderId.value);
      folder?.materials.push({
        id: `img-${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        url,
        name: files[0].name,
        type: 'image',
      });
    }
  } catch (error) {
    console.error('上传文件出错', error);
    alert('上传文件异常，请稍后再试！');
  }
}

function onDrag(mat, e: DragEvent) {
  e.dataTransfer?.setData('image-url', mat.url);
  e.dataTransfer?.setData('mat-id', mat.id);
  e.dataTransfer?.setData('mat-type', mat.type || 'image');
}

function showContextMenu(type, item, e) {
  e.preventDefault();
  contextMenu.show = true;
  contextMenu.x = e.clientX;
  contextMenu.y = e.clientY;
  contextMenu.type = type;
  contextMenu.item = item;
  contextMaterial.value = type === 'material' ? item : null;
  document.addEventListener('click', hideContextMenu, { once: true });
}
function hideContextMenu() {
  contextMenu.show = false;
}

function handleDelete() {
  if (contextMenu.type === 'material') {
    if (contextMaterial.value.isBuiltIn) {
      alert('内置素材不可删除');
      hideContextMenu();
      return;
    }
    const folder = findFolder(selectedFolderId.value);
    folder.materials = folder.materials.filter(
      (mat) => mat.id !== contextMaterial.value.id,
    );
    hideContextMenu();
  }
  if (contextMenu.type === 'folder') {
    if (contextMenu.item.id === 'root') {
      alert('根文件夹不能删除！');
      hideContextMenu();
      return;
    }
    const parent = findFolder(contextMenu.item.parent);
    parent.children = parent.children.filter(
      (f) => f.id !== contextMenu.item.id,
    );
    hideContextMenu();
  }
}

function handleCopyMaterial() {
  if (contextMenu.type === 'material') {
    const folder = findFolder(selectedFolderId.value);
    const original = contextMaterial.value;
    folder.materials.push({
      id: `img-${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      url: original.url,
      name: `${original.name}_副本`,
      type: original.type,
    });
    hideContextMenu();
  }
}

function onFolderDragOver(folder, e) {
  e.preventDefault();
}
function onMaterialDrop(folder, e) {
  e.preventDefault();
  const matId = e.dataTransfer?.getData('mat-id');
  if (!matId) return;
  let fromFolder = null;
  function searchFolder(list) {
    for (const f of list) {
      if (f.materials.find((m) => m.id === matId)) {
        fromFolder = f;
        return;
      }
      searchFolder(f.children);
    }
  }
  searchFolder(folderTree.value);
  if (!fromFolder || fromFolder.id === folder.id) return;
  const mat = fromFolder.materials.find((m) => m.id === matId);
  fromFolder.materials = fromFolder.materials.filter((m) => m.id !== matId);
  folder.materials.push(mat);
}

function toggleFolder(folder) {
  folder.expanded = !folder.expanded;
}

// ========== 提供暴露一个方法给父组件保存 ==========
defineExpose({
  getMaterialsTree: () => JSON.parse(JSON.stringify(folderTree.value)),
});
</script>

<template>
  <div class="flex h-full bg-[#181a20]">
    <!-- 左侧：文件夹树 -->
    <div
      style="
        width: 180px;
        padding: 6px 0;
        overflow: auto;
        background: #20222a;
        border-right: 1px solid #29304b;
      "
    >
      <div style="margin-bottom: 8px; text-align: center">
        <button
          @click="createFolder(selectedFolderId)"
          style="padding: 2px 9px; font-size: 14px"
        >
          +新建文件夹
        </button>
      </div>
      <FolderTreeNode
        :folder="folderTree[0]"
        :selected-folder-id="selectedFolderId"
        @select="selectedFolderId = $event"
        @toggle="toggleFolder"
        @contextmenu="showContextMenu"
        @dragover="onFolderDragOver"
        @drop="onMaterialDrop"
      />
    </div>
    <!-- 右侧：当前文件夹的素材网格 -->
    <div class="flex-1 p-3" style="overflow-y: auto">
      <div style="margin-bottom: 10px">
        111
        <!--        上传文件-->
        <input type="file" accept="image/*" @change="onUpload" />
      </div>
      <div v-if="findFolder(selectedFolderId)?.materials.length">
        <div class="flex flex-wrap">
          <div
            v-for="mat in findFolder(selectedFolderId)?.materials"
            :key="mat.id"
            class="mb-2 mr-2 cursor-pointer"
            style="width: 72px; text-align: center"
            draggable="true"
            @dragstart="onDrag(mat, $event)"
            @contextmenu="showContextMenu('material', mat, $event)"
          >
            <img
              :src="mat.url"
              style="
                width: 56px;
                height: 56px;
                object-fit: cover;
                border: 1px solid #eee;
              "
            />
            <div style="font-size: 11px; color: #aaa; word-break: break-all">
              {{ mat.name }}
            </div>
            <div
              v-if="mat.type === 'port' || mat.type === 'port-adv'"
              style="font-size: 10px; color: #39e1e7"
            >
              端口
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-gray-400" style="padding: 16px">暂无素材</div>
    </div>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.show"
      :style="{
        position: 'fixed',
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
        background: '#23242a',
        color: '#fff',
        border: '1px solid #334',
        borderRadius: '4px',
        zIndex: 5000,
        minWidth: '120px',
        boxShadow: '0 2px 10px #2229',
      }"
      @click.stop
    >
      <template v-if="contextMenu.type === 'material'">
        <div class="menu-item" @click="handleCopyMaterial">复制</div>
        <div
          class="menu-item"
          @click="handleDelete"
          style="color: #e55757"
          v-if="!contextMaterial?.isBuiltIn"
        >
          删除
        </div>
        <div
          class="menu-item"
          style="color: #aaa"
          v-if="contextMaterial?.isBuiltIn"
        >
          内置素材不可删除
        </div>
      </template>
      <template v-else-if="contextMenu.type === 'folder'">
        <div class="menu-item" @click="createFolder(contextMenu.item.id)">
          新建子文件夹
        </div>
        <div class="menu-item" @click="handleDelete" style="color: #e55757">
          删除
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.menu-item {
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid #273048;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background: #223c5c;
}
</style>
