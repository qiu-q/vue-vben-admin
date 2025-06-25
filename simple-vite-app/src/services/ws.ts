import mitt from 'mitt';
import { WS_URLS } from '#/constants/ws';

type WsEventPayload = any;
type Bus = Record<string, WsEventPayload>;
const emitter = mitt<Bus>();

const wsPool: Map<string, WebSocket> = new Map();

function connect(url: string, channelKey: string) {
  if (wsPool.has(channelKey)) {
    console.log(`[WS] 已复用连接: ${channelKey}`);
    return wsPool.get(channelKey)!;
  }

  console.log(`[WS] 尝试连接: ${url}`);

  let ws: WebSocket;
  let heartbeat: null | number = null;

  const reopen = () => {
    console.warn(`[WS] 连接断开，准备重连: ${url}`);
    setTimeout(() => connect(url, channelKey), 2000);
  };

  const openSocket = () => {
    ws = new WebSocket(url);
    wsPool.set(channelKey, ws);

    ws.addEventListener('open', () => {
      console.log(`[WS] ✅ 已连接: ${url}`);
      heartbeat && clearInterval(heartbeat);
      heartbeat = window.setInterval(() => {
        if (ws.readyState === 1) {
          ws.send('ping');
          console.log(`[WS] 发送心跳 ping: ${url}`);
        }
      }, 10_000);
    });

    ws.onmessage = (ev) => {
      console.log(`[WS] ⬇️ 收到消息: ${url}`, ev.data);
      let data: WsEventPayload = ev.data;
      try {
        data = JSON.parse(ev.data);
      } catch {}
      // ✅ 用 channelKey 发出事件（不是 url）
      emitter.emit(channelKey, data);
    };

    ws.onerror = (err) => {
      console.error(`[WS] ❌ 错误: ${url}`, err);
    };

    ws.onclose = () => {
      console.warn(`[WS] ⛔ 连接关闭: ${url}`);
      heartbeat && clearInterval(heartbeat);
      wsPool.delete(channelKey);
      reopen();
    };
  };

  openSocket();
  return ws;
}

export function useWs(channelKey: string, handler: (payload: any) => void) {
  const url = WS_URLS[channelKey];
  const socket = connect(url, channelKey); // 👈 传入逻辑通道
  console.log(`[WS] 📌 开始订阅: ${channelKey}`);
  emitter.on(channelKey, handler);
  return () => {
    console.log(`[WS] 🔌 取消订阅: ${channelKey}`);
    emitter.off(channelKey, handler);
  };
}

export function initAllWs() {
  Object.values(WS_URLS).forEach((url) => connect(url));
}

export function closeAllWs() {
  console.log('[WS] 🔒 正在关闭所有连接');
  wsPool.forEach((ws, url) => {
    console.log(`[WS] 关闭连接: ${url}`);
    ws.close();
  });
  wsPool.clear();
}
