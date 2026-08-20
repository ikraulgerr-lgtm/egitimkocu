import React from 'react';

interface PremiumVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgradeSuccess: () => void;
}

export const PremiumVideoModal: React.FC<PremiumVideoModalProps> = ({
  isOpen,
  onClose,
  onUpgradeSuccess,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-card-bg w-full max-w-3xl rounded-3xl overflow-y-auto md:overflow-hidden flex flex-col md:flex-row shadow-2xl border border-card-border max-h-[92vh]">
        {/* Left: EduMind PRO Highlight Card */}
        <div className="w-full md:flex-1 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 relative flex flex-col p-5 sm:p-8 justify-between text-white shrink-0">
          {/* Header */}
          <div className="flex justify-between items-center z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
              </div>
              <div>
                <p className="font-black text-sm text-white">EduMind AI PRO</p>
                <p className="text-[11px] text-indigo-200">Kişiselleştirilmiş Akıllı Sınav Rehberi</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-full bg-white/5 hover:bg-white/10 cursor-pointer transition-colors md:hidden"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Center Graphic / Hero text */}
          <div className="my-auto z-10 space-y-2.5 py-4 sm:py-6">
            <div className="inline-flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/30 text-amber-300 px-3 py-1 rounded-full text-xs font-bold">
              <span className="material-symbols-outlined text-sm">stars</span>
              <span>Sınırsız Yapay Zeka Desteği</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
              Sınav Hazırlığında Sınırları Kaldırın
            </h2>
            <p className="text-xs text-indigo-200 leading-relaxed max-w-sm font-medium">
              Fotoğrafını çektiğiniz tüm soruları anında analiz edin, adım adım çözümlerle eksiklerinizi hızla kapatın.
            </p>
          </div>

          {/* Bottom Feature Badge */}
          <div className="z-10 flex items-center gap-2 text-[11px] text-indigo-300 font-semibold border-t border-white/10 pt-3">
            <span className="material-symbols-outlined text-emerald-400 text-sm shrink-0">verified</span>
            <span>%100 Müfredat Uyumlu Akıllı Analiz Motoru</span>
          </div>
        </div>

        {/* Right: Paywall & Upgrade Plan List */}
        <div className="w-full md:w-96 bg-surface-container-low p-5 sm:p-6 flex flex-col justify-between space-y-5 md:overflow-y-auto">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="inline-block bg-gradient-to-r from-primary to-secondary px-3 py-1 rounded-full shadow-xs">
                <span className="text-white text-[10px] font-black uppercase tracking-wider">
                  Eğitim Koçum PRO
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="hidden md:flex text-slate-400 hover:text-text-main p-1.5 rounded-full hover:bg-card-border/40 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <h3 className="font-extrabold text-lg sm:text-xl text-text-main">Sınırsız İmkânlara Ulaşın</h3>

            <ul className="space-y-2.5">
              <li className="flex items-start gap-2.5 text-xs text-text-main font-bold bg-primary/10 p-2.5 rounded-xl border border-primary/20">
                <span className="material-symbols-outlined text-primary text-lg shrink-0">all_inclusive</span>
                <div>
                  <p className="font-black text-primary">Sınırsız Soru Analizi & Çözüm Hakkı</p>
                  <p className="text-[11px] text-text-muted font-normal">Günlük soru limiti yok, istediğin kadar soru sor.</p>
                </div>
              </li>
              <li className="flex items-start gap-2 text-xs text-text-main font-semibold">
                <span className="material-symbols-outlined text-primary text-base shrink-0">check_circle</span>
                <span>Adım Adım Detaylı Yapay Zeka Çözümleri</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-text-main font-semibold">
                <span className="material-symbols-outlined text-primary text-base shrink-0">check_circle</span>
                <span>Sokratik İpucu & Yol Gösterici Rehberlik</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-text-main font-semibold">
                <span className="material-symbols-outlined text-primary text-base shrink-0">check_circle</span>
                <span>Kişiselleştirilmiş Akıllı Ders Çalışma Programı</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-text-main font-semibold">
                <span className="material-symbols-outlined text-primary text-base shrink-0">check_circle</span>
                <span>Detaylı Haftalık Gelişim & Analiz Raporu</span>
              </li>
              <li className="flex items-start gap-2 text-xs text-text-main font-semibold">
                <span className="material-symbols-outlined text-primary text-base shrink-0">check_circle</span>
                <span>Reklamsız & Öncelikli Yanıt Hızı</span>
              </li>
            </ul>
          </div>

          <div className="pt-3 border-t border-card-border space-y-2.5">
            <div className="text-center">
              <span className="text-2xl font-black text-text-main">49,90 TL</span>
              <span className="text-xs text-text-muted font-medium"> /aylık</span>
            </div>

            <button
              type="button"
              onClick={() => {
                onUpgradeSuccess();
                onClose();
              }}
              className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer text-center"
            >
              Sınırsız PRO'ya Geç
            </button>

            <p className="text-center text-[10px] text-text-muted">
              İstediğin zaman tek tıkla aboneliğini iptal edebilirsin.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
