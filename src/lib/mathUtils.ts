/**
 * Helper utility to normalize raw LaTeX math strings (e.g. frac{a}{b} -> (a / b), \left(, \right), $, $$, xinmathbbR -> x ∈ ℝ, etc.)
 * so react-katex InlineMath / BlockMath and plain text typography render them cleanly without LaTeX artifacts.
 */
export function normalizeLatexMath(str: string | undefined | null): string {
  if (!str) return '';
  let text = String(str);

  // 0. Repair corrupted Turkish words caused by earlier faulty regexes (e.g. Türkiye'n ∈ -> Türkiye'nin, sert≤şmiş -> sertleşmiş)
  text = text
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)'n\s*∈/gi, "$1'nin")
    .replace(/\biç\s*∈\b/gi, 'için')
    .replace(/\biç∈/gi, 'için')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)k\s*≤\b/gi, '$1kle')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)≤ş/gi, '$1leş')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)t\s*≤\b/gi, '$1tle')
    .replace(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)m\s*∈/gi, '$1min');

  // 1. Remove dollar sign math delimiters ($$ and $)
  text = text.replace(/\$\$/g, '').replace(/\$/g, '');

  // 2. Remove \left and \right and unescaped left/right delimiters
  text = text
    .replace(/\\(?:left|right)\s*([\(\)\[\]\{\}\|])/gi, '$1')
    .replace(/\\(?:left|right)\./gi, '')
    .replace(/\\(?:left|right)\b/gi, '');

  // 3. Convert LaTeX text wrappers
  text = text
    .replace(/\\(?:text|mbox|mathrm|mathbf|mathit)\s*\{([^{}]+)\}/gi, '$1')
    .replace(/\\(?:quad|qquad|enspace|space)\b/gi, ' ');

  // 4. Set theory & blackboard bold math sets (\mathbb{R}, x in \mathbb{R}, xinmathbbR, etc.)
  text = text
    .replace(/\b([a-zA-Z0-9_]+)\s*in\s*\\?mathbb\s*\{?([RNZQ])\}?/gi, '$1 ∈ $2')
    .replace(/\bin\s*\\?mathbb\s*\{?([RNZQ])\}?/gi, ' ∈ $1')
    .replace(/\\in\s*\\?mathbb\s*\{?([RNZQ])\}?/gi, ' ∈ $1')
    .replace(/\\?mathbb\s*\{?R\}?/g, 'ℝ')
    .replace(/\\?mathbb\s*\{?N\}?/g, 'ℕ')
    .replace(/\\?mathbb\s*\{?Z\}?/g, 'ℤ')
    .replace(/\\?mathbb\s*\{?Q\}?/g, 'ℚ')
    .replace(/\\?mathbb\s*\{?C\}?/g, 'ℂ');

  // 5. Strict LaTeX commands (MUST start with \ backslash to avoid corrupting Turkish words like 'in', 'le', 'ge')
  text = text
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
  text = text
    .replace(/\\?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/gi, '($1 / $2)')
    .replace(/\\sqrt\s*\{([^{}]+)\}/gi, '√($1)')
    .replace(/\\sqrt\s+([a-zA-Z0-9_\-]+)/gi, '√$1');

  // 7. Operators & Relations (strictly backslashed or unambiguous)
  text = text
    .replace(/\\cdot(?![a-zA-Z])/gi, '·')
    .replace(/\\times(?![a-zA-Z])/gi, '×')
    .replace(/\\div(?![a-zA-Z])/gi, '÷')
    .replace(/\\pm(?![a-zA-Z])/gi, '±')
    .replace(/\\le(?:q)?(?![a-zA-Z])/gi, '≤')
    .replace(/\\ge(?:q)?(?![a-zA-Z])/gi, '≥')
    .replace(/\\neq(?![a-zA-Z])/gi, '≠')
    .replace(/\\approx(?![a-zA-Z])/gi, '≈');

  // 8. Greek letters & powers
  text = text
    .replace(/\^2(?![0-9a-zA-Z])/g, '²')
    .replace(/\^3(?![0-9a-zA-Z])/g, '³')
    .replace(/\^n(?![0-9a-zA-Z])/g, 'ⁿ')
    .replace(/\\pi(?![a-zA-Z])/gi, 'π')
    .replace(/\\alpha(?![a-zA-Z])/gi, 'α')
    .replace(/\\beta(?![a-zA-Z])/gi, 'β')
    .replace(/\\theta(?![a-zA-Z])/gi, 'θ');

  // 9. Remove any leftover stray backslashes from LaTeX commands
  text = text.replace(/\\([a-zA-Z]+)/g, '$1').replace(/\\/g, '');

  // 10. Clean up multiple spaces
  text = text.replace(/  +/g, ' ').trim();

  return text;
}

export function cleanQuestionPrefix(str: string | undefined | null): string {
  if (!str) return '';
  let cleaned = String(str).trim();

  // If the string starts with math operators or equations (e.g. 125 / 5, 450 / 9, 3x + 5 = 10), do not strip
  if (/^\d+\s*[\+\-\*\/\^=÷·×]/.test(cleaned) || /^\d+\s*[a-zA-Z]/.test(cleaned)) {
    return cleaned;
  }

  // Only strip genuine test question prefixes like "Soru 3:", "Soru 5 -", "3. ", "12) "
  cleaned = cleaned.replace(/^(?:Soru\s*\d+\s*[:\.\)\-]?\s+|\d{1,3}[\.\)\-]\s+)/gi, '').trim();

  return cleaned;
}

export function cleanLatexMath(str: string | undefined | null): string {
  return normalizeLatexMath(str);
}

export function sanitizeObjectMath<T>(data: T): T {
  if (!data) return data;
  if (typeof data === 'string') {
    return normalizeLatexMath(data) as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeObjectMath(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const res: any = {};
    for (const key of Object.keys(data as object)) {
      if (['gorselUrl', 'sesliNot', 'avatar', 'avatarUrl', 'id', 'ebbinghausTarihi', 'olusturmaTarihi'].includes(key)) {
        res[key] = (data as any)[key];
      } else if (key === 'ocrMetin') {
        res[key] = cleanQuestionPrefix(normalizeLatexMath((data as any)[key]));
      } else {
        res[key] = sanitizeObjectMath((data as any)[key]);
      }
    }
    return res as T;
  }
  return data;
}

/**
 * Intelligent Math Expression & Arithmetic Solver
 * Detects direct calculations (125 / 5, 450 / 9, 25 * 4, 3x + 6 = 18, etc.) and produces
 * step-by-step pedagogical solutions with the EXACT numbers and results.
 */
export function trySolveMathExpression(input: string): any | null {
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
      if (n2 === 0) {
        return null; // Division by zero
      }
      result = n1 / n2;
      const isInteger = Number.isInteger(result);
      const displayRes = isInteger ? result : parseFloat(result.toFixed(4));

      step2Explain = `${n1} sayısı ${n2}'ye bölünürken basamak basamak inceleme yapılır.`;
      step2Error = `Bölme işleminde basamak kaydırma veya kalan terimi yanlış hesaplama hatası`;
      step2Correct = `${n1} ÷ ${n2} = ${displayRes}`;
      step3Explain = `Bölme işleminin doğrulaması: ${displayRes} × ${n2} = ${n1}.`;

      return {
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
