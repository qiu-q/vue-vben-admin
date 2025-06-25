<script setup lang="ts"></script>
<template>
  <dv-border-box8 :reverse="true" class="left-panel">
    <p>设备分组</p>
    <ul>
      <li>PLC</li>
      <li>传感器</li>
      <li>交换机</li>
    </ul>
  </dv-border-box8>
</template>
<style scoped>
.left-panel {
  height: 100%;
  padding: 16px;
  color: white;
  background: #14213d;
  box-sizing: border-box;
}

ul {
  padding-left: 16px;
}

li {
  margin: 6px 0;
}
</style>
