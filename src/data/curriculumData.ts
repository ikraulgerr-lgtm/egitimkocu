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
    id: 'sinif_12',
    name: '12. Sınıf (YKS & MEB Müfredatı)',
    category: 'SINIF',
    description: '12. Sınıf Okul Dersleri, Yazılı Hazırlık ve İleri Düzey Konular',
    dersler: [
      {
        ders: '12. Sınıf Matematik',
        konular: [
          'Üstel Fonksiyon ve Logaritma',
          'Diziler (Aritmetik ve Geometrik Dizi)',
          'Trigonometri (Toplam-Fark ve Yarım Açı)',
          'Limit ve Süreklilik',
          'Türev Alma Kuralları ve Anlık Hız',
          'Türevin Uygulamaları (Maks-Min ve Grafikler)',
          'Belirsiz İntegral',
          'Belirli İntegral ve Alan Hesabı',
          'Çemberin Analitik İncelenmesi',
        ],
      },
      {
        ders: '12. Sınıf Fizik',
        konular: [
          'Düzgün Çembersel Hareket',
          'Dönerek Öteleme ve Açısal Momentum',
          'Kütle Çekim ve Kepler Kanunları',
          'Basit Harmonik Hareket',
          'Dalga Mekaniği ve Girişim',
          'Atom Fiziğine Giriş ve Radyoaktivite',
          'Özel Görelilik ve Kuantum Fiziği',
          'Modern Fiziğin Teknolojideki Uygulamaları',
        ],
      },
      {
        ders: '12. Sınıf Kimya',
        konular: [
          'Kimya ve Elektrik (Redoks, Piller, Elektroliz)',
          'Karbon Kimyasına Giriş (Hibritleşme, Molekül Geometrisi)',
          'Organik Bileşikler (Hidrokarbonlar)',
          'Fonksiyonel Gruplar (Alkoller, Eterler, Karboniller)',
          'Karboksilik Asitler ve Esterler',
          'Enerji Kaynakları ve Sürdürülebilir Kimya',
        ],
      },
      {
        ders: '12. Sınıf Biyoloji',
        konular: [
          'Genden Proteine (DNA Replikasyonu, Protein Sentezi)',
          'Canlılarda Enerji Dönüşümleri (Fotosentez ve Kemosentez)',
          'Hücresel Solunum (Glikoliz, Krebs, ETS)',
          'Bitki Biyolojisi (Bitkisel Dokular, Organlar, Taşıma)',
          'Bitkilerde Eşeyli Üreme ve Büyüme',
          'Canlılar ve Çevre',
        ],
      },
      {
        ders: '12. Sınıf Türk Dili ve Edebiyatı',
        konular: [
          'Cumhuriyet Dönemi Türk Şiiri',
          'Cumhuriyet Dönemi Hikâye ve Romanı',
          'Cumhuriyet Dönemi Tiyatrosu',
          'Deneme, Söyleşi ve Eleştiri Metinleri',
          'Paragrafta Anlam ve Yapı Tahlili',
          'Dil Bilgisi ve İmla-Noktalama Kuralları',
        ],
      },
    ],
  },
  {
    id: 'sinif_11',
    name: '11. Sınıf (AYT Temeli & MEB Müfredatı)',
    category: 'SINIF',
    description: '11. Sınıf Okul Dersleri, Yazılı Sınavlar ve AYT Altyapısı',
    dersler: [
      {
        ders: '11. Sınıf Matematik',
        konular: [
          'Trigonometri (Birim Çember, Esas Ölçü, Teoremler)',
          'Doğrunun Analitik İncelenmesi',
          'Fonksiyonlarda Uygulamalar (Artan-Azalan, Simetri)',
          'İkinci Dereceden İki Bilinmeyenli Denklem Sistemleri',
          'İkinci Dereceden Eşitsizlikler',
          'Çemberde Açılar ve Teğet-Kiriş Özellikleri',
          'Dairenin Çevresi ve Alanı',
          'Uzay Geometri ve Katı Cisimler',
          'Koşullu Olasılık',
        ],
      },
      {
        ders: '11. Sınıf Fizik',
        konular: [
          'Vektörler ve Bağıl Hareket',
          'Newton’ın Hareket Yasaları',
          'Bir Boyutta ve İki Boyutta Sabit İvmeli Hareket',
          'İş, Güç ve Mekanik Enerji',
          'İtme ve Çizgisel Momentum',
          'Tork, Denge ve Kütle Merkezi',
          'Basit Makineler',
          'Elektriksel Kuvvet, Alan ve Potansiyel',
          'Manyetizma ve Elektromanyetik İndüksiyon',
          'Alternatif Akım ve Transformatörler',
        ],
      },
      {
        ders: '11. Sınıf Kimya',
        konular: [
          'Modern Atom Teorisi (Kuantum Sayıları, Periyodik Özellikler)',
          'Gazlar (Gaz Yasaları, Kinetik Teori, Gerçek Gazlar)',
          'Sıvı Çözeltiler ve Koligatif Özellikler',
          'Kimyasal Tepkimelerde Enerji (Entalpi Türleri, Hess Yasası)',
          'Kimyasal Tepkimelerde Hız',
          'Kimyasal Denge ve Dengeye Etki Eden Faktörler',
          'Sulu Çözeltilerde Asit-Baz Dengesi',
          'Çözünürlük Dengesi (KÇÇ)',
        ],
      },
      {
        ders: '11. Sınıf Biyoloji',
        konular: [
          'Denetleyici ve Düzenleyici Sistem (Sinir Sistemi ve Endokrin)',
          'Duyu Organları (Göz, Kulak, Burun, Dil, Deri)',
          'Destek ve Hareket Sistemi (Kemik, Kıkırdak, Kaslar)',
          'Sindirim Sistemi ve Sağlığı',
          'Dolaşım ve Bağışıklık Sistemi',
          'Solunum Sistemi',
          'Üriner Sistem (Boşaltım)',
          'Üreme Sistemi ve Embriyonik Gelişim',
          'Komünite ve Popülasyon Ekolojisi',
        ],
      },
      {
        ders: '11. Sınıf Türk Dili ve Edebiyatı',
        konular: [
          'Tanzimat Dönemi Şiir, Roman ve Tiyatrosu',
          'Servet-i Fünûn ve Fecr-i Âtî Edebiyatı',
          'Millî Edebiyat Dönemi ve Akımları',
          'Cumhuriyet’in İlk Yıllarında Şiir ve Nesir',
          'Yazım Kuralları, Noktalama ve Anlatım Bozuklukları',
        ],
      },
    ],
  },
  {
    id: 'sinif_10',
    name: '10. Sınıf (MEB Müfredatı & Yazılı Hazırlık)',
    category: 'SINIF',
    description: '10. Sınıf Okul Dersleri, Yazılı Sınavlar ve TYT Temel Konuları',
    dersler: [
      {
        ders: '10. Sınıf Matematik',
        konular: [
          'Sayma Yöntemleri, Permütasyon ve Kombinasyon',
          'Binom Açılımı ve Olasılık',
          'Fonksiyon Kavramı ve Gösterimi',
          'Bileşke Fonksiyon ve Fonksiyonun Tersi',
          'Polinomlar ve Polinomlarda İşlemler',
          'Çarpanlara Ayırma Yöntemleri',
          'İkinci Dereceden Bir Bilinmeyenli Denklemler',
          'Çokgenler ve Dörtgenler',
          'Özel Dörtgenler (Yamuk, Paralelkenar, Eşkenar Dörtgen, Dikdörtgen, Kare)',
          'Katı Cisimler (Prizmalar ve Piramitler)',
        ],
      },
      {
        ders: '10. Sınıf Fizik',
        konular: [
          'Elektrik Akımı, Direnç ve Potansiyel Farkı',
          'Elektrik Devreleri ve Ohm Kanunu',
          'Mıknatıs ve Manyetik Alan',
          'Katı, Sıvı ve Gazlarda Basınç',
          'Sıvıların Kaldırma Kuvveti',
          'Dalgalar (Yay Dalgası, Su Dalgası, Ses ve Deprem Dalgaları)',
          'Optik (Aydınlanma, Düzlem Aynalar, Küresel Aynalar)',
          'Işığın Kırılması, Mercekler ve Renk',
        ],
      },
      {
        ders: '10. Sınıf Kimya',
        konular: [
          'Kimyanın Temel Kanunları (Kütlenin Korunumu, Sabit Oranlar)',
          'Mol Kavramı ve Kimyasal Hesaplamalar',
          'Kimyasal Tepkime Denklemleri',
          'Karışımlar ve Homojen-Heterojen Karışımlar',
          'Çözeltilerde Derişim ve Ayırma Teknikleri',
          'Asitler, Bazlar ve Tuzların Özellikleri',
          'Kimya Her Yerde (Temizlik Maddeleri, Polimerler)',
        ],
      },
      {
        ders: '10. Sınıf Biyoloji',
        konular: [
          'Mitoz Bölünme ve Eşeysiz Üreme',
          'Mayoz Bölünme ve Eşeyli Üreme',
          'Kalıtımın Genel İlkeleri ve Mendel Genetiği',
          'Eşeye Bağlı Kalıtım ve Soyağaçları',
          'Ekosistem Ekolojisi (Besin Zinciri, Madde Döngüleri)',
          'Güncel Çevre Sorunları ve Biyolojik Çeşitlilik',
        ],
      },
      {
        ders: '10. Sınıf Türk Dili ve Edebiyatı',
        konular: [
          'Türk Edebiyatının Dönemleri',
          'Dede Korkut Hikâyeleri ve Halk Hikâyesi',
          'İslamiyet Öncesi ve Geçiş Dönemi Türk Edebiyatı',
          'Halk Şiiri (Koşma, Semai, Türkü, İlahi)',
          'Divan Şiiri (Gazel, Kaside, Mesnevi)',
          'Destan ve Efsane',
          'Roman ve Tiyatro',
          'Cümle Türleri ve Dil Bilgisi Kuralları',
        ],
      },
    ],
  },
  {
    id: 'sinif_9',
    name: '9. Sınıf (Liseye Giriş & MEB Müfredatı)',
    category: 'SINIF',
    description: '9. Sınıf Liseye Başlangıç, Temel Fen-Matematik ve Yazılı Hazırlık',
    dersler: [
      {
        ders: '9. Sınıf Matematik',
        konular: [
          'Önermeler ve Mantık',
          'Kümeler ve Kümelerde İşlemler',
          'Kartezyen Çarpım',
          'Bölünebilme Kuralları ve EBOB-EKOK',
          'Gerçek Sayılar ve Rasyonel Sayılar',
          'Birinci Dereceden Denklem ve Eşitsizlikler',
          'Mutlak Değer',
          'Üslü ve Köklü İfadeler',
          'Oran ve Orantı',
          'Denklem ve Eşitsizliklerle İlgili Problemler',
          'Üçgende Açılar ve Açı-Kenar Bağıntıları',
          'Üçgenlerin Eşliği ve Benzerliği',
          'Üçgenin Yardımcı Elemanları (Açıortay, Kenarortay, Yükseklik)',
          'Dik Üçgen ve Pisagor Teoremi',
          'Üçgende Alan Hesabı',
          'Veri ve İstatistik',
        ],
      },
      {
        ders: '9. Sınıf Fizik',
        konular: [
          'Fizik Bilimine Giriş ve Temel Büyüklükler',
          'Madde ve Özellikleri (Kütle, Hacim, Özkütle)',
          'Dayanıklılık, Adezyon ve Kohezyon',
          'Hareket (Konum, Alınan Yol, Yer Değiştirme, Hız, İvme)',
          'Kuvvet ve Newton’ın Hareket Yasaları',
          'Sürtünme Kuvveti',
          'İş, Güç ve Mekanik Enerji',
          'Isı, Sıcaklık, Özısı ve Isıl Denge',
          'Hâl Değişimi ve Isı İletim Yolları',
          'Elektrostatik (Elektrik Yükleri ve Coulomb Kuvveti)',
        ],
      },
      {
        ders: '9. Sınıf Kimya',
        konular: [
          'Kimya Bilimi ve Simyadan Kimyaya',
          'Kimya Disiplinleri ve Güvenlik Uyarı İşaretleri',
          'Atom Modelleri (Dalton, Thomson, Rutherford, Bohr)',
          'Atomun Yapısı (Proton, Nötron, Elektron, İzo-Kavramlar)',
          'Periyodik Sistem ve Periyodik Özellikler',
          'Kimyasal Türler Arası Etkileşimler',
          'İyonik ve Kovalent Bağlar',
          'Zayıf Etkileşimler (Hidrojen Bağı, Van der Waals)',
          'Maddenin Halleri (Katı, Sıvı, Gaz, Plazma)',
          'Çevre Kimyası ve Su Tasarrufu',
        ],
      },
      {
        ders: '9. Sınıf Biyoloji',
        konular: [
          'Canlıların Ortak Özellikleri',
          'İnorganik Bileşikler (Su, Mineraller, Asit-Baz-Tuz)',
          'Organik Bileşikler (Karbonhidratlar, Yağlar, Proteinler)',
          'Enzimler, Vitaminler, Hormonlar ve Nükleik Asitler',
          'Hücre Teorisi ve Hücrenin Yapısı',
          'Hücre Organelleri ve Görevleri',
          'Hücre Zarından Madde Geçişleri (Difüzyon, Osmoz, Aktif Taşıma)',
          'Canlıların Çeşitliliği ve Sınıflandırılması',
        ],
      },
      {
        ders: '9. Sınıf Türk Dili ve Edebiyatı',
        konular: [
          'Edebiyatın Tanımı ve Güzel Sanatlarla İlişkisi',
          'İletişim ve Dilin İşlevleri',
          'Hikâye (Olay ve Durum Hikâyesi)',
          'Şiir Bilgisi (Nazım Birimi, Ölçü, Uyak ve Redif)',
          'Masal ve Fabl Türleri',
          'Roman Türü ve Yapı Unsurları',
          'Tiyatro Türü',
          'Sözcük Türleri (İsim, Sıfat, Zamir, Zarf)',
          'Yazım Kuralları ve Noktalama İşaretleri',
        ],
      },
    ],
  },
  {
    id: 'sinif_7',
    name: '7. Sınıf (MEB Müfredatı & LGS Temeli)',
    category: 'SINIF',
    description: '7. Sınıf Okul Dersleri, LGS Temeli ve Yazılı Sınav Hazırlığı',
    dersler: [
      {
        ders: '7. Sınıf Matematik',
        konular: [
          'Tam Sayılarla Toplama, Çıkarma, Çarpma ve Bölme',
          'Tam Sayıların Kendisi ile Tekrarlı Çarpımı',
          'Rasyonel Sayılar ve Sayı Doğrusunda Gösterme',
          'Rasyonel Sayılarla Dört İşlem',
          'Cebirsel İfadelerle İşlemler',
          'Eşitlik ve Birinci Dereceden Bir Bilinmeyenli Denklemler',
          'Oran ve Orantı',
          'Yüzdeler ve Yüzde Hesaplamaları',
          'Doğrular ve Açılar',
          'Çokgenler (Düzgün Çokgenler ve Alan)',
          'Çember ve Daire',
          'Veri Analizi (Çizgi Grafiği, Aritmetik Ortalama)',
        ],
      },
      {
        ders: '7. Sınıf Fen Bilimleri',
        konular: [
          'Uzay Araştırmaları ve Teleskoplar',
          'Güneş Sistemi Ötesi: Gök Cisimleri',
          'Hücre ve Organeller',
          'Mitoz Bölünme',
          'Mayoz Bölünme',
          'Kütle ve Ağırlık İlişkisi',
          'Kuvvet, İş ve Enerji İlişkisi',
          'Saf Maddeler ve Karışımlar',
          'Karışımların Ayrılması',
          'Işığın Soğurulması ve Aynalar',
          'Işığın Kırılması ve Mercekler',
          'Canlılarda Üreme, Büyüme ve Gelişme',
          'Elektrik Devreleri',
        ],
      },
      {
        ders: '7. Sınıf Türkçe',
        konular: [
          'Fiiller (Anlamına Göre, Kip ve Kişi)',
          'Ek Fiil ve Görevleri',
          'Zarflar (Belirteçler)',
          'Sözcükte ve Cümlede Anlam',
          'Paragrafta Anlam, Ana Düşünce ve Yapı',
          'Yazım Kuralları ve Noktalama İşaretleri',
          'Metin Türleri ve Söz Sanatları',
          'Anlatım Bozuklukları',
        ],
      },
      {
        ders: '7. Sınıf Sosyal Bilgiler',
        konular: [
          'İletişim ve İnsan İlişkileri',
          'Türk Tarihinde Yolculuk (Osmanlı Devleti)',
          'Ülkemizde Nüfus ve Yerleşme',
          'Zaman İçinde Bilim ve Buluşlar',
          'Üretim, Dağıtım ve Tüketim',
          'Yaşayan Demokrasi',
          'Küresel Bağlantılar',
        ],
      },
    ],
  },
  {
    id: 'sinif_6',
    name: '6. Sınıf (MEB Müfredatı)',
    category: 'SINIF',
    description: '6. Sınıf Okul Dersleri, Soru Çözümleri ve Yazılıya Hazırlık',
    dersler: [
      {
        ders: '6. Sınıf Matematik',
        konular: [
          'Doğal Sayılarla İşlemler ve Üslü İfadeler',
          'İşlem Önceliği ve Ortak Çarpan Parantezi',
          'Doğal Sayıların Çarpanları ve Katları',
          'Bölünebilme Kuralları',
          'Asal Sayılar ve Asal Çarpanlar',
          'Kümeler (Eleman, Birleşim, Kesişim)',
          'Tam Sayılar ve Sayı Doğrusu',
          'Kesirlerle İşlemler (Dört İşlem)',
          'Ondalık Gösterim ve Çözümleme',
          'Oran Kavramı',
          'Cebirsel İfadeler',
          'Veri Toplama ve Değerlendirme',
          'Açılar (Komşu, Tümler, Bütünler, Ters Açılar)',
          'Alan Ölçme (Üçgen ve Paralelkenar)',
          'Çember',
          'Geometrik Cisimler ve Sıvı Ölçme',
        ],
      },
      {
        ders: '6. Sınıf Fen Bilimleri',
        konular: [
          'Güneş Sistemi ve Gezegenler',
          'Güneş ve Ay Tutulmaları',
          'Destek ve Hareket Sistemi',
          'Sindirim Sistemi',
          'Dolaşım Sistemi',
          'Solunum Sistemi',
          'Boşaltım Sistemi',
          'Kuvvet ve Hareket (Bileşke Kuvvet)',
          'Madde ve Isı (İletken, Yalıtkan Maddeler)',
          'Ses ve Özellikleri (Yayılması ve Yansıması)',
          'Denetleyici ve Düzenleyici Sistemler',
          'Elektriğin İletimi',
        ],
      },
      {
        ders: '6. Sınıf Türkçe',
        konular: [
          'Sözcükte Anlam (Gerçek, Mecaz, Terim)',
          'Sözcükte Yapı (Kök, Yapım Eki, Çekim Eki)',
          'İsimler ve Sıfatlar (Ön Adlar)',
          'Zamirler (Adıllar) ve Edat-Bağlaç-Ünlem',
          'Cümlede Anlam ve Deyimler-Atasözleri',
          'Paragrafta Anlam ve Yapı',
          'Yazım Kuralları ve Noktalama İşaretleri',
        ],
      },
      {
        ders: '6. Sınıf Sosyal Bilgiler',
        konular: [
          'Biz ve Değerlerimiz',
          'Tarihe Yolculuk (İlk Türk Devletleri ve İslamiyet)',
          'Yeryüzünde Yaşam (Coğrafi Konum, İklim)',
          'Bilim ve Teknoloji Hayatımızda',
          'Üretiyorum, Tüketiyorum, Bilinçliyim',
          'Yönetime Katılıyorum',
          'Uluslararası İlişkilerimiz',
        ],
      },
    ],
  },
  {
    id: 'sinif_5',
    name: '5. Sınıf (Ortaokula Giriş & MEB Müfredatı)',
    category: 'SINIF',
    description: '5. Sınıf Okul Dersleri, Temel Beceriler ve Yazılı Sınav Kampı',
    dersler: [
      {
        ders: '5. Sınıf Matematik',
        konular: [
          'Milyonlu Doğal Sayılar ve Okunuşları',
          'Doğal Sayılarla Dört İşlem ve Zihinden İşlemler',
          'Doğal Sayılarla Çarpma ve Bölme Problemleri',
          'Kesirler ve Kesir Çeşitleri',
          'Kesirlerle Toplama ve Çıkarma',
          'Ondalık Gösterim ve Basamak Değerleri',
          'Yüzdeler',
          'Temel Geometrik Kavramlar (Nokta, Doğru, Işın)',
          'Üçgen ve Dörtgen Çeşitleri',
          'Veri Toplama ve Sıklık Tablosu',
          'Uzunluk ve Zaman Ölçme',
          'Alan Ölçme',
          'Geometrik Cisimler (Dikdörtgenler Prizması)',
        ],
      },
      {
        ders: '5. Sınıf Fen Bilimleri',
        konular: [
          'Güneş’in Yapısı ve Özellikleri',
          'Ay’ın Yapısı, Özellikleri ve Hareketleri',
          'Canlıları Tanıyalım (Bitkiler, Hayvanlar, Mantarlar, Mikroskobik Canlılar)',
          'Kuvvetin Ölçülmesi ve Dinamometre',
          'Sürtünme Kuvveti',
          'Maddenin Hâl Değişimi (Erime, Donma, Buharlaşma)',
          'Maddenin Ayırt Edici Özellikleri',
          'Isı ve Sıcaklık',
          'Işığın Yayılması ve Yansıması',
          'Işığın Maddeyle Karşılaşması ve Tam Gölge',
          'İnsan ve Çevre İlişkisi',
          'Basit Elektrik Devresi Elemanları',
        ],
      },
      {
        ders: '5. Sınıf Türkçe',
        konular: [
          'Sözcükte Anlam (Eş Anlam, Zıt Anlam, Eş Sesli)',
          'Gerçek ve Mecaz Anlam',
          'Deyimler ve Atasözleri',
          'Cümlede Anlam (Neden-Sonuç, Amaç-Sonuç, Koşul)',
          'Paragrafta Konu ve Ana Fikir',
          'Metin Türleri (Hikâye, Masal, Şiir)',
          'Büyük Harflerin Kullanımı ve Yazım Kuralları',
          'Noktalama İşaretleri (Nokta, Virgül, Soru, Ünlem)',
        ],
      },
      {
        ders: '5. Sınıf Sosyal Bilgiler',
        konular: [
          'Birey ve Toplum (Haklar ve Sorumluluklar)',
          'Kültür ve Miras (Uygarlıklar ve Doğal Varlıklarımız)',
          'İnsanlar, Yerler ve Çevreler (Harita ve İklim)',
          'Bilim, Teknoloji ve Toplum',
          'Üretim, Dağıtım ve Tüketim',
          'Etkin Vatandaşlık',
          'Küresel Bağlantılar',
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
  dailyHours?: number; // Kept for interface compatibility
  preferredTimeSlot?: string; // 'evening' | 'night' | 'morning' | 'afternoon' or custom string
}

export function generateCampScheduleItems(options: CampGeneratorOptions): Omit<ProgramOgesi, 'id'>[] {
  const { examName, selectedTopics, startDate, targetEndDate, preferredTimeSlot = 'evening' } = options;

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

  // Realistic human study slot definitions (45 dk focus sessions + breaks)
  const slotPresets: Record<string, string[]> = {
    evening: [
      '17:30 - 18:15 (45 dk)',
      '18:30 - 19:15 (45 dk)',
      '19:45 - 20:30 (45 dk)',
      '20:45 - 21:30 (45 dk)',
    ],
    night: [
      '19:30 - 20:15 (45 dk)',
      '20:30 - 21:15 (45 dk)',
      '21:30 - 22:15 (45 dk)',
      '22:30 - 23:15 (45 dk)',
    ],
    morning: [
      '10:00 - 10:45 (45 dk)',
      '11:00 - 11:45 (45 dk)',
      '13:30 - 14:15 (45 dk)',
      '14:30 - 15:15 (45 dk)',
    ],
    afternoon: [
      '14:00 - 14:45 (45 dk)',
      '15:00 - 15:45 (45 dk)',
      '16:15 - 17:00 (45 dk)',
      '17:15 - 18:00 (45 dk)',
    ],
  };

  // Determine which slots array to use
  let activeSlots = slotPresets.evening;
  const slotKey = preferredTimeSlot.toLowerCase();
  if (slotKey.includes('gece') || slotKey.includes('night') || slotKey.includes('21:') || slotKey.includes('22:')) {
    activeSlots = slotPresets.night;
  } else if (slotKey.includes('gündüz') || slotKey.includes('sabah') || slotKey.includes('morning') || slotKey.includes('10:')) {
    activeSlots = slotPresets.morning;
  } else if (slotKey.includes('öğle') || slotKey.includes('afternoon') || slotKey.includes('14:')) {
    activeSlots = slotPresets.afternoon;
  }

  // Shuffle / interleave topics pool by subject so we alternate subjects across days
  const topicsPool = [...selectedTopics];
  // Sort lightly to alternate different lessons
  const groupedByDers: Record<string, { ders: string; konu: string }[]> = {};
  topicsPool.forEach((t) => {
    if (!groupedByDers[t.ders]) groupedByDers[t.ders] = [];
    groupedByDers[t.ders].push(t);
  });

  const interleavedTopics: { ders: string; konu: string }[] = [];
  const dersKeys = Object.keys(groupedByDers);
  let maxLen = Math.max(...dersKeys.map((k) => groupedByDers[k].length));
  for (let i = 0; i < maxLen; i++) {
    dersKeys.forEach((k) => {
      if (groupedByDers[k][i]) {
        interleavedTopics.push(groupedByDers[k][i]);
      }
    });
  }

  const workingQueue = [...interleavedTopics];

  // Distribute topics realistically across available days
  for (let dayIndex = 0; dayIndex < diffDays; dayIndex++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + dayIndex);

    const dayName = dayAbbrevs[currentDate.getDay()];

    // Every 7th day is a dedicated Review & Rest / Mock test day if camp is 7+ days
    if (diffDays >= 7 && (dayIndex + 1) % 7 === 0) {
      generatedItems.push({
        ders: `${examName} Haftalık Tekrar`,
        konu: 'Haftalık Konu Tekrarı & Yanlış Havuzu Çözümü',
        saat: activeSlots[0],
        gun: dayName,
        tamamlandi: false,
        isCurrent: false,
      });
      generatedItems.push({
        ders: 'Dinlenme',
        konu: 'Zihin Dinlendirme & Motivasyon Molası',
        saat: activeSlots[1],
        gun: dayName,
        tamamlandi: false,
        isCurrent: false,
      });
      continue;
    }

    // Determine how many topics to assign today (capped at 2 or 3 per day for high cognitive efficiency)
    const remainingDays = Math.max(1, diffDays - dayIndex);
    const neededPerDay = Math.ceil(workingQueue.length / remainingDays);
    const topicsForTodayCount = Math.min(3, Math.max(1, neededPerDay));
    const daysTopics = workingQueue.splice(0, topicsForTodayCount);

    if (daysTopics.length === 0) {
      // Completed all topics early -> insert maintenance practice & problem solving
      if (dayIndex % 2 === 0) {
        generatedItems.push({
          ders: `${examName} Pekiştirme`,
          konu: 'Genel Tekrar Soru Çözümü & Formül Tekrarı',
          saat: activeSlots[0],
          gun: dayName,
          tamamlandi: false,
          isCurrent: false,
        });
      }
    } else if (daysTopics.length === 1) {
      // 1 topic today: break into 2 distinct pedagogical phases (Konu Anlatımı + Soru Çözümü)
      const t = daysTopics[0];
      generatedItems.push({
        ders: t.ders,
        konu: `${t.konu} - Konu Anlatımı & Özet`,
        saat: activeSlots[0],
        gun: dayName,
        tamamlandi: false,
        isCurrent: false,
      });
      generatedItems.push({
        ders: t.ders,
        konu: `${t.konu} - Pekiştirme Soru Çözümü (30 Soru)`,
        saat: activeSlots[1],
        gun: dayName,
        tamamlandi: false,
        isCurrent: false,
      });
    } else {
      // 2 or 3 topics today: each gets a distinct non-overlapping time slot
      daysTopics.forEach((t, tIdx) => {
        const slot = activeSlots[tIdx] || `Slot ${tIdx + 1} (45 dk)`;
        const activitySuffix = tIdx === 0 ? 'Konu Özeti & Soru Çözümü' : 'Konu Tekrarı & Pekiştirme';

        generatedItems.push({
          ders: t.ders,
          konu: `${t.konu} (${activitySuffix})`,
          saat: slot,
          gun: dayName,
          tamamlandi: false,
          isCurrent: false,
        });
      });
    }
  }

  return generatedItems;
}
