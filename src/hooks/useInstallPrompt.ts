import { useCallback, useEffect, useState } from 'react';

type Platform = 'macos' | 'windows' | 'ios' | 'android' | 'linux' | 'unknown';
type Browser = 'chrome' | 'edge' | 'safari' | 'firefox' | 'other';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallPromptState {
  canInstall: boolean;         // native beforeinstallprompt is available
  installed: boolean;          // running as installed PWA, or install succeeded this session
  platform: Platform;
  browser: Browser;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  instructions: string;        // platform-specific fallback copy
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Win/i.test(navigator.platform) || /Windows/i.test(ua)) return 'windows';
  if (/Mac/i.test(navigator.platform) || /Macintosh/i.test(ua)) return 'macos';
  if (/Linux/i.test(navigator.platform)) return 'linux';
  return 'unknown';
}

function detectBrowser(): Browser {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return 'edge';
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'chrome';
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'safari';
  if (/Firefox\//i.test(ua)) return 'firefox';
  return 'other';
}

function buildInstructions(platform: Platform, browser: Browser): string {
  if (platform === 'ios') {
    return 'Open in Safari, tap the Share icon, then "Add to Home Screen".';
  }
  if (platform === 'macos') {
    if (browser === 'safari') {
      return 'Safari on macOS: File menu → "Add to Dock…". Or open this page in Chrome/Edge for a one-click install.';
    }
    return 'Click your browser\'s address-bar install icon, or menu → "Install ScaleSync…".';
  }
  if (platform === 'windows') {
    if (browser === 'firefox') {
      return 'Firefox doesn\'t support installing web apps. Open this page in Chrome or Edge instead.';
    }
    return 'Click the address-bar install icon, or menu → "Install ScaleSync…" (Chrome/Edge).';
  }
  if (platform === 'android') {
    return 'Tap your browser menu, then "Install app" or "Add to Home screen".';
  }
  return 'Open the browser menu and choose "Install ScaleSync…" or "Create shortcut".';
}

export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS Safari
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  });
  const [platform] = useState<Platform>(() => detectPlatform());
  const [browser] = useState<Browser>(() => detectBrowser());

  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBefore);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice.outcome === 'accepted') setInstalled(true);
      return choice.outcome;
    } catch {
      return 'unavailable' as const;
    }
  }, [deferred]);

  return {
    canInstall: !!deferred,
    installed,
    platform,
    browser,
    install,
    instructions: buildInstructions(platform, browser),
  };
}
