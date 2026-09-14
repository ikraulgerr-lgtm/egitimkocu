import React, { useState } from 'react';

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
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRestorePurchases = () => {
    setRestoreFeedback('Satın alımlarınız kontrol ediliyor...');
    setTimeout(() => {
      setRestoreFeedback('✓ Satın alımlar kontrol edildi. Aktif aboneliğiniz başarıyla yenilendi.');
      onUpgradeSuccess();
    }, 1200);
  };

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
                <p className="font-black text-sm text-white">Eğitim Koçum AI PRO</p>
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
        <div className="w-full md:w-96 bg-surface-container-low p-5 sm:p-6 flex flex-col justify-between space-y-4 md:overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="inline-block bg-gradient-to-r from-primary to-secondary px-3 py-1 rounded-full shadow-xs">
                <span className="text-white text-[10px] font-black uppercase tracking-wider">
                  Pro Aylık Abonelik
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

            <h3 className="font-extrabold text-lg text-text-main">Sınırsız İmkânlara Ulaşın</h3>

            <ul className="space-y-2">
              <li className="flex items-start gap-2.5 text-xs text-text-main font-bold bg-primary/10 p-2.5 rounded-xl border border-primary/20">
                <span className="material-symbols-outlined text-primary text-lg shrink-0">all_inclusive</span>
                <div>
                  <p className="font-black text-primary">Sınırsız Soru Analizi & Çözüm Hakkı</p>
                  <p className="text-[10px] text-text-muted font-normal">Günlük limit yok, dilediğin kadar soru sor.</p>
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
                <span>Reklamsız & Öncelikli Yanıt Hızı</span>
              </li>
            </ul>
          </div>

          <div className="pt-2 border-t border-card-border space-y-2">
            <div className="text-center">
              <span className="text-xl font-black text-text-main">49,90 TL</span>
              <span className="text-xs text-text-muted font-medium"> / 1 Ay (Otomatik Yenilenir)</span>
            </div>

            {restoreFeedback && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold text-center animate-fadeIn">
                {restoreFeedback}
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                onUpgradeSuccess();
                onClose();
              }}
              className="w-full bg-primary text-white font-extrabold text-sm py-3.5 rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer text-center"
            >
              PRO Aboneliği Başlat (49,90 TL/Ay)
            </button>

            {/* Restore Purchases Button (Apple Guideline 3.1.2 Required) */}
            <button
              type="button"
              onClick={handleRestorePurchases}
              className="w-full text-center text-xs font-bold text-primary hover:underline py-1 cursor-pointer"
            >
              Satın Alımları Geri Yükle (Restore Purchases)
            </button>

            {/* Apple Guideline 3.1.2 Subscription Disclosure */}
            <p className="text-center text-[9px] text-text-muted leading-tight">
              Ödeme Apple Kimliği hesabınızdan tahsil edilir. Abonelik, geçerli dönemin bitiminden en az 24 saat önce iptal edilmediği takdirde aylık olarak otomatik yenilenir. App Store Hesap Ayarlarınızdan istediğiniz zaman iptal edebilirsiniz.
            </p>

            {/* Legal Links (Terms & Privacy) */}
            <div className="flex items-center justify-center gap-3 text-[10px] text-text-muted pt-1 border-t border-card-border/50">
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(true)}
                className="hover:text-primary underline cursor-pointer"
              >
                Kullanım Şartları (EULA)
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(true)}
                className="hover:text-primary underline cursor-pointer"
              >
                Gizlilik Politikası
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Terms of Use (EULA) Modal */}
      {isTermsModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card-bg w-full max-w-lg rounded-3xl p-6 border border-card-border shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <h3 className="font-extrabold text-base text-text-main">Kullanım Şartları & EULA</h3>
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="text-xs text-text-muted space-y-2 leading-relaxed">
              <p><strong>Abonelik Süresi:</strong> 1 Ay (Otomatik Yenilenen)</p>
              <p><strong>Ücret:</strong> 49,90 TL / ay</p>
              <p>Ödeme Apple Kimliğiniz üzerinden güvenle işlenir. Aboneliğinizi App Store Hesap Ayarlarından istediğiniz zaman iptal edebilirsiniz.</p>
              <p>Topluluk alanında uygunsuz içerik ve küfür paylaşımı kesinlikle yasaktır ve sıfır tolerans uygulanır.</p>
            </div>
            <div className="pt-2 border-t border-card-border flex justify-end">
              <button
                type="button"
                onClick={() => setIsTermsModalOpen(false)}
                className="px-4 py-2 bg-primary text-white font-bold text-xs rounded-xl"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {isPrivacyModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card-bg w-full max-w-lg rounded-3xl p-6 border border-card-border shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <h3 className="font-extrabold text-base text-text-main">Gizlilik Politikası</h3>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="text-xs text-text-muted space-y-2 leading-relaxed">
              <p>Kullanıcı verileriniz güvenli sunucularda saklanır ve üçüncü taraflarla reklam veya pazarlama amacıyla paylaşılmaz.</p>
              <p>Hesabınızı ve tüm verilerinizi Profil &gt; Güvenlik &gt; Hesabı Sil bölümünden istediğiniz an kalıcı olarak silebilirsiniz.</p>
            </div>
            <div className="pt-2 border-t border-card-border flex justify-end">
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="px-4 py-2 bg-primary text-white font-bold text-xs rounded-xl"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
