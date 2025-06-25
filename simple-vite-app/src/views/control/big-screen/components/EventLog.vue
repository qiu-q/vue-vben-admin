<script setup lang="ts"></script>
<template>
  <dv-border-box8 :reverse="true" class="event-log">
    <p>🔥 实时告警</p>
    <ul>
      <li>12:33:01 - PLC1 断连</li>
    </ul>
  </dv-border-box8>
</template>
<style scoped>
.event-log {
  height: 100%;
  padding: 16px;
  color: white;
  background: #e76f51;
  box-sizing: border-box;
}

ul {
  padding-left: 16px;
}

li {
  margin-bottom: 6px;
}
</style>
