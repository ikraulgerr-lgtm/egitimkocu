import React, { useState, useRef, useEffect } from 'react';
import { Kullanici, SoruKaydi, ActiveTab } from '../types';
import { TodayRepetitionCard } from './TodayRepetitionCard';
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
}) => {
  const [scanMode, setScanMode] = useState<'scan' | 'voice'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [textPrompt, setTextPrompt] = useState('');

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
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListeningVoiceQuestion(true);
        setMicPermissionError(null);
      };

      recognition.onresult = (e: any) => {
        let interimText = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          const piece = (e.results[i][0]?.transcript || '').trim();
          if (e.results[i].isFinal) {
            sessionFinalTextRef.current += (sessionFinalTextRef.current ? ' ' : '') + piece;
          } else {
            interimText += (interimText ? ' ' : '') + piece;
          }
        }
        
        const combined = [baseTextBeforeMicRef.current, sessionFinalTextRef.current, interimText]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (combined) {
          setVoiceQuestionTranscript(combined);
          setTextPrompt(combined);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        const errType = e?.error || '';
        if (errType === 'not-allowed' || errType === 'permission-denied') {
          setMicPermissionError('🔒 Mikrofon İzni Reddedildi.');
          isVoiceListeningActiveRef.current = false;
          setIsListeningVoiceQuestion(false);
        } else if (errType !== 'no-speech' && errType !== 'aborted') {
          setMicPermissionError(`⚠️ Mikrofon uyarısı: ${errType}`);
        }
      };

      recognition.onend = () => {
        if (isVoiceListeningActiveRef.current) {
          baseTextBeforeMicRef.current = [baseTextBeforeMicRef.current, sessionFinalTextRef.current]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          sessionFinalTextRef.current = '';
          try {
            recognition.start();
          } catch (e) {}
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

    if (!user.isPremium && user.kredi <= 0) {
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

    if (!user.isPremium && user.kredi <= 0) {
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

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textPrompt.trim()) return;
    if (!user.isPremium && user.kredi <= 0) {
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
    if (!user.isPremium && user.kredi <= 0) {
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
            !user.isPremium && user.kredi < 1
              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
              : 'text-primary bg-primary/10'
          }`}>
            {user.isPremium ? 'Sınırsız PRO' : `${user.kredi}/${user.maxKredi} Hak`}
          </span>
        </div>

        <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              !user.isPremium && user.kredi < 1 ? 'bg-amber-500' : 'bg-primary'
            }`}
            style={{ width: user.isPremium ? '100%' : `${(user.kredi / user.maxKredi) * 100}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] sm:text-xs text-text-muted">
          <span className="truncate">Yapay zeka pedagojik tanı asistanın hazır</span>
          {!user.isPremium && (
            <button 
              onClick={onWatchAd}
              className="text-primary font-extrabold hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
            >
              <span>+ Reklam İzle (Ek Hak)</span>
            </button>
          )}
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
          {/* Live Video element vs Static Image */}
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
            <img 
              src="https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1000&q=80" 
              alt="Camera Viewport"
              className={`w-full h-full object-cover transition-transform duration-700 ${isScanning ? 'scale-105 filter brightness-110' : 'group-hover:scale-105'}`}
            />
          )}

          {/* Flash Screen Simulation */}
          {flashOn && (
            <div className="absolute inset-0 bg-white/40 backdrop-blur-xs pointer-events-none transition-opacity z-10" />
          )}

          {/* Dark Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

          {/* Animated Scanner Line */}
          <div className={`absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary-container to-transparent shadow-[0_0_15px_3px_#6c5ce7] ${isScanning ? 'animate-scan' : 'top-1/2 opacity-70'}`} />

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
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                <span>Soru Tara</span>
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
                <span>Sesle Soru Sor</span>
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

          {/* Scanning Overlay State */}
          {isScanning && (
            <div className="absolute inset-0 bg-primary/20 backdrop-blur-xs flex flex-col items-center justify-center text-white z-20 space-y-2">
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
              <p className="font-extrabold text-sm tracking-wide bg-slate-900/80 px-4 py-1.5 rounded-full border border-white/20">
                Görsel Analiz Ediliyor & Hata Teşhisi Koyuluyor...
              </p>
            </div>
          )}

          {/* Camera Bottom Controls (Only visible in Scan mode) */}
          {scanMode === 'scan' && (
            <div className="absolute bottom-4 left-0 right-0 px-6 flex justify-between items-center z-20">
              {/* Left Button: Gallery / Photo Library Upload Button */}
              <button
                type="button"
                onClick={handleOpenGallery}
                className="w-12 h-12 rounded-full bg-slate-900/80 backdrop-blur-md text-white border border-white/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all cursor-pointer"
                title="Fotoğraf Kitaplığından veya Dosyalardan Seç"
              >
                <span className="material-symbols-outlined">photo_library</span>
              </button>

              {/* Hidden Input for Gallery / File Upload (NO capture attr = opens gallery/files picker) */}
              <input
                type="file"
                ref={galleryInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {/* Hidden Input for Direct Camera Capture (capture="camera" forces camera-only on Android) */}
              <input
                type="file"
                ref={cameraInputRef}
                onChange={handleFileChange}
                accept="image/*"
                capture="camera"
                className="hidden"
              />

              {/* Center Button: Camera Shutter */}
              <button
                type="button"
                onClick={handleTakePhoto}
                disabled={isScanning}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1 group/shutter active:scale-90 transition-transform cursor-pointer shadow-xl relative"
                title="Fotoğraf Çek ve Yapay Zeka İle Analiz Et"
              >
                <div className="w-full h-full bg-primary rounded-full shadow-lg group-hover/shutter:bg-primary-container transition-colors flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-3xl">photo_camera</span>
                </div>
                <span className="absolute -bottom-1 text-[9px] font-black bg-primary text-white px-2 py-0.5 rounded-full border border-white shadow-xs">
                  ÇEK
                </span>
              </button>

              {/* Camera Facing Flip (Only when live camera stream is active) */}
              <div className="flex items-center gap-2 min-w-[48px] justify-end">
                {isLiveCameraOn ? (
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="w-12 h-12 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/30 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-md"
                    title="Ön/Arka Kamera Değiştir"
                  >
                    <span className="material-symbols-outlined">cameraswitch</span>
                  </button>
                ) : (
                  <div className="w-12 h-12" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Informational Banner */}
        <div className="bg-surface-container-low p-3 rounded-xl flex items-center gap-2 text-xs text-text-muted border border-card-border justify-center">
          <span className="material-symbols-outlined text-primary text-base">info</span>
          <span>Net bir pedagojik analiz için sorunun fotoğrafını çekin veya yükleyin.</span>
        </div>

        {/* Text Input Section for Custom Question Asking */}
        <form onSubmit={handleTextSubmit} className="bg-card-bg p-4 rounded-2xl border border-card-border space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label htmlFor="customQuestionText" className="font-extrabold text-xs text-text-main flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">edit_note</span>
              <span>Veya Sorunu Metin / Sesle Gir:</span>
            </label>
            <span className="text-[10px] text-text-muted font-medium">AI Pedagoji Anında Yanıtlar</span>
          </div>

          {/* Voice Listening Status Banner if active */}
          {isListeningVoiceQuestion && (
            <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-primary/10 border border-rose-500/30 p-3 rounded-xl flex items-center justify-between gap-2 flex-wrap animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
                <div className="text-xs">
                  <p className="font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <span>🎙️ Mikrofon Dinliyor...</span>
                  </p>
                  <p className="text-[10px] text-text-muted font-medium">Konuşun, metin kutusuna yazılacaktır.</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => stopVoiceQuestionListening(false)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 flex-shrink-0 shadow-xs"
                  title="Mikrofonu Kapat (Metni Düzenlemek İçin Sakla)"
                >
                  <span className="material-symbols-outlined text-xs">mic_off</span>
                  <span>Kapat</span>
                </button>
                <button
                  type="button"
                  onClick={() => stopVoiceQuestionListening(true)}
                  className="bg-primary hover:brightness-110 text-white font-extrabold text-[11px] px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 flex-shrink-0 shadow-xs"
                  title="Analiz Et & Sor"
                >
                  <span className="material-symbols-outlined text-xs">send</span>
                  <span>Analiz Et</span>
                </button>
                <button
                  type="button"
                  onClick={cancelVoiceQuestionListening}
                  className="bg-slate-200 dark:bg-slate-800 text-text-muted hover:text-text-main font-bold text-[11px] px-2 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 flex-shrink-0"
                  title="İptal Et ve Temizle"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            </div>
          )}

          {micPermissionError && (
            <div className="bg-red-100 dark:bg-red-950/80 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded-xl text-xs font-extrabold shadow-xs space-y-2">
              <div className="flex items-start gap-1.5">
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                <span>{micPermissionError}</span>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={startVoiceQuestionListening}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black text-xs flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">mic</span>
                  <span>🎙️ Mikrofon İznini Tekrar İste</span>
                </button>
              </div>
            </div>
          )}

          {clipboardError && (
            <div className="bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 p-2.5 rounded-xl text-xs font-extrabold flex items-center justify-between shadow-xs">
              <span>{clipboardError}</span>
              <button
                type="button"
                onClick={() => setClipboardError(null)}
                className="text-amber-900 dark:text-amber-200 hover:opacity-75 text-xs font-black cursor-pointer px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Bottom Text Question Input */}
          {(() => {
            const isBottomVoiceListening = isListeningVoiceQuestion && activeVoiceSource === 'bottomInput';
            return (
              <>
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-text-muted">Metin ile Soru Sor:</span>
                </div>

                <div className="flex gap-2">
                  <textarea
                    id="customQuestionText"
                    value={textPrompt}
                    onChange={(e) => setTextPrompt(e.target.value)}
                    placeholder={isBottomVoiceListening ? "Dinleniyor, sorunuzu söyleyin..." : "Sorunuzu yazın veya sesle söyleyin..."}
                    rows={2}
                    className={`flex-1 bg-surface-container-low border ${
                      isBottomVoiceListening ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-card-border'
                    } rounded-xl p-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary resize-none font-medium transition-all`}
                  />
                  <div className="flex flex-col gap-1.5 min-w-[82px]">
                    <button
                      type="button"
                      onClick={() => {
                        if (isBottomVoiceListening) {
                          stopVoiceQuestionListening(false);
                        } else {
                          startVoiceQuestionListening('bottomInput');
                        }
                      }}
                      className={`flex-1 font-extrabold text-[11px] px-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        isBottomVoiceListening
                          ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse shadow-sm'
                          : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                      }`}
                      title={isBottomVoiceListening ? 'Mikrofonu Kapat' : 'Sesle Soru Yaz'}
                    >
                      <span className="material-symbols-outlined text-base">
                        {isBottomVoiceListening ? 'mic_off' : 'mic'}
                      </span>
                      <span className="hidden sm:inline">{isBottomVoiceListening ? 'Kapat' : 'Sesle'}</span>
                    </button>
                    <button
                      type="submit"
                      disabled={!textPrompt.trim() || isScanning}
                      className="flex-1 bg-primary text-white font-extrabold text-xs px-2.5 rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-base">send</span>
                      <span>Sor</span>
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </form>
      </section>

      {/* Ebbinghaus - Today's Spaced Repetition Due Card */}
      <TodayRepetitionCard
        questions={questions}
        onSelectQuestion={onSelectQuestion}
        onUpdateQuestions={onUpdateQuestions}
        onStartQuiz={onStartQuiz}
        onStartSession={onStartSession}
        setActiveTab={setActiveTab}
      />

      {/* Quick Access Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Pomodoro Focus Timer Card */}
        <div 
          onClick={() => setActiveTab('schedule')}
          className="bg-card-bg p-4 rounded-2xl border border-rose-500/30 shadow-xs hover:border-rose-500 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3 group-hover:bg-rose-600 group-hover:text-white transition-colors">
            <span className="text-xl">🍅</span>
          </div>
          <h3 className="font-extrabold text-base text-text-main mb-0.5 flex items-center justify-between">
            <span>Pomodoro Odaklanma</span>
            <span className="text-[10px] font-black bg-rose-500/15 text-rose-500 px-2 py-0.5 rounded-full">25 Dk</span>
          </h3>
          <p className="text-xs text-text-muted">Ders Programı & Mola Zamanlayıcısı</p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[11px] font-bold text-rose-500">Odaklanma Modu</span>
          </div>
        </div>

        {/* Yanlış Havuzu Card */}
        <div 
          onClick={() => setActiveTab('errorPool')}
          className="bg-card-bg p-4 rounded-2xl border border-card-border shadow-xs hover:border-primary/50 transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:bg-primary group-hover:text-white transition-colors">
            <span className="material-symbols-outlined">history_edu</span>
          </div>
          <h3 className="font-extrabold text-base text-text-main mb-0.5">Yanlış Havuzu</h3>
          <p className="text-xs text-text-muted">Aralıklı Tekrar & Unutma Eğrisi</p>
          <div className="mt-3 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[11px] font-bold text-rose-500">{recentQuestionsCount} Kayıtlı Soru</span>
          </div>
        </div>

        {/* Hata Analizi Card */}
        <div 
          onClick={() => setActiveTab('stats')}
          className="bg-card-bg p-4 rounded-2xl border border-card-border shadow-xs hover:border-primary/50 transition-all cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-3 group-hover:bg-secondary group-hover:text-white transition-colors">
            <span className="material-symbols-outlined">analytics</span>
          </div>
          <h3 className="font-extrabold text-base text-text-main mb-0.5">Hata Analizi</h3>
          <p className="text-xs text-text-muted">Haftalık Rapor & Teşhis</p>
          <div className="mt-3 flex items-center gap-1.5">
            {questions.length > 0 ? (
              <>
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  %{Math.max(0, Math.round(((questions.length - questions.filter((q) => q.isSaved).length) / questions.length) * 100))} Başarı
                </span>
                <span className="text-[10px] text-text-muted">Gelişim Analizi</span>
              </>
            ) : (
              <>
                <span className="text-[10px] font-bold bg-slate-500/10 text-slate-500 px-2 py-0.5 rounded-full">
                  Henüz Soru Yok
                </span>
                <span className="text-[10px] text-text-muted">Sıfırlandı</span>
              </>
            )}
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
    </div>
  );
};

