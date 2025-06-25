import { postJson } from '#/api/http';

export function getFanInfo(id: string) {
  return postJson(`/api/jx-device/switchx/SwitchInf/getFanInfo/${id}`);
}

export function getCpuInfo(id: string) {
  return postJson(`/api/jx-device/switchx/SwitchInf/getCpuInfo/${id}`);
}

export function getMacAddress(id: string) {
  return postJson(`/jx-device/switchx/SwitchInf/getMacAddress/${id}`);
}

export function getModel(id: string) {
  return postJson(`/api/jx-device/switchx/SwitchInf/getModel/${id}`);
}

export function getDeviceName(id: string) {
  return postJson(`/api/jx-device/switchx/SwitchInf/getDeviceName/${id}`);
}

export function getPortStateInfo(id: string) {
  return postJson(`/api/jx-device/switchx/SwitchInf/getPortStateInfo/${id}`);
}
