import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';

export async function requestSpeechPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const status = await SpeechRecognition.checkPermissions();
    if (status?.speechRecognition !== 'granted') {
      const req = await SpeechRecognition.requestPermissions();
      return req?.speechRecognition === 'granted';
    }
    return true;
  } catch (err) {
    console.warn('Speech permission check:', err);
    return true;
  }
}

export async function startNativeSpeechRecognition(
  onResult: (text: string) => void,
  onError?: (err: any) => void
): Promise<() => void> {
  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  // 1. PRIMARY ENGINE: Web / WebView SpeechRecognition (Standard Android WebView engine)
  if (SpeechRecognitionClass) {
    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'tr-TR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let isManuallyStopped = false;

      recognition.onresult = (e: any) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = 0; i < e.results.length; ++i) {
          const trans = e.results[i][0]?.transcript || '';
          if (e.results[i].isFinal) {
            finalTrans += trans + ' ';
          } else {
            interimTrans += trans;
          }
        }
        const full = (finalTrans + interimTrans).replace(/\s+/g, ' ').trim();
        if (full) {
          onResult(full);
        }
      };

      recognition.onerror = (err: any) => {
        if (err.error === 'no-speech' || err.error === 'aborted') return;
        console.warn('Speech recognition warning:', err.error);
        if (onError) onError(err);
      };

      recognition.onend = () => {
        if (!isManuallyStopped) {
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      recognition.start();

      return () => {
        isManuallyStopped = true;
        recognition.onend = null;
        try { recognition.stop(); } catch (e) {}
        try { recognition.abort(); } catch (e) {}
      };
    } catch (err) {
      console.warn('Web SpeechRecognition init failed, checking plugin:', err);
    }
  }

  // 2. BACKUP ENGINE: Capacitor Native Speech Recognition Plugin
  if (Capacitor.isNativePlatform()) {
    try {
      await requestSpeechPermission();
      try { await SpeechRecognition.stop(); } catch (e) {}

      let lastDelivered = '';
      const partialListener = await SpeechRecognition.addListener(
        'partialResults',
        (data: { matches: string[] }) => {
          if (data?.matches && data.matches.length > 0) {
            const latest = data.matches[0]?.trim() ?? '';
            if (latest && latest !== lastDelivered) {
              lastDelivered = latest;
              onResult(latest);
            }
          }
        }
      );

      try {
        await SpeechRecognition.start({
          language: 'tr-TR',
          maxResults: 5,
          prompt: 'Sorunuzu söyleyin...',
          partialResults: true,
          popup: false,
        });
      } catch (silentErr) {
        // Fallback to official Google Voice popup
        const res: any = await SpeechRecognition.start({
          language: 'tr-TR',
          maxResults: 5,
          prompt: 'Sorunuzu söyleyin...',
          partialResults: false,
          popup: true,
        });
        if (res?.matches && res.matches.length > 0) {
          onResult(res.matches[0]);
        }
      }

      return async () => {
        lastDelivered = '';
        try { if (partialListener) await partialListener.remove(); } catch (e) {}
        try { await SpeechRecognition.stop(); } catch (e) {}
      };
    } catch (pluginErr) {
      console.warn('Plugin speech start failed:', pluginErr);
      if (onError) onError(pluginErr);
    }
  }

  return () => {};
}
