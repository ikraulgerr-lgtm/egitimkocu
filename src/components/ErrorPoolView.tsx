import React, { useState } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'motion/react';
import { SoruKaydi, ActiveTab } from '../types';
import { FormattedMathText } from './FormattedMathText';
import { isQuestionDueToday, getDueQuestionsToday, getWeeklyEbbinghausBreakdown } from '../lib/ebbinghausUtils';
import { FlashcardPracticeModal } from './FlashcardPracticeModal';

interface ErrorPoolViewProps {
  questions: SoruKaydi[];
  onSelectQuestion: (q: SoruKaydi) => void;
  onUpdateQuestions?: (qs: SoruKaydi[]) => void;
  onStartQuiz?: (q: SoruKaydi) => void;
  onStartSession?: (qs: SoruKaydi[]) => void;
  setActiveTab: (tab: ActiveTab) => void;
  onRewardXp?: (amount: number) => void;
}

export const ErrorPoolView: React.FC<ErrorPoolViewProps> = ({
  questions,
  onSelectQuestion,
  onUpdateQuestions,
  onStartQuiz,
  onStartSession,
  setActiveTab,
  onRewardXp,
}) => {
  const [filter, setFilter] = useState<'all' | 'today' | 'kavram' | 'islem'>('all');
  const [toastAlert, setToastAlert] = useState<string | null>(null);
  const [activeFlashcardQuestion, setActiveFlashcardQuestion] = useState<SoruKaydi | null>(null);
  const [isAllFlashcardsMode, setIsAllFlashcardsMode] = useState<boolean>(false);

  const showNotification = (msg: string) => {
    setToastAlert(msg);
    setTimeout(() => setToastAlert(null), 3000);
  };

  const handleSolveQuestion = (question: SoruKaydi) => {
    const isNowSolved = !question.isSolved;
    const updated = questions.map((q) =>
      q.id === question.id ? { ...q, isSolved: isNowSolved } : q
    );
    if (onUpdateQuestions) {
      onUpdateQuestions(updated);
    }
    if (isNowSolved) {
      showNotification('✨ Soru "Çözüldü" olarak işaretlendi! (+30 XP)');
    } else {
      showNotification('ℹ️ Soru tekrar "Çözülmedi" durumuna getirildi.');
    }
  };

  const handleRepeatQuestion = (question: SoruKaydi) => {
    const currentRepeat = question.repeatCount || 0;
    const updated = questions.map((q) =>
      q.id === question.id
        ? {
            ...q,
            repeatCount: currentRepeat + 1,
            isSolved: false,
            ebbinghausTarihi: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          }
        : q
    );
    if (onUpdateQuestions) {
      onUpdateQuestions(updated);
    }
    showNotification(`🔁 Soru yarınki tekrar seansına eklendi! (${currentRepeat + 1}. Tekrar)`);
  };

  const [selectedDersFilter, setSelectedDersFilter] = useState<string | null>(null);

  const dueTodayQuestions = getDueQuestionsToday(questions);

  const filteredQuestions = questions.filter((q) => {
    if (selectedDersFilter && q.ders !== selectedDersFilter) return false;
    if (filter === 'today') return isQuestionDueToday(q);
    if (filter === 'kavram') return q.hataTuru === 'Kavram Yanılgısı';
    if (filter === 'islem') return q.hataTuru === 'İşlem Hatası';
    return true;
  });

  // Calculate subject counts
  const dersMap = questions.reduce((acc, q) => {
    const d = q.ders || 'Genel';
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-32 animate-fadeIn relative">
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toastAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-xl border border-slate-700/80 flex items-center gap-2 pointer-events-none"
          >
            <span>{toastAlert}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Main Actions Bar */}
      <div className="bg-card-bg border border-card-border rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-primary/10 text-primary border border-primary/20 mb-1">
              <span className="material-symbols-outlined text-xs">auto_awesome</span>
              <span>Aralıklı Tekrar & Unutma Eğrisi</span>
            </div>
            <h2 className="font-extrabold text-xl text-text-main tracking-tight">Yanlış Soru Havuzu</h2>
            <p className="text-xs text-text-muted">
              Çözümünü öğrendiğin soruları aralıklı olarak tekrar et ve kalıcı hafızaya al.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (questions.length > 0) {
                  if (onStartSession) {
                    onStartSession(questions);
                  } else if (onStartQuiz) {
                    onStartQuiz(questions[0]);
                  }
                } else {
                  alert('Tekrar edilecek soru bulunmuyor. Yeni soru ekleyin!');
                }
              }}
              className="bg-primary hover:bg-primary-hover text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl transition-all shadow-md cursor-pointer flex items-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">play_arrow</span>
              <span>Tekrar Seansı ({questions.length})</span>
            </button>

            <button
              onClick={() => {
                if (filteredQuestions.length > 0) {
                  setActiveFlashcardQuestion(filteredQuestions[0]);
                  setIsAllFlashcardsMode(true);
                } else if (questions.length > 0) {
                  setActiveFlashcardQuestion(questions[0]);
                  setIsAllFlashcardsMode(true);
                } else {
                  alert('Pratik yapmak için henüz soru bulunmuyor.');
                }
              }}
              className="bg-surface-container-low border border-card-border text-text-main hover:bg-card-border font-bold text-xs px-3.5 py-2.5 rounded-2xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base text-indigo-500">style</span>
              <span>Kavram Kartları</span>
            </button>
          </div>
        </div>

        {/* Compact Weekly Schedule Strip */}
        <div className="pt-3 border-t border-card-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-text-muted flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-primary">calendar_today</span>
              Haftalık Tekrar Dağılımı
            </span>
            <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
              Ebbinghaus Eğrisi
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {[
              { day: 'Pzt', count: Math.max(1, Math.floor(questions.length * 0.4)), active: true },
              { day: 'Sal', count: Math.max(0, Math.floor(questions.length * 0.2)), active: false },
              { day: 'Çar', count: Math.max(1, Math.floor(questions.length * 0.3)), active: false },
              { day: 'Per', count: Math.max(0, Math.floor(questions.length * 0.1)), active: false },
              { day: 'Cum', count: Math.max(2, Math.floor(questions.length * 0.5)), active: false },
              { day: 'Cmt', count: Math.max(1, Math.floor(questions.length * 0.2)), active: false },
              { day: 'Paz', count: Math.max(0, Math.floor(questions.length * 0.1)), active: false },
            ].map((item, idx) => (
              <div
                key={idx}
                className={`p-1.5 rounded-xl border text-center transition-all ${
                  item.active
                    ? 'bg-primary/10 border-primary/40 text-primary font-bold'
                    : 'bg-surface-container-low/50 border-card-border/60 text-text-muted'
                }`}
              >
                <p className="text-[9px] uppercase font-bold">{item.day}</p>
                <p className="text-xs font-black text-text-main">{item.count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Subject Filter Row */}
      <div className="space-y-3">
        {/* Main Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setFilter('all')}
              className={`px-3.5 py-1.5 rounded-full font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-card-bg text-text-muted border border-card-border hover:text-text-main'
              }`}
            >
              Tümü ({questions.length})
            </button>
            <button
              onClick={() => setFilter('today')}
              className={`px-3.5 py-1.5 rounded-full font-bold text-xs whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                filter === 'today'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-card-bg text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/10'
              }`}
            >
              <span className="material-symbols-outlined text-xs">schedule</span>
              <span>Bugün ({dueTodayQuestions.length})</span>
            </button>
            <button
              onClick={() => setFilter('kavram')}
              className={`px-3.5 py-1.5 rounded-full font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                filter === 'kavram'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-card-bg text-text-muted border border-card-border hover:text-text-main'
              }`}
            >
              Kavram Hataları
            </button>
            <button
              onClick={() => setFilter('islem')}
              className={`px-3.5 py-1.5 rounded-full font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                filter === 'islem'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-card-bg text-text-muted border border-card-border hover:text-text-main'
              }`}
            >
              İşlem Hataları
            </button>
          </div>

          {/* Subject Filter Dropdown Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {Object.keys(dersMap).length > 0 && (
              <span className="text-[11px] font-bold text-text-muted mr-1">Ders:</span>
            )}
            {Object.entries(dersMap).map(([subject, count]) => {
              const isSelected = selectedDersFilter === subject;
              return (
                <button
                  key={subject}
                  onClick={() => setSelectedDersFilter(isSelected ? null : subject)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-primary/15 text-primary border border-primary/40'
                      : 'bg-surface-container-low text-text-muted border border-card-border hover:text-text-main'
                  }`}
                >
                  <span>{subject}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Subject Filter Indicator */}
        {selectedDersFilter && (
          <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl flex items-center justify-between text-xs">
            <span className="font-bold text-text-main">
              Filtrelenen Ders: <strong className="text-primary">{selectedDersFilter}</strong>
            </span>
            <button
              onClick={() => setSelectedDersFilter(null)}
              className="text-primary font-bold hover:underline cursor-pointer"
            >
              Filtreyi Temizle
            </button>
          </div>
        )}
      </div>

      {/* Saved Questions List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-base text-text-main">
            Havuzdaki Sorular ({filteredQuestions.length})
          </h3>
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="bg-card-bg border border-card-border rounded-3xl p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">inbox</span>
            </div>
            <h4 className="font-extrabold text-base text-text-main">Yanlış Havuzunuz Boş</h4>
            <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
              Bu filtreye uygun soru bulunmuyor. Ana sayfadan kamera ile soru ekleyebilirsiniz.
            </p>
            <button
              onClick={() => setActiveTab('home')}
              className="mt-1 bg-primary text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl hover:bg-primary-hover transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">add_a_photo</span>
              <span>Soru Ekle</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredQuestions.map((q) => (
              <SwipeableQuestionCard
                key={q.id}
                question={q}
                onSelect={() => {
                  onSelectQuestion(q);
                  setActiveTab('solution');
                }}
                onSolve={handleSolveQuestion}
                onRepeat={handleRepeatQuestion}
                onStartQuiz={onStartQuiz}
                onOpenFlashcards={(question) => {
                  setActiveFlashcardQuestion(question);
                  setIsAllFlashcardsMode(false);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Future Repetition Calendar Schedule (Dynamically calculated based on Ebbinghaus Forgetting Curve) */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-extrabold text-base text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
            <span>Haftalık Tekrar Dağılımı</span>
          </h3>
          <span className="text-[11px] font-bold text-text-muted bg-surface-container-low px-2.5 py-0.5 rounded-full border border-card-border">
            🧠 Ebbinghaus Unutma Eğrisi
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {getWeeklyEbbinghausBreakdown(questions).map((item, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-2xl border text-center transition-all ${
                item.isToday
                  ? 'bg-primary/10 border-primary text-primary font-bold shadow-2xs ring-1 ring-primary/30'
                  : item.count > 0
                  ? 'bg-card-bg border-card-border text-text-main'
                  : 'bg-surface-container-low/50 border-card-border/30 opacity-60'
              }`}
            >
              <span className={`block text-[10px] font-bold ${item.isToday ? 'text-primary font-black' : 'text-text-muted'}`}>
                {item.dayName}
              </span>
              <span className={`block text-sm font-black mt-0.5 ${item.isToday ? 'text-primary' : 'text-text-main'}`}>
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Flashcard Practice Modal */}
      {activeFlashcardQuestion && (
        <FlashcardPracticeModal
          question={activeFlashcardQuestion}
          allQuestions={isAllFlashcardsMode ? filteredQuestions : [activeFlashcardQuestion]}
          onClose={() => {
            setActiveFlashcardQuestion(null);
            setIsAllFlashcardsMode(false);
          }}
          onRewardXp={onRewardXp}
        />
      )}
    </div>
  );
};

interface SwipeableQuestionCardProps {
  question: SoruKaydi;
  onSelect: () => void;
  onSolve: (q: SoruKaydi) => void;
  onRepeat: (q: SoruKaydi) => void;
  onStartQuiz?: (q: SoruKaydi) => void;
  onOpenFlashcards?: (q: SoruKaydi) => void;
}

const SwipeableQuestionCard: React.FC<SwipeableQuestionCardProps> = ({
  question,
  onSelect,
  onSolve,
  onRepeat,
  onStartQuiz,
  onOpenFlashcards,
}) => {
  const x = useMotionValue(0);

  // Smooth transforms for background indicators during drag
  const solveOpacity = useTransform(x, [15, 75], [0, 1]);
  const solveScale = useTransform(x, [15, 75], [0.8, 1]);

  const repeatOpacity = useTransform(x, [-75, -15], [1, 0]);
  const repeatScale = useTransform(x, [-75, -15], [1, 0.8]);

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 65;
    if (info.offset.x > threshold || info.velocity.x > 350) {
      onSolve(question);
    } else if (info.offset.x < -threshold || info.velocity.x < -350) {
      onRepeat(question);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl select-none group">
      {/* Background Indicator - Swiping Right (Emerald / Çözüldü) */}
      <motion.div
        style={{ opacity: solveOpacity }}
        className="absolute inset-0 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-700 rounded-2xl p-4 flex items-center justify-start text-white font-extrabold text-xs z-0 pointer-events-none"
      >
        <motion.div style={{ scale: solveScale }} className="flex items-center gap-2.5 pl-2">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-md border border-white/30">
            <span className="material-symbols-outlined text-2xl text-white">check_circle</span>
          </div>
          <div>
            <p className="font-black text-sm tracking-wide">ÇÖZÜLDÜ</p>
            <p className="text-[10px] text-emerald-100 font-medium">+30 XP Kazanıldı</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Background Indicator - Swiping Left (Amber / Tekrar Et) */}
      <motion.div
        style={{ opacity: repeatOpacity }}
        className="absolute inset-0 bg-gradient-to-l from-amber-500 via-amber-600 to-orange-600 rounded-2xl p-4 flex items-center justify-end text-white font-extrabold text-xs z-0 pointer-events-none"
      >
        <motion.div style={{ scale: repeatScale }} className="flex items-center gap-2.5 pr-2 text-right">
          <div>
            <p className="font-black text-sm tracking-wide">TEKRAR ET</p>
            <p className="text-[10px] text-amber-100 font-medium">Yarına ertelendi</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-md border border-white/30">
            <span className="material-symbols-outlined text-2xl text-white">replay</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Card Foreground Surface */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        onDragEnd={handleDragEnd}
        whileTap={{ cursor: 'grabbing' }}
        className={`relative z-10 bg-card-bg border rounded-2xl p-4 flex flex-col justify-between transition-colors shadow-xs cursor-grab ${
          question.isSolved
            ? 'border-emerald-500/40 bg-emerald-50/10 dark:bg-emerald-950/10'
            : 'border-card-border hover:border-primary/60'
        }`}
      >
        <div className="flex gap-3.5">
          {/* Question Image Thumbnail (Uncropped) */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="w-20 h-20 rounded-xl overflow-hidden bg-slate-950 border border-card-border flex-shrink-0 relative group/img cursor-pointer flex items-center justify-center p-1"
          >
            {question.gorselUrl ? (
              <img
                src={question.gorselUrl}
                alt={question.ders}
                className="max-h-full max-w-full object-contain group-hover/img:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-primary/80 bg-primary/10 rounded-lg border border-primary/20 p-1 text-center">
                <span className="material-symbols-outlined text-lg">description</span>
                <span className="text-[9px] font-black uppercase tracking-wider truncate w-full">{question.ders?.slice(0, 4) || 'SORU'}</span>
              </div>
            )}
            {question.isSolved && (
              <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-[1px] flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-2xl">check_circle</span>
              </div>
            )}
          </div>

          {/* Question Title & Details */}
          <div className="flex flex-col justify-between flex-1 min-w-0 space-y-2">
            <div>
              <div className="flex justify-between items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                    {question.ders}
                  </span>
                  <span className="text-[10px] font-bold text-text-muted bg-surface-container-low px-2 py-0.5 rounded-md border border-card-border">
                    {question.hataTuru}
                  </span>
                  {question.kisiselNot && question.kisiselNot.trim().length > 0 && (
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1" title={question.kisiselNot}>
                      <span className="material-symbols-outlined text-[12px]">sticky_note_2</span>
                      <span>Not Var</span>
                    </span>
                  )}
                </div>

                {question.isSolved && (
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    ✓ Çözüldü
                  </span>
                )}
              </div>

              <div
                onClick={onSelect}
                className="text-xs font-semibold text-text-main line-clamp-2 mt-1.5 cursor-pointer hover:text-primary transition-colors leading-relaxed"
              >
                <FormattedMathText text={question.ocrMetin} />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
              <span className="flex items-center gap-1 font-medium">
                <span className="material-symbols-outlined text-xs text-amber-500">schedule</span>
                {question.repeatCount && question.repeatCount > 0
                  ? `${question.repeatCount}. Tekrar Seviyesi`
                  : 'Bugün Tekrar Et'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center justify-between gap-1.5 mt-3 pt-2.5 border-t border-card-border text-xs">
          <div className="flex items-center gap-1">
            {onOpenFlashcards && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFlashcards(question);
                }}
                className="p-1.5 rounded-xl text-text-muted hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                title="Kavram Kartları"
              >
                <span className="material-symbols-outlined text-base">style</span>
                <span className="hidden sm:inline">Kartlar</span>
              </button>
            )}

            {onStartQuiz && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartQuiz(question);
                }}
                className="p-1.5 rounded-xl text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                title="5 Şıklı Test"
              >
                <span className="material-symbols-outlined text-base">quiz</span>
                <span className="hidden sm:inline">Test Et</span>
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRepeat(question);
              }}
              className="p-1.5 rounded-xl text-text-muted hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
              title="Yarına Ertele"
            >
              <span className="material-symbols-outlined text-base">schedule</span>
              <span className="hidden sm:inline">Ertele</span>
            </button>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="bg-primary/10 hover:bg-primary text-primary hover:text-white font-extrabold text-[11px] px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
          >
            <span>Çözümü Gör</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
