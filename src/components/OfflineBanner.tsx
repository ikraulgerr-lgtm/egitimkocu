import React, { useState, useEffect } from 'react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-[100] w-full bg-gradient-to-r from-amber-600 via-rose-600 to-amber-700 text-white px-4 py-2.5 shadow-lg border-b border-white/20 backdrop-blur-md animate-fadeIn"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold min-w-0">
          <span className="material-symbols-outlined text-lg shrink-0 animate-pulse text-amber-200">
            wifi_off
          </span>
          <span className="truncate">
            İnternet bağlantınız yok. Çevrimdışı moddasınız.
          </span>
        </div>
        <span className="text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded-full shrink-0 border border-white/20">
          Kayıtlı veriler aktif
        </span>
      </div>
    </div>
  );
};
