import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Bildirim, Kullanici, SoruKaydi } from '../types';
import { db, auth } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

export interface NotificationSettings {
  dailyGoal: boolean;
  dailyGoalTime: string; // e.g. "19:00"
  errorPoolReview: boolean;
  streakReminder: boolean;
  weeklyReport: boolean;
  friendActivity: boolean;
  updates: boolean;
  campaigns: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyGoal: true,
  dailyGoalTime: '19:00',
  errorPoolReview: true,
  streakReminder: true,
  weeklyReport: true,
  friendActivity: true,
  updates: true,
  campaigns: true,
};

const STORAGE_KEY = 'edumind_notification_settings';
const LAST_SENT_KEY = 'edumind_last_notification_timestamps';

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {}
  return DEFAULT_NOTIFICATION_SETTINGS;
}

export function saveNotificationSettings(settings: NotificationSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    if (auth.currentUser) {
      setDoc(
        doc(db, 'users', auth.currentUser.uid),
        { notificationSettings: settings },
        { merge: true }
      ).catch(() => {});
    }
  } catch (e) {}
}

/**
 * Request notification permissions on Android / iOS and web
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    }
  } catch (err) {
    console.warn('Error requesting notification permissions:', err);
  }
  return false;
}

/**
 * Send a native notification to the phone status bar / lockscreen
 */
export async function sendNativeNotification({
  title,
  body,
  id,
  extra,
}: {
  title: string;
  body: string;
  id?: number;
  extra?: any;
}) {
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: id || Math.floor(10000 + Math.random() * 90000),
            schedule: { at: new Date(Date.now() + 200) },
            sound: 'default',
            smallIcon: 'ic_stat_icon',
            largeIcon: 'ic_launcher',
            iconColor: '#4338ca',
            extra: extra || {},
          },
        ],
      });
    } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/app-icon.png',
      });
    }
  } catch (err) {
    console.warn('Error scheduling local notification:', err);
  }
}

/**
 * Dispatch a complete notification (both to in-app notification center and phone notification bar)
 */
export async function dispatchAppNotification({
  type,
  title,
  message,
  user,
  onAddInAppNotification,
}: {
  type: Bildirim['type'];
  title: string;
  message: string;
  user?: Kullanici | null;
  onAddInAppNotification?: (notif: Bildirim) => void;
}) {
  const notifId = `notif_sys_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const newNotif: Bildirim = {
    id: notifId,
    type,
    title,
    message,
    senderId: 'system',
    senderName: 'EduMind Asistanı',
    senderAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=EduMindBot&backgroundColor=6366f1',
    createdAt: timeStr,
    read: false,
    recipientId: user?.id || auth.currentUser?.uid,
  };

  // 1. Send native phone notification
  await sendNativeNotification({
    title,
    body: message,
    id: Math.floor(Date.now() % 100000),
    extra: { notifId, type },
  });

  // 2. Add to in-app React state
  if (onAddInAppNotification) {
    onAddInAppNotification(newNotif);
  }

  // 3. Save to Firestore for current user
  if (auth.currentUser) {
    try {
      const uid = auth.currentUser.uid;
      await setDoc(doc(db, 'users', uid, 'notifications', notifId), newNotif);
      // Only set floating banner for direct interactive invites (friend_request, pomo_invite)
      if (type === 'friend_request' || type === 'pomo_invite') {
        await setDoc(doc(db, 'users', uid), { latestNotification: newNotif }, { merge: true });
      }
    } catch (e) {
      console.warn('Error saving in-app notification to Firestore:', e);
    }
  }
}

/**
 * Run smart notification checks based on user study habits, error pool, streak, and target exam
 */
export async function runSmartNotificationChecks({
  user,
  questions,
  onAddInAppNotification,
}: {
  user: Kullanici;
  questions: SoruKaydi[];
  onAddInAppNotification: (notif: Bildirim) => void;
}) {
  const settings = getNotificationSettings();
  const todayDateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const nowHour = new Date().getHours();
  const nowMs = Date.now();

  let lastSentMap: Record<string, string> = {};
  let lastGlobalSentMs = 0;
  try {
    const raw = localStorage.getItem(LAST_SENT_KEY);
    if (raw) lastSentMap = JSON.parse(raw);
    const rawGlobal = localStorage.getItem('edumind_last_global_reminder_ms');
    if (rawGlobal) lastGlobalSentMs = Number(rawGlobal) || 0;
  } catch (e) {}

  // Global quiet-time throttle: at least 12 hours between any automatic reminders
  if (nowMs - lastGlobalSentMs < 12 * 60 * 60 * 1000) {
    return;
  }

  const canSendToday = (key: string) => {
    return lastSentMap[key] !== todayDateStr;
  };

  const markSentToday = (key: string) => {
    lastSentMap[key] = todayDateStr;
    try {
      localStorage.setItem(LAST_SENT_KEY, JSON.stringify(lastSentMap));
      localStorage.setItem('edumind_last_global_reminder_ms', String(Date.now()));
    } catch (e) {}
  };

  // 1. Error Pool & Ebbinghaus Repetition Reminder (Only in the evening between 18:00 and 21:00)
  if (settings.errorPoolReview && nowHour >= 18 && nowHour <= 21 && canSendToday('error_pool')) {
    const unsolvedErrors = questions.filter((q) => !q.isSolved);
    if (unsolvedErrors.length > 0) {
      await dispatchAppNotification({
        type: 'error_pool',
        title: '🧠 Hata Havuzu Tekrarı',
        message: `Hata havuzunda tekrar edilmeyi bekleyen ${unsolvedErrors.length} soru var! Bilgilerini pekiştirmek için tekrar et.`,
        user,
        onAddInAppNotification,
      });
      markSentToday('error_pool');
      return;
    }
  }

  // 2. Daily Study Goal Reminder (Only in the afternoon/evening)
  if (settings.dailyGoal && nowHour >= 17 && nowHour <= 21 && canSendToday('daily_goal')) {
    await dispatchAppNotification({
      type: 'daily_goal',
      title: '🎯 Günlük Hedef Hatırlatıcı',
      message: `${user.ad || 'Öğrenci'}, bugünkü ders hedeflerine ulaşmak için harika bir zaman! Hemen çalışmaya başla. 📚`,
      user,
      onAddInAppNotification,
    });
    markSentToday('daily_goal');
    return;
  }

  // 3. Streak Protection Alert (Only late evening 20:00 - 22:00)
  if (settings.streakReminder && user.seri > 0 && nowHour >= 20 && canSendToday('streak')) {
    await dispatchAppNotification({
      type: 'streak',
      title: '🔥 Serini Kaybetme!',
      message: `${user.seri} günlük çalışma serin var! Serini korumak ve puan kazanmak için bugün en az 1 soru çöz veya Pomodoro yap.`,
      user,
      onAddInAppNotification,
    });
    markSentToday('streak');
    return;
  }

  // 4. Weekly Report & Performance Analysis (Strictly on Sunday night at 23:59)
  const dayOfWeek = new Date().getDay(); // 0 is Sunday
  const nowMinute = new Date().getMinutes();
  if (settings.weeklyReport && dayOfWeek === 0 && nowHour === 23 && nowMinute >= 50 && canSendToday('weekly_report')) {
    await dispatchAppNotification({
      type: 'weekly_report',
      title: '📊 Haftalık Gelişim Raporu',
      message: `Tebrikler! Bu hafta çözdüğün sorular ve Pomodoro odaklanmaların başarı raporuna yansıdı. İncelemek için tıkla.`,
      user,
      onAddInAppNotification,
    });
    markSentToday('weekly_report');
    return;
  }

  // 5. Target Exam Motivation & Countdown Alert
  if (settings.campaigns && user.targetExam && user.targetExam !== 'Hazırlanmıyorum' && canSendToday('exam_alert')) {
    await dispatchAppNotification({
      type: 'exam_alert',
      title: `🚀 ${user.targetExam} Hedefin Seni Bekliyor!`,
      message: `Dereceye giden yol disiplinli çalışmadan geçer. Bugün yapacağın her soru seni hedefine bir adım daha yaklaştıracak! 💪`,
      user,
      onAddInAppNotification,
    });
    markSentToday('exam_alert');
  }
}

export async function updatePomodoroLocalNotification(title: string, body: string, isFinished: boolean = false) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const hasPerm = await LocalNotifications.checkPermissions();
    if (hasPerm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
    const POMO_NOTIF_ID = 99999;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: POMO_NOTIF_ID,
          title: title,
          body: body,
          schedule: { at: new Date(Date.now() + 100) },
        },
      ],
    });
  } catch (e) {
    console.warn('Pomodoro local notification update error:', e);
  }
}

export async function clearPomodoroLocalNotification() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const POMO_NOTIF_ID = 99999;
    await LocalNotifications.cancel({ notifications: [{ id: POMO_NOTIF_ID }] });
  } catch (e) {}
}
