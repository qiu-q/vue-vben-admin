<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div style="padding: 12px; font-family: ui-sans-serif, system-ui;">
    <nav style="display:flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;">
      <RouterLink to="/control/screen">大屏</RouterLink>
      <RouterLink to="/control/topology">拓扑图</RouterLink>
      <RouterLink to="/control/device-editor">设备编辑</RouterLink>
      <RouterLink to="/control/device-preview/1">设备预览#1</RouterLink>
      <RouterLink to="/control/device-view/1">阅览#1</RouterLink>
      <RouterLink to="/control/cabinet">机柜</RouterLink>
      <RouterLink to="/control/topology-graph">拓扑组件</RouterLink>
    </nav>
    <RouterView />
  </div>
  
</template>

<style>
a { text-decoration: none; color: #1677ff; }
a.router-link-active { font-weight: 600; }
body { margin: 0; }
</style>

