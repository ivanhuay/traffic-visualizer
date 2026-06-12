import { useEffect, useRef, useState, useCallback } from 'react';

import type { FlowEvent, TopologyConfig } from '../types/index.js';

type TopologyMessage = { type: 'topology'; payload: TopologyConfig };
type FlowEventMessage = { type: 'flow_event'; payload: FlowEvent };
type WSMessage = TopologyMessage | FlowEventMessage;

type State = {
  connected: boolean;
  events: FlowEvent[];
  topology: TopologyConfig | null;
};

const WS_RECONNECT_MS = 2000;
const MAX_EVENTS = 500;

export function useTrafficStream(url: string = '/ws') {
  const [state, setState] = useState<State>({
    connected: false,
    events: [],
    topology: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = url.startsWith('ws') ? url : `${protocol}//${window.location.host}${url}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, connected: true }));
    };

    ws.onmessage = (ev: MessageEvent<string>) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(ev.data) as WSMessage;
        if (msg.type === 'topology') {
          setState((s) => ({ ...s, topology: msg.payload }));
        } else if (msg.type === 'flow_event') {
          setState((s) => ({
            ...s,
            events: [...s.events.slice(-MAX_EVENTS + 1), msg.payload],
          }));
        }
      } catch {
        // malformed message — ignore
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setState((s) => ({ ...s, connected: false }));
      reconnectTimer.current = setTimeout(connect, WS_RECONNECT_MS);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return state;
}
