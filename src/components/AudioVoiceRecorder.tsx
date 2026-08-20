import React, { useState, useRef, useEffect } from 'react';

interface AudioVoiceRecorderProps {
  audioUrl?: string;
  onSaveAudio: (dataUrl: string) => void;
  onDeleteAudio: () => void;
}

export const AudioVoiceRecorder: React.FC<AudioVoiceRecorderProps> = ({
  audioUrl,
  onSaveAudio,
  onDeleteAudio,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<string | undefined>(audioUrl);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setCurrentAudio(audioUrl);
  }, [audioUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const requestMicPermission = async (): Promise<MediaStream | null> => {
    setErrorMessage(null);

    const isCapacitorNative = Boolean((window as any).Capacitor?.isNativePlatform?.());

    if (!isCapacitorNative && typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setErrorMessage('🔒 Güvenli Bağlantı Uyarısı: Ses kaydı için güvenli bir ağ veya HTTPS bağlantısı gerekmektedir.');
      return null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Cihazınızda ses kayıt mikrofon erişimi desteklenmiyor.');
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return stream;
    } catch (err: any) {
      console.error('Microphone permission error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('🔒 Mikrofon izni reddedildi. Lütfen cihaz ayarlarınızdan uygulamanın mikrofon iznini aktif edin.');
      } else {
        setErrorMessage('🔒 Mikrofona ulaşılamadı. Cihazınızda mikrofon bulunduğundan ve uygulamaya izin verildiğinden emin olun.');
      }
      return null;
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    audioChunksRef.current = [];
    setRecordingSeconds(0);

    const stream = await requestMicPermission();
    if (!stream) {
      setIsRecording(false);
      return;
    }

    try {
      mediaStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();

        reader.onloadend = () => {
          const result = reader.result as string;
          if (result) {
            setCurrentAudio(result);
            onSaveAudio(result);
          }
        };

        reader.readAsDataURL(audioBlob);

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start(200);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('MediaRecorder start error:', err);
      setErrorMessage('Mikrofon kaydı başlatılamadı.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleClear = () => {
    setCurrentAudio(undefined);
    onDeleteAudio();
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 bg-surface-container-low rounded-2xl border border-card-border space-y-3.5 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-lg">mic</span>
          </div>
          <div>
            <h4 className="font-extrabold text-xs text-text-main">Ses Kaydı</h4>
            <p className="text-[10px] text-text-muted">Kendi sesinizle soruya dair sesli notunuzu kaydedin</p>
          </div>
        </div>

        {currentAudio && !isRecording && (
          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Sesli Not Kayıtlı
          </span>
        )}
      </div>

      {/* Recording Control Button */}
      {!isRecording ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={startRecording}
            className="flex-1 py-3 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">mic</span>
            <span>{currentAudio ? 'Yeniden Ses Kaydı Yap' : 'Ses Kaydı Başlat'}</span>
          </button>

          {currentAudio && (
            <button
              type="button"
              onClick={handleClear}
              className="py-3 px-3 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="Kayıtlı Sesli Notu Sil"
            >
              <span className="material-symbols-outlined text-base">delete</span>
              <span>Kayıtlı Notu Sil</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-rose-500/10 border-2 border-rose-500 rounded-xl p-3 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="relative w-4 h-4">
              <span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600" />
            </div>
            <div>
              <span className="text-xs font-black text-rose-600 dark:text-rose-400 block">
                Mikrofon Kaydediyor...
              </span>
              <span className="text-xs font-mono font-bold text-text-main">
                Süre: {formatTime(recordingSeconds)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">stop_circle</span>
            <span>Kaydı Durdur ve Kaydet</span>
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Audio Playback Player */}
      {currentAudio && !isRecording && (
        <div className="bg-card-bg p-3 rounded-xl border border-card-border space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold text-text-main">
            <span className="flex items-center gap-1.5 text-primary">
              <span className="material-symbols-outlined text-base">graphic_eq</span>
              <span>Sesli Notu Dinle</span>
            </span>
          </div>

          <audio
            src={currentAudio}
            controls
            className="w-full h-9 rounded-lg border border-card-border accent-primary"
          />
        </div>
      )}
    </div>
  );
};
