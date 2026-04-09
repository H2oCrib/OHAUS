interface ScaleConnectionProps {
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onDemoMode: () => void;
  error: string | null;
}

export function ScaleConnection({ connected, onConnect, onDisconnect, onDemoMode, error }: ScaleConnectionProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-10">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-gray-500 mb-3">Weight Verification System</p>
        <h1 className="text-5xl font-light text-gray-50 mb-2 tracking-tight">OHAUS Valor 7000</h1>
        <p className="text-sm text-gray-500">Cannabis Facility Weight Verification</p>
      </div>

      {!connected ? (
        <div className="flex flex-col items-center gap-5">
          <button
            onClick={onConnect}
            className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white text-lg font-medium rounded-lg transition-colors border border-cyan-500/30"
          >
            Connect Scale
          </button>
          <p className="text-gray-600 text-xs uppercase tracking-widest">
            USB &middot; RS-232 &middot; 9600 Baud
          </p>
          <div className="w-px h-8 bg-base-700" />
          <button
            onClick={onDemoMode}
            className="px-6 py-2.5 bg-base-800 hover:bg-base-700 text-gray-400 hover:text-gray-300 rounded-lg transition-colors text-sm border border-base-700"
          >
            Demo Mode
          </button>
          {!('serial' in navigator) && (
            <p className="text-red-400/80 text-xs mt-2 bg-red-500/10 px-4 py-2 rounded border border-red-500/20">
              Web Serial API not supported — use Chrome or Edge
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-cyan-400">
            <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium uppercase tracking-wider">Connected</span>
          </div>
          <button
            onClick={onDisconnect}
            className="px-4 py-2 bg-base-800 hover:bg-base-700 text-gray-500 rounded-lg transition-colors text-sm border border-base-700"
          >
            Disconnect
          </button>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded border border-red-500/20">{error}</p>
      )}
    </div>
  );
}
