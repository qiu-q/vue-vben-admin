<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

// 风扇动图
import fanGif from './assets/fan.gif';
// 顶部 logo
import topHeader from './assets/topHeader.png';
// 直接复用渲染组件
import DevicePreviewRender from './DevicePreviewRender.vue';

/* ───── 路由参数 ───── */
const route = useRoute();
const deviceId = ref((route.params.deviceId as string) || '');

/* ───── 组件状态 ───── */
const config = ref<any>(null);
const loading = ref(true);
const error = ref('');
const selectedLayerId = ref<null | string>(null); // 预览不可编辑，占位即可

const previewRef = ref<HTMLElement | null>(null);
const scale = ref(1);
function updateScale() {
  if (!previewRef.value || !config.value) return;
  const { clientWidth, clientHeight } = previewRef.value;
  const w = config.value.width || 900;
  const h = config.value.height || 600;
  scale.value = Math.min(clientWidth / w, clientHeight / h, 1);
}
onMounted(() => {
  window.addEventListener('resize', updateScale);
});
onUnmounted(() => window.removeEventListener('resize', updateScale));

/* ───── 视图切换 ───── */
const viewMode = ref<'detail' | 'device'>('device');
const toggleView = () => {
  viewMode.value = viewMode.value === 'device' ? 'detail' : 'device';
};
const toggleLabel = computed(() =>
  viewMode.value === 'device' ? '显示详情' : '显示设备',
);

/* ───── 接口返回数据定义 ───── */
interface PortInfo {
  portName: string;
  portIp?: string[];
  portStatus: number;
}

const tableRows = ref<PortInfo[]>([]);

const deviceInfo = ref({
  model: '',
  name: '',
  sysRunTime: '',
  macAddress: '',
  temperature: '',
  cpu: 0,
  fan: '',
  location: '',
});

/* ───── 拉取并解析设备配置 ───── */
async function loadConfig() {
  loading.value = true;
  error.value = '';

  try {
    const resp = await fetch(`/api/jx-device/Device/${deviceId.value}`);
    const json = await resp.json();

    if (json.code === 200 && json.data) {
      /* deviceJson 被双重 stringify，先拆外层再 parse 内层 */
      let parsed: any = {};
      try {
        parsed = JSON.parse(json.data.deviceJson);
        console.log('deviceJson', parsed);
      } catch {
        console.warn('deviceJson 解析失败，使用空配置');
      }

      /* 兜底：保证关键字段是数组，避免渲染时报错 */
      parsed.layers = Array.isArray(parsed.layers) ? parsed.layers : [];
      parsed.materialsTree = Array.isArray(parsed.materialsTree)
        ? parsed.materialsTree
        : [];

      /* 设定默认宽高，避免 0 / undefined */
      config.value = {
        deviceId: deviceId.value,
        width: parsed.width || 900,
        height: parsed.height || 600,
        ...parsed,
      };
    } else {
      error.value = json.msg || '未找到设备配置';
    }
  } catch (error_) {
    console.error(error_);
    error.value = '加载失败';
  }

  loading.value = false;
}

/* ───── 拉取设备详情信息 ───── */
async function loadDeviceInfo() {
  const base = '/api/jx-device/switchx/SwitchInf';
  const id = deviceId.value;
  if (!id) return;
  async function post(path: string) {
    const resp = await fetch(`${base}${path}/${id}`, { method: 'POST' });
    return resp.json();
  }
  try {
    const [port, cpu, fan, mac, model, name, temp, loc, run] =
      await Promise.all([
        post('/getPortStateInfo'),
        post('/getCpuInfo'),
        post('/getFanInfo'),
        post('/getMacAddress'),
        post('/getModel'),
        post('/getDeviceName'),
        post('/getTemperature'),
        post('/getPhysicalLocation'),
        post('/getSysRunTime'),
      ]);

    if (port?.code === 200) tableRows.value = port.data || [];
    if (cpu?.code === 200)
      deviceInfo.value.cpu = Number(cpu.data?.cpuValue) || 0;
    if (fan?.code === 200) deviceInfo.value.fan = fan.data?.[0]?.speed ?? '';
    if (mac?.code === 200)
      deviceInfo.value.macAddress = mac.data?.macValue || '';
    if (model?.code === 200)
      deviceInfo.value.model = model.data?.modelValue || '';
    if (name?.code === 200) deviceInfo.value.name = name.data?.nameValue || '';
    if (temp?.code === 200)
      deviceInfo.value.temperature = temp.data?.temperatureValue || '';
    if (loc?.code === 200)
      deviceInfo.value.location = loc.data?.locationValue || '';
    if (run?.code === 200)
      deviceInfo.value.sysRunTime = run.data?.runTimeValue || '';
  } catch (error_) {
    console.error('loadDeviceInfo error', error_);
  }
}

onMounted(loadConfig);
onMounted(loadDeviceInfo);
watch(config, updateScale);
onMounted(updateScale);
</script>

<template>
  <div class="device-preview-container">
    <div class="top-header">
      <img :src="topHeader" alt="Header Logo" class="logo" />
      <button class="toggle-btn" @click="toggleView">{{ toggleLabel }}</button>
    </div>
    <div class="device-preview-page relative h-full w-full bg-[#161a21]">
      <!-- 加载状态 -->
      <div
        v-if="loading"
        class="flex h-full items-center justify-center text-gray-400"
      >
        加载中…
      </div>

      <!-- 错误提示 -->
      <div
        v-else-if="error"
        class="flex h-full items-center justify-center text-red-400"
      >
        {{ error }}
      </div>

      <!-- 正常渲染 -->
      <div v-else>
        <!-- 设备视图 -->
        <!-- 设备视图 -->
        <div v-if="viewMode === 'device'">
          <div ref="previewRef" class="switch-preview flex h-full items-center justify-center">
            <div
              class="device-render"
              :style="{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: `${config.width}px`,
                height: `${config.height}px`,
              }"
            >
              <DevicePreviewRender :config="config" />
            </div>
          </div>
        </div>

        <!-- 详细信息视图 -->
        <div v-else>
          <div
            class="detail-panel flex flex-col gap-12 p-6 text-white lg:flex-row"
          >
            <h2 class="mb-2 text-xl font-semibold">设备详细信息</h2>
            <ul class="space-y-1 text-sm leading-6">
              <li>产品型号：{{ deviceInfo.model || '-' }}</li>
              <li>设备名称：{{ deviceInfo.name || '-' }}</li>
              <li>运行时间：{{ deviceInfo.sysRunTime || '-' }}</li>
              <li>MAC 地址：{{ deviceInfo.macAddress || '-' }}</li>
              <li v-if="deviceInfo.location">
                位置：{{ deviceInfo.location }}
              </li>
            </ul>

            <div
              class="metrics flex flex-wrap items-center justify-center gap-12 lg:justify-start"
            >
              <!-- CPU -->
              <div class="metric text-center">
                <svg viewBox="0 0 36 36" class="circular-chart">
                  <path
                    class="circle-bg"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    class="circle"
                    :stroke-dasharray="`${deviceInfo.cpu},100`"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.35" class="percentage">
                    {{ deviceInfo.cpu }}%
                  </text>
                </svg>
                <div class="metric-title mt-2">CPU 占用率</div>
              </div>
              <!-- Memory -->
              <div class="metric text-center">
                <svg viewBox="0 0 36 36" class="circular-chart">
                  <path
                    class="circle-bg"
                    d="M18 2.0845
                       a 15.9155 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    class="circle"
                    stroke-dasharray="12,100"
                    d="M18 2.0845
                       a 15.9155 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.35" class="percentage">12%</text>
                </svg>
                <div class="metric-title mt-2">内存占用率</div>
              </div>
              <!-- 温度 -->
              <div class="metric text-center">
                <svg viewBox="0 0 36 36" class="circular-chart">
                  <path
                    class="circle-bg"
                    d="M18 2.0845
                       a 15.9155 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.35" class="percentage">
                    {{ deviceInfo.temperature }}
                  </text>
                </svg>
                <div class="metric-title mt-2">温度</div>
              </div>
              <!-- Fan -->
              <div class="metric text-center">
                <img :src="fanGif" alt="Fan" class="mx-auto h-16 w-16" />
                <div class="metric-title mt-2">
                  风扇状态：{{ deviceInfo.fan }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 端口信息表 (始终显示) -->
        <div class="table-wrapper mt-6 max-h-72 overflow-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-[#006b9e] text-white">
                <th class="w-16 px-3 py-2 text-left">序号</th>
                <th class="px-3 py-2 text-left">端口名称</th>
                <th class="px-3 py-2 text-left">IP 地址</th>
                <th class="px-3 py-2 text-left">状态</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in tableRows"
                :key="idx"
                :class="idx % 2 === 0 ? 'bg-[#00294d]' : 'bg-[#063158]'"
                class="text-white"
              >
                <td class="px-3 py-2">{{ idx + 1 }}</td>
                <td class="px-3 py-2">{{ row.portName }}</td>
                <td class="px-3 py-2">
                  {{ row.portIp ? row.portIp.join(', ') : '-' }}
                </td>
                <td class="px-3 py-2">
                  {{ row.portStatus === 1 ? '连接' : '未连接' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <!-- .device-preview-page -->
  </div>
  <!-- .device-preview-container -->
</template>

<style scoped>
.device-preview-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.top-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center; /* center logo horizontally */
  width: 100%;
  height: 100px;
  background-color: #161a21;
}

.top-header img {
  max-height: 120px; /* shrink oversized logo */
  object-fit: contain;
}

.device-preview-page {
  flex: 1;
  min-height: 0;
}

.switch-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
}

.device-render {
  /* scale handled dynamically via style binding */
}

.toggle-btn {
  position: absolute;
  top: 50%;
  right: 24px;
  padding: 4px 14px;
  font-size: 14px;
  color: #fff;
  cursor: pointer;
  background: #2a69d7;
  border: 1px solid #3ae0ff;
  border-radius: 4px;
  transform: translateY(-50%);
}

.toggle-btn:hover {
  background: #154c8a;
}

.detail-panel {
  max-width: 960px;
  margin: 0 auto;
}

.circular-chart {
  width: 80px;
  height: 80px;
}

.circle-bg {
  fill: none;
  stroke: #29303d;
  stroke-width: 3;
}

.circle {
  fill: none;
  stroke: #3ae0ff;
  stroke-width: 3;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: center;
}

.percentage {
  font-size: 10px;
  dominant-baseline: central;
  text-anchor: middle;
  fill: #fff;
}

.table-wrapper {
  max-height: 18rem;
}
</style>
