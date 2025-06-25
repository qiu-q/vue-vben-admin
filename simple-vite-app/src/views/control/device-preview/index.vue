<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

// 风扇动图
// 顶部 logo
const topHeader = 'data:image/png;base64,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';
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
