<script setup lang="ts">
import { onMounted, ref, toRef, watch } from 'vue';

/* ---------- Types ---------- */
interface RawTopology {
  [src: string]: Record<string, string>;
}
interface NodeMeta {
  iconKey: string;
  col: number;
}

/* ---------- Props ---------- */
const props = withDefaults(
  defineProps<{
    lineColor?: string;
    resolve?: (id: string) => NodeMeta;
    topologyData: RawTopology;
  }>(),
  { lineColor: '#4cafef', resolve: undefined },
);
const lineColor = toRef(props, 'lineColor');

/**
 * ----------------------------
 *  MOCK DATA FOR QUICK DEMO
 * ----------------------------
 * Feel free to replace or remove.
 */
const mockTopo: RawTopology = {
  // Core switch
  '10.0.0.1': {
    '10.0.1.11': 'uplink-A',
    '10.0.2.11': 'uplink-B',
    '192.168.1.100': 'mgmt-server',
  },

  // Edge switches
  '10.0.1.11': {
    '10.0.3.21': 'rack-01',
    '10.0.3.22': 'rack-02',
    '10.0.0.1': 'core-uplink',
  },
  '10.0.2.11': {
    '10.0.4.21': 'rack-03',
    '10.0.4.22': 'rack-04',
    '10.0.0.1': 'core-uplink',
  },

  // Rack servers
  '10.0.3.21': { '192.168.1.201': 'VM-A', '192.168.1.202': 'VM-B' },
  '10.0.3.22': { '192.168.1.203': 'VM-C', '192.168.1.204': 'VM-D' },
  '10.0.4.21': { '192.168.1.205': 'VM-E' },
  '10.0.4.22': { '192.168.1.206': 'VM-F' },

  // Management server directly to core
  '192.168.1.100': { '10.0.0.1': 'core-mgmt' },
};

/* ---------- Canvas ---------- */
const DPR = window.devicePixelRatio || 1;
const WIDTH = 1200;
const HEIGHT = 800;
const canvasRef = ref<HTMLCanvasElement | null>(null);
let ctx: CanvasRenderingContext2D | null = null;
const VITE_MINIO_BASE = import.meta.env.VITE_MINIO_BASE;
/* ---------- Load Icons from MinIO ---------- */
const MINIO_BASE = `${VITE_MINIO_BASE}/qiuqiu/topologyIcons`;
const ICON_KEYS = ['core-switch', 'edge-switch', 'server', 'default']; // add more keys if needed

const icons: Record<string, HTMLImageElement> = {};
ICON_KEYS.forEach((key) => {
  const img = new Image();
  img.src = `${MINIO_BASE}/${key}.png`;
  img.addEventListener('load', () => {
    console.warn('✅ loaded:', img.src);
  });
  img.addEventListener('error', () => {
    console.warn('❌ failed to load:', img.src);
  });
  icons[key] = img;
});
const FALLBACK_ICON = icons.default ?? '';

/* ---------- Default resolve ---------- */
function builtinResolve(id: string): NodeMeta {
  const m = id.match(/^\d+\.(\d+)\./);
  const secondOctet = m?.[1];
  if (secondOctet === '253') return { iconKey: 'core-switch', col: 1 };
  if (secondOctet === '10') return { iconKey: 'edge-switch', col: 2 };
  return { iconKey: 'server', col: 3 };
}
const getMeta = (id: string) =>
  props.resolve ? props.resolve(id) : builtinResolve(id);

/* ---------- Build Graph ---------- */
interface Node {
  id: string;
  x: number;
  y: number;
  meta: NodeMeta;
}
function buildGraph(data: RawTopology) {
  const nodes: Node[] = [];
  const nodeMap = new Map<string, Node>();
  const colCount: number[] = [];

  const ensureNode = (id: string) => {
    if (nodeMap.has(id)) return nodeMap.get(id)!;
    const meta = getMeta(id);
    const col = meta.col;
    colCount[col] = (colCount[col] || 0) + 1;

    // Corrected xStep calculation
    const maxCol = Math.max(...Object.keys(colCount).map(Number), col);
    const xStep = WIDTH / (maxCol + 1);

    const node: Node = {
      id,
      x: (col + 0.5) * xStep,
      y: 80 + colCount[col] * 110,
      meta,
    };
    nodes.push(node);
    nodeMap.set(id, node);
    return node;
  };

  const links: { from: Node; label: string; to: Node }[] = [];
  Object.entries(data).forEach(([src, dsts]) => {
    const from = ensureNode(src);
    Object.entries(dsts).forEach(([dst, label]) => {
      const to = ensureNode(dst);
      links.push({ from, to, label });
    });
  });
  return { nodes, links };
}

/* ---------- Draw ---------- */
function draw() {
  if (!ctx) return;
  const source =
    !props.topologyData || Object.keys(props.topologyData).length === 0
      ? mockTopo
      : props.topologyData;
  const { nodes, links } = buildGraph(source);

  ctx.clearRect(0, 0, WIDTH * DPR, HEIGHT * DPR);
  ctx.save();
  ctx.scale(DPR, DPR);

  // DEBUG: draw a red line and green box
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(300, 300);
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = 'green';
  ctx.fillRect(10, 10, 100, 50);

  /* Bezier Links */
  ctx.strokeStyle = lineColor.value; // 亮色连线，黑底可见
  ctx.lineWidth = 2;
  links.forEach(({ from, to }) => {
    const cpX = (from.x + to.x) / 2;
    const cpY = Math.min(from.y, to.y) - 60;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(cpX, cpY, to.x, to.y);
    ctx.stroke();
  });

  /* Nodes */
  nodes.forEach(({ id, x, y, meta }) => {
    const img = icons[meta.iconKey] || FALLBACK_ICON;
    if (img?.complete && img.width > 0) {
      ctx.drawImage(img, x - 28, y - 28, 56, 56);
    } else {
      // Always draw fallback shape
      ctx.fillStyle = '#ff3b30'; // red fallback node
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(id, x, y + 42);
  });

  ctx.restore();
}

/* ---------- Lifecycle ---------- */
onMounted(async () => {
  const c = canvasRef.value!;
  c.width = WIDTH * DPR;
  c.height = HEIGHT * DPR;
  ctx = c.getContext('2d')!;

  await Promise.all(
    Object.values(icons).map(
      (img) =>
        new Promise<void>((res) => {
          if (img.complete) {
            res();
          } else {
            img.addEventListener('load', () => res());
          }
        }),
    ),
  );
  draw();
});
watch(() => props.topologyData, draw, { deep: true });
</script>

<template>
  <canvas ref="canvasRef" width="1200" height="1800"></canvas>
</template>

<style scoped>
:host,
canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: #000; /* 黑色背景方便观察连线 */
}
</style>
