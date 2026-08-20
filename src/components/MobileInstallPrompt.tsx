import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const MobileInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineToast, setShowOfflineToast] = useState(false);

  useEffect(() => {
    // Check if running as PWA standalone
    const standaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(iosDevice);

    // Listen for beforeinstallprompt (Android / Desktop Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Online / Offline listeners
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineToast(true);
      setTimeout(() => setShowOfflineToast(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineToast(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowModal(false);
      }
    } else {
      setShowModal(true);
    }
  };

  if (isStandalone) {
    return (
      <>
        {showOfflineToast && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 border border-slate-700 animate-bounce">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-500 animate-ping'}`} />
            <span>{isOnline ? 'İnternet Bağlantısı Yeniden Sağlandı' : 'İnternet Bağlantısı Kesildi - Çevrimdışı Mod'}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Offline Banner Toast */}
      {showOfflineToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-500 animate-ping'}`} />
          <span>{isOnline ? 'İnternet Bağlantısı Yeniden Sağlandı' : 'İnternet Bağlantısı Kesildi - Çevrimdışı Mod'}</span>
        </div>
      )}

      {/* Floating Mobile App Installation Banner */}
      <div className="fixed bottom-20 left-3 right-3 z-40 max-w-lg mx-auto bg-slate-900/95 text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-indigo-500/30 backdrop-blur-md flex items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-inner">
            <span className="material-symbols-outlined text-2xl">smartphone</span>
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-extrabold text-white truncate flex items-center gap-1">
              Eğitim Koçum AI Mobil
            </h4>
            <p className="text-[10px] sm:text-[11px] text-slate-300 truncate">
              Cihazına tam mobil uygulama olarak yükle
            </p>
          </div>
        </div>

        <button
          onClick={handleInstallClick}
          className="bg-indigo-500 hover:bg-indigo-400 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shrink-0 cursor-pointer shadow-md flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-base">download</span>
          <span>Yükle</span>
        </button>
      </div>

      {/* iOS & General PWA Installation Instructions Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-surface dark:bg-slate-900 border border-card-border/60 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl text-text-main relative animate-slide-up">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container-low dark:bg-slate-800 flex items-center justify-center text-text-muted hover:text-text-main cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
                <span className="material-symbols-outlined text-3xl">phone_iphone</span>
              </div>
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-text-main">
                  Uygulamayı Ana Ekrana Ekle
                </h3>
                <p className="text-xs text-text-muted">
                  Tam ekran mobil uygulama deneyimi için
                </p>
              </div>
            </div>

            {isIos ? (
              <div className="space-y-3 bg-surface-container-low dark:bg-slate-800/60 p-4 rounded-2xl border border-card-border/40 text-xs">
                <div className="flex items-start gap-2.5">
                  <span className="bg-indigo-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p>
                    Safari tarayıcısının alt menüsündeki <strong className="text-indigo-500">Paylaş (Share)</strong> simgesine dokunun.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="bg-indigo-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <p>
                    Açılan menüde aşağı kaydırarak <strong className="text-indigo-500">&apos;Ana Ekrana Ekle&apos; (Add to Home Screen)</strong> seçeneğini bulun.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="bg-indigo-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p>
                    Sağ üstteki <strong className="text-indigo-500">Ekle</strong> butonuna basarak mobil uygulamanızı telefonunuza kaydedin.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-surface-container-low dark:bg-slate-800/60 p-4 rounded-2xl border border-card-border/40 text-xs">
                <p>
                  Tarayıcınızın sağ üstündeki üç nokta (⋮) veya kilit simgesine tıklayıp <strong>&apos;Uygulamayı Yükle&apos;</strong> veya <strong>&apos;Ana Ekrana Ekle&apos;</strong> butonunu seçebilirsiniz.
                </p>
              </div>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-lg active:scale-98 transition-all cursor-pointer"
            >
              Anladım, Kapat
            </button>
          </div>
        </div>
      )}
    </>
  );
};
