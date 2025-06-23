<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

// 风扇动图
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

/* ───── 视图切换 ───── */
const viewMode = ref<'detail' | 'device'>('device');
const toggleView = () => {
  viewMode.value = viewMode.value === 'device' ? 'detail' : 'device';
};
const toggleLabel = computed(() =>
  viewMode.value === 'device' ? '显示详情' : '显示设备',
);

/* ───── 模拟表格数据 ───── */
interface PortInfo {
  portName: string;
  remoteDevice: string;
  remotePort: string;
  deviceModel: string;
}

const tableRows: PortInfo[] = [
  {
    portName: 'GigabitEthernet0/0/1',
    remoteDevice: '备份服务器',
    remotePort: 'eth5',
    deviceModel: 'Linux CNA018 3.10.0-862.14.1.6_93.x86_64',
  },
  {
    portName: 'GigabitEthernet0/0/2',
    remoteDevice: '',
    remotePort: '',
    deviceModel: '',
  },
  {
    portName: 'GigabitEthernet0/0/3',
    remoteDevice: '仲裁服务器',
    remotePort: 'eth5',
    deviceModel: '',
  },
  {
    portName: 'GigabitEthernet0/0/4',
    remoteDevice: '仲裁服务器',
    remotePort: 'eth7',
    deviceModel: '',
  },
  {
    portName: 'GigabitEthernet0/0/5',
    remoteDevice: '',
    remotePort: '',
    deviceModel: '',
  },
  {
    portName: 'GigabitEthernet0/0/6',
    remoteDevice: '',
    remotePort: '',
    deviceModel: '',
  },
  {
    portName: 'GigabitEthernet0/0/7',
    remoteDevice: '',
    remotePort: '',
    deviceModel: '',
  },
  {
    portName: 'GigabitEthernet0/0/8',
    remoteDevice: '',
    remotePort: '',
    deviceModel: '',
  },
  {
    portName: 'GigabitEthernet0/0/9',
    remoteDevice: 'CNA018',
    remotePort: 'eth5',
    deviceModel: 'Linux CNA018 3.10.0-862.14.1.6_93.x86_64',
  },
  {
    portName: 'GigabitEthernet0/0/10',
    remoteDevice: 'CNA018',
    remotePort: 'eth7',
    deviceModel: 'Linux CNA018 3.10.0-862.14.1.6_93.x86_64',
  },
];

/* ───── 拉取并解析设备配置 ───── */
async function loadConfig() {
  loading.value = true;
  error.value = '';

  try {
    const id = deviceId.value;
    const requests = [
      fetch(`/api/jx-device/switchx/SwitchInf/getFanInfo/${id}`, {
        method: 'POST',
      }),
      fetch(`/api/jx-device/switchx/SwitchInf/getCpuInfo/${id}`, {
        method: 'POST',
      }),
      fetch(`/jx-device/switchx/SwitchInf/getMacAddress/${id}`, {
        method: 'POST',
      }),
      fetch(`/api/jx-device/switchx/SwitchInf/getModel/${id}`, { method: 'POST' }),
      fetch(`/api/jx-device/switchx/SwitchInf/getDeviceName/${id}`, {
        method: 'POST',
      }),
      fetch(`/api/jx-device/switchx/SwitchInf/getPortStateInfo/${id}`, {
        method: 'POST',
      }),
    ];

    const [fanResp, cpuResp, macResp, modelResp, nameResp, portResp] =
      await Promise.all(requests);

    const [fanData, cpuData, macData, modelData, nameData, portData] =
      await Promise.all([
        fanResp.json(),
        cpuResp.json(),
        macResp.json(),
        modelResp.json(),
        nameResp.json(),
        portResp.json(),
      ]);

    config.value = {
      deviceId: id,
      fan: fanData.data || {},
      cpu: cpuData.data || {},
      mac: macData.data || {},
      model: modelData.data || {},
      name: nameData.data || {},
      ports: portData.data || [],
    };
  } catch (error_) {
    console.error(error_);
    error.value = '加载失败';
  }

  loading.value = false;
}

onMounted(loadConfig);
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
          <div class="switch-preview flex justify-center">
            <div class="device-render">
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
              <li>产品型号：S5720S‑52P‑LI‑AC</li>
              <li>设备名称：switch 9‑39</li>
              <li>运行时间：394 天 18:46:02</li>
              <li>序列号：21980106012SLB503139</li>
              <li>MAC 地址：a416‑e74e‑9f99</li>
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
                    stroke-dasharray="7,100"
                    d="M18 2.0845
                       a 15.9155 15.9155 0 0 1 0 31.831
                       a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <text x="18" y="20.35" class="percentage">7%</text>
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
                  <text x="18" y="20.35" class="percentage">41°C</text>
                </svg>
                <div class="metric-title mt-2">温度</div>
              </div>
              <!-- Fan -->
              <div class="metric text-center">
                <img
                  src="http://192.168.1.99:9000/qiuqiu/img4.gif"
                  alt="Fan"
                  class="mx-auto h-16 w-16"
                />
                <div class="metric-title mt-2">风扇状态</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 端口信息表 (始终显示) -->
        <div class="mt-6 overflow-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-[#006b9e] text-white">
                <th class="w-16 px-3 py-2 text-left">序号</th>
                <th class="px-3 py-2 text-left">端口名称</th>
                <th class="px-3 py-2 text-left">远端设备名称</th>
                <th class="px-3 py-2 text-left">远端端口名称</th>
                <th class="px-3 py-2 text-left">远端设备型号</th>
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
                <td class="px-3 py-2">{{ row.remoteDevice || '-' }}</td>
                <td class="px-3 py-2">{{ row.remotePort || '-' }}</td>
                <td class="truncate px-3 py-2" :title="row.deviceModel">
                  {{ row.deviceModel || '-' }}
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
  width: 100%;
  height: 100px;
  display: flex;
  justify-content: center; /* center logo horizontally */
  align-items: center;
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
  width: 100%;
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
.device-render {
  transform: scale(1.4); /* proportional enlarge */
  transform-origin: top center;
}

.top-header {
  position: relative;
}
.toggle-btn {
  position: absolute;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  border: 1px solid #3ae0ff;
  background: #2a69d7;
  padding: 4px 14px;
  font-size: 14px;
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
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
  fill: #ffffff;
  font-size: 10px;
  text-anchor: middle;
  dominant-baseline: central;
}
</style>
