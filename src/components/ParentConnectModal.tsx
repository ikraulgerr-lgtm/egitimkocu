import React, { useState, useEffect } from 'react';
import { Kullanici, DersProgramiItem, Soru } from '../types';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

interface ParentConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Kullanici;
  scheduleItems: DersProgramiItem[];
  questions: Soru[];
  showToast: (msg: string) => void;
  onUpdateUser?: (updated: Kullanici) => void;
}

export const ParentConnectModal: React.FC<ParentConnectModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  showToast,
  onUpdateUser,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [connectedParentName, setConnectedParentName] = useState<string>(
    currentUser.parentName || localStorage.getItem('connected_parent_name') || ''
  );

  // Generate or retrieve persistent student invite code
  const studentCode = React.useMemo(() => {
    if (currentUser.parentInviteCode) return currentUser.parentInviteCode;
    const existing = localStorage.getItem('edumind_parent_invite_code');
    if (existing) return existing;
    const generated = 'EK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('edumind_parent_invite_code', generated);
    return generated;
  }, [currentUser.parentInviteCode]);

  // Sync student code to Firestore so parent can query it
  useEffect(() => {
    if (currentUser?.id && studentCode) {
      setDoc(doc(db, 'users', currentUser.id), {
        parentInviteCode: studentCode,
      }, { merge: true }).catch(() => {});
      if (onUpdateUser && !currentUser.parentInviteCode) {
        onUpdateUser({
          ...currentUser,
          parentInviteCode: studentCode,
        });
      }
    }
  }, [currentUser?.id, studentCode]);

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
    const shareText = `Merhaba! Çocuğunuz ${currentUser.ad || 'öğrenciniz'}, Eğitim Koçum uygulamasındaki ders çalışma programını, çözdüğü soruları ve gelişimini sizinle paylaşmak için sizi velisi olarak davet ediyor.\n\nTakip Kodu: ${studentCode}\n\nUygulamayı açıp Veli Girişi ile bu kodu girerek canlı takibe başlayabilirsiniz.`;

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
                Veli Davet Et & Takip Bağlantısı
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Ders programın, çözdüğün sorular ve gelişimin velinle güvenle paylaşılır.
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

        {/* Student Invite View Content */}
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
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                  ÖĞRENCİ TAKİP KODUNUZ
                </span>
                <p className="text-2xl font-black font-mono tracking-widest text-primary">
                  {studentCode}
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ${
                  isCopied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-primary hover:bg-primary-hover text-white'
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {isCopied ? 'done' : 'content_copy'}
                </span>
                <span>{isCopied ? 'Kopyalandı!' : 'Kodu Kopyala'}</span>
              </button>
            </div>

            {/* Share via WhatsApp / Native Share Button */}
            <button
              type="button"
              onClick={handleShareInvite}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">share</span>
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

        {/* Footer */}
        <div className="pt-2 border-t border-card-border text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-text-main font-bold text-xs transition-all cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
