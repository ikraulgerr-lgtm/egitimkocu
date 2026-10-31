import React, { useState, useRef, useEffect } from 'react';
import { Kullanici, SoruKaydi, ActiveTab, ProgramOgesi } from '../types';
import { TodayRepetitionCard } from './TodayRepetitionCard';
import { TodayScheduleSection } from './TodayScheduleSection';
import { CustomProgramModal } from './CustomProgramModal';
import { ParentConnectModal } from './ParentConnectModal';
import { ExamCountdownWidget } from './ExamCountdownWidget';
import { SavedNotesSection } from './SavedNotesSection';
import { startNativeSpeechRecognition } from '../lib/nativeSpeech';
import { mergeTranscripts } from '../lib/speechUtils';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface HomeViewProps {
  user: Kullanici;
  questions: SoruKaydi[];
  onSelectQuestion: (q: SoruKaydi) => void;
  onUpdateQuestions?: (qs: SoruKaydi[]) => void;
  onStartQuiz?: (q: SoruKaydi) => void;
  onStartSession?: (qs: SoruKaydi[]) => void;
  setActiveTab: (tab: ActiveTab) => void;
  onAnalyzeNewQuestion: (imageData: string | null, customPrompt?: string, audioData?: string) => Promise<boolean> | void;
  onWatchAd: () => void;
  onOpenNoCreditsModal?: () => void;
  recentQuestionsCount: number;
  onUpdateUser?: (updatedUser: Kullanici) => void;
  scheduleItems?: ProgramOgesi[];
  onToggleScheduleItem?: (id: string) => void;
  onAddMultipleScheduleItems?: (items: Omit<ProgramOgesi, 'id'>[]) => void;
  onOpenExamCountdown?: () => void;
  onOpenPomodoro?: () => void;
  onOpenSchedule?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  questions,
  onSelectQuestion,
  onUpdateQuestions,
  onStartQuiz,
  onStartSession,
  setActiveTab,
  onAnalyzeNewQuestion,
  onWatchAd,
  onOpenNoCreditsModal,
  recentQuestionsCount,
  onUpdateUser,
  scheduleItems = [],
  onToggleScheduleItem,
  onAddMultipleScheduleItems,
  onOpenExamCountdown,
  onOpenPomodoro,
  onOpenSchedule,
}) => {
  const [scanMode, setScanMode] = useState<'scan' | 'voice' | 'text'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [textPrompt, setTextPrompt] = useState('');
  const [isCustomProgramModalOpen, setIsCustomProgramModalOpen] = useState(false);
  const [isParentConnectModalOpen, setIsParentConnectModalOpen] = useState(false);
  const [homeToast, setHomeToast] = useState<string | null>(null);

  const showHomeToast = (msg: string) => {
    setHomeToast(msg);
    setTimeout(() => setHomeToast(null), 3000);
  };

  // Live Camera states
  const [isLiveCameraOn, setIsLiveCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPermissionState, setCameraPermissionState] = useState<'idle' | 'granted' | 'denied'>('idle');

  // Clipboard Analysis states
  const [clipboardDetectedText, setClipboardDetectedText] = useState<string | null>(null);
  const [isClipboardNoticeOpen, setIsClipboardNoticeOpen] = useState(false);
  const [clipboardError, setClipboardError] = useState<string | null>(null);

  // Universal Voice Recording & Speech Recognition states
  const [isListeningVoiceQuestion, setIsListeningVoiceQuestion] = useState(false);
  const [activeVoiceSource, setActiveVoiceSource] = useState<'topVoice' | 'bottomInput' | null>(null);
  const [voiceQuestionTranscript, setVoiceQuestionTranscript] = useState('');
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  const speechRecognitionRef = useRef<any>(null);
  const isVoiceListeningActiveRef = useRef(false);
  const baseTextBeforeMicRef = useRef('');
  const sessionFinalTextRef = useRef('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const nativeStopSpeechRef = useRef<(() => void) | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isVoiceListeningActiveRef.current = false;
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.abort(); } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const stopVoiceQuestionListening = (submitOnStop: boolean = false) => {
    isVoiceListeningActiveRef.current = false;
    const currentSource = activeVoiceSource;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
    setIsListeningVoiceQuestion(false);

    if (submitOnStop) {
      const finalRecordedText = (currentSource === 'bottomInput' ? textPrompt : (voiceQuestionTranscript || textPrompt) || '').trim();
      if (finalRecordedText) {
        handleVoiceSubmit(finalRecordedText);
      }
    }
  };

  const cancelVoiceQuestionListening = () => {
    isVoiceListeningActiveRef.current = false;
    baseTextBeforeMicRef.current = '';
    sessionFinalTextRef.current = '';
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
    setIsListeningVoiceQuestion(false);
    setVoiceQuestionTranscript('');
    setTextPrompt('');
  };

  const startVoiceQuestionListening = async (source: 'topVoice' | 'bottomInput' = 'topVoice') => {
    setMicPermissionError(null);
    setActiveVoiceSource(source);
    isVoiceListeningActiveRef.current = true;
    baseTextBeforeMicRef.current = (source === 'bottomInput' ? textPrompt : voiceQuestionTranscript).trim();
    sessionFinalTextRef.current = '';

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream.getTracks().forEach((track) => track.stop());
      }
    } catch (micErr: any) {
      console.warn('getUserMedia microphone permission denied or rejected:', micErr);
      setMicPermissionError('🔒 Mikrofon İzni Reddedildi veya Engellendi. Lütfen mikrofon erişimine izin verin.');
      isVoiceListeningActiveRef.current = false;
      return;
    }

    const SpeechRecognitionObj = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionObj) {
      setMicPermissionError('Cihazınızda sesle soru sorma özelliği desteklenmiyor. Lütfen sorunuzu metin kutusuna yazarak iletin.');
      isVoiceListeningActiveRef.current = false;
      return;
    }

    try {
      const recognition = new SpeechRecognitionObj();
      recognition.lang = 'tr-TR';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListeningVoiceQuestion(true);
        setMicPermissionError(null);
      };

      recognition.onresult = (e: any) => {
        let newPiece = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          const piece = (e.results[i][0]?.transcript || '').trim();
          if (piece) {
            newPiece = newPiece ? `${newPiece} ${piece}` : piece;
          }
        }
        if (newPiece) {
          sessionFinalTextRef.current = sessionFinalTextRef.current
            ? `${sessionFinalTextRef.current} ${newPiece}`
            : newPiece;
          const fullText = baseTextBeforeMicRef.current
            ? `${baseTextBeforeMicRef.current} ${sessionFinalTextRef.current}`
            : sessionFinalTextRef.current;
          setVoiceQuestionTranscript(fullText);
          setTextPrompt(fullText);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition warning/error:', e);
        const errType = e?.error || '';
        if (errType === 'not-allowed' || errType === 'permission-denied') {
          setMicPermissionError('🔒 Mikrofon İzni Reddedildi.');
          isVoiceListeningActiveRef.current = false;
          setIsListeningVoiceQuestion(false);
        } else if (errType !== 'no-speech' && errType !== 'aborted') {
          console.warn(`Speech recognition status: ${errType}`);
        }
      };

      recognition.onend = () => {
        if (isVoiceListeningActiveRef.current) {
          setTimeout(() => {
            if (isVoiceListeningActiveRef.current && speechRecognitionRef.current) {
              try {
                speechRecognitionRef.current.start();
              } catch (e) {}
            }
          }, 250);
        } else {
          setIsListeningVoiceQuestion(false);
        }
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Error starting speech recognition:', err);
      isVoiceListeningActiveRef.current = false;
      setIsListeningVoiceQuestion(false);
      setMicPermissionError('🔒 Mikrofon başlatılamadı. Lütfen mikrofon iznini aktif edin.');
    }
  };

  const toggleVoiceQuestionListening = async (source: 'topVoice' | 'bottomInput' = 'topVoice') => {
    if (isListeningVoiceQuestion) {
      stopVoiceQuestionListening(false);
    } else {
      startVoiceQuestionListening(source);
    }
  };

  const triggerNoCreditsModal = () => {
    if (onOpenNoCreditsModal) {
      onOpenNoCreditsModal();
    } else {
      onWatchAd();
    }
  };

  const handleVoiceSubmit = async (text?: string, audioData?: string) => {
    const cleanText = (text || '').trim();
    if (!cleanText && !audioData) return;

    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current.abort();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    setIsListeningVoiceQuestion(false);

    if (user.kredi <= 0) {
      triggerNoCreditsModal();
      return;
    }

    setIsScanning(true);
    try {
      const success = await onAnalyzeNewQuestion(null, cleanText || undefined, audioData);
      if (success) {
        setVoiceQuestionTranscript('');
        setTextPrompt('');
        setVoiceRecordingSeconds(0);
      }
    } catch (err) {
      console.error('Error in voice submit:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const sampleImages = [
    {
      id: 'math',
      title: 'Matematik - Denklem',
      url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'physics',
      title: 'Fizik - Kuvvet',
      url: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=800&q=80',
    },
    {
      id: 'chemistry',
      title: 'Kimya - Organik',
      url: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
    },
  ];

  // Stop camera tracks helper
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveCameraOn(false);
  };

  // Start live camera stream
  const startCameraStream = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Cihazınızda kamera erişimi desteklenmiyor.');
      setCameraPermissionState('denied');
      return;
    }

    try {
      // Stop previous stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsLiveCameraOn(true);
      setCameraPermissionState('granted');
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraPermissionState('denied');
      setCameraError('Kamera izinleri alınamadı veya kameraya erişilemiyor.');
      setIsLiveCameraOn(false);
    }
  };

  // Toggle camera flip (front/back)
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
  };

  // React to facing mode changes when camera is already live
  useEffect(() => {
    if (isLiveCameraOn) {
      startCameraStream();
    }
  }, [facingMode]);

  // Clean up media streams on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Check clipboard contents for text or question links
  const checkClipboardForQuestions = async (showNoticeOnSuccess = true) => {
    setClipboardError(null);
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) {
      if (showNoticeOnSuccess) {
        setClipboardError('Pano erişimi cihazınızda desteklenmiyor veya izin yok.');
      }
      return;
    }

    // Do not attempt automatic read if document is not focused to prevent browser warnings
    if (typeof document !== 'undefined' && !document.hasFocus()) {
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed && trimmed.length > 3) {
        setClipboardDetectedText(trimmed);
        if (showNoticeOnSuccess) {
          setIsClipboardNoticeOpen(true);
        }
      } else if (showNoticeOnSuccess) {
        setClipboardError('Panoda kopyalanmış soru metni veya link bulunamadı.');
      }
    } catch (err) {
      // Avoid polluting console on auto-focus clipboard check when document is unfocused or forbidden
      if (showNoticeOnSuccess) {
        setClipboardError('Pano okuma izni verilmedi. Aşağıdaki metin kutusuna yapıştırabilirsiniz.');
      }
    }
  };

  // Auto-detect clipboard when window regains focus
  useEffect(() => {
    const handleWindowFocus = () => {
      checkClipboardForQuestions(false);
    };

    window.addEventListener('focus', handleWindowFocus);
    // Initial silent check
    checkClipboardForQuestions(false);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, []);


  const handleStartClipboardAnalysis = async () => {
    if (!clipboardDetectedText) return;

    if (user.kredi <= 0) {
      triggerNoCreditsModal();
      return;
    }

    setIsScanning(true);
    setIsClipboardNoticeOpen(false);

    const isUrl = clipboardDetectedText.startsWith('http://') || clipboardDetectedText.startsWith('https://');

    try {
      if (isUrl) {
        await onAnalyzeNewQuestion(
          clipboardDetectedText,
          'Web sayfasından veya panodan alınan soru linki analiz ediliyor.'
        );
      } else {
        await onAnalyzeNewQuestion(null, clipboardDetectedText);
      }
    } catch (err) {
      console.error('Error analyzing clipboard text:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleTextSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textPrompt.trim()) return;
    if (user.kredi <= 0) {
      triggerNoCreditsModal();
      return;
    }
    setIsScanning(true);
    try {
      const success = await onAnalyzeNewQuestion(null, textPrompt);
      if (success) {
        setTextPrompt('');
      }
    } catch (err) {
      console.error('Error analyzing text question:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCapture = async (imgUrl?: string) => {
    if (user.kredi <= 0) {
      triggerNoCreditsModal();
      return;
    }

    setIsScanning(true);
    try {
      const targetImage = imgUrl || 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80';
      const promptToPass = textPrompt && textPrompt.trim().length > 0 ? textPrompt.trim() : undefined;

      const success = await onAnalyzeNewQuestion(
        targetImage,
        promptToPass
      );
      if (success) {
        setTextPrompt('');
      }
    } catch (err) {
      console.error('Error analyzing photo question:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Snap photo from live HTML5 camera
  const handleSnapFromLiveCamera = () => {
    if (!isLiveCameraOn || !videoRef.current) {
      // Fallback if camera is off
      handleCapture();
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (canvas && video) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const capturedBase64 = canvas.toDataURL('image/jpeg', 0.88);
        handleCapture(capturedBase64);
        return;
      }
    }
    handleCapture();
  };
  // Direct Native Camera or HTML5 fallback capture
  const handleTakePhoto = async () => {
    setFlashOn(true);
    setTimeout(() => setFlashOn(false), 300);

    if (Capacitor.isNativePlatform()) {
      try {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });
        if (image.dataUrl) {
          handleCapture(image.dataUrl);
          return;
        }
      } catch (camErr: any) {
        console.warn('Native camera capture cancelled or failed:', camErr);
        return;
      }
    }

    if (isLiveCameraOn && videoRef.current) {
      handleSnapFromLiveCamera();
    } else {
      cameraInputRef.current?.click();
    }
  };

  // Direct Native Gallery or HTML5 fallback pick
  const handleOpenGallery = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
        });
        if (image.dataUrl) {
          handleCapture(image.dataUrl);
          return;
        }
      } catch (galErr: any) {
        console.warn('Native gallery pick cancelled or failed:', galErr);
        return;
      }
    }

    galleryInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        handleCapture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-28 animate-fadeIn">
      {/* Hidden Canvas for Live Camera Snapshots */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Status & Credits Progress Card */}
      <section className="bg-card-bg border border-card-border p-3 sm:p-3.5 rounded-2xl shadow-xs space-y-2">
        <div className="flex flex-row items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-base sm:text-lg shrink-0">🎯</span>
            <span className="font-bold text-xs sm:text-sm text-text-main truncate">
              Günlük Soru Çözüm & Öğrenme Modu
            </span>
          </div>
          <span className={`font-extrabold text-[11px] sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-full shrink-0 ${
            user.kredi < 1
              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
              : 'text-primary bg-primary/10'
          }`}>
            {`${user.kredi}/${user.maxKredi} Hak`}
          </span>
        </div>

        <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              user.kredi < 1 ? 'bg-amber-500' : 'bg-primary'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, (user.kredi / user.maxKredi) * 100))}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] sm:text-xs text-text-muted">
          <span className="truncate">Yapay zeka pedagojik tanı asistanın hazır</span>
          <button 
            onClick={onWatchAd}
            className="text-primary font-extrabold hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
          >
            <span>+ Reklam İzle (Ek Hak)</span>
          </button>
        </div>
      </section>

      {/* Clipboard Detected Auto-Banner */}
      {isClipboardNoticeOpen && clipboardDetectedText && (
        <section className="bg-gradient-to-r from-primary/15 via-primary/5 to-primary/10 border-2 border-primary/40 p-4 rounded-2xl shadow-md space-y-3 animate-fadeIn relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-primary text-white material-symbols-outlined text-sm">content_paste_search</span>
              <div>
                <h4 className="font-extrabold text-xs text-text-main">Panoda Kopyalanan Soru Algılandı!</h4>
                <p className="text-[10px] text-text-muted">Pano analiz robotu kopyaladığınız soru metnini/linkini tespit etti.</p>
              </div>
            </div>
            <button
              onClick={() => setIsClipboardNoticeOpen(false)}
              className="text-text-muted hover:text-text-main p-1 cursor-pointer"
              title="Kapat"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          <div className="p-2.5 bg-card-bg/90 border border-card-border rounded-xl text-xs text-text-main font-medium italic line-clamp-2">
            "{clipboardDetectedText}"
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsClipboardNoticeOpen(false)}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-main font-bold cursor-pointer"
            >
              Yoksay
            </button>
            <button
              type="button"
              onClick={handleStartClipboardAnalysis}
              className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-extrabold hover:brightness-110 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              <span>Soru Analizine Başla</span>
            </button>
          </div>
        </section>
      )}

      {/* Camera Viewfinder & Question Upload / Ask Area */}
      <section className="space-y-3">
        <div className="relative w-full aspect-[3/4] sm:aspect-[4/3] rounded-3xl overflow-hidden bg-slate-950 border-4 border-white dark:border-slate-800 shadow-2xl group">
          {/* Live Video element vs Question Capture Canvas */}
          {isLiveCameraOn ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-transform duration-700 ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              } ${isScanning ? 'scale-105 filter brightness-110' : ''}`}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
              {/* Subtle grid pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />

              {/* Animated Laser Scanning Line */}
              <div className={`absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_4px_#22d3ee] pointer-events-none ${isScanning ? 'animate-scan' : 'top-1/2 opacity-75'}`} />

              {/* Center Guidance Content */}
              <div className="relative z-10 flex flex-col items-center space-y-3.5 max-w-sm">
                <div className="w-16 h-16 rounded-3xl bg-primary/20 border-2 border-primary/50 text-white flex items-center justify-center shadow-xl shadow-primary/30 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-3xl text-cyan-300">document_scanner</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-black tracking-widest uppercase text-cyan-400 bg-cyan-950/70 border border-cyan-500/30 px-3 py-1 rounded-full shadow-xs">
                    📸 YAPAY ZEKA SORU ÇÖZÜCÜ
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-white tracking-tight pt-1">
                    Soru Fotoğrafı Çek & Gönder
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed px-1">
                    Kitap, defter veya denemedeki sorunun fotoğrafını çekin; yapay zeka adım adım çözüp püf noktalarını anlatsın.
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleTakePhoto}
                    disabled={isScanning}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-primary/30 active:scale-95 transition-all cursor-pointer flex items-center gap-2 border border-white/20"
                  >
                    <span className="material-symbols-outlined text-lg">photo_camera</span>
                    <span>Fotoğraf Çek</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenGallery}
                    disabled={isScanning}
                    className="px-4 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 border border-white/10"
                  >
                    <span className="material-symbols-outlined text-lg">photo_library</span>
                    <span>Galeriden Seç</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Flash Screen Simulation */}
          {flashOn && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-xs pointer-events-none transition-opacity z-10" />
          )}

          {/* Dark Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

          {/* Top Controls Bar: Centered Mode Switcher Pill */}
          <div className="absolute top-3 left-0 right-0 flex items-center justify-center z-30 px-4">
            <div className="bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2 shadow-lg">
              <button
                type="button"
                onClick={() => setScanMode('scan')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  scanMode === 'scan' ? 'bg-primary text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">photo_camera</span>
                <span>Fotoğrafla</span>
              </button>
              <div className="w-px h-4 bg-white/20" />
              <button
                type="button"
                onClick={() => setScanMode('voice')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  scanMode === 'voice' ? 'bg-primary text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">mic</span>
                <span>Sesle</span>
              </button>
              <div className="w-px h-4 bg-white/20" />
              <button
                type="button"
                onClick={() => setScanMode('text')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  scanMode === 'text' ? 'bg-primary text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">edit_note</span>
                <span>Yazıyla</span>
              </button>
            </div>
          </div>

          {/* Viewfinder Target Brackets & Grid Alignment */}
          <div className="absolute inset-8 sm:inset-12 pointer-events-none border border-white/20 rounded-2xl flex flex-col justify-between p-2">
            <div className="flex justify-between">
              <div className="w-8 h-8 border-t-2 border-l-2 border-primary rounded-tl-lg" />
              <div className="w-8 h-8 border-t-2 border-r-2 border-primary rounded-tr-lg" />
            </div>
            <div className="flex justify-between">
              <div className="w-8 h-8 border-b-2 border-l-2 border-primary rounded-bl-lg" />
              <div className="w-8 h-8 border-b-2 border-r-2 border-primary rounded-br-lg" />
            </div>
          </div>

          {/* Camera Error or Permission Banner overlay */}
          {cameraError && !isLiveCameraOn && (
            <div className="absolute inset-x-4 top-16 bg-slate-900/90 text-white p-3 rounded-2xl border border-amber-500/40 text-center space-y-1 z-20 backdrop-blur-md">
              <div className="text-amber-400 font-extrabold text-xs flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-sm">warning</span>
                <span>Kamera Uyarısı</span>
              </div>
              <p className="text-[11px] text-slate-300">{cameraError}</p>
              <button
                onClick={startCameraStream}
                className="mt-1 px-3 py-1 bg-amber-500 text-slate-950 font-bold text-[10px] rounded-lg hover:bg-amber-400 cursor-pointer"
              >
                Kamerayı Tekrar Dene
              </button>
            </div>
          )}
          {scanMode === 'voice' && (() => {
            const isTopVoiceListening = isListeningVoiceQuestion && activeVoiceSource === 'topVoice';
            return (
              <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 z-20 pt-14 pb-4 overflow-y-auto">
                <div className="flex flex-col items-center justify-center my-auto space-y-3.5 text-center max-w-md mx-auto w-full">
                  {/* Big Mic Button */}
                  <button
                    type="button"
                    onClick={() => toggleVoiceQuestionListening('topVoice')}
                    className={`w-20 h-20 rounded-full flex items-center justify-center border-4 transition-all cursor-pointer shadow-xl ${
                      isTopVoiceListening 
                        ? 'bg-rose-600 text-white border-rose-400 animate-pulse scale-105 shadow-[0_0_30px_rgba(225,29,72,0.6)]' 
                        : 'bg-primary text-white border-primary-container hover:scale-105'
                    }`}
                    title={isTopVoiceListening ? 'Dinlemeyi Durdur' : 'Dinlemeyi Başlat'}
                  >
                    <span className="material-symbols-outlined text-4xl">
                      {isTopVoiceListening ? 'graphic_eq' : 'mic'}
                    </span>
                  </button>

                  <div className="space-y-1">
                    <h4 className="font-extrabold text-sm sm:text-base text-white flex items-center justify-center gap-1.5">
                      {isTopVoiceListening ? (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
                          <span>🎙️ Ses Dinleniyor...</span>
                        </>
                      ) : (
                        <span>🎙️ Sesle Soru Sor</span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-300">
                      {isTopVoiceListening
                        ? 'Sorunuzu mikrofonla konuşun. Bitirince Analiz Et butonuna basın.'
                        : 'Yukarıdaki mikrofon butonuna basarak sorunuzu sesli olarak söyleyebilirsiniz.'}
                    </p>
                  </div>

                  {/* Microphone Permission Warning / Notice */}
                  {micPermissionError && activeVoiceSource === 'topVoice' && (
                    <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 p-2.5 rounded-2xl text-xs max-w-xs animate-fadeIn">
                      <p className="font-bold">{micPermissionError}</p>
                    </div>
                  )}

                  {/* Real-time Voice Transcript Box */}
                  <div className="w-full bg-slate-900/90 border border-white/20 p-3 rounded-2xl text-xs text-white font-medium italic min-h-[55px] flex items-center justify-center text-center">
                    {voiceQuestionTranscript || (isTopVoiceListening ? textPrompt : '') ? (
                      <span>"{voiceQuestionTranscript || textPrompt}"</span>
                    ) : (
                      <span className="text-slate-400">
                        {isTopVoiceListening
                          ? 'Sesiniz dinleniyor, lütfen sorunuzu söyleyin...'
                          : 'Henüz sesli soru başlatılmadı.'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Explicit Voice Action Controls (No Overlap) */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-white/10 shrink-0">
                  {isTopVoiceListening ? (
                    <>
                      <button
                        type="button"
                        onClick={() => stopVoiceQuestionListening(false)}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer shadow-xs"
                        title="Mikrofonu Kapat"
                      >
                        <span className="material-symbols-outlined text-base">stop</span>
                        <span>Durdur</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => stopVoiceQuestionListening(true)}
                        className="bg-primary hover:brightness-110 text-white text-xs font-extrabold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                        title="Analiz Et & Sor"
                      >
                        <span className="material-symbols-outlined text-base">send</span>
                        <span>Analiz Et</span>
                      </button>
                      <button
                        type="button"
                        onClick={cancelVoiceQuestionListening}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer"
                        title="Mikrofonu İptal Et"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                        <span>İptal</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startVoiceQuestionListening('topVoice')}
                        className="bg-primary hover:brightness-110 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <span className="material-symbols-outlined text-base">mic</span>
                        <span>Dinlemeyi Başlat</span>
                      </button>
                      {(voiceQuestionTranscript || textPrompt) && (
                        <button
                          type="button"
                          onClick={() => handleVoiceSubmit(voiceQuestionTranscript || textPrompt)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <span className="material-symbols-outlined text-base">send</span>
                          <span>Soruyu Analiz Et</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Text Mode Overlay within Viewfinder */}
          {scanMode === 'text' && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 z-20 pt-16 pb-4 overflow-y-auto animate-fadeIn">
              <div className="max-w-md mx-auto w-full my-auto space-y-3">
                <div className="flex items-center gap-2 text-white">
                  <span className="material-symbols-outlined text-primary text-xl">edit_note</span>
                  <h4 className="font-extrabold text-sm sm:text-base">Yazıyla Soru Sor</h4>
                </div>
                <textarea
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
                  placeholder="Çözülmesini istediğiniz soru metnini buraya yazın veya yapıştırın..."
                  rows={4}
                  className="w-full bg-slate-900 border border-white/20 rounded-2xl p-3.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-primary resize-none font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleTextSubmit()}
                  disabled={!textPrompt.trim() || isScanning}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-500 text-white font-black text-xs shadow-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">psychology</span>
                  <span>Yapay Zekaya Sor & Çöz</span>
                </button>
              </div>
            </div>
          )}

          {/* Scanning Overlay State */}
          {isScanning && (
            <div className="absolute inset-0 bg-primary/20 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20 space-y-2">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
              <p className="font-extrabold text-sm tracking-wide bg-slate-900/80 px-4 py-1.5 rounded-full border border-white/20">
                Görsel Analiz Ediliyor & Hata Teşhisi Koyuluyor...
              </p>
            </div>
          )}

          {/* Hidden Inputs for Gallery & Camera Upload */}
          <input
            type="file"
            ref={galleryInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="camera"
            className="hidden"
          />

          {/* Camera Facing Flip (Only when live camera stream is active, positioned cleanly in corner) */}
          {scanMode === 'scan' && isLiveCameraOn && (
            <div className="absolute bottom-4 right-4 z-20">
              <button
                type="button"
                onClick={toggleFacingMode}
                className="w-11 h-11 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/30 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-md"
                title="Ön/Arka Kamera Değiştir"
              >
                <span className="material-symbols-outlined text-lg">cameraswitch</span>
              </button>
            </div>
          )}
        </div>

        {/* Informational Banner */}
        <div className="bg-surface-container-low p-3 rounded-xl flex items-center gap-2 text-xs text-text-muted border border-card-border justify-center">
          <span className="material-symbols-outlined text-primary text-base">info</span>
          <span>Net bir pedagojik analiz için sorunun fotoğrafını çekin veya yükleyin.</span>
        </div>
      </section>

      {/* Prominent Daily Study Schedule & Camp Section (Elevated to Home) */}
      <TodayScheduleSection
        scheduleItems={scheduleItems}
        onToggleItem={onToggleScheduleItem || (() => {})}
        onOpenCustomProgramModal={() => setIsCustomProgramModalOpen(true)}
        setActiveTab={setActiveTab}
        onOpenPomodoro={onOpenPomodoro}
        onOpenSchedule={onOpenSchedule}
      />

      {/* Ebbinghaus - Today's Spaced Repetition Due Card (Compact & Click to Expand) */}
      <TodayRepetitionCard
        questions={questions}
        onSelectQuestion={onSelectQuestion}
        onUpdateQuestions={onUpdateQuestions}
        onStartQuiz={onStartQuiz}
        onStartSession={onStartSession}
        setActiveTab={setActiveTab}
      />

      {/* Quick Access Feature Cards Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Pomodoro Focus Timer Card */}
        <div 
          onClick={() => {
            if (onOpenPomodoro) {
              onOpenPomodoro();
            } else {
              setActiveTab('schedule');
            }
          }}
          className="bg-card-bg p-4 rounded-2xl border border-rose-500/30 shadow-xs hover:border-rose-500 transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3 group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <span className="text-xl">🍅</span>
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-text-main mb-0.5 flex items-center justify-between">
              <span>Pomodoro</span>
              <span className="text-[10px] font-black bg-rose-500/15 text-rose-500 px-2 py-0.5 rounded-full">25 Dk</span>
            </h3>
            <p className="text-[11px] text-text-muted">Ders & Mola Zamanlayıcısı</p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-card-border">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className="text-[10px] font-bold text-rose-500">Odaklanma Modu</span>
          </div>
        </div>

        {/* Yanlış Havuzu Card */}
        <div 
          onClick={() => setActiveTab('errorPool')}
          className="bg-card-bg p-4 rounded-2xl border border-card-border shadow-xs hover:border-primary/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined">history_edu</span>
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-text-main mb-0.5">Yanlış Havuzu</h3>
            <p className="text-[11px] text-text-muted">Aralıklı Tekrar & Unutma Eğrisi</p>
          </div>
          <div className="mt-3 flex items-center gap-1 pt-2 border-t border-card-border">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <span className="text-[10px] font-bold text-rose-500 truncate">{recentQuestionsCount} Kayıtlı Soru</span>
          </div>
        </div>

        {/* Özel Kamp Planlayıcı Card */}
        <div 
          onClick={() => setIsCustomProgramModalOpen(true)}
          className="bg-card-bg p-4 rounded-2xl border border-indigo-500/30 shadow-xs hover:border-indigo-500 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <span className="material-symbols-outlined">auto_awesome</span>
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-text-main mb-0.5">Özel Kamp Planı</h3>
            <p className="text-[11px] text-text-muted">YKS / KPSS / Sınıf Konu Kampı</p>
          </div>
          <div className="mt-3 flex items-center gap-1 pt-2 border-t border-card-border">
            <span className="material-symbols-outlined text-xs text-indigo-500">add_task</span>
            <span className="text-[10px] font-bold text-indigo-500">Otomatik Dağıtım</span>
          </div>
        </div>

        {/* Deneme Takibi & Net Analizi Card */}
        <div 
          onClick={() => setActiveTab('deneme')}
          className="bg-card-bg p-4 rounded-2xl border border-card-border shadow-xs hover:border-primary/50 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-3 group-hover:bg-secondary group-hover:text-white transition-colors">
              <span className="material-symbols-outlined">analytics</span>
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-text-main mb-0.5">Deneme Takibi</h3>
            <p className="text-[11px] text-text-muted">Net Grafikleri & Gelişim</p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 pt-2 border-t border-card-border">
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              Haftalık Net Raporu
            </span>
          </div>
        </div>

        {/* Veli Bağlantısı & Takip Card */}
        <div 
          onClick={() => setIsParentConnectModalOpen(true)}
          className="bg-card-bg p-4 rounded-2xl border border-purple-500/30 shadow-xs hover:border-purple-500 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-3 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <span className="material-symbols-outlined">family_restroom</span>
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-text-main mb-0.5">Veli Bağlantısı</h3>
            <p className="text-[11px] text-text-muted">Öğrenci Gelişim Takip Modu</p>
          </div>
          <div className="mt-3 flex items-center gap-1 pt-2 border-t border-card-border">
            <span className={`w-2 h-2 rounded-full ${user.parentConnected ? 'bg-emerald-500' : 'bg-purple-500'} shrink-0`} />
            <span className="text-[10px] font-bold text-purple-500">
              {user.parentConnected ? 'Veli Bağlı' : 'Veli Davet Et'}
            </span>
          </div>
        </div>

        {/* Hedef Sınav Geri Sayımı Card */}
        <div 
          onClick={() => {
            if (onOpenExamCountdown) {
              onOpenExamCountdown();
            } else {
              setActiveTab('profile');
            }
          }}
          className="bg-card-bg p-4 rounded-2xl border border-amber-500/30 shadow-xs hover:border-amber-500 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <span className="material-symbols-outlined">hourglass_top</span>
            </div>
            <h3 className="font-extrabold text-sm sm:text-base text-text-main mb-0.5">Sınav Sayacı</h3>
            <p className="text-[11px] text-text-muted">Hedef Sınav: {user.targetExam || 'YKS / LGS'}</p>
          </div>
          <div className="mt-3 flex items-center gap-1 pt-2 border-t border-card-border">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
              Kalan Gün & Hedef Takibi
            </span>
          </div>
        </div>
      </section>

      {/* Kaydedilen Notlar (Saved Notes) Section */}
      <SavedNotesSection
        questions={questions}
        onSelectQuestion={onSelectQuestion}
        onUpdateQuestions={onUpdateQuestions}
        setActiveTab={setActiveTab}
      />

      {/* Custom Program Wizard Modal */}
      <CustomProgramModal
        isOpen={isCustomProgramModalOpen}
        onClose={() => setIsCustomProgramModalOpen(false)}
        onAddMultipleItems={(items) => {
          if (onAddMultipleScheduleItems) {
            onAddMultipleScheduleItems(items);
          }
        }}
        showToast={showHomeToast}
        setActiveTab={setActiveTab}
      />

      {/* Parent Connect & Monitoring Modal */}
      <ParentConnectModal
        isOpen={isParentConnectModalOpen}
        onClose={() => setIsParentConnectModalOpen(false)}
        currentUser={user}
        scheduleItems={scheduleItems}
        questions={questions}
        showToast={showHomeToast}
        onUpdateUser={onUpdateUser}
      />

      {/* Local Toast Alert */}
      {homeToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white font-bold text-xs px-5 py-3 rounded-full shadow-2xl border border-white/20 animate-fadeIn flex items-center gap-2 pointer-events-none">
          <span className="material-symbols-outlined text-base text-primary">auto_awesome</span>
          <span>{homeToast}</span>
        </div>
      )}
    </div>
  );
};

