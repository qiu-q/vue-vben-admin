import type { RouteRecordRaw } from 'vue-router';

const controlRoutes: RouteRecordRaw[] = [
  // --- 大屏 ---
  // {
  //   name: 'ControlScreen',
  //   path: '/control/screen',
  //   component: () => import('#/views/control/big-screen/index.vue'),
  //   meta: { icon: 'lucide:tv', title: '大屏', affixTab: true, order: 0 },
  // },

  // --- 网络拓扑 ---
  {
    name: 'NetworkTopology',
    path: '/control/topology',
    component: () => import('#/views/control/network-topology/index.vue'),
    meta: { icon: 'lucide:network', title: '拓扑图', order: 1 },
  },
  {
    name: 'LldpNetworkTopology',
    path: '/control/lldp-topology',
    component: () => import('#/views/control/lldp-topology/index.vue'),
    meta: { icon: 'lucide:git-branch', title: 'LLDP拓扑', order: 1.5 },
  },

  // --- 设备编辑器 ---
  {
    name: 'DeviceEditor',
    path: '/control/device-editor',
    component: () => import('#/views/control/device-editor/index.vue'),
    meta: { icon: 'lucide:pencil-ruler', title: '设备编辑', order: 2 },
  },

  // --- 设备监控预览 ---
  // {
  //   name: 'DevicePreview',
  //   path: '/control/device-preview/:deviceId',
  //   component: () => import('#/views/control/device-preview/index.vue'),
  //   meta: { icon: 'lucide:monitor', title: '设备预览', order: 3 },
  //   props: true,
  // },
  // --- 简洁预览页面 ---
  // {
  //   name: 'DeviceView',
  //   path: '/control/device-view/:deviceId',
  //   component: () => import('#/views/control/device-view/index.vue'),
  //   meta: { icon: 'lucide:eye', title: '阅览', order: 4 },
  //   props: true,
  // },
  // // 机柜
  // {
  //   name: 'Cabinet',
  //   path: '/control/cabinet',
  //   component: () => import('#/views/control/test/index.vue'),
  //   meta: { icon: 'lucide:monitor', title: '机柜', order: 5 },
  // },
  // apps/web-ele/src/views/control/networkTopologyDiagram/components/TopologyGraph.vue
  // {
  //   name: 'TopologyGraph',
  //   path: '/control/topology-graph',
  //   component: () =>
  //     import(
  //       '#/views/control/networkTopologyDiagram/components/TopologyGraph.vue'
  //     ),
  // },
];

export default controlRoutes;
