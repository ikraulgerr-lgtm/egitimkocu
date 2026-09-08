import { Kullanici, SoruKaydi, ToplulukSoru, ProgramOgesi, Arkadas, DenemeRecord } from '../types';
import { sanitizeObjectMath } from './mathUtils';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';

const BASE_USER_KEY = 'edumind_user';
const BASE_QUESTIONS_KEY = 'edumind_questions';
const BASE_COMMUNITY_KEY = 'edumind_community';
const BASE_SCHEDULE_KEY = 'edumind_schedule';
const BASE_THEME_KEY = 'edumind_theme';
const BASE_FRIENDS_KEY = 'edumind_friends';
const BASE_DENEME_KEY = 'edumind_deneme';

export function getScopedKey(baseKey: string, userId?: string): string {
  const uid = userId || auth.currentUser?.uid;
  if (!uid) return baseKey;
  return `${baseKey}_${uid}`;
}

export const EMPTY_USER: Kullanici = {
  id: '',
  ad: '',
  kullaniciAdi: '',
  kullaniciAdi_lower: '',
  email: '',
  kredi: 10,
  maxKredi: 10,
  seri: 1,
  xp: 0,
  isPremium: false,
  sinif: '',
  avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
  targetExam: '' as any,
  targetExamDate: '',
  customExamName: '',
};

export const INITIAL_USER: Kullanici = EMPTY_USER;

export const INITIAL_FRIENDS: Arkadas[] = [];
export const INITIAL_QUESTIONS: SoruKaydi[] = [];
export const INITIAL_SCHEDULE: ProgramOgesi[] = [];
export const INITIAL_DENEMELER: DenemeRecord[] = [];

const nowMs = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

export const INITIAL_COMMUNITY: ToplulukSoru[] = [
  {
    id: 'c_welcome',
    yazarAd: 'Eğitim Koçum AI Rehberlik',
    kullaniciAdi: 'rehberlik_ai',
    yazarAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
    zaman: '10 dk önce',
    createdAt: nowMs - 1000 * 60 * 10,
    ders: 'Genel Rehberlik',
    soruMetni: 'Eğitim Koçum AI topluluğuna hoş geldin! Takıldığın soruların fotoğrafını çekip sorabilir, diğer öğrencilerin sorularını inceleyebilir ve yapay zeka pedagoji asistanından anında çözüm adımları alabilirsin.',
    cevapSayisi: 1,
    hasAiAnswer: true,
    begeniSayisi: 12,
    isLiked: false,
    cevaplar: [
      {
        id: 'ans_welcome',
        yazarAd: 'Eğitim Koçum AI Pedagoji',
        kullaniciAdi: 'pedagoji_ai',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
        metin: 'Soru analizi başlatmak için ana sayfadaki kamera veya metin alanını kullanabilir, toplulukta paylaşarak tartışabilirsin.',
        isAi: true,
        zaman: '9 dk önce',
        createdAt: nowMs - 1000 * 60 * 9,
      },
    ],
  },
  {
    id: 'c_math_1',
    yazarAd: 'Zeynep Kaya',
    kullaniciAdi: 'zeynep_yks',
    yazarAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=ZeynepKaya&backgroundColor=ec4899',
    zaman: '3 saat önce',
    createdAt: nowMs - 1000 * 60 * 60 * 3,
    ders: 'Matematik',
    soruMetni: 'f(x) = x³ - 3x² + 4 fonksiyonunun yerel ekstremum noktalarını bulurken türevin köklerini tabloya yerleştirdim ama işaret incelemesinde takıldım. Yardımcı olur musunuz?',
    cevapSayisi: 2,
    hasAiAnswer: true,
    begeniSayisi: 8,
    isLiked: false,
    cevaplar: [
      {
        id: 'ans_math_ai',
        yazarAd: 'Eğitim Koçum AI',
        kullaniciAdi: 'ai_asistan',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
        metin: '💡 f\'(x) = 3x² - 6x = 3x(x - 2) olur. Kökler x = 0 ve x = 2\'dir. Başkatsayı pozitif olduğu için tablodaki işaret dizilimi: (+, -, +) şeklinde ilerler. x = 0 yerel maksimum, x = 2 yerel minimum noktasıdır.',
        isAi: true,
        zaman: '2 saat önce',
        createdAt: nowMs - 1000 * 60 * 60 * 2,
      },
      {
        id: 'ans_math_user',
        yazarAd: 'Emre Demir',
        kullaniciAdi: 'emredemir_99',
        avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=EmreDemir&backgroundColor=3b82f6',
        metin: 'Evet yapay zekanın yazdığı gibi, başkatsayı işaretine bakıp en sağdan + ile başlaman gerekiyor.',
        isAi: false,
        zaman: '1 saat önce',
        createdAt: nowMs - 1000 * 60 * 60 * 1,
      },
    ],
  },
  {
    id: 'c_phys_1',
    yazarAd: 'Burak Yıldız',
    kullaniciAdi: 'burak_fizik',
    yazarAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=BurakYildiz&backgroundColor=10b981',
    zaman: '2 gün önce',
    createdAt: nowMs - dayMs * 2,
    ders: 'Fizik',
    soruMetni: 'Yerden v₀ hızıyla eğik atılan bir cismin menzili maksimum olduğunda atış açısı kaç derecedir ve tepe noktasındaki ivmesi nedir?',
    cevapSayisi: 1,
    hasAiAnswer: true,
    begeniSayisi: 15,
    isLiked: false,
    cevaplar: [
      {
        id: 'ans_phys_ai',
        yazarAd: 'Eğitim Koçum AI',
        kullaniciAdi: 'ai_asistan',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
        metin: 'Maksimum menzil sin(2θ)=1 olduğunda yani atış açısı θ = 45° olduğunda gerçekleşir. Tepe noktasında hız sıfır değil, sadece yatay hız bileşeni vardır (vx = v₀·cos45°). İvme ise hareket boyunca sabittir ve yerçekimi ivmesi g = 9.8 m/s² (aşağı yönlü) dir.',
        isAi: true,
        zaman: '2 gün önce',
        createdAt: nowMs - dayMs * 2 + 1000 * 60 * 5,
      },
    ],
  },
  {
    id: 'c_chem_1',
    yazarAd: 'Elif Şahin',
    kullaniciAdi: 'elif_kimya',
    yazarAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=ElifSahin&backgroundColor=f59e0b',
    zaman: '5 gün önce',
    createdAt: nowMs - dayMs * 5,
    ders: 'Kimya',
    soruMetni: 'Normal şartlar altında (NŞA) 5.6 litre hacim kaplayan CH₄ gazı kaç moldür ve kaç gramdır? (C:12, H:1)',
    cevapSayisi: 1,
    hasAiAnswer: true,
    begeniSayisi: 9,
    isLiked: false,
    cevaplar: [
      {
        id: 'ans_chem_ai',
        yazarAd: 'Eğitim Koçum AI',
        kullaniciAdi: 'ai_asistan',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
        metin: '1. Adım: NŞA\'da 1 mol gaz 22.4 litredir. n = V / 22.4 = 5.6 / 22.4 = 0.25 mol CH₄.\n2. Adım: CH₄ mol kütlesi = 12 + (4 × 1) = 16 g/mol.\n3. Adım: m = n × M_A = 0.25 × 16 = 4 gramdır.',
        isAi: true,
        zaman: '5 gün önce',
        createdAt: nowMs - dayMs * 5 + 1000 * 60 * 8,
      },
    ],
  },
  {
    id: 'c_bio_1',
    yazarAd: 'Canberk Arslan',
    kullaniciAdi: 'canberk_bio',
    yazarAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=CanberkArslan&backgroundColor=8b5cf6',
    zaman: '12 gün önce',
    createdAt: nowMs - dayMs * 12,
    ders: 'Biyoloji',
    soruMetni: 'Mitoz bölünme ile Mayoz bölünme arasındaki en temel farklar nelerdir? Sınavda hangi öncüllere dikkat etmeliyiz?',
    cevapSayisi: 1,
    hasAiAnswer: true,
    begeniSayisi: 19,
    isLiked: false,
    cevaplar: [
      {
        id: 'ans_bio_ai',
        yazarAd: 'Eğitim Koçum AI',
        kullaniciAdi: 'ai_asistan',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
        metin: '🌱 1. Kromozom Sayısı: Mitozda korunur (2n → 2n), Mayozda yarıya iner (2n → n).\n🌱 2. Çeşitlilik: Mayozda krossing-over ve homolog kromozomların rastgele dağılımı genetik çeşitlilik sağlar. Mitozda mutasyon yoksa kalıtsal çeşitlilik oluşmaz.\n🌱 3. Oluşan Hücre: Mitozda 2, mayozda 4 hücre oluşur.',
        isAi: true,
        zaman: '12 gün önce',
        createdAt: nowMs - dayMs * 12 + 1000 * 60 * 15,
      },
    ],
  },
  {
    id: 'c_turk_1',
    yazarAd: 'Selin Doğan',
    kullaniciAdi: 'selin_turkce',
    yazarAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=SelinDogan&backgroundColor=06b6d4',
    zaman: '25 gün önce',
    createdAt: nowMs - dayMs * 25,
    ders: 'Türkçe',
    soruMetni: '"Kitap okumak, zihnin en verimli egzersizidir." cümlesinin yükleminin türüne ve yapısına göre özellikleri nelerdir?',
    cevapSayisi: 1,
    hasAiAnswer: true,
    begeniSayisi: 14,
    isLiked: false,
    cevaplar: [
      {
        id: 'ans_turk_ai',
        yazarAd: 'Eğitim Koçum AI',
        kullaniciAdi: 'ai_asistan',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
        metin: '1. Yüklemin Türüne Göre: "zihnin en verimli egzersizidir" bir isim tamlamasıdır, dolayısıyla İsim (Ad) cümlesidir.\n2. Cümle Yapısına Göre: İçinde "okumak" fiilimsisi (isim-fiil) bulunduğu için Girişik Birleşik Cümledir.\n3. Öğe Dizilişine Göre: Yüklem sonda olduğu için Kurallı cümledir.',
        isAi: true,
        zaman: '25 gün önce',
        createdAt: nowMs - dayMs * 25 + 1000 * 60 * 20,
      },
    ],
  },
  {
    id: 'c_hist_1',
    yazarAd: 'Ahmet Öztürk',
    kullaniciAdi: 'ahmet_tarih',
    yazarAvatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=AhmetOzturk&backgroundColor=ef4444',
    zaman: '45 gün önce',
    createdAt: nowMs - dayMs * 45,
    ders: 'Tarih',
    soruMetni: 'Amasya Genelgesi\'nde yer alan "Milletin bağımsızlığını yine milletin azim ve kararı kurtaracaktır" maddesi neden bir ihtilal bildirisi niteliğindedir?',
    cevapSayisi: 1,
    hasAiAnswer: true,
    begeniSayisi: 22,
    isLiked: false,
    cevaplar: [
      {
        id: 'ans_hist_ai',
        yazarAd: 'Eğitim Koçum AI',
        kullaniciAdi: 'ai_asistan',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
        metin: 'Bu madde Kurtuluş Savaşı\'nın yöntemini ve amacını belirler. Aynı zamanda millet iradesine vurgu yaparak Osmanlı saltanat yönetimine karşı ilk kez halk egemenliğini öne çıkardığı için demokratik bir ihtilal çağrısı ve ulusal egemenliğin ilk adımıdır.',
        isAi: true,
        zaman: '45 gün önce',
        createdAt: nowMs - dayMs * 45 + 1000 * 60 * 30,
      },
    ],
  },
];

export function resetToCleanState(userId?: string): Kullanici {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('edumind_') || k.startsWith('active_pomo') || k.startsWith('completed_pomo'))) {
        // PRESERVE GLOBAL COMMUNITY AND THEME ACROSS LOGOUTS
        if (k !== BASE_THEME_KEY && k !== BASE_COMMUNITY_KEY) {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem('active_pomo_group_room');
    localStorage.removeItem('completed_pomodoros_count');
    localStorage.removeItem(BASE_USER_KEY);
    if (userId) {
      localStorage.removeItem(getScopedKey(BASE_USER_KEY, userId));
    }
  } catch (e) {
    console.warn('Error clearing localStorage on reset:', e);
  }
  return { ...EMPTY_USER };
}

export function getFriends(userId?: string): Arkadas[] {
  const key = getScopedKey(BASE_FRIENDS_KEY, userId);
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(INITIAL_FRIENDS));
    return INITIAL_FRIENDS;
  }
  try {
    const parsed: Arkadas[] = JSON.parse(data);
    if (Array.isArray(parsed)) {
      const mockIds = ['f_1', 'f_2', 'f_3', 'f_4', 'f_5'];
      const cleaned = parsed.filter((f) => !mockIds.includes(f.id));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(key, JSON.stringify(cleaned));
      }
      return cleaned;
    }
    return INITIAL_FRIENDS;
  } catch {
    return INITIAL_FRIENDS;
  }
}

export function saveFriends(friends: Arkadas[], userId?: string): void {
  const key = getScopedKey(BASE_FRIENDS_KEY, userId);
  localStorage.setItem(key, JSON.stringify(friends));
}

export function addFriend(friend: Arkadas, userId?: string): Arkadas[] {
  const friends = getFriends(userId);
  const exists = friends.some(
    (f) =>
      f.id === friend.id ||
      (f.name.toLowerCase() === friend.name.toLowerCase() && f.avatar === friend.avatar) ||
      (friend.kullaniciAdi && f.kullaniciAdi && f.kullaniciAdi.toLowerCase() === friend.kullaniciAdi.toLowerCase())
  );
  if (!exists) {
    const updated = [friend, ...friends];
    saveFriends(updated, userId);
    const uid = userId || auth.currentUser?.uid;
    if (uid) {
      const path = `users/${uid}/friends/${friend.id}`;
      setDoc(doc(db, 'users', uid, 'friends', friend.id), {
        ...friend,
        userId: uid,
      }, { merge: true }).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, path);
      });
    }
    return updated;
  }
  return friends;
}

export function removeFriend(friendId: string, userId?: string): Arkadas[] {
  const friends = getFriends(userId);
  const updated = friends.filter((f) => f.id !== friendId);
  saveFriends(updated, userId);
  const uid = userId || auth.currentUser?.uid;
  if (uid) {
    const path = `users/${uid}/friends/${friendId}`;
    deleteDoc(doc(db, 'users', uid, 'friends', friendId)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, path);
    });
  }
  return updated;
}

import { getTurkeyDateString } from './dateUtils';

export function getUser(userId?: string): Kullanici {
  const key = getScopedKey(BASE_USER_KEY, userId);
  const data = localStorage.getItem(key);
  const todayTr = getTurkeyDateString();

  if (!data) {
    return { ...EMPTY_USER, lastResetDate: todayTr };
  }
  try {
    const parsed = JSON.parse(data);
    if (!parsed || !parsed.id || !parsed.email || parsed.id === 'usr_new' || parsed.id === 'student') {
      return { ...EMPTY_USER, lastResetDate: todayTr };
    }
    const user: Kullanici = {
      ...EMPTY_USER,
      ...parsed,
      ad: parsed.ad || '',
      kullaniciAdi: parsed.kullaniciAdi || '',
      kullaniciAdi_lower: (parsed.kullaniciAdi || '').toLowerCase(),
      targetExam: parsed.targetExam || '',
      targetExamDate: parsed.targetExamDate || '',
      customExamName: parsed.customExamName || '',
      lastResetDate: parsed.lastResetDate || todayTr,
    };

    if (user.lastResetDate !== todayTr) {
      user.kredi = 10;
      user.maxKredi = 10;
      user.lastResetDate = todayTr;
      localStorage.setItem(key, JSON.stringify(user));
    }

    if (!user.isPremium && user.kredi > 10) {
      user.kredi = 10;
    }
    return user;
  } catch {
    return { ...EMPTY_USER, lastResetDate: todayTr };
  }
}

export function saveUser(user: Kullanici, userId?: string): void {
  if (!user.isPremium && user.kredi > 10) {
    user.kredi = 10;
  }
  const key = getScopedKey(BASE_USER_KEY, userId || user.id);
  localStorage.setItem(key, JSON.stringify(user));

  const uid = userId || auth.currentUser?.uid || user.id;
  if (uid && !uid.startsWith('usr_new')) {
    const path = `users/${uid}`;
    const cleanUser = JSON.parse(JSON.stringify({
      ...user,
      kullaniciAdi_lower: (user.kullaniciAdi || '').toLowerCase(),
      updatedAt: new Date().toISOString(),
    }));
    setDoc(doc(db, 'users', uid), cleanUser, { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, path);
    });
  }
}

export function addCredits(amount: number, userId?: string): Kullanici {
  const user = getUser(userId);
  const maxLimit = user.isPremium ? 999 : 10;
  user.kredi = Math.min(maxLimit, user.kredi + amount);
  saveUser(user, userId);
  return user;
}

export function getQuestions(userId?: string): SoruKaydi[] {
  const qKey = getScopedKey(BASE_QUESTIONS_KEY, userId);
  const rawData = localStorage.getItem(qKey);

  if (!rawData) {
    return INITIAL_QUESTIONS;
  }

  try {
    const parsed = JSON.parse(rawData);
    if (Array.isArray(parsed)) {
      const cleaned = parsed
        .filter((q) => {
          const id = (q.id || '').toLowerCase();
          const isLegacyDemo = id === 'q_001' || id === 'q_002' || id === 'q_mock_test';
          return !isLegacyDemo;
        })
        .map((q) => sanitizeObjectMath(q));
      return cleaned;
    }
    return [];
  } catch {
    return [];
  }
}

export function stripHeavyImages(q: SoruKaydi): SoruKaydi {
  const copy = { ...q };
  if (copy.gorselUrl && (copy.gorselUrl.startsWith('data:image') || copy.gorselUrl.length > 500)) {
    copy.gorselUrl = '';
  }
  return copy;
}

export function saveQuestions(questions: SoruKaydi[], userId?: string): void {
  const sanitized = questions.map((q) => sanitizeObjectMath(stripHeavyImages(q)));
  const qKey = getScopedKey(BASE_QUESTIONS_KEY, userId);
  localStorage.setItem(qKey, JSON.stringify(sanitized));

  const uid = userId || auth.currentUser?.uid;
  if (uid) {
    sanitized.forEach((sanitizedQuestion) => {
      const path = `users/${uid}/questions/${sanitizedQuestion.id}`;
      const firestoreData = JSON.parse(JSON.stringify({
        ...sanitizedQuestion,
        userId: uid,
      }));
      setDoc(doc(db, 'users', uid, 'questions', sanitizedQuestion.id), firestoreData, { merge: true }).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, path);
      });
    });
  }
}

export function saveQuestion(question: SoruKaydi, userId?: string): SoruKaydi[] {
  const list = getQuestions(userId);
  const sanitizedQuestion = sanitizeObjectMath(stripHeavyImages(question));
  const index = list.findIndex((q) => q.id === sanitizedQuestion.id);
  if (index >= 0) {
    list[index] = sanitizedQuestion;
  } else {
    list.unshift(sanitizedQuestion);
  }
  saveQuestions(list, userId);
  return list;
}

export function deleteQuestion(id: string, userId?: string): SoruKaydi[] {
  const list = getQuestions(userId).filter((q) => q.id !== id);
  const qKey = getScopedKey(BASE_QUESTIONS_KEY, userId);
  localStorage.setItem(qKey, JSON.stringify(list));

  const uid = userId || auth.currentUser?.uid;
  if (uid) {
    const path = `users/${uid}/questions/${id}`;
    deleteDoc(doc(db, 'users', uid, 'questions', id)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, path);
    });
  }

  return list;
}

export function getCommunityPosts(): ToplulukSoru[] {
  const data = localStorage.getItem(BASE_COMMUNITY_KEY);
  if (!data) {
    localStorage.setItem(BASE_COMMUNITY_KEY, JSON.stringify(INITIAL_COMMUNITY));
    return INITIAL_COMMUNITY;
  }
  try {
    const parsed: ToplulukSoru[] = JSON.parse(data);
    if (Array.isArray(parsed)) {
      const existingIds = new Set(parsed.map((p) => p.id));
      const merged = [...parsed];
      INITIAL_COMMUNITY.forEach((initPost) => {
        if (!existingIds.has(initPost.id)) {
          merged.push(initPost);
        }
      });
      merged.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return merged;
    }
    return INITIAL_COMMUNITY;
  } catch {
    return INITIAL_COMMUNITY;
  }
}

export const getPosts = getCommunityPosts;

export function savePosts(posts: ToplulukSoru[]): void {
  localStorage.setItem(BASE_COMMUNITY_KEY, JSON.stringify(posts));
}

export function saveCommunityPost(post: ToplulukSoru): ToplulukSoru[] {
  const posts = getCommunityPosts();
  posts.unshift(post);
  localStorage.setItem(BASE_COMMUNITY_KEY, JSON.stringify(posts));

  if (auth.currentUser) {
    const path = `community/${post.id}`;
    setDoc(doc(db, 'community', post.id), {
      ...post,
      userId: auth.currentUser.uid,
    }, { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, path);
    });
  }

  return posts;
}

export function toggleLikeCommunityPost(id: string): ToplulukSoru[] {
  const posts = getCommunityPosts();
  const post = posts.find((p) => p.id === id);
  if (post) {
    post.isLiked = !post.isLiked;
    post.begeniSayisi += post.isLiked ? 1 : -1;
    localStorage.setItem(BASE_COMMUNITY_KEY, JSON.stringify(posts));
  }
  return posts;
}

export function getSchedule(userId?: string): ProgramOgesi[] {
  const key = getScopedKey(BASE_SCHEDULE_KEY, userId);
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(INITIAL_SCHEDULE));
    return INITIAL_SCHEDULE;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_SCHEDULE;
  }
}

export function saveSchedule(schedule: ProgramOgesi[], userId?: string): void {
  const key = getScopedKey(BASE_SCHEDULE_KEY, userId);
  localStorage.setItem(key, JSON.stringify(schedule));
  const uid = userId || auth.currentUser?.uid;
  if (uid) {
    schedule.forEach((item) => {
      const path = `users/${uid}/schedule/${item.id}`;
      setDoc(doc(db, 'users', uid, 'schedule', item.id), {
        ...item,
        userId: uid,
      }, { merge: true }).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, path);
      });
    });
  }
}

export function toggleScheduleItem(id: string, userId?: string): ProgramOgesi[] {
  const items = getSchedule(userId);
  const item = items.find((i) => i.id === id);
  if (item) {
    item.tamamlandi = !item.tamamlandi;
    saveSchedule(items, userId);
  }
  return items;
}

export function saveScheduleLocally(schedule: ProgramOgesi[], userId?: string): void {
  const key = getScopedKey(BASE_SCHEDULE_KEY, userId);
  localStorage.setItem(key, JSON.stringify(schedule));
}

export function deleteScheduleItem(id: string, userId?: string): ProgramOgesi[] {
  const items = getSchedule(userId).filter((i) => i.id !== id);
  saveScheduleLocally(items, userId);
  const uid = userId || auth.currentUser?.uid;
  if (uid) {
    const path = `users/${uid}/schedule/${id}`;
    deleteDoc(doc(db, 'users', uid, 'schedule', id)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, path);
    });
  }
  return items;
}

export function getTheme(): 'light' | 'dark' {
  const theme = localStorage.getItem(BASE_THEME_KEY);
  if (theme === 'dark' || theme === 'light') return theme;
  return 'light';
}

export function saveTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem(BASE_THEME_KEY, theme);
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  }
}

export const setTheme = saveTheme;

export function saveDenemelerLocally(denemeler: DenemeRecord[], userId?: string): void {
  const key = getScopedKey(BASE_DENEME_KEY, userId);
  localStorage.setItem(key, JSON.stringify(denemeler));
}

export function getDenemeler(userId?: string): DenemeRecord[] {
  const key = getScopedKey(BASE_DENEME_KEY, userId);
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify([]));
    return [];
  }
  try {
    const parsed: DenemeRecord[] = JSON.parse(data);
    const cleaned = parsed.filter((item) => item.id !== 'd_1' && item.id !== 'd_2');
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveDeneme(deneme: DenemeRecord, userId?: string): DenemeRecord[] {
  const existing = getDenemeler(userId);
  const index = existing.findIndex((d) => d.id === deneme.id);
  let updated: DenemeRecord[];
  if (index >= 0) {
    updated = [...existing];
    updated[index] = deneme;
  } else {
    updated = [deneme, ...existing];
  }
  saveDenemelerLocally(updated, userId);

  const uid = userId || auth.currentUser?.uid;
  if (uid) {
    const path = `users/${uid}/denemeler/${deneme.id}`;
    const safeData = JSON.parse(JSON.stringify({
      ...deneme,
      userId: uid,
      notlar: deneme.notlar || '',
    }));
    setDoc(doc(db, 'users', uid, 'denemeler', deneme.id), safeData, { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, path);
    });
  }

  return updated;
}

export function deleteDeneme(id: string, userId?: string): DenemeRecord[] {
  const existing = getDenemeler(userId);
  const updated = existing.filter((d) => d.id !== id);
  saveDenemelerLocally(updated, userId);

  const uid = userId || auth.currentUser?.uid;
  if (uid) {
    const path = `users/${uid}/denemeler/${id}`;
    deleteDoc(doc(db, 'users', uid, 'denemeler', id)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, path);
    });
  }

  return updated;
}
