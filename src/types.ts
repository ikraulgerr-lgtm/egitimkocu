export type HataTuru = 'İşlem Hatası' | 'Kavram Yanılgısı' | 'Dikkat Eksikliği';

export interface BilgiKarti {
  id: string;
  kavram: string; // En zor 3 kavramdan birinin başlığı
  tanim: string; // Kavramın kısa, net açıklaması / kuralı
  ipucuTuzak: string; // Sınavda düşülmemesi gereken kritik tuzak veya ipucu
  zorluk: 'Zor' | 'Kritik' | 'İleri';
}

export interface VideoSahne {
  sahneNo: number;
  baslik: string;
  konusmaci: string;
  ogretmenDiyalog: string;
  ogrenciDiyalog?: string;
  analoji?: string;
  cizimAnimasyonu?: string;
  ekranMetni?: string;
}

export interface VideoSenaryosu {
  baslik: string;
  sahneler: VideoSahne[];
}

export interface CozumAdimi {
  adimNo: number;
  baslik: string;
  aciklama: string;
  isCorrect: boolean;
  hataliMetin?: string;
  dogruMetin?: string;
  analoji?: string;
  cizimAnimasyonu?: string;
  ogretmenDiyalog?: string;
  ogrenciDiyalog?: string;
}

export interface SoruKaydi {
  id: string;
  gorselUrl: string;
  ocrMetin: string;
  ders: string;
  konu: string;
  hataTuru: HataTuru;
  kritikAdimIndex: number; // e.g. 2
  sokratikIpucu: string;
  pedagojikTeshis?: string;
  sesliNot?: string; // Audio recording data URL (e.g. data:audio/webm;base64,...) or audio note URL
  voiceNotes?: Array<{ id: string; text: string; date: string }>;
  kisiselNot?: string;
  cozumAdimlari: CozumAdimi[];
  videoSenaryosu?: VideoSenaryosu;
  bilgiKartlari?: BilgiKarti[];
  siklar?: string[];
  dogruSikIndex?: number;
  ebbinghausTarihi: string; // ISO date string or YYYY-MM-DD
  olusturmaTarihi: string;
  tarih?: string;
  isSaved?: boolean;
  isSolved?: boolean;
  repeatCount?: number;
  isUnreadable?: boolean;
}

export interface Arkadas {
  id: string;
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  joinedAt?: string;
  isInvitedByMe?: boolean;
}

export interface Kullanici {
  id: string;
  ad: string;
  kredi: number;
  maxKredi: number;
  seri: number;
  xp: number;
  isPremium: boolean;
  sinif: string;
  avatarUrl: string;
  email: string;
  flashcardPractices?: number;
  nightOwlUnlocked?: boolean;
  invitedCount?: number;
  targetExam?: 'YKS' | 'LGS' | 'YDS' | 'KPSS' | 'Hazırlanmıyorum' | 'Özel';
  targetExamDate?: string;
  customExamName?: string;
  lastResetDate?: string;
}

export interface ToplulukCevap {
  id: string;
  yazarAd: string;
  avatar: string;
  metin: string;
  isAi: boolean;
  zaman: string;
  createdAt?: number;
}

export interface ToplulukSoru {
  id: string;
  userId?: string;
  yazarAd: string;
  yazarAvatar: string;
  zaman: string;
  createdAt?: number;
  ders: string;
  soruMetni: string;
  gorselUrl?: string;
  cevapSayisi: number;
  hasAiAnswer: boolean;
  begeniSayisi: number;
  isLiked?: boolean;
  askTarget?: 'ai_and_community' | 'community_only';
  cevaplar?: ToplulukCevap[];
}

export interface ProgramOgesi {
  id: string;
  saat: string;
  ders: string;
  konu: string;
  tamamlandi: boolean;
  isCurrent?: boolean;
  gun: string; // 'Pzt' | 'Sal' | etc.
}

export interface DenemeDersResult {
  dersAdi: string;
  dogru: number;
  yanlis: number;
  bos: number;
  net: number;
}

export interface DenemeRecord {
  id: string;
  sinavTuru: 'TYT' | 'AYT' | 'LGS' | 'YDT' | 'KPSS' | 'Diğer';
  yayinEvi: string;
  tarih: string; // ISO or YYYY-MM-DD
  dersler: DenemeDersResult[];
  toplamNet: number;
  notlar?: string;
  createdAt: number;
}

export type ActiveTab = 
  | 'home' 
  | 'solution' 
  | 'errorPool' 
  | 'community' 
  | 'stats' 
  | 'leaderboard' 
  | 'schedule' 
  | 'profile' 
  | 'settings' 
  | 'auth'
  | 'deneme';

export interface Bildirim {
  id: string;
  type: 'pomo_invite' | 'friend_request' | 'system' | 'cheer' | 'daily_goal' | 'error_pool' | 'streak' | 'weekly_report' | 'exam_alert';
  title: string;
  message: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  recipientId?: string;
  recipientName?: string;
  roomCode?: string;
  roomTitle?: string;
  createdAt: string;
  read: boolean;
  isSenderCopy?: boolean;
}
