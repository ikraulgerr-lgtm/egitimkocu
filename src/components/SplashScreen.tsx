import React from 'react';

interface SplashScreenProps {
  theme?: 'light' | 'dark';
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ theme = 'dark' }) => {
  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 select-none transition-opacity duration-500 ${
        theme === 'dark'
          ? 'bg-slate-950 text-white'
          : 'bg-gradient-to-b from-indigo-50 via-white to-slate-100 text-slate-900'
      }`}
    >
      {/* Glow Effects */}
      <div className="absolute w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute w-60 h-60 bg-purple-500/15 rounded-full blur-2xl animate-pulse delay-300" />

      {/* Main Content Card */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-6 animate-scaleIn">
        {/* App Logo Badge */}
        <div className="relative group">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 p-0.5 shadow-2xl shadow-indigo-500/30 animate-bounce">
            <div className="w-full h-full bg-slate-950/40 backdrop-blur-md rounded-[22px] flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-white drop-shadow-md">
                auto_awesome
              </span>
            </div>
          </div>
          {/* Subtle Outer Ring */}
          <div className="absolute -inset-1 rounded-3xl border border-indigo-400/30 animate-ping pointer-events-none opacity-40" />
        </div>

        {/* Brand Name & Tagline */}
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            Eğitim Koçum AI
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-400">
            Yapay Zeka Destekli Kişisel Öğrenci Koçunuz
          </p>
        </div>

        {/* Loading Bar & Spinner */}
        <div className="pt-6 flex flex-col items-center space-y-3">
          <div className="w-36 h-1.5 bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full animate-loadingBar" />
          </div>
          <span className="text-[11px] font-semibold text-slate-400 tracking-wider uppercase animate-pulse">
            Başlatılıyor...
          </span>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Geleceğin Sınav Hazırlığı
        </p>
      </div>
    </div>
  );
};
