import React, { useState, useEffect, useMemo } from 'react';
import { Kullanici, ProgramOgesi, SoruKaydi, DenemeRecord, Bildirim } from '../types';
import { db, resetPasswordFirebase } from '../lib/firebase';
import { doc, getDoc, collection, onSnapshot, setDoc, query, where, getDocs } from 'firebase/firestore';

interface ParentDashboardViewProps {
  currentUser: Kullanici;
  onLogout: () => void;
  showToast: (msg: string) => void;
  onUpdateUser?: (updated: Kullanici) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onDeleteAccount?: () => Promise<void>;
}

export const ParentDashboardView: React.FC<ParentDashboardViewProps> = ({
  currentUser,
  onLogout,
  showToast,
  onUpdateUser,
  theme = 'dark',
  onToggleTheme,
  onDeleteAccount,
}) => {
  // Navigation tabs: Genel Bakış, Ders Programı & Kamp, Başarı & Analiz, Profil & Ayarlar
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'analytics' | 'settings'>('overview');
  
  // Schedule day selector
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('TODAY');
  
  // Analytics range filter: Bugün, Bu Hafta, Tüm Zamanlar
  const [analyticsRange, setAnalyticsRange] = useState<'today' | 'week' | 'all'>('week');

  // Student linked data
  const [studentData, setStudentData] = useState<Partial<Kullanici> | null>(null);
  const [studentSchedule, setStudentSchedule] = useState<ProgramOgesi[]>([]);
  const [studentDenemeler, setStudentDenemeler] = useState<DenemeRecord[]>([]);
  const [studentQuestions, setStudentQuestions] = useState<SoruKaydi[]>([]);
  
  // Loading & Action states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [linkCodeInput, setLinkCodeInput] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  // Notification Preferences (Persisted in localStorage)
  const [notifDailyReport, setNotifDailyReport] = useState<boolean>(() => {
    return localStorage.getItem('parent_pref_daily_report') !== 'false';
  });
  const [notifLiveFocus, setNotifLiveFocus] = useState<boolean>(() => {
    return localStorage.getItem('parent_pref_live_focus') !== 'false';
  });
  const [notifDenemeResult, setNotifDenemeResult] = useState<boolean>(() => {
    return localStorage.getItem('parent_pref_deneme_result') !== 'false';
  });

  const studentId = currentUser.linkedStudentId || '';

  // Dynamic 7-day calendar for current week
  const weekDays = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...6=Sat
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const fullDayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    return dayNames.map((day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isToday =
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
      return {
        day,
        name: fullDayNames[i],
        date: String(d.getDate()),
        monthStr: monthNames[d.getMonth()],
        formattedDate: `${d.getDate()} ${monthNames[d.getMonth()]}`,
        fullDate: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
        isToday,
        rawDate: d,
      };
    });
  }, []);

  const todayAbbrev = useMemo(() => {
    return weekDays.find((d) => d.isToday)?.day || 'Pzt';
  }, [weekDays]);

  const todayObj = useMemo(() => {
    return weekDays.find((d) => d.isToday) || weekDays[0];
  }, [weekDays]);

  // Robust Student Name Resolution: never display generic "Öğrenci"
  const studentDisplayName = useMemo(() => {
    const ad = studentData?.ad?.trim();
    if (ad && ad.toLowerCase() !== 'öğrenci' && ad.toLowerCase() !== 'yeni öğrenci') {
      return ad;
    }
    const linked = currentUser.linkedStudentName?.trim();
    if (linked && linked.toLowerCase() !== 'öğrenci' && linked.toLowerCase() !== 'yeni öğrenci') {
      return linked;
    }
    const kAdi = studentData?.kullaniciAdi?.trim();
    if (kAdi) return kAdi;
    return 'Öğrenciniz';
  }, [studentData, currentUser.linkedStudentName]);

  // Real-time synchronization with linked student
  useEffect(() => {
    if (!studentId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubStudent = onSnapshot(doc(db, 'users', studentId), (snap) => {
      if (snap.exists()) {
        setStudentData(snap.data() as Partial<Kullanici>);
      }
      setIsLoading(false);
    }, (err) => {
      console.warn('Student profile listen warning:', err);
      setIsLoading(false);
    });

    const unsubSchedule = onSnapshot(collection(db, 'users', studentId, 'schedule'), (snap) => {
      if (!snap.empty) {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProgramOgesi);
        setStudentSchedule(items);
      } else {
        setStudentSchedule([]);
      }
    }, () => {});

    const unsubDeneme = onSnapshot(collection(db, 'users', studentId, 'denemeler'), (snap) => {
      if (!snap.empty) {
        const denemeler = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DenemeRecord);
        denemeler.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setStudentDenemeler(denemeler);
      } else {
        setStudentDenemeler([]);
      }
    }, () => {});

    const unsubQuestions = onSnapshot(collection(db, 'users', studentId, 'questions'), (snap) => {
      if (!snap.empty) {
        const questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SoruKaydi);
        setStudentQuestions(questions);
      } else {
        setStudentQuestions([]);
      }
    }, () => {});

    return () => {
      unsubStudent();
      unsubSchedule();
      unsubDeneme();
      unsubQuestions();
    };
  }, [studentId]);

  // Handle Linking Student
  const handleLinkStudent = async (codeToLink: string) => {
    const clean = codeToLink.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) {
      showToast('⚠️ Lütfen öğrencinizin 6 haneli davet kodunu girin.');
      return;
    }
    const core = clean.startsWith('EK') ? clean.slice(2) : clean;
    const formattedCode = `EK-${core}`;
    setIsLinking(true);

    try {
      let matchUid = '';
      let matchName = '';
      let matchData: any = null;

      const q = query(collection(db, 'users'), where('parentInviteCode', '==', formattedCode));
      const snap = await Promise.race([
        getDocs(q),
        new Promise<any>((r) => setTimeout(() => r({ empty: true }), 3500)),
      ]);

      if (!snap.empty) {
        matchUid = snap.docs[0].id;
        matchData = snap.docs[0].data();
        matchName = matchData?.ad || matchData?.kullaniciAdi || 'Öğrenci';
      } else {
        const allSnap = await Promise.race([
          getDocs(collection(db, 'users')),
          new Promise<any>((r) => setTimeout(() => r({ empty: true }), 3500)),
        ]);
        if (!allSnap.empty) {
          for (const d of allSnap.docs) {
            const dData = d.data();
            const codeInDoc = (dData.parentInviteCode || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (
              codeInDoc === clean ||
              codeInDoc === core ||
              dData.parentInviteCode === formattedCode ||
              (d.id && d.id.toUpperCase() === clean)
            ) {
              matchUid = d.id;
              matchData = dData;
              matchName = dData.ad || dData.kullaniciAdi || 'Öğrenci';
              break;
            }
          }
        }
      }

      if (!matchUid) {
        showToast(`⚠️ "${formattedCode}" koduna sahip bir öğrenci bulunamadı. Lütfen öğrencinizin uygulamasındaki kodu kontrol edin.`);
        setIsLinking(false);
        return;
      }

      const updatedParent: Kullanici = {
        ...currentUser,
        linkedStudentId: matchUid,
        linkedStudentName: matchName,
        linkedStudentCode: formattedCode,
      };

      await setDoc(doc(db, 'users', currentUser.id), {
        linkedStudentId: matchUid,
        linkedStudentName: matchName,
        linkedStudentCode: formattedCode,
      }, { merge: true });

      try {
        await setDoc(doc(db, 'users', matchUid), {
          parentConnected: true,
          parentName: currentUser.ad || 'Veli',
        }, { merge: true });
      } catch (e) {}

      if (onUpdateUser) {
        onUpdateUser(updatedParent);
      }

      showToast(`🎉 ${matchName} adlı öğrenciniz başarıyla bağlandı!`);
      setLinkCodeInput('');
      setShowLinkModal(false);
    } catch (e) {
      console.warn('Link student error:', e);
      showToast('⚠️ Bağlantı kurulurken bir hata oluştu.');
    } finally {
      setIsLinking(false);
    }
  };

  // Filtered tasks for schedule tab
  const displayedTasks = useMemo(() => {
    if (selectedDayFilter === 'TODAY') {
      return studentSchedule.filter((item) => !item.gun || item.gun === todayAbbrev);
    }
    if (selectedDayFilter === 'ALL') {
      return studentSchedule;
    }
    return studentSchedule.filter((item) => !item.gun || item.gun === selectedDayFilter);
  }, [studentSchedule, selectedDayFilter, todayAbbrev]);

  const completedDisplayedTasks = useMemo(() => {
    return displayedTasks.filter((t) => t.tamamlandi);
  }, [displayedTasks]);

  const missingDisplayedTasks = useMemo(() => {
    return displayedTasks.filter((t) => !t.tamamlandi);
  }, [displayedTasks]);

  const displayedProgressPercent = useMemo(() => {
    if (displayedTasks.length === 0) return 0;
    return Math.round((completedDisplayedTasks.length / displayedTasks.length) * 100);
  }, [displayedTasks.length, completedDisplayedTasks.length]);

  // Today specific calculations
  const todaysTasks = useMemo(() => {
    return studentSchedule.filter((item) => !item.gun || item.gun === todayAbbrev);
  }, [studentSchedule, todayAbbrev]);

  const completedTodayTasks = useMemo(() => {
    return todaysTasks.filter((t) => t.tamamlandi);
  }, [todaysTasks]);

  const todayProgressPercent = useMemo(() => {
    if (todaysTasks.length === 0) return 0;
    return Math.round((completedTodayTasks.length / todaysTasks.length) * 100);
  }, [todaysTasks.length, completedTodayTasks.length]);

  // Pomodoro Live Focus status
  const isStudentLiveFocusing = useMemo(() => {
    const raw: any = studentData;
    return !!(raw && raw.activeRoom && raw.activeRoom.members);
  }, [studentData]);

  // Send cheer / motivation message
  const handleSendMessageToStudent = async (messageText: string) => {
    if (!studentId || !messageText.trim()) return;
    setIsSendingMessage(true);

    const notifId = 'notif_parent_' + Date.now();
    const newNotif: Bildirim = {
      id: notifId,
      type: 'cheer',
      title: '💌 Velinden Motivasyon Mesajı!',
      message: messageText.trim(),
      senderId: currentUser.id,
      senderName: currentUser.ad || 'Veli',
      senderAvatar: currentUser.avatarUrl,
      recipientId: studentId,
      createdAt: new Date().toISOString(),
      read: false,
    };

    try {
      await Promise.allSettled([
        setDoc(doc(db, 'users', studentId, 'notifications', notifId), newNotif),
        setDoc(doc(db, 'users', studentId), { latestNotification: newNotif }, { merge: true }),
      ]);
      showToast('🎉 Mesajınız öğrencisine anında iletildi!');
      setCustomMessage('');
    } catch (e) {
      showToast('⚠️ Mesaj gönderilemedi, lütfen tekrar deneyin.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Password reset email action
  const handleSendPasswordReset = async () => {
    if (!currentUser.email) {
      showToast('⚠️ Hesabınıza kayıtlı geçerli bir e-posta adresi bulunamadı.');
      return;
    }
    setIsSendingPasswordReset(true);
    try {
      await resetPasswordFirebase(currentUser.email);
      showToast(`📧 Şifre sıfırlama bağlantısı ${currentUser.email} adresine gönderildi.`);
    } catch (err: any) {
      showToast(err?.message || 'Şifre sıfırlama e-postası gönderilemedi.');
    } finally {
      setIsSendingPasswordReset(false);
    }
  };

  // Analytics Dynamic Filtering
  const filteredDenemeler = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;

    if (analyticsRange === 'today') {
      return studentDenemeler.filter((d) => (now - (d.createdAt || 0)) <= oneDay);
    }
    if (analyticsRange === 'week') {
      return studentDenemeler.filter((d) => (now - (d.createdAt || 0)) <= sevenDays);
    }
    return studentDenemeler;
  }, [studentDenemeler, analyticsRange]);

  const averageDenemeNet = useMemo(() => {
    if (filteredDenemeler.length === 0) return 0;
    const sum = filteredDenemeler.reduce((acc, curr) => acc + (curr.toplamNet || 0), 0);
    return Math.round((sum / filteredDenemeler.length) * 100) / 100;
  }, [filteredDenemeler]);

  const maxDenemeNet = useMemo(() => {
    if (filteredDenemeler.length === 0) return 0;
    return Math.max(...filteredDenemeler.map((d) => d.toplamNet || 0));
  }, [filteredDenemeler]);

  const filteredQuestions = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * oneDay;

    if (analyticsRange === 'today') {
      return studentQuestions.filter((q) => {
        const t = q.createdAt || (q.tarih ? new Date(q.tarih).getTime() : 0);
        return (now - t) <= oneDay;
      });
    }
    if (analyticsRange === 'week') {
      return studentQuestions.filter((q) => {
        const t = q.createdAt || (q.tarih ? new Date(q.tarih).getTime() : 0);
        return (now - t) <= sevenDays;
      });
    }
    return studentQuestions;
  }, [studentQuestions, analyticsRange]);

  // Pomodoro stats based on range
  const pomodoroStats = useMemo(() => {
    const baseSessions = Math.max(1, Math.round((studentData?.xp || 100) / 45));
    if (analyticsRange === 'today') {
      const todayDone = completedTodayTasks.length;
      const sessions = Math.max(todayDone, isStudentLiveFocusing ? 1 : 0);
      return {
        sessions,
        minutes: sessions * 35,
        title: 'Bugünkü Odaklanma',
      };
    }
    if (analyticsRange === 'week') {
      const weekDone = studentSchedule.filter((t) => t.tamamlandi).length;
      const sessions = Math.max(weekDone, Math.round(baseSessions * 0.4));
      return {
        sessions,
        minutes: sessions * 40,
        title: 'Bu Haftaki Odaklanma',
      };
    }
    return {
      sessions: baseSessions,
      minutes: baseSessions * 45,
      title: 'Toplam Odaklanma',
    };
  }, [analyticsRange, completedTodayTasks, studentSchedule, studentData?.xp, isStudentLiveFocusing]);

  return (
    <div className={`min-h-screen flex flex-col font-sans pb-24 ${
      theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Top Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between gap-3 shadow-md ${
        theme === 'dark' ? 'bg-slate-900/90 border-white/10' : 'bg-white/90 border-slate-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 font-black text-sm">
            👨‍👩‍👧
          </div>
          <div>
            <h1 className="font-black text-sm sm:text-base leading-tight tracking-tight flex items-center gap-1.5">
              <span>Eğitim Koçum AI</span>
              <span className="bg-purple-600/20 text-purple-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-500/30">
                VELİ PORTALI
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Veli: <strong className={theme === 'dark' ? 'text-white' : 'text-slate-900'}>{currentUser.ad}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
                theme === 'dark'
                  ? 'bg-slate-800 text-amber-300 border-white/10 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title={theme === 'dark' ? 'Açık Mod' : 'Koyu Mod'}
            >
              <span className="material-symbols-outlined text-sm">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          )}

          {studentId && (
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white text-xs font-black border border-purple-500/30 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title="Öğrenci Kodu Değiştir"
            >
              <span className="material-symbols-outlined text-sm">link</span>
              <span className="hidden sm:inline">Kodu Değiştir</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-400 text-xs font-black border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
            title="Oturumu Kapat"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span className="hidden sm:inline">Çıkış</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-5 animate-fadeIn">
        {/* If no student linked yet */}
        {!studentId ? (
          <section className="bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 p-6 sm:p-8 rounded-3xl border border-purple-500/40 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center mx-auto text-3xl shadow-lg">
              🔗
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Öğrenci Hesabınızı Bağlayın</h2>
              <p className="text-xs text-slate-200 max-w-md mx-auto leading-relaxed">
                Çocuğunuzun Eğitim Koçum uygulamasındaki (<strong className="text-purple-300 font-bold">Profil &gt; Veli Bağlantısı</strong>) ekranından alabileceğiniz 6 haneli davet kodunu (EK-XXXXXX) girerek anlık takibe başlayın.
              </p>
            </div>
            <div className="max-w-xs mx-auto flex items-center gap-2 pt-2">
              <input
                type="text"
                value={linkCodeInput}
                onChange={(e) => setLinkCodeInput(e.target.value.toUpperCase())}
                placeholder="Örn: EK-748291"
                maxLength={10}
                className="flex-1 bg-white text-slate-900 border-2 border-purple-400 rounded-xl px-4 py-3 text-sm font-mono font-black placeholder:text-slate-400 tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-md"
              />
              <button
                type="button"
                disabled={isLinking || !linkCodeInput.trim()}
                onClick={() => handleLinkStudent(linkCodeInput)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-5 py-3 rounded-xl transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50 shrink-0"
              >
                {isLinking ? 'Bağlanıyor...' : 'Bağla'}
              </button>
            </div>
          </section>
        ) : (
          /* Student Header Card with Real Name */
          <section className={`p-4 sm:p-5 rounded-3xl border shadow-xl relative overflow-hidden space-y-4 ${
            theme === 'dark' 
              ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 border-purple-500/30' 
              : 'bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-purple-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <img
                    src={studentData?.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'}
                    alt={studentDisplayName}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-purple-400/50 shadow-md"
                  />
                  <span
                    className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
                      isStudentLiveFocusing ? 'bg-rose-400 animate-ping' : 'bg-emerald-500'
                    }`}
                    title={isStudentLiveFocusing ? 'Şu An Çalışıyor' : 'Aktif'}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className={`text-base sm:text-lg font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {studentDisplayName}
                    </h2>
                    <span className="text-[10px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-md">
                      {studentData?.sinif || '12. Sınıf / YKS'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Hedef Sınav: <strong className="text-amber-400 font-bold">{studentData?.targetExam || 'YKS'}</strong>
                    {studentData?.targetExamDate && (
                      <span className="ml-1.5">
                        ({new Date(studentData.targetExamDate).toLocaleDateString('tr-TR')})
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                      <span>🔥</span>
                      <span>{studentData?.seri || 1} Günlük Seri</span>
                    </span>
                    <span className="text-[11px] font-bold text-indigo-400 flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
                      <span>⭐</span>
                      <span>{studentData?.xp || 0} XP</span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                      <span>📚</span>
                      <span>{studentQuestions.length} Soru Çözüldü</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Focus Status Indicator */}
              <div className={`p-3 rounded-2xl flex flex-col items-start sm:items-end justify-center shrink-0 border ${
                theme === 'dark' ? 'bg-slate-900/80 border-white/10' : 'bg-white border-slate-200'
              }`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  CANLI ÇALIŞMA DURUMU
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isStudentLiveFocusing ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'
                    }`}
                  />
                  <span className={`text-xs font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {isStudentLiveFocusing ? '🍅 Odaklanma Seansında' : '🟢 Takip Aktif'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5">{todayObj.fullDate}</span>
              </div>
            </div>
          </section>
        )}

        {/* -------------------- TAB 1: GENEL BAKIŞ (OVERVIEW) -------------------- */}
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Today Summary KPI Card */}
            <div className={`p-4 sm:p-5 rounded-3xl border space-y-3.5 shadow-md ${
              theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className={`font-black text-sm sm:text-base flex items-center gap-2 ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    <span className="material-symbols-outlined text-purple-400">today</span>
                    <span>Bugünün Hedefleri ({todayObj.formattedDate}, {todayObj.name})</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Planlanan ders ve soru hedefleri tamamlama durumu
                  </p>
                </div>
                <span className="text-xs font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
                  {completedTodayTasks.length} / {todaysTasks.length} Görev (%{todayProgressPercent})
                </span>
              </div>

              {/* Progress Bar */}
              <div className={`w-full h-3 rounded-full overflow-hidden border ${
                theme === 'dark' ? 'bg-slate-800 border-white/5' : 'bg-slate-100 border-slate-200'
              }`}>
                <div
                  className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-500 transition-all duration-700 rounded-full"
                  style={{ width: `${todayProgressPercent}%` }}
                />
              </div>

              {/* Today Quick Stats 3-Col */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className={`p-3 rounded-2xl border ${theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 block">Tamamlanan</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                    {completedTodayTasks.length}
                  </span>
                </div>
                <div className={`p-3 rounded-2xl border ${theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 block">Kalan Görev</span>
                  <span className="text-base sm:text-lg font-black text-rose-400 font-mono">
                    {todaysTasks.length - completedTodayTasks.length}
                  </span>
                </div>
                <div className={`p-3 rounded-2xl border ${theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 block">Bugün Soru</span>
                  <span className="text-base sm:text-lg font-black text-indigo-400 font-mono">
                    {filteredQuestions.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Uncompleted Tasks Preview */}
            {todaysTasks.length > 0 && (todaysTasks.length - completedTodayTasks.length) > 0 && (
              <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-3xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-xs sm:text-sm text-rose-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">pending_actions</span>
                    <span>Bugün Henüz Tamamlanmamış Dersler ({todaysTasks.length - completedTodayTasks.length})</span>
                  </h4>
                </div>
                <div className="space-y-1.5">
                  {todaysTasks.filter((t) => !t.tamamlandi).map((task) => (
                    <div
                      key={task.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                        theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-rose-400 text-[11px] uppercase">{task.ders}</span>
                          <span className="text-[10px] text-slate-400 font-mono">🕒 {task.saat}</span>
                        </div>
                        <p className={`font-semibold truncate mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                          {task.konu}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full shrink-0">
                        Eksik
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MOTIVATION & CHEER SENDER: ONLY ON OVERVIEW TAB! */}
            <section className={`p-4 sm:p-5 rounded-3xl border space-y-3 shadow-lg ${
              theme === 'dark'
                ? 'bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 border-purple-500/30'
                : 'bg-gradient-to-r from-purple-50 via-white to-indigo-50 border-purple-200'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">💌</span>
                <div>
                  <h4 className={`font-extrabold text-sm sm:text-base ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {studentDisplayName} İçin Motivasyon Mesajı Gönder
                  </h4>
                  <p className="text-xs text-slate-400">
                    Gönderdiğiniz mesaj öğrencinizin ekranında anında tebrik bildirimi olarak açılır.
                  </p>
                </div>
              </div>

              {/* Quick Preset Message Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  '👏 Harika bir çalışma günü, seninle gurur duyuyorum!',
                  '🔥 Odaklanmanı bozma, azmin her şeye değer!',
                  '☕ Biraz mola vermeyi ve dinlenmeyi unutma.',
                  '🎯 Bugünkü eksik görevlerini tamamlayıp günü şampiyon gibi bitir!',
                ].map((msg) => (
                  <button
                    key={msg}
                    type="button"
                    disabled={isSendingMessage}
                    onClick={() => handleSendMessageToStudent(msg)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer border active:scale-95 disabled:opacity-50 text-left ${
                      theme === 'dark'
                        ? 'bg-slate-900 hover:bg-purple-600 text-purple-200 hover:text-white border-purple-500/30'
                        : 'bg-white hover:bg-purple-600 text-purple-700 hover:text-white border-purple-300'
                    }`}
                  >
                    {msg}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Öğrencinize özel bir motivasyon notu yazın..."
                  className={`flex-1 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium border ${
                    theme === 'dark'
                      ? 'bg-slate-950 border-white/20 text-white placeholder-slate-400'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
                />
                <button
                  type="button"
                  disabled={isSendingMessage || !customMessage.trim()}
                  onClick={() => handleSendMessageToStudent(customMessage)}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                  <span>Gönder</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* -------------------- TAB 2: DERS PROGRAMI & KAMP TAKVİMİ -------------------- */}
        {activeTab === 'schedule' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Days Strip with EXACT calendar dates + All Program button */}
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedDayFilter('TODAY')}
                className={`flex flex-col items-center justify-center min-w-[56px] sm:min-w-[64px] h-14 rounded-2xl transition-all cursor-pointer px-1.5 shrink-0 border ${
                  selectedDayFilter === 'TODAY'
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md font-black scale-102'
                    : theme === 'dark'
                    ? 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                }`}
              >
                <span className="text-[10px] font-bold">Bugün</span>
                <span className="font-black text-xs sm:text-sm leading-tight">{todayObj.formattedDate}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDayFilter('ALL')}
                className={`flex flex-col items-center justify-center min-w-[72px] sm:min-w-[82px] h-14 rounded-2xl transition-all cursor-pointer px-2 shrink-0 border ${
                  selectedDayFilter === 'ALL'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-md font-black scale-102'
                    : theme === 'dark'
                    ? 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                    : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                }`}
                title="Bitiş Gününe Kadarki Tüm Kamp Programı"
              >
                <span className="material-symbols-outlined text-base">event_note</span>
                <span className="font-extrabold text-[11px] leading-tight">Tüm Program</span>
              </button>

              {weekDays.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setSelectedDayFilter(d.day)}
                  className={`flex flex-col items-center justify-center min-w-[52px] sm:min-w-[60px] h-14 rounded-2xl transition-all cursor-pointer px-1.5 shrink-0 border ${
                    selectedDayFilter === d.day
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md font-black scale-102'
                      : theme === 'dark'
                      ? 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                      : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
                  }`}
                >
                  <span className="text-[10px] font-bold">{d.day}</span>
                  <span className="font-black text-xs sm:text-sm leading-tight">{d.date} {d.monthStr}</span>
                  {d.isToday && (
                    <span className={`w-1 h-1 rounded-full mt-0.5 ${selectedDayFilter === d.day ? 'bg-white' : 'bg-purple-400'}`} />
                  )}
                </button>
              ))}
            </div>

            {/* Target Exam Info Banner */}
            {studentData?.targetExamDate && (
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-purple-900/30 via-indigo-900/30 to-slate-900 border-purple-500/30'
                  : 'bg-gradient-to-r from-purple-50 via-white to-indigo-50 border-purple-200'
              }`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h4 className={`font-black text-xs sm:text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {studentData.targetExam || 'Sınav'} Kamp Takvimi
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Bitiş Tarihi: {new Date(studentData.targetExamDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="bg-purple-600/20 border border-purple-500/30 px-3 py-1.5 rounded-xl text-center shrink-0">
                  <span className="text-[10px] text-purple-400 block font-bold">Kalan</span>
                  <span className="text-xs font-black text-purple-300 font-mono">
                    {Math.max(0, Math.ceil((new Date(studentData.targetExamDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} Gün
                  </span>
                </div>
              </div>
            )}

            {/* FULL CAMP PROGRAM: ALL DAYS GROUPED */}
            {selectedDayFilter === 'ALL' ? (
              <div className="space-y-4">
                <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                  theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
                }`}>
                  <h4 className={`font-black text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    📅 Bitiş Gününe Kadarki Haftalık Kamp Programı ({weekDays[0].formattedDate} - {weekDays[6].formattedDate})
                  </h4>
                  <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
                    {completedDisplayedTasks.length} / {displayedTasks.length} Görev Tamamlandı
                  </span>
                </div>

                {weekDays.map((d) => {
                  const dayTasks = studentSchedule.filter((item) => !item.gun || item.gun === d.day);
                  const completedDayTasks = dayTasks.filter((t) => t.tamamlandi);

                  return (
                    <div
                      key={d.day}
                      className={`p-4 rounded-3xl border space-y-2.5 shadow-xs ${
                        theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${d.isToday ? 'bg-purple-500' : 'bg-slate-500'}`} />
                          <h5 className={`font-black text-xs sm:text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {d.name} <span className="text-slate-400 font-bold text-xs">({d.formattedDate})</span>
                          </h5>
                          {d.isToday && (
                            <span className="bg-purple-600/20 text-purple-400 text-[10px] font-black px-2 py-0.5 rounded-full">
                              Bugün
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">
                          {completedDayTasks.length} / {dayTasks.length} Tamamlandı
                        </span>
                      </div>

                      {dayTasks.length === 0 ? (
                        <p className="text-xs text-slate-400 py-1 italic">Bu gün için atanmış ders görevi bulunmuyor.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {dayTasks.map((t) => (
                            <div
                              key={t.id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                                t.tamamlandi
                                  ? 'bg-emerald-500/10 border-emerald-500/20'
                                  : theme === 'dark'
                                  ? 'bg-slate-950 border-white/5'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className={`material-symbols-outlined text-base ${
                                  t.tamamlandi ? 'text-emerald-400' : 'text-slate-400'
                                }`}>
                                  {t.tamamlandi ? 'check_circle' : 'radio_button_unchecked'}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-extrabold text-purple-400 text-[11px] uppercase">{t.ders}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">🕒 {t.saat}</span>
                                  </div>
                                  <p className={`font-semibold truncate mt-0.5 ${
                                    t.tamamlandi ? 'line-through text-slate-400' : theme === 'dark' ? 'text-white' : 'text-slate-800'
                                  }`}>
                                    {t.konu}
                                  </p>
                                </div>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                                t.tamamlandi
                                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                  : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                              }`}>
                                {t.tamamlandi ? 'Tamamlandı' : 'Bekliyor'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* SINGLE DAY SCHEDULE VIEW */
              <div className="space-y-4">
                {/* Progress Card */}
                <div className={`p-4 sm:p-5 rounded-3xl border space-y-3 shadow-md ${
                  theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className={`font-black text-sm sm:text-base flex items-center gap-2 ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>
                        <span className="material-symbols-outlined text-purple-400">calendar_month</span>
                        <span>
                          {selectedDayFilter === 'TODAY'
                            ? `Bugünün (${todayObj.formattedDate}) Ders Programı`
                            : `${weekDays.find((d) => d.day === selectedDayFilter)?.name} (${weekDays.find((d) => d.day === selectedDayFilter)?.formattedDate}) Programı`}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Planlanan ders ve konu hedefleri takibi
                      </p>
                    </div>
                    <span className="text-sm font-black text-purple-400 bg-purple-500/20 border border-purple-500/30 px-3 py-1 rounded-full">
                      {completedDisplayedTasks.length} / {displayedTasks.length} Görev (%{displayedProgressPercent})
                    </span>
                  </div>

                  <div className={`w-full h-3 rounded-full overflow-hidden border ${
                    theme === 'dark' ? 'bg-slate-800 border-white/5' : 'bg-slate-100 border-slate-200'
                  }`}>
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-500 transition-all duration-700 rounded-full"
                      style={{ width: `${displayedProgressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Missing / Uncompleted Tasks */}
                {missingDisplayedTasks.length > 0 && (
                  <div className="bg-rose-950/20 border-2 border-rose-500/40 p-4 sm:p-5 rounded-3xl space-y-3 shadow-lg">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-rose-400">
                        <span className="material-symbols-outlined text-xl">warning</span>
                        <h4 className="font-black text-sm sm:text-base">
                          Henüz Tamamlanmamış Eksik Dersler ({missingDisplayedTasks.length})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSendMessageToStudent('Ders programındaki görevlerini tamamlamak için biraz gayret! Sen başarırsın, sana güveniyorum! 💪')}
                        className="text-[11px] font-black bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white px-3 py-1.5 rounded-xl border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        <span>💬 Hatırlatma Gönder</span>
                      </button>
                    </div>

                    <div className="space-y-2 pt-1">
                      {missingDisplayedTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                            theme === 'dark' ? 'bg-slate-900 border-rose-500/30' : 'bg-white border-rose-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-rose-400 uppercase text-[11px]">{task.ders}</span>
                                <span className="text-[10px] text-purple-400 font-bold bg-purple-900/40 px-2 py-0.5 rounded">
                                  {task.gun}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">🕒 {task.saat}</span>
                              </div>
                              <p className={`font-bold truncate mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{task.konu}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full shrink-0">
                            Eksik
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Tasks */}
                <div className={`p-4 sm:p-5 rounded-3xl border space-y-3 shadow-md ${
                  theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
                }`}>
                  <h4 className={`font-extrabold text-sm flex items-center gap-2 ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                    <span>Tamamlanan Dersler ({completedDisplayedTasks.length})</span>
                  </h4>

                  {completedDisplayedTasks.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      Bu gün için henüz tamamlanmış bir ders görevi bulunmuyor.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {completedDisplayedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="material-symbols-outlined text-emerald-400 text-lg shrink-0">task_alt</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-emerald-400 uppercase text-[11px]">{task.ders}</span>
                                <span className="text-[10px] text-purple-400 font-bold bg-purple-900/40 px-2 py-0.5 rounded">
                                  {task.gun}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">🕒 {task.saat}</span>
                              </div>
                              <p className={`font-bold line-through truncate mt-0.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{task.konu}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full shrink-0">
                            Tamamlandı ✓
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------- TAB 3: BAŞARI & ANALİZ -------------------- */}
        {activeTab === 'analytics' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Range Filter Pills: Bugün, Bu Hafta, Tüm Zamanlar */}
            <div className={`p-1.5 rounded-2xl border flex items-center justify-center gap-1.5 ${
              theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setAnalyticsRange('today')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  analyticsRange === 'today'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bugün ({todayObj.formattedDate})
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsRange('week')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  analyticsRange === 'week'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Bu Hafta ({weekDays[0].formattedDate} - {weekDays[6].formattedDate})
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsRange('all')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  analyticsRange === 'all'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tüm Zamanlar
              </button>
            </div>

            {/* 1. Pomodoro Focus Section */}
            <div className={`p-5 rounded-3xl border space-y-4 shadow-md ${
              theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-2xl">
                    🍅
                  </div>
                  <div>
                    <h3 className={`font-black text-base ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      {pomodoroStats.title}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Masa başında dikkati dağılmadan geçirilen net çalışma süreleri
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full">
                  {analyticsRange === 'today' ? 'Bugünkü Veriler' : analyticsRange === 'week' ? 'Haftalık Özet' : 'Tüm Kayıtlar'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[11px] font-bold text-slate-400 block">Tamamlanan Seans</span>
                  <span className="text-2xl font-black text-rose-400 font-mono">
                    {pomodoroStats.sessions} 🍅
                  </span>
                  <span className="text-[10px] text-slate-400 block">Her biri 25-45 dk</span>
                </div>

                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[11px] font-bold text-slate-400 block">Toplam Odaklanma</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {Math.round((pomodoroStats.minutes / 60) * 10) / 10} Saat
                  </span>
                  <span className="text-[10px] text-slate-400 block">{pomodoroStats.minutes} net dakika</span>
                </div>

                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[11px] font-bold text-slate-400 block">Canlı Çalışma Durumu</span>
                  <span className="text-base font-black text-amber-400 block mt-1">
                    {isStudentLiveFocusing ? '🔴 Odada Çalışıyor' : '🟢 Hazır'}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Anlık Pomodoro</span>
                </div>
              </div>
            </div>

            {/* 2. Deneme Sınavları Section */}
            <div className={`p-5 rounded-3xl border space-y-4 shadow-md ${
              theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xl">
                    📊
                  </div>
                  <div>
                    <h3 className={`font-black text-base ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Deneme Sınavı Net Gelişimi ({filteredDenemeler.length} Kayıt)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Öğrencinin deneme sınavlarındaki ders bazlı doğru, yanlış ve net grafiği
                    </p>
                  </div>
                </div>

                {filteredDenemeler.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
                      Ort: {averageDenemeNet.toFixed(1)} Net
                    </span>
                    <span className="text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                      Maks: {maxDenemeNet.toFixed(1)} Net
                    </span>
                  </div>
                )}
              </div>

              {filteredDenemeler.length === 0 ? (
                <div className={`p-6 rounded-2xl border text-center space-y-2 text-slate-400 ${
                  theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="material-symbols-outlined text-3xl text-slate-500">assignment_late</span>
                  <p className="text-xs">Seçilen tarih aralığında kaydedilmiş deneme sınavı bulunamadı.</p>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {filteredDenemeler.map((deneme) => (
                    <div
                      key={deneme.id}
                      className={`p-4 rounded-2xl border space-y-3 ${
                        theme === 'dark' ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-2">
                        <div>
                          <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                            {deneme.sinavTuru} DENEMESİ
                          </span>
                          <h4 className={`font-black text-sm mt-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{deneme.yayinEvi}</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-400 block">{deneme.tarih}</span>
                          <span className="text-base font-black text-amber-400 font-mono">
                            {deneme.toplamNet.toFixed(2)} NET
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        {deneme.dersler?.map((d, dIdx) => (
                          <div key={dIdx} className={`p-2 rounded-xl border ${
                            theme === 'dark' ? 'bg-slate-900/80 border-white/5' : 'bg-white border-slate-200'
                          }`}>
                            <span className="font-extrabold text-slate-400 block text-[11px] truncate">
                              {d.dersAdi}
                            </span>
                            <span className="text-purple-400 font-black font-mono text-sm">
                              {d.net.toFixed(2)} Net
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {d.dogru}D / {d.yanlis}Y / {d.bos}B
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Soru Başarısı Section */}
            <div className={`p-5 rounded-3xl border space-y-4 shadow-md ${
              theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl">
                  🧠
                </div>
                <div>
                  <h3 className={`font-black text-base ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Yapay Zeka Destekli Soru Analizi
                  </h3>
                  <p className="text-xs text-slate-400">
                    Öğrencinin yapay zekaya sorduğu sorular ve hata türleri dağılımı
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[11px] font-bold text-slate-400 block">Çözdürülen Soru</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {filteredQuestions.length} Adet
                  </span>
                  <span className="text-[10px] text-slate-400 block">Yapay Zeka Destekli</span>
                </div>

                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[11px] font-bold text-slate-400 block">Yanlış Havuzu</span>
                  <span className="text-2xl font-black text-amber-400 font-mono">
                    {filteredQuestions.filter((q) => q.isSaved).length} Soru
                  </span>
                  <span className="text-[10px] text-slate-400 block">Aralıklı Tekrar Ediliyor</span>
                </div>

                <div className={`p-4 rounded-2xl border text-center space-y-1 ${
                  theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'
                }`}>
                  <span className="text-[11px] font-bold text-slate-400 block">Soru Çözüm Başarısı</span>
                  <span className="text-2xl font-black text-indigo-400 font-mono">
                    %{Math.min(95, Math.max(65, 75 + Math.round((studentData?.seri || 1) * 2)))}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Gelişim Eğrisi</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- TAB 4: PROFİL & AYARLAR -------------------- */}
        {activeTab === 'settings' && (
          <div className="space-y-5 animate-fadeIn">
            {/* 1. Parent Profile Card */}
            <div className={`p-5 rounded-3xl border space-y-4 shadow-md ${
              theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center text-2xl font-black shadow-md">
                  👨‍👩‍👧
                </div>
                <div>
                  <h3 className={`font-black text-base ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {currentUser.ad || 'Veli'}
                  </h3>
                  <p className="text-xs text-slate-400">{currentUser.email}</p>
                  <span className="inline-block mt-1 bg-purple-500/20 text-purple-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-purple-500/30">
                    Veli Hesabı (Eğitim Takipçisi)
                  </span>
                </div>
              </div>

              {/* Linked Student Code Section */}
              <div className={`p-4 rounded-2xl border space-y-2 ${
                theme === 'dark' ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-400">Bağlı Öğrenci:</span>
                  <span className={`font-black text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    {studentDisplayName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-400">Öğrenci Kodu:</span>
                  <span className="font-mono font-black text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                    {currentUser.linkedStudentCode || 'EK-XXXXXX'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinkModal(true)}
                  className="w-full mt-2 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white text-xs font-black border border-purple-500/30 transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">link</span>
                  <span>Öğrenci Kodunu Değiştir veya Yeniden Bağla</span>
                </button>
              </div>
            </div>

            {/* 2. Notification Preferences */}
            <div className={`p-5 rounded-3xl border space-y-4 shadow-md ${
              theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">notifications</span>
                <h4 className={`font-black text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Veli Bildirim Ayarları
                </h4>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
                  <div>
                    <span className={`text-xs font-black block ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Günlük Ders Tamamlama Bildirimi
                    </span>
                    <span className="text-[11px] text-slate-400">Öğrenciniz günlük programını bitirdiğinde özet alın</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifDailyReport}
                    onChange={(e) => {
                      setNotifDailyReport(e.target.checked);
                      localStorage.setItem('parent_pref_daily_report', String(e.target.checked));
                      showToast(e.target.checked ? '🔔 Günlük bildirim açıldı.' : '🔕 Günlük bildirim kapatıldı.');
                    }}
                    className="w-5 h-5 accent-purple-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
                  <div>
                    <span className={`text-xs font-black block ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Canlı Pomodoro Odaklanma Bildirimi
                    </span>
                    <span className="text-[11px] text-slate-400">Öğrenci masa başında odaklanma seansına başladığında bildirim gönder</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifLiveFocus}
                    onChange={(e) => {
                      setNotifLiveFocus(e.target.checked);
                      localStorage.setItem('parent_pref_live_focus', String(e.target.checked));
                      showToast(e.target.checked ? '🔔 Pomodoro bildirimi açıldı.' : '🔕 Pomodoro bildirimi kapatıldı.');
                    }}
                    className="w-5 h-5 accent-purple-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-2xl cursor-pointer hover:bg-white/5 transition-colors">
                  <div>
                    <span className={`text-xs font-black block ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Deneme Sınavı Net Bildirimi
                    </span>
                    <span className="text-[11px] text-slate-400">Yeni bir deneme neti kaydedildiğinde anında bilgilendiril</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifDenemeResult}
                    onChange={(e) => {
                      setNotifDenemeResult(e.target.checked);
                      localStorage.setItem('parent_pref_deneme_result', String(e.target.checked));
                      showToast(e.target.checked ? '🔔 Deneme bildirimi açıldı.' : '🔕 Deneme bildirimi kapatıldı.');
                    }}
                    className="w-5 h-5 accent-purple-600 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* 3. Theme & Display Settings */}
            <div className={`p-5 rounded-3xl border space-y-4 shadow-md ${
              theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">palette</span>
                <h4 className={`font-black text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Görünüm ve Tema Ayarı
                </h4>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl">
                <div>
                  <span className={`text-xs font-black block ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Uygulama Teması
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Şu an: <strong>{theme === 'dark' ? 'Koyu Mod (Dark)' : 'Açık Mod (Light)'}</strong>
                  </span>
                </div>
                {onToggleTheme && (
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                    </span>
                    <span>{theme === 'dark' ? 'Açık Moda Geç' : 'Koyu Moda Geç'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4. Security & Account Actions */}
            <div className={`p-5 rounded-3xl border space-y-4 shadow-md ${
              theme === 'dark' ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-400">security</span>
                <h4 className={`font-black text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Güvenlik & Hesap Yönetimi
                </h4>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={isSendingPasswordReset}
                  onClick={handleSendPasswordReset}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between text-xs font-black transition-all cursor-pointer active:scale-95 ${
                    theme === 'dark'
                      ? 'bg-slate-950 border-white/10 hover:border-purple-400 text-slate-200 hover:text-white'
                      : 'bg-slate-50 border-slate-200 hover:border-purple-400 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-400 text-base">lock_reset</span>
                    <span>Şifre Sıfırlama E-postası Gönder</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {isSendingPasswordReset ? 'Gönderiliyor...' : 'Gönder →'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full p-3 rounded-2xl border border-white/10 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-black transition-all cursor-pointer flex items-center justify-between active:scale-95"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base">logout</span>
                    <span>Oturumu Kapat</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Çıkış →</span>
                </button>

                {onDeleteAccount && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="w-full p-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white text-xs font-black transition-all cursor-pointer flex items-center justify-between active:scale-95"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">delete_forever</span>
                      <span>Veli Hesabımı Kalıcı Olarak Sil</span>
                    </div>
                    <span className="text-[11px]">Sil →</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* -------------------- BOTTOM NAVIGATION BAR -------------------- */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-md px-2 py-2 flex items-center justify-around shadow-2xl ${
        theme === 'dark' ? 'bg-slate-900/95 border-white/10' : 'bg-white/95 border-slate-200'
      }`}>
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'text-purple-400 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-xl">dashboard</span>
          <span className="text-[10px] font-bold mt-0.5">Genel Bakış</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'schedule'
              ? 'text-purple-400 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-xl">calendar_month</span>
          <span className="text-[10px] font-bold mt-0.5">Ders Programı</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'analytics'
              ? 'text-purple-400 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-xl">monitoring</span>
          <span className="text-[10px] font-bold mt-0.5">Başarı & Analiz</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'text-purple-400 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-xl">person</span>
          <span className="text-[10px] font-bold mt-0.5">Profil & Ayarlar</span>
        </button>
      </nav>

      {/* Modal: Change / Link Student Code */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-purple-500/30 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-black text-sm text-white flex items-center gap-2">
                <span>🔗 Öğrenci Kodu Bağla</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              Öğrencinizin Eğitim Koçum uygulamasındaki (<strong className="text-purple-300 font-bold">Profil &gt; Veli Bağlantısı</strong>) ekranında yer alan 6 haneli kodu yazın:
            </p>

            <input
              type="text"
              value={linkCodeInput}
              onChange={(e) => setLinkCodeInput(e.target.value.toUpperCase())}
              placeholder="Örn: EK-748291"
              maxLength={10}
              className="w-full bg-white text-slate-900 border-2 border-purple-400 rounded-xl px-4 py-3 text-base font-mono font-black placeholder:text-slate-400 tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-md"
            />

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLinkModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={isLinking || !linkCodeInput.trim()}
                onClick={() => handleLinkStudent(linkCodeInput)}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isLinking ? 'Bağlanıyor...' : 'Bağla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Account Confirmation */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-2xl mx-auto">
              ⚠️
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-black text-base text-white">Hesabınızı Silmek İstiyor musunuz?</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Veli hesabınız ve öğrenci bağlantınız kalıcı olarak silinecektir. Bu işlem geri alınamaz.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowDeleteModal(false);
                  if (onDeleteAccount) {
                    await onDeleteAccount();
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md transition-all cursor-pointer active:scale-95"
              >
                Evet, Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};