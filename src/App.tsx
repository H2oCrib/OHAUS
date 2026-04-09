import { useState, useCallback, useRef, useEffect } from 'react';
import { useScale } from './hooks/useScale';
import { ScaleConnection } from './components/ScaleConnection';
import { SessionSetup } from './components/SessionSetup';
import { WeighingStation } from './components/WeighingStation';
import { VerificationSummary } from './components/VerificationSummary';
import { exportExcel } from './lib/export';
import type { AppPhase, ScaleReading, StrainConfig, StrainSession, WeightReading } from './lib/types';

function App() {
  const scale = useScale();
  const [phase, setPhase] = useState<AppPhase>('connect');
  const [strainConfigs, setStrainConfigs] = useState<StrainConfig[]>([]);
  const [sessions, setSessions] = useState<StrainSession[]>([]);
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [demoReading, setDemoReading] = useState<ScaleReading | null>(null);
  const demoIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (demoMode && phase === 'weighing') {
      demoIntervalRef.current = window.setInterval(() => {
        const base = 400 + Math.random() * 100;
        setDemoReading({
          weight: Math.round(base * 10) / 10,
          unit: 'g',
          stable: Math.random() > 0.3,
          mode: 'G',
        });
      }, 500);
      return () => { if (demoIntervalRef.current) clearInterval(demoIntervalRef.current); };
    }
  }, [demoMode, phase]);

  const handleDemoMode = () => {
    setDemoMode(true);
    setPhase('setup');
  };

  const handleConnect = async () => {
    await scale.connect();
    setPhase('setup');
  };

  const handleDisconnect = async () => {
    await scale.disconnect();
    setDemoMode(false);
    setPhase('connect');
  };

  const handleAddStrain = (config: StrainConfig) => {
    setStrainConfigs(prev => [...prev, config]);
  };

  const handleStartWeighing = async () => {
    const newSessions: StrainSession[] = strainConfigs.map(config => ({
      config,
      readings: [],
      completed: false,
    }));
    setSessions(newSessions);
    setActiveSessionIndex(0);
    setPhase('weighing');
    await scale.startContinuous();
  };

  const handleRecordWeight = useCallback((reading: WeightReading) => {
    setSessions(prev => {
      const updated = [...prev];
      updated[activeSessionIndex] = {
        ...updated[activeSessionIndex],
        readings: [...updated[activeSessionIndex].readings, reading],
      };
      return updated;
    });
  }, [activeSessionIndex]);

  const handleUpdateReadings = useCallback((readings: WeightReading[]) => {
    setSessions(prev => {
      const updated = [...prev];
      updated[activeSessionIndex] = {
        ...updated[activeSessionIndex],
        readings,
      };
      return updated;
    });
  }, [activeSessionIndex]);

  const handleFinishStrain = async () => {
    setSessions(prev => {
      const updated = [...prev];
      updated[activeSessionIndex] = {
        ...updated[activeSessionIndex],
        completed: true,
      };
      return updated;
    });

    if (activeSessionIndex < sessions.length - 1) {
      setActiveSessionIndex(prev => prev + 1);
    } else {
      await scale.stopContinuous();
      setPhase('summary');
    }
  };

  const handleExport = () => {
    exportExcel(sessions);
  };

  const handleNewSession = () => {
    setStrainConfigs([]);
    setSessions([]);
    setActiveSessionIndex(0);
    setPhase('setup');
  };

  const activeSession = sessions[activeSessionIndex];
  const isConnected = scale.connected || demoMode;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Connection Status Strip */}
      <div className={`h-0.5 transition-colors duration-500 ${
        !isConnected ? 'bg-base-700' :
        demoMode ? 'bg-amber-500' : 'bg-cyan-500'
      }`} />

      {/* Header */}
      <header className="bg-base-900 border-b border-base-700 px-5 py-2.5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-gray-200 tracking-wide">WEIGHT VERIFICATION</h1>
          <span className="text-[10px] font-mono bg-base-800 text-gray-500 px-2 py-0.5 rounded border border-base-700">
            VALOR 7000
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isConnected && (
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${demoMode ? 'bg-amber-400' : 'bg-cyan-400'}`} />
              <span className={`text-xs font-medium uppercase tracking-wider ${demoMode ? 'text-amber-400' : 'text-cyan-400'}`}>
                {demoMode ? 'Demo' : 'Live'}
              </span>
            </div>
          )}
          {phase === 'weighing' && activeSession && sessions.length > 1 && (
            <span className="text-xs font-mono text-gray-500">
              {activeSessionIndex + 1}/{sessions.length}
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {phase === 'connect' && (
          <ScaleConnection
            connected={scale.connected}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onDemoMode={handleDemoMode}
            error={scale.error}
          />
        )}

        {phase === 'setup' && (
          <SessionSetup
            onAddStrain={handleAddStrain}
            onStartWeighing={handleStartWeighing}
            strains={strainConfigs}
          />
        )}

        {phase === 'weighing' && activeSession && (
          <WeighingStation
            session={activeSession}
            currentReading={demoMode ? demoReading : scale.currentReading}
            onRecordWeight={handleRecordWeight}
            onUpdateReadings={handleUpdateReadings}
            onFinishStrain={handleFinishStrain}
            onTare={demoMode ? async () => {} : scale.tare}
            onZero={demoMode ? async () => {} : scale.zero}
            onStartContinuous={demoMode ? async () => {} : scale.startContinuous}
            onStopContinuous={demoMode ? async () => {} : scale.stopContinuous}
          />
        )}

        {phase === 'summary' && (
          <VerificationSummary
            sessions={sessions}
            onExport={handleExport}
            onNewSession={handleNewSession}

          />
        )}
      </main>
    </div>
  );
}

export default App;
