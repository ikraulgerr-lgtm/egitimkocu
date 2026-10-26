import { ProgramOgesi } from '../types';

export interface CurriculumTopic {
  ders: string;
  konular: string[];
}

export interface ExamCurriculum {
  id: string;
  name: string;
  category: 'YKS' | 'KPSS' | 'LGS' | 'SINIF';
  description: string;
  dersler: CurriculumTopic[];
}

export const EXAM_CURRICULUM_DATA: ExamCurriculum[] = [
  {
    id: 'yks_tyt_ayt',
    name: 'YKS (TYT & AYT)',
    category: 'YKS',
    description: 'Üniversiteye Giriş Sınavı - Temel & Alan Yeterlilik Testi',
    dersler: [
      {
        ders: 'TYT Türkçe',
        konular: [
          'Sözcükte Anlam',
          'Cümlede Anlam',
          'Paragrafta Anlam & Yapı',
          'Ses Bilgisi',
          'Yazım Kuralları',
          'Noktalama İşaretleri',
          'Sözcük Türleri (İsim, Sıfat, Zamir, Zarf)',
          'Fiiller & Fiilimsiler & Ek Fiil',
          'Cümle Ögeleri & Cümle Türleri',
          'Anlatım Bozuklukları',
        ],
      },
      {
        ders: 'TYT Matematik',
        konular: [
          'Temel Kavramlar & Sayı Basamakları',
          'Bölme ve Bölünebilme Kuralları',
          'EBOB - EKOK',
          'Rasyonel ve Ondalık Sayılar',
          'Basit Eşitsizlikler',
          'Mutlak Değer',
          'Üslü İfadeler',
          'Köklü İfadeler',
          'Çarpanlara Ayırma',
          'Oran ve Orantı',
          'Sayı ve Kesir Problemleri',
          'Yaş ve Hareket Problemleri',
          'Yüzde, Kâr-Zarar ve Karışım Problemleri',
          'Kümeler ve Kartezyen Çarpım',
          'Fonksiyonlar (TYT Düzeyi)',
          'Permütasyon, Kombinasyon ve Olasılık',
          'Veri ve İstatistik',
        ],
      },
      {
        ders: 'AYT Matematik',
        konular: [
          'Polinomlar ve Çarpanlara Ayırma',
          'İkinci Dereceden Denklemler ve Karmaşık Sayılar',
          'Parabol (İkinci Dereceden Fonksiyonlar)',
          'Eşitsizlikler ve Eşitsizlik Sistemleri',
          'Trigonometri (Birim Çember ve Grafikler)',
          'Trigonometri (Toplam-Fark, Yarım Açı)',
          'Logaritma ve Üstel Fonksiyonlar',
          'Diziler ve Aritmetik-Geometrik Dizi',
          'Limit ve Süreklilik',
          'Türev Alma Kuralları ve Geometrik Yorum',
          'Türevin Uygulamaları (Maks-Min & Artan-Azalan)',
          'Belirsiz İntegral',
          'Belirli İntegral ve Alan Hesabı',
        ],
      },
      {
        ders: 'Geometri (TYT-AYT)',
        konular: [
          'Doğruda ve Üçgende Açılar',
          'Özel Üçgenler (Dik, İkizkenar, Eşkenar)',
          'Üçgende Açıortay ve Kenarortay',
          'Üçgende Alan ve Benzerlik',
          'Çokgenler ve Özel Dörtgenler',
          'Yamuk, Paralelkenar, Eşkenar Dörtgen',
          'Dikdörtgen ve Kare',
          'Çemberde Açılar ve Uzunluk',
          'Dairede Çevre ve Alan',
          'Noktanın ve Doğrunun Analitiği',
          'Katı Cisimler (Prizma, Piramit, Silindir, Koni)',
          'Çemberin Analitik İncelenmesi',
        ],
      },
      {
        ders: 'Fizik (TYT-AYT)',
        konular: [
          'Fizik Bilimine Giriş & Madde ve Özkütle',
          'Kuvvet ve Newton’un Hareket Yasaları',
          'İş, Güç ve Enerji',
          'Isı, Sıcaklık ve Genleşme',
          'Elektrostatik & Elektrik Akımı',
          'Manyetizma ve Elektromanyetik İndüksiyon',
          'Basınç ve Sıvıların Kaldırma Kuvveti',
          'Dalgalar (Yay, Su, Ses, Deprem)',
          'Optik (Aydınlanma, Aynalar, Kırılma, Mercekler)',
          'Bağıl Hareket ve İki Boyutta Hareket',
          'Düzgün Çembersel Hareket ve Basit Harmonik Hareket',
          'Modern Fizik ve Teknolojideki Uygulamaları',
        ],
      },
      {
        ders: 'Kimya (TYT-AYT)',
        konular: [
          'Kimya Bilimi ve Güvenlik Uyarıları',
          'Atom Modelleri ve Periyodik Sistem',
          'Kimyasal Türler Arası Etkileşimler',
          'Maddenin Halleri ve Gazlar',
          'Kimyanın Temel Kanunları ve Mol Kavramı',
          'Kimyasal Hesaplamalar',
          'Sıvı Çözeltiler ve Koligatif Özellikler',
          'Kimyasal Tepkimelerde Enerji (Entalpi)',
          'Tepkime Hızları ve Kimyasal Denge',
          'Asit-Baz Dengesi ve KÇÇ',
          'Elektrokimya ve Redoks Tepkimeleri',
          'Karbon Kimyasına Giriş ve Organik Bileşikler',
        ],
      },
      {
        ders: 'Biyoloji (TYT-AYT)',
        konular: [
          'Yaşam Bilimi Biyoloji & Canlıların Temel Bileşenleri',
          'Hücre Yapısı ve Organeller',
          'Canlılar Dünyası ve Sınıflandırma',
          'Hücre Bölünmeleri (Mitoz ve Mayoz)',
          'Kalıtımın Temel Esasları',
          'Ekosistem Ekolojisi ve Güncel Çevre Sorunları',
          'Sinir Sistemi ve Endokrin Sistem',
          'Destek, Hareket ve Sindirim Sistemi',
          'Dolaşım, Bağışıklık ve Solunum Sistemi',
          'Üriner Sistem ve Boşaltım',
          'Nükleik Asitler ve Protein Sentezi',
          'Fotosentez, Kemosentez ve Hücresel Solunum',
        ],
      },
      {
        ders: 'Tarih (TYT-AYT)',
        konular: [
          'Tarih Bilimi ve İlk Uygarlıklar',
          'İlk ve Orta Çağlarda Türk Dünyası',
          'İslam Medeniyetinin Doğuşu ve Türk-İslam Devletleri',
          'Osmanlı Devleti Kuruluş ve Yükselme Dönemi',
          'Yeniçağ ve Yakınçağda Avrupa ve Osmanlı Değişimi',
          'En Uzun Yüzyıl (Osmanlı Dağılma Dönemi)',
          '1. Dünya Savaşı ve Sonuçları',
          'Milli Mücadele Hazırlık ve Cepheler',
          'Atatürkçülük ve Türk İnkılabı',
          'Çağdaş Türk ve Dünya Tarihi',
        ],
      },
      {
        ders: 'Coğrafya (TYT-AYT)',
        konular: [
          'Doğa, İnsan ve Coğrafi Konum',
          'Harita Bilgisi ve Projeksiyonlar',
          'Dünyanın Şekli ve Hareketleri',
          'İklim Elemanları (Sıcaklık, Basınç, Rüzgar, Nem)',
          'İç ve Dış Kuvvetler (Yeryüzü Şekilleri)',
          'Nüfus ve Yerleşme Coğrafyası',
          'Türkiye’nin Fiziki Coğrafyası ve Bölgeleri',
          'Ekonomik Faaliyetler ve Doğal Kaynaklar',
          'Küresel ve Bölgesel Örgütler & Çevre',
        ],
      },
      {
        ders: 'AYT Edebiyat',
        konular: [
          'Edebi Sanatlar ve Şiir Bilgisi',
          'İslamiyet Öncesi ve Geçiş Dönemi Türk Edebiyatı',
          'Halk Edebiyatı (Anonim, Aşık, Dini-Tasavvufi)',
          'Divan Edebiyatı (Nazım Şekilleri ve Şairler)',
          'Tanzimat Dönemi Edebiyatı',
          'Servet-i Fünun ve Fecr-i Âti Edebiyatı',
          'Milli Edebiyat Dönemi',
          'Cumhuriyet Dönemi Şiiri',
          'Cumhuriyet Dönemi Roman ve Hikayesi',
          'Batı Edebiyatı Akımları',
        ],
      },
    ],
  },
  {
    id: 'kpss_gk_gy',
    name: 'KPSS (Genel Yetenek & Genel Kültür)',
    category: 'KPSS',
    description: 'Kamu Personeli Seçme Sınavı - B Grubu ve Öğretmenlik Ortak Alan',
    dersler: [
      {
        ders: 'KPSS Türkçe',
        konular: [
          'Sözcük ve Cümle Anlamı',
          'Paragraf Yapısı ve Anlam Çıkarımı',
          'Ses Olayları ve Yazım Kuralları',
          'Noktalama İşaretleri',
          'Sözcük Türleri ve Cümle Bilgisi',
          'Anlatım Bozuklukları',
          'Sözel Mantık ve Akıl Yürütme',
        ],
      },
      {
        ders: 'KPSS Matematik',
        konular: [
          'Temel Kavramlar ve Sayı Sistemleri',
          'Bölünebilme, Asal Çarpanlar ve EBOB-EKOK',
          'Rasyonel Sayılar ve Ondalık Kesirler',
          'Basit Eşitsizlikler ve Mutlak Değer',
          'Üslü ve Köklü Sayılar',
          'Çarpanlara Ayırma ve Sadeleştirme',
          'Oran-Orantı ve Denklem Çözme',
          'Sayı, Kesir, Yaş ve İşçi Problemleri',
          'Yüzde, Kâr-Zarar ve Karışım Problemleri',
          'Hareket ve Grafik Okuma Problemleri',
          'Kümeler ve Olasılık',
          'Sayısal Mantık ve Tablo Yorumlama',
          'Geometri Temel Bilgisi (Açılar, Çokgenler, Çember)',
        ],
      },
      {
        ders: 'KPSS Tarih',
        konular: [
          'İslamiyet Öncesi Türk Tarihi ve Kültür Medeniyeti',
          'İlk Türk-İslam Devletleri',
          'Anadolu Selçukluları ve Beylikler',
          'Osmanlı Devleti Kuruluş ve Yükselme Dönemleri',
          'Osmanlı Kültür ve Medeniyeti',
          'Osmanlı Duraklama ve Gerileme Dönemleri',
          'Osmanlı Dağılma Dönemi ve 19. Yüzyıl Islahatları',
          '20. Yüzyıl Başlarında Osmanlı (Trablusgarp, Balkan, 1. Dünya)',
          'Kurtuluş Savaşı Hazırlık Dönemi (Kongreler, Misakımilli)',
          'Kurtuluş Savaşı Muharebeler ve Antlaşmalar',
          'Atatürk İlke ve İnkılapları',
          'Atatürk Dönemi Türk Dış Politikası',
          'Çağdaş Türk ve Dünya Tarihi',
        ],
      },
      {
        ders: 'KPSS Coğrafya',
        konular: [
          'Türkiye’nin Coğrafi Konumu ve Jeopolitiği',
          'Türkiye’nin Yer Şekilleri, Dağları, Ovaları ve Platoları',
          'Türkiye’nin İklimi ve Bitki Örtüsü',
          'Türkiye’nin Su Varlığı ve Toprak Tipleri',
          'Türkiye’de Doğal Afetler ve Çevre',
          'Türkiye’de Nüfus ve Yerleşme Dağılımı',
          'Türkiye’de Tarım ve Hayvancılık',
          'Türkiye’de Madenler ve Enerji Kaynakları',
          'Türkiye’de Sanayi, Ulaşım, Ticaret ve Turizm',
          'Türkiye’nin Coğrafi Bölgeleri ve Kalkınma Projeleri',
        ],
      },
      {
        ders: 'KPSS Vatandaşlık & Güncel',
        konular: [
          'Temel Hukuk Kavramları ve Hukukun Dalları',
          'Devlet Şekilleri ve Demokrasi İlkeleri',
          'Türk Anayasa Tarihi (1876-1982)',
          '1982 Anayasası Temel Esasları ve Haklar',
          'Yasama Organı (TBMM Yapısı ve Görevleri)',
          'Yürütme Organı (Cumhurbaşkanlığı)',
          'Yargı Organı ve Yüksek Mahkemeler',
          'İdare Hukuku ve İdari Teşkilat',
          'Uluslararası Kuruluşlar (BM, NATO, AB vb.)',
          'Güncel Sosyoekonomik ve Kültürel Gelişmeler',
        ],
      },
    ],
  },
  {
    id: 'lgs_8_sinif',
    name: 'LGS (8. Sınıf)',
    category: 'LGS',
    description: 'Liselere Geçiş Sistemi - 8. Sınıf Müfredat ve Yeni Nesil Sorular',
    dersler: [
      {
        ders: 'LGS Matematik',
        konular: [
          'Çarpanlar ve Katlar (EBOB-EKOK)',
          'Üslü İfadeler ve Bilimsel Gösterim',
          'Kareköklü İfadeler ve Gerçek Sayılar',
          'Veri Analizi (Daire ve Çizgi Grafikleri)',
          'Basit Olayların Olma Olasılığı',
          'Cebirsel İfadeler ve Özdeşlikler',
          'Doğrusal Denklemler ve Eğim',
          'Birinci Dereceden Bir Bilinmeyenli Eşitsizlikler',
          'Üçgenler (Açı, Kenar Bağıntıları, Pisagor)',
          'Eşlik ve Benzerlik',
          'Dönüşüm Geometrisi (Öteleme, Yansıma)',
          'Geometrik Cisimler (Prizma, Silindir, Koni)',
        ],
      },
      {
        ders: 'LGS Fen Bilimleri',
        konular: [
          'Mevsimler ve İklim',
          'DNA ve Genetik Kod & Kalıtım',
          'Mutasyon, Modifikasyon, Adaptasyon ve Biyoteknoloji',
          'Basınç (Katı, Sıvı ve Gaz Basıncı)',
          'Madde ve Endüstri (Periyodik Sistem, Fiziksel-Kimyasal Değişim)',
          'Kimyasal Tepkimeler ve Asit-Bazlar',
          'Maddenin Isı ile Etkileşimi',
          'Basit Makineler (Kaldıraç, Makara, Eğik Düzlem)',
          'Canlılar ve Enerji İlişkileri (Besin Zinciri, Fotosentez)',
          'Elektrik Yükleri ve Elektrik Enerjisi',
        ],
      },
      {
        ders: 'LGS Türkçe',
        konular: [
          'Fiilimsiler (İsim-Fiil, Sıfat-Fiil, Zarf-Fiil)',
          'Sözcükte ve Cümlede Anlam',
          'Paragrafta Anlam ve Ana Fikir',
          'Metin Türleri ve Söz Sanatları',
          'Cümlenin Ögeleri',
          'Fiilde Çatı',
          'Cümle Türleri',
          'Yazım Kuralları ve Noktalama İşaretleri',
          'Anlatım Bozuklukları',
          'Sözel Mantık, Tablo ve Grafik Yorumlama',
        ],
      },
      {
        ders: 'LGS T.C. İnkılap Tarihi',
        konular: [
          'Bir Kahraman Doğuyor (Mustafa Kemal’in Hayatı)',
          'Milli Uyanış: Bağımsızlık Yolunda Atılan Adımlar',
          'Milli Bir Destan: Ya İstiklal Ya Ölüm (Cepheler)',
          'Atatürkçülük ve Çağdaşlaşan Türkiye (İnkılaplar)',
          'Demokratikleşme Çabaları',
          'Atatürk Dönemi Türk Dış Politikası',
          'Atatürk’ün Ölümü ve Sonrası',
        ],
      },
      {
        ders: 'LGS İngilizce',
        konular: [
          'Unit 1: Friendship',
          'Unit 2: Teen Life',
          'Unit 3: In The Kitchen',
          'Unit 4: On The Phone',
          'Unit 5: The Internet',
          'Unit 6: Adventures',
          'Unit 7: Tourism',
          'Unit 8: Chores',
          'Unit 9: Science',
          'Unit 10: Natural Forces',
        ],
      },
      {
        ders: 'LGS Din Kültürü',
        konular: [
          'Kader ve Kaza İnancı',
          'Zekat ve Sadaka İbadeti',
          'Din ve Hayat',
          'Hz. Muhammed’in (s.a.v.) Örnekliği',
          'Kur’an-ı Kerim ve Özellikleri',
        ],
      },
    ],
  },
  {
    id: 'sinif_lise_ortaokul',
    name: 'Sınıf Müfredatı (Okul & Yazılı Hazırlık)',
    category: 'SINIF',
    description: 'Okul Dersleri, Yazılı Sınavlar ve Not Yükseltme Programı',
    dersler: [
      {
        ders: 'Matematik (Okul)',
        konular: [
          '1. Dönem 1. Yazılı Konuları',
          '1. Dönem 2. Yazılı Konuları',
          '2. Dönem 1. Yazılı Konuları',
          '2. Dönem 2. Yazılı Konuları',
          'Haftalık Konu Tekrarı & Pekiştirme',
          'Yeni Nesil Soru Çözüm Kampı',
        ],
      },
      {
        ders: 'Fen / Fizik-Kimya-Biyoloji',
        konular: [
          'Dönem Üniteleri ve Laboratuvar Uygulamaları',
          'Formül ve Kavram Haritası Çıkarma',
          'Yazılı Öncesi Deneme ve Soru Çözümü',
          'Eksik Konu Tamamlama Çalışması',
        ],
      },
      {
        ders: 'Türkçe / Edebiyat',
        konular: [
          'Okuma ve Anlama Becerileri',
          'Dil Bilgisi ve Yazım Kuralları',
          'Edebi Metin İnceleme ve Tahlil',
          'Yazılıya Hazırlık Soru Çözümleri',
        ],
      },
    ],
  },
];

// Helper: Calculate Camp Schedule given options
export interface CampGeneratorOptions {
  examName: string;
  selectedTopics: { ders: string; konu: string }[];
  startDate: string; // YYYY-MM-DD
  targetEndDate: string; // YYYY-MM-DD
  dailyHours: number; // e.g. 2, 3, 4
  preferredTimeSlot?: string; // e.g. '09:00 - 11:30' | '14:00 - 16:30' | '19:00 - 21:30'
}

export function generateCampScheduleItems(options: CampGeneratorOptions): Omit<ProgramOgesi, 'id'>[] {
  const { examName, selectedTopics, startDate, targetEndDate, dailyHours, preferredTimeSlot = '19:00 - 21:00' } = options;

  if (selectedTopics.length === 0) return [];

  const start = new Date(startDate);
  const end = new Date(targetEndDate);

  // Fallback if end date is invalid or before start
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    end.setTime(start.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days default
  }

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

  const dayAbbrevs = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const generatedItems: Omit<ProgramOgesi, 'id'>[] = [];

  // Group topics by ders to mix them nicely across days
  const topicsPool = [...selectedTopics];

  // Distribute topics across available days
  for (let dayIndex = 0; dayIndex < diffDays; dayIndex++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + dayIndex);

    const dayName = dayAbbrevs[currentDate.getDay()];
    const dateStr = currentDate.toISOString().split('T')[0];

    // Pick 1 or 2 topics for this day
    const topicsPerDay = Math.max(1, Math.ceil(topicsPool.length / Math.max(1, diffDays - dayIndex)));
    const daysTopics = topicsPool.splice(0, topicsPerDay);

    if (daysTopics.length === 0) {
      // If we finished topics early, add review or practice tests
      if (dayIndex % 2 === 0) {
        generatedItems.push({
          ders: `${examName} Genel Tekrar`,
          konu: 'Haftalık Konu Tekrarı & Yanlış Havuzu Çözümü',
          saat: preferredTimeSlot,
          gun: dayName,
          tamamlandi: false,
          isCurrent: false,
        });
      }
    } else {
      daysTopics.forEach((t, tIdx) => {
        // Adjust hour slot slightly if multiple topics on same day
        let taskTime = preferredTimeSlot;
        if (daysTopics.length > 1) {
          taskTime = tIdx === 0 ? '18:00 - 19:30' : '20:00 - 21:30';
        }

        generatedItems.push({
          ders: t.ders,
          konu: `${t.konu} (Kamp - ${dailyHours} Saat)`,
          saat: taskTime,
          gun: dayName,
          tamamlandi: false,
          isCurrent: false,
        });
      });
    }
  }

  return generatedItems;
}
