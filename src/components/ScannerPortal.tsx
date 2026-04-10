import { useState, useEffect, useRef, useCallback } from 'react';

interface ScannerPortalProps {
  wsUrl: string;
}

export function ScannerPortal({ wsUrl }: ScannerPortalProps) {
  const [connected, setConnected] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [lastSent, setLastSent] = useState<string[]>([]);
  const [sendCount, setSendCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reconnectRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 2s
      reconnectRef.current = window.setTimeout(connect, 2000);
    };

    ws.onerror = () => ws.close();
  }, [wsUrl]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Keep input focused
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const tag = tagInput.trim();
    wsRef.current.send(JSON.stringify({ type: 'scan', tagId: tag }));
    setLastSent(prev => [tag, ...prev].slice(0, 10));
    setSendCount(prev => prev + 1);
    setTagInput('');

    // Vibrate if available (Android)
    if (navigator.vibrate) navigator.vibrate(100);
  };

  return (
    <div className="min-h-screen bg-[#0F1117] flex flex-col">
      {/* Status bar */}
      <div className={`h-1 ${connected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />

      <div className="flex-1 flex flex-col px-3 py-3">
        {/* Header */}
        <div className="text-center mb-3">
          <h1 className="text-lg font-semibold text-gray-100">RFID Scanner</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
            <span className={`text-xs font-medium uppercase tracking-wider ${connected ? 'text-green-400' : 'text-red-400'}`}>
              {connected ? 'Connected' : 'Reconnecting...'}
            </span>
          </div>
          {sendCount > 0 && (
            <p className="text-xs text-gray-600 font-mono mt-1">{sendCount} tags sent</p>
          )}
        </div>

        {/* Scan input — large for C72 */}
        <form onSubmit={handleSubmit} className="mb-3">
          <input
            ref={inputRef}
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder={connected ? 'Pull trigger to scan...' : 'Waiting for connection...'}
            disabled={!connected}
            className="w-full px-4 py-5 bg-[#1A1D27] border-2 border-[#2A2F3F] rounded-xl text-gray-100 placeholder-gray-600 focus:outline-none focus:border-green-500/50 font-mono text-lg text-center disabled:opacity-40"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {tagInput && (
            <button
              type="submit"
              className="w-full mt-2 py-4 bg-green-600 active:bg-green-500 text-white font-medium rounded-xl text-base"
            >
              Send Tag
            </button>
          )}
        </form>

        {/* Last scanned tags */}
        {lastSent.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <p className="text-[10px] font-medium uppercase tracking-widest text-gray-600 mb-1.5">Sent Tags</p>
            <div className="space-y-1">
              {lastSent.map((tag, i) => (
                <div
                  key={`${tag}-${i}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    i === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-[#1A1D27]'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${i === 0 ? 'bg-green-500' : 'bg-gray-700'}`} />
                  <span className={`font-mono text-xs truncate ${i === 0 ? 'text-green-400' : 'text-gray-500'}`}>
                    {tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions when empty */}
        {lastSent.length === 0 && connected && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 text-sm mb-1">Ready to scan</p>
              <p className="text-gray-600 text-xs">Pull trigger or type tag ID</p>
              <p className="text-gray-700 text-xs mt-3">Tags will appear on your Mac</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
