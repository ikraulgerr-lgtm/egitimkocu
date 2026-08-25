import React, { useState, useRef, useEffect } from 'react';
import { SoruKaydi, ActiveTab } from '../types';
import { cleanLatexMath, cleanQuestionPrefix } from '../lib/mathUtils';
import { getSocraticHintService } from '../lib/geminiClient';
import { FormattedMathText } from './FormattedMathText';
import { AudioVoiceRecorder } from './AudioVoiceRecorder';
import { FlashcardPracticeModal } from './FlashcardPracticeModal';
import { startNativeSpeechRecognition } from '../lib/nativeSpeech';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SolutionViewProps {
  question: SoruKaydi | null;
  onSaveToErrorPool: (q: SoruKaydi) => void;
  onSaveNote?: (q: SoruKaydi) => void;
  onGenerateSimilar: (q: SoruKaydi, zorluk?: 'Kolay' | 'Orta' | 'Zor') => void;
  onStartQuiz?: (q: SoruKaydi) => void;
  onAddToSchedule?: (ders: string, konu: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  isSaved?: boolean;
}

export const SolutionView: React.FC<SolutionViewProps> = ({
  question,
  onSaveToErrorPool,
  onSaveNote,
  onGenerateSimilar,
  onStartQuiz,
  onAddToSchedule,
  setActiveTab,
  isSaved = false,
}) => {
  const [selectedZorluk, setSelectedZorluk] = useState<'Kolay' | 'Orta' | 'Zor'>('Orta');
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [removedSuggestions, setRemovedSuggestions] = useState<string[]>([]);
  const [socraticChat, setSocraticChat] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([
    {
      sender: 'ai',
      text: question?.sokratikIpucu || `Bu ${question?.ders || 'ders'} (${question?.konu || 'konu'}) sorusunda takıldığın herhangi bir noktayı bana sorabilirsin!`,
    },
  ]);
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [savedStatus, setSavedStatus] = useState(isSaved);
  const [currentSesliNot, setCurrentSesliNot] = useState<string | undefined>(question?.sesliNot);
  const [kisiselNot, setKisiselNot] = useState<string>(question?.kisiselNot || '');
  const [isNoteSavedAlert, setIsNoteSavedAlert] = useState(false);
  const [savedNoteText, setSavedNoteText] = useState<string>(question?.kisiselNot || '');
  const [isAddedToSchedule, setIsAddedToSchedule] = useState(false);

  // Personal notes list state (supports multiple notes per question)
  const [voiceNotes, setVoiceNotes] = useState<Array<{ id: string; text: string; date: string }>>(() => {
    const list = [...(question?.voiceNotes || [])];
    if (question?.kisiselNot && question.kisiselNot.trim() && !list.some(n => n.text === question.kisiselNot)) {
      list.unshift({
        id: 'init_' + (question.id || 'note'),
        text: question.kisiselNot.trim(),
        date: 'Kayıtlı Not',
      });
    }
    return list;
  });
  const [isListeningForNote, setIsListeningForNote] = useState(false);
  const [isListeningForChat, setIsListeningForChat] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);

  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const [editableOcrText, setEditableOcrText] = useState(question ? question.ocrMetin : '');
  const [isEditingOcr, setIsEditingOcr] = useState(false);
  const [isSpeakingOcr, setIsSpeakingOcr] = useState(false);
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);

  const noteRecognitionRef = useRef<any>(null);
  const chatRecognitionRef = useRef<any>(null);
  const nativeNoteStopRef = useRef<(() => void) | null>(null);
  const nativeChatStopRef = useRef<(() => void) | null>(null);

  const isSpeechSupported =
    typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Sync voice notes, audio recording, AI chat, personal note & saved status if selected question changes
  useEffect(() => {
    setSavedStatus(Boolean(isSaved || (question && question.isSaved)));
    const list = [...(question?.voiceNotes || [])];
    if (question?.kisiselNot && question.kisiselNot.trim() && !list.some(n => n.text === question.kisiselNot)) {
      list.unshift({
        id: 'init_' + (question.id || 'note'),
        text: question.kisiselNot.trim(),
        date: 'Kayıtlı Not',
      });
    }
    setVoiceNotes(list);
    setCurrentSesliNot(question?.sesliNot);
    setKisiselNot('');
    setRemovedSuggestions([]);
    setCustomQuestionInput('');
    setEditableOcrText(question ? question.ocrMetin : '');
    setSocraticChat([
      {
        sender: 'ai',
        text: question?.sokratikIpucu || `Bu ${question?.ders || 'ders'} (${question?.konu || 'konu'}) sorusunda takıldığın herhangi bir noktayı bana sorabilirsin!`,
      },
    ]);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [question?.id, isSaved, question?.sesliNot]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (noteRecognitionRef.current) noteRecognitionRef.current.stop();
      if (chatRecognitionRef.current) chatRecognitionRef.current.stop();
    };
  }, []);

  if (!question) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto py-16 text-center animate-fadeIn">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-xs">
          <span className="material-symbols-outlined text-4xl">auto_awesome</span>
        </div>
        <h2 className="text-xl font-extrabold text-text-main">Henüz Analiz Edilmiş Soru Bulunmuyor</h2>
        <p className="text-sm text-text-muted max-w-md mx-auto leading-relaxed">
          Kendi test veya ödev sorunuzun fotoğrafını çekip atarak veya metin olarak yazarak AI pedagojik hata analizini hemen başlatabilirsiniz!
        </p>
        <button
          onClick={() => setActiveTab('home')}
          className="mt-4 bg-primary text-white font-extrabold text-sm px-7 py-3.5 rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-lg cursor-pointer inline-flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">camera_alt</span>
          <span>Ana Sayfadan Soru Gönder</span>
        </button>
      </div>
    );
  }

  const toggleVoiceNoteRecording = async () => {
    if (isListeningForNote) {
      if (nativeNoteStopRef.current) {
        try { nativeNoteStopRef.current(); } catch (e) {}
        nativeNoteStopRef.current = null;
      }
      setIsListeningForNote(false);
    } else {
      setSpeechError(null);
      // Snapshot the current note text before starting — new speech appends after it
      const baseText = kisiselNot ? kisiselNot.trim() : '';
      let lastPartial = '';
      try {
        setIsListeningForNote(true);
        const stopFn = await startNativeSpeechRecognition(
          (transcription) => {
            if (!transcription) return;
            const clean = transcription.trim();
            if (clean === lastPartial) return; // ignore repeated identical partial
            lastPartial = clean;
            // Build: original note + new speech (partial replaces previous partial)
            const updated = baseText ? `${baseText} ${clean}` : clean;
            setKisiselNot(updated);
          },
          (err) => {
            console.warn('Voice note error:', err);
            setIsListeningForNote(false);
          }
        );
        nativeNoteStopRef.current = stopFn;
      } catch (err) {
        console.warn('Voice note start error:', err);
        setIsListeningForNote(false);
      }
    }
  };

  const toggleChatVoiceInput = async () => {
    if (isListeningForChat) {
      if (nativeChatStopRef.current) {
        try { nativeChatStopRef.current(); } catch (e) {}
        nativeChatStopRef.current = null;
      }
      setIsListeningForChat(false);
    } else {
      setSpeechError(null);
      let lastPartial = '';
      try {
        setIsListeningForChat(true);
        const stopFn = await startNativeSpeechRecognition(
          (transcription) => {
            if (!transcription) return;
            const clean = transcription.trim();
            if (clean === lastPartial) return;
            lastPartial = clean;
            // Replace the chat input with latest partial result (user sees live typing)
            setCustomQuestionInput(clean);
          },
          (err) => {
            console.warn('Chat speech error:', err);
            setIsListeningForChat(false);
          }
        );
        nativeChatStopRef.current = stopFn;
      } catch (err) {
        console.warn('Chat voice input start error:', err);
        setIsListeningForChat(false);
      }
    }
  };

  const handleSaveVoiceNote = () => {
    if (!voiceTranscript.trim()) return;
    const newNote = {
      id: 'vn_' + Date.now(),
      text: voiceTranscript.trim(),
      date: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    };
    const updatedNotes = [newNote, ...voiceNotes];
    setVoiceNotes(updatedNotes);
    setVoiceTranscript('');

    const updatedQuestion = { ...question, kisiselNot, voiceNotes: updatedNotes };
    onSaveToErrorPool(updatedQuestion);
  };

  const handleDeleteVoiceNote = (id: string) => {
    const updatedNotes = voiceNotes.filter((n) => n.id !== id);
    setVoiceNotes(updatedNotes);
    const updatedQuestion = { ...question, kisiselNot, voiceNotes: updatedNotes };
    onSaveToErrorPool(updatedQuestion);
  };

  const handleAskSocratic = async (promptText: string) => {
    if (!promptText.trim()) return;

    const userApiKey = (typeof localStorage !== 'undefined' && localStorage.getItem('gemini_api_key')) || '';
    const newMessages = [...socraticChat, { sender: 'user' as const, text: promptText }];
    setSocraticChat(newMessages);
    setCustomQuestionInput('');
    setIsAskingAi(true);

    try {
      const hint = await getSocraticHintService({ question, userApiKey });
      setSocraticChat([
        ...newMessages,
        { sender: 'ai', text: hint },
      ]);
    } catch (err) {
      const fallbackReply = question ? `Bu ${question.ders || 'ders'} sorusunda verilen kuralı ve adımları tekrar gözden geçirebilirsin.` : 'Soru adımlarını tekrar kontrol etmen faydalı olacaktır.';
      setSocraticChat([
        ...newMessages,
        { sender: 'ai', text: fallbackReply },
      ]);
    } finally {
      setIsAskingAi(false);
    }
  };

  const handleSaveAudio = (dataUrl: string) => {
    setCurrentSesliNot(dataUrl);
    const updatedQuestion = { ...question, kisiselNot, sesliNot: dataUrl, voiceNotes };
    onSaveToErrorPool(updatedQuestion);
  };

  const handleDeleteAudio = () => {
    setCurrentSesliNot(undefined);
    const updatedQuestion = { ...question, kisiselNot, sesliNot: undefined, voiceNotes };
    onSaveToErrorPool(updatedQuestion);
  };

  const handleSaveKisiselNot = () => {
    if (!kisiselNot.trim()) return;
    const newNote = {
      id: 'note_' + Date.now(),
      text: kisiselNot.trim(),
      date: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    };
    const updatedNotes = [newNote, ...voiceNotes];
    setVoiceNotes(updatedNotes);
    setKisiselNot(''); // Clear input after save!
    setSavedNoteText('');

    const updatedQuestion = {
      ...question,
      voiceNotes: updatedNotes,
      kisiselNot: updatedNotes[0]?.text || '',
      sesliNot: currentSesliNot,
    };

    if (onSaveNote) {
      onSaveNote(updatedQuestion as any);
    } else {
      onSaveToErrorPool(updatedQuestion as any);
    }

    setIsNoteSavedAlert(true);
    setTimeout(() => setIsNoteSavedAlert(false), 2500);
  };

  const handleDeletePersonalNote = (noteId: string) => {
    const updatedNotes = voiceNotes.filter((n) => n.id !== noteId);
    setVoiceNotes(updatedNotes);
    const updatedQuestion = {
      ...question,
      voiceNotes: updatedNotes,
      kisiselNot: updatedNotes[0]?.text || '',
      sesliNot: currentSesliNot,
    };
    if (onSaveNote) {
      onSaveNote(updatedQuestion as any);
    } else {
      onSaveToErrorPool(updatedQuestion as any);
    }
  };

  const handleSave = () => {
    const updatedQuestion = { ...question, kisiselNot, sesliNot: currentSesliNot, voiceNotes };
    onSaveToErrorPool(updatedQuestion);
    setSavedStatus(true);
  };

  const handleSpeakOcr = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeakingOcr) {
      window.speechSynthesis.cancel();
      setIsSpeakingOcr(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(editableOcrText);
    utterance.lang = 'tr-TR';
    utterance.onend = () => setIsSpeakingOcr(false);
    utterance.onerror = () => setIsSpeakingOcr(false);
    setIsSpeakingOcr(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyOcr = () => {
    navigator.clipboard.writeText(editableOcrText);
    alert('📋 Sorunun okunan metni panoya kopyalandı!');
  };

  // Universal Text Sanitizer for ALL questions across ALL subjects
  const getCleanText = (str: string) => {
    if (!str) return `${question?.ders || 'Genel'} — ${question?.konu || 'Soru Çözümü'}`;

    let cleaned = cleanQuestionPrefix(str.trim());

    // Remove choices from root text if they appear inline at the end
    const choiceStartIndex = cleaned.search(/(?:^|\s+)(?:[A-E][\)\.]|\([A-E]\))\s+/i);
    if (choiceStartIndex > 15) {
      cleaned = cleaned.substring(0, choiceStartIndex).trim();
    }

    // Clean html tags if any, and remove duplicate spaces
    cleaned = cleaned.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    if (!cleaned || cleaned.length < 3) {
      return `${question?.ders || 'Genel'} — ${question?.konu || 'Soru Çözümü'}`;
    }
    return cleaned;
  };

  // Extract non-clickable choices for display without repeating label prefixes like A) A)
  const getStaticChoices = () => {
    if (!question) return [];
    if (question.siklar && question.siklar.length >= 4) {
      const labels = ['A', 'B', 'C', 'D', 'E'];
      return question.siklar.map((t, idx) => {
        const cleanChoiceText = t.replace(/^(?:[A-E][\)\.-]\s*)+/i, '').trim();
        return { label: labels[idx], text: cleanChoiceText };
      });
    }
    // Try parsing regex from raw text
    const regex = /(?:^|\s+|[^\w])([A-E])[\)\.]\s*(.*?)(?=(?:^|\s+|[^\w])[A-E][\)\.]\s+|$)/gi;
    const matches = [...(question.ocrMetin || '').matchAll(regex)];
    if (matches.length >= 4) {
      const labels = ['A', 'B', 'C', 'D', 'E'];
      return matches.map((m, idx) => ({
        label: labels[idx],
        text: m[2].trim().replace(/^(?:[A-E][\)\.-]\s*)+/i, ''),
      }));
    }
    return [];
  };

function cleanTextFormatting(str: string | undefined): string {
  if (!str) return '';
  return cleanLatexMath(
    str
      .replace(/&amp;/g, 've')
      .replace(/\\&/g, '&')
      .replace(/\s+&\s+/g, ' ve ')
      .replace(/&/g, ' ve ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

  if (!question) {
    return (
      <div className="text-center py-24 space-y-4 max-w-md mx-auto animate-fadeIn">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto text-3xl shadow-xs">
          📋
        </div>
        <div className="space-y-1.5">
          <h3 className="font-extrabold text-lg text-text-main">İncelenecek Soru Bulunamadı</h3>
          <p className="text-xs text-text-muted leading-relaxed">
            Lütfen ana sayfadan bir soru fotoğrafı yükleyin veya metin/ses ile soru sorarak analizi başlatın.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('home')}
          className="px-6 py-3 bg-primary hover:bg-primary-hover text-white font-extrabold text-xs rounded-2xl cursor-pointer shadow-md transition-all active:scale-95"
        >
          Ana Sayfaya Dön
        </button>
      </div>
    );
  }

  const cleanText = getCleanText(question.ocrMetin);
  const staticChoices = getStaticChoices();

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-52 sm:pb-56 animate-fadeIn">
      {/* Okunamayan / Soru İçermeyen Fotoğraf Uyarısı */}
      {question.isUnreadable && (
        <div className="bg-rose-500/10 border-2 border-rose-500 rounded-3xl p-5 text-center space-y-3.5 shadow-lg animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-rose-500 text-white flex items-center justify-center mx-auto shadow-md">
            <span className="material-symbols-outlined text-2xl font-black">photo_camera</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-rose-600 dark:text-rose-400">
              ⚠️ Soru Okunamadı / Analiz Edilemedi
            </h3>
            <p className="text-xs font-extrabold text-text-main leading-relaxed max-w-sm mx-auto">
              Yapay zeka soru görselini veya metnini net okuyamadı. Lütfen fotoğrafı net ve aydınlık bir ortamda çekip tekrar yükleyin.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('home')}
            className="bg-rose-600 text-white font-extrabold text-xs px-5 py-2.5 rounded-full hover:bg-rose-700 active:scale-95 transition-all shadow-md cursor-pointer inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">camera_alt</span>
            <span>Net Fotoğraf Çek / Tekrar Yükle</span>
          </button>
        </div>
      )}

      {/* Uploaded Question Image Preview Card */}
      {question.gorselUrl && (
        <section className="bg-card-bg p-3.5 rounded-3xl border border-card-border shadow-xs space-y-2 overflow-hidden">
          <div className="flex items-center gap-1.5 px-1 text-xs font-extrabold text-text-muted">
            <span className="material-symbols-outlined text-primary text-base">image</span>
            <span>Yüklenen Soru Fotoğrafı:</span>
          </div>
          <div className="w-full max-h-80 rounded-2xl overflow-hidden bg-slate-950/90 flex items-center justify-center border border-card-border">
            <img
              src={question.gorselUrl}
              alt="Yüklenen Soru Fotoğrafı"
              className="max-h-80 object-contain w-full"
            />
          </div>
        </section>
      )}

      {/* Question Header Card */}
      <div className="bg-card-bg p-5 rounded-3xl border border-card-border space-y-3 shadow-xs">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black text-primary uppercase tracking-wider bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
              {question.ders} • {cleanTextFormatting(question.konu)}
            </span>
            <span className="bg-rose-500/15 text-rose-600 dark:text-rose-400 font-extrabold text-[11px] px-3 py-1 rounded-full border border-rose-500/30">
              Hata: {question.hataTuru}
            </span>
          </div>
          <button 
            onClick={() => setActiveTab('errorPool')}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Tüm Yanlışlar</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        <h2 className="text-base sm:text-lg font-extrabold text-text-main leading-relaxed">
          <FormattedMathText text={cleanText} />
        </h2>
      </div>

      {/* Non-clickable Options List (Sadece Okunabilir Şıklar) */}
      {staticChoices.length > 0 ? (
        <section className="bg-card-bg rounded-3xl p-4.5 border border-card-border space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-text-muted flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-primary">list</span>
              <span>Soru Şıkları (Okunabilir):</span>
            </span>
            <span className="text-[10px] font-bold text-text-muted bg-surface-container-low px-2 py-0.5 rounded-full">
              Test için alttaki 'Soruyu Şimdi Çöz' butonuna basabilirsiniz
            </span>
          </div>

          <div className="space-y-2">
            {staticChoices.map((choice, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl bg-surface-container-low/60 border border-card-border/60 flex items-center gap-3 pointer-events-none select-text"
              >
                <div className="w-7 h-7 rounded-xl bg-card-bg text-text-muted font-extrabold text-xs flex items-center justify-center border border-card-border flex-shrink-0">
                  {choice.label}
                </div>
                <div className="text-xs font-extrabold text-text-main leading-snug">
                  <FormattedMathText text={choice.text} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="bg-primary/5 rounded-2xl p-3.5 border border-primary/20 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">quiz</span>
            <p className="text-xs font-extrabold text-text-main">
              Açık Uçlu (Şıksız) Soru • <span className="text-primary">Adım adım çözüm yukarıdaki tanıya göre hazırlanmıştır.</span>
            </p>
          </div>
          <span className="text-[10px] font-bold bg-primary text-white px-2.5 py-1 rounded-full whitespace-nowrap">
            Şıksız Soru
          </span>
        </section>
      )}

      {/* Flashcard (3 Kavram) Banner Button */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/40 p-4 rounded-2xl text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center text-lg">
            🎴
          </div>
          <div>
            <h4 className="font-extrabold text-xs sm:text-sm text-white">Çözümdeki En Zor 3 Kavram</h4>
            <p className="text-[11px] text-indigo-200/90 font-medium">Bu sorudaki zor terimler, tanımlar ve işlem tuzakları ile pratik yap.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsFlashcardModalOpen(true)}
          className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-base">style</span>
          <span>Bilgi Kartlarını Aç</span>
        </button>
      </div>

      {/* Always Visible Step by Step Solution Section */}
      <section className="space-y-3 animate-fadeIn">
        <h2 className="font-extrabold text-lg text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">receipt_long</span>
          Adım Adım Çözüm ve Teşhis
        </h2>

        <div className="space-y-3.5">
          {(question.cozumAdimlari || []).map((step) => {
            if (step.isCorrect) {
              return (
                <div key={step.adimNo} className="bg-card-bg p-4.5 rounded-2xl border border-card-border space-y-2 shadow-2xs">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-sm text-text-muted inline-flex items-center gap-1.5">
                      <span>ADIM {step.adimNo}</span>
                      {step.baslik && (
                        <>
                          <span>—</span>
                          <FormattedMathText text={step.baslik} />
                        </>
                      )}
                    </span>
                    <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                  </div>
                  <div className="text-sm sm:text-base text-text-muted font-medium leading-relaxed">
                    <FormattedMathText text={step.aciklama} />
                  </div>
                  {step.dogruMetin && (
                    <div className="font-extrabold text-base sm:text-lg text-primary mt-1.5">
                      <FormattedMathText text={step.dogruMetin} />
                    </div>
                  )}
                </div>
              );
            }

            // Error Step
            return (
              <div key={step.adimNo} className="bg-rose-50 dark:bg-rose-950/30 p-4.5 rounded-2xl border-2 border-rose-500/40 relative space-y-2.5 shadow-2xs">
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm sm:text-base text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">warning</span>
                    {step.baslik ? <FormattedMathText text={step.baslik} /> : `ADIM ${step.adimNo} (KRİTİK HATA)`}
                  </span>
                  <span className="material-symbols-outlined text-rose-600 text-lg">error</span>
                </div>

                <div className="text-sm sm:text-base text-text-main font-medium leading-relaxed">
                  <FormattedMathText text={step.aciklama} />
                </div>

                {step.hataliMetin && (
                  <div className="font-extrabold text-base sm:text-lg text-rose-600 flex items-center gap-1.5 flex-wrap">
                    <FormattedMathText text={step.hataliMetin} />
                    <span>❌</span>
                  </div>
                )}

                {step.dogruMetin && (
                  <div className="mt-2 pt-2 border-t border-rose-200 dark:border-rose-800 flex items-center gap-2 text-sm sm:text-base">
                    <span className="material-symbols-outlined text-amber-500 text-base">lightbulb</span>
                    <div className="text-text-muted font-medium flex items-center gap-1.5 flex-wrap">
                      <span>Doğrusu:</span>
                      <span className="text-primary font-extrabold text-base sm:text-lg">
                        <FormattedMathText text={step.dogruMetin} />
                      </span>
                      <span>olmalıydı.</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* AI Pedagogical Schedule Recommendation Card */}
      {onAddToSchedule && (
        <section className="bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-950 p-4.5 rounded-2xl text-white shadow-md space-y-2 border border-indigo-700/50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-300 text-lg">calendar_add_on</span>
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">
              YAPAY ZEKA PROGRAM ÖNERİSİ
            </span>
          </div>
          <p className="text-xs font-medium text-indigo-50 leading-relaxed">
            Bu <strong className="text-amber-300 font-bold">{question.ders} — {question.konu}</strong> konusundaki dikkatsizliği pekiştirmek için haftalık ders programına 45 dk tekrar & soru çözümü ekle!
          </p>
          <button
            type="button"
            disabled={isAddedToSchedule}
            onClick={() => {
              onAddToSchedule(question.ders, question.konu);
              setIsAddedToSchedule(true);
            }}
            className={`mt-1 font-black text-xs px-4 py-2 rounded-full active:scale-95 transition-all shadow-sm inline-flex items-center gap-1.5 ${
              isAddedToSchedule
                ? 'bg-emerald-500 text-white cursor-default opacity-90'
                : 'bg-white text-indigo-950 hover:bg-slate-100 cursor-pointer'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {isAddedToSchedule ? 'check_circle' : 'add_task'}
            </span>
            <span>{isAddedToSchedule ? 'Programa Eklendi ✓' : 'Bu Konuyu Programıma Ekle'}</span>
          </button>
        </section>
      )}

      {/* Kişisel Not & Sesle Dikte Alanı (Birleşik) */}
      <section className="bg-card-bg border border-card-border p-4.5 rounded-2xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <span className="material-symbols-outlined text-lg">edit_note</span>
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-text-main">Kişisel Not Alanı</h3>
              <p className="text-[11px] text-text-muted font-medium">
                Bu sorudaki püf noktaları yazabilir veya mikrofonu açıp konuşarak metne dönüştürebilirsiniz.
              </p>
            </div>
          </div>
          {isNoteSavedAlert && (
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full animate-fadeIn flex items-center gap-1 flex-shrink-0">
              <span className="material-symbols-outlined text-xs">check_circle</span>
              <span>Kaydedildi</span>
            </span>
          )}
        </div>

        <div className="space-y-2">
          <textarea
            value={kisiselNot}
            onChange={(e) => setKisiselNot(e.target.value)}
            placeholder={
              isListeningForNote
                ? '🎙️ Dinleniyor... Konuştuğunuz ifadeler buraya doğrudan yazılıyor...'
                : 'Örn: 2. adımda formüldeki işaret değişimini unuttum. Eşitliğin sağındaki -4 terimini karşıya +4 olarak geçirmeliyim...'
            }
            rows={3}
            className={`w-full bg-surface-container-low border ${
              isListeningForNote ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-card-border'
            } rounded-xl p-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y leading-relaxed font-medium transition-all`}
          />

          {speechError && (
            <p className="text-[11px] text-rose-500 font-bold">{speechError}</p>
          )}

          <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleVoiceNoteRecording}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                  isListeningForNote
                    ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                    : 'bg-surface-container-low text-text-main border border-card-border hover:border-primary'
                }`}
                title={isListeningForNote ? 'Mikrofonu Durdur' : 'Mikrofon ile Konuşarak Not Yaz'}
              >
                <span className="material-symbols-outlined text-base">
                  {isListeningForNote ? 'mic_off' : 'mic'}
                </span>
                <span>{isListeningForNote ? 'Mikrofonu Kapat' : 'Konuşarak Not Ekle'}</span>
              </button>

              <span className="text-[10px] text-text-muted font-bold">
                {kisiselNot.trim().length > 0 ? `${kisiselNot.trim().length} karakter` : 'Not henüz eklenmedi'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {kisiselNot.trim() && (
                <button
                  type="button"
                  onClick={() => setKisiselNot('')}
                  className="px-2.5 py-1.5 rounded-xl border border-card-border text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
                >
                  Temizle
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveKisiselNot}
                className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">save</span>
                <span>Notu Kaydet</span>
              </button>
            </div>
          </div>

          {/* Saved notes list — displays multiple notes per question */}
          {voiceNotes.length > 0 && (
            <div className="mt-3 space-y-2 pt-3 border-t border-card-border animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-black text-amber-600 dark:text-amber-400">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">sticky_note_2</span>
                  <span>Kayıtlı Notlarım ({voiceNotes.length})</span>
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {voiceNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-start justify-between gap-2.5 animate-fadeIn"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full inline-block">
                        🕒 {note.date}
                      </span>
                      <p className="text-xs text-text-main font-medium leading-relaxed whitespace-pre-wrap break-words">
                        {note.text}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePersonalNote(note.id)}
                      className="text-text-muted hover:text-rose-500 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Notu Sil"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Voice Audio Recording Section */}
      <section className="bg-card-bg border border-card-border p-4 rounded-2xl space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">record_voice_over</span>
            <h3 className="font-extrabold text-sm text-text-main">Sesli Not Kaydı (Ses Dosyası)</h3>
          </div>
          <span className="bg-primary/10 text-primary text-[10px] font-black px-2.5 py-0.5 rounded-full">
            Ses Kaydedici
          </span>
        </div>

        {/* Dedicated Audio Recording Component */}
        <AudioVoiceRecorder
          audioUrl={currentSesliNot}
          onSaveAudio={handleSaveAudio}
          onDeleteAudio={handleDeleteAudio}
        />
      </section>

      {/* Socratic Hint AI Box */}
      <section className="bg-primary/5 dark:bg-primary/10 p-4 rounded-2xl border-l-4 border-primary space-y-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">smart_toy</span>
          <h3 className="font-extrabold text-sm text-text-main">Yapay Zekaya Sor / Sokratik İpucu Al</h3>
        </div>

        {/* Chat Messages */}
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
          {socraticChat.map((msg, index) => (
            <div 
              key={index}
              className={`p-3 rounded-xl text-xs leading-relaxed ${
                msg.sender === 'ai' 
                  ? 'bg-card-bg border border-card-border text-text-main font-medium' 
                  : 'bg-primary text-white font-bold ml-6 text-right'
              }`}
            >
              {cleanTextFormatting(msg.text)}
            </div>
          ))}

          {isAskingAi && (
            <div className="p-3 bg-card-bg rounded-xl text-xs text-text-muted flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span>Eğitim Koçum AI düşünüyor...</span>
            </div>
          )}
        </div>

        {/* Quick Dynamic Suggestion Chips */}
        {(() => {
          const ders = question.ders || 'Matematik';
          const konu = question.konu || 'Konu';
          const hata = question.hataTuru || 'İşlem Hatası';

          const dynamicSuggestions = [
            question.sokratikIpucu ? `💡 "${question.sokratikIpucu}"` : `2. Adımdaki ${hata} mantığını açıklar mısın?`,
            ders === 'Fizik'
              ? `⚡ ${konu} konusunda hangi fizik formülünü kullanmalıydım?`
              : ders === 'Kimya'
              ? `🧪 ${konu} denkleminde mol/tepkime kuralını hatırlatır mısın?`
              : ders === 'Biyoloji'
              ? `🧬 ${konu} konusundaki temel kavramları özetler misin?`
              : ders === 'Türkçe'
              ? `📖 ${konu} konusundaki püf noktaları anlatır mısın?`
              : `📐 ${konu} konusundaki temel kuralı ve pratik yöntemi açıklar mısın?`,
            `🎯 Benzer bir ${ders} sorusunda aynı hatayı yapmamak için neye dikkat etmeliyim?`,
          ];

          const visibleSuggestions = dynamicSuggestions.filter((text) => !removedSuggestions.includes(text));

          if (visibleSuggestions.length === 0) return null;

          return (
            <div className="flex flex-wrap gap-2 pt-1">
              {visibleSuggestions.map((text, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setRemovedSuggestions((prev) => [...prev, text]);
                    handleAskSocratic(text.replace(/^[💡⚡🧪🧬📖📐🎯]\s*/, ''));
                  }}
                  className="text-xs bg-card-bg hover:bg-primary hover:text-white px-3 py-1.5 rounded-lg border border-card-border transition-colors text-left cursor-pointer shadow-2xs font-medium"
                >
                  {cleanTextFormatting(text)}
                </button>
              ))}
            </div>
          );
        })()}

        {/* Question Text & Voice Input */}
        <div className="relative mt-2">
          <input
            type="text"
            value={customQuestionInput}
            onChange={(e) => setCustomQuestionInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskSocratic(customQuestionInput)}
            placeholder={isListeningForChat ? 'Dinleniyor... Konuşun...' : 'Başka bir şey sor...'}
            className={`w-full bg-card-bg border ${
              isListeningForChat ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-card-border'
            } rounded-full py-2.5 pl-4 pr-20 text-xs focus:outline-none focus:ring-2 focus:ring-primary text-text-main`}
          />
          <button
            type="button"
            onClick={toggleChatVoiceInput}
            className={`absolute right-10 top-1.5 p-1 rounded-full transition-transform cursor-pointer ${
              isListeningForChat ? 'text-rose-500 animate-pulse scale-110' : 'text-text-muted hover:text-primary'
            }`}
            title={isListeningForChat ? 'Mikrofonu Kapat' : 'Sesle Soru Sor'}
          >
            <span className="material-symbols-outlined text-lg">{isListeningForChat ? 'mic_off' : 'mic'}</span>
          </button>
          <button
            onClick={() => handleAskSocratic(customQuestionInput)}
            className="absolute right-2 top-1.5 p-1 text-primary hover:scale-110 transition-transform cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">send</span>
          </button>
        </div>
      </section>

      {/* Bottom Sticky Action Buttons & Difficulty Selector */}
      <div className="fixed bottom-[58px] sm:bottom-[64px] left-0 right-0 z-40 bg-background/95 dark:bg-background/95 backdrop-blur-xl p-2 sm:p-2.5 border-t border-card-border shadow-2xl max-w-2xl mx-auto space-y-1.5 sm:space-y-2 transition-colors">
        {/* Difficulty Selector Row */}
        <div className="flex items-center justify-between gap-2 px-1 text-xs">
          <div className="flex items-center gap-1.5 font-extrabold text-text-main">
            <span className="material-symbols-outlined text-sm text-primary">tune</span>
            <span>Benzer Soru Zorluğu:</span>
          </div>
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-card-border">
            {(['Kolay', 'Orta', 'Zor'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedZorluk(lvl)}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                  selectedZorluk === lvl
                    ? lvl === 'Kolay'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : lvl === 'Orta'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-rose-600 text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  lvl === 'Kolay' ? 'bg-emerald-400' : lvl === 'Orta' ? 'bg-amber-400' : 'bg-rose-400'
                }`} />
                <span>{lvl}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onStartQuiz && (
            <button
              onClick={() => onStartQuiz(question)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">fact_check</span>
              <span>Test Çöz</span>
            </button>
          )}

          <button
            onClick={() => onGenerateSimilar(question, selectedZorluk)}
            className="flex-1 bg-primary hover:bg-primary-hover text-white font-extrabold text-xs py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">dynamic_feed</span>
            <span>Benzer Üret ({selectedZorluk})</span>
          </button>

          {/* Conditional Havuza Ekle / Kayıtlı button */}
          {savedStatus ? (
            <button
              disabled
              type="button"
              className="px-3 py-2.5 sm:py-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center gap-1 border border-emerald-500/20 shadow-xs cursor-default shrink-0"
              title="Bu soru zaten havuzunuzda kayıtlı"
            >
              <span className="material-symbols-outlined text-base">check</span>
              <span className="hidden xs:inline">Kayıtlı</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onSaveToErrorPool(question);
                setSavedStatus(true);
              }}
              className="px-3 py-2.5 sm:py-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-md transition-all cursor-pointer shrink-0"
              title="Bu benzer soruyu hata havuzuna kaydet"
            >
              <span className="material-symbols-outlined text-base">bookmark_add</span>
              <span>Havuza Ekle</span>
            </button>
          )}
        </div>
      </div>

      {/* Flashcard Modal */}
      {isFlashcardModalOpen && question && (
        <FlashcardPracticeModal
          question={question}
          onClose={() => setIsFlashcardModalOpen(false)}
        />
      )}
    </div>
  );
};
