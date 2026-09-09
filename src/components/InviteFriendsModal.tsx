import React, { useState } from 'react';
import { Kullanici, Arkadas, Bildirim } from '../types';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

interface InviteFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Kullanici;
  friends: Arkadas[];
  onAddFriend: (friend: Arkadas) => void;
  onRemoveFriend?: (friendId: string) => void;
  showToast: (msg: string) => void;
}

export const InviteFriendsModal: React.FC<InviteFriendsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  friends,
  onAddFriend,
  onRemoveFriend,
  showToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Reset inputs when modal opens or closes
  React.useEffect(() => {
    if (isOpen) {
      setManualInput('');
      setSearchError(null);
      setIsSearching(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Live Firebase production web app URL
  const PUBLIC_APP_URL = 'https://gen-lang-client-0786231895.web.app';
  const myUsername = currentUser.kullaniciAdi || 'ogrenci';
  const myName = currentUser.ad || 'Öğrenci';
  const myAvatar = currentUser.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1';
  const myId = currentUser.id || auth.currentUser?.uid || '';

  const inviteUrl = `${PUBLIC_APP_URL}/?invite=${myId}&name=${encodeURIComponent(myName)}&username=${encodeURIComponent(myUsername)}&avatar=${encodeURIComponent(myAvatar)}&xp=${currentUser.xp || 0}`;
  const shareText = `🎓 Selam! Eğitim Koçum AI ile YKS & LGS sınavlarıma çalışıyorum.\n\nBeni arkadaş olarak eklemek ve liderlik yarışına katılmak için:\n👉 Kullanıcı Adım: @${myUsername}\n📲 Uygulamada Aç / Katıl: ${inviteUrl}\n\n(Uygulamayı açıp Arkadaş Ekle kısmına @${myUsername} yazarak da anında +50 XP kazanabilirsin!)`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      showToast('🔗 Davet bağlantısı panoya kopyalandı!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('🔗 Davet bağlantısı kopyalandı!');
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(`@${myUsername}`);
      setCopiedCode(true);
      showToast(`📋 Kullanıcı adın (@${myUsername}) kopyalandı!`);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      showToast(`📋 @${myUsername} kopyalandı!`);
    }
  };

  const handleWebShare = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title: 'Eğitim Koçum AI Arkadaş Daveti',
          text: shareText,
          url: inviteUrl,
          dialogTitle: 'Arkadaşını Eğitim Koçum AI\'a Davet Et',
        });
        return;
      } catch (e) {
        // User dismissed share dialog
        return;
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Eğitim Koçum AI Arkadaş Daveti',
          text: shareText,
          url: inviteUrl,
        });
        return;
      } catch {
        // User canceled share
      }
    }

    handleCopyLink();
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    let rawInput = manualInput.trim();
    if (!rawInput) return;

    // Strip leading '@' if entered
    if (rawInput.startsWith('@')) {
      rawInput = rawInput.substring(1).trim();
    }

    // Check if user pasted a link with ?invite=... or ?username=...
    let targetUidOrName = rawInput;
    try {
      if (rawInput.includes('invite=')) {
        const parsedUrl = new URL(rawInput.startsWith('http') ? rawInput : `https://${rawInput}`);
        const parsedInviteId = parsedUrl.searchParams.get('invite');
        const parsedUsername = parsedUrl.searchParams.get('username');
        if (parsedInviteId) {
          targetUidOrName = parsedInviteId;
        } else if (parsedUsername) {
          targetUidOrName = parsedUsername.replace('@', '');
        }
      }
    } catch (e) {}

    const normalizedInput = targetUidOrName.toLowerCase();
    const normalizedCurrentUser = (currentUser.ad || '').toLowerCase();
    const normalizedCurrentUsername = (currentUser.kullaniciAdi || '').toLowerCase();

    // 1. Self check
    if (
      targetUidOrName === currentUser.id ||
      targetUidOrName === myId ||
      normalizedInput === normalizedCurrentUser ||
      normalizedInput === normalizedCurrentUsername ||
      (currentUser.email && normalizedInput === currentUser.email.toLowerCase())
    ) {
      setSearchError('Kendinizi arkadaş olarak ekleyemezsiniz.');
      return;
    }

    // 2. Already friends check
    const alreadyFriend = friends.some(
      (f) =>
        f.id === targetUidOrName ||
        (f.name && f.name.toLowerCase() === normalizedInput) ||
        (f.kullaniciAdi && f.kullaniciAdi.toLowerCase() === normalizedInput)
    );
    if (alreadyFriend) {
      setSearchError(`"${rawInput}" zaten arkadaş listenizde kayıtlı.`);
      return;
    }

    setIsSearching(true);

    try {
      let matchedUser: { id: string; ad: string; kullaniciAdi?: string; avatarUrl?: string; xp?: number; seri?: number } | null = null;

      // 1. First try direct lookup by UID if input is an ID
      try {
        const directSnap = await getDoc(doc(db, 'users', targetUidOrName));
        if (directSnap.exists()) {
          const dData = directSnap.data();
          matchedUser = {
            id: directSnap.id,
            ad: dData.ad || 'Öğrenci',
            kullaniciAdi: dData.kullaniciAdi || 'ogrenci',
            avatarUrl: dData.avatarUrl,
            xp: dData.xp || 100,
            seri: dData.seri || 1,
          };
        }
      } catch (e) {}

      // 2. Search across Firebase users by username, email or name
      if (!matchedUser) {
        const usersSnap = await getDocs(collection(db, 'users'));
        const firebaseUsers: Kullanici[] = usersSnap.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Kullanici, 'id'>),
        }));

        const found = firebaseUsers.find((u) => {
          if (u.id === currentUser.id || u.id === myId) return false;
          const userAd = (u.ad || '').toLowerCase();
          const userKullaniciAdi = (u.kullaniciAdi || '').toLowerCase();
          const userEmail = (u.email || '').toLowerCase();
          return (
            u.id === targetUidOrName ||
            userKullaniciAdi === normalizedInput ||
            userEmail === normalizedInput ||
            userAd === normalizedInput ||
            userAd.includes(normalizedInput)
          );
        });

        if (found) {
          matchedUser = {
            id: found.id,
            ad: found.ad,
            kullaniciAdi: found.kullaniciAdi || 'ogrenci',
            avatarUrl: found.avatarUrl,
            xp: found.xp || 100,
            seri: found.seri || 1,
          };
        }
      }

      if (!matchedUser) {
        setSearchError(
          `"@${rawInput}" kullanıcı adıyla veya adıyla kayıtlı bir öğrenci bulunamadı. Lütfen kullanıcı adını kontrol edin.`
        );
        setIsSearching(false);
        return;
      }

      // Add to current user's local and Firestore friends immediately
      const newFriend: Arkadas = {
        id: matchedUser.id,
        name: matchedUser.ad,
        kullaniciAdi: matchedUser.kullaniciAdi || 'ogrenci',
        avatar: matchedUser.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
        xp: matchedUser.xp || 100,
        streak: matchedUser.seri || 1,
        joinedAt: new Date().toLocaleDateString('tr-TR'),
      };
      onAddFriend(newFriend);

      // Save mutually in Firestore if authenticated
      if (myId && matchedUser.id) {
        const myFriendObj: Arkadas = {
          id: myId,
          name: myName,
          kullaniciAdi: myUsername,
          avatar: myAvatar,
          xp: currentUser.xp || 0,
          streak: currentUser.seri || 1,
          joinedAt: new Date().toLocaleDateString('tr-TR'),
        };

        try {
          await setDoc(doc(db, 'users', myId, 'friends', matchedUser.id), { ...newFriend, userId: myId }, { merge: true });
          await setDoc(doc(db, 'users', matchedUser.id, 'friends', myId), { ...myFriendObj, userId: matchedUser.id }, { merge: true });

          // Send an instant notification to the target user
          const notifId = `notif_friend_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const friendNotif = {
            id: notifId,
            type: 'friend_request' as const,
            title: '👥 Yeni Arkadaş Eklendi!',
            message: `@${myUsername} (${myName}) seni arkadaş olarak ekledi! Karşılıklı arkadaş oldunuz (+50 XP).`,
            senderId: myId,
            senderName: myName,
            senderUsername: myUsername,
            senderAvatar: myAvatar,
            recipientId: matchedUser.id,
            recipientName: matchedUser.ad,
            recipientUsername: matchedUser.kullaniciAdi,
            createdAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            read: false,
          };
          const cleanNotif = JSON.parse(JSON.stringify(friendNotif));
          await setDoc(doc(db, 'users', matchedUser.id, 'notifications', notifId), cleanNotif);
          await setDoc(doc(db, 'users', matchedUser.id), { latestNotification: cleanNotif }, { merge: true });
        } catch (e) {
          console.error('Arkadaşlık kaydetme hatası:', e);
        }
      }

      showToast(`🎉 @${matchedUser.kullaniciAdi || matchedUser.ad} arkadaş olarak eklendi! (+50 XP)`);
      setManualInput('');
      setSearchError(null);
    } catch (err: any) {
      console.error('Kullanıcı arama hatası:', err);
      setSearchError('Kullanıcı doğrulanırken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-card-bg w-full max-w-md rounded-3xl p-5 border border-card-border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">person_add</span>
            </div>
            <div>
              <h3 className="font-black text-base text-text-main">Arkadaşlarını Davet Et</h3>
              <p className="text-xs text-text-muted font-medium">Birlikte çalışın, liderlik yarışına katılın</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-low text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Bonus Reward Banner */}
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 font-black text-xs shadow-xs">
              +50
            </div>
            <div>
              <p className="text-xs font-black text-text-main">Her Davette +50 XP Kazan</p>
              <p className="text-[11px] text-text-muted font-medium">Arkadaşın bağlandığında veya kullanıcı adını yazdığında ikiniz de anında +50 XP kazanırsınız.</p>
            </div>
          </div>
        </div>

        {/* Username Quick Copy Card */}
        <div className="bg-surface-container-low border border-card-border rounded-2xl p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">alternate_email</span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Senin Kullanıcı Adın</p>
              <p className="text-xs font-black text-primary font-mono truncate">@{myUsername}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
              copiedCode
                ? 'bg-emerald-600 text-white'
                : 'bg-surface-container hover:bg-card-border text-text-main border border-card-border'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{copiedCode ? 'check' : 'content_copy'}</span>
            <span>{copiedCode ? 'Kopyalandı' : 'Kodu Kopyala'}</span>
          </button>
        </div>

        {/* Invite Link Section */}
        <div className="space-y-1.5">
          <label className="text-xs font-extrabold text-text-main flex items-center gap-1">
            <span className="material-symbols-outlined text-primary text-base">link</span>
            <span>Canlı Davet Bağlantısı</span>
          </label>
          <div className="flex items-center gap-2 bg-surface-container-low border border-card-border rounded-2xl p-1.5 pl-3">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="bg-transparent text-xs font-mono text-text-main w-full focus:outline-none select-all truncate"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3.5 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-xs ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-primary hover:bg-primary-hover text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
            </button>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n${inviteUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-1.5 sm:px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] sm:text-xs rounded-xl transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-sm sm:text-base">chat</span>
            <span>WhatsApp</span>
          </a>

          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-1.5 sm:px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] sm:text-xs rounded-xl transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-sm sm:text-base">send</span>
            <span>Telegram</span>
          </a>

          <button
            type="button"
            onClick={handleWebShare}
            className="flex items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-1.5 sm:px-3 bg-surface-container-low hover:bg-card-border text-text-main font-bold text-[11px] sm:text-xs rounded-xl border border-card-border transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm sm:text-base">share</span>
            <span>Paylaş</span>
          </button>
        </div>

        {/* Manual Add Friend / Link Input */}
        <div className="pt-2 border-t border-card-border space-y-2">
          <label className="text-xs font-bold text-text-main flex items-center justify-between">
            <span>İsim veya Davet Bağlantısı ile Ekle</span>
            <span className="text-[10px] text-primary font-bold">+50 XP Bonus</span>
          </label>
          <form onSubmit={handleManualAdd} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => {
                  setManualInput(e.target.value);
                  if (searchError) setSearchError(null);
                }}
                placeholder="Arkadaşının adı veya paylaştığı davet linki..."
                className="flex-1 bg-surface-container-low border border-card-border focus:border-primary rounded-xl px-3 py-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none"
              />
              <button
                type="submit"
                disabled={!manualInput.trim() || isSearching}
                className="px-4 py-2 bg-primary text-white font-black text-xs rounded-xl disabled:opacity-50 hover:bg-primary-hover transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {isSearching ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    <span>Aranıyor...</span>
                  </>
                ) : (
                  <span>Ekle</span>
                )}
              </button>
            </div>

            {searchError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs font-medium flex items-start gap-1.5 animate-fadeIn">
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
                <span>{searchError}</span>
              </div>
            )}
          </form>
        </div>

        {/* Friends List */}
        <div className="pt-2 border-t border-card-border space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-xs text-text-main flex items-center gap-1">
              <span className="material-symbols-outlined text-primary text-base">group</span>
              <span>Mevcut Arkadaşlarım ({friends.length})</span>
            </h4>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {friends.length === 0 ? (
              <div className="text-center py-5 text-text-muted text-xs bg-surface-container-low rounded-2xl border border-dashed border-card-border p-3">
                Henüz arkadaşın yok. Yukarıdaki bağlantıyı göndererek arkadaşlarını davet et!
              </div>
            ) : (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center justify-between p-2.5 bg-surface-container-low rounded-2xl border border-card-border"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={friend.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=Friend'}
                      alt={friend.name}
                      className="w-8 h-8 rounded-full border border-card-border object-cover bg-card-bg"
                    />
                    <div>
                      <p className="font-black text-xs text-text-main">{friend.name}</p>
                      {friend.kullaniciAdi && (
                        <p className="text-[10px] text-primary font-mono font-bold">@{friend.kullaniciAdi}</p>
                      )}
                      <p className="text-[10px] text-text-muted font-bold">
                        🔥 {friend.streak || 1} Gün Seri
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                      {friend.xp} XP
                    </span>
                    {onRemoveFriend && (
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveFriend(friend.id);
                          showToast(`${friend.name} arkadaş listenizden çıkarıldı.`);
                        }}
                        title="Arkadaşı Sil"
                        className="text-text-muted hover:text-rose-500 p-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
