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
    '';
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
  const modelsToTry = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.1-pro-preview'];
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
      return sanitizeObjectMath(directMath);
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
      if (data && typeof data === 'object') {
        return sanitizeObjectMath(data);
      }
    }
  } catch (err) {
    console.warn('Server endpoint /api/analyze-question unreachable or failed, switching to client-side AI execution:', err);
  }

  // Strategy B: Direct Client-Side Gemini SDK Call (works on Mobile / Standalone APK)
  const ai = getAIClient(userApiKey);
  if (ai) {
    try {
      const isImage = Boolean(imageData && imageData.includes('base64,'));
      const isAudio = Boolean(audioData && audioData.includes('base64,'));
      const systemInstruction = isImage
        ? `Sen ÖSYM ve tüm okul müfredatı için uzmanlaşmış yapay zeka soru analiz öğretmenisin.
GÖREVİN:
Soru fotoğrafındaki soruyu çözmek, öğrencinin hatasını pedagojik olarak analiz etmektir.
Eğer görselde soru yoksa veya net okunamıyorsa "isUnreadable": true ver. Soru varsa isUnreadable: false ver.
Matematik sembollerini Türkçe unicode (x², √x, a/b, ≤, ≥, ±, ∈) olarak yaz. SAKIN LaTeX ($$) kullanma.`
        : isAudio
        ? `Sen MEB ve ÖSYM müfredatına tam hâkim uzman yapay zeka soru analiz öğretmenisin.
GÖREVİN:
Öğrencinin sesli olarak sorduğu soruyu dikkatle dinle.
ÖNEMLİ KURAL - GEÇERSİZ / SAÇMA / BOŞ SES KONTROLÜ:
- Eğer ses kaydında net bir ders sorusu/işlem yoksa (sessizlik, anlamsız sesler, gürültü, rastgele anlamsız heceler veya derse/soruya ait olmayan şeyler):
  KESİNLİKLE "isUnreadable": true, "unreadableReason": "Soru anlaşılamadı veya geçerli bir ders sorusu tespit edilemedi. Lütfen sorunuzu net bir şekilde tekrar söyleyin.", "ders": "Analiz Edilemedi", "konu": "Soru Bulunamadı", "cozumAdimlari": [] döndür.
- Eğer geçerli bir ders sorusu varsa "isUnreadable": false yap, soru metnini 'ocrMetin' alanına Türkçe olarak yaz ve soruyu pedagojik adımlarla tam olarak çöz.
Matematik sembollerini Türkçe unicode (x², √x, a/b, ≤, ≥, ±, ∈) olarak yaz. SAKIN LaTeX ($$) kullanma.`
        : `Sen MEB ve ÖSYM müfredatına tam hâkim uzman yapay zeka soru analiz öğretmenisin.
GÖREVİN:
Öğrencinin metin olarak sorduğu soruyu dikkatle çöz ve pedagojik adımları oluştur.
Eğer girilen metin anlamsız saçma harflerden ibaretse (örn: 'asdfgh', 'qweqwe') veya bir soru/işlem içermiyorsa "isUnreadable": true ver.
ÖNEMLİ: Öğrenci doğrudan sayılarla işlem veya denklem yazmışsa (örn: 125 / 5, 450 / 9, 3x + 6 = 18 vb.), adımlara mutlaka bu sayıları, ara hesaplamaları ve kesin sonucu net olarak yaz!
Matematik sembollerini Türkçe unicode (x², √x, a/b, ≤, ≥, ±, ∈) olarak yaz. SAKIN LaTeX ($$) kullanma.`;

      const promptTemplate = `STRICT JSON OUTPUT FORMAT:
{
  "isUnreadable": false,
  "unreadableReason": "",
  "ocrMetin": "${(userPrompt || 'Sesli / Metin Soru Metni').replace(/[\r\n]+/g, ' ').replace(/"/g, '\\"')}",
  "ders": "Matematik",
  "konu": "Konu Başlığı",
  "hataTuru": "Kavram Yanılgısı",
  "siklar": [],
  "dogruSikIndex": 0,
  "sokratikIpucu": "Sokratik rehber ipucu...",
  "pedagojikTeshis": "Öğrenci hatası tespiti...",
  "bilgiKartlari": [
    { "id": "fk_1", "kavram": "Sorunun konusuna özel 1. kritik kavram veya kural", "tanim": "Net tanım ve kural açıklaması", "ipucuTuzak": "Sınavda dikkat edilecek püf nokta / tuzak", "zorluk": "Kritik" },
    { "id": "fk_2", "kavram": "Sorunun konusuna özel 2. kritik kavram veya kural", "tanim": "Net tanım ve kural açıklaması", "ipucuTuzak": "Sınavda dikkat edilecek püf nokta / tuzak", "zorluk": "Zor" },
    { "id": "fk_3", "kavram": "Sorunun konusuna özel 3. kritik kavram veya kural", "tanim": "Net tanım ve kural açıklaması", "ipucuTuzak": "Sınavda dikkat edilecek püf nokta / tuzak", "zorluk": "İleri" }
  ],
  "cozumAdimlari": [
    { "adimNo": 1, "baslik": "Kurulum", "aciklama": "Veriler...", "isCorrect": true, "dogruMetin": "..." },
    { "adimNo": 2, "baslik": "Kritik Adım", "aciklama": "Hata adımı...", "isCorrect": false, "hataliMetin": "...", "dogruMetin": "..." },
    { "adimNo": 3, "baslik": "Sonuç", "aciklama": "Doğrulama...", "isCorrect": true, "dogruMetin": "..." }
  ]
}`;

      let contents: any[] = [{ text: `${systemInstruction}\n\n${promptTemplate}` }];

      if (userPrompt) {
        contents.push({ text: `Kullanıcı Soru Metni: ${userPrompt}` });
      }

      if (isImage && imageData) {
        const parts = imageData.split('base64,');
        const mimeType = parts[0].split(';')[0].replace('data:', '') || 'image/jpeg';
        const base64Data = parts[1];
        contents.push({
          inlineData: { mimeType, data: base64Data },
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
      if (parsed) {
        if (parsed.isUnreadable || !parsed.cozumAdimlari || parsed.cozumAdimlari.length === 0) {
          return sanitizeObjectMath({
            isUnreadable: true,
            unreadableReason: parsed.unreadableReason || (isImage ? 'Soru fotoğrafı net okunamadı. Lütfen soruyu daha net ve aydınlık bir şekilde çekerek tekrar deneyin.' : 'Soru anlaşılamadı veya geçerli bir soru tespit edilemedi. Lütfen tekrar deneyin.'),
            ders: 'Analiz Edilemedi',
            konu: 'Soru Bulunamadı',
            cozumAdimlari: [],
          });
        }
        return sanitizeObjectMath({ ...parsed, isUnreadable: false });
      }
    } catch (err) {
      console.error('Client-side Gemini execution error:', err);
    }
  }

  // If image or audio could not be analyzed, NEVER generate a fake placeholder!
  if (imageData || audioData) {
    return {
      isUnreadable: true,
      unreadableReason: imageData
        ? 'Soru fotoğrafı net okunamadı veya analiz edilemedi. Lütfen sorunun daha net bir fotoğrafını çekerek tekrar deneyin.'
        : 'Ses kaydı anlaşılamadı veya geçerli bir ders sorusu tespit edilemedi. Lütfen sorunuzu net bir şekilde tekrar söyleyin.',
      ders: 'Analiz Edilemedi',
      konu: 'Soru Bulunamadı',
      cozumAdimlari: [],
    };
  }

  // Strategy C: For text-only input, check if direct math arithmetic/equation
  const mathSolved = trySolveMathExpression(userPrompt);
  if (mathSolved) {
    return sanitizeObjectMath(mathSolved);
  }

  // If text is not a math expression and AI failed, inform user to retry rather than returning fake steps
  return {
    isUnreadable: true,
    unreadableReason: 'Soru analiz edilemedi veya geçerli bir soru cümlesi bulunamadı. Lütfen sorunuzu kontrol edip tekrar deneyin.',
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
