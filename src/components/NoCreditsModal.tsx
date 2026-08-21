import React, { useState } from 'react';

import { showRewardedAd } from '../lib/admobService';

interface NoCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWatchAdSuccess: (earnedCredits?: number) => void;
  onOpenProModal?: () => void;
  userKredi?: number;
  userMaxKredi?: number;
}

export const NoCreditsModal: React.FC<NoCreditsModalProps> = ({
  isOpen,
  onClose,
  onWatchAdSuccess,
  onOpenProModal,
  userKredi = 0,
  userMaxKredi = 10,
}) => {
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adProgress, setAdProgress] = useState(0);

  if (!isOpen) return null;

  const handleStartWatchAd = async () => {
    setIsWatchingAd(true);
    setAdProgress(10);

    const progressTimer = setInterval(() => {
      setAdProgress((prev) => (prev >= 85 ? 85 : prev + 15));
    }, 350);

    try {
      await showRewardedAd(
        (earnedAmount) => {
          clearInterval(progressTimer);
          setAdProgress(100);
          setTimeout(() => {
            setIsWatchingAd(false);
            onWatchAdSuccess(earnedAmount || 1);
            onClose();
          }, 300);
        },
        () => {
          clearInterval(progressTimer);
          setIsWatchingAd(false);
        }
      );
    } catch (err) {
      clearInterval(progressTimer);
      setIsWatchingAd(false);
      onWatchAdSuccess(1);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-card-bg w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border border-card-border relative overflow-hidden text-center space-y-5">
        {/* Background Subtle Gradient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isWatchingAd}
          className="absolute top-4 right-4 text-text-muted hover:text-text-main p-1.5 rounded-full hover:bg-card-border/40 transition-colors cursor-pointer disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* Icon & Badge */}
        <div className="pt-2">
          <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto shadow-sm mb-3 ${
            userKredi >= userMaxKredi
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
              : userKredi > 0
              ? 'bg-primary/15 border-primary/30 text-primary'
              : 'bg-rose-500/15 border-rose-500/30 text-rose-500 animate-pulse'
          }`}>
            <span className="material-symbols-outlined text-3xl">
              {userKredi >= userMaxKredi ? 'battery_full' : userKredi > 0 ? 'battery_4_bar' : 'confirmation_number'}
            </span>
          </div>
          <span className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border inline-block ${
            userKredi >= userMaxKredi
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : userKredi > 0
              ? 'text-primary bg-primary/10 border-primary/20'
              : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
          }`}>
            {userKredi >= userMaxKredi
              ? 'Soru Hakların Dolu'
              : userKredi > 0
              ? 'Soru Hakkı Bakiyesi'
              : 'Soru Hakları Tükendi'}
          </span>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-text-main tracking-tight">
            {userKredi >= userMaxKredi
              ? 'Soru hakkın dolu!'
              : userKredi > 0
              ? 'Ekstra soru hakkı kazan'
              : 'Soru hakkın bitti'}
          </h2>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
            {userKredi >= userMaxKredi ? (
              <>Soru hakkın maksimum seviyede (<strong className="text-text-main">{userKredi}/{userMaxKredi}</strong>). Soru çözüp hakların azaldıkça reklam izleyerek veya yenilenme zamanlarında tekrar hak kazanabilirsin.</>
            ) : userKredi > 0 ? (
              <>Mevcut soru hakkın <strong className="text-text-main">{userKredi}/{userMaxKredi}</strong> seviyesinde. Reklam izleyerek soru hakkını artırabilirsin.</>
            ) : (
              <>Günlük ücretsiz soru çözme ve pedagojik analiz hakkın <strong className="text-text-main">{userKredi}/{userMaxKredi}</strong> seviyesinde. Soru sormaya devam etmek için reklam izleyerek anında hak kazanabilirsin.</>
            )}
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-surface-container-low p-4 rounded-2xl border border-card-border space-y-2 text-left">
          <div className="flex justify-between items-center text-xs font-bold text-text-main">
            <span className="flex items-center gap-1.5">
              <span className={`material-symbols-outlined text-sm ${
                userKredi >= userMaxKredi ? 'text-emerald-500' : userKredi > 0 ? 'text-primary' : 'text-rose-500'
              }`}>
                {userKredi >= userMaxKredi ? 'battery_full' : 'battery_charging_full'}
              </span>
              <span>Kalan Soru Hakkı</span>
            </span>
            <span className={`font-extrabold ${
              userKredi >= userMaxKredi ? 'text-emerald-500' : userKredi > 0 ? 'text-primary' : 'text-rose-500'
            }`}>
              {userKredi} / {userMaxKredi}
            </span>
          </div>
          <div className="w-full bg-card-border/50 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                userKredi >= userMaxKredi ? 'bg-emerald-500' : userKredi > 0 ? 'bg-primary' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, (userKredi / userMaxKredi) * 100))}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        {isWatchingAd ? (
          <div className="bg-primary/10 border border-primary/20 p-5 rounded-2xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-center gap-2 text-primary font-black text-sm">
              <span className="material-symbols-outlined text-lg animate-spin">sync</span>
              <span>Reklam İzleniyor... (%{adProgress})</span>
            </div>
            <div className="w-full bg-primary/20 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 ease-out"
                style={{ width: `${adProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-text-muted">
              Reklam tamamlandığında +1 Soru Hakkı bakiyene eklenecektir.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            {userKredi >= userMaxKredi ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-bold text-amber-600 dark:text-amber-400">
                Soru hakkınız maksimum seviyededir ({userKredi}/{userMaxKredi}). Soru çözdükçe azalan haklarınızı reklam izleyerek yenileyebilirsiniz.
              </div>
            ) : (
              <button
                onClick={handleStartWatchAd}
                className="w-full bg-primary hover:brightness-110 active:scale-[0.98] text-white font-black text-sm py-3.5 px-4 rounded-2xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">play_circle</span>
                <span>Reklam izleyerek soru hakkı kazan</span>
              </button>
            )}

            {onOpenProModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenProModal();
                }}
                className="w-full bg-surface-container-low hover:bg-card-border/40 text-text-main font-bold text-xs py-3 px-4 rounded-xl border border-card-border transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-amber-500 text-sm">workspace_premium</span>
                <span>PRO'ya Geç (Sınırsız Soru Hakkı)</span>
              </button>
            )}
          </div>
        )}

        {/* Footer Note */}
        <p className="text-[10px] text-text-muted pt-1">
          Reklam izleyerek kazandığın haklar anında hesabına tanımlanır.
        </p>
      </div>
    </div>
  );
};
