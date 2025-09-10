<script setup lang="ts"></script>
<template>
  <dv-border-box8 :reverse="true" class="right-status">
    <p>通信状态</p>
    <p>在线设备：12 / 异常：2</p>
  </dv-border-box8>
</template>
<style scoped>
.right-status {
  height: 100%;
  padding: 16px;
  color: white;
  background: #264653;
  box-sizing: border-box;
}
</style>

