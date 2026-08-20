import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface AiAnalyzingOverlayProps {
  isOpen: boolean;
  message?: string;
}

const ANALYSIS_STEPS = [
  '🔍 Soru görseli ve metni yüksek çözünürlükte taranıyor...',
  '🧠 ÖSYM müfredatı ve konu kazanım kuralları sorgulanıyor...',
  '🎯 Öğrencinin olası kavram veya işlem yanılgısı tespit ediliyor...',
  '📝 Sokratik ipucu ve adım adım detaylı çözüm üretiliyor...',
];

export const AiAnalyzingOverlay: React.FC<AiAnalyzingOverlayProps> = ({ isOpen, message }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => (prev + 1) % ANALYSIS_STEPS.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-white select-none animate-fadeIn"
      >
        {/* Glowing Neural Ring Visual */}
        <div className="relative flex items-center justify-center mb-8">
          <div className="w-36 h-36 rounded-full border-2 border-primary/30 animate-ping absolute" />
          <div className="w-28 h-28 rounded-full border border-indigo-500/40 animate-pulse absolute" />
          
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-primary/30 via-indigo-600/30 to-purple-600/40 border border-primary/50 backdrop-blur-md flex items-center justify-center shadow-2xl shadow-primary/30">
            <span className="material-symbols-outlined text-4xl text-primary animate-pulse">
              psychology
            </span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-3 max-w-md">
          <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-primary via-indigo-300 to-purple-400 bg-clip-text text-transparent tracking-wide">
            {message || 'Yapay Zeka Pedagojik Tanı Koyuyor...'}
          </h2>

          {/* Animated Step Status Text */}
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="text-xs sm:text-sm font-semibold text-slate-300 h-10 flex items-center justify-center px-4"
          >
            <span>{ANALYSIS_STEPS[currentStepIndex]}</span>
          </motion.div>
        </div>

        {/* Progress Bar & Pulse Dots */}
        <div className="w-full max-w-xs mt-8 space-y-3">
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
            <div className="h-full bg-gradient-to-r from-primary via-indigo-400 to-purple-500 rounded-full animate-pulse w-full" />
          </div>

          <p className="text-[11px] text-slate-400 font-bold text-center">
            Lütfen bekleyin, sorunuz detaylıca inceleniyor
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
