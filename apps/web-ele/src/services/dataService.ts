import type { DeviceConfig, DeviceStatus } from '#/models/device';

import { requestClient } from '#/api/request';

export function getDeviceConfig(deviceId: string) {
  return requestClient.get<DeviceConfig>(`/devices/${deviceId}/config`);
}

export function getDeviceStatus(deviceId: string) {
  return requestClient.get<DeviceStatus>(`/devices/${deviceId}/status`);
}

export function getPortStatus(deviceId: string, portIndex: number) {
  return requestClient.get<{ rawValue: number | string }>(
    `/api/devices/${deviceId}/status`,
    { params: { port: portIndex } },
  );
}
