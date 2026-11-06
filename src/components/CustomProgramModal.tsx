import React, { useState, useMemo } from 'react';
import { ProgramOgesi, ActiveCamp } from '../types';
import {
  EXAM_CURRICULUM_DATA,
  READY_MADE_CAMPS,
  ReadyMadeCamp,
  generateCampScheduleItems,
} from '../data/curriculumData';
import { generateAiCampScheduleService } from '../lib/geminiClient';
import { scheduleCampStudyReminder } from '../lib/notificationService';
import { auth } from '../lib/firebase';

interface CustomProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMultipleItems: (items: Omit<ProgramOgesi, 'id'>[], replaceExisting?: boolean) => void;
  showToast: (msg: string) => void;
  setActiveTab?: (tab: any) => void;
  currentUserId?: string;
}

export const CustomProgramModal: React.FC<CustomProgramModalProps> = ({
  isOpen,
  onClose,
  onAddMultipleItems,
  showToast,
  setActiveTab,
  currentUserId,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Mode - Ready-Made Preset vs Custom Camp
  const [campMode, setCampMode] = useState<'READY' | 'CUSTOM'>('READY');
  const [selectedReadyCampId, setSelectedReadyCampId] = useState<string>('camp_tyt_90');
  const [customCampTitle, setCustomCampTitle] = useState<string>('');

  // Custom Category filter & Selected Exam
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
    d.setDate(d.getDate() + 90); // 90 days default for standard camp
    return d.toISOString().split('T')[0];
  }, []);

  const [startDate, setStartDate] = useState<string>(todayStr);
  const [targetEndDate, setTargetEndDate] = useState<string>(defaultTargetStr);
  const [dailyHours, setDailyHours] = useState<number>(3);
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>('evening');

  // Step 4: AI Generation & Settings
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [aiPlan, setAiPlan] = useState<Omit<ProgramOgesi, 'id'>[] | null>(null);
  const [previewDayFilter, setPreviewDayFilter] = useState<string>('ALL');

  const currentExam = useMemo(() => {
    return EXAM_CURRICULUM_DATA.find((e) => e.id === selectedExamId) || EXAM_CURRICULUM_DATA[0];
  }, [selectedExamId]);

  // Robust Ready-Made Camp Selection: Populates ALL subjects and topics without omitting any branch
  const applyReadyMadeCamp = (preset: ReadyMadeCamp) => {
    setSelectedReadyCampId(preset.id);
    setSelectedExamId(preset.examId);
    setCustomCampTitle(preset.title);
    setDailyHours(preset.dailyHours);

    // Calculate target end date
    const d = new Date();
    d.setDate(d.getDate() + preset.durationDays);
    setTargetEndDate(d.toISOString().split('T')[0]);

    // Select all topics of recommended subjects
    const targetCurriculum = EXAM_CURRICULUM_DATA.find((e) => e.id === preset.examId);
    if (targetCurriculum) {
      const newTopics: Record<string, string[]> = {};
      targetCurriculum.dersler.forEach((d) => {
        const isMatched = preset.recommendedSubjects.some((rec) => {
          if (rec === d.ders) return true;
          const cleanRec = rec.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanDers = d.ders.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanDers === cleanRec || cleanDers.includes(cleanRec) || cleanRec.includes(cleanDers);
        });

        if (isMatched) {
          newTopics[d.ders] = [...d.konular];
        }
      });
      setSelectedTopics(newTopics);
      const firstSubject = Object.keys(newTopics)[0] || targetCurriculum.dersler[0]?.ders;
      if (firstSubject) {
        setActiveDersTab(firstSubject);
      }
    }
  };

  // Set initial active ders tab when exam changes
  React.useEffect(() => {
    if (currentExam && currentExam.dersler.length > 0) {
      if (!currentExam.dersler.some((d) => d.ders === activeDersTab)) {
        setActiveDersTab(currentExam.dersler[0].ders);
      }
    }
  }, [currentExam]);

  // Initialize with the 90 days TYT camp on first open
  React.useEffect(() => {
    if (isOpen && Object.keys(selectedTopics).length === 0) {
      const defaultPreset = READY_MADE_CAMPS[0];
      if (defaultPreset) {
        applyReadyMadeCamp(defaultPreset);
      }
    }
  }, [isOpen]);

  // Total topics selected across all subjects
  const totalSelectedCount = useMemo(() => {
    return (Object.values(selectedTopics) as string[][]).reduce((acc, curr) => acc + (curr?.length || 0), 0);
  }, [selectedTopics]);

  // Flattened array for the generator
  const flattenedSelectedTopics = useMemo(() => {
    const result: { ders: string; konu: string }[] = [];
    (Object.entries(selectedTopics) as [string, string[]][]).forEach(([ders, konular]) => {
      (konular || []).forEach((konu) => {
        result.push({ ders, konu });
      });
    });
    return result;
  }, [selectedTopics]);

  // Active Camp Title
  const activeCampTitle = useMemo(() => {
    if (campMode === 'READY') {
      const preset = READY_MADE_CAMPS.find((p) => p.id === selectedReadyCampId);
      return preset?.title || customCampTitle || '90 Günde TYT Bitirme Kampı';
    }
    return customCampTitle.trim() || `${currentExam.name} Kişisel Kampı`;
  }, [campMode, selectedReadyCampId, customCampTitle, currentExam]);

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
      campTitle: activeCampTitle,
    });
  }, [currentExam, flattenedSelectedTopics, startDate, targetEndDate, dailyHours, preferredTimeSlot, activeCampTitle]);

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
        setAiPlan(items.map((it) => ({ ...it, campTitle: activeCampTitle })));
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

  // Final Save & Enroll into Active Camps
  const handleFinishAndApply = () => {
    if (finalPlan.length === 0) {
      showToast('⚠️ Lütfen önce en az 1 konu seçin!');
      return;
    }

    const campId = `camp_${Date.now()}`;
    const taggedItems = finalPlan.map((it) => ({
      ...it,
      campId,
      campTitle: activeCampTitle,
    }));

    // Register into Active Camps
    const newCamp: ActiveCamp = {
      id: campId,
      presetKey: campMode === 'READY' ? selectedReadyCampId : undefined,
      title: activeCampTitle,
      category: currentExam.category,
      startDate,
      endDate: targetEndDate,
      dailyHours,
      totalTopics: flattenedSelectedTopics.length,
      itemCount: taggedItems.length,
      createdAt: Date.now(),
    };

    try {
      const uid = currentUserId || auth.currentUser?.uid || '';
      const storageKey = `edumind_active_camps_${uid}`;
      const existingStr = localStorage.getItem(storageKey);
      let campsList: ActiveCamp[] = [];
      if (existingStr) {
        try {
          campsList = JSON.parse(existingStr);
        } catch {}
      }
      campsList = [newCamp, ...campsList.filter((c) => c.title !== activeCampTitle)];
      localStorage.setItem(storageKey, JSON.stringify(campsList));
      window.dispatchEvent(new Event('edumind_camps_updated'));
    } catch (e) {
      console.warn('Error saving active camp:', e);
    }

    // Schedule daily study notification at user's preferred time slot
    scheduleCampStudyReminder(activeCampTitle, preferredTimeSlot);

    onAddMultipleItems(taggedItems, replaceExisting);
    const timeSlotLabel =
      preferredTimeSlot === 'morning'
        ? '09:30'
        : preferredTimeSlot === 'afternoon'
        ? '14:00'
        : preferredTimeSlot === 'night'
        ? '20:30'
        : '18:00';
    showToast(`🎉 "${activeCampTitle}" programınıza eklendi! Her gün saat ${timeSlotLabel}'da çalışma hatırlatıcınız çalacak.`);
    onClose();
    if (setActiveTab) {
      setActiveTab('schedule');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-center justify-center p-2.5 sm:p-4 pb-20 sm:pb-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-hidden font-sans"
    >
      <div className="bg-surface dark:bg-slate-900 border border-card-border rounded-3xl max-w-xl w-full p-4 sm:p-5 shadow-2xl relative my-auto max-h-[85vh] sm:max-h-[88vh] flex flex-col space-y-3.5 text-text-main overflow-hidden">
        {/* Header with Close */}
        <div className="flex items-center justify-between gap-2.5 border-b border-card-border pb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
              <span className="material-symbols-outlined text-xl">event_available</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-text-main leading-tight tracking-tight truncate">
                  Akıllı Sınav Kampı
                </h3>
                <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full border border-primary/20 shrink-0">
                  Adım {step}/4
                </span>
              </div>
              <p className="text-[11px] text-text-muted truncate mt-0.5">
                {step === 1 && 'Hazır sınav kampı seçin veya kendi hedefinizi belirleyin.'}
                {step === 2 && 'Çalışmak istediğiniz ders ve konuları işaretleyin.'}
                {step === 3 && 'Kamp süresi ve günlük hedef saatinizi belirleyin.'}
                {step === 4 && 'Planlanan ders programınızı önizleyin ve onaylayın.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-main p-1 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer shrink-0"
            aria-label="Kapat"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Step Indicator Pills (Compact) */}
        <div className="grid grid-cols-4 gap-1.5 text-[10px] font-black select-none shrink-0">
          {[
            { s: 1, label: '1. Kamp' },
            { s: 2, label: '2. Konular' },
            { s: 3, label: '3. Süre' },
            { s: 4, label: '4. Önizle' },
          ].map((item) => (
            <div
              key={item.s}
              className={`py-1 px-1 rounded-lg text-center transition-all border flex items-center justify-center gap-1 ${
                step === item.s
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : step > item.s
                  ? 'bg-primary/10 text-primary border-primary/30 font-bold'
                  : 'bg-surface-container-low text-text-muted border-card-border'
              }`}
            >
              <span>{item.label}</span>
              {step > item.s && (
                <span className="material-symbols-outlined text-xs">check</span>
              )}
            </div>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {/* Step 1: Ready-Made vs Custom Camps */}
          {step === 1 && (
            <div className="space-y-3">
              {/* Top Mode Switcher */}
              <div className="grid grid-cols-2 p-1 bg-surface-container-low dark:bg-slate-800/80 rounded-xl border border-card-border gap-1">
                <button
                  type="button"
                  onClick={() => setCampMode('READY')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    campMode === 'READY'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">workspace_premium</span>
                  <span>Hazır Sınav Kampları</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCampMode('CUSTOM')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    campMode === 'CUSTOM'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">tune</span>
                  <span>Özel Kamp Oluştur</span>
                </button>
              </div>

              {/* A. HAZIR SINAV KAMPLARI (Compact Cards) */}
              {campMode === 'READY' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-black text-text-muted uppercase tracking-wider">
                      Popüler Kamplar:
                    </span>
                    <span className="font-bold text-primary">Tüm branşları otomatik yükler</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {READY_MADE_CAMPS.map((camp) => {
                      const isSelected = selectedReadyCampId === camp.id;
                      return (
                        <div
                          key={camp.id}
                          onClick={() => applyReadyMadeCamp(camp)}
                          className={`p-2.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-1.5 group ${
                            isSelected
                              ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-xs ring-1 ring-primary/30'
                              : 'border-card-border bg-surface-container-low hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xl">{camp.icon}</span>
                              <div className="min-w-0">
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-primary/10 text-primary border border-primary/20">
                                  {camp.badge}
                                </span>
                                <h5 className="font-black text-xs text-text-main group-hover:text-primary transition-colors truncate mt-0.5">
                                  {camp.title}
                                </h5>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="material-symbols-outlined text-primary text-base shrink-0">
                                check_circle
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-text-muted leading-tight line-clamp-2">
                            {camp.description}
                          </p>

                          <div className="pt-1.5 border-t border-card-border/60 flex items-center justify-between text-[10px] font-black text-primary">
                            <span>{camp.durationDays} Gün • Günde {camp.dailyHours} Saat</span>
                            <span className="text-text-muted group-hover:text-primary transition-colors">
                              Seç →
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* B. KENDİ ÖZEL KAMPINI OLUŞTUR (Compact) */
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-text-main mb-1">
                      Kamp Başlığı Belirleyin (İsteğe Bağlı):
                    </label>
                    <input
                      type="text"
                      value={customCampTitle}
                      onChange={(e) => setCustomCampTitle(e.target.value)}
                      placeholder="Örn: 45 Günde Geometri & Problem Kampı"
                      className="w-full bg-surface-container-low border border-card-border rounded-xl px-3 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: 'ALL', label: 'Tüm Sınavlar' },
                      { id: 'EXAM', label: 'YKS / LGS / KPSS' },
                      { id: 'SINIF', label: 'MEB Okul (9-12)' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCategoryFilter(tab.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          categoryFilter === tab.id
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-surface-container-low text-text-muted hover:text-text-main border border-card-border'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Curriculum Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {EXAM_CURRICULUM_DATA.filter((e) => {
                      if (categoryFilter === 'EXAM') return e.category !== 'SINIF';
                      if (categoryFilter === 'SINIF') return e.category === 'SINIF';
                      return true;
                    }).map((exam) => {
                      const isSelected = selectedExamId === exam.id;
                      return (
                        <div
                          key={exam.id}
                          onClick={() => setSelectedExamId(exam.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-1 group ${
                            isSelected
                              ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
                              : 'border-card-border bg-surface-container-low hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h5 className="font-black text-xs text-text-main group-hover:text-primary transition-colors">
                              {exam.name}
                            </h5>
                            {isSelected && (
                              <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                            )}
                          </div>
                          <p className="text-[10px] text-text-muted line-clamp-1">{exam.description}</p>
                          <div className="pt-1 border-t border-card-border text-[10px] font-bold text-primary flex items-center justify-between">
                            <span>{exam.dersler.length} Branş Ders</span>
                            <span className="text-text-muted">Seç →</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Subject & Topic Selection (Compact, Mobile-Friendly) */}
          {step === 2 && (
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div>
                  <h4 className="text-[11px] font-black text-text-muted uppercase tracking-wider">
                    2. Çalışmak İstediğiniz Konuları İşaretleyin:
                  </h4>
                  <p className="text-xs text-text-muted">
                    Seçilen konu sayısı: <strong className="text-primary font-black">{totalSelectedCount}</strong>
                  </p>
                </div>

                {/* Compact Search filter */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Konu ara..."
                    className="bg-surface-container-low border border-card-border rounded-lg px-2.5 py-1 pl-7 text-xs text-text-main focus:outline-none focus:border-primary w-full sm:w-44 font-medium"
                  />
                  <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-sm">
                    search
                  </span>
                </div>
              </div>

              {/* Subject horizontal tabs with counters */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                {currentExam.dersler.map((d) => {
                  const count = (selectedTopics[d.ders] || []).length;
                  return (
                    <button
                      key={d.ders}
                      type="button"
                      onClick={() => setActiveDersTab(d.ders)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 border ${
                        activeDersTab === d.ders
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-surface-container-low text-text-muted border-card-border hover:text-text-main'
                      }`}
                    >
                      <span>{d.ders}</span>
                      {count > 0 && (
                        <span
                          className={`px-1 py-0.1 rounded-full text-[9px] font-black ${
                            activeDersTab === d.ders ? 'bg-white text-primary' : 'bg-primary/20 text-primary'
                          }`}
                        >
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
                  <div className="bg-surface-container-low dark:bg-slate-800/80 p-3 rounded-2xl border border-card-border space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-card-border">
                      <span className="font-black text-xs text-text-main flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-primary text-sm">menu_book</span>
                        <span>{currentSubject.ders} ({selectedInCurrentDers.length}/{currentSubject.konular.length})</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => selectAllTopicsInDers(currentSubject.ders, currentSubject.konular)}
                          className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          Tümünü Seç
                        </button>
                        <span className="text-card-border text-xs">•</span>
                        <button
                          type="button"
                          onClick={() => clearAllTopicsInDers(currentSubject.ders)}
                          className="text-[10px] font-bold text-text-muted hover:text-rose-500 cursor-pointer"
                        >
                          Temizle
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                      {filteredKonular.map((konu) => {
                        const isChecked = selectedInCurrentDers.includes(konu);
                        return (
                          <label
                            key={konu}
                            onClick={() => toggleTopic(currentSubject.ders, konu)}
                            className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer select-none text-xs ${
                              isChecked
                                ? 'bg-card-bg border-primary text-text-main shadow-xs font-black'
                                : 'bg-card-bg/60 border-card-border text-text-muted hover:border-primary/40 font-medium'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 rounded text-primary border-card-border focus:ring-primary shrink-0 cursor-pointer"
                            />
                            <span className="truncate leading-tight">{konu}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 3: Dates & Daily Hours Stepper (Compact & Clean) */}
          {step === 3 && (
            <div className="space-y-3">
              <h4 className="text-[11px] font-black text-text-muted uppercase tracking-wider">
                3. Kamp Süresi ve Günlük Hedef Saatinizi Belirleyin:
              </h4>

              {/* Dates Card */}
              <div className="bg-surface-container-low dark:bg-slate-800/80 p-3 rounded-2xl border border-card-border space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-text-main mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-primary">calendar_today</span>
                      <span>Başlangıç Tarihi:</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-card-bg border border-card-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-text-main mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-rose-500">flag</span>
                      <span>Hedef Bitiş Tarihi:</span>
                    </label>
                    <input
                      type="date"
                      value={targetEndDate}
                      min={startDate}
                      onChange={(e) => setTargetEndDate(e.target.value)}
                      className="w-full bg-card-bg border border-card-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-text-main focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl flex items-center justify-between text-xs text-primary font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">timer</span>
                    <span>Toplam Kamp Süresi:</span>
                  </span>
                  <span className="text-xs font-black bg-primary text-white px-2.5 py-0.5 rounded-full">
                    {campaignDays} Gün
                  </span>
                </div>
              </div>

              {/* Compact Daily Hours Stepper ([-] 1 Saat [+]) */}
              <div className="bg-surface-container-low dark:bg-slate-800/80 p-3 rounded-2xl border border-card-border space-y-2">
                <label className="block text-[11px] font-bold text-text-main flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-primary">fitness_center</span>
                  <span>Günlük Hedef Çalışma Temposu:</span>
                </label>

                <div className="flex items-center justify-center gap-4 py-2.5 bg-card-bg rounded-xl border border-card-border">
                  <button
                    type="button"
                    disabled={dailyHours <= 1}
                    onClick={() => setDailyHours((h) => Math.max(1, h - 1))}
                    className="w-9 h-9 rounded-xl bg-surface-container-low hover:bg-surface-container text-text-main flex items-center justify-center text-xl font-black disabled:opacity-30 disabled:cursor-not-allowed border border-card-border cursor-pointer transition-all active:scale-95 shadow-xs"
                    aria-label="Azalt"
                  >
                    -
                  </button>

                  <div className="text-center min-w-[120px]">
                    <span className="text-2xl font-black text-primary tracking-tight block">
                      {dailyHours} Saat
                    </span>
                    <span className="text-[10px] font-bold text-text-muted block">
                      Günde ~{dailyHours * 45} dk seans
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={dailyHours >= 10}
                    onClick={() => setDailyHours((h) => Math.min(10, h + 1))}
                    className="w-9 h-9 rounded-xl bg-primary hover:bg-primary/90 text-white flex items-center justify-center text-xl font-black disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 shadow-xs"
                    aria-label="Artır"
                  >
                    +
                  </button>
                </div>

                {/* Time slot preference (Compact) */}
                <div className="pt-1">
                  <label className="block text-[10px] font-bold text-text-muted mb-1">
                    Bildirim ve Çalışma Saat Dilimi Tercihi:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-bold">
                    {[
                      { id: 'morning', label: 'Sabah (09:30)', icon: 'wb_sunny' },
                      { id: 'afternoon', label: 'Öğle (14:00)', icon: 'light_mode' },
                      { id: 'evening', label: 'Akşam (18:00)', icon: 'wb_twilight' },
                      { id: 'night', label: 'Gece (20:30)', icon: 'bedtime' },
                    ].map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setPreferredTimeSlot(slot.id)}
                        className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-all cursor-pointer text-[11px] ${
                          preferredTimeSlot === slot.id
                            ? 'bg-primary text-white border-primary shadow-xs font-black'
                            : 'bg-card-bg text-text-muted border-card-border hover:border-primary/40'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xs">{slot.icon}</span>
                        <span>{slot.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Preview & Confirm Plan (Compact) */}
          {step === 4 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-[11px] font-black text-text-muted uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-primary">auto_awesome</span>
                  <span>4. Kamp Önizlemesi</span>
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
                  <span>{isAiGenerating ? 'AI Hazırlıyor...' : 'Yeniden Oluştur'}</span>
                </button>
              </div>

              {/* Compact Summary Card */}
              <div className="bg-gradient-to-tr from-primary/10 via-indigo-600/10 to-purple-600/10 border border-primary/30 p-3 rounded-2xl space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1.5">
                  <span className="font-black text-xs sm:text-sm text-text-main flex items-center gap-1.5">
                    <span>🚀 {activeCampTitle}</span>
                  </span>
                  <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    {finalPlan.length} Görev Planlandı
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-xs pt-0.5">
                  <div className="bg-card-bg/80 p-2 rounded-xl border border-card-border text-center">
                    <span className="text-text-muted text-[9px] block">Konu</span>
                    <strong className="text-text-main font-black text-xs">{totalSelectedCount}</strong>
                  </div>
                  <div className="bg-card-bg/80 p-2 rounded-xl border border-card-border text-center">
                    <span className="text-text-muted text-[9px] block">Süre</span>
                    <strong className="text-text-main font-black text-xs">{campaignDays} Gün</strong>
                  </div>
                  <div className="bg-card-bg/80 p-2 rounded-xl border border-card-border text-center">
                    <span className="text-text-muted text-[9px] block">Günde</span>
                    <strong className="text-text-main font-black text-xs">{dailyHours} Saat</strong>
                  </div>
                </div>
              </div>

              {/* Replace / Append Option */}
              <div className="flex items-center justify-between p-2.5 bg-surface-container-low dark:bg-slate-800/80 rounded-xl border border-card-border text-[11px]">
                <span className="text-text-muted font-bold">Mevcut program ile birleştir:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setReplaceExisting(true)}
                    className={`px-2 py-0.5 rounded-md font-black text-[10px] transition-all cursor-pointer ${
                      replaceExisting ? 'bg-primary text-white shadow-xs' : 'bg-card-bg text-text-muted border border-card-border'
                    }`}
                  >
                    Yenile
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplaceExisting(false)}
                    className={`px-2 py-0.5 rounded-md font-black text-[10px] transition-all cursor-pointer ${
                      !replaceExisting ? 'bg-primary text-white shadow-xs' : 'bg-card-bg text-text-muted border border-card-border'
                    }`}
                  >
                    Üzerine Ekle
                  </button>
                </div>
              </div>

              {/* Preview Day Filter */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-xs font-bold">
                {['ALL', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setPreviewDayFilter(day)}
                    className={`px-2 py-0.5 rounded-md text-[10px] whitespace-nowrap transition-all cursor-pointer ${
                      previewDayFilter === day
                        ? 'bg-primary text-white font-black'
                        : 'bg-surface-container-low text-text-muted border border-card-border'
                    }`}
                  >
                    {day === 'ALL' ? 'Tümü' : day}
                  </button>
                ))}
              </div>

              {/* Program Items List Preview */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {finalPlan
                  .filter((it) => (previewDayFilter === 'ALL' ? true : it.gun === previewDayFilter))
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-container-low dark:bg-slate-800/60 border border-card-border p-2 rounded-xl flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-black flex items-center justify-center shrink-0 text-[10px]">
                          {item.gun}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-[10px] text-primary">{item.ders}</span>
                            <span className="text-[9px] bg-card-bg border border-card-border px-1.5 py-0.2 rounded text-text-muted font-bold">
                              {item.saat}
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-text-main truncate">{item.konu}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                        Hazır
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Modal Bottom Footer Actions: ALWAYS visible and elevated above navigation bar */}
        <div className="shrink-0 pt-2.5 pb-1 border-t border-card-border flex items-center justify-between gap-2.5 bg-surface dark:bg-slate-900">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev - 1) as any)}
              className="px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-text-main font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Geri</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-text-muted font-bold text-xs transition-all cursor-pointer"
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
              className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>{step === 3 ? 'AI Kampını Oluştur' : 'İleri'}</span>
              <span className="material-symbols-outlined text-sm">
                {step === 3 ? 'auto_awesome' : 'arrow_forward'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishAndApply}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>Programı Başlat 🚀</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
