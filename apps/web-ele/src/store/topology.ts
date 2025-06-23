// /stores/topology.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/** 设备 */
export interface Device {
  id: string;
  name: string;
  roomId: string;
  x: number;
  y: number;
}

/** 机房 */
export interface Room {
  id: string;
  name: string;
  devices: Device[];
}

/** 连线（包含同房/跨房/外部） */
export interface Edge {
  id: string;
  fromDeviceId: string;
  fromRoomId: string;
  toDeviceId: string;
  toRoomId: string;
  type: 'internal' | 'cross' | 'external';
  color?: string; // 光纤颜色（跨房/外部用）
}

/** 外部连线（未连接设备前） */
export interface ExternalEdge {
  id: string;
  name: string;
  color?: string;
  toDeviceId?: string;
  toRoomId?: string;
}

export const useTopologyStore = defineStore('topology', () => {
  // 机房列表
  const rooms = ref<Room[]>([]);
  // 全部连线（同房、跨房、外部）
  const edges = ref<Edge[]>([]);
  // 外部连线列表（在主画布顶部显示）
  const externalEdges = ref<ExternalEdge[]>([]);

  // 选中的机房、设备
  const selectedRoomId = ref<string | null>(null);
  const selectedDeviceId = ref<string | null>(null);

  // 计算所有设备（可选）
  const devices = computed(() =>
    rooms.value.flatMap(room => room.devices.map(dev => ({ ...dev, roomName: room.name })))
  );

  // 获取跨机房连线
  const crossRoomEdges = computed(() =>
    edges.value.filter(e => e.type === 'cross')
  );

  // ===== 操作API =====

  // 添加机房
  function addRoom(room: Room) {
    rooms.value.push(room);
  }

  // 添加设备
  function addDevice(roomId: string, device: Device) {
    const room = rooms.value.find(r => r.id === roomId);
    if (room) room.devices.push(device);
  }

  // 移动设备
  function moveDevice(deviceId: string, x: number, y: number) {
    for (const room of rooms.value) {
      const dev = room.devices.find(d => d.id === deviceId);
      if (dev) {
        dev.x = x;
        dev.y = y;
        break;
      }
    }
  }

  // 添加连线（支持同房/跨房/外部）
  function addEdge(edge: Edge) {
    edges.value.push(edge);
  }

  // 添加外部连线
  function addExternalEdge(external: ExternalEdge) {
    externalEdges.value.push(external);
  }

  // 外部连线拖到设备时，变成真正连线
  function connectExternalEdgeToDevice(edgeId: string, toDeviceId: string, toRoomId: string) {
    const external = externalEdges.value.find(e => e.id === edgeId);
    if (external) {
      external.toDeviceId = toDeviceId;
      external.toRoomId = toRoomId;
      // 自动加到 edges
      edges.value.push({
        id: `external-${edgeId}`,
        fromDeviceId: edgeId, // 特殊：外部线的id
        fromRoomId: 'external',
        toDeviceId,
        toRoomId,
        type: 'external',
        color: external.color,
      });
      // 你可以在这里决定要不要把外部连线移除列表
      // externalEdges.value = externalEdges.value.filter(e => e.id !== edgeId)
    }
  }

  // ===== 你可以自由扩展：删除、更换颜色、同步缩略图等 =====

  return {
    // state
    rooms,
    edges,
    externalEdges,
    selectedRoomId,
    selectedDeviceId,
    // computed
    devices,
    crossRoomEdges,
    // actions
    addRoom,
    addDevice,
    moveDevice,
    addEdge,
    addExternalEdge,
    connectExternalEdgeToDevice,
  };
});
