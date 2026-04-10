import { useState, useEffect, useRef, useCallback } from 'react';

interface UseScannerRelayOptions {
  enabled: boolean;
  onTagReceived: (tagId: string) => void;
}

export function useScannerRelay({ enabled, onTagReceived }: UseScannerRelayOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const onTagRef = useRef(onTagReceived);
  onTagRef.current = onTagReceived;

  const wsUrl = `ws://${window.location.host}/ws/scanner`;

  const connect = useCallback(() => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'scan' && data.tagId) {
          onTagRef.current(data.tagId);
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (enabled) {
        reconnectRef.current = window.setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => ws.close();
  }, [enabled, wsUrl]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      wsRef.current?.close();
      setConnected(false);
    }

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [enabled, connect]);

  return { connected };
}
