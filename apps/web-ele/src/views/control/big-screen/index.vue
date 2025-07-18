<script setup lang="ts">
import BottomTrend from './components/BottomTrend.vue';
import EventLog from './components/EventLog.vue';
import LeftPanel from './components/LeftPanel.vue';
import MainMap from './components/MainMap.vue';
import RightStatus from './components/RightStatus.vue';
import TopHeader from './components/TopHeader.vue';
</script>
<template>
  <div class="dashboard">
    <TopHeader />
    <div class="grid-container">
      <dv-border-box8 :reverse="true" class="left">
        <LeftPanel />
      </dv-border-box8>

      <dv-border-box8 :reverse="true" class="main">
        <MainMap />
      </dv-border-box8>

      <dv-border-box8 :reverse="true" class="right-top">
        <RightStatus />
      </dv-border-box8>

      <dv-border-box8 :reverse="true" class="bottom-left">
        <BottomTrend />
      </dv-border-box8>

      <dv-border-box8 :reverse="true" class="bottom-right">
        <EventLog />
      </dv-border-box8>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f1a2b;
}

.grid-container {
  display: grid;
  flex: 1;
  grid-template-areas:
    'left main right-top'
    'bottom-left main bottom-right';
  /* stylelint-disable-next-line declaration-block-no-redundant-longhand-properties */
  grid-template-rows: 1fr 1fr;
  /* stylelint-disable-next-line declaration-block-no-redundant-longhand-properties */
  grid-template-columns: 250px 1fr 300px;
  gap: 8px;
  padding: 8px;
}

.left {
  grid-area: left;
}

.main {
  grid-area: main;
}

.right-top {
  grid-area: right-top;
}

.bottom-left {
  grid-area: bottom-left;
}

.bottom-right {
  grid-area: bottom-right;
}

.grid-container > * {
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgb(0 0 0 / 40%);
}

.box {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 12px;
}
</style>
