<template>
  <teleport to="body">
    <div v-if="visible" class="image-preview" @click.self="close">
      <img :src="src" alt="preview" />
      <button class="image-preview-close" @click="close">×</button>
    </div>
  </teleport>
</template>

<script lang="ts" setup>
const props = defineProps<{ src: string; visible: boolean }>();
const emit = defineEmits<{ close: [] }>();

function close() {
  emit('close');
}
</script>

<style scoped>
.image-preview {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 75%);
}

.image-preview img {
  max-width: 92vw;
  max-height: 92vh;
  object-fit: contain;
}

.image-preview-close {
  position: absolute;
  top: 24px;
  right: 24px;
  width: 40px;
  height: 40px;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  border: none;
  border-radius: 50%;
}
</style>
