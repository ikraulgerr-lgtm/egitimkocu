import { Kullanici, SoruKaydi, ToplulukSoru, ProgramOgesi, Arkadas, DenemeRecord } from '../types';
import { sanitizeObjectMath } from './mathUtils';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';

const USER_KEY = 'edumind_user';
const QUESTIONS_KEY = 'edumind_questions';
const COMMUNITY_KEY = 'edumind_community';
const SCHEDULE_KEY = 'edumind_schedule';
const THEME_KEY = 'edumind_theme';
const FRIENDS_KEY = 'edumind_friends';
const DENEME_KEY = 'edumind_deneme';

const INITIAL_USER: Kullanici = {
  id: 'usr_new',
  ad: 'Yeni Öğrenci',
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

const INITIAL_FRIENDS: Arkadas[] = [];

const INITIAL_QUESTIONS: SoruKaydi[] = [];

const INITIAL_COMMUNITY: ToplulukSoru[] = [
  {
    id: 'c_welcome',
    yazarAd: 'Eğitim Koçum AI Rehberlik',
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
        avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&q=80',
        metin: 'Soru analizi başlatmak için ana sayfadaki kamera veya metin alanını kullanabilirsin.',
        isAi: true,
        zaman: '14 dk önce',
        createdAt: Date.now() - 1000 * 60 * 14,
      },
    ],
  },
];

const INITIAL_SCHEDULE: ProgramOgesi[] = [];

export function resetToCleanState(): Kullanici {
  localStorage.setItem(USER_KEY, JSON.stringify(INITIAL_USER));
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(INITIAL_QUESTIONS));
  localStorage.setItem(COMMUNITY_KEY, JSON.stringify(INITIAL_COMMUNITY));
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(INITIAL_SCHEDULE));
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(INITIAL_FRIENDS));
  return { ...INITIAL_USER };
}

export function getFriends(): Arkadas[] {
  const data = localStorage.getItem(FRIENDS_KEY);
  if (!data) {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(INITIAL_FRIENDS));
    return INITIAL_FRIENDS;
  }
  try {
    const parsed: Arkadas[] = JSON.parse(data);
    if (Array.isArray(parsed)) {
      // Clean out any legacy mock friends
      const mockIds = ['f_1', 'f_2', 'f_3', 'f_4', 'f_5'];
      const cleaned = parsed.filter((f) => !mockIds.includes(f.id));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(FRIENDS_KEY, JSON.stringify(cleaned));
      }
      return cleaned;
    }
    return INITIAL_FRIENDS;
  } catch {
    return INITIAL_FRIENDS;
  }
}

export function saveFriends(friends: Arkadas[]): void {
  localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
}

export function addFriend(friend: Arkadas): Arkadas[] {
  const friends = getFriends();
  const exists = friends.some((f) => f.id === friend.id || (f.name.toLowerCase() === friend.name.toLowerCase() && f.avatar === friend.avatar));
  if (!exists) {
    const updated = [friend, ...friends];
    saveFriends(updated);
    if (auth.currentUser) {
      const path = `users/${auth.currentUser.uid}/friends/${friend.id}`;
      setDoc(doc(db, 'users', auth.currentUser.uid, 'friends', friend.id), {
        ...friend,
        userId: auth.currentUser.uid,
      }, { merge: true }).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, path);
      });
    }
    return updated;
  }
  return friends;
}

export function removeFriend(friendId: string): Arkadas[] {
  const friends = getFriends();
  const updated = friends.filter((f) => f.id !== friendId);
  saveFriends(updated);
  if (auth.currentUser) {
    const path = `users/${auth.currentUser.uid}/friends/${friendId}`;
    deleteDoc(doc(db, 'users', auth.currentUser.uid, 'friends', friendId)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, path);
    });
  }
  return updated;
}

import { getTurkeyDateString } from './dateUtils';

export function getUser(): Kullanici {
  const data = localStorage.getItem(USER_KEY);
  const todayTr = getTurkeyDateString();

  if (!data) {
    const initialUserWithReset = { ...INITIAL_USER, lastResetDate: todayTr };
    localStorage.setItem(USER_KEY, JSON.stringify(initialUserWithReset));
    return initialUserWithReset;
  }
  try {
    const parsed = JSON.parse(data);
    const user: Kullanici = {
      ...INITIAL_USER,
      ...parsed,
      ad: parsed.ad && parsed.ad !== 'Selin Yılmaz' ? parsed.ad : 'Öğrenci',
      targetExam: parsed.targetExam || 'YKS',
      targetExamDate: parsed.targetExamDate || '2027-06-19',
      customExamName: parsed.customExamName || '',
      lastResetDate: parsed.lastResetDate || todayTr,
    };

    // Midnight 00:00 Turkey Time reset check
    if (user.lastResetDate !== todayTr) {
      user.kredi = 10;
      user.maxKredi = 10;
      user.lastResetDate = todayTr;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    if (!user.isPremium && user.kredi > 10) {
      user.kredi = 10;
    }
    return user;
  } catch {
    return { ...INITIAL_USER, lastResetDate: todayTr };
  }
}

export function saveUser(user: Kullanici): void {
  // Enforce max 10 credits limit for non-premium users
  if (!user.isPremium && user.kredi > 10) {
    user.kredi = 10;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (auth.currentUser) {
    const path = `users/${auth.currentUser.uid}`;
    setDoc(doc(db, 'users', auth.currentUser.uid), user, { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, path);
    });
  }
}

export function addCredits(amount: number): Kullanici {
  const user = getUser();
  const maxLimit = user.isPremium ? 999 : 10;
  user.kredi = Math.min(maxLimit, user.kredi + amount);
  saveUser(user);
  return user;
}

const QUESTIONS_BACKUP_KEY = 'edumind_questions_permanent_backup';
const QUESTIONS_ARCHIVE_KEY = 'edumind_questions_archive_mirror';

export function getQuestions(): SoruKaydi[] {
  let rawData = localStorage.getItem(QUESTIONS_KEY);

  // Auto-recovery: If primary is empty or missing, recover from permanent backup or archive
  if (!rawData || rawData === '[]') {
    rawData = localStorage.getItem(QUESTIONS_BACKUP_KEY) || localStorage.getItem(QUESTIONS_ARCHIVE_KEY);
    if (rawData && rawData !== '[]') {
      localStorage.setItem(QUESTIONS_KEY, rawData);
    }
  }

  if (!rawData) {
    localStorage.setItem(QUESTIONS_KEY, JSON.stringify(INITIAL_QUESTIONS));
    return INITIAL_QUESTIONS;
  }

  try {
    const parsed = JSON.parse(rawData);
    if (Array.isArray(parsed)) {
      // Only filter out ancient legacy demo mocks (never filter real student questions)
      const cleaned = parsed
        .filter((q) => {
          const id = (q.id || '').toLowerCase();
          const isLegacyDemo = id === 'q_001' || id === 'q_002' || id === 'q_mock_test';
          return !isLegacyDemo;
        })
        .map((q) => sanitizeObjectMath(q));

      // Always maintain permanent backups
      localStorage.setItem(QUESTIONS_KEY, JSON.stringify(cleaned));
      if (cleaned.length > 0) {
        localStorage.setItem(QUESTIONS_BACKUP_KEY, JSON.stringify(cleaned));
        localStorage.setItem(QUESTIONS_ARCHIVE_KEY, JSON.stringify(cleaned));
      }
      return cleaned;
    }
    return [];
  } catch {
    // If JSON parsing fails, attempt recovery from backup
    const backupRaw = localStorage.getItem(QUESTIONS_BACKUP_KEY);
    if (backupRaw) {
      try {
        const backupParsed = JSON.parse(backupRaw);
        if (Array.isArray(backupParsed)) return backupParsed.map((q) => sanitizeObjectMath(q));
      } catch {}
    }
    return [];
  }
}

export function stripHeavyImages(q: SoruKaydi): SoruKaydi {
  const copy = { ...q };
  // Strip heavy base64 image strings to store questions and options as compact text in Firebase
  if (copy.gorselUrl && (copy.gorselUrl.startsWith('data:image') || copy.gorselUrl.length > 500)) {
    copy.gorselUrl = '';
  }
  return copy;
}

export function saveQuestions(questions: SoruKaydi[]): void {
  const sanitized = questions.map((q) => sanitizeObjectMath(stripHeavyImages(q)));
  
  // Save to Primary and Immutable Multi-Tier Backups
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(sanitized));
  if (sanitized.length > 0) {
    localStorage.setItem(QUESTIONS_BACKUP_KEY, JSON.stringify(sanitized));
    localStorage.setItem(QUESTIONS_ARCHIVE_KEY, JSON.stringify(sanitized));
  }

  if (auth.currentUser) {
    const uid = auth.currentUser.uid;
    // 1. Sync individual question documents
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

    // 2. Save complete questions archive snapshot in Firestore for guaranteed disaster recovery
    if (sanitized.length > 0) {
      const backupPath = `users/${uid}/backup/questions_archive`;
      const cleanArchiveData = JSON.parse(JSON.stringify({
        questions: sanitized,
        updatedAt: Date.now(),
        userId: uid,
      }));
      setDoc(doc(db, 'users', uid, 'backup', 'questions_archive'), cleanArchiveData, { merge: true }).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, backupPath);
      });
    }
  }
}

export function saveQuestion(question: SoruKaydi): SoruKaydi[] {
  const list = getQuestions();
  const sanitizedQuestion = sanitizeObjectMath(stripHeavyImages(question));
  const index = list.findIndex(q => q.id === sanitizedQuestion.id);
  if (index >= 0) {
    list[index] = sanitizedQuestion;
  } else {
    list.unshift(sanitizedQuestion);
  }

  // Save to all backup layers
  saveQuestions(list);
  return list;
}

export function deleteQuestion(id: string): SoruKaydi[] {
  const list = getQuestions().filter(q => q.id !== id);
  localStorage.setItem(QUESTIONS_KEY, JSON.stringify(list));

  if (auth.currentUser) {
    const path = `users/${auth.currentUser.uid}/questions/${id}`;
    deleteDoc(doc(db, 'users', auth.currentUser.uid, 'questions', id)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, path);
    });
  }

  return list;
}

export function getCommunityPosts(): ToplulukSoru[] {
  const data = localStorage.getItem(COMMUNITY_KEY);
  if (!data) {
    localStorage.setItem(COMMUNITY_KEY, JSON.stringify(INITIAL_COMMUNITY));
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
  localStorage.setItem(COMMUNITY_KEY, JSON.stringify(posts));
}

export function saveCommunityPost(post: ToplulukSoru): ToplulukSoru[] {
  const posts = getCommunityPosts();
  posts.unshift(post);
  localStorage.setItem(COMMUNITY_KEY, JSON.stringify(posts));

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
  const post = posts.find(p => p.id === id);
  if (post) {
    post.isLiked = !post.isLiked;
    post.begeniSayisi += post.isLiked ? 1 : -1;
    localStorage.setItem(COMMUNITY_KEY, JSON.stringify(posts));
  }
  return posts;
}

export function getSchedule(): ProgramOgesi[] {
  const data = localStorage.getItem(SCHEDULE_KEY);
  if (!data) {
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(INITIAL_SCHEDULE));
    return INITIAL_SCHEDULE;
  }
  try {
    return JSON.parse(data);
  } catch {
    return INITIAL_SCHEDULE;
  }
}

export function saveSchedule(schedule: ProgramOgesi[]): void {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  if (auth.currentUser) {
    schedule.forEach((item) => {
      const path = `users/${auth.currentUser!.uid}/schedule/${item.id}`;
      setDoc(doc(db, 'users', auth.currentUser!.uid, 'schedule', item.id), {
        ...item,
        userId: auth.currentUser!.uid,
      }, { merge: true }).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, path);
      });
    });
  }
}

export function toggleScheduleItem(id: string): ProgramOgesi[] {
  const items = getSchedule();
  const item = items.find(i => i.id === id);
  if (item) {
    item.tamamlandi = !item.tamamlandi;
    saveSchedule(items);
  }
  return items;
}

export function saveScheduleLocally(schedule: ProgramOgesi[]): void {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}

export function deleteScheduleItem(id: string): ProgramOgesi[] {
  const items = getSchedule().filter(i => i.id !== id);
  saveScheduleLocally(items);
  if (auth.currentUser) {
    const path = `users/${auth.currentUser.uid}/schedule/${id}`;
    deleteDoc(doc(db, 'users', auth.currentUser.uid, 'schedule', id)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, path);
    });
  }
  return items;
}

export function getTheme(): 'light' | 'dark' {
  const theme = localStorage.getItem(THEME_KEY);
  if (theme === 'dark' || theme === 'light') return theme;
  return 'light';
}

export function saveTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem(THEME_KEY, theme);
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  }
}

export const setTheme = saveTheme;

const INITIAL_DENEMELER: DenemeRecord[] = [];

export function saveDenemelerLocally(denemeler: DenemeRecord[]): void {
  localStorage.setItem(DENEME_KEY, JSON.stringify(denemeler));
}

export function getDenemeler(): DenemeRecord[] {
  const data = localStorage.getItem(DENEME_KEY);
  if (!data) {
    localStorage.setItem(DENEME_KEY, JSON.stringify([]));
    return [];
  }
  try {
    const parsed: DenemeRecord[] = JSON.parse(data);
    // Clean up sample mock items if present in user's localStorage
    const cleaned = parsed.filter((item) => item.id !== 'd_1' && item.id !== 'd_2');
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(DENEME_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveDeneme(deneme: DenemeRecord): DenemeRecord[] {
  const existing = getDenemeler();
  const index = existing.findIndex((d) => d.id === deneme.id);
  let updated: DenemeRecord[];
  if (index >= 0) {
    updated = [...existing];
    updated[index] = deneme;
  } else {
    updated = [deneme, ...existing];
  }
  localStorage.setItem(DENEME_KEY, JSON.stringify(updated));

  if (auth.currentUser) {
    const path = `users/${auth.currentUser.uid}/denemeler/${deneme.id}`;
    const safeData = JSON.parse(JSON.stringify({
      ...deneme,
      userId: auth.currentUser.uid,
      notlar: deneme.notlar || '',
    }));
    setDoc(doc(db, 'users', auth.currentUser.uid, 'denemeler', deneme.id), safeData, { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, path);
    });
  }

  return updated;
}

export function deleteDeneme(id: string): DenemeRecord[] {
  const existing = getDenemeler();
  const updated = existing.filter((d) => d.id !== id);
  localStorage.setItem(DENEME_KEY, JSON.stringify(updated));

  if (auth.currentUser) {
    const path = `users/${auth.currentUser.uid}/denemeler/${id}`;
    deleteDoc(doc(db, 'users', auth.currentUser.uid, 'denemeler', id)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, path);
    });
  }

  return updated;
}
