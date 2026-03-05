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

    // Capture the install prompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Show install banner after a short delay
      setTimeout(() => {
        if (!isInStandaloneMode) {
          setShowInstallBanner(true);
        }
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Track successful install
    window.addEventListener('appinstalled', () => {
      setShowInstallBanner(false);
      setInstallPrompt(null);
      console.log('[PWA] App installed successfully');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
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
  
  return (
    <div className="pwa-install-banner">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          <img src="/icons/icon-96x96.png" alt="Netrik XR" width={40} height={40} />
        </div>
        <div className="pwa-install-text">
          <strong>Install Netrik XR</strong>
          {isIOS ? (
            <p>Tap <span style={{ fontSize: '16px' }}>⎙</span> Share then &quot;Add to Home Screen&quot;</p>
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
