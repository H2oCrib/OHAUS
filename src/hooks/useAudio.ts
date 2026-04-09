import { useCallback, useRef } from 'react';

const audioCtxRef = { current: null as AudioContext | null };

function getCtx() {
  if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
  return audioCtxRef.current;
}

function playTone(freq: number, duration: number, volume = 0.15) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

export function useAudio() {
  const lastPlayRef = useRef(0);

  const playCapture = useCallback(() => {
    const now = Date.now();
    if (now - lastPlayRef.current < 200) return;
    lastPlayRef.current = now;
    playTone(880, 0.12);
  }, []);

  const playComplete = useCallback(() => {
    playTone(660, 0.15);
    setTimeout(() => playTone(880, 0.15), 150);
    setTimeout(() => playTone(1100, 0.2), 300);
  }, []);

  const playError = useCallback(() => {
    playTone(330, 0.2);
  }, []);

  return { playCapture, playComplete, playError };
}
