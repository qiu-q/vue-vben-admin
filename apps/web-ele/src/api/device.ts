import request from '#/api/request1';

// 获取设备配置
export function getDeviceConfig(deviceId: string) {
  return request.get(`/mockapi/devices/${deviceId}/config`);
}

// 保存设备配置
export function saveDeviceConfig(deviceId: string, data: any) {
  return request.post(`/mockapi/devices/${deviceId}/config`, data);
}

// 获取设备状态
export function getDeviceStatus(deviceId: string) {
  return request.get(`/mockapi/devices/${deviceId}/status`);
}

// 获取设备日志
export function getDeviceLogs(deviceId: string) {
  return request.get(`/mockapi/devices/${deviceId}/logs`);
}

// 上传文件（优化版：catch error，返回统一格式）
export async function uploadFile(formData: FormData) {
  try {
    const res = await request.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    // 如果接口是 {code, msg, data} 结构，直接返回
    return res;
  } catch (err: any) {
    console.error('uploadFile error', err);
    return {
      code: -1,
      msg: err?.message || '上传文件出错',
      data: null,
    };
  }
}

// 获取设备列表
export async function listDevices() {
  try {
    const resp = await fetch('/mockapi/devices');
    return await resp.json(); // {code, data}
  } catch (err: any) {
    console.error('listDevices error', err);
    return {
      code: -1,
      msg: err?.message || '获取设备列表出错',
      data: [],
    };
  }
}
