import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Capacitor } from '@capacitor/core';

export async function requestSpeechPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const status = await SpeechRecognition.checkPermissions();
    if (status.speechRecognition !== 'granted') {
      const req = await SpeechRecognition.requestPermissions();
      return req.speechRecognition === 'granted';
    }
    return true;
  } catch (err) {
    console.warn('Speech permission error:', err);
    return false;
  }
}

export async function startNativeSpeechRecognition(
  onResult: (text: string) => void,
  onError?: (err: any) => void
): Promise<() => void> {
  // 1. WEB BROWSER FALLBACK (Using HTML5 Web Speech API)
  if (!Capacitor.isNativePlatform()) {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      if (onError) onError('Cihazınızda ses tanıma bulunamadı.');
      return () => {};
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.lang = 'tr-TR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (e: any) => {
        let fullTranscript = '';
        for (let i = 0; i < e.results.length; i++) {
          fullTranscript += e.results[i][0]?.transcript || '';
        }
        const clean = fullTranscript.trim();
        if (clean) {
          onResult(clean);
        }
      };

      recognition.onerror = (err: any) => {
        if (err.error === 'no-speech' || err.error === 'aborted') return;
        console.warn('Web speech recognition error:', err.error);
        if (onError) onError(err);
      };

      recognition.onend = () => {
        // Recognition completed
      };

      recognition.start();

      return () => {
        try { recognition.stop(); } catch (e) {}
        try { recognition.abort(); } catch (e) {}
      };
    } catch (err) {
      console.warn('Web speech start failed:', err);
      if (onError) onError(err);
      return () => {};
    }
  }

  // 2. NATIVE ANDROID / iOS (Using @capacitor-community/speech-recognition)
  try {
    const isAvailable = await SpeechRecognition.available();
    if (!isAvailable.available) {
      if (onError) onError('Cihazınızda ses tanıma kullanılabilir değil.');
      return () => {};
    }

    const permitted = await requestSpeechPermission();
    if (!permitted) {
      if (onError) onError('Mikrofon izni verilmedi.');
      return () => {};
    }

    // Stop any existing session
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

    await SpeechRecognition.start({
      language: 'tr-TR',
      maxResults: 5,
      prompt: 'Sorunuzu söyleyin...',
      partialResults: true,
      popup: false,
    });

    return async () => {
      lastDelivered = '';
      try {
        if (partialListener) {
          await partialListener.remove();
        }
      } catch (e) {}
      try {
        await SpeechRecognition.stop();
      } catch (e) {}
    };
  } catch (err) {
    console.warn('Native speech recognition start failed:', err);
    if (onError) onError(err);
    return () => {};
  }
}
