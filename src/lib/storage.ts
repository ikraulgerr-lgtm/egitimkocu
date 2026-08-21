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

export const INITIAL_USER: Kullanici = {
  id: 'usr_new',
  ad: 'Yeni Öğrenci',
  kullaniciAdi: 'ogrenci',
  kullaniciAdi_lower: 'ogrenci',
  email: 'ogrenci@egitimkocum.ai',
  kredi: 10,
  maxKredi: 10,
  seri: 1,
  xp: 0,
  isPremium: false,
  sinif: 'YKS / LGS Hazırlık',
  avatarUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
  targetExam: 'YKS',
  targetExamDate: '2027-06-19',
  customExamName: '',
};

export const INITIAL_FRIENDS: Arkadas[] = [];
export const INITIAL_QUESTIONS: SoruKaydi[] = [];
export const INITIAL_SCHEDULE: ProgramOgesi[] = [];
export const INITIAL_DENEMELER: DenemeRecord[] = [];

export const INITIAL_COMMUNITY: ToplulukSoru[] = [
  {
    id: 'c_welcome',
    yazarAd: 'Eğitim Koçum AI Rehberlik',
    kullaniciAdi: 'rehberlik_ai',
    yazarAvatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
    zaman: '15 dk önce',
    createdAt: Date.now() - 1000 * 60 * 15,
    ders: 'Genel Rehberlik',
    soruMetni: 'Eğitim Koçum AI sistemine hoş geldin! Takıldığın soruların fotoğrafını çekip atabilir ya da metin olarak yazarak pedagojik AI analizi alabilirsin.',
    cevapSayisi: 1,
    hasAiAnswer: true,
    begeniSayisi: 3,
    isLiked: false,
    cevaplar: [
      {
        id: 'ans_welcome',
        yazarAd: 'Eğitim Koçum AI Pedagoji',
        kullaniciAdi: 'pedagoji_ai',
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
        metin: 'Soru analizi başlatmak için ana sayfadaki kamera veya metin alanını kullanabilirsin.',
        isAi: true,
        zaman: '14 dk önce',
        createdAt: Date.now() - 1000 * 60 * 14,
      },
    ],
  },
];

export function resetToCleanState(userId?: string): Kullanici {
  const userKey = getScopedKey(BASE_USER_KEY, userId);
  const qKey = getScopedKey(BASE_QUESTIONS_KEY, userId);
  const sKey = getScopedKey(BASE_SCHEDULE_KEY, userId);
  const fKey = getScopedKey(BASE_FRIENDS_KEY, userId);
  const dKey = getScopedKey(BASE_DENEME_KEY, userId);

  localStorage.setItem(userKey, JSON.stringify(INITIAL_USER));
  localStorage.setItem(qKey, JSON.stringify(INITIAL_QUESTIONS));
  localStorage.setItem(sKey, JSON.stringify(INITIAL_SCHEDULE));
  localStorage.setItem(fKey, JSON.stringify(INITIAL_FRIENDS));
  localStorage.setItem(dKey, JSON.stringify(INITIAL_DENEMELER));
  return { ...INITIAL_USER };
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
    const initialUserWithReset = { ...INITIAL_USER, lastResetDate: todayTr };
    localStorage.setItem(key, JSON.stringify(initialUserWithReset));
    return initialUserWithReset;
  }
  try {
    const parsed = JSON.parse(data);
    const user: Kullanici = {
      ...INITIAL_USER,
      ...parsed,
      ad: parsed.ad && parsed.ad !== 'Selin Yılmaz' ? parsed.ad : 'Öğrenci',
      kullaniciAdi: parsed.kullaniciAdi || 'ogrenci',
      kullaniciAdi_lower: (parsed.kullaniciAdi || 'ogrenci').toLowerCase(),
      targetExam: parsed.targetExam || 'YKS',
      targetExamDate: parsed.targetExamDate || '2027-06-19',
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
    return { ...INITIAL_USER, lastResetDate: todayTr };
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
    return JSON.parse(data);
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
