import type { DeviceConfig, DeviceStatus } from '#/models/device';

// src/store/deviceStore.ts
import { defineStore } from 'pinia';

export const useDeviceStore = defineStore('device', {
  state: () => ({
    config: null as DeviceConfig | null,
    status: null as DeviceStatus | null,
  }),
  actions: {
    setConfig(cfg: DeviceConfig) {
      this.config = cfg;
    },
    setStatus(stat: DeviceStatus) {
      this.status = stat;
    },
  },
});
