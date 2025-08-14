<!-- components/CanvasRightPanel.vue -->
<template>
  <div
    style="
      width: 340px;
      margin-left: 12px;
      background: #181e2a;
      color: #fff;
      border-radius: 8px;
      padding: 16px 10px;
      min-height: 500px;
      font-size: 14px;
      box-shadow: 0 2px 10px #0002;
    "
  >
    <div style="font-weight: bold; margin-bottom: 10px">
      已保存的画布
      <button @click="exportAllConfigs" style="float: right">全部导出</button>
      <button @click="triggerImport" style="float: right; margin-right: 8px">
        导入配置
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        style="display: none"
        @change="onFileChange"
      />
    </div>
    <template v-if="Object.keys(topoConfigs).length > 0">
      <div
        v-for="(cfg, name, idx) in topoConfigs"
        :key="name"
        :style="`background: #212837; margin-bottom: 10px; padding: 6px 8px; border-radius: 5px; position: relative; ${connectMode === 'external' ? 'cursor:pointer;box-shadow: 0 0 0 2px #FFA500' : ''}`"
        @click="connectMode === 'external' && drawingLine ? connectToExternalRoom(name) : null"
      >
        <div>
          <img
            v-if="cfg.cover"
            :src="cfg.cover"
            style="
              width: 100%;
              height: 200px;
              object-fit: cover;
              border-radius: 4px;
              margin-right: 7px;
              border: 1px solid #222;
            "
            alt="封面"
          />
        </div>
        <span style="flex: 1">
          <b>{{ name }}</b>
          <span style="font-size: 12px; color: #888">
            (设备:{{ cfg.devices.length }} 连线:{{ cfg.edges.length }})
          </span>
        </span>
        <button @click.stop="restoreConfigToCanvas(cfg)" style="margin-right: 5px">
          恢复
        </button>
        <button @click.stop="exportOneConfig(name)" style="margin-right: 5px">
          导出
        </button>
        <button @click.stop="removeConfig(name)" style="color: #f44">
          删除
        </button>
      </div>
    </template>
    <div v-else style="color: #888; padding: 20px 0; text-align: center">
      暂无保存的画布
    </div>

    <div style="font-weight: bold; margin: 16px 0 8px">跨画布连线</div>
    <div v-if="crossEdges.length > 0">
      <div
        v-for="(edge, idx) in crossEdges"
        :key="idx"
        style="background: #212837; margin-bottom: 8px; padding: 6px 8px; border-radius: 5px"
      >
        <div>
          <span>{{ edge.sourceRoom }} / {{ edge.sourceDev }} ({{ edge.sourcePort }})</span>
        </div>
        <div style="margin-top: 2px">
          <span>
            → {{ edge.targetRoom }} / {{ edge.targetDev }} ({{ edge.targetPort }})
          </span>
        </div>
      </div>
    </div>
    <div v-else style="color: #888; padding: 10px 0; text-align: center">
      暂无跨画布连线
    </div>
    <div
      v-if="connectMode === 'external'"
      style="color: #ffa500; margin-top: 18px; font-size: 13px"
    >
      外部模式：1.点击端口作为起点，再点击右侧任意机房即可建立外部连线。
    </div>
    <div v-else style="color: #01e6ff; margin-top: 18px; font-size: 13px">
      内部模式：端口与端口直接连线。
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
const props = defineProps([
  'topoConfigs',
  'connectMode',
  'drawingLine',
]);
const emits = defineEmits([
  'exportAllConfigs',
  'restoreConfigToCanvas',
  'exportOneConfig',
  'removeConfig',
  'connectToExternalRoom',
  'importConfigs',
]);
const exportAllConfigs = () => emits('exportAllConfigs');
const restoreConfigToCanvas = (cfg: any) => emits('restoreConfigToCanvas', cfg);
const exportOneConfig = (name: string) => emits('exportOneConfig', name);
const removeConfig = (name: string) => emits('removeConfig', name);
const connectToExternalRoom = (name: string) => emits('connectToExternalRoom', name);

const fileInput = ref<HTMLInputElement | null>(null);
const triggerImport = () => fileInput.value?.click();
function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;
  const file = files[0];
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string);
      emits('importConfigs', data);
    } catch (err) {
      window.alert('配置文件解析失败');
    }
    if (fileInput.value) fileInput.value.value = '';
  };
  reader.readAsText(file);
}

const crossEdges = computed(() => {
  const result: Array<{
    sourceRoom: string;
    sourceDev: string;
    sourcePort: string;
    targetRoom: string;
    targetDev: string;
    targetPort: string;
  }> = [];
  for (const [roomName, cfg] of Object.entries(props.topoConfigs || {})) {
    (cfg as any).edges
      ?.filter((e: any) => e.external)
      .forEach((edge: any) => {
        const srcDev = (cfg as any).devices?.find(
          (d: any) => d._uuid === edge.source?.devUUid,
        );
        const sourceDevName = srcDev?.deviceId || edge.source?.devUUid || '';
        const targetRoom = edge.target?.externalRoom || '';
        let targetDevName = '';
        let targetPort = '';
        if (edge.targetDevUuid && edge.targetPortId) {
          const targetCfg: any = (props.topoConfigs as any)[targetRoom];
          const tgtDev = targetCfg?.devices?.find(
            (d: any) => d._uuid === edge.targetDevUuid,
          );
          targetDevName = tgtDev?.deviceId || edge.targetDevUuid;
          targetPort = edge.targetPortId;
        } else {
          targetDevName = '-';
          targetPort = '-';
        }
        result.push({
          sourceRoom: roomName,
          sourceDev: sourceDevName,
          sourcePort: edge.source?.portId || '',
          targetRoom,
          targetDev: targetDevName,
          targetPort,
        });
      });
  }
  return result;
});
</script>
