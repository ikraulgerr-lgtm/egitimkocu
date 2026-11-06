import React, { useState } from 'react';

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab?: (tab: string) => void;
}

interface TourStep {
  title: string;
  badge: string;
  icon: string;
  description: string;
  highlightText: string;
  color: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Yapay Zeka Destekli Soru Çözümü',
    badge: 'Pedagojik AI Hoca',
    icon: 'photo_camera',
    color: 'from-blue-600 to-indigo-600',
    description:
      'Takıldığın sorunun fotoğrafını çek veya metin olarak yaz. Pedagojik AI asistanın sadece cevabı vermekle kalmaz; soruyu adım adım açıklar, kavram yanılgılarını tespit eder ve benzer pekiştirme soruları üretir.',
    highlightText: '📸 Kamera butonuyla hemen soru yükleyip çözdürebilirsin.',
  },
  {
    title: 'Kişisel Sınav Kampları & Akıllı Program',
    badge: 'Ders Programı',
    icon: 'calendar_month',
    color: 'from-indigo-600 to-purple-600',
    description:
      'Hedef sınavına uygun hazır kamplara (90 Günde TYT Bitirme, 60 Günde AYT, 45 Günde LGS vb.) katılabilir ya da kendi özel konu kampını oluşturabilirsin. Programın gün ve saat bazında otomatik planlanır.',
    highlightText: '📅 "Gelişim > Program" alanından aktif kamplarını yönetebilirsin.',
  },
  {
    title: 'Pomodoro Zamanlayıcı & Canlı Odaklanma Odaları',
    badge: 'Odaklan & Kazan',
    icon: 'timer',
    color: 'from-rose-600 to-amber-600',
    description:
      '25 dakikalık odaklanma ve mola seanslarıyla verimini zirveye taşı. İster yerleşik Lofi müzik eşliğinde bireysel çalış, ister arkadaşlarınla aynı odaya katılarak birlikte odaklan ve XP puanları topla!',
    highlightText: '🍅 Pomodoro ile çalıştığın her dakika liderlik sıralamana yansır.',
  },
  {
    title: 'Unutma Eğrisi & Yanlış Havuzu',
    badge: 'Ebbinghaus Yöntemi',
    icon: 'psychology',
    color: 'from-purple-600 to-pink-600',
    description:
      'Yanlış çözdüğün veya takıldığın sorular otomatik olarak Yanlış Havuzu\'nda arşivlenir. Bilimsel Ebbinghaus aralıklı tekrar algoritması, soruyu tam unutma eşiğindeyken önüne getirerek bilginin kalıcı olmasını sağlar.',
    highlightText: '🧠 Hatalarını avantaja dönüştürmek için Yanlış Havuzunu düzenli tekrar et.',
  },
  {
    title: 'Deneme Net Takibi & Liderlik Sıralaması',
    badge: 'Performans & Rekabet',
    icon: 'leaderboard',
    color: 'from-emerald-600 to-teal-600',
    description:
      'TYT, AYT ve LGS deneme netlerini ders bazlı kaydet, net gelişim eğrini grafiklerle incele. Kazandığın başarı rozetleri ve XP puanlarıyla hem arkadaşların hem de Türkiye genelinde derece sıralamasına gir!',
    highlightText: '🏆 "Gelişim" menüsünden istatistiklerini ve sıralamanı anlık izle.',
  },
  {
    title: 'Veli Bağlantısı & Şeffaf Gelişim',
    badge: 'Veli Takip Modu',
    icon: 'family_restroom',
    color: 'from-teal-600 to-cyan-600',
    description:
      'Uygulamadaki öğrenci takip kodunu velinle paylaşarak onların da özel Veli Paneli üzerinden ders çalışma saatlerini, çözülen soru sayılarını ve haftalık başarı grafiklerini canlı takip etmesini sağlayabilirsin.',
    highlightText: '👨‍👩‍👧 Veli desteğiyle hedeflerine çok daha motive şekilde ilerle.',
  },
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('edumind_has_seen_tour', 'true');
    } catch {}
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none font-sans"
    >
      <div className="bg-surface dark:bg-slate-900 border border-card-border/80 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative flex flex-col space-y-5 text-text-main overflow-hidden">
        {/* Glow Background Accent */}
        <div
          className={`absolute -top-24 -right-24 w-60 h-60 rounded-full bg-gradient-to-br ${currentStep.color} opacity-20 blur-3xl pointer-events-none transition-all duration-500`}
        />

        {/* Top Header: Badge, Step Indicator & Skip Button */}
        <div className="flex items-center justify-between gap-2 border-b border-card-border pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full text-white bg-gradient-to-r ${currentStep.color} shadow-xs`}
            >
              {currentStep.badge}
            </span>
            <span className="text-xs font-bold text-text-muted">
              Adım {currentStepIndex + 1} / {TOUR_STEPS.length}
            </span>
          </div>

          <button
            type="button"
            onClick={handleComplete}
            className="text-xs font-extrabold text-text-muted hover:text-text-main px-2.5 py-1 rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            Tanıtımı Geç
          </button>
        </div>

        {/* Step Visual & Icon */}
        <div className="flex items-center gap-4 pt-1">
          <div
            className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${currentStep.color} text-white flex items-center justify-center shadow-lg shrink-0 transform transition-transform duration-300 hover:scale-105`}
          >
            <span className="material-symbols-outlined text-3xl">
              {currentStep.icon}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-base sm:text-lg text-text-main leading-snug">
              {currentStep.title}
            </h3>
            <p className="text-[11px] font-bold text-primary dark:text-indigo-400 mt-0.5">
              Eğitim Koçum AI Özelliği
            </p>
          </div>
        </div>

        {/* Step Description */}
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-text-muted dark:text-slate-300 leading-relaxed font-medium">
            {currentStep.description}
          </p>

          <div className="bg-surface-container-low dark:bg-slate-800/80 border border-card-border/80 p-3 rounded-2xl flex items-center gap-2 text-xs font-bold text-text-main shadow-2xs">
            <span className="material-symbols-outlined text-primary text-base shrink-0">
              lightbulb
            </span>
            <span>{currentStep.highlightText}</span>
          </div>
        </div>

        {/* Step Indicator Progress Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {TOUR_STEPS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentStepIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentStepIndex
                  ? 'w-7 bg-primary'
                  : 'w-2 bg-surface-container-high dark:bg-slate-700 hover:bg-primary/50'
              }`}
              aria-label={`Adım ${idx + 1}`}
            />
          ))}
        </div>

        {/* Footer Actions: Previous, Next / Finish */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-card-border">
          <button
            type="button"
            disabled={isFirst}
            onClick={handlePrev}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              isFirst
                ? 'opacity-30 cursor-not-allowed text-text-muted'
                : 'bg-surface-container-low dark:bg-slate-800 text-text-main hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Önceki</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            className={`px-6 py-2.5 rounded-xl font-black text-xs text-white shadow-lg active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r ${currentStep.color} hover:brightness-110`}
          >
            <span>{isLast ? 'Hemen Başla 🚀' : 'Sonraki Adım'}</span>
            {!isLast && (
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
