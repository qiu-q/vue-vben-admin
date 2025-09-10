import mitt from 'mitt';
import { WS_URLS } from '#/constants/ws';

type WsEventPayload = any;
type Bus = Record<string, WsEventPayload>;
const emitter = mitt<Bus>();

const wsPool: Map<string, WebSocket> = new Map();

function connect(url: string, channelKey: string) {
  if (wsPool.has(channelKey)) {
    return wsPool.get(channelKey)!;
  }

  let ws: WebSocket;
  let heartbeat: null | number = null;

  const reopen = () => {
    setTimeout(() => connect(url, channelKey), 2000);
  };

  const openSocket = () => {
    ws = new WebSocket(url);
    wsPool.set(channelKey, ws);

    ws.addEventListener('open', () => {
      heartbeat && clearInterval(heartbeat);
      heartbeat = window.setInterval(() => {
        if (ws.readyState === 1) {
          ws.send('ping');
        }
      }, 10000);
    });

    ws.onmessage = (ev) => {
      let data: WsEventPayload = ev.data;
      try {
        data = JSON.parse(ev.data);
      } catch {}
      emitter.emit(channelKey, data);
    };

    ws.onclose = () => {
      heartbeat && clearInterval(heartbeat);
      wsPool.delete(channelKey);
      reopen();
    };
  };

  openSocket();
  return ws;
}

export function useWs(channelKey: string, handler: (payload: any) => void) {
  const url = WS_URLS[channelKey as keyof typeof WS_URLS] as string;
  connect(url, channelKey);
  emitter.on(channelKey, handler);
  return () => {
    emitter.off(channelKey, handler);
  };
}

export function closeAllWs() {
  wsPool.forEach((ws) => ws.close());
  wsPool.clear();
}

