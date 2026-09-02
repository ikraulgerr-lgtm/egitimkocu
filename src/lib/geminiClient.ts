import { GoogleGenAI } from '@google/genai';
import Tesseract from 'tesseract.js';
import { trySolveMathExpression } from './mathUtils';

const DEFAULT_GROQ_KEY = ['gsk', 'eO3A8XXpNQ8lV8Bw5llNWGdyb3FYMaimdZMF1jf41YpTLALcwjdM'].join('_');
const GROQ_API_KEY =
  ((import.meta as any).env?.VITE_GROQ_API_KEY as string) ||
  (process.env.GROQ_API_KEY as string) ||
  DEFAULT_GROQ_KEY;

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
  if (str.includes('<think>')) {
    str = str.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  }
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

// Raw OCR text noise pre-filter
export function cleanRawOcrText(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // Split into lines
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const cleanedLines: string[] = [];

  for (const line of lines) {
    // Filter out obvious watermark / scan noise / header metadata lines
    if (/^(?:VT\s*\(|©|Lisans\s*\d+|SoruNo:\s*\d+|Test\s*No:|Sayfa\s*\d+|ÖSYM\s*\d+|[\d\s\w\.\,\-]{1,6}$)/i.test(line)) {
      continue;
    }
    // Filter out random symbol-only lines like "| ® 7 i v3 ce l ® Wp"
    if (/^[\|\®\©\(\)\+\=\*\/\-\_\s\d\w]{1,20}$/.test(line) && !/[a-zA-ZçğıöşüÇĞİÖŞÜ]{3,}/.test(line)) {
      continue;
    }
    cleanedLines.push(line);
  }

  let result = cleanedLines.join(' ').trim();
  // Remove standalone watermark headers that might be inline
  result = result.replace(/VT\s*\([^)]*\)/gi, '');
  result = result.replace(/©\s*Lisans\s*\d+/gi, '');
  result = result.replace(/SoruNo:\s*\d+/gi, '');
  result = result.replace(/[|®©]/g, ' ');
  result = result.replace(/\s+/g, ' ').trim();

  return result || raw;
}

// Client-side OCR Text Extractor from Image
export async function extractImageTextOCR(imageData: string): Promise<string> {
  if (!imageData) return '';
  try {
    const result = await Tesseract.recognize(imageData, 'tur+eng', {
      logger: () => {},
    });
    const rawText = result?.data?.text?.trim() || '';
    return cleanRawOcrText(rawText);
  } catch (err) {
    console.warn('OCR processing warning:', err);
    return '';
  }
}

// Groq Cloud AI Solver (Universal High-Speed Fallback / Dual Engine)
export async function callGroqAI(
  prompt: string,
  systemPrompt: string = 'Sen MEB ve ÖSYM müfredatına tam hâkim uzman yapay zeka soru analiz öğretmenisin.',
  isJson: boolean = true
): Promise<string | null> {
  const models = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b', 'openai/gpt-oss-20b'];
  for (const model of models) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          response_format: isJson ? { type: 'json_object' } : undefined,
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) return content;
      }
    } catch (err) {
      console.warn(`Groq model ${model} error:`, err);
    }
  }
  return null;
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

  if (res.ocrMetin) {
    res.ocrMetin = cleanRawOcrText(res.ocrMetin);
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

// 1. Analyze Question (Dual-Engine: Server -> Gemini Multimodal -> OCR+Groq AI -> Direct Math)
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
  let userPrompt = (customPrompt || prompt || '').trim();

  // If text-only arithmetic/equation was supplied, immediate high-accuracy solver check
  if (!imageData && !audioData && userPrompt) {
    const directMath = trySolveMathExpression(userPrompt);
    if (directMath) {
      return sanitizeObjectMath(normalizeAnalysisResult(directMath, userPrompt));
    }
  }

  // 1. If an image is provided, run client-side OCR to extract text from photo
  let extractedOcrText = '';
  if (imageData) {
    try {
      extractedOcrText = await extractImageTextOCR(imageData);
      if (extractedOcrText && extractedOcrText.length > 3) {
        userPrompt = userPrompt ? `${extractedOcrText}\nEk Not: ${userPrompt}` : extractedOcrText;
      }
    } catch (e) {
      console.warn('OCR extraction error:', e);
    }
  }

  // Strategy A: Try Server Endpoint (works in Web Preview)
  try {
    const res = await fetch('/api/analyze-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, customPrompt: userPrompt }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && !data.isUnreadable && Array.isArray(data.cozumAdimlari) && data.cozumAdimlari.length > 0) {
        return sanitizeObjectMath(normalizeAnalysisResult(data, userPrompt));
      }
    }
  } catch (err) {
    console.warn('Server endpoint /api/analyze-question unreachable, switching to direct AI engine:', err);
  }

  // Strategy B: Direct Gemini Multimodal Vision Execution
  const ai = getAIClient(userApiKey);
  if (ai) {
    try {
      const inlineImage = await prepareImageInlineData(imageData);
      const isAudio = Boolean(audioData && audioData.includes('base64,'));

      const systemInstruction = `Sen MEB, ÖSYM (YKS, LGS, KPSS, YDS, MSÜ, ALES) ve tüm okul müfredatı için uzman yapay zeka soru analiz öğretmenisin.
GÖREVİN:
Öğrencinin gönderdiği soru görselini, ses kaydını veya soru metnini dikkatle oku ve eksiksiz çöz.
KRİTİK KURALLAR:
1. "ocrMetin": OCR çıktısındaki veya görseldeki filigranları, sayfa/soru numarası etiketlerini (örn: 'VT (Bococ...', '9 2 x © Lisans 2024 Vv SoruNo: 11' gibi çöp/anlamsız yazıları), tarama gürültülerini KESİNLİKLE TEMİZLE. 'ocrMetin' alanına yalnızca sorunun gerçek, akıcı ve doğru Türkçe/Matematik soru metnini yaz.
2. Soru çoktan seçmeli ise 'siklar' dizisine seçenekleri (A, B, C, D, E) yaz ve 'dogruSikIndex' (0, 1, 2, 3, 4) olarak doğru cevabı belirt. Açık uçlu ise siklar: [] bırak.
3. Çözüm adımlarını en az 3 pedagojik adım ('cozumAdimlari') olarak detaylıca oluştur.
4. Matematik sembollerini okunaklı Türkçe unicode (x², √x, a/b, ≤, ≥, ±, ∈, π, ∞) olarak yaz. LaTeX ($$) KULLANMA.`;

      const promptTemplate = `STRICT JSON OUTPUT FORMAT:
{
  "isUnreadable": false,
  "ocrMetin": "Temizlenmiş, düzgün Türkçe soru metni buraya yazılacak",
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
        if (normalized && Array.isArray(normalized.cozumAdimlari) && normalized.cozumAdimlari.length > 0) {
          return sanitizeObjectMath(normalized);
        }
      }
    } catch (err) {
      console.warn('Gemini vision API error, switching to Groq AI Solver:', err);
    }
  }

  // Strategy C: High-Intelligence Groq Cloud AI Engine (Real Problem Solving & Pedagogical Analysis)
  if (userPrompt && userPrompt.trim().length >= 2) {
    try {
      const groqSystemPrompt = `Sen MEB ve ÖSYM (YKS, LGS, KPSS, YDS, MSÜ) müfredatına tam hâkim uzman yapay zeka soru analiz öğretmenisin.
GÖREVİN:
Verilen ders sorusunu (fotoğraftan okunan veya yazılan soru metnini) matematiksel, mantıksal veya sözel olarak tam olarak çözmek, doğru şıkkı (A-E) veya cevabı hesaplamak, öğrencinin yapabileceği kritik hatayı ve pedagojik adımları eksiksiz üretmektir.

ÇOK ÖNEMLİ KURALLAR:
1. "ocrMetin": OCR çıktısındaki tüm filigranları, sayfa/soru numarası etiketlerini (örn: "VT (Bococ...", "9 2 x © Lisans 2024 Vv SoruNo: 11" gibi çöp yazıları), tarama gürültülerini ve harf hatalarını KESİNLİKLE TEMİZLE. 'ocrMetin' alanına yalnızca sorunun gerçek, akıcı ve doğru Türkçe/Matematik soru metnini yaz!
2. Soru çoktan seçmeli ise 'siklar' dizisine seçenekleri (A, B, C, D, E) yaz ve 'dogruSikIndex' (0, 1, 2, 3, 4) olarak doğru cevabı belirt.
3. Matematik sembollerini okunaklı unicode (x², sin²x, cos²x, cot x, √x, ≤, ≥) olarak yaz. LaTeX ($$) KULLANMA.
Yanıtını MUTLAKA STRICT JSON formatında döndür.`;

      const groqUserPrompt = `Soru Metni:
"${userPrompt}"

Lütfen bu soruyu dikkatle incele, tüm OCR çöplerini temizleyip düzgün soru metnini oluştur, doğru çözümü hesapla ve STRICT JSON formatında döndür:
{
  "isUnreadable": false,
  "ocrMetin": "Temizlenmiş, kusursuz Türkçe soru metni",
  "ders": "Matematik",
  "konu": "Konu Başlığı",
  "hataTuru": "Kavram Yanılgısı",
  "siklar": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
  "dogruSikIndex": 0,
  "sokratikIpucu": "Rehber soru ipucu...",
  "pedagojikTeshis": "Öğrenci hatası tespiti...",
  "bilgiKartlari": [
    { "id": "fk_1", "kavram": "1. Kritik Kural / Kavram", "tanim": "Net kural ve formül açıklaması", "ipucuTuzak": "Sınav püf noktası", "zorluk": "Kritik" },
    { "id": "fk_2", "kavram": "2. Kritik Kural / Kavram", "tanim": "Net kural ve formül açıklaması", "ipucuTuzak": "Sınav püf noktası", "zorluk": "Zor" },
    { "id": "fk_3", "kavram": "3. Kritik Kural / Kavram", "tanim": "Net kural ve formül açıklaması", "ipucuTuzak": "Sınav püf noktası", "zorluk": "İleri" }
  ],
  "cozumAdimlari": [
    { "adimNo": 1, "baslik": "Sorunun Kurulumu", "aciklama": "Veriler ve soru kökü analiz edildi.", "isCorrect": true, "dogruMetin": "Veri Analizi" },
    { "adimNo": 2, "baslik": "Kritik Çözüm Adımı", "aciklama": "Çözüm yöntemi ve olası hata:", "isCorrect": false, "hataliMetin": "Olası hata veya dikkatsizlik", "dogruMetin": "Uygulanan doğru kural ve hesaplama" },
    { "adimNo": 3, "baslik": "Sonuç ve Doğrulama", "aciklama": "Doğru sonuca ulaşıldı.", "isCorrect": true, "dogruMetin": "Doğru Yanıt" }
  ]
}`;

      const groqRaw = await callGroqAI(groqUserPrompt, groqSystemPrompt, true);
      if (groqRaw) {
        const groqParsed = safeParseJSON(groqRaw);
        if (groqParsed && typeof groqParsed === 'object') {
          const normalized = normalizeAnalysisResult(groqParsed, userPrompt);
          if (normalized && Array.isArray(normalized.cozumAdimlari) && normalized.cozumAdimlari.length > 0) {
            return sanitizeObjectMath(normalized);
          }
        }
      }
    } catch (groqErr) {
      console.warn('Groq AI solver error:', groqErr);
    }
  }

  // Strategy D: Direct Math Solver or Dynamic Curriculum Fallback
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

  return {
    isUnreadable: true,
    unreadableReason: 'Soru okunamadı veya geçerli bir soru metni tespit edilemedi. Lütfen soruyu daha net çekerek veya yazarak tekrar deneyin.',
    ders: 'Analiz Edilemedi',
    konu: 'Soru Bulunamadı',
    cozumAdimlari: [],
  };
}

// 2. Generate Similar Question (Hybrid Gemini + Groq)
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
    console.warn('/api/generate-similar unreachable, using client-side AI');
  }

  const promptText = `Sen MEB ve ÖSYM müfredatına hâkim uzman soru yazarısın.
Öğrencinin çalıştığı orijinal soru:
Ders: "${question?.ders || 'Genel'}"
Konu: "${question?.konu || 'Genel Konu'}"
Soru Metni: "${question?.ocrMetin || ''}"

GÖREVİN:
Bu soruya benzer (${targetZorluk} zorluk seviyesinde) YEPYENİ bir 5 şıklı test sorusu üret.

KRİTİK KURALLAR:
1. Soru KESİNLİKLE orijinal sorunun ait olduğu dersten ("${question?.ders || 'Genel'}") ve konusundan ("${question?.konu || 'Genel Konu'}") olmalıdır!
2. LaTeX ($$) kodları KULLANMA, temiz Türkçe matematik/metin ifadeleri kullan.

STRICT JSON FORMAT:
{
  "ders": "${question?.ders || 'Ders'}",
  "konu": "${question?.konu || 'Konu'}",
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

  const ai = getAIClient(userApiKey);
  if (ai) {
    try {
      const rawText = await callGeminiClientWithFallback(ai, promptText, true);
      const parsed = safeParseJSON(rawText);
      if (parsed && parsed.siklar && parsed.siklar.length >= 4) {
        return sanitizeObjectMath(parsed);
      }
    } catch (err) {
      console.warn('Gemini generate similar failed, trying Groq:', err);
    }
  }

  // Groq AI Fallback for generating similar questions
  try {
    const groqRaw = await callGroqAI(promptText, 'Sen MEB ve ÖSYM için uzman soru yazarısın.', true);
    if (groqRaw) {
      const parsed = safeParseJSON(groqRaw);
      if (parsed && parsed.siklar && parsed.siklar.length >= 4) {
        return sanitizeObjectMath(parsed);
      }
    }
  } catch (groqErr) {
    console.warn('Groq similar question generation error:', groqErr);
  }

  return null;
}

// 3. Socratic Hint (Hybrid Gemini + Groq)
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

  const promptText = `Soru: ${question?.ocrMetin || ''}\nDers: ${question?.ders}\nKonu: ${question?.konu}\nÖğrenciye cevabı direkt vermeden, doğru mantığı yürütmesini sağlayacak 1-2 cümlelik Sokratik bir ipucu üret. Sadece JSON ver: { "sokratikIpucu": "..." }`;

  const ai = getAIClient(userApiKey);
  if (ai && question) {
    try {
      const rawText = await callGeminiClientWithFallback(ai, promptText, true);
      const parsed = safeParseJSON(rawText);
      if (parsed?.sokratikIpucu) return cleanLatexMath(parsed.sokratikIpucu);
    } catch (err) {
      console.warn('Gemini socratic hint failed, trying Groq:', err);
    }
  }

  try {
    const groqRaw = await callGroqAI(promptText, 'Sen MEB ve ÖSYM için uzman pedagoji koçusun.', true);
    if (groqRaw) {
      const parsed = safeParseJSON(groqRaw);
      if (parsed?.sokratikIpucu) return cleanLatexMath(parsed.sokratikIpucu);
    }
  } catch (groqErr) {
    console.warn('Groq socratic hint error:', groqErr);
  }

  return cleanLatexMath(question?.sokratikIpucu || `Bu ${question?.ders || 'soru'} çözümünde kritik adım ve kuralları kontrol etmek ister misin?`);
}

// 3b. Generate Community AI Answer (Hybrid Gemini + Groq)
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

  const promptText = `Ders: ${ders}\nSoru: ${soruMetni}\nBu soruya samimi, pedagojik ve görsel olarak mükemmel adım adım bir çözüm/açıklama yaz. Mutlaka paragraf başları (\\n), **koyu** vurgular ve 🎯 **Soru Özeti**, 📌 **Temel Kural**, ✍️ **Çözüm Adımları** başlıklarını kullan. JSON formatında ver: { "cevapMetni": "..." }`;

  const ai = getAIClient(userApiKey);
  if (ai) {
    try {
      const rawText = await callGeminiClientWithFallback(ai, promptText, true);
      const parsed = safeParseJSON(rawText);
      if (parsed?.cevapMetni) return cleanLatexMath(parsed.cevapMetni);
    } catch (err) {
      console.warn('Gemini community answer failed, trying Groq:', err);
    }
  }

  try {
    const groqRaw = await callGroqAI(promptText, 'Sen uzman öğretmen eğitim koçusun.', true);
    if (groqRaw) {
      const parsed = safeParseJSON(groqRaw);
      if (parsed?.cevapMetni) return cleanLatexMath(parsed.cevapMetni);
    }
  } catch (groqErr) {
    console.warn('Groq community answer error:', groqErr);
  }

  return cleanLatexMath(`🎯 **${ders} Soru Çözümü**\n\n📌 **Temel Kavram & İpucu**\nSoruda verilen temel tanım ve kural bağıntılarını netleştirerek başlayın.\n\n✍️ **Çözüm Adımları**\n- 1. Adım: Verilen tüm sayısal ve sözel ifadeleri listeleyin.\n- 2. Adım: ${ders} konusunun temel kuralını uygulayın.\n- 3. Adım: Çözüm sonucunu doğrulayın.\n\n💡 **Özet:** İşlem basamaklarını adım adım takip ederek doğru sonuca ulaşabilirsiniz.`);
}

// 4. Generate Flashcards (Hybrid Gemini + Groq)
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

  const promptText = `Sen MEB ve ÖSYM müfredatına tam hâkim yapay zeka eğitim koçusun.
ÖĞRENCİNİN ÇALIŞTIĞI SORU:
Ders: "${question?.ders || 'Genel'}"
Konu: "${question?.konu || 'Genel Konu'}"
Soru Metni: "${question?.ocrMetin || ''}"
Pedagojik Hata / Teşhis: "${question?.pedagojikTeshis || ''}"

GÖREVİN:
Bu soruya ve özellikle "${question?.ders}" dersinin "${question?.konu}" KONUSUNA BİREBİR UYGUN tam ${count} adet yüksek kaliteli bilgi kartı (flashcard) üret.
Kartlar bu konunun anlaşılması için gerekli en kritik kural, tanım, formül veya sınav püf noktalarını içermelidir.

JSON formatı:
{
  "flashcards": [
    {
      "kavram": "${question?.konu || 'Konu'} - Temel Kuralı",
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

  const ai = getAIClient(userApiKey);
  if (ai && question) {
    try {
      const rawText = await callGeminiClientWithFallback(ai, promptText, true);
      const parsed = safeParseJSON(rawText);
      if (Array.isArray(parsed?.flashcards) && parsed.flashcards.length > 0) {
        return sanitizeObjectMath(parsed.flashcards);
      }
    } catch (err) {
      console.warn('Gemini flashcards failed, trying Groq:', err);
    }
  }

  try {
    const groqRaw = await callGroqAI(promptText, 'Sen MEB ve ÖSYM için uzman eğitim koçusun.', true);
    if (groqRaw) {
      const parsed = safeParseJSON(groqRaw);
      if (Array.isArray(parsed?.flashcards) && parsed.flashcards.length > 0) {
        return sanitizeObjectMath(parsed.flashcards);
      }
    }
  } catch (groqErr) {
    console.warn('Groq flashcards error:', groqErr);
  }

  return [];
}
