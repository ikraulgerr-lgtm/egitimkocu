import React from 'react';
import { Capacitor } from '@capacitor/core';

export interface UpdateInfo {
  isAvailable: boolean;
  versionName: string;
  releaseNotes?: string;
  isMandatory?: boolean;
  storeUrl?: string;
}

interface UpdateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo;
}

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.egitimkocumai';
const PLAY_STORE_MARKET_URL = 'market://details?id=com.egitimkocumai';
const APP_STORE_URL = 'https://apps.apple.com/app/id6470000000'; // Fallback iOS Store link

export const UpdateAlertModal: React.FC<UpdateAlertModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
}) => {
  if (!isOpen || !updateInfo.isAvailable) return null;

  const handleOpenStore = () => {
    const platform = Capacitor.getPlatform();

    if (platform === 'android') {
      try {
        window.location.href = PLAY_STORE_MARKET_URL;
      } catch {
        window.open(PLAY_STORE_URL, '_system');
      }
    } else if (platform === 'ios') {
      window.open(updateInfo.storeUrl || APP_STORE_URL, '_system');
    } else {
      window.open(updateInfo.storeUrl || PLAY_STORE_URL, '_blank');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none font-sans"
    >
      <div className="bg-surface dark:bg-slate-900 border border-card-border/80 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative flex flex-col space-y-5 text-text-main overflow-hidden text-center">
        {/* Glow Background */}
        <div className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-gradient-to-br from-primary to-indigo-600 opacity-20 blur-3xl pointer-events-none" />

        {/* Icon & Version Badge */}
        <div className="flex flex-col items-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-primary to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-primary/30">
            <span className="material-symbols-outlined text-3xl animate-bounce">
              system_update
            </span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            Sürüm {updateInfo.versionName || '1.3.16'}
          </span>
        </div>

        {/* Heading & Subtext */}
        <div className="space-y-1.5">
          <h3 className="font-black text-lg sm:text-xl text-text-main tracking-tight">
            Yeni Güncelleme Yayınlandı! 🚀
          </h3>
          <p className="text-xs text-text-muted leading-relaxed">
            Eğitim Koçum AI'ın en güncel, hızlı ve optimize sürümü hazır. Yeni özelliklere ve performans iyileştirmelerine erişmek için uygulamanızı güncelleyin.
          </p>
        </div>

        {/* Highlights / Release Notes */}
        <div className="bg-surface-container-low dark:bg-slate-800/80 border border-card-border p-3.5 rounded-2xl text-left space-y-2">
          <span className="text-[11px] font-extrabold text-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">new_releases</span>
            <span>Bu Güncellemede Neler Var?</span>
          </span>
          <p className="text-xs text-text-muted dark:text-slate-300 leading-relaxed font-medium">
            {updateInfo.releaseNotes ||
              '• Hazır ve özel sınav kampları yönetimi (90 Günde TYT, 60 Günde AYT vb.)\n• Çevrimdışı bağlantı desteği ve yerel simge iyileştirmesi\n• Günlük çalışma temposu kontrolü\n• Hesap oturumunun güncellemelerde korunması'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleOpenStore}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-primary via-indigo-600 to-primary-hover text-white font-black text-xs sm:text-sm shadow-lg shadow-primary/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer hover:brightness-110"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Uygulamayı Şimdi Güncelle</span>
          </button>

          {!updateInfo.isMandatory && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl text-text-muted hover:text-text-main font-bold text-xs transition-colors cursor-pointer"
            >
              Daha Sonra Hatırlat
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
