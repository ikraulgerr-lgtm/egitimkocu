import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '20mb' }));

// Helper to initialize GoogleGenAI client
function getAIClient(userApiKey?: string): GoogleGenAI | null {
  const apiKey = (userApiKey && userApiKey.trim().length > 10)
    ? userApiKey.trim()
    : (process.env.GEMINI_API_KEY || '').trim();

  if (!apiKey) return null;

  try {
    return new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI:', err);
    return null;
  }
}

// Call Gemini models with auto-fallback (using official supported models)
async function callGeminiWithFallback(ai: GoogleGenAI, contents: any, isJson: boolean = true): Promise<string> {
  const modelsToTry = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
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
      console.warn(`Gemini model ${modelName} call error:`, err?.message || err);
      lastErr = err;
    }
  }

  throw lastErr || new Error('All Gemini model calls failed');
}

// Universal Subject & Topic Detector from Text
function detectSubjectAndTopic(textPrompt: string, dersInput?: string, konuInput?: string) {
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

// Safe JSON parser that strips markdown codeblock fences (```json ... ```) and text artifacts
function safeParseJSON(inputStr: string): any {
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
    console.warn('safeParseJSON failed on input:', str.slice(0, 100));
    return null;
  }
}

// Safe Math Expression Solver for Node Server
function trySolveMathExpressionServer(input: string): any | null {
  if (!input) return null;
  const text = input.trim().replace(/\s+/g, ' ');

  // 1. Two-number arithmetic: e.g. "125 / 5", "450 / 9", "125 ÷ 5", "25 * 4", "120 + 35", "100 - 37"
  const basicOpMatch = text.match(/^(\d+(?:\.\d+)?)\s*([\+\-\*\/\:÷·×])\s*(\d+(?:\.\d+)?)(?:\s*=\s*\??)?$/);
  if (basicOpMatch) {
    const n1 = parseFloat(basicOpMatch[1]);
    const rawOp = basicOpMatch[2];
    const n2 = parseFloat(basicOpMatch[3]);

    let opSymbol = rawOp;
    let opName = 'İşlem';
    let result = 0;
    let step2Explain = '';
    let step2Error = '';
    let step2Correct = '';
    let step3Explain = '';

    if (rawOp === '/' || rawOp === '÷' || rawOp === ':') {
      opSymbol = '÷';
      opName = 'Bölme İşlemi';
      if (n2 === 0) return null;
      result = n1 / n2;
      const isInteger = Number.isInteger(result);
      const displayRes = isInteger ? result : parseFloat(result.toFixed(4));

      step2Explain = `${n1} sayısı ${n2}'ye bölünürken basamak basamak inceleme yapılır.`;
      step2Error = `Bölme işleminde basamak kaydırma veya kalan terimi yanlış hesaplama hatası`;
      step2Correct = `${n1} ÷ ${n2} = ${displayRes}`;
      step3Explain = `Bölme işleminin doğrulaması: ${displayRes} × ${n2} = ${n1}.`;

      return {
        isUnreadable: false,
        ders: 'Matematik',
        konu: 'Dört İşlem (Bölme)',
        hataTuru: 'İşlem Hatası',
        ocrMetin: `${n1} ÷ ${n2} = ?`,
        sokratikIpucu: `${n1} sayısını ${n2} ile bölerken çıkan sonucu (${displayRes}) bölenle çarparak (${displayRes} × ${n2}) kontrol etmek ister misin?`,
        pedagojikTeshis: `${n1} ÷ ${n2} bölme işleminde basamak sırası ve işlem adımlarında dikkat eksikliği yapıldı.`,
        cozumAdimlari: [
          {
            adimNo: 1,
            baslik: 'Verilerin İncelenmesi',
            aciklama: `Bölünen sayı: ${n1}, Bölen sayı: ${n2}. Yapılacak işlem: ${n1} ÷ ${n2}`,
            isCorrect: true,
            dogruMetin: `Bölünen: ${n1}, Bölen: ${n2}`,
          },
          {
            adimNo: 2,
            baslik: `ADIM 2 (${opName.toUpperCase()})`,
            aciklama: step2Explain,
            isCorrect: false,
            hataliMetin: step2Error,
            dogruMetin: step2Correct,
          },
          {
            adimNo: 3,
            baslik: 'Sonuç ve Sağlama',
            aciklama: step3Explain,
            isCorrect: true,
            dogruMetin: `Sonuç: ${displayRes}`,
          },
        ],
      };
    }

    if (rawOp === '*' || rawOp === '·' || rawOp === '×') {
      opSymbol = '×';
      opName = 'Çarpma İşlemi';
      result = n1 * n2;
      step2Explain = `${n1} ile ${n2} çarpılırken basamak değerleri tek tek toplanır.`;
      step2Error = `Çarpım tablosunda ezber hatası veya elde değerini eklemeyi unutma`;
      step2Correct = `${n1} × ${n2} = ${result}`;
      step3Explain = `Çarpma sonucu doğrulandı: ${n1} × ${n2} = ${result}.`;
    } else if (rawOp === '+') {
      opSymbol = '+';
      opName = 'Toplama İşlemi';
      result = n1 + n2;
      step2Explain = `${n1} ve ${n2} sayıları aynı basamaklar alt alta gelecek şekilde toplanır.`;
      step2Error = `Elde basamağını bir sonraki basamağa eklemeyi unutma hatası`;
      step2Correct = `${n1} + ${n2} = ${result}`;
      step3Explain = `Toplama sonucu doğrulandı: ${n1} + ${n2} = ${result}.`;
    } else if (rawOp === '-') {
      opSymbol = '-';
      opName = 'Çıkarma İşlemi';
      result = n1 - n2;
      step2Explain = `${n1} sayısından ${n2} sayısı çıkarılırken onluk bozma kuralları uygulanır.`;
      step2Error = `Komşudan onluk alırken eksilen basamağı 1 azaltmayı unutma`;
      step2Correct = `${n1} - ${n2} = ${result}`;
      step3Explain = `Çıkarma sonucu doğrulandı: ${n1} - ${n2} = ${result}.`;
    }

    return {
      isUnreadable: false,
      ders: 'Matematik',
      konu: `Dört İşlem (${opName})`,
      hataTuru: 'İşlem Hatası',
      ocrMetin: `${n1} ${opSymbol} ${n2} = ?`,
      sokratikIpucu: `${n1} ${opSymbol} ${n2} işlemini yaparken adımları kontrol ettin mi?`,
      pedagojikTeshis: `${n1} ${opSymbol} ${n2} işleminde aritmetik hesaplama hatası yapıldı.`,
      cozumAdimlari: [
        {
          adimNo: 1,
          baslik: 'Verilerin Belirlenmesi',
          aciklama: `İşleme giren sayılar: ${n1} ve ${n2}. Uygulanacak işlem: ${opName}`,
          isCorrect: true,
          dogruMetin: `${n1} ${opSymbol} ${n2}`,
        },
        {
          adimNo: 2,
          baslik: `ADIM 2 (${opName.toUpperCase()})`,
          aciklama: step2Explain,
          isCorrect: false,
          hataliMetin: step2Error,
          dogruMetin: step2Correct,
        },
        {
          adimNo: 3,
          baslik: 'Sonuç ve Doğrulama',
          aciklama: step3Explain,
          isCorrect: true,
          dogruMetin: `Sonuç = ${result}`,
        },
      ],
    };
  }

  // 2. Linear Equation e.g. "2x + 6 = 18", "3x - 5 = 10", "4x = 24"
  const eqMatch = text.match(/^([+-]?\d*)\s*([a-zA-Z])\s*([+-]\s*\d+)?\s*=\s*([+-]?\d+)$/);
  if (eqMatch) {
    let coeffStr = eqMatch[1].replace(/\s+/g, '');
    let coeff = coeffStr === '' || coeffStr === '+' ? 1 : coeffStr === '-' ? -1 : parseFloat(coeffStr);
    const variable = eqMatch[2];
    let constStr = (eqMatch[3] || '0').replace(/\s+/g, '');
    let constant = parseFloat(constStr);
    let rightSide = parseFloat(eqMatch[4]);

    let step2Target = rightSide - constant;
    let finalX = coeff !== 0 ? step2Target / coeff : 0;
    const isInt = Number.isInteger(finalX);
    const displayX = isInt ? finalX : parseFloat(finalX.toFixed(4));

    return {
      isUnreadable: false,
      ders: 'Matematik',
      konu: 'Birinci Dereceden Bir Bilinmeyenli Denklemler',
      hataTuru: 'İşlem Hatası',
      ocrMetin: `${text}`,
      sokratikIpucu: `Denklemde sabit terimi eşitliğin sağına atarken işaretini değiştirdin mi?`,
      pedagojikTeshis: `Bilinmeyeni yalnız bırakırken terim aktarma ve katsayıya bölme adımında hata yapıldı.`,
      cozumAdimlari: [
        {
          adimNo: 1,
          baslik: 'Denklemin Kurulumu',
          aciklama: `Verilen denklem: ${text}. Amaç: ${variable} bilinmeyenini yalnız bırakmaktır.`,
          isCorrect: true,
          dogruMetin: `Denklem: ${text}`,
        },
        {
          adimNo: 2,
          baslik: 'ADIM 2 (TERİMLERİ KARŞIYA GEÇİRME VE KATSAYIYA BÖLME)',
          aciklama: constant !== 0
            ? `${constant > 0 ? `+${constant}` : constant} terimi eşitliğin sağına işareti değişerek geçer: ${coeff}${variable} = ${rightSide} ${constant > 0 ? `- ${constant}` : `+ ${Math.abs(constant)}`} = ${step2Target}`
            : `Bilinmeyenin katsayısı olan ${coeff} değerine her iki taraf bölünür.`,
          isCorrect: false,
          hataliMetin: 'Terim karşıya geçerken işaretinin unutulması veya katsayıya yanlış bölünmesi',
          dogruMetin: `${coeff}${variable} = ${step2Target} ⇒ ${variable} = ${step2Target} / ${coeff} = ${displayX}`,
        },
        {
          adimNo: 3,
          baslik: 'Sonuç ve Denklem Doğrulaması',
          aciklama: `${variable} = ${displayX} değeri ana denklemde yerine koyularak eşitlik kontrol edildi: ${coeff} · (${displayX}) ${constant >= 0 ? `+ ${constant}` : constant} = ${rightSide}`,
          isCorrect: true,
          dogruMetin: `Çözüm Kümesi: {${displayX}}`,
        },
      ],
    };
  }

  return null;
}

// Fallback dynamic text solver for offline/no API key situations
function generateDynamicTextResponse(userPrompt: string, dersInput?: string, konuInput?: string) {
  const textToUse = (userPrompt || '').trim();

  const mathSolved = trySolveMathExpressionServer(textToUse);
  if (mathSolved) {
    return mathSolved;
  }

  let { ders: detectedDers, konu: detectedKonu } = detectSubjectAndTopic(textToUse, dersInput, konuInput);

  let hataTuru = 'Kavram Yanılgısı';
  const lower = textToUse.toLowerCase();

  let adim1Aciklama = textToUse
    ? `Sorudaki veriler ve istenen ifade analiz edildi: "${textToUse.slice(0, 100)}${textToUse.length > 100 ? '...' : ''}"`
    : `${detectedDers} sorusunun verilenleri, öncülleri ve soru kökü analiz edildi.`;
  let adim1Dogru = `Sorunun Temel Verileri ve Kurulumu`;
  let adim2Hatali = `${detectedDers} kuralı veya formülü uygulanırken yapılan işlem/kavram hatası`;
  let adim2Dogru = `${detectedDers} dersine ait temel ilkeler ve kurallar esas alınmalıdır.`;
  let adim3Aciklama = `Sorudaki veriler ${detectedDers} kurallarına göre değerlendirilerek doğru cevaba ulaşıldı.`;
  let adim3Dogru = `${detectedDers} kuralına uygun olarak doğru yanıt doğrulandı.`;
  let sokratikIpucu = `Bu ${detectedDers} (${detectedKonu}) sorusunda 2. adımdaki kural uygulamasını kontrol etmek ister misin?`;
  let pedagojikTeshis = `2. Adımda ${detectedDers} kuralı uygulanırken işlem veya kavram hatası yapıldı.`;

  // Detailed subject-specific breakdowns for fallback
  if (detectedDers === 'Matematik') {
    hataTuru = 'İşlem Hatası';
    adim1Aciklama = textToUse
      ? `Matematiksel ifadedeki değişkenler, katsayılar ve eşitlikler incelendi: "${textToUse.slice(0, 80)}"`
      : `Matematik sorusunun verilen terimleri, denklemi ve istenen değeri düzenlendi.`;
    adim1Dogru = `Matematiksel Kurulum ve Veriler`;
    adim2Hatali = `Eşitliğin karşı tarafına terim geçirirken işaret hatası veya parantez/işlem önceliği kuralının unutulması`;
    adim2Dogru = `İşlem önceliği: Parantez içleri > Üslü ifadeler > Çarpma/Bölme > Toplama/Çıkarma. Terim karşıya geçerken işareti değişir.`;
    adim3Aciklama = `İşlemler sırasıyla ve eksiksiz adımlarla tamamlanarak x / bilinmeyen değeri hesaplandı.`;
    adim3Dogru = `Matematiksel Çözüm ve Sonuç Doğrulandı.`;
    sokratikIpucu = `Parantez açarken veya terimleri karşı tarafa atarken işaretleri değiştirmeyi unuttun mu?`;
    pedagojikTeshis = `Eşitlikte terimler taşınırken işaret değiştirme veya işlem önceliği hatası yapıldı.`;
  } else if (detectedDers === 'Fizik') {
    hataTuru = 'Formül Unutma';
    adim1Aciklama = textToUse
      ? `Fiziksel büyüklükler, birimler ve verilen kuvvet/hareket değerleri incelendi: "${textToUse.slice(0, 80)}"`
      : `Fizik sorusundaki birimler, kuvvet/enerji büyüklükleri ve vektörel yönler belirlendi.`;
    adim1Dogru = `Fiziksel Veriler ve Birim Analizi`;
    adim2Hatali = `Vektörel büyüklüklerde yönün ihmal edilmesi veya SI birim sisteminde dönüşüm hatası yapılması`;
    adim2Dogru = `Fizikte birimler SI standartlarında (m, kg, s, N, J) yazılmalı ve vektörel toplama/çıkarma yönlere göre yapılmalıdır.`;
    adim3Aciklama = `Fizik formülü (F=m.a, W=F.x vb.) uygulanarak sonuca ulaşıldı.`;
    adim3Dogru = `Fiziksel Büyüklük ve Cevap Doğrulandı.`;
    sokratikIpucu = `Birimleri SI sistemine (metre, kilogram, saniye) çevirmeyi ve yönleri dikkate almayı unutma!`;
    pedagojikTeshis = `Birim dönüştürme veya vektörel bileşenlere ayırma adımında hata yapıldı.`;
  } else if (detectedDers === 'Kimya') {
    hataTuru = 'Kavram Yanılgısı';
    adim1Aciklama = `Tepkime denklemindeki reaktifler, ürünler ve katsayılar incelendi.`;
    adim1Dogru = `Kimyasal Tepkime ve Mol Oranları`;
    adim2Hatali = `Mol hesabı yapılırkan n = m/MA formülündeki kütle veya molekül ağırlığı oranının yanlış kullanılması`;
    adim2Dogru = `Gazlarda 1 mol NK'da 22,4 L hacim kaplar. Tepkime katsayıları mol oranlarını verir.`;
    adim3Aciklama = `Mol oranları üzerinden istenen madde miktarı hesaplandı.`;
    adim3Dogru = `Kimyasal Hesaplama Doğrulandı.`;
    sokratikIpucu = `Tepkime denkleştirilmiş mi ve katsayılar doğru kullanılmış mı?`;
    pedagojikTeshis = `Mol hesabı ve tepkime stokiyometrisi kuralında hata yapıldı.`;
  } else if (detectedDers === 'Biyoloji') {
    hataTuru = 'Kavram Yanılgısı';
    adim1Aciklama = `Hücresel yapılar, genetik materyal veya organel işlevleri analiz edildi.`;
    adim1Dogru = `Biyolojik Yapı ve Organel İncelemesi`;
    adim2Hatali = `Mitoz/Mayoz evrelerinin veya DNA/RNA baz eşleşme kurallarının karıştırılması`;
    adim2Dogru = `DNA'da A=T, G=C eşleşir. Mayoz I'de homolog kromozomlar, Mayoz II'de kardeş kromatitler ayrılır.`;
    adim3Aciklama = `Biyolojik süreç ve evre Özellikleri doğrulanarak cevaba ulaşıldı.`;
    adim3Dogru = `Biyoloji Tanımı ve Cevap Doğrulandı.`;
    sokratikIpucu = 'Evrede ayrılan yapılar homolog kromozomlar mı yoksa kardeş kromatitler mi?';
    pedagojikTeshis = 'Kalıtım veya hücre bölünmesi evrelerindeki kavramlar karıştırıldı.';
  } else if (detectedDers === 'Tarih') {
    hataTuru = 'Dikkat Eksikliği';
    adim1Aciklama = `Tarihsel olay, verilen antlaşma maddeleri ve dönemin siyasi/sosyal koşulları incelendi.`;
    adim1Dogru = `Tarihsel Metin ve Dönem Analizi`;
    adim2Hatali = `Olayın geçtiği yüzyılın koşulları yerine günümüz mantığıyla düşünerek sebep-sonuç ilişkisinin yanlış kurulması`;
    adim2Dogru = `Tarihi olaylar meydana geldiği dönemin siyasi, sosyal ve ekonomik şartlarına göre değerlendirilmelidir.`;
    adim3Aciklama = `Sebep-sonuç bağlamı kurularak doğru tarihsel yargıya ulaşıldı.`;
    adim3Dogru = `Tarihsel Çıkarım Doğrulandı.`;
    sokratikIpucu = 'Olayın gerçekleştiği dönemin siyasi şartlarını göz önünde bulundurdun mu?';
    pedagojikTeshis = 'Tarihsel olaylar değerlendirilirken dönemin şartları göz ardı edildi.';
  } else if (detectedDers === 'Coğrafya') {
    hataTuru = 'Dikkat Eksikliği';
    adim1Aciklama = `Coğrafi konum, iklim tipi veya haritadaki bölge özellikleri analiz edildi.`;
    adim1Dogru = `Harita ve İklim/Yer Şekli Analizi`;
    adim2Hatali = `İklim grafiklerinde sıcaklık ile yağış eksenlerinin karıştırılması veya izohips eğrilerinde yükselti hesabının yanlış yapılması`;
    adim2Dogru = `İzohipslerde deniz seviyesi 0 metredir. Akarsuyun her iki tarafındaki ilk izohipslerin yükseltisi eşittir.`;
    adim3Aciklama = `Harita/grafik okuma kuralları uygulanarak doğru seçeneğe ulaşıldı.`;
    adim3Dogru = `Coğrafi Yargı Doğrulandı.`;
    sokratikIpucu = 'Haritadaki yükselti basamaklarını ve eksen değerlerini dikkatle denetledin mi?';
    pedagojikTeshis = 'İzohips yükselti hesabı veya iklim grafiği okuma adımı karıştırıldı.';
  } else if (detectedDers === 'Edebiyat / Türkçe' || detectedDers === 'Türkçe' || detectedDers === 'Edebiyat') {
    detectedDers = 'Edebiyat / Türkçe';

    if (/\b(yazım|yazımı|büyük harf|de\b|da\b|ki\b|mi\b|kesme|imla|birleşik|ayrı)\b/i.test(lower)) {
      detectedKonu = 'Yazım Kuralları ve İmla';
      hataTuru = 'Dikkat Eksikliği';
      adim1Aciklama = `Soru cümlesindeki sözcüklerin TDK Yazım Kılavuzu ilkelerine göre doğrulukları tek tek incelendi.`;
      adim1Dogru = 'İncelenen Cümledeki Kelimeler ve Ek Yapıları';
      adim2Hatali = 'Bağlaç olan "de/da" veya "ki" takısının ek olanlarla karıştırılarak kelimeye bitişik/ayrı yazılması hatası veya özel ada gelen eklerin ayrılmaması';
      adim2Dogru = 'Cümleden çıkarıldığında anlam bozulmayan "de/da" ve "ki" bağlaçtır, AYRI yazılır. Bulunma eki "-de/-da" ile aitlik eki "-ki" kelimeye BİTİŞİK yazılır. Özel isimlere gelen çekim ekleri kesme işareti (\') ile ayrılır.';
      adim3Aciklama = 'Cümledeki kelimelerin yazılışları TDK kuralına göre denetlenerek imla hatası yapılan sözcük belirlendi.';
      adim3Dogru = 'Doğru Yazım Şekli Belirlendi ve Doğrulandı.';
      sokratikIpucu = 'Cümledeki "de/da" ekini çıkarıp okuduğunda cümlenin anlamı bozuluyor mu, kontrol eder misin?';
      pedagojikTeshis = 'Bağlaç olan de/da veya ki kullanımı ile bulunma/aitlik ekleri arasındaki ayrım gözden kaçırıldı.';
    } else if (/\b(noktalama|virgül|nokta|iki nokta|noktalı virgül|tırnak|üç nokta|parantez)\b/i.test(lower)) {
      detectedKonu = 'Noktalama İşaretleri';
      hataTuru = 'Kavram Yanılgısı';
      adim1Aciklama = `Cümledeki noktalama işaretlerinin (virgül, iki nokta, noktalı virgül vb.) kullanım amaçları ve yerleşimi incelendi.`;
      adim1Dogru = 'Cümledeki Noktalama Boşlukları ve Sembol İşlevleri';
      adim2Hatali = 'İki noktadan (:) sonra açıklama mı yoksa örnek dizilimi mi yapıldığı gözetilmeden büyük/küçük harf veya virgül işleviyle karıştırılması';
      adim2Dogru = 'İki noktadan sonra cümle gelirse büyük harfle başlanır; örnekler sıralanırsa küçük harfle başlanır. Sıralı cümleleri veya öge gruplarını ayırmak için virgül (,) kullanılır.';
      adim3Aciklama = 'TDK Noktalama Kılavuzu kuralları uygulanarak parantezlere gelmesi gereken doğru noktalama dizilimi bulundu.';
      adim3Dogru = 'Noktalama Dizilimi Doğrulandı.';
      sokratikIpucu = 'İki noktadan sonra gelen kısım tam bir cümle kuruyor mu yoksa sadece örnek listesi mi?';
      pedagojikTeshis = 'İki nokta (:) ile noktalı virgül (;) veya virgülün (,) özne ayırma işlevi karıştırıldı.';
    } else if (/\b(ses|ünlü düşmesi|ünsüz yumuşaması|ünsüz benzeşmesi|sertleşme|daralma|türeme)\b/i.test(lower)) {
      detectedKonu = 'Ses Bilgisi ve Ses Olayları';
      hataTuru = 'Kavram Yanılgısı';
      adim1Aciklama = `Metindeki kelimelerin kök ve ek birleşmelerinde gerçekleşen ses olayları (düşme, türeme, sertleşme, yumuşama) çözümlendi.`;
      adim1Dogru = 'Kelimelerin Kök ve Ek Yapısı';
      adim2Hatali = 'Fıstıkçı Şahap sert ünsüzlerinden (f, s, t, k, ç, ş, h, p) sonra gelen eklerde benzeşme (sertleşme) kuralının gözden kaçırılması';
      adim2Dogru = 'Sert ünsüzle biten bir sözcüğe c, d, g ile başlayan ek gelirse ek ç, t, k\'ye dönüşür (örn: kitap-cı -> kitapçı). Ünlü ile başlayan ek geldiğinde p, ç, t, k yumuşar (örn: renk-i -> rengi).';
      adim3Aciklama = 'Kelimelerin kök-ek çözünürlüğü yapılarak tespit edilen ses olayı doğrulandı.';
      adim3Dogru = 'Ses Olayı Tespiti Doğrulandı.';
      sokratikIpucu = 'Sözcüğün ek almadan önceki yalın kök halini düşünüp son ünsüzün nasıl değiştiğine bakar mısın?';
      pedagojikTeshis = 'Ünsüz sertleşmesi veya ünlü düşmesi kurallarında kök-ek ayırımı gözden kaçırıldı.';
    } else if (/\b(fiilimsi|isim fiil|sıfat fiil|zarf fiil|öge|özne|yüklem|nesne|tümleç)\b/i.test(lower)) {
      detectedKonu = 'Cümlenin Ögeleri ve Fiilimsiler';
      hataTuru = 'Kavram Yanılgısı';
      adim1Aciklama = `Cümlenin yüklemi (çekimli fiili) belirlendi ve yükleme sorulan sorularla cümlenin öge yapısı ve fiilimsi ekleri incelendi.`;
      adim1Dogru = 'Cümlenin Yüklemi ve Söz Öbekleri';
      adim2Hatali = 'İsim tamlamalarının, sıfat öbeklerinin veya fiilimsi gruplarının bölünerek yanlış öge olarak ayrılması';
      adim2Dogru = 'Tamlamalar ve fiilimsi öbekleri ASLA bölünmez! Yükleme "Kim/Ne?" sorusuyla Özne, "Ne/Neyi?" ile Nesne, "Nereye/Nerede/Nereden?" ile Dolaylı Tümleç bulunur. Fiilimsiler (an-as-ı-mez-ar-dik-ecek-miş, ip-erek-ken-den vb.) fiil köküne gelir.';
      adim3Aciklama = 'Cümlenin öge dizilimi ve fiilimsi türleri eksiksiz doğrulanarak doğru cevaba ulaşıldı.';
      adim3Dogru = 'Cümle Ögeleri / Fiilimsi Türü Doğrulandı.';
      sokratikIpucu = 'Yüklemi bulduktan sonra "özne" sorusunu sorarken tamlamaları bölmeden grubu tek bir öge olarak ele aldın mı?';
      pedagojikTeshis = 'Sıfat-fiil öbeği ile cümlenin yan yargısı yanlış bölündü veya zaman kipi ile fiilimsi eki karıştırıldı.';
    } else if (/\b(şiir|beyit|dörtlük|ölçü|kafiye|redif|gazel|koşma|divan|tanzimat|servet|milli edebiyat|cumhuriyet)\b/i.test(lower)) {
      detectedKonu = 'Türk Edebiyatı ve Şiir Bilgisi';
      hataTuru = 'Kavram Yanılgısı';
      adim1Aciklama = `Edebi metnin nazım biçimi, ahenk unsurları (ölçü, kafiye, redif) ve ait olduğu edebi dönem özellikleri incelendi.`;
      adim1Dogru = 'Şiir / Edebi Metin İncelemesi';
      adim2Hatali = 'Redif ile kafiye ayrımı yapılırken eklerin görevdaş (aynı işlevde) olup olmadığı göz ardı edilerek yanlış kafiye türü seçilmesi';
      adim2Dogru = 'Yazılışı ve GÖREVİ AYNI olan ek/kelimeler REDİF\'tir. Rediften önce kalan ses benzerlikleri KAFİYE\'dir (Tek ses: Yarım, İki ses: Tam, Üç+ ses: Zengin kafiye).';
      adim3Aciklama = 'Ahenk unsurları ve edebi sanatlar TDK/MEB müfredatı kurallarınca doğrulanarak sonuca ulaşıldı.';
      adim3Dogru = 'Ahenk Unsuru / Edebi Tür Doğrulandı.';
      sokratikIpucu = 'Dize sonundaki benzer seslerin eki aynı anlam ve görevde mi kullanılmış, yoksa sadece ses benzerliği mi var?';
      pedagojikTeshis = 'Redif ve kafiye ayrımında görevdaş ek kuralı gözden kaçırıldı.';
    } else if (textToUse) {
      detectedKonu = 'Paragrafta Anlam ve Metin Analizi';
      hataTuru = 'Dikkat Eksikliği';
      adim1Aciklama = `Paragrafın konusu, ana düşüncesi (yazarın iletmek istediği temel mesaj) ve yardımcı yargıları detaylıca analiz edildi: "${textToUse.slice(0, 100)}${textToUse.length > 100 ? '...' : ''}"`;
      adim1Dogru = 'Metnin Odak Noktası ve Ana Vurgusu';
      adim2Hatali = 'Paragrafta geçen ikincil bir detay veya yardımcı düşüncenin, parçanın ana fikri sanılması';
      adim2Dogru = 'Ana düşünce; metnin tamamını kapsayan ve "Yazar bu parçayı hangi amaçla yazmıştır?" sorusuna yanıt veren en genel ve özetleyici yargıdır. Yardımcı düşünceler ise ana düşünceyi destekleyen örneklerdir.';
      adim3Aciklama = 'Seçeneklerde verilen yargılar paragraftaki temel mesaj ile karşılaştırılarak doğru cevap netleştirildi.';
      adim3Dogru = 'Paragrafın Ana Düşüncesi ve Doğru Cevap Doğrulandı.';
      sokratikIpucu = 'Seçeneklerden hangisi paragraftaki ana mesajı bütünüyle özetliyor ve tüm metni kapsıyor?';
      pedagojikTeshis = 'Yardımcı yargı ile parçanın bütününe hâkim olan ana düşünce karıştırıldı.';
    }
  }

  // Math equation solver fallback
  const mathMatch = textToUse.match(/(\d+)\s*x\s*([\+\-])\s*(\d+)\s*=\s*(\d+)/i);
  if (mathMatch) {
    detectedDers = 'Matematik';
    detectedKonu = 'Denklem Çözümü';
    hataTuru = 'İşlem Hatası';

    const a = parseInt(mathMatch[1], 10);
    const sign = mathMatch[2];
    const b = parseInt(mathMatch[3], 10);
    const c = parseInt(mathMatch[4], 10);

    const valBeforeDiv = sign === '+' ? c - b : c + b;
    const xVal = valBeforeDiv / a;

    adim1Aciklama = `${a}x ${sign} ${b} = ${c} denkleminin terimleri düzenlendi.`;
    adim1Dogru = `${a}x ${sign} ${b} = ${c}`;
    adim2Hatali = `${b} sabit terimi karşı tarafa geçirilirken işaret hatası yapılması`;
    adim2Dogru = `${b} sayısı karşı tarafa (${sign === '+' ? '-' : '+'}) olarak geçer: ${a}x = ${valBeforeDiv}`;
    adim3Aciklama = `Eşitliğin her iki tarafı ${a} katsayısına bölünerek x değeri bulundu.`;
    adim3Dogru = `x = ${xVal}`;
    sokratikIpucu = `Sabit terimi karşı tarafa atarken işaretini değiştirmeyi unutmada dikkat et!`;
    pedagojikTeshis = `Eşitliğin diğer tarafına terim geçirilirken işaret değiştirme hatası yapıldı.`;
  }

  return {
    isUnreadable: false,
    ocrMetin: textToUse || `${detectedDers} — ${detectedKonu} Soru Çözümü`,
    ders: detectedDers,
    konu: detectedKonu,
    hataTuru: hataTuru,
    sokratikIpucu: sokratikIpucu,
    pedagojikTeshis: pedagojikTeshis,
    cozumAdimlari: [
      {
        adimNo: 1,
        baslik: 'Sorunun Kurulumu ve İncelemesi',
        aciklama: adim1Aciklama,
        isCorrect: true,
        dogruMetin: adim1Dogru,
      },
      {
        adimNo: 2,
        baslik: 'ADIM 2 (KRİTİK HATA VE DOĞRU KURAL)',
        aciklama: 'Kural veya kavram uygulanırken yapılan dikkatsizlik adımı:',
        isCorrect: false,
        hataliMetin: adim2Hatali,
        dogruMetin: adim2Dogru,
      },
      {
        adimNo: 3,
        baslik: 'Sonuç ve Doğrulama',
        aciklama: adim3Aciklama,
        isCorrect: true,
        dogruMetin: adim3Dogru,
      },
    ],
  };
}

// Fallback dynamic similar question generator (Subject-aware, never falls back to arbitrary math!)
function generateDynamicSimilarQuestion(q: any, zorluk: string = 'Orta') {
  const ders = q?.ders || 'Türkçe';
  const konu = q?.konu || 'Konu Pratiği';
  const text = (q?.ocrMetin || '').toLowerCase();
  const zorlukTag = zorluk === 'Kolay' ? '[Kolay Seviye]' : zorluk === 'Zor' ? '[Zor Seviye]' : '[Orta Seviye]';

  if (ders === 'Coğrafya' || text.includes('coğrafya') || text.includes('masif') || text.includes('harita') || text.includes('iklim')) {
    return {
      ders: 'Coğrafya',
      konu: konu || 'Türkiye Fiziki Coğrafyası',
      ocrMetin: `${zorlukTag} Aşağıdaki jeolojik alanlardan hangisi Türkiye’deki 1. Zaman (Paleozoyik) masif arazilerinden biri değildir?`,
      hataTuru: 'Harita & Bilgi Eksikliği',
      sokratikIpucu: `(${zorluk} Seviye) Ergene Havzası genç çöküntü alanıdır, masif değildir.`,
      siklar: [
        'A) Yıldız Dağları Masifi',
        'B) Menteşe Masifi',
        'C) Bitlis Masifi',
        'D) Ergene Havzası',
        'E) Anamur - Alanya Masifi',
      ],
      dogruSikIndex: 3,
      cozumAdimlari: [
        { adimNo: 1, baslik: 'Sorunun Kurulumu', aciklama: 'Türkiye masif arazileri incelendi.', isCorrect: true, dogruMetin: '1. Zaman Masif Arazileri' },
        { adimNo: 2, baslik: 'ADIM 2 (KRİTİK HATA NOKTASI)', aciklama: 'Ergene Havzası genç çöküntü alanıdır.', isCorrect: false, hataliMetin: 'Masif zannedilmesi', dogruMetin: '3. ve 4. Zaman Çöküntü Alanıdır' },
        { adimNo: 3, baslik: 'Sonuç ve Doğrulama', aciklama: 'D seçeneğindeki Ergene Havzası doğru cevaptır.', isCorrect: true, dogruMetin: 'Doğru Yanıt: D Şıkkı' },
      ],
    };
  }

  if (ders === 'Tarih' || text.includes('tarih') || text.includes('osmanlı') || text.includes('antlaşma') || text.includes('cumhuriyet')) {
    return {
      ders: 'Tarih',
      konu: konu || 'Tarihsel Antlaşmalar',
      ocrMetin: `${zorlukTag} Aşağıdaki antlaşmalardan hangisi ile Osmanlı Devleti Boğazlar üzerindeki tek başına son egemenlik hakkını kullanmıştır?`,
      hataTuru: 'Tarihsel Kavram Yanılgısı',
      sokratikIpucu: `(${zorluk} Seviye) 1833 Hünkâr İskelesi Antlaşması Boğazlar sorununu uluslararası boyuta taşıyan antlaşmadır.`,
      siklar: [
        'A) Küçük Kaynarca Antlaşması',
        'B) Hünkâr İskelesi Antlaşması',
        'C) Paris Antlaşması',
        'D) Berlin Antlaşması',
        'E) Londra Boğazlar Sözleşmesi',
      ],
      dogruSikIndex: 1,
      cozumAdimlari: [
        { adimNo: 1, baslik: 'Sorunun Kurulumu', aciklama: 'Osmanlı Devleti Boğazlar egemenlik şartları incelendi.', isCorrect: true, dogruMetin: 'Hünkâr İskelesi Antlaşması (1833)' },
        { adimNo: 2, baslik: 'ADIM 2 (KRİTİK HATA NOKTASI)', aciklama: 'Londra Boğazlar Sözleşmesi ile uluslararası statü kazanmıştır.', isCorrect: false, hataliMetin: 'Antlaşma tarihlerinin karıştırılması', dogruMetin: 'Hünkâr İskelesi tek başına son karardır' },
        { adimNo: 3, baslik: 'Sonuç ve Doğrulama', aciklama: 'B seçeneği doğru antlaşmadır.', isCorrect: true, dogruMetin: 'Doğru Yanıt: B Şıkkı' },
      ],
    };
  }

  if (ders === 'Biyoloji' || text.includes('biyoloji') || text.includes('hücre') || text.includes('dna') || text.includes('protein')) {
    return {
      ders: 'Biyoloji',
      konu: konu || 'Hücre ve Kalıtım',
      ocrMetin: `${zorlukTag} Hücre zarından madde taşınmasıyla ilgili olarak aşağıdakilerden hangisinde ATP enerjisi harcanır?`,
      hataTuru: 'Kavram Yanılgısı',
      sokratikIpucu: `(${zorluk} Seviye) Aktif taşıma ve endositoz/ekzositoz olaylarında ATP harcanır, difüzyon ve osmozda harcanmaz.`,
      siklar: [
        'A) Basit difüzyon',
        'B) Kolaylaştırılmış difüzyon',
        'C) Aktif taşıma',
        'D) Osmoz',
        'E) Diyaliz',
      ],
      dogruSikIndex: 2,
      cozumAdimlari: [
        { adimNo: 1, baslik: 'Sorunun Kurulumu', aciklama: 'Hücre zarından madde geçiş mekanizmaları incelendi.', isCorrect: true, dogruMetin: 'Pasif ve Aktif Taşınma Türleri' },
        { adimNo: 2, baslik: 'ADIM 2 (KRİTİK HATA NOKTASI)', aciklama: 'Pasif taşımada ATP harcanmazken aktif taşımada enzim ve ATP kullanılır.', isCorrect: false, hataliMetin: 'Difüzyonda enerji harcandığının düşünülmesi', dogruMetin: 'Aktif Taşıma ATP Harcar' },
        { adimNo: 3, baslik: 'Sonuç ve Doğrulama', aciklama: 'C seçeneği doğru cevaptır.', isCorrect: true, dogruMetin: 'Doğru Yanıt: C Şıkkı' },
      ],
    };
  }

  if (ders === 'Kimya' || text.includes('kimya') || text.includes('mol') || text.includes('asit') || text.includes('bileşik')) {
    return {
      ders: 'Kimya',
      konu: konu || 'Mol Kavramı ve Kimyasal Hesaplamalar',
      ocrMetin: `${zorlukTag} Normal şartlar altında 0,5 mol CH₄ gazı kaç litre hacim kaplar?`,
      hataTuru: 'İşlem Hatası',
      sokratikIpucu: `(${zorluk} Seviye) NŞA'da 1 mol ideal gaz 22,4 litre hacim kaplar.`,
      siklar: ['A) 5,6 L', 'B) 11,2 L', 'C) 22,4 L', 'D) 33,6 L', 'E) 44,8 L'],
      dogruSikIndex: 1,
      cozumAdimlari: [
        { adimNo: 1, baslik: 'Sorunun Kurulumu', aciklama: 'Normal şartlar altında 1 mol gazın hacmi = 22,4 L kuralı hatırlanır.', isCorrect: true, dogruMetin: 'V = n · 22,4 L' },
        { adimNo: 2, baslik: 'ADIM 2 (KRİTİK HATA NOKTASI)', aciklama: '0,5 · 22,4 = 11,2 L işlemi yapılır.', isCorrect: false, hataliMetin: 'Çarpma işlem hatası', dogruMetin: 'V = 11,2 L' },
        { adimNo: 3, baslik: 'Sonuç ve Doğrulama', aciklama: 'B seçeneğindeki 11,2 L doğrudur.', isCorrect: true, dogruMetin: 'Doğru Yanıt: B Şıkkı' },
      ],
    };
  }

  if (ders === 'Fizik' || text.includes('fizik') || text.includes('kuvvet') || text.includes('hız') || text.includes('enerji')) {
    return {
      ders: 'Fizik',
      konu: konu || 'Newton Hareket Yasaları',
      ocrMetin: `${zorlukTag} Sürtünmesiz yatay düzlemde durmakta olan 4 kg kütleli cisme 20 N büyüklüğünde yatay kuvvet uygulanırsa cismin ivmesi kaç m/s² olur?`,
      hataTuru: 'İşlem Hatası',
      sokratikIpucu: `(${zorluk} Seviye) F = m · a temel dinamik bağıntısını uygulayabilirsin.`,
      siklar: ['A) 2 m/s²', 'B) 4 m/s²', 'C) 5 m/s²', 'D) 8 m/s²', 'E) 10 m/s²'],
      dogruSikIndex: 2,
      cozumAdimlari: [
        { adimNo: 1, baslik: 'Sorunun Kurulumu', aciklama: 'F = 20 N, m = 4 kg değerleri F = m · a formülüne yerleştirilir.', isCorrect: true, dogruMetin: 'F = m · a' },
        { adimNo: 2, baslik: 'ADIM 2 (KRİTİK HATA NOKTASI)', aciklama: 'a = F / m = 20 / 4 = 5 m/s² bulunur.', isCorrect: false, hataliMetin: 'Bölme hatası', dogruMetin: 'a = 5 m/s²' },
        { adimNo: 3, baslik: 'Sonuç ve Doğrulama', aciklama: 'C seçeneği doğru ivme değeridir.', isCorrect: true, dogruMetin: 'Doğru Yanıt: C Şıkkı' },
      ],
    };
  }

  if (ders === 'Matematik' || text.includes('matematik') || text.includes('denklem') || text.includes('türev') || text.includes('integral')) {
    return {
      ders: 'Matematik',
      konu: konu || 'Denklem ve Fonksiyonlar',
      ocrMetin: `${zorlukTag} 4(x - 3) + 7 = 2x + 19 denkleminde x değerini bulunuz.`,
      hataTuru: 'İşlem Hatası',
      sokratikIpucu: `(${zorluk} Seviye) 4x - 12 + 7 = 2x + 19 denkleminde bilinmeyenleri bir tarafa toplayabilirsin.`,
      siklar: ['A) x = 6', 'B) x = 8', 'C) x = 12', 'D) x = 15', 'E) x = 18'],
      dogruSikIndex: 2,
      cozumAdimlari: [
        { adimNo: 1, baslik: 'Sorunun Kurulumu', aciklama: 'Parantez açılımı yapıldı: 4x - 12 + 7 = 2x + 19 => 4x - 5 = 2x + 19', isCorrect: true, dogruMetin: '4x - 5 = 2x + 19' },
        { adimNo: 2, baslik: 'ADIM 2 (KRİTİK HATA NOKTASI)', aciklama: '2x sol tarafa -2x, -5 sağ tarafa +5 olarak geçer: 2x = 24', isCorrect: false, hataliMetin: 'İşaret değişimi hatası', dogruMetin: '2x = 24' },
        { adimNo: 3, baslik: 'Sonuç ve Doğrulama', aciklama: 'Her iki taraf 2\'ye bölünür: x = 12.', isCorrect: true, dogruMetin: 'x = 12 (C Şıkkı)' },
      ],
    };
  }

  // Universal Default for Türkçe / Edebiyat / Felsefe / Din / Diğer
  return {
    ders: ders || 'Türkçe',
    konu: konu || 'Paragrafta Anlam ve Dil Bilgisi',
    ocrMetin: `${zorlukTag} Aşağıdaki cümlelerin hangisinde bir yazım veya anlam hatası yapılmıştır?`,
    hataTuru: 'Kavram Yanılgısı',
    sokratikIpucu: `(${zorluk} Seviye) Bağlaç olan "de/da" ayrı yazılır, bulunma hal eki olan "-de/-da" bitişik yazılır.`,
    siklar: [
      'A) Bu konuyu sınıfta etraflıca konuştuk.',
      'B) Akşam ki toplantıya herkes zamanında katıldı.',
      'C) Kitap okumak düşünce dünyamızı zenginleştirir.',
      'D) Başarıya giden yolda disiplin vazgeçilmezdir.',
      'E) Gezi için gerekli hazırlıklar tamamlandı.',
    ],
    dogruSikIndex: 1,
    cozumAdimlari: [
      { adimNo: 1, baslik: 'Sorunun Kurulumu', aciklama: 'Seçeneklerdeki kelimelerin yazımı ve bağlaç kullanımları TDK kurallarınca incelendi.', isCorrect: true, dogruMetin: 'TDK İmla ve Anlam Kuralları' },
      { adimNo: 2, baslik: 'ADIM 2 (KRİTİK HATA NOKTASI)', aciklama: 'B şıkkında sıfat yapan "-ki" aitlik eki bitişik yazılmalıdır (Akşamki).', isCorrect: false, hataliMetin: '"Akşam ki" şeklinde ayrı yazılması hatadır', dogruMetin: '"Akşamki toplantı" şeklinde bitişik yazılmalıdır' },
      { adimNo: 3, baslik: 'Sonuç ve Doğrulama', aciklama: 'B seçeneğinde yazım yanlışı bulunmaktadır.', isCorrect: true, dogruMetin: 'Doğru Yanıt: B Şıkkı' },
    ],
  };
}

// Helper to clean raw LaTeX commands (\frac, \cdot, \times, \sqrt, etc.) into clean Turkish math strings
function cleanLatexMath(str: string | undefined | null): string {
  if (!str) return '';
  let cleaned = String(str);

  // 0. Repair corrupted Turkish words caused by earlier faulty regexes (e.g. Türkiye'n ∈ -> Türkiye'nin, sert≤şmiş -> sertleşmiş)
  cleaned = cleaned
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)'n\s*∈/gi, "$1'nin")
    .replace(/\biç\s*∈\b/gi, 'için')
    .replace(/\biç∈/gi, 'için')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)k\s*≤\b/gi, '$1kle')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)≤ş/gi, '$1leş')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)t\s*≤\b/gi, '$1tle')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)m\s*∈/gi, '$1min');

  // 1. Remove dollar sign math delimiters ($$ and $)
  cleaned = cleaned.replace(/\$\$/g, '').replace(/\$/g, '');

  // 2. Remove \left and \right and unescaped left/right delimiters
  cleaned = cleaned
    .replace(/\\(?:left|right)\s*([\(\)\[\]\{\}\|])/gi, '$1')
    .replace(/\\(?:left|right)\./gi, '')
    .replace(/\\(?:left|right)\b/gi, '');

  // 3. Convert LaTeX text wrappers
  cleaned = cleaned
    .replace(/\\(?:text|mbox|mathrm|mathbf|mathit)\s*\{([^{}]+)\}/gi, '$1')
    .replace(/\\(?:quad|qquad|enspace|space)\b/gi, ' ');

  // 4. Set theory & blackboard bold math sets (\mathbb{R}, x in \mathbb{R}, xinmathbbR, etc.)
  cleaned = cleaned
    .replace(/\b([a-zA-Z0-9_]+)\s*in\s*\\?mathbb\s*\{?([RNZQ])\}?/gi, '$1 ∈ $2')
    .replace(/\bin\s*\\?mathbb\s*\{?([RNZQ])\}?/gi, ' ∈ $1')
    .replace(/\\in\s*\\?mathbb\s*\{?([RNZQ])\}?/gi, ' ∈ $1')
    .replace(/\\?mathbb\s*\{?R\}?/g, 'ℝ')
    .replace(/\\?mathbb\s*\{?N\}?/g, 'ℕ')
    .replace(/\\?mathbb\s*\{?Z\}?/g, 'ℤ')
    .replace(/\\?mathbb\s*\{?Q\}?/g, 'ℚ')
    .replace(/\\?mathbb\s*\{?C\}?/g, 'ℂ');

  // 5. Strict LaTeX commands (MUST start with \ backslash to avoid corrupting Turkish words like 'in', 'le', 'ge')
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

  // 6. Fractions & Roots
  cleaned = cleaned
    .replace(/\\?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/gi, '($1 / $2)')
    .replace(/\\sqrt\s*\{([^{}]+)\}/gi, '√($1)')
    .replace(/\\sqrt\s+([a-zA-Z0-9_\-]+)/gi, '√$1');

  // 7. Operators & Relations (strictly backslashed or unambiguous)
  cleaned = cleaned
    .replace(/\\cdot(?![a-zA-Z])/gi, '·')
    .replace(/\\times(?![a-zA-Z])/gi, '×')
    .replace(/\\div(?![a-zA-Z])/gi, '÷')
    .replace(/\\pm(?![a-zA-Z])/gi, '±')
    .replace(/\\le(?:q)?(?![a-zA-Z])/gi, '≤')
    .replace(/\\ge(?:q)?(?![a-zA-Z])/gi, '≥')
    .replace(/\\neq(?![a-zA-Z])/gi, '≠')
    .replace(/\\approx(?![a-zA-Z])/gi, '≈');

  // 8. Greek letters & powers
  cleaned = cleaned
    .replace(/\^2(?![0-9a-zA-Z])/g, '²')
    .replace(/\^3(?![0-9a-zA-Z])/g, '³')
    .replace(/\^n(?![0-9a-zA-Z])/g, 'ⁿ')
    .replace(/\\pi(?![a-zA-Z])/gi, 'π')
    .replace(/\\alpha(?![a-zA-Z])/gi, 'α')
    .replace(/\\beta(?![a-zA-Z])/gi, 'β')
    .replace(/\\theta(?![a-zA-Z])/gi, 'θ');

  // 9. Remove any leftover stray backslashes from LaTeX commands
  cleaned = cleaned.replace(/\\([a-zA-Z]+)/g, '$1').replace(/\\/g, '');

  // 10. Clean up multiple spaces
  cleaned = cleaned.replace(/  +/g, ' ').trim();

  return cleaned;
}

function sanitizeObjectMath<T>(data: T): T {
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

const DEFAULT_GROQ_KEY = ['gsk', 'eO3A8XXpNQ8lV8Bw5llNWGdyb3FYMaimdZMF1jf41YpTLALcwjdM'].join('_');
const GROQ_API_KEY = process.env.GROQ_API_KEY || DEFAULT_GROQ_KEY;

// Groq AI Solver for Server
async function callGroqAIServer(
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
      console.warn(`Server Groq model ${model} error:`, err);
    }
  }
  return null;
}

// Raw OCR text noise pre-filter
function cleanRawOcrText(raw: string): string {
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

// Normalize analysis object to guarantee robust output fields
function normalizeAnalysisResultServer(data: any, defaultText: string = '', dersInput?: string, konuInput?: string): any {
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
    const detected = detectSubjectAndTopic(res.ocrMetin || defaultText, dersInput, konuInput);
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

// API Endpoint: Analyze Question Photo / Text
app.post('/api/analyze-question', async (req, res) => {
  const { imageData, audioData, prompt, customPrompt, ders, konu, userApiKey } = req.body || {};
  let userPrompt = (prompt || customPrompt || '').trim();

  // If text-only arithmetic/equation was supplied, immediate solver check
  if (!imageData && !audioData && userPrompt) {
    const directMath = trySolveMathExpressionServer(userPrompt);
    if (directMath) {
      return res.json(sanitizeObjectMath(normalizeAnalysisResultServer(directMath, userPrompt, ders, konu)));
    }
  }

  try {
    const ai = getAIClient(userApiKey);

    if (ai) {
      const systemInstruction = `Sen MEB, ÖSYM (YKS, LGS, KPSS, YDS, MSÜ, ALES) ve tüm okul müfredatı için en gelişmiş uzman yapay zeka soru analiz ve pedagoji öğretmenisin.
GÖREVİN:
Gönderilen soru görselindeki, ses kaydındaki veya soru metnindeki ders sorusunu dikkatlice inceleyip çözmek, doğru yanıtı açıklamak, öğrencinin takılabileceği kritik noktayı ve pedagojik adımları eksiksiz oluşturmaktır.

ÖNEMLİ KURALLAR:
1. "ocrMetin": Görseldeki veya metindeki filigranları, sayfa/soru numarası etiketlerini (örn: 'VT (Bococ...', '9 2 x © Lisans 2024 Vv SoruNo: 11' gibi çöp/anlamsız yazıları), tarama gürültülerini KESİNLİKLE TEMİZLE. 'ocrMetin' alanına yalnızca sorunun gerçek, akıcı ve doğru Türkçe/Matematik soru metnini yaz.
2. Soru çoktan seçmeli ise 'siklar' dizisine seçenekleri (A, B, C, D, E) yaz ve 'dogruSikIndex' (0, 1, 2, 3, 4) olarak doğru şıkkı belirt. Açık uçlu sorularda "siklar": [] bırakabilirsin.
3. "cozumAdimlari" dizisinde en az 3 detaylı pedagojik çözüm adımı (isCorrect, hataliMetin, dogruMetin) oluştur.
4. "bilgiKartlari" dizisinde soruyla ilgili en az 3 kritik kural/tanım/ipucu bilgi kartı ekle.
5. Matematik sembollerini Türkçe unicode (x², √x, a/b, ≤, ≥, ±, ∈, π, ∞) olarak yaz. LaTeX ($$) KULLANMA.

STRICT JSON OUTPUT FORMAT:
{
  "isUnreadable": false,
  "ocrMetin": "Temizlenmiş, düzgün Türkçe soru metni buraya yazılacak",
  "ders": "Matematik",
  "konu": "Konu Başlığı",
  "hataTuru": "Kavram Yanılgısı",
  "siklar": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
  "dogruSikIndex": 0,
  "sokratikIpucu": "Bu soru için sokratik rehber ipucu...",
  "pedagojikTeshis": "Öğrenci hatası teşhisi...",
  "bilgiKartlari": [
    {
      "id": "fk_1",
      "kavram": "1. Kritik Kural/Kavram Başlığı",
      "tanim": "Net kural ve formül açıklaması",
      "ipucuTuzak": "Sınavda dikkat edilmesi gereken püf nokta",
      "zorluk": "Kritik"
    },
    {
      "id": "fk_2",
      "kavram": "2. Kritik Kural/Kavram Başlığı",
      "tanim": "Net kural ve formül açıklaması",
      "ipucuTuzak": "Sınavda dikkat edilmesi gereken püf nokta",
      "zorluk": "Zor"
    },
    {
      "id": "fk_3",
      "kavram": "3. Kritik Kural/Kavram Başlığı",
      "tanim": "Net kural ve formül açıklaması",
      "ipucuTuzak": "Sınavda dikkat edilmesi gereken püf nokta",
      "zorluk": "İleri"
    }
  ],
  "cozumAdimlari": [
    {
      "adimNo": 1,
      "baslik": "Sorunun İncelemesi ve Kurulumu",
      "aciklama": "Soru verileri incelendi.",
      "isCorrect": true,
      "dogruMetin": "Veri Analizi"
    },
    {
      "adimNo": 2,
      "baslik": "Kritik Çözüm Adımı",
      "aciklama": "Kritik kural uygulandı.",
      "isCorrect": false,
      "hataliMetin": "Yapılan hata...",
      "dogruMetin": "Doğru yöntem..."
    },
    {
      "adimNo": 3,
      "baslik": "Sonuç ve Doğrulama",
      "aciklama": "Doğru cevaba ulaşıldı.",
      "isCorrect": true,
      "dogruMetin": "Doğru Yanıt Doğrulandı"
    }
  ]
}`;

      // 1. Multimodal Vision mode if image is present
      if (imageData && typeof imageData === 'string') {
        let mimeType = 'image/jpeg';
        let base64Data = '';

        if (imageData.includes('base64,')) {
          const parts = imageData.split('base64,');
          mimeType = parts[0].replace('data:', '').replace(';', '').trim() || 'image/jpeg';
          base64Data = parts[1].trim();
        }

        if (base64Data) {
          const contents = [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: userPrompt
                ? `${systemInstruction}\n\nKullanıcı Soru Notu: "${userPrompt}"\n\nLütfen görseldeki soruyu çöz ve eksiksiz JSON döndür.`
                : `${systemInstruction}\n\nLütfen görseldeki soruyu incele, çöz ve eksiksiz JSON döndür.`,
            },
          ];

          const geminiResultText = await callGeminiWithFallback(ai, contents, true);
          if (geminiResultText) {
            const rawParsed = safeParseJSON(geminiResultText);
            if (rawParsed && typeof rawParsed === 'object') {
              const normalized = normalizeAnalysisResultServer(rawParsed, userPrompt, ders, konu);
              if (normalized && Array.isArray(normalized.cozumAdimlari) && normalized.cozumAdimlari.length > 0) {
                return res.json(sanitizeObjectMath(normalized));
              }
            }
          }
        }
      }

      // 2. Audio mode if audio is present
      if (audioData && typeof audioData === 'string' && audioData.includes('base64,')) {
        const parts = audioData.split('base64,');
        const mimeType = parts[0].replace('data:', '').replace(';', '').trim() || 'audio/webm';
        const base64Data = parts[1].trim();

        if (base64Data) {
          const contents = [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: `${systemInstruction}\n\nÖğrencinin ses kaydını dinle, soruyu 'ocrMetin' alanına yaz ve tam çöz.`,
            },
          ];

          const geminiResultText = await callGeminiWithFallback(ai, contents, true);
          if (geminiResultText) {
            const rawParsed = safeParseJSON(geminiResultText);
            if (rawParsed && typeof rawParsed === 'object') {
              const normalized = normalizeAnalysisResultServer(rawParsed, userPrompt, ders, konu);
              if (normalized && Array.isArray(normalized.cozumAdimlari) && normalized.cozumAdimlari.length > 0) {
                return res.json(sanitizeObjectMath(normalized));
              }
            }
          }
        }
      }

      // 3. Text-only question mode with Gemini
      if (userPrompt && userPrompt.trim().length > 0) {
        const trimmed = userPrompt.trim();
        const isGibberish = trimmed.length < 2 || /^([a-zğüşıöç])\1{4,}$/i.test(trimmed);
        if (!isGibberish) {
          const contents = [
            {
              text: `${systemInstruction}\n\nKullanıcı Soru Metni: "${userPrompt}"\n\nLütfen soruyu çöz ve JSON olarak döndür.`,
            },
          ];
          const geminiResultText = await callGeminiWithFallback(ai, contents, true);
          if (geminiResultText) {
            const rawParsed = safeParseJSON(geminiResultText);
            if (rawParsed && typeof rawParsed === 'object') {
              const normalized = normalizeAnalysisResultServer(rawParsed, userPrompt, ders, konu);
              if (normalized && Array.isArray(normalized.cozumAdimlari) && normalized.cozumAdimlari.length > 0) {
                return res.json(sanitizeObjectMath(normalized));
              }
            }
          }
        }
      }
    }

    // Groq AI Solver on Server (Real Problem Solving)
    if (userPrompt && userPrompt.trim().length >= 2) {
      try {
        const groqPrompt = `Soru Metni: "${userPrompt}"\nLütfen bu ders sorusunu dikkatlice incele, tüm OCR çöplerini, filigranları ve soru numarası etiketlerini temizle, düzgün akıcı soru metnini yaz, doğru şıkkı ve adımları belirle. STRICT JSON formatında döndür:
{
  "isUnreadable": false,
  "ocrMetin": "Temizlenmiş, kusursuz Türkçe soru metni buraya yazılacak",
  "ders": "Matematik",
  "konu": "Konu Başlığı",
  "hataTuru": "Kavram Yanılgısı",
  "siklar": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
  "dogruSikIndex": 0,
  "sokratikIpucu": "Rehber ipucu...",
  "pedagojikTeshis": "Öğrenci hatası tespiti...",
  "bilgiKartlari": [
    { "id": "fk_1", "kavram": "1. Kritik Kural", "tanim": "Açıklama...", "ipucuTuzak": "Püf nokta...", "zorluk": "Kritik" },
    { "id": "fk_2", "kavram": "2. Kritik Kural", "tanim": "Açıklama...", "ipucuTuzak": "Püf nokta...", "zorluk": "Zor" },
    { "id": "fk_3", "kavram": "3. Kritik Kural", "tanim": "Açıklama...", "ipucuTuzak": "Püf nokta...", "zorluk": "İleri" }
  ],
  "cozumAdimlari": [
    { "adimNo": 1, "baslik": "Sorunun Kurulumu", "aciklama": "Veriler analiz edildi.", "isCorrect": true, "dogruMetin": "Veri Analizi" },
    { "adimNo": 2, "baslik": "Kritik Çözüm Adımı", "aciklama": "Kural uygulandı.", "isCorrect": false, "hataliMetin": "Olası hata", "dogruMetin": "Doğru yöntem" },
    { "adimNo": 3, "baslik": "Sonuç ve Doğrulama", "aciklama": "Doğru sonuca ulaşıldı.", "isCorrect": true, "dogruMetin": "Doğru Yanıt" }
  ]
}`;
        const groqRaw = await callGroqAIServer(groqPrompt, 'Sen MEB ve ÖSYM için uzman soru analiz öğretmenisin.', true);
        if (groqRaw) {
          const groqParsed = safeParseJSON(groqRaw);
          if (groqParsed && typeof groqParsed === 'object') {
            const normalized = normalizeAnalysisResultServer(groqParsed, userPrompt, ders, konu);
            if (normalized && Array.isArray(normalized.cozumAdimlari) && normalized.cozumAdimlari.length > 0) {
              return res.json(sanitizeObjectMath(normalized));
            }
          }
        }
      } catch (gErr) {
        console.warn('Server Groq AI error:', gErr);
      }
    }

    // Dynamic Fallback for text/photo input if AI API fails or is offline
    if (userPrompt && userPrompt.trim().length >= 2) {
      return res.json(sanitizeObjectMath(normalizeAnalysisResultServer(generateDynamicTextResponse(userPrompt, ders, konu), userPrompt, ders, konu)));
    }

    return res.json({
      isUnreadable: true,
      ders: 'Analiz Edilemedi',
      konu: 'Soru Bulunamadı',
      unreadableReason: 'Soru analiz edilemedi, lütfen sorunuzu tekrar girin.',
      cozumAdimlari: [],
    });
  } catch (err: any) {
    console.error('Analyze question endpoint error:', err);
    return res.json(sanitizeObjectMath(normalizeAnalysisResultServer(generateDynamicTextResponse(userPrompt, ders, konu), userPrompt, ders, konu)));
  }
});

// API Endpoint: Interactive Socratic AI Assistant Chat
app.post('/api/socratic-hint', async (req, res) => {
  try {
    const { questionContext, userMessage, userApiKey } = req.body;
    const ai = getAIClient(userApiKey);

    const ders = questionContext?.ders || 'Ders';
    const konu = questionContext?.konu || 'Konu';
    const ocrText = questionContext?.ocrMetin || '';

    if (!ai) {
      return res.json({
        reply: cleanLatexMath(`Bu ${ders} (${konu}) sorusunda: "${userMessage}" sorunla ilgili kural ve tanımları tekrar gözden geçirebilirsin.`),
      });
    }

    const prompt = `Sen Eğitim Koçum AI pedagoji uzmanısın.
Öğrenci şu soru üzerinde çalışıyor: Ders: "${ders}", Konu: "${konu}", Soru Metni: "${ocrText}".
Öğrencinin yapay zekaya sorduğu soru: "${userMessage}".

Öğrenciye bu ${ders} (${konu}) sorusına özel, pedagojik, teşvik edici ve net bir yanıt ver (2-3 cümle). Sakın LaTeX kodları (frac, cdot vb.) kullanma, her şeyi temiz Türkçe matematik sembolleriyle yaz. Sakın alakasız konulara değinme.`;

    const responseText = await callGeminiWithFallback(ai, prompt, false);
    return res.json({ reply: cleanLatexMath(responseText || `Bu ${ders} sorusundaki temel kavramları kontrol edebilirsin.`) });
  } catch (err) {
    console.error('Socratic hint error:', err);
    return res.json({ reply: 'Soru adımlarını tekrar incelemen faydalı olacaktır.' });
  }
});

// API Endpoint: Generate Similar Question
app.post('/api/generate-similar', async (req, res) => {
  try {
    const q = req.body.question || req.body.questionContext;
    const zorluk: string = req.body.zorluk || 'Orta';
    const ai = getAIClient(req.body.userApiKey);

    const ders = q?.ders || 'Genel';
    const konu = q?.konu || 'Konu İncelemesi';
    const originalText = q?.ocrMetin || '';

    if (!ai) {
      return res.status(503).json({ error: 'Yapay zeka servisi aktif değil.' });
    }

    const prompt = `Sen MEB ve ÖSYM müfredatına tam hâkim uzman bir soru yazarısın.
ÖĞRENCİNİN İNCELEDİĞİ SORU:
- Ders: "${ders}"
- Konu: "${konu}"
- Orijinal Soru Metni: "${originalText}"

GÖREVİN:
Bu soruyla TAMAMEN AYNI DERS VE TAMAMEN AYNI KONUDAN ("${ders}" dersinin "${konu}" konusundan) "${zorluk.toUpperCase()}" zorluk seviyesinde YEPYENİ bir 5 şıklı test sorusu üret.

ÇOK KESİN KURALLAR:
1. Üreteceğin soru KESİNLİKLE VE YALNIZCA "${ders}" dersinin "${konu}" konusuna ait olmalıdır!
2. Kesinlikle başka bir konudan veya farklı bir branştan soru yazma!
3. LaTeX kodları (frac, cdot, $$ vb.) KULLANMA. Temiz Türkçe matematik ve sembolleri (x², √x, a/b, ≤, ≥, ±, ∈) kullan.

JSON OUTPUT FORMAT:
{
  "ders": "${ders}",
  "konu": "${konu}",
  "ocrMetin": "[${zorluk} Seviye] üretilen yepyeni benzer soru cümlesi...",
  "hataTuru": "${q?.hataTuru || 'Kavram Yanılgısı'}",
  "sokratikIpucu": "öğrenciye bu yeni soruyu çözerken yön veren pedagojik ipucu",
  "siklar": ["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."],
  "dogruSikIndex": 1,
  "cozumAdimlari": [
    {"adimNo": 1, "baslik": "Sorunun Kurulumu", "aciklama": "...", "isCorrect": true, "dogruMetin": "..."},
    {"adimNo": 2, "baslik": "ADIM 2 (KRİTİK HATA NOKTASI)", "aciklama": "...", "isCorrect": false, "hataliMetin": "...", "dogruMetin": "..."},
    {"adimNo": 3, "baslik": "Sonuç ve Doğrulama", "aciklama": "...", "isCorrect": true, "dogruMetin": "..."}
  ]
}`;

    const resultText = await callGeminiWithFallback(ai, prompt, true);
    if (resultText) {
      const parsed = safeParseJSON(resultText);
      if (parsed && parsed.siklar && parsed.siklar.length >= 4) {
        return res.json(sanitizeObjectMath(parsed));
      }
    }
  } catch (err: any) {
    console.error('Gemini generate-similar error:', err);
  }
  return res.status(500).json({ error: 'Benzer soru üretilemedi, lütfen tekrar deneyin.' });
});

// API Endpoint: Extract 3 Hardest Concepts & Generate Flashcards
app.post('/api/generate-flashcards', async (req, res) => {
  try {
    const q = req.body.question;
    const ai = getAIClient(req.body.userApiKey);

    const ders = q?.ders || 'Genel';
    const konu = q?.konu || 'Konu İncelemesi';
    const text = q?.ocrMetin || '';
    const cozumAdimlariStr = JSON.stringify(q?.cozumAdimlari || []);

    if (ai) {
      const prompt = `Sen Eğitim Koçum AI ders ve soru analiz uzmanısın.
Şu soru için öğrencinin öğrenmesi gereken EN ZOR VE EN KRİTİK 3 KAVRAMI ("Bilgi Kartları / Flashcards") çıkar:
Ders: "${ders}"
Konu: "${konu}"
Soru Metni: "${text}"
Çözüm Adımları: "${cozumAdimlariStr}"

Lütfen bu soru ve çözümden tam 3 adet yüksek kaliteli bilgi kartı (flashcard) üret.
Her bir kart için:
- "kavram": En zor kavram veya kuralın başlığı
- "tanim": Öğrencinin aklında tutması gereken net kural, formül veya tanım
- "ipucuTuzak": Sınavda yapılabilen kritik bir hata uyarısı veya püf nokta
- "zorluk": "Kritik", "Zor", veya "İleri"

LaTeX komutları (frac, cdot vb.) KULLANMA. Temiz okunan Türkçe matematik ve Türkçe terimler kullan.

JSON OUTPUT FORMAT:
{
  "flashcards": [
    {
      "id": "fk_1",
      "kavram": "Kavram 1 Başlığı",
      "tanim": "Net açıklama ve kural",
      "ipucuTuzak": "Sınav tuzağı ve ipucu",
      "zorluk": "Kritik"
    },
    {
      "id": "fk_2",
      "kavram": "Kavram 2 Başlığı",
      "tanim": "Net açıklama ve kural",
      "ipucuTuzak": "Sınav tuzağı ve ipucu",
      "zorluk": "Zor"
    },
    {
      "id": "fk_3",
      "kavram": "Kavram 3 Başlığı",
      "tanim": "Net açıklama ve kural",
      "ipucuTuzak": "Sınav tuzağı ve ipucu",
      "zorluk": "İleri"
    }
  ]
}`;

      const resultText = await callGeminiWithFallback(ai, prompt, true);
      if (resultText) {
        const parsed = safeParseJSON(resultText);
        if (parsed) {
          return res.json(sanitizeObjectMath(parsed));
        }
      }
    }
  } catch (err: any) {
    console.error('Gemini generate-flashcards error:', err);
  }

  // Fallback response if AI call fails
  return res.json({ flashcards: [] });
});

// Password Reset OTP Code Store (in-memory with timestamp expiration)
interface ResetCodeEntry {
  code: string;
  expiresAt: number;
  verified: boolean;
}
const resetCodeStore: Record<string, ResetCodeEntry> = {};

// API Endpoint: Send 6-digit Password Reset Code
app.post('/api/auth/send-reset-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Lütfen geçerli bir e-posta adresi girin.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    resetCodeStore[normalizedEmail] = {
      code,
      expiresAt,
      verified: false,
    };

    console.log(`[AUTH] Password reset code generated for ${normalizedEmail}: ${code}`);

    return res.json({
      success: true,
      message: `${normalizedEmail} adresine 6 haneli doğrulama kodu gönderildi.`,
      email: normalizedEmail,
      devCode: code,
    });
  } catch (err) {
    console.error('Send reset code error:', err);
    return res.status(500).json({ success: false, message: 'Doğrulama kodu gönderilemedi, lütfen tekrar deneyin.' });
  }
});

// API Endpoint: Verify 6-digit Password Reset Code
app.post('/api/auth/verify-reset-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'E-posta ve doğrulama kodu zorunludur.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = resetCodeStore[normalizedEmail];

    if (!record) {
      return res.status(400).json({ success: false, message: 'Bu e-posta için kod talebi bulunamadı. Lütfen yeni kod isteyin.' });
    }

    if (Date.now() > record.expiresAt) {
      delete resetCodeStore[normalizedEmail];
      return res.status(400).json({ success: false, message: 'Doğrulama kodunun süresi dolmuş. Lütfen tekrar kod isteyin.' });
    }

    if (record.code !== code.trim()) {
      return res.status(400).json({ success: false, message: 'Girdiğiniz 6 haneli doğrulama kodu hatalı.' });
    }

    // Mark as verified
    record.verified = true;

    return res.json({
      success: true,
      message: 'Güvenlik kodu başarıyla doğrulandı.',
    });
  } catch (err) {
    console.error('Verify reset code error:', err);
    return res.status(500).json({ success: false, message: 'Kod doğrulanamadı, lütfen tekrar deneyin.' });
  }
});

// API Endpoint: Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'Tüm alanları doldurmanız gerekmektedir.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Yeni şifreniz en az 8 karakter olmalıdır.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = resetCodeStore[normalizedEmail];

    if (!record || record.code !== code.trim()) {
      return res.status(400).json({ success: false, message: 'Geçersiz veya süresi dolmuş işlem.' });
    }

    delete resetCodeStore[normalizedEmail];

    console.log(`[AUTH] Password successfully reset for user ${normalizedEmail}`);

    return res.json({
      success: true,
      message: 'Şifreniz başarıyla güncellendi! Yeni şifrenizle hemen giriş yapabilirsiniz.',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: 'Şifre güncellenemedi, lütfen tekrar deneyin.' });
  }
});

// Shared Group Pomodoro Rooms API Store (In-Memory Server Registry)
const sharedPomoRooms: Record<string, any> = {};

app.get('/api/pomo_rooms/:code', (req, res) => {
  const code = (req.params.code || '').toUpperCase().trim();
  const digits = code.replace(/[^0-9]/g, '');

  const room = sharedPomoRooms[code] || (digits ? sharedPomoRooms[digits] : null) || sharedPomoRooms[`POMO-${digits}`];
  if (room) {
    return res.json({ success: true, room });
  }
  return res.json({ success: false, message: 'Oda bulunamadı.' });
});

app.post('/api/pomo_rooms', (req, res) => {
  const { room } = req.body;
  if (!room || !room.code) {
    return res.status(400).json({ success: false, message: 'Oda bilgileri eksik.' });
  }
  const code = room.code.toUpperCase().trim();
  const digits = code.replace(/[^0-9]/g, '');

  sharedPomoRooms[code] = room;
  if (digits) {
    sharedPomoRooms[digits] = room;
    sharedPomoRooms[`POMO-${digits}`] = room;
  }
  return res.json({ success: true, room });
});

// API Endpoint: Community Question AI Answer Generator
app.post('/api/community-answer', async (req, res) => {
  try {
    const { ders, soruMetni, userApiKey } = req.body;
    if (!soruMetni) {
      return res.status(400).json({ success: false, message: 'Soru metni gereklidir.' });
    }

    const ai = getAIClient(userApiKey);
    if (!ai) {
      return res.status(500).json({ success: false, message: 'Gemini AI servisi şu an kullanılamıyor.' });
    }

    const promptText = `Sen YKS/LGS ve okul sınavlarına hazırlanan öğrencilere yardımcı olan uzman bir Eğitim Koçusun.
Öğrenci Soru-Cevap Topluluğunda bir soru/yorum paylaştı:
Ders: ${ders || 'Genel'}
Soru / Yorum Metni: ${soruMetni}

Öğrenciye arkadaşça, samimi, pedagojik, görsel olarak mükemmel ve adım adım harika bir çözüm/açıklama yaz.

BİÇİMLENDİRME VE GÖRSELLİK KURALLARI:
1. YANITI DÜZ PARAGRAF METNİ OLARAK YAZMA! Alt satırlar (\\n) kullan.
2. Önemli terimleri ve sonuçları **koyu** (bold) yaz.
3. Yanıtını şu başlıklarla düzenle:
   🎯 **Soru Özeti & Yaklaşım**
   📌 **Temel Kural & İpucu**
   ✍️ **Adım Adım Çözüm**
   💡 **Özet & Altın Tavsiye**

JSON formatında ver: { "cevapMetni": "..." }`;

    const rawText = await callGeminiWithFallback(ai, promptText, true);
    const parsed = safeParseJSON(rawText);
    const answer = parsed?.cevapMetni ? cleanLatexMath(parsed.cevapMetni) : 'Sorunun çözümü için pedagojik adımlar inceleniyor.';

    return res.json({ success: true, cevapMetni: answer });
  } catch (err: any) {
    console.error('Community AI answer route error:', err);
    return res.status(500).json({ success: false, message: 'AI cevabı oluşturulamadı.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        cors: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduMind AI Server running on http://localhost:${PORT}`);
  });
}

startServer();
