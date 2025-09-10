<template>
  <div class="cabinet-container">
    <div
      v-for="u in totalU"
      :key="u"
      class="cabinet-slot"
    >
      <div class="u-label">U{{ totalU - u + 1 }}</div>
      <div class="slot-content">
        <slot :u="totalU - u + 1" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const totalU = 42;
</script>

<style scoped>
.cabinet-container {
  width: 480px;
  margin: 0 auto;
  background-color: #333;
  padding: 10px;
  border-radius: 8px;
  overflow-y: auto;
  border: 2px solid #444;
}

.cabinet-slot {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #555;
  height: 18px;
  background-color: #2d2d2d;
  padding: 0 5px;
  font-size: 12px;
  color: #fff;
}

.u-label {
  width: 40px;
  text-align: right;
  margin-right: 10px;
  color: #ccc;
  font-family: monospace;
}

.slot-content {
  flex: 1;
  display: flex;
  align-items: center;
  height: 100%;
}
</style>

