<template>
  <div class="lldp-topology-page">
    <div ref="containerRef" class="topology-canvas"></div>
    <p v-if="errorMessage" class="error-hint">
      {{ errorMessage }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { DataSet } from 'vis-data/peer';
import { Network } from 'vis-network/peer';
import 'vis-network/styles/vis-network.css';

type Node = { id: number; label: string; image: string };
type Edge = { id: number; from: number; to: number };

// Use existing dev proxy (/api -> backend) to avoid CORS issues when running locally.
const API_URL = '/api/jx-device/switchx/SwitchInf/lldpLinks/2';

const containerRef = ref<HTMLDivElement | null>(null);
const errorMessage = ref('');

function parseTopology(input: any) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const idMap = new Map<string, number>();
  let edgeId = 1;

  const data = input?.data ?? {};

  const ensureNode = (ip: string) => {
    if (!idMap.has(ip)) {
      const id = nodes.length + 1;
      idMap.set(ip, id);
      nodes.push({
        id,
        label: ip,
        image: getIcon(ip),
      });
    }
    return idMap.get(ip)!;
  };

  for (const src in data) {
    const srcId = ensureNode(src);
    const targets = data[src] ?? {};
    for (const dst in targets) {
      const dstId = ensureNode(dst);
      edges.push({ id: edgeId++, from: srcId, to: dstId });
    }
  }
  return { nodes, edges };
}

const getIcon = (ip: string) => {
  if (ip.includes('253')) {
    return 'http://192.168.1.99:9000/qiuqiu/topologyIcons/core-switch.png';
  }
  if (ip.includes('10.')) {
    return 'http://192.168.1.99:9000/qiuqiu/topologyIcons/edge-switch.png';
  }
  return 'http://192.168.1.99:9000/qiuqiu/topologyIcons/default.png';
};

let network: Network | null = null;

async function init() {
  if (!containerRef.value) {
    return;
  }
  let json: any = null;
  errorMessage.value = '';

  try {
    const response = await fetch(API_URL, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`接口返回异常：${response.status}`);
    }
    json = await response.json();
  } catch (error) {
    errorMessage.value = '拓扑数据获取失败';
    console.error('Failed to fetch topology data', error);
    return;
  }

  const { nodes, edges } = parseTopology(json);
  if (!nodes.length) {
    errorMessage.value = '暂无拓扑数据';
    return;
  }

  network?.destroy();
  network = new Network(
    containerRef.value,
    {
      nodes: new DataSet<Node>(nodes),
      edges: new DataSet<Edge>(edges),
    },
    {
      nodes: {
        shape: 'image',
        size: 30,
        font: { color: '#fff' },
      },
      layout: { randomSeed: 2 },
      physics: { enabled: true, stabilization: { iterations: 100 } },
    },
  );

  network.once('stabilizationIterationsDone', () => {
    network?.setOptions({ physics: false });
  });
}

onMounted(init);
onBeforeUnmount(() => {
  network?.destroy();
  network = null;
});
</script>

<style scoped>
.lldp-topology-page {
  position: relative;
  min-height: 600px;
}

.topology-canvas {
  width: 100%;
  height: 600px;
  background-color: transparent;
}

.error-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff8383;
  font-size: 16px;
  margin: 0;
}
</style>
