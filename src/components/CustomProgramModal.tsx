import React, { useState, useMemo } from 'react';
import { ProgramOgesi } from '../types';
import {
  EXAM_CURRICULUM_DATA,
  ExamCurriculum,
  generateCampScheduleItems,
} from '../data/curriculumData';
import { generateAiCampScheduleService } from '../lib/geminiClient';

interface CustomProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMultipleItems: (items: Omit<ProgramOgesi, 'id'>[], replaceExisting?: boolean) => void;
  showToast: (msg: string) => void;
  setActiveTab?: (tab: any) => void;
}

export const CustomProgramModal: React.FC<CustomProgramModalProps> = ({
  isOpen,
  onClose,
  onAddMultipleItems,
  showToast,
  setActiveTab,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Category filter & Selected Exam/Grade
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'EXAM' | 'SINIF'>('ALL');
  const [selectedExamId, setSelectedExamId] = useState<string>('yks_tyt_ayt');

  // Step 2: Selected Topics (ders -> set of konu titles)
  const [selectedTopics, setSelectedTopics] = useState<Record<string, string[]>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeDersTab, setActiveDersTab] = useState<string>('');

  // Step 3: Dates and Times
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultTargetStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30); // 30 days ahead by default
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState<string>(todayStr);
  const [targetEndDate, setTargetEndDate] = useState<string>(defaultTargetStr);
  const [dailyHours, setDailyHours] = useState<number>(2);
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>('evening');

  // Step 4: AI Generation & Settings
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [aiPlan, setAiPlan] = useState<Omit<ProgramOgesi, 'id'>[] | null>(null);
  const [previewDayFilter, setPreviewDayFilter] = useState<string>('ALL');

  const currentExam = useMemo(() => {
    return EXAM_CURRICULUM_DATA.find((e) => e.id === selectedExamId) || EXAM_CURRICULUM_DATA[0];
  }, [selectedExamId]);

  // Set initial active ders tab when exam changes
  React.useEffect(() => {
    if (currentExam && currentExam.dersler.length > 0) {
      setActiveDersTab(currentExam.dersler[0].ders);
    }
  }, [currentExam]);

  // Total topics selected across all subjects
  const totalSelectedCount = useMemo(() => {
    return Object.values(selectedTopics).reduce((acc, curr) => acc + curr.length, 0);
  }, [selectedTopics]);

  // Flattened array for the generator
  const flattenedSelectedTopics = useMemo(() => {
    const result: { ders: string; konu: string }[] = [];
    Object.entries(selectedTopics).forEach(([ders, konular]) => {
      konular.forEach((konu) => {
        result.push({ ders, konu });
      });
    });
    return result;
  }, [selectedTopics]);

  // Calculated day duration
  const campaignDays = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(targetEndDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 1;
    const diff = Math.abs(e.getTime() - s.getTime());
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  }, [startDate, targetEndDate]);

  // Algorithmic Fallback Plan
  const defaultPlan = useMemo(() => {
    return generateCampScheduleItems({
      examName: currentExam.name,
      selectedTopics: flattenedSelectedTopics,
      startDate,
      targetEndDate,
      dailyHours,
      preferredTimeSlot,
    });
  }, [currentExam, flattenedSelectedTopics, startDate, targetEndDate, dailyHours, preferredTimeSlot]);

  // Final active plan (AI generated or algorithmic fallback)
  const finalPlan = useMemo(() => {
    return aiPlan && aiPlan.length > 0 ? aiPlan : defaultPlan;
  }, [aiPlan, defaultPlan]);

  // Trigger Gemini AI generation
  const handleGenerateAiPlan = async () => {
    if (flattenedSelectedTopics.length === 0) return;
    setIsAiGenerating(true);
    try {
      const items = await generateAiCampScheduleService({
        examName: currentExam.name,
        selectedTopics: flattenedSelectedTopics,
        startDate,
        targetEndDate,
        dailyHours,
        preferredTimeSlot,
      });
      if (items && items.length > 0) {
        setAiPlan(items);
        showToast('✨ Kamp programınız Gemini Yapay Zekası ile pedagojik olarak optimize edildi!');
      } else {
        setAiPlan(defaultPlan);
      }
    } catch (err) {
      console.warn('AI camp generation warning:', err);
      setAiPlan(defaultPlan);
    } finally {
      setIsAiGenerating(false);
    }
  };

  if (!isOpen) return null;

  // Toggle single topic
  const toggleTopic = (ders: string, konu: string) => {
    setSelectedTopics((prev) => {
      const currentList = prev[ders] || [];
      if (currentList.includes(konu)) {
        return {
          ...prev,
          [ders]: currentList.filter((k) => k !== konu),
        };
      } else {
        return {
          ...prev,
          [ders]: [...currentList, konu],
        };
      }
    });
  };

  // Select all topics of current subject
  const selectAllTopicsInDers = (ders: string, allKonular: string[]) => {
    setSelectedTopics((prev) => ({
      ...prev,
      [ders]: [...allKonular],
    }));
  };

  // Clear all topics of current subject
  const clearAllTopicsInDers = (ders: string) => {
    setSelectedTopics((prev) => ({
      ...prev,
      [ders]: [],
    }));
  };

  const handleFinishAndApply = () => {
    if (finalPlan.length === 0) {
      showToast('⚠️ Lütfen önce en az 1 konu seçin!');
      return;
    }

    onAddMultipleItems(finalPlan, replaceExisting);
    showToast(`🎉 Harika! ${campaignDays} günlük özel kamp programınız hazırlandı ve takvime eklendi.`);
    onClose();
    if (setActiveTab) {
      setActiveTab('schedule');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-card-bg border border-card-border rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl relative my-auto max-h-[92vh] flex flex-col space-y-5 text-text-main">
        {/* Header with Close */}
        <div className="flex items-start justify-between gap-3 border-b border-card-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <span className="material-symbols-outlined text-2xl">event_available</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-text-main leading-tight">
                  Özel Çalışma Programı & Kamp Planlayıcı
                </h3>
                <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full border border-primary/20">
                  Adım {step} / 4
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Hedef sınavını ve konuları seç, bitiş tarihine göre günlere bölünen kampını otomatik hazırla.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-surface-container-low hover:bg-surface-container text-text-muted hover:text-text-main flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Wizard Step Progress Bar */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { s: 1, title: '1. Sınav' },
            { s: 2, title: '2. Konular' },
            { s: 3, title: '3. Tarih & Saat' },
            { s: 4, title: '4. Önizleme' },
          ].map((item) => (
            <div
              key={item.s}
              className={`py-1.5 px-2 rounded-xl text-center text-xs font-bold transition-all border ${
                step === item.s
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : step > item.s
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-surface-container-low text-text-muted border-card-border'
              }`}
            >
              <span>{item.title}</span>
            </div>
          ))}
        </div>

        {/* Step 1: Exam & Grade Curriculum Selection */}
        {step === 1 && (
          <div className="space-y-3.5 overflow-y-auto pr-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold text-text-muted uppercase tracking-wider">
                1. Sınavınızı veya Sınıfınızı Seçin:
              </h4>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-card-border shrink-0">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    categoryFilter === 'ALL'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  Tümü
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('EXAM')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    categoryFilter === 'EXAM'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  🎯 Sınavlar
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('SINIF')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    categoryFilter === 'SINIF'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  🏫 Sınıf Müfredatı
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {EXAM_CURRICULUM_DATA.filter((e) => {
                if (categoryFilter === 'ALL') return true;
                if (categoryFilter === 'EXAM') return e.category === 'YKS' || e.category === 'KPSS' || e.category === 'LGS';
                if (categoryFilter === 'SINIF') return e.category === 'SINIF';
                return true;
              }).map((exam) => {
                const isSelected = selectedExamId === exam.id;
                return (
                  <div
                    key={exam.id}
                    onClick={() => {
                      setSelectedExamId(exam.id);
                      setSelectedTopics({});
                    }}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 group ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                        : 'border-card-border bg-surface-container-low hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">
                        {exam.category === 'YKS' ? '🎓' : exam.category === 'KPSS' ? '🏛️' : exam.category === 'LGS' ? '🚀' : '🏫'}
                      </span>
                      {isSelected ? (
                        <span className="material-symbols-outlined text-primary text-xl">check_circle</span>
                      ) : (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-card-bg border border-card-border text-text-muted">
                          {exam.category === 'SINIF' ? 'MEB Müfredatı' : 'Sınav Kampı'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h5 className="font-extrabold text-sm text-text-main group-hover:text-primary transition-colors">
                        {exam.name}
                      </h5>
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed line-clamp-2">
                        {exam.description}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-card-border text-[11px] font-bold text-primary flex items-center justify-between">
                      <span>{exam.dersler.length} Branş Ders</span>
                      <span className="text-text-muted text-[10px]">Tüm Konular Listeli →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Subject & Topic Selection */}
        {step === 2 && (
          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-extrabold text-text-muted uppercase tracking-wider">
                  2. Çalışmak İstediğiniz Ders ve Konuları İşaretleyin:
                </h4>
                <p className="text-xs text-text-muted">
                  Seçilen toplam konu: <strong className="text-primary font-black">{totalSelectedCount}</strong>
                </p>
              </div>

              {/* Search filter input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Konu ara..."
                  className="bg-surface-container-low border border-card-border rounded-xl px-3 py-1.5 pl-8 text-xs text-text-main focus:outline-none focus:border-primary w-full sm:w-48"
                />
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-base">
                  search
                </span>
              </div>
            </div>

            {/* Subject horizontal tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
              {currentExam.dersler.map((d) => {
                const count = (selectedTopics[d.ders] || []).length;
                return (
                  <button
                    key={d.ders}
                    type="button"
                    onClick={() => setActiveDersTab(d.ders)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border ${
                      activeDersTab === d.ders
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface-container-low text-text-muted border-card-border hover:text-text-main'
                    }`}
                  >
                    <span>{d.ders}</span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        activeDersTab === d.ders ? 'bg-white text-primary' : 'bg-primary/20 text-primary'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Topics Checklist for Active Subject */}
            {(() => {
              const currentSubject = currentExam.dersler.find((d) => d.ders === activeDersTab) || currentExam.dersler[0];
              if (!currentSubject) return null;

              const filteredKonular = currentSubject.konular.filter((k) =>
                k.toLowerCase().includes(searchTerm.toLowerCase())
              );
              const selectedInCurrentDers = selectedTopics[currentSubject.ders] || [];

              return (
                <div className="bg-surface-container-low p-4 rounded-2xl border border-card-border space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-card-border">
                    <span className="font-extrabold text-xs text-text-main flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-base">menu_book</span>
                      <span>{currentSubject.ders} Konu Listesi</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllTopicsInDers(currentSubject.ders, currentSubject.konular)}
                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                      >
                        Tümünü Seç
                      </button>
                      <span className="text-card-border">•</span>
                      <button
                        type="button"
                        onClick={() => clearAllTopicsInDers(currentSubject.ders)}
                        className="text-[11px] font-bold text-text-muted hover:text-rose-500 cursor-pointer"
                      >
                        Temizle
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {filteredKonular.map((konu) => {
                      const isChecked = selectedInCurrentDers.includes(konu);
                      return (
                        <label
                          key={konu}
                          onClick={() => toggleTopic(currentSubject.ders, konu)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none text-xs ${
                            isChecked
                              ? 'bg-card-bg border-primary text-text-main shadow-2xs font-extrabold'
                              : 'bg-card-bg/60 border-card-border text-text-muted hover:border-primary/40'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // handled by parent onClick
                            className="w-4 h-4 rounded text-primary border-card-border focus:ring-primary shrink-0 cursor-pointer"
                          />
                          <span className="truncate">{konu}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Step 3: Dates & Daily Hours */}
        {step === 3 && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <h4 className="text-xs font-extrabold text-text-muted uppercase tracking-wider">
              3. Kamp Süresi ve Günlük Hedefinizi Belirleyin:
            </h4>

            {/* Dates Card */}
            <div className="bg-surface-container-low p-4 sm:p-5 rounded-2xl border border-card-border space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-main mb-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-primary">calendar_today</span>
                    <span>Başlangıç Tarihi:</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-card-bg border border-card-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-main mb-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-rose-500">flag</span>
                    <span>Bu Konuları Ne Zaman Bitirmek İstiyorsunuz?</span>
                  </label>
                  <input
                    type="date"
                    value={targetEndDate}
                    min={startDate}
                    onChange={(e) => setTargetEndDate(e.target.value)}
                    className="w-full bg-card-bg border border-card-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Campaign Days Summary Pill */}
              <div className="bg-primary/10 border border-primary/20 p-3 rounded-xl flex items-center justify-between text-xs text-primary font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">timer</span>
                  <span>Toplam Kamp Süresi:</span>
                </span>
                <span className="text-sm font-black bg-primary text-white px-3 py-0.5 rounded-full">
                  {campaignDays} Gün
                </span>
              </div>
            </div>

            {/* Daily Hours & Slots */}
            <div className="bg-surface-container-low p-4 sm:p-5 rounded-2xl border border-card-border space-y-3">
              <label className="block text-xs font-bold text-text-main flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-primary">fitness_center</span>
                <span>Günlük Hedef Çalışma Temposu:</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { hours: 2, label: '🎯 2 Seans (Günde ~1.5 Saat)', desc: 'Dengeli ve sürdürülebilir' },
                  { hours: 3, label: '🚀 3 Seans (Günde ~2.25 Saat)', desc: 'Hedef odaklı kamp' },
                  { hours: 4, label: '⚡ 4 Seans (Günde ~3 Saat)', desc: 'Yoğun şampiyon temposu' },
                ].map((item) => (
                  <button
                    key={item.hours}
                    type="button"
                    onClick={() => setDailyHours(item.hours)}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-left ${
                      dailyHours === item.hours
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-card-bg text-text-muted border-card-border hover:border-primary/50'
                    }`}
                  >
                    <div className="font-extrabold">{item.label}</div>
                    <div className={`text-[10px] mt-0.5 ${dailyHours === item.hours ? 'text-white/80' : 'text-text-muted'}`}>
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>

              {/* Preferred Time Slot */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-text-main mb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-primary">schedule</span>
                  <span>Günlük Tercih Edilen Çalışma Zamanı (45'er dk Odaklanma Seansları):</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { slot: 'evening', title: '🌆 Akşam', time: '17:30 - 21:30' },
                    { slot: 'night', title: '🌙 Gece', time: '19:30 - 23:30' },
                    { slot: 'morning', title: '🌅 Sabah', time: '10:00 - 15:00' },
                    { slot: 'afternoon', title: '☀️ Öğleden Sonra', time: '14:00 - 18:00' },
                  ].map((s) => (
                    <button
                      key={s.slot}
                      type="button"
                      onClick={() => setPreferredTimeSlot(s.slot)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                        preferredTimeSlot === s.slot
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-card-bg text-text-muted border-card-border hover:border-primary/50'
                      }`}
                    >
                      <div>{s.title}</div>
                      <div className="text-[10px] opacity-80 mt-0.5">{s.time}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Preview & Confirm */}
        {step === 4 && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary">auto_awesome</span>
                <span>4. Yapay Zeka Kamp Programı Önizlemesi</span>
              </h4>
              <button
                type="button"
                disabled={isAiGenerating}
                onClick={handleGenerateAiPlan}
                className="text-[11px] font-black text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-sm ${isAiGenerating ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                <span>{isAiGenerating ? 'AI Hazırlıyor...' : 'Yapay Zeka ile Yeniden Oluştur'}</span>
              </button>
            </div>

            {/* Campaign Summary Card with AI Badge */}
            <div className="bg-gradient-to-tr from-primary/10 via-indigo-600/10 to-purple-600/10 border border-primary/30 p-4 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-extrabold text-sm text-text-main flex items-center gap-2">
                  <span>🚀 {currentExam.name} Kişisel Kampı</span>
                  <span className="text-[10px] font-black bg-gradient-to-r from-primary to-purple-600 text-white px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-[11px]">neurology</span>
                    <span>Gemini AI Destekli</span>
                  </span>
                </span>
                <span className="text-xs font-black text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                  {finalPlan.length} Görev Planlandı
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                <div className="bg-card-bg/80 p-2.5 rounded-xl border border-card-border">
                  <span className="text-text-muted text-[10px] block">Seçilen Konu:</span>
                  <strong className="text-text-main font-black">{totalSelectedCount} Adet</strong>
                </div>
                <div className="bg-card-bg/80 p-2.5 rounded-xl border border-card-border">
                  <span className="text-text-muted text-[10px] block">Kamp Süresi:</span>
                  <strong className="text-text-main font-black">{campaignDays} Gün</strong>
                </div>
                <div className="bg-card-bg/80 p-2.5 rounded-xl border border-card-border col-span-2 sm:col-span-1">
                  <span className="text-text-muted text-[10px] block">Günün Dağılımı:</span>
                  <strong className="text-text-main font-black">Maks. 2-3 Seans (45 dk)</strong>
                </div>
              </div>
            </div>

            {/* Clean Schedule Option Toggle */}
            <div className="bg-surface-container-low border border-card-border p-3.5 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">auto_delete</span>
                </div>
                <div>
                  <div className="text-xs font-black text-text-main flex items-center gap-1.5">
                    <span>Mevcut Programı Temizle</span>
                    <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-500 px-2 py-0.2 rounded-full">
                      Önerilen
                    </span>
                  </div>
                  <div className="text-[10px] text-text-muted">
                    Eski çakışan görevleri siler, yalnızca bu yeni kampı düzenli uygular.
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* AI Loading Banner */}
            {isAiGenerating && (
              <div className="p-4 bg-primary/10 border border-primary/30 rounded-2xl flex items-center gap-3 animate-pulse">
                <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                <div className="text-xs">
                  <strong className="text-primary font-black block">Gemini Yapay Zeka Pedagogu Kampı Hazırlıyor...</strong>
                  <span className="text-text-muted text-[11px]">Seçtiğiniz {totalSelectedCount} konu günlere dengeli bölünüyor, odak seansları ayarlanıyor.</span>
                </div>
              </div>
            )}

            {/* Day Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {['ALL', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => {
                const label = day === 'ALL' ? 'Tüm Günler' : day;
                const count = day === 'ALL' ? finalPlan.length : finalPlan.filter((i) => i.gun === day).length;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setPreviewDayFilter(day)}
                    className={`px-3 py-1.5 rounded-xl font-black text-[11px] shrink-0 transition-all cursor-pointer ${
                      previewDayFilter === day
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-surface-container-low border border-card-border text-text-muted hover:text-text-main'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="ml-1.5 opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Generated Items Sample Preview */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {(previewDayFilter === 'ALL' ? finalPlan : finalPlan.filter((i) => i.gun === previewDayFilter)).map((item, idx) => (
                <div
                  key={idx}
                  className="bg-surface-container-low border border-card-border p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-black flex items-center justify-center shrink-0 text-xs">
                      {item.gun}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-[11px] text-primary">{item.ders}</span>
                        <span className="text-[10px] bg-card-bg border border-card-border px-2 py-0.5 rounded-md text-text-muted font-mono font-bold">
                          {item.saat}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-text-main truncate mt-0.5">{item.konu}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full shrink-0">
                    Planlandı
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Bottom Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-card-border gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className="px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-text-main font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>Geri</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-text-muted font-bold text-xs transition-all cursor-pointer"
            >
              Vazgeç
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 2 && totalSelectedCount === 0) {
                  showToast('⚠️ Lütfen devam etmek için en az 1 konu seçin!');
                  return;
                }
                if (step === 3) {
                  setStep(4);
                  handleGenerateAiPlan();
                } else {
                  setStep((prev) => (prev + 1) as any);
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{step === 3 ? '✨ AI Kampını Oluştur' : 'İleri'}</span>
              <span className="material-symbols-outlined text-base">
                {step === 3 ? 'auto_awesome' : 'arrow_forward'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishAndApply}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              <span>Kamp Programını Takvime Ekle</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
