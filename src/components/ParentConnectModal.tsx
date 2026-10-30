import React, { useState, useEffect, useMemo } from 'react';
import { Kullanici, ProgramOgesi, SoruKaydi } from '../types';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ParentConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Kullanici;
  scheduleItems: ProgramOgesi[];
  questions: SoruKaydi[];
  showToast: (msg: string) => void;
  onUpdateUser?: (updated: Kullanici) => void;
}

export const ParentConnectModal: React.FC<ParentConnectModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  scheduleItems,
  questions,
  showToast,
  onUpdateUser,
}) => {
  const [activeTab, setActiveTab] = useState<'student_invite' | 'parent_view'>('student_invite');
  const [inputCode, setInputCode] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Generate or retrieve persistent student invite code
  const studentCode = React.useMemo(() => {
    if (currentUser.parentInviteCode) return currentUser.parentInviteCode;
    const existing = localStorage.getItem('student_parent_invite_code');
    if (existing) return existing;
    const generated = 'EK-' + Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem('student_parent_invite_code', generated);
    return generated;
  }, [currentUser.parentInviteCode]);

  // Track connected parent info in localStorage or user state
  const [connectedParentName, setConnectedParentName] = useState<string>(() => {
    return localStorage.getItem('connected_parent_name') || currentUser.parentName || '';
  });

  // Ensure persistent student invite code is recorded in Firestore
  useEffect(() => {
    if (currentUser?.id && studentCode && currentUser.parentInviteCode !== studentCode) {
      setDoc(doc(db, 'users', currentUser.id), {
        parentInviteCode: studentCode,
      }, { merge: true }).catch(() => {});
      if (onUpdateUser) {
        onUpdateUser({
          ...currentUser,
          parentInviteCode: studentCode,
        });
      }
    }
  }, [currentUser?.id, studentCode]);

  // Calculate live statistics for parent review
  const todayAbbrev = useMemo(() => {
    const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    return days[new Date().getDay()];
  }, []);

  const todaysTasks = useMemo(() => {
    return scheduleItems.filter((t) => t.gun === todayAbbrev);
  }, [scheduleItems, todayAbbrev]);

  const completedTodayTasks = todaysTasks.filter((t) => t.tamamlandi).length;
  const progressPercent = todaysTasks.length > 0 ? Math.round((completedTodayTasks / todaysTasks.length) * 100) : 0;

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(studentCode);
      setIsCopied(true);
      showToast('📋 Veli davet kodu panoya kopyalandı!');
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      showToast(`Davet Kodu: ${studentCode}`);
    }
  };

  const handleShareInvite = async () => {
    const shareText = `Merhaba! Çocuğunuz ${currentUser.ad || 'öğrenciniz'}, Eğitim Koçum uygulamasındaki ders çalışma programını, çözdüğü soruları ve gelişimini sizinle paylaşmak için sizi velisi olarak davet ediyor.\n\nTakip Kodu: ${studentCode}\n\nUygulamayı açıp Veli Takip ekranına bu kodu girerek canlı takibe başlayabilirsiniz.`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: 'Eğitim Koçum - Veli Daveti',
          text: shareText,
          dialogTitle: 'Veli Davetini Paylaş',
        });
        return;
      } catch {}
    }

    // Web Fallback: WhatsApp share link
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleLinkParentCode = () => {
    const cleaned = inputCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!cleaned) {
      showToast('⚠️ Lütfen öğrencinizin 6 haneli kodunu girin.');
      return;
    }

    const cleanStudentCode = studentCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const coreClean = cleaned.startsWith('EK') ? cleaned.slice(2) : cleaned;
    const coreStudent = cleanStudentCode.startsWith('EK') ? cleanStudentCode.slice(2) : cleanStudentCode;

    if (coreClean === coreStudent) {
      const parentName = 'Veli Hesabı';
      setConnectedParentName(parentName);
      localStorage.setItem('connected_parent_name', parentName);
      if (onUpdateUser) {
        onUpdateUser({
          ...currentUser,
          parentConnected: true,
          parentName,
          parentInviteCode: studentCode,
        });
      }
      showToast(`🎉 Tebrikler! ${currentUser.ad} adlı öğrencinin hesabı başarıyla bağlandı.`);
      setActiveTab('parent_view');
    } else {
      showToast('⚠️ Girdiğiniz kod bulunamadı veya geçersiz. Lütfen öğrencinizin kodunu kontrol edin.');
    }
  };

  const handleSendPraise = () => {
    showToast('💌 Öğrenciye tebrik ve motivasyon bildirimi gönderildi: "Harikasın, seninle gurur duyuyorum! 👏"');
  };

  const handleDisconnect = () => {
    setConnectedParentName('');
    localStorage.removeItem('connected_parent_name');
    if (onUpdateUser) {
      onUpdateUser({
        ...currentUser,
        parentConnected: false,
        parentName: '',
      });
    }
    showToast('Veli bağlantısı kaldırıldı.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-card-bg border border-card-border rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] flex flex-col space-y-5 text-text-main">
        {/* Header with Close */}
        <div className="flex items-start justify-between gap-3 border-b border-card-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
              <span className="material-symbols-outlined text-2xl">family_restroom</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-text-main leading-tight">
                Veli Bağlantısı & Öğrenci Takip Modu
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Öğrencinin ders programı, çözülen soruları ve gelişimi velisiyle canlı paylaşılır.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-surface-container-low hover:bg-surface-container text-text-muted hover:text-text-main flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container-low rounded-2xl border border-card-border">
          <button
            type="button"
            onClick={() => setActiveTab('student_invite')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'student_invite'
                ? 'bg-card-bg text-primary shadow-xs border border-card-border'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <span className="material-symbols-outlined text-base">person_add</span>
            <span>Veli Davet Et (Öğrenci)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('parent_view')}
            className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'parent_view'
                ? 'bg-card-bg text-primary shadow-xs border border-card-border'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <span className="material-symbols-outlined text-base">monitoring</span>
            <span>Veli Takip Paneli</span>
          </button>
        </div>

        {/* Tab 1: Student Invite View */}
        {activeTab === 'student_invite' && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="bg-gradient-to-tr from-purple-500/10 via-indigo-500/10 to-primary/10 border border-purple-500/25 p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-extrabold text-xs">
                <span className="material-symbols-outlined text-lg">shield</span>
                <span>Güvenli & Şeffaf Öğrenci Takibi</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Veliniz bu davet koduyla bağlandığında ders çalışma programı tamamlama durumunuzu, çözdüğünüz soruları ve haftalık deneme analizlerinizi anlık olarak takip edebilir.
              </p>

              {/* Student Unique Code Box */}
              <div className="bg-card-bg p-4 rounded-xl border border-card-border flex items-center justify-between gap-3 shadow-inner">
                <div>
                  <span className="text-[10px] font-black uppercase text-text-muted block">
                    Öğrenci Takip Kodunuz:
                  </span>
                  <span className="text-xl sm:text-2xl font-black font-mono tracking-widest text-primary">
                    {studentCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-base">
                    {isCopied ? 'check' : 'content_copy'}
                  </span>
                  <span>{isCopied ? 'Kopyalandı' : 'Kopyala'}</span>
                </button>
              </div>

              {/* Share Buttons */}
              <button
                type="button"
                onClick={handleShareInvite}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="text-base">💬</span>
                <span>WhatsApp veya Mesaj ile Veliyi Davet Et</span>
              </button>
            </div>

            {/* Connection Status */}
            <div className="bg-surface-container-low p-4 rounded-2xl border border-card-border flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className={`w-3 h-3 rounded-full ${connectedParentName ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <div>
                  <span className="font-extrabold text-text-main block">
                    {connectedParentName ? `Bağlı Veli: ${connectedParentName}` : 'Henüz Veli Bağlanmadı'}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {connectedParentName ? 'Canlı takip ve raporlama aktif' : 'Davet kodunu velinizle paylaşarak bağlayın'}
                  </span>
                </div>
              </div>

              {connectedParentName && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                >
                  Bağlantıyı Kes
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Parent Monitoring View */}
        {activeTab === 'parent_view' && (
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* Input to connect student if not connected */}
            {!connectedParentName && (
              <div className="bg-surface-container-low p-4 rounded-2xl border border-card-border space-y-3">
                <label className="block text-xs font-extrabold text-text-main">
                  Öğrenci Takip Kodunu Girin:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    placeholder="Örn: EK-123456"
                    className="flex-1 bg-surface-container-low border-2 border-purple-500/50 rounded-xl px-3 py-2 text-xs font-mono font-bold text-text-main placeholder:text-text-muted uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleLinkParentCode}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    Bağlan
                  </button>
                </div>
              </div>
            )}

            {/* Student Live Dashboard Preview for Parents */}
            <div className="bg-card-bg border border-card-border p-4 rounded-2xl space-y-4 shadow-xs">
              {/* Student Header */}
              <div className="flex items-center justify-between pb-3 border-b border-card-border">
                <div className="flex items-center gap-3">
                  <img
                    src={currentUser.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix'}
                    alt="Öğrenci"
                    className="w-10 h-10 rounded-full border-2 border-primary object-cover"
                  />
                  <div>
                    <h4 className="font-extrabold text-sm text-text-main">
                      {currentUser.ad} {currentUser.sinif ? `(${currentUser.sinif})` : ''}
                    </h4>
                    <span className="text-[11px] font-bold text-primary">
                      Hedef Sınav: {currentUser.targetExam || 'YKS / Üniversite'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  ● Canlı Takip
                </span>
              </div>

              {/* Progress metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-surface-container-low p-3 rounded-xl border border-card-border">
                  <span className="text-[10px] text-text-muted block">Bugünkü Program Durumu:</span>
                  <div className="flex items-center justify-between mt-1">
                    <strong className="text-text-main font-black">
                      {completedTodayTasks} / {todaysTasks.length} Görev
                    </strong>
                    <span className="text-primary font-black">%{progressPercent}</span>
                  </div>
                  <div className="w-full h-1.5 bg-card-bg rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="bg-surface-container-low p-3 rounded-xl border border-card-border">
                  <span className="text-[10px] text-text-muted block">Toplam Çözülen Soru:</span>
                  <strong className="text-text-main font-black text-base block mt-1">
                    {questions.length} Soru
                  </strong>
                  <span className="text-[10px] text-rose-500 font-bold">
                    Yanlış Havuzu: {questions.filter((q) => q.isSaved).length} Soru
                  </span>
                </div>

                <div className="bg-surface-container-low p-3 rounded-xl border border-card-border">
                  <span className="text-[10px] text-text-muted block">Çalışma Serisi:</span>
                  <strong className="text-text-main font-black text-base block mt-1">
                    🔥 {currentUser.seri || 1} Gün
                  </strong>
                  <span className="text-[10px] text-text-muted">Kesintisiz Çalışma</span>
                </div>

                <div className="bg-surface-container-low p-3 rounded-xl border border-card-border">
                  <span className="text-[10px] text-text-muted block">Başarı Puanı (XP):</span>
                  <strong className="text-text-main font-black text-base block mt-1">
                    ⚡ {currentUser.xp || 0} XP
                  </strong>
                  <span className="text-[10px] text-text-muted">Gelişim Seviyesi</span>
                </div>
              </div>

              {/* Send Praise Button */}
              <button
                type="button"
                onClick={handleSendPraise}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-500 text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>👏</span>
                <span>Öğrenciye Tebrik & Motivasyon Gönder</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-card-border text-center">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-text-main font-bold text-xs transition-all cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
