import React, { useState, useEffect } from 'react';
import { Kullanici } from '../types';

interface ExamCountdownWidgetProps {
  user: Kullanici;
  onUpdateUser: (updatedUser: Kullanici) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const EXAM_PRESETS: Array<{
  id: 'YKS' | 'LGS' | 'YDS' | 'KPSS' | 'Hazırlanmıyorum';
  title: string;
  badge: string;
  defaultDate: string; // YYYY-MM-DD
  icon: string;
  description: string;
}> = [
  {
    id: 'YKS',
    title: 'YKS 2027 (TYT - AYT)',
    badge: 'YKS 2027',
    defaultDate: '2027-06-19',
    icon: 'school',
    description: 'Yükseköğretim Kurumları Sınavı',
  },
  {
    id: 'LGS',
    title: 'LGS 2027',
    badge: 'LGS 2027',
    defaultDate: '2027-06-06',
    icon: 'menu_book',
    description: 'Lise Geçiş Sınavı',
  },
  {
    id: 'KPSS',
    title: 'KPSS 2027',
    badge: 'KPSS 2027',
    defaultDate: '2027-07-18',
    icon: 'work',
    description: 'Kamu Personel Seçme Sınavı',
  },
  {
    id: 'YDS',
    title: 'YDS 2027',
    badge: 'YDS 2027',
    defaultDate: '2027-04-11',
    icon: 'translate',
    description: 'Yabancı Dil Bilgisi Seviye Tespit Sınavı',
  },
  {
    id: 'Hazırlanmıyorum',
    title: 'Sınava Hazırlanmıyorum',
    badge: 'Genel Öğrenim',
    defaultDate: '',
    icon: 'auto_awesome',
    description: 'Genel Ders & Konu Çalışması',
  },
];

export const ExamCountdownWidget: React.FC<ExamCountdownWidgetProps> = ({
  user,
  onUpdateUser,
  isOpen,
  onClose,
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [selectedExamType, setSelectedExamType] = useState<'YKS' | 'LGS' | 'YDS' | 'KPSS' | 'Hazırlanmıyorum' | 'Özel'>(
    user.targetExam || 'YKS'
  );
  const [targetDateStr, setTargetDateStr] = useState<string>(
    user.targetExamDate || '2027-06-19'
  );
  const [customName, setCustomName] = useState<string>(user.customExamName || '');

  // Keep local state synced when modal opens or user prop updates
  useEffect(() => {
    if (isOpen) {
      setSelectedExamType(user.targetExam || 'YKS');
      setTargetDateStr(user.targetExamDate || '2027-06-19');
      setCustomName(user.customExamName || '');
    }
  }, [isOpen, user.targetExam, user.targetExamDate, user.customExamName]);

  // Time remaining state
  const [timeLeft, setTimeLeft] = useState<{
    totalMs: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Calculate time remaining based on active selected targetDateStr
  useEffect(() => {
    if (!isOpen) return;

    const calculateTime = () => {
      const activeDateStr = targetDateStr || user.targetExamDate || '2027-06-19';
      const targetTime = new Date(`${activeDateStr}T10:00:00`).getTime();
      const now = new Date().getTime();
      const diff = targetTime - now;

      if (isNaN(diff) || diff <= 0) {
        setTimeLeft({ totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ totalMs: diff, days, hours, minutes, seconds });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDateStr, user.targetExamDate, isOpen]);

  // Handle Preset Select
  const handleSelectPreset = (preset: typeof EXAM_PRESETS[0]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
    setSelectedExamType(preset.id);
    setTargetDateStr(preset.defaultDate);
    setCustomName('');

    // Immediately sync user object so Navbar and all components update
    const updatedUser: Kullanici = {
      ...user,
      targetExam: preset.id,
      targetExamDate: preset.defaultDate,
      customExamName: preset.title,
    };

    onUpdateUser(updatedUser);
  };

  // Handle Save Exam Selection
  const handleSaveExamSelection = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }

    let finalName = customName.trim();
    if (selectedExamType !== 'Özel') {
      const foundPreset = EXAM_PRESETS.find((p) => p.id === selectedExamType);
      finalName = foundPreset ? foundPreset.title : selectedExamType;
    } else if (!finalName) {
      finalName = 'Özel Sınavım';
    }

    const updatedUser: Kullanici = {
      ...user,
      targetExam: selectedExamType,
      targetExamDate: targetDateStr,
      customExamName: finalName,
    };

    onUpdateUser(updatedUser);
    setShowConfig(false);
  };

  const getExamTitle = () => {
    if (selectedExamType === 'Özel') {
      return customName || 'Özel Sınav';
    }
    const preset = EXAM_PRESETS.find((p) => p.id === selectedExamType);
    return preset ? preset.badge : selectedExamType || 'YKS 2027';
  };

  const formattedTargetDate = () => {
    const rawDate = targetDateStr || '2027-06-19';
    try {
      const parts = rawDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    } catch {
      // fallback
    }
    return rawDate;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-card-bg border border-card-border rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl text-text-main relative animate-slide-up max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Modal Window Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-card-border shrink-0 bg-surface-container-low/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-md shrink-0">
              <span className="material-symbols-outlined text-2xl">timer</span>
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg text-text-main flex items-center gap-1.5">
                <span>{getExamTitle()} Geri Sayım</span>
                <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/20">
                  {selectedExamType || 'YKS'}
                </span>
              </h3>
              <p className="text-xs font-semibold text-text-muted flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-xs">event</span>
                <span>{formattedTargetDate()}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if ('vibrate' in navigator) {
                navigator.vibrate(10);
              }
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-surface-container-low text-text-muted hover:text-text-main flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Pencereyi Kapat"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Main Countdown Visual Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-50 via-purple-50 to-slate-100 dark:from-indigo-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white p-5 sm:p-6 shadow-xl border border-indigo-200 dark:border-indigo-500/30">
            {/* Background Decorative Grids */}
            <div className="absolute -right-8 -top-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

            {timeLeft.totalMs > 0 ? (
              <div className="relative z-10 space-y-4">
                <div className="grid grid-cols-4 gap-2 text-center">
                  {/* Days Box */}
                  <div className="bg-white dark:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-400/25 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-center items-center backdrop-blur-sm shadow-xs">
                    <span className="text-2xl sm:text-4xl font-black text-indigo-700 dark:text-white tracking-tight leading-none">
                      {timeLeft.days}
                    </span>
                    <span className="text-[10px] font-extrabold text-indigo-900 dark:text-indigo-200 mt-1 uppercase tracking-wider">
                      Gün
                    </span>
                  </div>

                  {/* Hours Box */}
                  <div className="bg-white dark:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-400/25 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-center items-center backdrop-blur-sm shadow-xs">
                    <span className="text-2xl sm:text-4xl font-black text-indigo-700 dark:text-indigo-100 tracking-tight leading-none">
                      {String(timeLeft.hours).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] font-extrabold text-indigo-900 dark:text-indigo-200 mt-1 uppercase tracking-wider">
                      Saat
                    </span>
                  </div>

                  {/* Minutes Box */}
                  <div className="bg-white dark:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-400/25 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-center items-center backdrop-blur-sm shadow-xs">
                    <span className="text-2xl sm:text-4xl font-black text-indigo-700 dark:text-indigo-100 tracking-tight leading-none">
                      {String(timeLeft.minutes).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] font-extrabold text-indigo-900 dark:text-indigo-200 mt-1 uppercase tracking-wider">
                      Dakika
                    </span>
                  </div>

                  {/* Seconds Box */}
                  <div className="bg-white dark:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-400/25 rounded-2xl p-2.5 sm:p-3 flex flex-col justify-center items-center backdrop-blur-sm shadow-xs">
                    <span className="text-2xl sm:text-4xl font-black text-amber-600 dark:text-amber-300 tracking-tight leading-none animate-pulse">
                      {String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] font-extrabold text-indigo-900 dark:text-indigo-200 mt-1 uppercase tracking-wider">
                      Saniye
                    </span>
                  </div>
                </div>

                {/* Motivational Banner */}
                <div className="p-3 bg-white/80 dark:bg-white/5 border border-indigo-200 dark:border-white/20 rounded-2xl flex items-center justify-between text-xs text-slate-900 dark:text-white gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🚀</span>
                    <span className="text-[11px] font-medium leading-tight text-slate-800 dark:text-white">
                      <strong className="text-indigo-700 dark:text-amber-300 font-extrabold">{timeLeft.days} gün</strong> kaldı. Her çözdüğün soru hedefine +1 net ekler!
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold text-indigo-700 dark:text-amber-300 bg-indigo-100 dark:bg-amber-400/20 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-amber-300/30 shrink-0">
                    Hedefe Odaklan
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative z-10 py-6 text-center space-y-2">
                <div className="text-4xl">🎉</div>
                <h4 className="font-extrabold text-lg text-amber-300">Sınav Günü Geldi veya Geçti!</h4>
                <p className="text-xs text-indigo-100">
                  Umarız harika bir sınav geçirdin. Yeni hedef sınavını seçmek için aşağıdaki butona tıklayabilirsin.
                </p>
              </div>
            )}
          </div>

          {/* Change Exam / Date Config Accordion Toggle */}
          <div className="border border-card-border rounded-2xl overflow-hidden bg-card-bg shadow-xs">
            <button
              onClick={() => {
                setSelectedExamType(user.targetExam || 'YKS');
                setTargetDateStr(user.targetExamDate || '2027-06-19');
                setCustomName(user.customExamName || '');
                setShowConfig(!showConfig);
              }}
              className="w-full p-3.5 flex items-center justify-between text-left bg-surface-container-low hover:bg-card-border/30 border-b border-transparent transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-xl">
                  edit_calendar
                </span>
                <div>
                  <h4 className="font-black text-xs text-text-main">
                    Hedef Sınavı veya Tarihi Değiştir
                  </h4>
                  <p className="text-[11px] font-medium text-text-muted">
                    YKS, LGS, YDS, KPSS veya özel sınav tarihi belirle
                  </p>
                </div>
              </div>

              <span
                className={`material-symbols-outlined text-text-muted text-lg transition-transform ${
                  showConfig ? 'rotate-180' : ''
                }`}
              >
                expand_more
              </span>
            </button>

            {showConfig && (
              <div className="p-4 border-t border-card-border space-y-3 bg-surface-container-low/50 animate-fadeIn">
                <label className="text-xs font-black text-text-muted block uppercase tracking-wider">
                  Sınav Türü Seç
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EXAM_PRESETS.map((preset) => {
                    const isSelected = selectedExamType === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'border-2 border-primary bg-primary/10 shadow-xs'
                            : 'border-card-border hover:border-primary/50 bg-card-bg'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-primary text-white' : 'bg-surface-container-low text-text-muted'
                          }`}
                        >
                          <span className="material-symbols-outlined text-lg">{preset.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-xs text-text-main truncate">{preset.badge}</h4>
                          <span className="text-[10px] text-primary font-black block">{preset.defaultDate}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Exam Option */}
                <button
                  type="button"
                  onClick={() => setSelectedExamType('Özel')}
                  className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                    selectedExamType === 'Özel'
                      ? 'border-2 border-primary bg-primary/10 shadow-xs'
                      : 'border-card-border hover:border-primary/50 bg-card-bg'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        selectedExamType === 'Özel' ? 'bg-primary text-white' : 'bg-surface-container-low text-text-muted'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </div>
                    <div>
                      <h4 className="font-black text-xs text-text-main">Özel Sınav Girişi</h4>
                      <p className="text-[11px] font-medium text-text-muted">Kendi sınav adını ve tarihini belirle</p>
                    </div>
                  </div>
                  {selectedExamType === 'Özel' && (
                    <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                  )}
                </button>

                {/* Custom Inputs Panel */}
                {selectedExamType === 'Özel' && (
                  <div className="p-3 bg-card-bg border border-card-border rounded-xl space-y-2.5 shadow-xs">
                    <div>
                      <label className="text-xs font-black text-text-main mb-1 block">Sınav Adı</label>
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Örn: Vize Sınavı, DGS, TUS..."
                        className="w-full px-3 py-2 text-xs bg-surface-container-low border border-card-border rounded-lg text-text-main font-medium focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black text-text-main mb-1 block">Sınav Tarihi</label>
                      <input
                        type="date"
                        value={targetDateStr}
                        onChange={(e) => setTargetDateStr(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-surface-container-low border border-card-border rounded-lg text-text-main font-bold focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                )}

                {/* Preset Date Picker Adjustment */}
                {selectedExamType !== 'Özel' && (
                  <div className="p-2.5 bg-card-bg rounded-xl border border-card-border flex items-center justify-between text-xs shadow-xs">
                    <span className="text-text-main font-bold">Tarihi Özelleştir:</span>
                    <input
                      type="date"
                      value={targetDateStr}
                      onChange={(e) => setTargetDateStr(e.target.value)}
                      className="px-2 py-1 text-xs bg-surface-container-low border border-card-border rounded-lg text-text-main font-bold focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSaveExamSelection}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-black rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">check</span>
                    <span>Seçimi Kaydet</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Window Actions */}
        <div className="p-4 border-t border-card-border bg-surface-container-low/80 shrink-0 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-text-muted">
            {getExamTitle()} hedefine kalan süreyi istediğin an buradan takip edebilirsin.
          </p>

          <button
            onClick={() => {
              if ('vibrate' in navigator) {
                navigator.vibrate(10);
              }
              onClose();
            }}
            className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-black rounded-2xl shadow-md active:scale-95 transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">close</span>
            <span>Kapat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
