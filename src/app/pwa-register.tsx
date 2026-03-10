'use client';

import { useEffect, useState } from 'react';

export default function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already running as installed app
    const isInStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    
    setIsStandalone(isInStandaloneMode);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration.scope);
          
          // Check for updates periodically (every 60s)
          setInterval(() => {
            registration.update();
          }, 60000);

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  console.log('[PWA] New service worker activated');
                }
              });
            }
          });
        })
        .catch((err) => {
          console.error('[PWA] Service Worker registration failed:', err);
        });
    }

    // Handle app visibility changes (important for PWA returning from background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[PWA] App returned to foreground');
        // The Supabase realtime channels will auto-reconnect,
        // but we can dispatch a custom event for components to refresh
        window.dispatchEvent(new CustomEvent('pwa-resume'));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle online/offline events
    const handleOnline = () => {
      console.log('[PWA] Back online');
      window.dispatchEvent(new CustomEvent('pwa-online'));
    };
    const handleOffline = () => {
      console.log('[PWA] Gone offline');
      window.dispatchEvent(new CustomEvent('pwa-offline'));
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Capture the install prompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Expose globally so the chatbot can trigger install
      (window as any).__pwaInstallPrompt = e;
      window.dispatchEvent(new CustomEvent('pwa-install-available'));
      // Show install banner after a short delay (fallback for non-order pages)
      setTimeout(() => {
        if (!isInStandaloneMode) {
          setShowInstallBanner(true);
        }
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Expose global install function for chatbot
    (window as any).__pwaDoInstall = async () => {
      const prompt = (window as any).__pwaInstallPrompt;
      if (!prompt) return false;
      prompt.prompt();
      const result = await prompt.userChoice;
      return result.outcome === 'accepted';
    };

    // Track successful install - aggressively redirect to open in standalone PWA
    const handleAppInstalled = () => {
      setShowInstallBanner(false);
      setInstallPrompt(null);
      (window as any).__pwaInstallPrompt = null;
      console.log('[PWA] App installed successfully');
      
      // Detect which app was installed based on current page
      const isAdminPage = window.location.pathname.startsWith('/admin');
      
      let targetUrl: string;
      if (isAdminPage) {
        targetUrl = `${window.location.origin}/admin`;
      } else {
        // Read table from cookie (most reliable cross-context)
        const cookieMatch = document.cookie.match(/(?:^|;\s*)netrikxr-table=([^;]*)/);
        const table = cookieMatch ? decodeURIComponent(cookieMatch[1]) : (localStorage.getItem('netrikxr-table') || '1');
        targetUrl = `${window.location.origin}/order?table=${table}`;
      }
      
      // Dispatch event so chatbot/admin can show message
      window.dispatchEvent(new CustomEvent('pwa-installed', { detail: { targetUrl, isAdmin: isAdminPage } }));
      
      // Strategy: Multiple attempts to open in standalone PWA
      // 1) Short delay for install animation, then try window.open (triggers link capturing on Android)
      setTimeout(() => {
        // Try opening a new window — on Android Chrome with an installed PWA,
        // this opens in the standalone app instead of Chrome
        const opened = window.open(targetUrl, '_blank');
        
        // 2) Fallback: force full-page redirect after another delay
        // On newer Chrome, navigating within PWA scope triggers "open in app"
        setTimeout(() => {
          if (!opened || opened.closed) {
            window.location.replace(targetUrl);
          }
        }, 1500);
      }, 500);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    
    if (result.outcome === 'accepted') {
      console.log('[PWA] User accepted install');
    }
    setInstallPrompt(null);
    setShowInstallBanner(false);
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    // Don't show again for this session
    sessionStorage.setItem('pwa-banner-dismissed', 'true');
  };

  // Don't show banner if already standalone or dismissed
  if (isStandalone || !showInstallBanner) return null;
  if (typeof window !== 'undefined' && sessionStorage.getItem('pwa-banner-dismissed')) return null;

  // Check if iOS (show different message since iOS doesn't support beforeinstallprompt)
  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAdminPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  const appName = isAdminPage ? 'Coasis Admin' : 'Coasis';
  
  return (
    <div className="pwa-install-banner">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          <img src="/icons/icon-96x96.png" alt={appName} width={40} height={40} />
        </div>
        <div className="pwa-install-text">
          <strong>Install {appName}</strong>
          {isIOS ? (
            <p>Tap <span style={{ fontSize: '18px' }}>⬆</span> Share then <strong>&quot;Add to Home Screen&quot;</strong></p>
          ) : (
            <p>Get the full app experience</p>
          )}
        </div>
        <div className="pwa-install-actions">
          {!isIOS && (
            <button className="pwa-install-btn" onClick={handleInstall}>
              Install
            </button>
          )}
          <button className="pwa-dismiss-btn" onClick={dismissBanner}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
