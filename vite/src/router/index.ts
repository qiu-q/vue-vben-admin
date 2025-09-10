import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    name: 'ControlScreen',
    path: '/control/screen',
    component: () => import('#/views/control/big-screen/index.vue'),
    meta: { title: '大屏' },
  },
  {
    name: 'NetworkTopology',
    path: '/control/topology',
    component: () => import('#/views/control/network-topology/index.vue'),
    meta: { title: '拓扑图' },
  },
  {
    name: 'DeviceEditor',
    path: '/control/device-editor',
    component: () => import('#/views/control/device-editor/index.vue'),
    meta: { title: '设备编辑' },
  },
  {
    name: 'DevicePreview',
    path: '/control/device-preview/:deviceId',
    component: () => import('#/views/control/device-preview/index.vue'),
    meta: { title: '设备预览' },
    props: true,
  },
  {
    name: 'DeviceView',
    path: '/control/device-view/:deviceId',
    component: () => import('#/views/control/device-view/index.vue'),
    meta: { title: '阅览' },
    props: true,
  },
  {
    name: 'Cabinet',
    path: '/control/cabinet',
    component: () => import('#/views/control/test/index.vue'),
    meta: { title: '机柜' },
  },
  {
    name: 'TopologyGraph',
    path: '/control/topology-graph',
    component: () => import('#/views/control/networkTopologyDiagram/components/TopologyGraph.vue'),
  },
  { path: '/', redirect: '/control/topology' },
];

export default routes;

