import React, { useState } from 'react';
import { Kullanici, SoruKaydi, ActiveTab, Arkadas } from '../types';
import { calculateBadges, Rozet } from '../lib/badgeUtils';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const AVATAR_OPTIONS = [
  {
    id: 'avatar_1',
    name: '🎓 Derece Şampiyonu',
    url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
    tag: 'Öğrenci',
  },
  {
    id: 'avatar_2',
    name: '🤖 Eğitim Koçum AI',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=AiCoachMind&backgroundColor=4f46e5',
    tag: 'Yapay Zeka',
  },
  {
    id: 'avatar_3',
    name: '🚀 Uzay Kaşifi',
    url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=SpaceExplorer&backgroundColor=0284c7',
    tag: 'Fen',
  },
  {
    id: 'avatar_4',
    name: '📚 Kitap Kurdu',
    url: 'https://api.dicebear.com/7.x/notionists/svg?seed=BookWorm&backgroundColor=10b981',
    tag: 'Edebiyat',
  },
  {
    id: 'avatar_5',
    name: '🧪 Genç Bilim İnsanı',
    url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=ScienceMaster&backgroundColor=8b5cf6',
    tag: 'Kimya & Fizik',
  },
  {
    id: 'avatar_6',
    name: '⚡ Siber Odak',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberCyber&backgroundColor=f59e0b',
    tag: 'Odaklanma',
  },
  {
    id: 'avatar_7',
    name: '🎨 Yaratıcı Zeka',
    url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CreativeMind&backgroundColor=ec4899',
    tag: 'Sanat',
  },
  {
    id: 'avatar_8',
    name: '🏆 Süper Öğrenci',
    url: 'https://api.dicebear.com/7.x/open-peeps/svg?seed=SuperStudent&backgroundColor=14b8a6',
    tag: 'Derece',
  },
];

const SINIF_OPTIONS = [
  'YKS Sayısal Hazırlık',
  'YKS Eşit Ağırlık Hazırlık',
  'YKS Sözel Hazırlık',
  '12. Sınıf / Lise 4',
  '11. Sınıf / Lise 3',
  '10. Sınıf / Lise 2',
  '9. Sınıf / Lise 1',
  '8. Sınıf / LGS Hazırlık',
  'KPSS / ALES Hazırlık',
  'YÖKDİL / YDT İngilizce',
];

interface ProfileViewProps {
  user: Kullanici;
  questions?: SoruKaydi[];
  friends?: Arkadas[];
  onOpenNotifications: () => void;
  onOpenAuth: () => void;
  onOpenPremium: () => void;
  onCancelPremium?: () => void;
  onOpenInviteModal?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  onResetData?: () => void;
  onUpdateAvatar?: (newAvatarUrl: string) => void;
  onUpdateUser?: (updatedFields: Partial<Kullanici>) => void;
  onLogout?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  questions = [],
  friends = [],
  onOpenNotifications,
  onOpenAuth,
  onOpenPremium,
  onCancelPremium,
  onOpenInviteModal,
  theme,
  onToggleTheme,
  setActiveTab,
  onResetData,
  onUpdateAvatar,
  onUpdateUser,
  onLogout,
}) => {
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);
  const [isBadgesModalOpen, setIsBadgesModalOpen] = useState<boolean>(false);
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [selectedBadge, setSelectedBadge] = useState<Rozet | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);

  // Profile Settings States
  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'security' | 'notifications' | 'account'>('profile');
  const [editName, setEditName] = useState<string>(user.ad);
  const [editKullaniciAdi, setEditKullaniciAdi] = useState<string>(user.kullaniciAdi || 'ogrenci');
  const [editSinif, setEditSinif] = useState<string>(user.sinif || SINIF_OPTIONS[0]);
  const [editEmail, setEditEmail] = useState<string>(user.email || '');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Sync profile form state when user prop updates
  React.useEffect(() => {
    setEditName(user.ad);
    setEditKullaniciAdi(user.kullaniciAdi || 'ogrenci');
    setEditSinif(user.sinif || SINIF_OPTIONS[0]);
    setEditEmail(user.email || '');
  }, [user.ad, user.kullaniciAdi, user.sinif, user.email]);

  // Password Security Form States
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Security Toggles
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(false);
  const [weeklyReports, setWeeklyReports] = useState<boolean>(true);

  const totalSolved = questions.length;
  const savedErrorCount = questions.filter((q) => q.isSaved).length;
  const successRate = totalSolved > 0 ? Math.max(0, Math.round(((totalSolved - savedErrorCount) / totalSolved) * 100)) : 0;

  const badges = calculateBadges(user, questions, friends);
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const badgeProgressPct = Math.round((unlockedCount / badges.length) * 100);

  const filteredBadges = badges.filter((badge) => {
    if (badgeFilter === 'unlocked') return badge.unlocked;
    if (badgeFilter === 'locked') return !badge.unlocked;
    return true;
  });

  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);

  const handleCustomPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          if (onUpdateAvatar) {
            onUpdateAvatar(compressedDataUrl);
          }
        }
        setIsUploadingPhoto(false);
        setIsAvatarModalOpen(false);
      };
      img.onerror = () => setIsUploadingPhoto(false);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => setIsUploadingPhoto(false);
    reader.readAsDataURL(file);
  };

  const handleSelectAvatar = (url: string) => {
    if (onUpdateAvatar) {
      onUpdateAvatar(url);
    }
    setIsAvatarModalOpen(false);
  };

  const handleSaveProfileInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveErrorMsg(null);
    setSaveSuccessMsg(null);
    if (!editName.trim()) return;

    const cleanUsername = editKullaniciAdi.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 20) {
      setSaveErrorMsg('Kullanıcı adı en az 3, en fazla 20 karakter olmalı ve yalnızca küçük harf, rakam ve alt tire (_) içermelidir.');
      return;
    }

    // If username changed, check uniqueness in Firestore
    if (cleanUsername !== (user.kullaniciAdi || '').toLowerCase()) {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('kullaniciAdi_lower', '==', cleanUsername));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setSaveErrorMsg(`"@${cleanUsername}" kullanıcı adı zaten başkası tarafından alınmış.`);
          return;
        }
      } catch (err) {
        console.warn('Username check warning:', err);
      }
    }

    if (onUpdateUser) {
      onUpdateUser({
        ad: editName.trim(),
        kullaniciAdi: cleanUsername,
        kullaniciAdi_lower: cleanUsername,
        sinif: editSinif,
        email: editEmail.trim(),
      });
    }
    setSaveSuccessMsg('Profil bilgileriniz başarıyla güncellendi!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!currentPassword) {
      setPasswordFeedback({ type: 'error', msg: 'Lütfen mevcut şifrenizi girin.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', msg: 'Yeni şifre en az 6 karakter olmalıdır.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', msg: 'Yeni şifreler birbiriyle eşleşmiyor.' });
      return;
    }

    setPasswordFeedback({ type: 'success', msg: '🔒 Şifreniz başarıyla güncellendi!' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordFeedback(null), 4000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-32 animate-fadeIn">
      {/* Profile Header Banner */}
      <section className="bg-gradient-to-br from-indigo-800 via-indigo-900 to-slate-950 p-6 rounded-3xl text-white text-center shadow-lg relative overflow-hidden border border-indigo-700/50">
        <div className="relative z-10 space-y-3">
          {/* Avatar with Clickable Edit Overlay */}
          <div
            onClick={() => setIsAvatarModalOpen(true)}
            className="w-24 h-24 rounded-full mx-auto border-4 border-white/70 overflow-hidden shadow-2xl relative cursor-pointer group hover:scale-105 transition-all"
            title="Avatarı Değiştirmek İçin Tıkla"
          >
            <img src={user.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'} alt={user.ad} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
              <span className="material-symbols-outlined text-xl">photo_camera</span>
              <span className="text-[9px] font-extrabold uppercase tracking-wider">Değiştir</span>
            </div>
          </div>

          <div>
            <h2 className="font-extrabold text-2xl text-white flex items-center justify-center gap-2">
              <span>{user.ad}</span>
              <button
                onClick={() => setIsAvatarModalOpen(true)}
                className="text-white/80 hover:text-amber-300 transition-colors p-1 cursor-pointer"
                title="Avatar Galerisini Aç"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
              </button>
            </h2>

            {/* Username Badge */}
            <p className="text-xs font-mono text-indigo-200 mt-0.5">
              @{user.kullaniciAdi || 'ogrenci'}
            </p>

            <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
              <div className="inline-flex items-center gap-1 bg-slate-950/50 border border-white/30 backdrop-blur-md px-3 py-0.5 rounded-full text-xs font-black text-white shadow-xs">
                <span>🎓 {user.sinif}</span>
              </div>

              {user.isPremium ? (
                <span className="inline-flex items-center gap-1 bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full text-[10px] font-black shadow-xs">
                  ★ PRO ÜYE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-white/20 text-white px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                  Standart Plan
                </span>
              )}
            </div>

            {/* Logout / Switch Account Button directly under Profile Info */}
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={onLogout || onOpenAuth}
                className="inline-flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-300/40 text-rose-100 text-xs font-extrabold px-4 py-1.5 rounded-full transition-all cursor-pointer backdrop-blur-md active:scale-95 shadow-sm"
              >
                <span className="material-symbols-outlined text-base">logout</span>
                <span>Çıkış Yap / Hesap Değiştir</span>
              </button>
            </div>
          </div>
        </div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
      </section>

      {/* Academic Summary Cards */}
      <section className="space-y-2">
        <h3 className="font-extrabold text-base text-text-main">Akademik Özet</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Stat 1 */}
          <div className="bg-card-bg p-4 rounded-2xl border border-card-border flex items-center gap-3 shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">task_alt</span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-muted">Toplam Çözülen</p>
              <p className="font-black text-lg text-primary">{totalSolved}</p>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="bg-card-bg p-4 rounded-2xl border border-card-border flex items-center gap-3 shadow-xs border-l-4 border-l-secondary">
            <div className="w-11 h-11 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">query_stats</span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-muted">Başarı Oranı</p>
              <p className="font-black text-lg text-secondary">%{successRate}</p>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="bg-card-bg p-4 rounded-2xl border border-card-border flex items-center gap-3 shadow-xs border-l-4 border-l-rose-500">
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">error_outline</span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-muted">Yanlış Havuzu</p>
              <p className="font-black text-lg text-rose-500">{savedErrorCount} Soru</p>
            </div>
          </div>
        </div>
      </section>

      {/* CLEAN BADGES SUMMARY CARD (Collapsible behind button) */}
      <section className="bg-card-bg rounded-3xl p-5 border border-card-border space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-2xl border border-amber-500/20 shadow-xs">
              🏆
            </div>
            <div>
              <h3 className="font-extrabold text-base text-text-main flex items-center gap-2">
                <span>Başarı Rozetleri</span>
                <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  {unlockedCount} / {badges.length} Kazanıldı
                </span>
              </h3>
              <p className="text-xs text-text-muted">
                Öğrenme aktivitelerine göre kazandığın özel rozetler ve XP ödülleri.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsBadgesModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
          >
            <span className="material-symbols-outlined text-base">military_tech</span>
            <span>Rozetleri Gör ({unlockedCount}/{badges.length})</span>
          </button>
        </div>

        {/* Progress Bar & Mini Preview */}
        <div className="pt-2 border-t border-card-border/60 flex items-center justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-text-muted">
              <span>Rozet Kazanım Oranı</span>
              <span className="text-primary font-black">%{badgeProgressPct}</span>
            </div>
            <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden border border-card-border">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-primary rounded-full transition-all duration-500"
                style={{ width: `${badgeProgressPct}%` }}
              />
            </div>
          </div>

          {/* Mini Badges Preview */}
          <div className="flex items-center -space-x-2 shrink-0">
            {badges.filter((b) => b.unlocked).slice(0, 4).map((badge) => (
              <div
                key={badge.id}
                onClick={() => setSelectedBadge(badge)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs border-2 border-card-bg cursor-pointer hover:scale-110 transition-transform shadow-xs ${badge.bgRenk} ${badge.renk}`}
                title={badge.baslik}
              >
                <span className="material-symbols-outlined text-sm">{badge.icon}</span>
              </div>
            ))}
            {unlockedCount === 0 && (
              <span className="text-[10px] text-text-muted italic">Henüz rozet kazanılmadı</span>
            )}
          </div>
        </div>
      </section>

      {/* FULL-FEATURED PROFILE SETTINGS & SECURITY SECTION */}
      <section className="bg-card-bg rounded-3xl p-5 border border-card-border space-y-5 shadow-xs">
        <div className="border-b border-card-border pb-3 space-y-1">
          <h3 className="font-extrabold text-base text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">tune</span>
            <span>Profil ve Hesap Ayarları</span>
          </h3>
          <p className="text-xs text-text-muted">
            Profil bilgilerinizi, şifre ve güvenlik ayarlarınızı buradan yönetebilirsiniz.
          </p>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-surface-container-low rounded-2xl border border-card-border w-full">
          {[
            { id: 'profile' as const, label: 'Profil', icon: 'person' },
            { id: 'security' as const, label: 'Şifre', icon: 'lock' },
            { id: 'notifications' as const, label: 'Genel', icon: 'tune' },
            { id: 'account' as const, label: 'Abonelik', icon: 'card_membership' },
          ].map((tab) => {
            const isActive = activeSettingsTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSettingsTab(tab.id)}
                title={tab.label}
                className={`py-2 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                  isActive
                    ? 'flex-1 bg-primary text-white shadow-xs px-3.5 min-w-0'
                    : 'w-10 h-10 shrink-0 bg-transparent text-text-muted hover:text-text-main hover:bg-card-border/30'
                }`}
              >
                <span className="material-symbols-outlined text-lg shrink-0">{tab.icon}</span>
                {isActive && (
                  <span className="truncate text-xs font-black animate-fadeIn">
                    {tab.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: PROFiL BiLGiLERi */}
        {activeSettingsTab === 'profile' && (
          <form onSubmit={handleSaveProfileInfo} className="space-y-4 animate-fadeIn">
            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {saveErrorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{saveErrorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-text-main">Ad Soyad</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-surface-container-low border border-card-border rounded-xl p-3 text-xs text-text-main font-bold focus:outline-none focus:border-primary"
                  placeholder="Örn: Ahmet Yılmaz"
                  required
                />
              </div>

              {/* Unique Username field */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-text-main">Kullanıcı Adı (@)</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-base">
                    alternate_email
                  </span>
                  <input
                    type="text"
                    value={editKullaniciAdi}
                    onChange={(e) => setEditKullaniciAdi(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl p-3 pl-9 text-xs text-text-main font-bold focus:outline-none focus:border-primary font-mono"
                    placeholder="kullanici_adi"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-text-main">Sınıf / Sınav Hedefi</label>
                <select
                  value={editSinif}
                  onChange={(e) => setEditSinif(e.target.value)}
                  className="w-full bg-surface-container-low border border-card-border rounded-xl p-3 text-xs text-text-main font-bold focus:outline-none focus:border-primary"
                >
                  {SINIF_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-text-main block">
                  <span>E-Posta Adresi</span>
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-surface-container-low border border-card-border rounded-xl p-3 text-xs text-text-main font-bold focus:outline-none focus:border-primary"
                  placeholder="ogrenci@egitimkocum.ai"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-card-border">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="text-xs font-extrabold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">face</span>
                <span>Avatar Galerisi</span>
              </button>

              <button
                type="submit"
                className="bg-primary hover:bg-primary-hover text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Profil Bilgilerini Kaydet
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: ŞİFRE & GÜVENLİK */}
        {activeSettingsTab === 'security' && (
          <div className="space-y-5 animate-fadeIn">
            <form onSubmit={handleChangePassword} className="space-y-3">
              <h4 className="font-extrabold text-xs text-text-main flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">key</span>
                <span>Şifre Değiştir</span>
              </h4>

              {passwordFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    passwordFeedback.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {passwordFeedback.type === 'success' ? 'check_circle' : 'error'}
                  </span>
                  <span>{passwordFeedback.msg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted">Mevcut Şifreniz</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-surface-container-low border border-card-border rounded-xl p-2.5 text-xs text-text-main font-bold focus:outline-none focus:border-primary"
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted">Yeni Şifre</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl p-2.5 text-xs text-text-main font-bold focus:outline-none focus:border-primary"
                    placeholder="En az 6 karakter"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted">Yeni Şifre (Tekrar)</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl p-2.5 text-xs text-text-main font-bold focus:outline-none focus:border-primary"
                    placeholder="Tekrar girin"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="bg-primary hover:bg-primary-hover text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Şifreyi Güncelle
              </button>
            </form>

            <hr className="border-card-border" />

            {/* Additional Security Settings */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-xs text-text-main flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-base">verified_user</span>
                <span>Oturum & Güvenlik</span>
              </h4>

              {/* Active Sessions */}
              <div className="p-3.5 bg-surface-container-low rounded-2xl border border-card-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-500 text-lg">devices</span>
                  <div>
                    <p className="font-extrabold text-text-main">Aktif Cihaz Oturumu</p>
                    <p className="text-[10px] text-text-muted">Güvenli Mobil & Web Oturumu • Şuan Aktif</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Güvenli
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: GÖRÜNÜM & BİLDİRİM */}
        {activeSettingsTab === 'notifications' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Dynamic Light/Dark Theme Switch */}
            <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-2xl border border-card-border">
              <div className="flex items-center gap-3 text-text-main">
                <span className="material-symbols-outlined text-primary">contrast</span>
                <div>
                  <p className="text-xs font-extrabold text-text-main">Uygulama Teması</p>
                  <p className="text-[11px] text-text-muted">Karanlık (Gece) veya Aydınlık (Gündüz) mod seçimi</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onToggleTheme}
                className="flex items-center bg-card-bg p-1 rounded-full border border-card-border cursor-pointer shadow-xs"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-transform ${
                    theme === 'light' ? 'bg-primary text-white shadow-xs' : 'text-text-muted'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">light_mode</span>
                </div>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-transform ${
                    theme === 'dark' ? 'bg-primary text-white shadow-xs' : 'text-text-muted'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">dark_mode</span>
                </div>
              </button>
            </div>

            {/* Notification Trigger */}
            <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-2xl border border-card-border">
              <div className="flex items-center gap-3 text-text-main">
                <span className="material-symbols-outlined text-primary">notifications_active</span>
                <div>
                  <p className="text-xs font-extrabold text-text-main">Ders & Tekrar Bildirimleri</p>
                  <p className="text-[11px] text-text-muted">Ebbinghaus unutma eğrisi ve çalışma hatırlatıcıları</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenNotifications}
                className="bg-primary/10 text-primary border border-primary/20 font-extrabold text-xs px-3.5 py-1.5 rounded-xl hover:bg-primary/20 transition-colors cursor-pointer"
              >
                Ayarlar
              </button>
            </div>

            {/* Weekly Report Email Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-surface-container-low rounded-2xl border border-card-border">
              <div>
                <p className="font-extrabold text-xs text-text-main">Haftalık Gelişim Raporu (E-Posta)</p>
                <p className="text-[11px] text-text-muted">Her pazar akşamı çözülen soru ve başarı analizi e-postası al.</p>
              </div>
              <button
                type="button"
                onClick={() => setWeeklyReports(!weeklyReports)}
                className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                  weeklyReports ? 'bg-primary justify-end' : 'bg-card-border justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: ABONELİK & HESAP */}
        {activeSettingsTab === 'account' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Upgrade / Active Premium Status Banner */}
            {user.isPremium ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-950 text-white rounded-2xl shadow-md border border-emerald-600/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/30 border border-white/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-2xl fill-1 text-amber-300">verified</span>
                    </div>
                    <div className="text-left">
                      <p className="font-black text-sm sm:text-base text-white">PRO Sınırsız Üyelik Aktif</p>
                      <p className="text-xs text-emerald-100 font-extrabold">Sınırsız soru hakkı & detaylı yapay zeka çözümleri aktif</p>
                    </div>
                  </div>
                  <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full shadow-md shrink-0">
                    PRO AKTİF
                  </span>
                </div>

                {onCancelPremium && (
                  <>
                    {!showCancelConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(true)}
                        className="w-full py-2.5 px-4 text-center font-extrabold text-xs text-red-700 dark:text-red-200 bg-red-100 hover:bg-red-200 dark:bg-red-950/80 dark:hover:bg-red-900/90 border border-red-300 dark:border-red-800 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <span className="material-symbols-outlined text-base">cancel</span>
                        <span>PRO Aboneliğimi İptal Et (10 Hak Standart Plana Dön)</span>
                      </button>
                    ) : (
                      <div className="p-4 bg-red-100 dark:bg-slate-900 border-2 border-red-400 dark:border-red-700 rounded-xl space-y-3 animate-fadeIn shadow-md">
                        <p className="text-xs sm:text-sm font-black text-red-950 dark:text-red-100 text-center leading-relaxed">
                          PRO üyeliğinizi iptal etmek istediğinize emin misiniz? Soru hakkınız standart 10 soru hakkı limitine düşecektir.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onCancelPremium();
                              setShowCancelConfirm(false);
                            }}
                            className="flex-1 py-2.5 px-3 text-xs font-black bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors cursor-pointer shadow-xs"
                          >
                            Evet, İptal Et
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCancelConfirm(false)}
                            className="flex-1 py-2.5 px-3 text-xs font-black bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors cursor-pointer shadow-xs border border-slate-900 dark:border-slate-600"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenPremium}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-950 text-white rounded-2xl shadow-md border border-indigo-700/50 hover:brightness-110 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/30 border border-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-2xl fill-1 text-amber-300">star</span>
                  </div>
                  <div className="text-left">
                    <p className="font-extrabold text-sm text-white">PRO Sınırsız Mod'a Geç</p>
                    <p className="text-xs text-indigo-100 font-medium">10 Soru Sınırını Kaldır • Sınırsız AI ve Video Çözümler</p>
                  </div>
                </div>
                <span className="bg-amber-400 text-slate-950 text-xs font-black px-3 py-1 rounded-full shadow-xs">
                  PRO YÜKSELT
                </span>
              </button>
            )}

            {/* Arkadaşlarını Davet Et */}
            {onOpenInviteModal && (
              <div
                onClick={onOpenInviteModal}
                className="flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 rounded-2xl border border-primary/20 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 text-text-main">
                  <span className="material-symbols-outlined text-primary">person_add</span>
                  <div>
                    <span className="text-xs font-extrabold block text-text-main">Arkadaşlarını Davet Et</span>
                    <span className="text-[11px] font-medium text-text-muted">Link gönder, arkadaş ol ve liderlik yarışında buluş</span>
                  </div>
                </div>
                <span className="bg-primary text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-xs whitespace-nowrap">
                  +50 XP
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* FULL BADGES DIALOG MODAL */}
      {isBadgesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card-bg w-full max-w-2xl rounded-3xl p-6 border border-card-border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500 text-2xl">military_tech</span>
                <div>
                  <h3 className="font-extrabold text-base text-text-main">Başarı Rozetleri ve Görevler</h3>
                  <p className="text-xs text-text-muted">
                    Kazanılan: <strong className="text-primary font-extrabold">{unlockedCount} / {badges.length}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBadgesModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setBadgeFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  badgeFilter === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-surface-container-low text-text-muted hover:text-text-main'
                }`}
              >
                Tümü ({badges.length})
              </button>
              <button
                type="button"
                onClick={() => setBadgeFilter('unlocked')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  badgeFilter === 'unlocked'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-surface-container-low text-text-muted hover:text-text-main'
                }`}
              >
                🏆 Kazanılanlar ({unlockedCount})
              </button>
              <button
                type="button"
                onClick={() => setBadgeFilter('locked')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  badgeFilter === 'locked'
                    ? 'bg-amber-600 text-white'
                    : 'bg-surface-container-low text-text-muted hover:text-text-main'
                }`}
              >
                🔒 Kilitliler ({badges.length - unlockedCount})
              </button>
            </div>

            {/* Badges Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {filteredBadges.map((badge) => (
                <div
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex flex-col items-center text-center gap-2 relative group ${
                    badge.unlocked
                      ? `${badge.bgRenk} ${badge.borderRenk} shadow-xs hover:scale-102`
                      : 'bg-surface-container-low/50 border-card-border opacity-75 hover:opacity-100 hover:border-card-border'
                  }`}
                >
                  {/* Unlocked / Locked Indicator Pill */}
                  <div className="absolute top-2 right-2">
                    {badge.unlocked ? (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shadow-xs" title="Kazanıldı">
                        ✓
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-slate-700/60 text-slate-300 flex items-center justify-center text-[10px]" title="Kilitli">
                        🔒
                      </span>
                    )}
                  </div>

                  {/* Icon Circle */}
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-transform group-hover:scale-105 shadow-xs ${
                      badge.unlocked
                        ? `${badge.bgRenk} ${badge.renk} border ${badge.borderRenk}`
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 grayscale'
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl font-bold">
                      {badge.icon}
                    </span>
                  </div>

                  <div className="space-y-1 w-full">
                    <h4 className={`font-extrabold text-xs line-clamp-1 ${badge.unlocked ? 'text-text-main' : 'text-text-muted'}`}>
                      {badge.baslik}
                    </h4>

                    {/* Progress Bar inside card */}
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${badge.unlocked ? 'bg-emerald-500' : 'bg-primary/50'}`}
                        style={{ width: `${Math.min(100, (badge.mevcutMiktar / badge.hedefMiktar) * 100)}%` }}
                      />
                    </div>

                    <p className="text-[10px] font-bold text-text-muted line-clamp-1">
                      {badge.mevcutMiktar} / {badge.hedefMiktar}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-card-border flex justify-end">
              <button
                type="button"
                onClick={() => setIsBadgesModalOpen(false)}
                className="py-2.5 px-5 bg-surface-container-low text-text-main font-bold text-xs rounded-xl hover:bg-card-border transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Selection Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card-bg w-full max-w-md rounded-3xl p-5 border border-card-border shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">face</span>
                <h3 className="font-extrabold text-base text-text-main">Profil Avatarını Seç</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs text-text-muted">
              Profilinizde ve derece sıralamalarında görünecek fotoğrafınızı yükleyebilir veya hazır avatar seçeneklerinden birini seçebilirsiniz:
            </p>

            {/* Custom Photo Upload Card */}
            <div className="bg-surface-container-low p-3 rounded-2xl border border-card-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">add_a_photo</span>
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-text-main">Kendi Fotoğrafını Yükle</h4>
                  <p className="text-[10px] text-text-muted">Galeriden veya kameradan yeni fotoğraf seç</p>
                </div>
              </div>

              <label className="bg-primary hover:bg-primary/90 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-all shadow-xs flex items-center gap-1 shrink-0 active:scale-95">
                <span className="material-symbols-outlined text-sm">upload</span>
                <span>{isUploadingPhoto ? 'Yükleniyor...' : 'Fotoğraf Seç'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCustomPhotoUpload}
                  className="hidden"
                  disabled={isUploadingPhoto}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {AVATAR_OPTIONS.map((item) => {
                const isSelected = user.avatarUrl === item.url;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectAvatar(item.url)}
                    className={`relative p-2.5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 group ${
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-md scale-105'
                        : 'border-card-border bg-surface-container-low/50 hover:border-primary/50 hover:scale-102'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/80 shadow-xs relative">
                      <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/40 backdrop-blur-xs flex items-center justify-center text-white">
                          <span className="material-symbols-outlined text-xl font-bold">check_circle</span>
                        </div>
                      )}
                    </div>
                    <div className="text-center space-y-0.5">
                      <p className="font-extrabold text-[11px] text-text-main line-clamp-1">{item.name}</p>
                      <span className="text-[9px] font-bold text-text-muted bg-card-bg px-2 py-0.5 rounded-full border border-card-border inline-block">
                        {item.tag}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-card-border flex justify-end">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="py-2.5 px-5 bg-surface-container-low text-text-main font-bold text-xs rounded-xl hover:bg-card-border transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card-bg w-full max-w-sm rounded-3xl p-6 border border-card-border shadow-2xl text-center space-y-4 relative overflow-hidden">
            <button
              type="button"
              onClick={() => setSelectedBadge(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container-low text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer hover:bg-card-border transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>

            {/* Icon */}
            <div
              className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-4xl shadow-md border ${
                selectedBadge.unlocked
                  ? `${selectedBadge.bgRenk} ${selectedBadge.renk} ${selectedBadge.borderRenk}`
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 grayscale border-slate-300 dark:border-slate-700'
              }`}
            >
              <span className="material-symbols-outlined text-4xl">{selectedBadge.icon}</span>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black mb-1.5 shadow-2xs">
                {selectedBadge.unlocked ? (
                  <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 px-3 py-0.5 rounded-full">
                    🏆 KAZANILDI (+{selectedBadge.xpOdulu} XP)
                  </span>
                ) : (
                  <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-3 py-0.5 rounded-full">
                    🔒 KİLİTLİ GÖREV (+{selectedBadge.xpOdulu} XP)
                  </span>
                )}
              </div>
              <h3 className="font-black text-xl text-text-main">{selectedBadge.baslik}</h3>
            </div>

            {/* Task Requirement Card */}
            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-card-border text-left space-y-1.5">
              <span className="text-[10px] font-black uppercase text-primary tracking-wider block">
                🎯 KAZANIM GÖREVİ
              </span>
              <p className="font-extrabold text-xs text-text-main">{selectedBadge.gorevText}</p>
              <p className="text-xs text-text-muted leading-relaxed font-medium">{selectedBadge.aciklama}</p>

              {/* Progress */}
              <div className="pt-2 border-t border-card-border/60">
                <div className="flex justify-between text-[11px] font-bold mb-1">
                  <span className="text-text-muted">İlerleme Durumu:</span>
                  <span className="text-primary font-black">
                    {selectedBadge.mevcutMiktar} / {selectedBadge.hedefMiktar}
                  </span>
                </div>
                <div className="w-full h-2 bg-card-bg rounded-full overflow-hidden border border-card-border">
                  <div
                    className={`h-full rounded-full ${selectedBadge.unlocked ? 'bg-emerald-500' : 'bg-primary'}`}
                    style={{
                      width: `${Math.min(100, (selectedBadge.mevcutMiktar / selectedBadge.hedefMiktar) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="pt-1">
              {!selectedBadge.unlocked ? (
                <button
                  type="button"
                  onClick={() => {
                    const badgeId = selectedBadge.id;
                    setSelectedBadge(null);
                    setIsBadgesModalOpen(false);
                    if (badgeId === 'badge_first_step' || badgeId === 'badge_subject_master' || badgeId === 'badge_night_owl') {
                      setActiveTab('home');
                    } else if (badgeId === 'badge_error_hunter' || badgeId === 'badge_flashcard_master') {
                      setActiveTab('errorPool');
                    } else if (badgeId === 'badge_social_hero') {
                      if (onOpenInviteModal) onOpenInviteModal();
                    } else if (badgeId === 'badge_streak_7') {
                      setActiveTab('schedule');
                    } else {
                      setActiveTab('home');
                    }
                  }}
                  className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold text-xs py-3 rounded-2xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">play_arrow</span>
                  <span>Görevi Yapmaya Git</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedBadge(null)}
                  className="w-full bg-surface-container-low text-text-main font-bold text-xs py-3 rounded-2xl hover:bg-card-border transition-colors cursor-pointer"
                >
                  Tamam / Kapat
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
