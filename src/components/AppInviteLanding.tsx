import React, { useEffect, useState } from 'react';

interface AppInviteLandingProps {
  inviteId: string;
  inviteName?: string;
  inviteUsername?: string;
  inviteAvatar?: string;
  inviteXp?: number;
  onContinueWeb: () => void;
}

export const AppInviteLanding: React.FC<AppInviteLandingProps> = ({
  inviteId,
  inviteName = 'Bir Öğrenci',
  inviteUsername = 'ogrenci',
  inviteAvatar,
  inviteXp = 100,
  onContinueWeb,
}) => {
  const [copied, setCopied] = useState(false);
  const [autoRedirectAttempted, setAutoRedirectAttempted] = useState(false);

  // App URLs & deep links
  const appSchemeUrl = `egitimkocum://invite?invite=${inviteId}&name=${encodeURIComponent(inviteName)}&username=${encodeURIComponent(inviteUsername)}&avatar=${encodeURIComponent(inviteAvatar || '')}&xp=${inviteXp}`;
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=com.egitimkocumai';
  const appStoreUrl = 'https://apps.apple.com/app/egitim-kocum-ai/id6744883198';

  const defaultAvatar = 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1';
  const avatarToDisplay = inviteAvatar || defaultAvatar;

  // Auto-attempt opening the installed app on mobile devices
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && !autoRedirectAttempted) {
      setAutoRedirectAttempted(true);
      const timer = setTimeout(() => {
        try {
          window.location.href = appSchemeUrl;
        } catch {
          // Ignore
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [appSchemeUrl, autoRedirectAttempted]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(`@${inviteUsername}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenApp = () => {
    window.location.href = appSchemeUrl;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto animate-fadeIn select-none">
      <div className="w-full max-w-md bg-card-bg border border-card-border rounded-3xl p-6 shadow-2xl space-y-5 text-center relative overflow-hidden">
        
        {/* Glow decoration */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 flex items-center justify-center text-white shadow-md shadow-primary/25">
            <span className="material-symbols-outlined text-2xl font-bold">school</span>
          </div>
          <div className="text-left">
            <h1 className="font-black text-sm text-text-main tracking-tight leading-none">EĞİTİM KOÇUM AI</h1>
            <p className="text-[10px] text-primary font-bold">Yapay Zeka Destekli Ders Asistanı</p>
          </div>
        </div>

        {/* Inviter Badge */}
        <div className="bg-surface-container-low border border-card-border rounded-3xl p-4 flex flex-col items-center gap-2.5 relative">
          <div className="relative">
            <img
              src={avatarToDisplay}
              alt={inviteName}
              className="w-20 h-20 rounded-full border-4 border-primary/30 object-cover shadow-lg bg-card-bg"
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-card-bg flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-sm font-black">person_add</span>
            </div>
          </div>

          <div>
            <p className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Seni Arkadaş Olarak Davet Etti</p>
            <h2 className="text-lg font-black text-text-main">{inviteName}</h2>
            <p className="text-xs font-bold text-primary font-mono">@{inviteUsername}</p>
          </div>

          {/* XP Reward badge */}
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black">
            <span className="material-symbols-outlined text-sm">workspace_premium</span>
            <span>Katıldığında İkiniz de +50 XP Kazanırsınız!</span>
          </div>
        </div>

        {/* Primary CTA: Open in Mobile App */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleOpenApp}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-primary/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">open_in_new</span>
            <span>Uygulamada Aç (Yüklüyse)</span>
          </button>

          {/* Store Download Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={appStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 px-3 bg-surface-container-low hover:bg-card-border border border-card-border rounded-2xl text-text-main font-extrabold text-xs transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg text-primary">phone_iphone</span>
              <div className="text-left leading-tight">
                <span className="block text-[9px] text-text-muted font-medium">Apple iOS</span>
                <span>App Store</span>
              </div>
            </a>

            <a
              href={playStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 px-3 bg-surface-container-low hover:bg-card-border border border-card-border rounded-2xl text-text-main font-extrabold text-xs transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg text-emerald-500">android</span>
              <div className="text-left leading-tight">
                <span className="block text-[9px] text-text-muted font-medium">Android</span>
                <span>Google Play</span>
              </div>
            </a>
          </div>
        </div>

        {/* Copy Friend Code Card */}
        <div className="bg-surface-container-low/70 border border-card-border rounded-2xl p-3 flex items-center justify-between gap-2">
          <div className="text-left min-w-0">
            <p className="text-[10px] text-text-muted font-bold uppercase">Arkadaşlık Davet Kodu</p>
            <p className="text-xs font-black text-text-main font-mono truncate">@{inviteUsername}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
            <span>{copied ? 'Kopyalandı' : 'Kodu Kopyala'}</span>
          </button>
        </div>

        {/* Continue in Web Option */}
        <button
          type="button"
          onClick={onContinueWeb}
          className="text-xs font-extrabold text-text-muted hover:text-text-main transition-colors py-1 cursor-pointer underline decoration-text-muted/40 hover:decoration-text-main"
        >
          Tarayıcıda / Web Sürümünde Devam Et →
        </button>

      </div>
    </div>
  );
};