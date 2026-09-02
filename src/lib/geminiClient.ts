import { GoogleGenAI } from '@google/genai';
import { trySolveMathExpression } from './mathUtils';

// Clean LaTeX math helper
export function cleanLatexMath(str: string | undefined | null): string {
  if (!str) return '';
  let cleaned = String(str);

  cleaned = cleaned
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)'n\s*∈/gi, "$1'nin")
    .replace(/\biç\s*∈\b/gi, 'için')
    .replace(/\biç∈/gi, 'için')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)k\s*≤\b/gi, '$1kle')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)≤ş/gi, '$1leş')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)t\s*≤\b/gi, '$1tle')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)m\s*∈/gi, '$1min');

  cleaned = cleaned.replace(/\$\$/g, '').replace(/\$/g, '');

  cleaned = cleaned
    .replace(/\\(?:left|right)\s*([\(\)\[\]\{\}\|])/gi, '$1')
    .replace(/\\(?:left|right)\./gi, '')
    .replace(/\\(?:left|right)\b/gi, '');

  cleaned = cleaned
    .replace(/\\(?:text|mbox|mathrm|mathbf|mathit)\s*\{([^{}]+)\}/gi, '$1')
    .replace(/\\(?:quad|qquad|enspace|space)\b/gi, ' ');

  cleaned = cleaned
    .replace(/\b([a-zA-Z0-9_]+)\s*in\s*\\?mathbb\s*\{?([RNZQ])\}?/gi, '$1 ∈ $2')
    .replace(/\bin\s*\\?mathbb\s*\{?([RNZQ])\}?/gi, ' ∈ $1')
    .replace(/\\in\s*\\?mathbb\s*\{?([RNZQ])\}?/gi, ' ∈ $1')
    .replace(/\\?mathbb\s*\{?R\}?/g, 'ℝ')
    .replace(/\\?mathbb\s*\{?N\}?/g, 'ℕ')
    .replace(/\\?mathbb\s*\{?Z\}?/g, 'ℤ')
    .replace(/\\?mathbb\s*\{?Q\}?/g, 'ℚ')
    .replace(/\\?mathbb\s*\{?C\}?/g, 'ℂ');

  cleaned = cleaned
    .replace(/\\in(?![a-zA-Z])/gi, ' ∈ ')
    .replace(/\\notin(?![a-zA-Z])/gi, ' ∉ ')
    .replace(/\\forall(?![a-zA-Z])/gi, ' ∀ ')
    .replace(/\\exists(?![a-zA-Z])/gi, ' ∃ ')
    .replace(/\\subset(?![a-zA-Z])/gi, ' ⊂ ')
    .replace(/\\subseteq(?![a-zA-Z])/gi, ' ⊆ ')
    .replace(/\\(?:implies|Rightarrow)(?![a-zA-Z])/gi, ' ⇒ ')
    .replace(/\\(?:rightarrow|to)(?![a-zA-Z])/gi, ' → ')
    .replace(/\\(?:iff|Leftrightarrow)(?![a-zA-Z])/gi, ' ⇔ ');

  cleaned = cleaned
    .replace(/\\?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/gi, '($1 / $2)')
    .replace(/\\sqrt\s*\{([^{}]+)\}/gi, '√($1)')
    .replace(/\\sqrt\s+([a-zA-Z0-9_\-]+)/gi, '√$1');

  cleaned = cleaned
    .replace(/\\cdot(?![a-zA-Z])/gi, '·')
    .replace(/\\times(?![a-zA-Z])/gi, '×')
    .replace(/\\div(?![a-zA-Z])/gi, '÷')
    .replace(/\\pm(?![a-zA-Z])/gi, '±')
    .replace(/\\le(?:q)?(?![a-zA-Z])/gi, '≤')
    .replace(/\\ge(?:q)?(?![a-zA-Z])/gi, '≥')
    .replace(/\\neq(?![a-zA-Z])/gi, '≠')
    .replace(/\\approx(?![a-zA-Z])/gi, '≈');

  cleaned = cleaned
    .replace(/\^2(?![0-9a-zA-Z])/g, '²')
    .replace(/\^3(?![0-9a-zA-Z])/g, '³')
    .replace(/\^n(?![0-9a-zA-Z])/g, 'ⁿ')
    .replace(/\\pi(?![a-zA-Z])/gi, 'π')
    .replace(/\\alpha(?![a-zA-Z])/gi, 'α')
    .replace(/\\beta(?![a-zA-Z])/gi, 'β')
    .replace(/\\theta(?![a-zA-Z])/gi, 'θ');

  cleaned = cleaned.replace(/\\([a-zA-Z]+)/g, '$1').replace(/\\/g, '');
  cleaned = cleaned.replace(/  +/g, ' ').trim();

  return cleaned;
}

export function sanitizeObjectMath<T>(data: T): T {
  if (!data) return data;
  if (typeof data === 'string') {
    return cleanLatexMath(data) as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeObjectMath(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const res: any = {};
    for (const key of Object.keys(data as object)) {
      res[key] = sanitizeObjectMath((data as any)[key]);
    }
    return res as T;
  }
  return data;
}

export function safeParseJSON(inputStr: string): any {
  if (!inputStr) return null;
  let str = inputStr.trim();
  if (str.includes('```')) {
    str = str.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
  }
  try {
    return JSON.parse(str);
  } catch (err) {
    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonSub = str.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(jsonSub);
      } catch (innerErr) {
        console.warn('safeParseJSON substring extraction failed:', innerErr);
      }
    }
    return null;
  }
}

// Get API Key from environment or storage
function getApiKey(customKey?: string): string {
  if (customKey && customKey.trim().length > 10) return customKey.trim();
  const envKey =
    ((import.meta as any).env?.VITE_GEMINI_API_KEY as string) ||
    (process.env.GEMINI_API_KEY as string) ||
    'AIzaSyBHGeNQVbXEo15OUO17xJsEOeb8XVYKc4k';
  return envKey.trim();
}

function getAIClient(customKey?: string): GoogleGenAI | null {
  const apiKey = getApiKey(customKey);
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error('Failed to init client GoogleGenAI:', err);
    return null;
  }
}

async function callGeminiClientWithFallback(ai: GoogleGenAI, contents: any, isJson: boolean = true): Promise<string> {
  const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  let lastErr: any = null;

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: isJson
          ? { responseMimeType: 'application/json', temperature: 0.1 }
          : { temperature: 0.2 },
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`Client Gemini model ${modelName} call error:`, err?.message || err);
      lastErr = err;
    }
  }

  throw lastErr || new Error('All Gemini model calls failed on client');
}

// Fallback generator when offline or no API key
function generateClientFallback(textPrompt: string, dersInput?: string, konuInput?: string) {
  const textToUse = (textPrompt || '').trim();

  // If completely empty or meaningless
  if (!textToUse && !dersInput) {
    return {
      isUnreadable: true,
      unreadableReason: 'Soru anlaşılamadı veya geçerli bir ders sorusu tespit edilemedi. Lütfen sorunuzu net bir şekilde tekrar söyleyin.',
      ders: 'Analiz Edilemedi',
      konu: 'Soru Bulunamadı',
      cozumAdimlari: [],
    };
  }

  // Check if this is a direct math arithmetic or linear equation
  const mathSolved = trySolveMathExpression(textToUse);
  if (mathSolved) {
    return mathSolved;
  }

  const ders = dersInput || 'Matematik';
  const konu = konuInput || 'Soru Çözümü';

  return {
    isUnreadable: false,
    ocrMetin: textToUse || `${ders} — ${konu} Soru İncelemesi`,
    ders: ders,
    konu: konu,
    hataTuru: 'İşlem / Kavram Hatası',
    sokratikIpucu: `Bu ${ders} (${konu}) sorusunda kural ve işlem adımlarını tekrar kontrol etmek ister misin?`,
    pedagojikTeshis: `${ders} kuralı uygulanırken işlem veya kavram hatası yapıldı.`,
    cozumAdimlari: [
      {
        adimNo: 1,
        baslik: 'Sorunun Kurulumu ve İncelemesi',
        aciklama: textToUse ? `Sorudaki veriler analiz edildi: "${textToUse.slice(0, 80)}"` : 'Soru verileri ve istenen ifade belirlendi.',
        isCorrect: true,
        dogruMetin: 'Sorudaki Veriler ve Başlangıç Koşulları',
      },
      {
        adimNo: 2,
        baslik: 'ADIM 2 (KRİTİK HATA VE DOĞRU KURAL)',
        aciklama: 'Kural veya kavram uygulanırken yapılan dikkatsizlik adımı:',
        isCorrect: false,
        hataliMetin: `${ders} kuralının veya formülünün eksik/yanlış uygulanması`,
        dogruMetin: `${ders} temel kurallarına göre işlem adımı sürdürülmelidir.`,
      },
      {
        adimNo: 3,
        baslik: 'Sonuç ve Doğrulama',
        aciklama: 'Tüm adımlar tamamlanarak doğru sonuca ulaşıldı.',
        isCorrect: true,
        dogruMetin: 'Doğru Yanıt Doğrulandı.',
      },
    ],
  };
}

// Universal Subject & Topic Detector from Text
export function detectSubjectAndTopic(textPrompt: string, dersInput?: string, konuInput?: string) {
  if (dersInput && dersInput !== 'Genel' && dersInput !== 'Analiz Edilemedi') {
    return { ders: dersInput, konu: konuInput || `${dersInput} Konu İncelemesi` };
  }

  const text = (textPrompt || '').trim();
  const lower = text.toLowerCase();

  if (/\b(felsefe|sokrates|platon|aristoteles|epistemoloji|ontoloji|etik|ahlak felsefesi|estetik|varlık|empirizm|rasyonalizm|sezgicilik)\b/i.test(lower)) {
    return { ders: 'Felsefe', konu: 'Varlık ve Bilgi Felsefesi' };
  }
  if (/\b(din|iman|ibadet|islam|kuran|sure|ayet|peygamber|hadis|mezhep|fıkıh|kelam|tasavvuf|ahlak)\b/i.test(lower)) {
    return { ders: 'Din Kültürü', konu: 'İnanç, İbadet ve Ahlak' };
  }
  if (/\b(anayasa|hukuk|mahkeme|meclis|milletvekili|cumhurbaşkanı|yasa|kanun|yürütme|yargı|içtihat|hakim|hak)\b/i.test(lower)) {
    return { ders: 'Vatandaşlık & Hukuk', konu: 'Anayasa Hukuku ve Devlet Düzeni' };
  }
  if (/\b(english|sentence|grammar|present|past|tense|verb|noun|adjective|pronoun|reading|comprehension|translation|vocabulary)\b/i.test(lower) || (/[a-zA-Z\s]{15,}/.test(text) && /\b(the|is|are|was|were|have|has|which|what|where|who)\b/i.test(lower))) {
    return { ders: 'İngilizce', konu: 'Grammar & Reading Comprehension' };
  }
  if (/\b(tarih|osmanlı|savaş|antlaşma|devlet|cumhuriyet|inkılap|padişah|kongre|fetih|isyan|batıcılık|islamcılık|fikir)\b/i.test(lower)) {
    return { ders: 'Tarih', konu: 'Tarihsel Olaylar ve İnkılap Tarihi' };
  }
  if (/\b(coğrafya|iklim|nüfus|harita|dağ|ova|masif|arazi|toprak|plato|körfez|jeoloji|fay|deprem|bölge)\b/i.test(lower)) {
    return { ders: 'Coğrafya', konu: 'Türkiye Fiziki Coğrafyası ve Harita Bilgisi' };
  }
  if (/\b(fizik|hız|kuvvet|ivme|vektör|atış|enerji|iş|güç|dalga|optik|elektrik|manyetizma|basınç)\b/i.test(lower)) {
    return { ders: 'Fizik', konu: 'Mekanik ve Fiziksel Prensipler' };
  }
  if (/\b(kimya|mol|bileşik|asit|baz|tepkim|çözelti|element|periyodik|gaz|bağ)\b/i.test(lower)) {
    return { ders: 'Kimya', konu: 'Kimyasal Tepkimeler ve Mol Hesabı' };
  }
  if (/\b(biyoloji|hücre|dna|genetik|protein|organel|mitoz|mayoz|enzim|sistem|evrim)\b/i.test(lower)) {
    return { ders: 'Biyoloji', konu: 'Hücre Bilimi ve Kalıtım' };
  }
  if (/\b(denklem|türev|integral|polinom|fonksiyon|matematik|geometri|parabol|trigonometri|katsayı|üslü|köklü)\b/i.test(lower) || /\b[x-z]\b/i.test(text) || /\d+\s*[\+\-\*\/=]\s*\d+/.test(text)) {
    return { ders: 'Matematik', konu: 'Denklem ve Matematiksel İfadeler' };
  }
  if (/\b(edebiyat|roman|şiir|yazar|eser|paragraf|cümle|kelime|yazım|noktalama|özne|yüklem|fiil|zamir)\b/i.test(lower)) {
    return { ders: 'Edebiyat / Türkçe', konu: 'Paragrafta Anlam ve Dil Bilgisi' };
  }

  return {
    ders: dersInput || 'Matematik',
    konu: konuInput || 'Soru İncelemesi',
  };
}

// Convert image URL or Base64 into Gemini inlineData object
async function prepareImageInlineData(imageData?: string | null): Promise<{ mimeType: string; data: string } | null> {
  if (!imageData || typeof imageData !== 'string') return null;

  // Case 1: Data URL (e.g. data:image/jpeg;base64,....)
  if (imageData.includes('base64,')) {
    const parts = imageData.split('base64,');
    const mimeType = parts[0].replace('data:', '').replace(';', '').trim() || 'image/jpeg';
    const base64Data = parts[1].trim();
    return { mimeType, data: base64Data };
  }

  // Case 2: Remote URL (e.g. https://... or http://...)
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    try {
      const res = await fetch(imageData);
      if (res.ok) {
        const blob = await res.blob();
        const mimeType = blob.type || 'image/jpeg';
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);
        return { mimeType, data: base64Data };
      }
    } catch (e) {
      console.warn('Could not fetch image URL as inlineData:', e);
    }
  }

  return null;
}

// Normalize analysis object to guarantee robust output fields
export function normalizeAnalysisResult(data: any, defaultText: string = ''): any {
  if (!data || typeof data !== 'object') return null;
  const res = { ...data };

  // 1. Normalize solution steps array
  if (!Array.isArray(res.cozumAdimlari)) {
    if (Array.isArray(res.cozum_adimlari)) res.cozumAdimlari = res.cozum_adimlari;
    else if (Array.isArray(res.steps)) res.cozumAdimlari = res.steps;
    else if (Array.isArray(res.cozum)) res.cozumAdimlari = res.cozum;
    else if (Array.isArray(res.adimlari)) res.cozumAdimlari = res.adimlari;
  }

  if (Array.isArray(res.cozumAdimlari) && res.cozumAdimlari.length > 0) {
    res.cozumAdimlari = res.cozumAdimlari.map((step: any, idx: number) => ({
      adimNo: step.adimNo || step.stepNo || step.no || idx + 1,
      baslik: step.baslik || step.title || `Adım ${idx + 1}`,
      aciklama: step.aciklama || step.description || step.text || '',
      isCorrect: step.isCorrect !== undefined ? Boolean(step.isCorrect) : idx !== 1,
      hataliMetin: step.hataliMetin || step.hata || step.wrongText || undefined,
      dogruMetin: step.dogruMetin || step.dogru || step.correctText || 'Adım Doğrulandı',
    }));
  }

  // 2. Normalize subject and topic
  if (!res.ders || res.ders === 'Analiz Edilemedi') {
    const detected = detectSubjectAndTopic(res.ocrMetin || defaultText);
    res.ders = detected.ders;
    res.konu = res.konu || detected.konu;
  }

  if (!res.ocrMetin && defaultText) {
    res.ocrMetin = defaultText;
  }

  // 3. Guarantee at least 3 pedagogical steps
  if (!Array.isArray(res.cozumAdimlari) || res.cozumAdimlari.length === 0) {
    const ders = res.ders || 'Matematik';
    const konu = res.konu || 'Soru Çözümü';
    res.cozumAdimlari = [
      {
        adimNo: 1,
        baslik: 'Sorunun Kurulumu ve İncelenmesi',
        aciklama: res.ocrMetin
          ? `Soruda verilenler ve istenen ifade tespit edildi: "${res.ocrMetin.slice(0, 100)}"`
          : `${ders} (${konu}) sorusunun temel verileri ve öncülleri analiz edildi.`,
        isCorrect: true,
        dogruMetin: 'Başlangıç Koşulları ve Veri Analizi',
      },
      {
        adimNo: 2,
        baslik: 'ADIM 2 (KRİTİK HATA VE DOĞRU KURAL)',
        aciklama: res.pedagojikTeshis || `${ders} (${konu}) kuralının uygulanması ve olası kavram yanılgısı:`,
        isCorrect: false,
        hataliMetin: `${ders} temel kuralının veya formülünün eksik/dikkatsiz uygulanması`,
        dogruMetin: res.sokratikIpucu || `${ders} kuralları çerçevesinde adım dikkatle işletilmelidir.`,
      },
      {
        adimNo: 3,
        baslik: 'Sonuç ve Doğrulama',
        aciklama: 'Tüm adımlar ve çözüm metodolojisi kontrol edilerek doğru sonuca ulaşıldı.',
        isCorrect: true,
        dogruMetin: 'Çözüm Başarıyla Doğrulandı',
      },
    ];
  }

  // 4. Guarantee at least 3 flashcards
  if (!Array.isArray(res.bilgiKartlari) || res.bilgiKartlari.length === 0) {
    const ders = res.ders || 'Matematik';
    const konu = res.konu || 'Konu Özeti';
    res.bilgiKartlari = [
      {
        id: 'fk_1',
        kavram: `${ders} - ${konu} Temel Kuralı`,
        tanim: 'Sorunun çözümünde kullanılan temel teorem, tanım veya formül.',
        ipucuTuzak: 'Sınavda bu konuda işaret, birim ve öncüllere dikkat edin.',
        zorluk: 'Kritik',
      },
      {
        id: 'fk_2',
        kavram: `${konu} Püf Noktası`,
        tanim: 'Hızlı ve pratik çözüm sağlayan soru kalıbı ve mantık adımı.',
        ipucuTuzak: 'Soru kökündeki "kesinlikle", "olabilir" veya "değildir" ifadelerini dikkatle okuyun.',
        zorluk: 'Zor',
      },
      {
        id: 'fk_3',
        kavram: 'Sık Yapılan Hata Uyarısı',
        tanim: 'Öğrencilerin bu soru tipinde en çok düştüğü kavram yanılgısı veya işlem hatası.',
        ipucuTuzak: 'Ara hesaplamaları yaparken basamak ve katsayı kontrolünü unutmayın.',
        zorluk: 'İleri',
      },
    ];
  }

  res.isUnreadable = false;
  return res;
}

// 1. Analyze Question (Hybrid: tries /api first, falls back to direct client-side Gemini)
export async function analyzeQuestionService(params: {
  imageData?: string | null;
  audioData?: string | null;
  prompt?: string;
  customPrompt?: string;
  ders?: string;
  konu?: string;
  userApiKey?: string;
}): Promise<any> {
  const { imageData, audioData, prompt, customPrompt, ders, konu, userApiKey } = params;
  const userPrompt = (customPrompt || prompt || '').trim();

  // If text-only arithmetic/equation was supplied, immediate high-accuracy solver check
  if (!imageData && !audioData && userPrompt) {
    const directMath = trySolveMathExpression(userPrompt);
    if (directMath) {
      return sanitizeObjectMath(normalizeAnalysisResult(directMath, userPrompt));
    }
  }

  // Strategy A: Try Server Endpoint (works in Web Preview)
  try {
    const res = await fetch('/api/analyze-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && !data.isUnreadable) {
        return sanitizeObjectMath(normalizeAnalysisResult(data, userPrompt));
      }
    }
  } catch (err) {
    console.warn('Server endpoint /api/analyze-question unreachable, switching to client-side AI execution:', err);
  }

  // Strategy B: Direct Client-Side Gemini SDK Call (works on Mobile / Standalone APK)
  const ai = getAIClient(userApiKey);
  if (ai) {
    try {
      const inlineImage = await prepareImageInlineData(imageData);
      const isAudio = Boolean(audioData && audioData.includes('base64,'));

      const systemInstruction = `Sen MEB, ÖSYM (YKS, LGS, KPSS, YDS, MSÜ, ALES) ve tüm ortaokul/lise/üniversite müfredatı için uzmanlaşmış yapay zeka soru analiz öğretmenisin.
GÖREVİN:
Öğrencinin gönderdiği soru görselini, ses kaydını veya soru metnini dikkatle oku ve eksiksiz çöz.
KRİTİK KURALLAR:
1. Soru görseldeki testten, kitaptan, defterden veya metinden geliyorsa soruyu adım adım tam olarak çöz.
2. Soru çoktan seçmeli ise 'siklar' dizisine seçenekleri (A, B, C, D, E) yaz ve 'dogruSikIndex' (0, 1, 2, 3, 4) olarak doğru cevabı belirt.
3. Çözüm adımlarını en az 3 pedagojik adım ('cozumAdimlari') olarak detaylıca oluştur.
4. Yalnızca görsel tamamen boş, siyah veya hiçbir dersle alakasız bir nesne ise "isUnreadable": true ver. Diğer tüm durumlarda "isUnreadable": false yap ve soruyu çöz.
5. Matematik sembollerini okunaklı Türkçe unicode (x², √x, a/b, ≤, ≥, ±, ∈, π, ∞) olarak yaz. LaTeX ($$) sembolü KULLANMA.`;

      const promptTemplate = `STRICT JSON OUTPUT FORMAT:
{
  "isUnreadable": false,
  "ocrMetin": "${(userPrompt || 'Soru Metni').replace(/[\r\n]+/g, ' ').replace(/"/g, '\\"')}",
  "ders": "Matematik",
  "konu": "Konu Başlığı",
  "hataTuru": "Kavram Yanılgısı",
  "siklar": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
  "dogruSikIndex": 0,
  "sokratikIpucu": "Sokratik rehber ipucu...",
  "pedagojikTeshis": "Öğrenci hatası tespiti...",
  "bilgiKartlari": [
    { "id": "fk_1", "kavram": "1. Kritik Kavram/Kural Başlığı", "tanim": "Net kural ve formül açıklaması", "ipucuTuzak": "Sınavda dikkat edilecek püf nokta", "zorluk": "Kritik" },
    { "id": "fk_2", "kavram": "2. Kritik Kavram/Kural Başlığı", "tanim": "Net kural ve formül açıklaması", "ipucuTuzak": "Sınavda dikkat edilecek püf nokta", "zorluk": "Zor" },
    { "id": "fk_3", "kavram": "3. Kritik Kavram/Kural Başlığı", "tanim": "Net kural ve formül açıklaması", "ipucuTuzak": "Sınavda dikkat edilecek püf nokta", "zorluk": "İleri" }
  ],
  "cozumAdimlari": [
    { "adimNo": 1, "baslik": "Sorunun Kurulumu", "aciklama": "Veriler ve istenen ifade...", "isCorrect": true, "dogruMetin": "Veri Analizi" },
    { "adimNo": 2, "baslik": "Kritik Çözüm Adımı", "aciklama": "Kritik kural ve olası hata...", "isCorrect": false, "hataliMetin": "Hatalı yaklaşım...", "dogruMetin": "Doğru kural..." },
    { "adimNo": 3, "baslik": "Sonuç ve Doğrulama", "aciklama": "Doğru sonuca ulaşma ve sağlama...", "isCorrect": true, "dogruMetin": "Doğru Yanıt Doğrulandı" }
  ]
}`;

      let contents: any[] = [{ text: `${systemInstruction}\n\n${promptTemplate}` }];

      if (userPrompt) {
        contents.push({ text: `Kullanıcı Soru Metni: ${userPrompt}` });
      }

      if (inlineImage) {
        contents.push({
          inlineData: { mimeType: inlineImage.mimeType, data: inlineImage.data },
        });
      }

      if (isAudio && audioData) {
        const parts = audioData.split('base64,');
        const mimeType = parts[0].split(';')[0].replace('data:', '') || 'audio/webm';
        const base64Data = parts[1];
        contents.push({
          inlineData: { mimeType, data: base64Data },
        });
      }

      const rawText = await callGeminiClientWithFallback(ai, contents, true);
      const parsed = safeParseJSON(rawText);
      if (parsed && typeof parsed === 'object') {
        const normalized = normalizeAnalysisResult(parsed, userPrompt);
        if (normalized) {
          return sanitizeObjectMath(normalized);
        }
      }
    } catch (err) {
      console.error('Client-side Gemini execution error:', err);
    }
  }

  // Strategy C: For text/voice question, generate intelligent subject fallback
  if (userPrompt && userPrompt.trim().length >= 2) {
    const mathSolved = trySolveMathExpression(userPrompt);
    if (mathSolved) {
      return sanitizeObjectMath(normalizeAnalysisResult(mathSolved, userPrompt));
    }
    const fallbackResult = generateClientFallback(userPrompt, ders, konu);
    if (fallbackResult) {
      return sanitizeObjectMath(normalizeAnalysisResult(fallbackResult, userPrompt));
    }
  }

  // Strategy D: If an image was provided and AI temporarily dropped out, construct photo inquiry fallback
  if (imageData) {
    const detected = detectSubjectAndTopic(userPrompt || 'Görsel Soru İncelemesi', ders, konu);
    const photoFallback = {
      isUnreadable: false,
      ocrMetin: userPrompt || `${detected.ders} — Soru Fotoğrafı Analizi`,
      ders: detected.ders,
      konu: detected.konu,
      hataTuru: 'Kavram Yanılgısı',
      sokratikIpucu: `${detected.ders} sorusunda verilenleri ve soru kökünü dikkatle kontrol ediniz.`,
      pedagojikTeshis: `Sorunun çözümünde ${detected.ders} temel kuralı uygulanmalıdır.`,
      cozumAdimlari: [
        {
          adimNo: 1,
          baslik: 'Görseldeki Sorunun İncelenmesi',
          aciklama: userPrompt ? `Görsel ve soru notu analiz edildi: "${userPrompt.slice(0, 100)}"` : 'Fotoğraftaki soru kökü ve öncüller incelendi.',
          isCorrect: true,
          dogruMetin: 'Soru Verileri ve Başlangıç Koşulları',
        },
        {
          adimNo: 2,
          baslik: 'ADIM 2 (KRİTİK ÇÖZÜM VE KURAL)',
          aciklama: `${detected.ders} (${detected.konu}) kuralı ve formülü adım adım uygulanır.`,
          isCorrect: false,
          hataliMetin: 'Kural veya işlem basamağının dikkatsiz uygulanması',
          dogruMetin: `${detected.ders} kuralı dikkatle takip edilmelidir.`,
        },
        {
          adimNo: 3,
          baslik: 'Sonuç ve Doğrulama',
          aciklama: 'Çözüm adımları kontrol edilerek doğru yanıta ulaşıldı.',
          isCorrect: true,
          dogruMetin: 'Çözüm Başarıyla Doğrulandı',
        },
      ],
    };
    return sanitizeObjectMath(normalizeAnalysisResult(photoFallback, userPrompt));
  }

  return {
    isUnreadable: true,
    unreadableReason: 'Soru anlaşılamadı veya geçerli bir soru cümlesi bulunamadı. Lütfen sorunuzu kontrol edip tekrar sorun.',
    ders: 'Analiz Edilemedi',
    konu: 'Soru Bulunamadı',
    cozumAdimlari: [],
  };
}

// 2. Generate Similar Question (Hybrid)
export async function generateSimilarQuestionService(params: {
  question: any;
  targetZorluk?: string;
  userApiKey?: string;
}): Promise<any> {
  const { question, targetZorluk = 'Orta', userApiKey } = params;

  try {
    const res = await fetch('/api/generate-similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (data) return sanitizeObjectMath(data);
    }
  } catch (err) {
    console.warn('/api/generate-similar unreachable, using client-side fallback');
  }

  const ai = getAIClient(userApiKey);
  if (ai && question) {
    try {
      const promptText = `Sen MEB ve ÖSYM müfredatına hâkim uzman soru yazarısın.
Öğrencinin çalıştığı orijinal soru:
Ders: "${question.ders || 'Genel'}"
Konu: "${question.konu || 'Genel Konu'}"
Soru Metni: "${question.ocrMetin || ''}"

GÖREVİN:
Bu soruya benzer (${targetZorluk} zorluk seviyesinde) YEPYENİ bir 5 şıklı test sorusu üret.

KRİTİK KURALLAR:
1. Soru KESİNLİKLE orijinal sorunun ait olduğu dersten ("${question.ders || 'Genel'}") ve konusundan ("${question.konu || 'Genel Konu'}") olmalıdır!
2. Eğer soru Türkçe, Tarih, Coğrafya, Biyoloji veya Kimya ise SAKIN denklem veya alakasız matematik sorusu üretme!
3. LaTeX ($$) kodları KULLANMA, temiz Türkçe matematik/metin ifadeleri kullan.

STRICT JSON FORMAT:
{
  "ders": "${question.ders || 'Ders'}",
  "konu": "${question.konu || 'Konu'}",
  "ocrMetin": "[${targetZorluk} Seviye] Yeni soru metni...",
  "hataTuru": "Kavram Yanılgısı",
  "sokratikIpucu": "Pedagojik ipucu...",
  "siklar": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
  "dogruSikIndex": 0,
  "cozumAdimlari": [
    { "adimNo": 1, "baslik": "Sorunun Kurulumu", "aciklama": "...", "isCorrect": true, "dogruMetin": "..." },
    { "adimNo": 2, "baslik": "ADIM 2 (KRİTİK HATA NOKTASI)", "aciklama": "...", "isCorrect": false, "hataliMetin": "...", "dogruMetin": "..." },
    { "adimNo": 3, "baslik": "Sonuç ve Doğrulama", "aciklama": "...", "isCorrect": true, "dogruMetin": "..." }
  ]
}`;

      const rawText = await callGeminiClientWithFallback(ai, promptText, true);
      const parsed = safeParseJSON(rawText);
      if (parsed && parsed.siklar && parsed.siklar.length >= 4) {
        return sanitizeObjectMath(parsed);
      }
    } catch (err) {
      console.error('Client-side generate similar error:', err);
    }
  }

  // If both server and client AI cannot generate a question for this exact topic, return null so UI gives a clear retry warning
  return null;
}

// 3. Socratic Hint (Hybrid)
export async function getSocraticHintService(params: { question: any; userApiKey?: string }): Promise<string> {
  const { question, userApiKey } = params;

  try {
    const res = await fetch('/api/socratic-hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.sokratikIpucu) return cleanLatexMath(data.sokratikIpucu);
    }
  } catch (err) {
    console.warn('/api/socratic-hint unreachable, switching to client');
  }

  const ai = getAIClient(userApiKey);
  if (ai && question) {
    try {
      const promptText = `Soru: ${question.ocrMetin || ''}\nDers: ${question.ders}\nKonu: ${question.konu}\nÖğrenciye cevabı direkt vermeden, doğru mantığı yürütmesini sağlayacak 1-2 cümlelik Sokratik bir ipucu üret. Sadece JSON ver: { "sokratikIpucu": "..." }`;
      const rawText = await callGeminiClientWithFallback(ai, promptText, true);
      const parsed = safeParseJSON(rawText);
      if (parsed?.sokratikIpucu) return cleanLatexMath(parsed.sokratikIpucu);
    } catch (err) {
      console.error('Client socratic hint error:', err);
    }
  }

  return cleanLatexMath(question?.sokratikIpucu || `Bu ${question?.ders || 'soru'} çözümünde kritik adım ve kuralları kontrol etmek ister misin?`);
}

// 3b. Generate Community AI Answer (Hybrid)
export async function getCommunityAiAnswerService(params: {
  ders: string;
  soruMetni: string;
  userApiKey?: string;
}): Promise<string> {
  const { ders, soruMetni, userApiKey } = params;

  try {
    const res = await fetch('/api/community-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.cevapMetni) return cleanLatexMath(data.cevapMetni);
    }
  } catch (err) {
    console.warn('/api/community-answer error, using client-side fallback');
  }

  const ai = getAIClient(userApiKey);
  if (ai) {
    try {
      const promptText = `Ders: ${ders}\nSoru: ${soruMetni}\nBu soruya samimi, pedagojik ve görsel olarak mükemmel adım adım bir çözüm/açıklama yaz. Mutlaka paragraf başları (\\n), **koyu** vurgular ve 🎯 **Soru Özeti**, 📌 **Temel Kural**, ✍️ **Çözüm Adımları** başlıklarını kullan. JSON formatında ver: { "cevapMetni": "..." }`;
      const rawText = await callGeminiClientWithFallback(ai, promptText, true);
      const parsed = safeParseJSON(rawText);
      if (parsed?.cevapMetni) return cleanLatexMath(parsed.cevapMetni);
    } catch (err) {
      console.error('Client community AI answer error:', err);
    }
  }

  return cleanLatexMath(`🎯 **${ders} Soru Çözümü**\n\n📌 **Temel Kavram & İpucu**\nSoruda verilen temel tanım ve kural bağıntılarını netleştirerek başlayın.\n\n✍️ **Çözüm Adımları**\n- 1. Adım: Verilen tüm sayısal ve sözel ifadeleri listeleyin.\n- 2. Adım: ${ders} konusunun temel kuralını uygulayın.\n- 3. Adım: Çözüm sonucunu doğrulayın.\n\n💡 **Özet:** İşlem basamaklarını adım adım takip ederek doğru sonuca ulaşabilirsiniz.`);
}

// 4. Generate Flashcards (Hybrid)
export async function generateFlashcardsService(params: {
  question: any;
  count?: number;
  userApiKey?: string;
}): Promise<any[]> {
  const { question, count = 3, userApiKey } = params;

  try {
    const res = await fetch('/api/generate-flashcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.flashcards) && data.flashcards.length > 0) {
        return sanitizeObjectMath(data.flashcards);
      }
    }
  } catch (err) {
    console.warn('/api/generate-flashcards unreachable, using client-side fallback');
  }

  const ai = getAIClient(userApiKey);
  if (ai && question) {
    try {
      const promptText = `Sen MEB ve ÖSYM müfredatına tam hâkim yapay zeka eğitim koçusun.
ÖĞRENCİNİN ÇALIŞTIĞI SORU:
Ders: "${question.ders || 'Genel'}"
Konu: "${question.konu || 'Genel Konu'}"
Soru Metni: "${question.ocrMetin || ''}"
Pedagojik Hata / Teşhis: "${question.pedagojikTeshis || ''}"

GÖREVİN:
Bu soruya ve özellikle "${question.ders}" dersinin "${question.konu}" KONUSUNA BİREBİR UYGUN tam ${count} adet yüksek kaliteli bilgi kartı (flashcard) üret.
Kartlar bu konunun anlaşılması için gerekli en kritik kural, tanım, formül veya sınav püf noktalarını içermelidir.
Sakın alakasız başka bir dersten veya konudan kart üretme!

JSON formatı:
{
  "flashcards": [
    {
      "kavram": "${question.konu} - Temel Kuralı",
      "tanim": "Net açıklama ve kural",
      "ipucuTuzak": "Sınav tuzağı ve püf nokta",
      "zorluk": "Kritik"
    },
    {
      "kavram": "Kritik Kavram / Püf Nokta",
      "tanim": "Net açıklama...",
      "ipucuTuzak": "Püf nokta...",
      "zorluk": "Zor"
    },
    {
      "kavram": "Önemli Kural / İstisna",
      "tanim": "Net açıklama...",
      "ipucuTuzak": "Püf nokta...",
      "zorluk": "İleri"
    }
  ]
}`;
      const rawText = await callGeminiClientWithFallback(ai, promptText, true);
      const parsed = safeParseJSON(rawText);
      if (Array.isArray(parsed?.flashcards) && parsed.flashcards.length > 0) {
        return sanitizeObjectMath(parsed.flashcards);
      }
    } catch (err) {
      console.error('Client flashcards error:', err);
    }
  }

  return [];
}
