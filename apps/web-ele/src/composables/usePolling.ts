// src/composables/usePolling.ts
import { onMounted, onUnmounted } from 'vue';

import { getDeviceStatus } from '#/services/dataService';
import { useDeviceStore } from '#/store/deviceStore';

/**
 * 轮询拉取设备状态并写入 Pinia
 * @param deviceId 设备 ID
 * @param interval 轮询间隔 ms，默认 5000
 */
export function usePolling(deviceId: string, interval = 5000) {
  const store = useDeviceStore();
  let timer: null | ReturnType<typeof setInterval> = null;

  const fetchStatus = async () => {
    const res = await getDeviceStatus(deviceId);
    store.setStatus(res);
  };

  onMounted(() => {
    fetchStatus();
    timer = setInterval(fetchStatus, interval);
  });

  onUnmounted(() => {
    timer && clearInterval(timer);
  });
}
