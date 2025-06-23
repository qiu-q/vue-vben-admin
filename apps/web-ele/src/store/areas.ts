// areas.ts
import { defineStore } from 'pinia';

interface Area {
  name: string;
  devices: Device[];
}

interface Device {
  uuid: string;
  position: { x: number; y: number };
  layers: any[];
}

export const useAreasStore = defineStore('areas', {
  state: () => ({
    areas: [] as Area[],
    selectedArea: '机房一',
  }),
  actions: {
    selectArea(name: string) {
      this.selectedArea = name;
    },
  },
});
