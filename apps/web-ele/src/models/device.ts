// src/models/device.ts
// 设备可视化核心数据结构

export interface LayerBase {
  id: string;
  name: string;
  type: 'custom' | 'icons' | 'image' | 'ports' | 'port' | 'port-adv';
  visible: boolean;
  zIndex: number;
  config: any;
}

export interface DeviceConfig {
  deviceId: string;
  width: number;
  height: number;
  layers: LayerBase[];
}

export interface PortInstance {
  id: string;
  portIndex: number;
  x: number;
  y: number;
  deviceIp?: string;
  dataSources: DataSource[];
  statusMapping: Record<number | string, StatusRender>;
}

export interface DataSource {
  id: string;
  type: 'http' | 'modbus' | 'mqtt' | 'opcua' | 'snmp';
  config: Record<string, any>;
  pollingInterval: number;
}

export interface StatusRender {
  iconUrl?: string;
  className?: string;
  props?: Record<string, any>;
}

export interface DeviceStatus {
  deviceId: string;
  timestamp: string;
  ports: Array<{ portIndex: number; rawValue: number | string }>;
  attributes?: Record<string, any>;
  events?: any[];
}
