import { SoruKaydi, BilgiKarti } from '../types';
import { generateFlashcardsService } from './geminiClient';

/**
 * Generates 3 hard key concept flashcards dynamically based on question fields.
 */
export function generateFallbackFlashcards(q: SoruKaydi): BilgiKarti[] {
  const ders = q.ders || 'Genel Ders';
  const konu = q.konu || 'Temel Kavram';
  const text = (q.ocrMetin || '').toLowerCase();
  const teshis = q.pedagojikTeshis || q.sokratikIpucu || '';

  // 1. Geometry / Trigonometry
  if (ders === 'Geometri' || konu.includes('Üçgen') || konu.includes('Açı') || konu.includes('Çember') || konu.includes('Geometri') || text.includes('üçgen') || text.includes('derece')) {
    return [
      {
        id: `fk_${q.id}_1`,
        kavram: `${konu} - Temel Geometrik Bağıntı`,
        tanim: `${konu} sorularında açı, kenar bağıntıları ve temel geometrik kurallar adım adım uygulanarak bilinmeyen uzunluk veya açı hesaplanır.`,
        ipucuTuzak: '⚠️ Şekilde verilen diklik, paralellik ve açıortay gibi gizli öncülleri şekil üzerine mutlaka işaretle!',
        zorluk: 'Kritik',
      },
      {
        id: `fk_${q.id}_2`,
        kavram: 'Yardımcı Çizgi ve Benzerlik Kuralı',
        tanim: 'Çözüme ulaşılamadığında tepe noktasından dik indirme veya paralel çizgi çekerek özel üçgen / benzerlik oluşturulur.',
        ipucuTuzak: '⚠️ Benzerlik oranının karesinin alanlar oranına eşit olduğunu unutma!',
        zorluk: 'Zor',
      },
      {
        id: `fk_${q.id}_3`,
        kavram: 'Özel Bağıntılar ve Doğrulama',
        tanim: 'Pisagor, Öklid veya trigonometrik oranlar kullanılarak bulunan sonucun şeklin mantığıyla uyumu kontrol edilir.',
        ipucuTuzak: '⚠️ Hipotenüsün daima en uzun kenar olması gerektiğini göz önünde bulundur.',
        zorluk: 'İleri',
      },
    ];
  }

  // 2. Mathematics (Functions, Trigonometry, Derivatives, Probability, Polynomials, Equations, Numbers)
  if (ders === 'Matematik') {
    return [
      {
        id: `fk_${q.id}_1`,
        kavram: `${konu} - Temel Kural & Tanım`,
        tanim: teshis || `${konu} konusundaki temel formül ve bağıntılar eksiksiz uygulanmalı, değişkenler adım adım yalnız bırakılmalıdır.`,
        ipucuTuzak: '⚠️ Parantez başındaki eksi (-) sembolünü dağıtırken parantez içindeki TÜM terimlerin işaretini değiştirmeyi unutma!',
        zorluk: 'Kritik',
      },
      {
        id: `fk_${q.id}_2`,
        kavram: `${konu} - Kritik İşlem Adımı`,
        tanim: `${konu} sorularında işlem sırası (önce parantez içi, sonra çarpma/bölme, en son toplama/çıkarma) kesinlikle takip edilmelidir.`,
        ipucuTuzak: '⚠️ Soru kökünde "x kaçtır?" ile "ifadenin değeri kaçtır?" sorularını karıştırma, en son istenen ifadeyi kontrol et!',
        zorluk: 'Zor',
      },
      {
        id: `fk_${q.id}_3`,
        kavram: 'Tanım Kümesi ve Doğrulama',
        tanim: 'Kesirli ifadelerde paydayı 0 yapan, köklü ifadelerde çift dereceli kök içini negatif yapan değerler tanım kümesinden elenir.',
        ipucuTuzak: '⚠️ Bulduğun çözüm kümesi değerlerini başlangıçtaki ana eşitlikte yerine koyup sağladığını kontrol et!',
        zorluk: 'İleri',
      },
    ];
  }

  // 3. Geography
  if (ders === 'Coğrafya') {
    return [
      {
        id: `fk_${q.id}_1`,
        kavram: `${konu} - Mekânsal & Fiziki Özellikler`,
        tanim: `${konu} konusunda Türkiye'nin ve dünyanın fiziki/beşeri coğrafi unsurları harita üzerindeki konumlarıyla birlikte değerlendirilir.`,
        ipucuTuzak: '⚠️ Karasallık, yükselti ve enlem etkilerini birbiriyle karıştırmadan neden-sonuç analizi yap!',
        zorluk: 'Kritik',
      },
      {
        id: `fk_${q.id}_2`,
        kavram: 'Harita ve Dağılış İlkesi',
        tanim: 'Coğrafi olayların yeryüzündeki dağılışı (iklim tipleri, bitki örtüsü, nüfus yoğunluğu) incelenirken bölgesel etkenler dikkate alınır.',
        ipucuTuzak: '⚠️ Grafikli ve haritalı sorularda lejantı ve eksen birimlerini dikkatle oku.',
        zorluk: 'Zor',
      },
      {
        id: `fk_${q.id}_3`,
        kavram: 'Neden-Sonuç ve İklim-İnsan Etkileşimi',
        tanim: 'Doğal çevrenin insan faaliyetlerine, insan faaliyetlerinin de çevreye olan etkileri dengeli biçimde analiz edilmelidir.',
        ipucuTuzak: '⚠️ Soruda "doğal faktör" mü yoksa "beşeri faktör" mü sorulduğunu netleştir.',
        zorluk: 'İleri',
      },
    ];
  }

  // 4. History
  if (ders === 'Tarih') {
    return [
      {
        id: `fk_${q.id}_1`,
        kavram: `${konu} - Dönemsel Gelişmeler & Antlaşmalar`,
        tanim: `${konu} sürecindeki kritik olaylar, dönemin iç ve dış dinamikleriyle birlikte kronolojik bütünlük içinde ele alınır.`,
        ipucuTuzak: '⚠️ Tarihsel olayları günümüzün değer yargılarıyla değil, dönemin koşullarına göre yorumla!',
        zorluk: 'Kritik',
      },
      {
        id: `fk_${q.id}_2`,
        kavram: 'Egemenlik ve Bağımsızlık İlkeleri',
        tanim: 'Milli egemenlik (halk iradesi/meclis) ile milli bağımsızlık (vatanın bütünlüğü/işgallerden kurtulma) kavramları ayrıştırılmalıdır.',
        ipucuTuzak: '⚠️ Kapitülasyonlar ve boğazlar gibi uluslararası kısıtlamaların devletin egemenliğine etkisine dikkat et.',
        zorluk: 'Zor',
      },
      {
        id: `fk_${q.id}_3`,
        kavram: 'Tarihsel Neden-Sonuç Bağıntısı',
        tanim: 'Bir antlaşmanın veya savaşın sonucu, bir sonraki tarihsel sürecin tetikleyicisi ve doğrudan nedeni haline gelir.',
        ipucuTuzak: '⚠️ Soruda sadece verilen öncüle göre mi yoksa genel bilgiye göre mi yorum istendiğini tespit et.',
        zorluk: 'İleri',
      },
    ];
  }

  // 5. Science: Physics / Chemistry / Biology
  if (ders === 'Fizik' || ders === 'Kimya' || ders === 'Biyoloji') {
    return [
      {
        id: `fk_${q.id}_1`,
        kavram: `${ders} — ${konu} Temel İlkesi`,
        tanim: teshis || `${konu} konusunda geçerli olan doğa kanunları, korunum yasaları veya biyolojik/kimyasal süreçler adım adım uygulanır.`,
        ipucuTuzak: `⚠️ ${ders} sorularında birim dönüşümlerine (örn. m/s, mol/L, Kelvin) ve reaksiyon dengesine çok dikkat et!`,
        zorluk: 'Kritik',
      },
      {
        id: `fk_${q.id}_2`,
        kavram: 'Değişken Analizi ve Neden-Sonuç',
        tanim: 'Deney veya sistem sorularında bağımsız değişken değiştirildiğinde bağımlı değişkenin nasıl etkilendiği grafik üzerinden okunur.',
        ipucuTuzak: '⚠️ Sabit tutulan (kontrol edilen) değişkenlerin etkisini ihmal etme!',
        zorluk: 'Zor',
      },
      {
        id: `fk_${q.id}_3`,
        kavram: 'Kural ve Formül Doğrulama',
        tanim: 'Formül veya ilke uygulandıktan sonra elde edilen sonucun fiziksel/kimyasal/biyolojik mantığa uygunluğu test edilir.',
        ipucuTuzak: '⚠️ İstisnai durumları (sıcaklık-özgül hacim ilişkileri, enzim inhibitörleri vb.) göz ardı etme.',
        zorluk: 'İleri',
      },
    ];
  }

  // 6. Turkish & Literature
  if (ders === 'Türkçe' || ders.includes('Edebiyat') || ders.includes('Türk Dili')) {
    return [
      {
        id: `fk_${q.id}_1`,
        kavram: `${konu} - Ana Düşünce & Dil Kuralı`,
        tanim: teshis || `${konu} sorularında cümlenin ögeleri, sözcük türleri, ses olayları veya paragrafın ana iletisi kurala göre bulunur.`,
        ipucuTuzak: '⚠️ Paragraf sorularında kendi yorumunu katmadan, yalnızca yazarın metindeki bakış açısına odaklan!',
        zorluk: 'Kritik',
      },
      {
        id: `fk_${q.id}_2`,
        kavram: 'Çeldirici ve İnce Anlam Ayrımı',
        tanim: 'Şıklarda geçen aşırı genellemeler ("yalnızca", "kesinlikle", "her durumda") genellikle yanlış çeldiricilerdir.',
        ipucuTuzak: '⚠️ Olumsuz soru köklerinin ("değinilmemiştir", "çıkarılamaz") altını mutlaka çiz!',
        zorluk: 'Zor',
      },
      {
        id: `fk_${q.id}_3`,
        kavram: 'Metin Analizi ve Yapı Kurgusu',
        tanim: 'Paragrafta akışı bozan cümle veya düşünceyi geliştirme yolları incelenirken cümleler arası mantıksal bağa bakılır.',
        ipucuTuzak: '⚠️ İki cümle arasındaki bağlantı ögelerine ("oysa", "buna karşın", "çünkü") dikkat et.',
        zorluk: 'İleri',
      },
    ];
  }

  // 7. Generic Fallback for any other subject (Philosophy, Religion, Law, etc.)
  return [
    {
      id: `fk_${q.id}_1`,
      kavram: `${ders} — ${konu} Temel Kavramı`,
      tanim: teshis || `${konu} konusunda sorulan ifadenin temel tanım ve kavram karşılığıdır.`,
      ipucuTuzak: `⚠️ ${ders} sorularında öncüllerdeki kritik anahtar kelimeleri belirleyerek çözüme başla!`,
      zorluk: 'Kritik',
    },
    {
      id: `fk_${q.id}_2`,
      kavram: 'Kavramsal Ayrım ve Detay Analizi',
      tanim: `${konu} konusu ile ilgili benzer kavramlar arasındaki ince farklar doğru tespit edilmelidir.`,
      ipucuTuzak: '⚠️ Soruda senden istenen temel bilgiyi doğrudan şıklarla eşleştir.',
      zorluk: 'Zor',
    },
    {
      id: `fk_${q.id}_3`,
      kavram: 'Sonuç ve Kural Doğrulama',
      tanim: 'Sorunun çözüm basamakları ve ulaşılan mantık ana prensipler ile eşleştirilerek teyit edilir.',
      ipucuTuzak: '⚠️ Doğru seçeneği belirledikten sonra diğer şıkları da hızlıca eleyerek sonucunu doğrula.',
      zorluk: 'İleri',
    },
  ];
}

import { saveQuestion } from './storage';

/**
 * Ensures a question has 3 flashcards.
 */
export function getOrGenerateFlashcards(q: SoruKaydi): BilgiKarti[] {
  if (q.bilgiKartlari && q.bilgiKartlari.length >= 3) {
    return q.bilgiKartlari;
  }
  return generateFallbackFlashcards(q);
}

/**
 * Fetch AI-generated flashcards from server or fallback and persist them
 */
export async function fetchAiFlashcards(q: SoruKaydi, userApiKey?: string): Promise<BilgiKarti[]> {
  try {
    const rawCards = await generateFlashcardsService({ question: q, userApiKey });
    if (Array.isArray(rawCards) && rawCards.length > 0) {
      const formatted: BilgiKarti[] = rawCards.map((c: any, idx: number) => ({
        id: `fk_${q.id}_ai_${idx}_${Date.now()}`,
        kavram: c.kavram || c.front || `${q.konu || q.ders} Püf Noktası`,
        tanim: c.tanim || c.back || 'Konuya ait kural açıklaması.',
        ipucuTuzak: c.ipucuTuzak || '⚠️ Bu konudaki kritik detaya dikkat et.',
        zorluk: c.zorluk || (idx === 0 ? 'Kritik' : idx === 1 ? 'Zor' : 'İleri'),
      }));
      // Persist to question object & storage
      q.bilgiKartlari = formatted;
      saveQuestion(q);
      return formatted;
    }
  } catch (err) {
    console.warn('AI Flashcard generation failed, using fallback:', err);
  }

  return getOrGenerateFlashcards(q);
}
