import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SoruKaydi, ActiveTab } from '../types';
import {
  getDueQuestionsToday,
  getEbbinghausLevelTitle,
  getNextEbbinghausDate,
} from '../lib/ebbinghausUtils';
import { FormattedMathText } from './FormattedMathText';

interface TodayRepetitionCardProps {
  questions: SoruKaydi[];
  onSelectQuestion: (q: SoruKaydi) => void;
  onUpdateQuestions?: (qs: SoruKaydi[]) => void;
  onStartQuiz?: (q: SoruKaydi) => void;
  onStartSession?: (qs: SoruKaydi[]) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const TodayRepetitionCard: React.FC<TodayRepetitionCardProps> = ({
  questions,
  onSelectQuestion,
  onUpdateQuestions,
  onStartQuiz,
  onStartSession,
  setActiveTab,
}) => {
  const [toastAlert, setToastAlert] = useState<string | null>(null);

  const dueQuestions = getDueQuestionsToday(questions);

  const showToast = (msg: string) => {
    setToastAlert(msg);
    setTimeout(() => setToastAlert(null), 3000);
  };

  const handleMarkSolved = (q: SoruKaydi, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = questions.map((item) =>
      item.id === q.id ? { ...item, isSolved: true } : item
    );
    if (onUpdateQuestions) {
      onUpdateQuestions(updated);
    }
    showToast('✨ Soru "Çözüldü" olarak kaydedildi!');
  };

  const handlePostponeToTomorrow = (q: SoruKaydi, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentRepeat = q.repeatCount || 0;
    const nextDate = getNextEbbinghausDate(currentRepeat + 1);
    const updated = questions.map((item) =>
      item.id === q.id
        ? {
            ...item,
            repeatCount: currentRepeat + 1,
            ebbinghausTarihi: nextDate,
          }
        : item
    );
    if (onUpdateQuestions) {
      onUpdateQuestions(updated);
    }
    showToast(`🔁 Soru takvimde ertelendi (${currentRepeat + 1}. Tekrar)`);
  };

  // Group due questions by subject
  const subjectBreakdown = dueQuestions.reduce((acc, q) => {
    const ders = q.ders || 'Genel';
    acc[ders] = (acc[ders] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <section className="bg-card-bg border border-card-border rounded-3xl p-5 shadow-xs space-y-4 relative overflow-hidden">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastAlert && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-3 right-3 left-3 z-30 bg-slate-900 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-xl border border-slate-700 flex items-center justify-between pointer-events-none"
          >
            <span>{toastAlert}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Clean Header */}
      <div className="flex flex-col xs:flex-row sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-card-border gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black shrink-0">
            <span className="material-symbols-outlined text-2xl">history_toggle_off</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-extrabold text-sm sm:text-base text-text-main leading-tight">
              Bugün Tekrar Etmen Gerekenler
            </h3>
            <p className="text-[11px] sm:text-xs text-text-muted leading-tight mt-0.5">
              Ebbinghaus unutma eğrisine göre zamanı gelen sorular
            </p>
          </div>
        </div>

        {/* Counter Badge & See All Button */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
          <button
            onClick={() => setActiveTab('errorPool')}
            className="bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs px-3 py-1.5 rounded-xl border border-primary/20 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
          >
            <span>Tümünü Gör</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black transition-all whitespace-nowrap shadow-2xs ${
              dueQuestions.length > 0
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {dueQuestions.length > 0 ? `${dueQuestions.length} Soru Bekliyor` : 'Tamamlandı 🎉'}
          </span>
        </div>
      </div>

      {/* Content Condition */}
      {dueQuestions.length > 0 ? (
        <div className="space-y-4">
          {/* Sleek Retention Bar & Subject Summary */}
          <div className="bg-surface-container-low p-3.5 rounded-2xl border border-card-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 font-bold text-text-main">
              <span className="material-symbols-outlined text-primary text-lg">insights</span>
              <span>Hedef Hafıza Kalıcılığı: <strong className="text-primary font-black">%85</strong></span>
            </div>

            {/* Subject Summary Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.entries(subjectBreakdown).map(([ders, count]) => (
                <span
                  key={ders}
                  className="bg-card-bg border border-card-border px-2.5 py-1 rounded-xl text-[11px] font-bold text-text-main"
                >
                  {ders}: <strong className="text-primary">{count}</strong>
                </span>
              ))}
            </div>
          </div>

          {/* Cards Grid (Showing maximum last 2 questions to prevent crowding) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {dueQuestions.slice(0, 2).map((q) => (
              <div
                key={q.id}
                onClick={() => {
                  onSelectQuestion(q);
                  setActiveTab('solution');
                }}
                className="bg-card-bg border border-card-border hover:border-primary p-4 rounded-2xl flex flex-col justify-between transition-all shadow-2xs hover:shadow-xs cursor-pointer group space-y-3"
              >
                {/* Header info */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-primary uppercase bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">
                    {q.ders}
                  </span>
                  <span className="text-[10px] font-bold text-text-muted bg-surface-container-low px-2 py-0.5 rounded-lg border border-card-border">
                    {getEbbinghausLevelTitle(q.repeatCount || 0)}
                  </span>
                </div>

                {/* Question preview */}
                <div className="text-xs font-semibold text-text-main line-clamp-2 leading-relaxed group-hover:text-primary transition-colors">
                  <FormattedMathText text={q.ocrMetin} />
                </div>

                {/* Card Action Row */}
                <div className="flex items-center justify-between pt-2.5 border-t border-card-border text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleMarkSolved(q, e)}
                      className="p-1.5 rounded-xl text-text-muted hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                      title="Çözüldü Olarak İşaretle"
                    >
                      <span className="material-symbols-outlined text-base">check_circle</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handlePostponeToTomorrow(q, e)}
                      className="p-1.5 rounded-xl text-text-muted hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                      title="Yarına Ertele"
                    >
                      <span className="material-symbols-outlined text-base">schedule</span>
                    </button>
                  </div>

                  <span className="font-extrabold text-[11px] text-primary group-hover:underline flex items-center gap-0.5">
                    <span>Soruyu Çöz</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {dueQuestions.length > 2 && (
            <p className="text-xs text-center text-text-muted font-medium pt-0.5">
              + {dueQuestions.length - 2} soru daha tekrar listesinde bekliyor.
            </p>
          )}

          {/* Action Footer */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <button
              onClick={() => {
                if (onStartSession && dueQuestions.length > 0) {
                  onStartSession(dueQuestions);
                } else if (onStartQuiz && dueQuestions.length > 0) {
                  onStartQuiz(dueQuestions[0]);
                } else {
                  setActiveTab('errorPool');
                }
              }}
              className="w-full sm:w-auto flex-1 bg-primary hover:bg-primary-hover text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">play_arrow</span>
              <span>Tekrar Seansını Başlat ({dueQuestions.length} Soru)</span>
            </button>

            <button
              onClick={() => setActiveTab('errorPool')}
              className="w-full sm:w-auto px-5 py-3.5 bg-surface-container-low hover:bg-card-border border border-card-border text-xs font-extrabold text-text-main rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
            >
              <span>Tümünü Gör ({dueQuestions.length})</span>
              <span className="material-symbols-outlined text-base text-primary">arrow_forward</span>
            </button>
          </div>
        </div>
      ) : (
        /* Empty / All Reviewed State */
        <div className="bg-surface-container-low/60 border border-card-border rounded-2xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-2xl">task_alt</span>
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-sm text-text-main">
              Harika! Bugün Tekrar Edilecek Soru Kalmadı
            </h4>
            <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
              Bugünkü Ebbinghaus aralıklı tekrar hedeflerini tamamladın. Yanlış soruların hafızana başarıyla yerleşiyor.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('errorPool')}
            className="bg-card-bg border border-card-border text-text-main font-bold text-xs px-4 py-2 rounded-xl hover:border-primary transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
          >
            <span className="material-symbols-outlined text-base">collections_bookmark</span>
            <span>Yanlış Havuzunu İncele ({questions.length})</span>
          </button>
        </div>
      )}
    </section>
  );
};
