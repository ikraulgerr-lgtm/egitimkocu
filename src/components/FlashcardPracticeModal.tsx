import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SoruKaydi, BilgiKarti } from '../types';
import { getOrGenerateFlashcards, fetchAiFlashcards } from '../lib/flashcardUtils';
import { FormattedMathText } from './FormattedMathText';
import { LofiAudioWidget } from './LofiAudioWidget';

interface FlashcardPracticeModalProps {
  question: SoruKaydi;
  allQuestions?: SoruKaydi[];
  onClose: () => void;
  onRewardXp?: (amount: number) => void;
}

export const FlashcardPracticeModal: React.FC<FlashcardPracticeModalProps> = ({
  question,
  allQuestions = [],
  onClose,
  onRewardXp,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(() => {
    const idx = allQuestions.findIndex((q) => q.id === question.id);
    return idx >= 0 ? idx : 0;
  });

  const activeQuestion = allQuestions.length > 0 ? allQuestions[currentQuestionIndex] : question;

  const [cards, setCards] = useState<BilgiKarti[]>([]);
  const [cardIndex, setCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [learnedCount, setLearnedCount] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [showLofi, setShowLofi] = useState<boolean>(false);

  // Load flashcards for active question
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setIsFlipped(false);
    setCardIndex(0);
    setIsFinished(false);

    async function loadCards() {
      // 1. Immediate fallback or cached cards
      const initial = getOrGenerateFlashcards(activeQuestion);
      if (isMounted) {
        setCards(initial);
        setIsLoading(false);
      }

      // 2. Try fetching AI refined flashcards
      try {
        const aiCards = await fetchAiFlashcards(activeQuestion);
        if (isMounted && aiCards.length > 0) {
          setCards(aiCards);
        }
      } catch (err) {
        console.warn('AI Flashcards load error', err);
      }
    }

    loadCards();

    return () => {
      isMounted = false;
    };
  }, [activeQuestion]);

  const currentCard = cards[cardIndex] || null;

  const handleCardClick = () => {
    setIsFlipped(!isFlipped);
  };

  const handleLearnedCard = () => {
    setIsFlipped(false);
    const newLearned = learnedCount + 1;
    setLearnedCount(newLearned);

    if (onRewardXp) {
      onRewardXp(15);
    }

    if (cardIndex + 1 < cards.length) {
      setTimeout(() => {
        setCardIndex((prev) => prev + 1);
      }, 200);
    } else {
      setIsFinished(true);
    }
  };

  const handleRepeatCard = () => {
    setIsFlipped(false);
    // Cycle card to the end of the array to practice again
    if (cards.length > 1) {
      const updated = [...cards];
      const repeatItem = updated.splice(cardIndex, 1)[0];
      updated.push(repeatItem);
      setCards(updated);
    }
  };

  const handleNextQuestionInPool = () => {
    if (currentQuestionIndex + 1 < allQuestions.length) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/70 dark:bg-black/85 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-xl bg-card-bg border border-card-border rounded-3xl p-4 sm:p-6 text-text-main shadow-2xl flex flex-col justify-between max-h-[94vh] my-auto overflow-y-auto">
        {/* Modal Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-card-border pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-lg sm:text-xl shadow-xs shrink-0">
              🎴
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-text-main flex items-center gap-2">
                <span>Bilgi Kartları</span>
                <span className="bg-primary/10 text-primary text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full">
                  {cardIndex + 1} / {cards.length || 3}
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-text-muted font-medium line-clamp-1">
                {activeQuestion.ders} • {activeQuestion.konu}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowLofi(!showLofi)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                showLofi
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface-container-low text-text-muted hover:text-text-main border-card-border'
              }`}
              title="Lo-Fi Odak Müziği"
            >
              <span className="material-symbols-outlined text-sm">headphones</span>
              <span className="hidden xs:inline">{showLofi ? 'Müzik Açık' : 'Lo-Fi'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-container-low hover:bg-surface-container text-text-muted hover:text-text-main flex items-center justify-center transition-colors cursor-pointer border border-card-border"
            >
              <span className="material-symbols-outlined text-base sm:text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Lo-Fi Audio Widget if toggled */}
        {showLofi && (
          <div className="relative z-10 mt-2.5 animate-fadeIn shrink-0">
            <LofiAudioWidget isEmbedded={true} initialTheme="relax" />
          </div>
        )}

        {/* Flashcard Main Interactive Area */}
        <div className="relative z-10 my-3 flex-1 flex flex-col justify-center min-h-0">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-text-muted font-bold">
                Kavram bilgi kartları yükleniyor...
              </p>
            </div>
          ) : isFinished ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-surface-container-low border border-card-border rounded-3xl p-5 sm:p-7 text-center space-y-3.5 my-auto shadow-sm"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-3xl sm:text-4xl mx-auto animate-bounce">
                🎉
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-lg sm:text-2xl text-text-main">Tebrikler!</h4>
                <p className="text-xs sm:text-sm text-text-muted max-w-md mx-auto leading-relaxed">
                  Bu konudaki tüm kritik kavramları başarıyla tekrar ettin ve hafızanı güçlendirdin!
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                {allQuestions.length > 1 && currentQuestionIndex + 1 < allQuestions.length && (
                  <button
                    onClick={handleNextQuestionInPool}
                    className="bg-primary hover:bg-primary-hover text-white font-extrabold text-xs px-5 py-3 rounded-2xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    <span>Sonraki Sorunun Kartları</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="bg-surface-container hover:bg-surface-container-high text-text-main font-extrabold text-xs px-5 py-3 rounded-2xl transition-all cursor-pointer border border-card-border"
                >
                  Tamamla ve Kapat
                </button>
              </div>
            </motion.div>
          ) : currentCard ? (
            <div className="space-y-3">
              {/* 3D Interactive Flip Card */}
              <div
                onClick={handleCardClick}
                className="w-full cursor-pointer select-none group"
                style={{ perspective: 1200, WebkitPerspective: 1200 }}
              >
                <motion.div
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.45, ease: 'easeInOut' }}
                  style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}
                  className="relative w-full rounded-3xl shadow-lg border-2 border-primary/30 bg-card-bg transition-shadow hover:shadow-xl min-h-[300px] sm:min-h-[340px]"
                >
                  {/* FRONT OF CARD */}
                  <div
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                    className={`w-full p-4 sm:p-6 flex flex-col justify-between min-h-[300px] sm:min-h-[340px] ${
                      isFlipped ? 'opacity-0 pointer-events-none' : 'opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-card-border">
                      <span className="text-[11px] sm:text-xs font-black uppercase text-primary tracking-wider bg-primary/10 px-2.5 py-0.5 rounded-full">
                        {activeQuestion.ders} • {activeQuestion.konu}
                      </span>
                      <span className="text-[11px] font-bold text-text-muted flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">touch_app</span>
                        Ön Yüz
                      </span>
                    </div>

                    <div className="my-auto py-4 text-center space-y-2 sm:space-y-3">
                      <h4 className="font-extrabold text-lg sm:text-2xl text-text-main tracking-tight leading-snug">
                        {currentCard.kavram}
                      </h4>
                      <p className="text-xs text-text-muted max-w-sm mx-auto">
                        Bu kavramın tanımını ve çözüm mantığını biliyor musun?
                      </p>
                    </div>

                    <div className="pt-3 border-t border-card-border flex items-center justify-center gap-1.5 text-xs font-extrabold text-primary group-hover:brightness-110 transition-all">
                      <span className="material-symbols-outlined text-base animate-pulse">flip_camera_android</span>
                      <span>Cevabı görmek için dokun</span>
                    </div>
                  </div>

                  {/* BACK OF CARD (ROTATED 180 DEG) */}
                  <div
                    style={{
                      transform: 'rotateY(180deg)',
                      WebkitTransform: 'rotateY(180deg)',
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                    className={`absolute inset-0 p-4 sm:p-6 rounded-3xl bg-card-bg flex flex-col justify-between border-2 border-emerald-500/40 shadow-inner ${
                      isFlipped ? 'opacity-100 z-20 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-card-border shrink-0">
                      <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        <span className="truncate max-w-[180px] sm:max-w-[280px]">{currentCard.kavram}</span>
                      </span>
                      <span className="text-[11px] font-bold text-text-muted shrink-0">
                        Arka Yüz
                      </span>
                    </div>

                    <div className="my-auto py-2 space-y-2.5 overflow-y-auto max-h-[220px] sm:max-h-[260px] pr-1">
                      <div className="text-xs sm:text-sm font-semibold text-text-main leading-relaxed bg-surface-container-low p-3 sm:p-4 rounded-xl border border-card-border">
                        <FormattedMathText text={currentCard.tanim} />
                      </div>

                      {currentCard.ipucuTuzak && (
                        <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 sm:p-3 rounded-xl text-xs space-y-1">
                          <span className="font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            Sınav İpucu
                          </span>
                          <p className="font-medium text-[11px] sm:text-xs text-text-main leading-relaxed">
                            {currentCard.ipucuTuzak}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-card-border flex items-center justify-center gap-1 text-[11px] text-text-muted font-bold shrink-0">
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      <span>Tekrar çevirmek için dokun</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Action Buttons */}
              {isFlipped ? (
                <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                  <button
                    onClick={handleRepeatCard}
                    className="bg-surface-container hover:bg-surface-container-high text-text-main border border-card-border font-extrabold text-xs sm:text-sm py-3 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-base">replay</span>
                    <span>Tekrar Et</span>
                  </button>

                  <button
                    onClick={handleLearnedCard}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm py-3 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-98"
                  >
                    <span className="material-symbols-outlined text-base">check</span>
                    <span>Öğrendim</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCardClick}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold text-xs sm:text-sm py-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-98"
                >
                  <span className="material-symbols-outlined text-base">flip</span>
                  <span>Kartı Çevir & Cevabı Gör</span>
                </button>
              )}
            </div>
          ) : null}
        </div>

        {/* Modal Progress Footer */}
        <div className="relative z-10 pt-2.5 border-t border-card-border flex items-center justify-between text-xs text-text-muted shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs">
            <span className="font-bold text-text-main">Öğrenilen:</span>
            <span className="font-black text-primary">{learnedCount} / {cards.length || 3} Kavram</span>
          </div>

          <div className="w-28 sm:w-36 bg-surface-container-low h-2 rounded-full overflow-hidden border border-card-border">
            <div
              className="bg-primary h-full transition-all duration-500"
              style={{ width: `${Math.min(100, (learnedCount / (cards.length || 3)) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
