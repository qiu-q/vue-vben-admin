<template>
  <div class="toolbar">
    <!-- 设备下拉 -->
    <select :value="selectedDeviceId" @change="onSelectDevice">
      <option
        v-for="dev in allDeviceOptions"
        :key="dev.deviceId"
        :value="dev.deviceId"
      >
        {{ dev.deviceName || dev.deviceId }}
      </option>
    </select>

    <!-- 添加普通设备 -->
    <button @click="emit('add-device')">添加设备到画布</button>
    
    <!-- ★ 新增：添加机柜按钮 -->
    <button @click="emit('add-cabinet')" style="background:#444;color:#fff">
      添加机柜
    </button>

    <!-- 画布大小设置 -->
    <label style="margin-left:8px">W:</label>
    <input
      type="number"
      :value="canvasWidth"
      style="width:80px"
      @input="
        emit('update:canvas-width', ($event.target as HTMLInputElement).valueAsNumber)
      "
    />
    <label>H:</label>
    <input
      type="number"
      :value="canvasHeight"
      style="width:80px"
      @input="
        emit('update:canvas-height', ($event.target as HTMLInputElement).valueAsNumber)
      "
    />

    <!-- 删除选中设备 -->
    <button @click="emit('remove-selected-device')" style="color:#f44">
      删除设备
    </button>

    <!-- 保存画布相关 -->
    <input
      :value="newConfigName"
      @input="
        (e) =>
          emit(
            'update:new-config-name',
            (e.target as HTMLInputElement).value,
          )
      "
      placeholder="画布名"
      style="width: 120px"
    />
    <button @click="emit('save-current-canvas-to-configs')">
      保存当前画布
    </button>

    <!-- 连接模式 -->
    <button
      :style="{
        background: connectMode === 'internal' ? '#01e6ff' : '#222',
        color: connectMode === 'internal' ? '#222' : '#fff',
      }"
      @click="emit('set-connect-mode', 'internal')"
    >
      内部连接
    </button>
    <button
      :style="{
        background: connectMode === 'external' ? '#ffa500' : '#222',
        color: connectMode === 'external' ? '#222' : '#ffa500',
      }"
      @click="emit('set-connect-mode', 'external')"
    >
      外部连接
    </button>

    <!-- 连线颜色选择 -->
    <input
      type="color"
      :value="lineColor"
      @input="updateLineColor"
      @change="updateLineColor"
    />

    <!-- 连线开关 -->
    <button
      :style="{
        background: linkEnabled ? '#0f0' : '#222',
        color: linkEnabled ? '#222' : '#fff',
      }"
      @click="emit('toggle-link-enabled')"
    >
      {{ linkEnabled ? '禁用连线' : '启用连线' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from 'vue';
/* ---------- props / emits ---------- */
const props = defineProps<{
  selectedDeviceId: string;
  allDeviceOptions: any[];
  newConfigName: string;
  connectMode: string;
  canvasWidth: number;
  canvasHeight: number;
  lineColor: string;
  linkEnabled: boolean;
}>();
const { canvasWidth, canvasHeight, lineColor } = toRefs(props);

const emit = defineEmits([
  'update:selected-device-id',
  'update:new-config-name',
  'add-device',
  'add-cabinet', // ★ 新增
  'save-current-canvas-to-configs',
  'set-connect-mode',
  'update:canvas-width',
  'update:canvas-height',
  'remove-selected-device',
  'update:line-color',
  'toggle-link-enabled',
]);

/* ---------- methods ---------- */
function onSelectDevice(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  emit('update:selected-device-id', val);
}

function updateLineColor(e: Event) {
  emit('update:line-color', (e.target as HTMLInputElement).value);
}
</script>

<style scoped>
.toolbar {
  position: absolute;
  top: 10px;
  left: 20px;
  z-index: 10;
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
