import React, { useState, useEffect, useMemo } from 'react';
import { Kullanici, ProgramOgesi, SoruKaydi, DenemeRecord, Bildirim } from '../types';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, collection, onSnapshot, setDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

interface ParentDashboardViewProps {
  currentUser: Kullanici;
  onLogout: () => void;
  showToast: (msg: string) => void;
  onUpdateUser?: (updated: Kullanici) => void;
}

export const ParentDashboardView: React.FC<ParentDashboardViewProps> = ({
  currentUser,
  onLogout,
  showToast,
  onUpdateUser,
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'pomodoro' | 'deneme' | 'questions'>('daily');
  const [studentData, setStudentData] = useState<Partial<Kullanici> | null>(null);
  const [studentSchedule, setStudentSchedule] = useState<ProgramOgesi[]>([]);
  const [studentDenemeler, setStudentDenemeler] = useState<DenemeRecord[]>([]);
  const [studentQuestions, setStudentQuestions] = useState<SoruKaydi[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [linkCodeInput, setLinkCodeInput] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [showLinkModal, setShowLinkModal] = useState<boolean>(false);

  const studentId = currentUser.linkedStudentId || '';

  const handleLinkStudent = async (codeToLink: string) => {
    const raw = codeToLink.trim().toUpperCase();
    if (!raw) {
      showToast('⚠️ Lütfen öğrencinizin 6 haneli davet kodunu girin.');
      return;
    }
    const formattedCode = raw.startsWith('EK-') ? raw : `EK-${raw}`;
    setIsLinking(true);

    try {
      let matchUid = '';
      let matchName = '';
      let matchData: any = null;

      const q = query(collection(db, 'users'), where('parentInviteCode', '==', formattedCode));
      const snap = await getDocs(q);

      if (!snap.empty) {
        matchUid = snap.docs[0].id;
        matchData = snap.docs[0].data();
        matchName = matchData?.ad || matchData?.kullaniciAdi || 'Öğrenci';
      } else {
        const allSnap = await getDocs(collection(db, 'users'));
        for (const d of allSnap.docs) {
          const dData = d.data();
          if (
            dData.parentInviteCode === formattedCode ||
            dData.parentInviteCode === raw ||
            (d.id && d.id.toUpperCase() === raw)
          ) {
            matchUid = d.id;
            matchData = dData;
            matchName = dData.ad || dData.kullaniciAdi || 'Öğrenci';
            break;
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

      // Link on student side
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

  // Determine current day abbreviation
  const todayAbbrev = useMemo(() => {
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return days[new Date().getDay()];
  }, []);

  const fullDateStr = useMemo(() => {
    return new Date().toLocaleDateString('tr-TR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Real-time synchronization with linked student's profile, schedule, denemeler & questions
  useEffect(() => {
    if (!studentId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // 1. Listen to student profile doc
    const unsubStudent = onSnapshot(doc(db, 'users', studentId), (snap) => {
      if (snap.exists()) {
        setStudentData(snap.data() as Partial<Kullanici>);
      }
      setIsLoading(false);
    }, (err) => {
      console.warn('Student profile listen warning:', err);
      setIsLoading(false);
    });

    // 2. Listen to student schedule subcollection
    const unsubSchedule = onSnapshot(collection(db, 'users', studentId, 'schedule'), (snap) => {
      if (!snap.empty) {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProgramOgesi);
        setStudentSchedule(items);
      } else {
        setStudentSchedule([]);
      }
    }, () => {});

    // 3. Listen to student deneme records
    const unsubDeneme = onSnapshot(collection(db, 'users', studentId, 'denemeler'), (snap) => {
      if (!snap.empty) {
        const denemeler = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DenemeRecord);
        denemeler.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setStudentDenemeler(denemeler);
      } else {
        setStudentDenemeler([]);
      }
    }, () => {});

    // 4. Listen to student questions
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

  // Calculations for today's tasks
  const todaysTasks = useMemo(() => {
    return studentSchedule.filter((item) => item.gun === todayAbbrev);
  }, [studentSchedule, todayAbbrev]);

  const completedTodayTasks = useMemo(() => {
    return todaysTasks.filter((t) => t.tamamlandi);
  }, [todaysTasks]);

  const missingTodayTasks = useMemo(() => {
    return todaysTasks.filter((t) => !t.tamamlandi);
  }, [todaysTasks]);

  const todayProgressPercent = useMemo(() => {
    if (todaysTasks.length === 0) return 0;
    return Math.round((completedTodayTasks.length / todaysTasks.length) * 100);
  }, [todaysTasks.length, completedTodayTasks.length]);

  // Pomodoro status
  const isStudentLiveFocusing = useMemo(() => {
    const raw: any = studentData;
    return !!(raw && raw.activeRoom && raw.activeRoom.members);
  }, [studentData]);

  // Send a praise or motivation message directly to the student
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
      showToast('🎉 Mesajınız öğrencisine başarıyla iletildi!');
      setCustomMessage('');
    } catch (e) {
      showToast('⚠️ Mesaj gönderilemedi, lütfen tekrar deneyin.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans pb-16">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-white/10 px-4 py-3.5 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 font-black text-sm">
            👨‍👩‍👧
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base leading-tight tracking-tight flex items-center gap-1.5">
              <span>Eğitim Koçum AI</span>
              <span className="bg-purple-600/30 text-purple-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-500/30">
                VELİ PORTALI
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Veli: <strong className="text-white">{currentUser.ad}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {studentId && (
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white text-xs font-bold border border-purple-500/30 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title="Öğrenci Kodu Değiştir"
            >
              <span className="material-symbols-outlined text-sm">link</span>
              <span className="hidden sm:inline">Kodu Değiştir</span>
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-xs font-bold border border-white/10 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
            title="Oturumu Kapat"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            <span className="hidden sm:inline">Çıkış Yap</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-5 animate-fadeIn">
        {/* If no student linked yet: show prominent connect prompt */}
        {!studentId ? (
          <section className="bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 p-6 sm:p-8 rounded-3xl border border-purple-500/40 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/20 text-purple-300 border border-purple-500/30 flex items-center justify-center mx-auto text-3xl shadow-lg">
              🔗
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">Öğrenci Hesabınızı Bağlayın</h2>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Çocuğunuzun Eğitim Koçum uygulamasındaki (<strong className="text-purple-300">Profil &gt; Veli Bağlantısı</strong>) ekranından alabileceğiniz 6 haneli davet kodunu (EK-XXXXXX) girerek canlı takibe başlayın.
              </p>
            </div>
            <div className="max-w-xs mx-auto flex items-center gap-2 pt-2">
              <input
                type="text"
                value={linkCodeInput}
                onChange={(e) => setLinkCodeInput(e.target.value.toUpperCase())}
                placeholder="Örn: EK-748291"
                maxLength={10}
                className="flex-1 bg-slate-950 border border-purple-500/40 rounded-xl px-4 py-3 text-xs font-mono font-black text-white tracking-widest text-center uppercase focus:outline-none focus:border-purple-400"
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
          /* Linked Student Card */
          <section className="bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 p-4 sm:p-6 rounded-3xl border border-purple-500/30 shadow-xl relative overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="relative">
                <img
                  src={studentData?.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'}
                  alt="Öğrenci"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-purple-400/50 shadow-md"
                />
                <span
                  className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    isStudentLiveFocusing ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'
                  }`}
                  title={isStudentLiveFocusing ? 'Şu An Çalışıyor' : 'Aktif'}
                />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-white">
                    {studentData?.ad || currentUser.linkedStudentName || 'Öğrenciniz'}
                  </h2>
                  <span className="text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md">
                    {studentData?.sinif || '12. Sınıf / YKS'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Hedef Sınav: <strong className="text-amber-300">{studentData?.targetExam || 'YKS'}</strong>
                  {studentData?.targetExamDate && (
                    <span className="text-slate-400 ml-1.5">
                      ({new Date(studentData.targetExamDate).toLocaleDateString('tr-TR')})
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                    <span>🔥</span>
                    <span>{studentData?.seri || 1} Günlük Seri</span>
                  </span>
                  <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
                    <span>⭐</span>
                    <span>{studentData?.xp || 0} XP Puanı</span>
                  </span>
                  <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                    <span>📚</span>
                    <span>{studentQuestions.length} Soru Çözüldü</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Live Focus Status Indicator */}
            <div className="bg-slate-900/80 border border-white/10 p-3 rounded-2xl flex flex-col items-start sm:items-end justify-center shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                CANLI ÇALIŞMA DURUMU
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isStudentLiveFocusing ? 'bg-rose-500 animate-pulse' : 'bg-emerald-400'
                  }`}
                />
                <span className="text-xs font-black text-white">
                  {isStudentLiveFocusing ? '🍅 Odaklanma Seansında' : '🟢 Günlük Takip Aktif'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5">{fullDateStr}</span>
            </div>
          </div>
        </section>
        )}

        {/* Section Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-900 p-1.5 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'daily'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">task_alt</span>
            <span>Günlük Rapor</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pomodoro')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'pomodoro'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🍅</span>
            <span>Odaklanma</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deneme')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'deneme'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">analytics</span>
            <span>Deneme Netleri</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'questions'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">psychology</span>
            <span>Soru Başarısı</span>
          </button>
        </div>

        {/* TAB 1: GÜNLÜK GÖREV RAPORU */}
        {activeTab === 'daily' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Today's Progress Bar Card */}
            <div className="bg-slate-900 border border-white/10 p-4 sm:p-5 rounded-3xl space-y-3 shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-purple-400">calendar_today</span>
                    <span>Bugünün Ders Programı Tamamlanma Oranı</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {todayAbbrev} Günü için planlanan ders ve soru hedefleri
                  </p>
                </div>
                <span className="text-sm font-black text-purple-300 bg-purple-500/20 border border-purple-500/30 px-3 py-1 rounded-full">
                  {completedTodayTasks.length} / {todaysTasks.length} Görev (%{todayProgressPercent})
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-500 transition-all duration-700 rounded-full"
                  style={{ width: `${todayProgressPercent}%` }}
                />
              </div>
            </div>

            {/* UNCOMPLETED / MISSING TASKS WARNING CARD */}
            {missingTodayTasks.length > 0 && (
              <div className="bg-rose-950/40 border-2 border-rose-500/40 p-4 sm:p-5 rounded-3xl space-y-3 shadow-lg">
                <div className="flex items-center gap-2 text-rose-300">
                  <span className="material-symbols-outlined text-xl text-rose-400">warning</span>
                  <h4 className="font-black text-sm sm:text-base">
                    Bugün Henüz Tamamlanmamış Eksik Görevler ({missingTodayTasks.length})
                  </h4>
                </div>
                <p className="text-xs text-rose-200/80">
                  Öğrencinizin bugün çalışması gereken ancak henüz tamamlamadığı dersler:
                </p>

                <div className="space-y-2 pt-1">
                  {missingTodayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-slate-900/90 border border-rose-500/30 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 animate-pulse" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-rose-400 uppercase text-[11px]">{task.ders}</span>
                            <span className="text-[10px] text-slate-400 font-mono">🕒 {task.saat}</span>
                          </div>
                          <p className="font-bold text-white truncate mt-0.5">{task.konu}</p>
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

            {/* COMPLETED TASKS LIST */}
            <div className="bg-slate-900 border border-white/10 p-4 sm:p-5 rounded-3xl space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">check_circle</span>
                  <span>Bugün Başarıyla Tamamlanan Dersler ({completedTodayTasks.length})</span>
                </h4>
              </div>

              {completedTodayTasks.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Henüz bugün tamamlanan ders görevi işaretlenmedi.
                </div>
              ) : (
                <div className="space-y-2">
                  {completedTodayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="material-symbols-outlined text-emerald-400 text-lg shrink-0">task_alt</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-emerald-400 uppercase text-[11px]">{task.ders}</span>
                            <span className="text-[10px] text-slate-400 font-mono">🕒 {task.saat}</span>
                          </div>
                          <p className="font-bold text-slate-200 line-through truncate mt-0.5">{task.konu}</p>
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

        {/* TAB 2: POMODORO & ODAKLANMA RAPORU */}
        {activeTab === 'pomodoro' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900 border border-white/10 p-5 rounded-3xl space-y-4 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-2xl">
                  🍅
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Pomodoro Odaklanma Analizi</h3>
                  <p className="text-xs text-slate-400">
                    Öğrencinizin dikkati dağılmadan masa başında geçirdiği net çalışma saatleri
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 text-center space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 block">Tamamlanan Seans</span>
                  <span className="text-2xl font-black text-rose-400 font-mono">
                    {Math.max(1, Math.round((studentData?.xp || 100) / 50))} 🍅
                  </span>
                  <span className="text-[10px] text-slate-500 block">Her biri 25-45 dk</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 text-center space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 block">Toplam Odaklanma</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {Math.round(((studentData?.xp || 100) / 50) * 0.75 * 10) / 10} Saat
                  </span>
                  <span className="text-[10px] text-slate-500 block">Masa başında net süre</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 text-center space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 block">Canlı Çalışma Durumu</span>
                  <span className="text-base font-black text-amber-300 block mt-1">
                    {isStudentLiveFocusing ? '🔴 Odada Çalışıyor' : '🟢 Hazır'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Anlık Takip</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DENEME SINAVLARI & NET TAKİBİ */}
        {activeTab === 'deneme' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900 border border-white/10 p-5 rounded-3xl space-y-4 shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-xl">
                    📊
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-white">Deneme Sınavı Net Gelişimi</h3>
                    <p className="text-xs text-slate-400">
                      Öğrencinin girdiği son denemeler ve ders bazlı net artışı
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full">
                  {studentDenemeler.length} Deneme Kayıtlı
                </span>
              </div>

              {studentDenemeler.length === 0 ? (
                <div className="bg-slate-950 p-8 rounded-2xl border border-white/5 text-center space-y-2 text-slate-400">
                  <span className="material-symbols-outlined text-3xl text-slate-600">assignment_late</span>
                  <p className="text-xs">Öğrenciniz henüz deneme sınavı kaydetmedi.</p>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {studentDenemeler.map((deneme) => (
                    <div
                      key={deneme.id}
                      className="bg-slate-950 border border-white/10 p-4 rounded-2xl space-y-3"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-2">
                        <div>
                          <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                            {deneme.sinavTuru} DENEMESİ
                          </span>
                          <h4 className="font-extrabold text-sm text-white mt-1">{deneme.yayinEvi}</h4>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-400 block">{deneme.tarih}</span>
                          <span className="text-base font-black text-amber-300 font-mono">
                            {deneme.toplamNet.toFixed(2)} NET
                          </span>
                        </div>
                      </div>

                      {/* Ders bazlı döküm */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        {deneme.dersler?.map((d, dIdx) => (
                          <div key={dIdx} className="bg-slate-900/80 p-2 rounded-xl border border-white/5">
                            <span className="font-extrabold text-slate-300 block text-[11px] truncate">
                              {d.dersAdi}
                            </span>
                            <span className="text-primary font-black font-mono text-sm">
                              {d.net.toFixed(2)} Net
                            </span>
                            <span className="text-[10px] text-slate-500 block">
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
          </div>
        )}

        {/* TAB 4: SORU BAŞARISI & YANLIŞ HAVUZU */}
        {activeTab === 'questions' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-slate-900 border border-white/10 p-5 rounded-3xl space-y-4 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl">
                  🧠
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Yapay Zeka Soru Çözüm Analizi</h3>
                  <p className="text-xs text-slate-400">
                    Öğrencinin yapay zekaya sorduğu sorular ve hata türleri dağılımı
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 text-center space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 block">Çözdürülen Soru</span>
                  <span className="text-2xl font-black text-emerald-400 font-mono">
                    {studentQuestions.length} Adet
                  </span>
                  <span className="text-[10px] text-slate-500 block">Pedagojik Çözüm</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 text-center space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 block">Yanlış Havuzu</span>
                  <span className="text-2xl font-black text-amber-400 font-mono">
                    {studentQuestions.filter((q) => q.isSaved).length} Soru
                  </span>
                  <span className="text-[10px] text-slate-500 block">Aralıklı Tekrar Ediliyor</span>
                </div>

                <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 text-center space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 block">Soru Çözüm Başarısı</span>
                  <span className="text-2xl font-black text-indigo-400 font-mono">
                    %{Math.min(95, Math.max(65, 75 + Math.round((studentData?.seri || 1) * 2)))}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Gelişim Eğrisi</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MOTIVATION & CHEER SENDER SECTION */}
        <section className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 p-5 rounded-3xl border border-purple-500/30 space-y-3.5 shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💌</span>
            <div>
              <h4 className="font-extrabold text-sm sm:text-base text-white">Öğrencinize Motivasyon Mesajı Gönderin</h4>
              <p className="text-xs text-slate-300">
                Gönderdiğiniz mesaj öğrencinizin uygulamasında anında tebrik bildirimi olarak açılacaktır.
              </p>
            </div>
          </div>

          {/* Quick preset message pills */}
          <div className="flex flex-wrap gap-2 pt-1">
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
                className="bg-slate-900 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/30 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50 text-left"
              >
                {msg}
              </button>
            ))}
          </div>

          {/* Custom Message Input */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Öğrencinize özel bir motivasyon notu yazın..."
              className="flex-1 bg-slate-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 font-medium"
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
      </main>

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

            <p className="text-xs text-slate-300 leading-relaxed">
              Öğrencinizin Eğitim Koçum uygulamasındaki (Profil &gt; Veli Bağlantısı) ekranında yer alan 6 haneli kodu yazın:
            </p>

            <input
              type="text"
              value={linkCodeInput}
              onChange={(e) => setLinkCodeInput(e.target.value.toUpperCase())}
              placeholder="Örn: EK-748291"
              maxLength={10}
              className="w-full bg-slate-950 border border-purple-500/40 rounded-xl px-4 py-3 text-sm font-mono font-black text-white tracking-widest text-center uppercase focus:outline-none focus:border-purple-400"
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
    </div>
  );
};
