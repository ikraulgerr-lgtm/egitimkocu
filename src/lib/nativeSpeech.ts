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
  // If running on web browser, fallback to Web Speech API
  if (!Capacitor.isNativePlatform()) {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      if (onError) onError('Cihazınızda ses tanıma bulunamadı.');
      return () => {};
    }
    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = true;

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
      if (full) onResult(full);
    };

    recognition.onerror = (err: any) => {
      console.warn('Web speech recognition error:', err);
    };

    recognition.start();
    return () => {
      try { recognition.stop(); } catch (e) {}
    };
  }

  // Native Android & iOS Speech Recognition
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

    const listenerHandle = await SpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
      if (data && data.matches && data.matches.length > 0) {
        const latestText = data.matches[0];
        if (latestText) {
          onResult(latestText);
        }
      }
    });

    await SpeechRecognition.start({
      language: 'tr-TR',
      maxResults: 5,
      prompt: 'Sorunuzu söyleyin...',
      partialResults: true,
      popup: false,
    });

    return async () => {
      try {
        if (listenerHandle) {
          await listenerHandle.remove();
        }
        await SpeechRecognition.stop();
      } catch (e) {}
    };
  } catch (err) {
    console.warn('Native speech recognition start failed:', err);
    if (onError) onError(err);
    return () => {};
  }
}
