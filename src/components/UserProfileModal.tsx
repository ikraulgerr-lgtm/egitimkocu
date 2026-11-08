import React, { useState, useEffect } from 'react';
import { Kullanici, Arkadas, ToplulukSoru } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface UserProfileTarget {
  userId?: string;
  yazarAd: string;
  kullaniciAdi?: string;
  avatar: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: UserProfileTarget | null;
  currentUser: Kullanici;
  allPosts?: ToplulukSoru[];
  friends?: Arkadas[];
  onAddFriend?: (friend: Arkadas) => void;
  showToast?: (msg: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  allPosts = [],
  friends = [],
  onAddFriend,
  showToast,
}) => {
  const [profileData, setProfileData] = useState<{
    xp: number;
    streak: number;
    sinif: string;
    friendsCount: number;
    isLoading: boolean;
  }>({
    xp: 150,
    streak: 1,
    sinif: 'Öğrenci',
    friendsCount: 0,
    isLoading: false,
  });

  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [hasSentRequest, setHasSentRequest] = useState(false);

  // Sync / fetch real data from Firestore or calculate from state
  useEffect(() => {
    if (!isOpen || !targetUser) return;

    // Check if a friend request was already sent to this user
    try {
      const sent = JSON.parse(localStorage.getItem('edumind_sent_friend_requests') || '[]');
      const targetIdentifier = targetUser.userId || targetUser.kullaniciAdi || targetUser.yazarAd;
      setHasSentRequest(sent.includes(targetIdentifier));
    } catch {
      setHasSentRequest(false);
    }

    let isMounted = true;
    const uid = targetUser.userId;

    // Check if target is current user
    const isSelf = uid === currentUser.id || targetUser.kullaniciAdi === currentUser.kullaniciAdi;
    if (isSelf) {
      setProfileData({
        xp: currentUser.xp || 0,
        streak: currentUser.seri || 1,
        sinif: currentUser.sinif || 'Öğrenci',
        friendsCount: friends.length,
        isLoading: false,
      });
      return;
    }

    // Check if in local friends
    const localFriend = friends.find(
      (f) =>
        (uid && f.id === uid) ||
        (targetUser.kullaniciAdi && f.kullaniciAdi?.toLowerCase() === targetUser.kullaniciAdi.toLowerCase())
    );

    if (localFriend) {
      setProfileData({
        xp: localFriend.xp || 200,
        streak: localFriend.streak || 1,
        sinif: 'Öğrenci',
        friendsCount: Math.max(1, friends.length),
        isLoading: false,
      });
    }

    // Try fetching live stats from Firestore if uid exists
    if (uid && uid !== 'user' && !uid.startsWith('c_')) {
      getDoc(doc(db, 'users', uid))
        .then((snap) => {
          if (!isMounted) return;
          if (snap.exists()) {
            const data = snap.data();
            setProfileData({
              xp: data.xp || 100,
              streak: data.seri || 1,
              sinif: data.sinif || 'Öğrenci',
              friendsCount: data.invitedCount || 1,
              isLoading: false,
            });
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetUser, currentUser, friends]);

  if (!isOpen || !targetUser) return null;

  const isSelf =
    targetUser.userId === currentUser.id ||
    (targetUser.kullaniciAdi && currentUser.kullaniciAdi && targetUser.kullaniciAdi.toLowerCase() === currentUser.kullaniciAdi.toLowerCase());

  const isAlreadyFriend = friends.some(
    (f) =>
      (targetUser.userId && f.id === targetUser.userId) ||
      (targetUser.kullaniciAdi && f.kullaniciAdi?.toLowerCase() === targetUser.kullaniciAdi.toLowerCase()) ||
      f.name.toLowerCase() === targetUser.yazarAd.toLowerCase()
  );

  // User questions in community
  const userPosts = allPosts.filter(
    (p) =>
      (targetUser.userId && p.userId === targetUser.userId) ||
      (targetUser.kullaniciAdi && p.kullaniciAdi?.toLowerCase() === targetUser.kullaniciAdi.toLowerCase()) ||
      p.yazarAd.toLowerCase() === targetUser.yazarAd.toLowerCase()
  );

  const handleSendFriendRequest = async () => {
    if (isSelf || isAlreadyFriend || hasSentRequest) return;
    setIsAddingFriend(true);

    const targetUid = targetUser.userId || `user_${Date.now()}`;
    const targetIdentifier = targetUser.userId || targetUser.kullaniciAdi || targetUser.yazarAd;

    try {
      const myId = currentUser.id || 'user';
      const myName = currentUser.ad || 'Öğrenci';
      const myUsername = currentUser.kullaniciAdi || 'ogrenci';
      const myAvatar = currentUser.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1';

      if (targetUid) {
        // Send interactive friend request notification to recipient
        const notifId = `notif_freq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const friendRequestNotif = {
          id: notifId,
          type: 'friend_request' as const,
          title: '👥 Yeni Arkadaşlık İsteği',
          message: `@${myUsername} (${myName}) sana arkadaşlık isteği gönderdi!`,
          senderId: myId,
          senderName: myName,
          senderUsername: myUsername,
          senderAvatar: myAvatar,
          recipientId: targetUid,
          createdAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          read: false,
        };

        await setDoc(doc(db, 'users', targetUid, 'notifications', notifId), friendRequestNotif);
        await setDoc(doc(db, 'users', targetUid), { latestNotification: friendRequestNotif }, { merge: true });
      }

      // Record in local storage
      try {
        const sent = JSON.parse(localStorage.getItem('edumind_sent_friend_requests') || '[]');
        if (!sent.includes(targetIdentifier)) {
          sent.push(targetIdentifier);
          localStorage.setItem('edumind_sent_friend_requests', JSON.stringify(sent));
        }
      } catch {}

      setHasSentRequest(true);
      if (showToast) {
        showToast(`📩 @${targetUser.kullaniciAdi || targetUser.yazarAd} kullanıcısına arkadaşlık isteği gönderildi!`);
      }
    } catch (e) {
      console.warn('Friend request send error:', e);
      if (showToast) {
        showToast('İstek gönderilirken bir hata oluştu.');
      }
    } finally {
      setIsAddingFriend(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 pb-20 sm:pb-4 animate-fadeIn">
      <div className="bg-card-bg w-full max-w-sm rounded-3xl border border-card-border shadow-2xl overflow-hidden relative flex flex-col max-h-[85dvh] sm:max-h-[85vh]">
        
        {/* Instagram Style Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-card-border shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-base">verified</span>
            <span className="font-mono font-bold text-xs text-text-main truncate">
              @{targetUser.kullaniciAdi || 'ogrenci'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-surface-container-low text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Scrollable Profile Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4 overscroll-contain">
          {/* Header Row: Avatar on Left, 3 Stats on Right (Instagram Layout) */}
          <div className="flex items-center justify-between gap-4">
            {/* Avatar with Story-style Gradient Ring */}
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 p-[2.5px] shadow-sm">
                <img
                  src={targetUser.avatar}
                  alt={targetUser.yazarAd}
                  className="w-full h-full rounded-full object-cover bg-card-bg border-2 border-card-bg"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 text-sm">✨</span>
            </div>

            {/* 3-Column Stats Row */}
            <div className="flex items-center justify-around flex-1 text-center">
              <div>
                <p className="font-black text-sm text-text-main">{userPosts.length || 1}</p>
                <p className="text-[10px] text-text-muted font-bold">Sorular</p>
              </div>
              <div>
                <p className="font-black text-sm text-text-main">
                  {isSelf ? friends.length : Math.max(profileData.friendsCount, isAlreadyFriend ? 1 : 0)}
                </p>
                <p className="text-[10px] text-text-muted font-bold">Arkadaşlar</p>
              </div>
              <div>
                <p className="font-black text-sm text-primary">{profileData.xp}</p>
                <p className="text-[10px] text-text-muted font-bold">XP</p>
              </div>
            </div>
          </div>

          {/* User Bio Details */}
          <div className="space-y-1">
            <h3 className="font-black text-sm text-text-main">{targetUser.yazarAd}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-text-muted bg-surface-container-low px-2 py-0.5 rounded-lg border border-card-border">
                <span>🎓</span>
                <span>{profileData.sinif}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                <span>🔥</span>
                <span>{profileData.streak} Gün Seri</span>
              </span>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div>
            {isSelf ? (
              <div className="w-full py-2 bg-surface-container-low text-text-muted text-center font-bold text-xs rounded-xl border border-card-border">
                👤 Kendi Profilin
              </div>
            ) : isAlreadyFriend ? (
              <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-center font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-base">check_circle</span>
                <span>Arkadaşsınız</span>
              </div>
            ) : hasSentRequest ? (
              <div className="w-full py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-center font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-base">hourglass_top</span>
                <span>İstek Gönderildi (Onay Bekleniyor)</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSendFriendRequest}
                disabled={isAddingFriend}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-center font-black text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
              >
                <span className="material-symbols-outlined text-base">person_add</span>
                <span>{isAddingFriend ? 'İstek Gönderiliyor...' : 'Arkadaşlık İsteği Gönder'}</span>
              </button>
            )}
          </div>

          {/* Posts Grid Header */}
          <div className="pt-2 border-t border-card-border space-y-2">
            <div className="flex items-center gap-1 text-xs font-black text-text-main">
              <span className="material-symbols-outlined text-sm text-primary">grid_on</span>
              <span>Paylaştığı Sorular ({userPosts.length})</span>
            </div>

            {/* Questions Feed */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {userPosts.length === 0 ? (
                <div className="text-center py-4 text-text-muted text-xs bg-surface-container-low rounded-xl border border-dashed border-card-border">
                  Henüz soru paylaşmadı.
                </div>
              ) : (
                userPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-2.5 bg-surface-container-low rounded-2xl border border-card-border space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-black border border-primary/20">
                        {post.ders}
                      </span>
                      <span className="text-[10px] text-text-muted font-medium">{post.zaman}</span>
                    </div>
                    <p className="text-xs text-text-main font-medium line-clamp-2 leading-snug">
                      {post.soruMetni}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-text-muted font-bold pt-1">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-rose-500">favorite</span>
                        <span>{post.begeniSayisi || 0}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-primary">chat_bubble</span>
                        <span>{post.cevapSayisi || 0}</span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-card-border shrink-0 bg-surface-container-low/50">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-surface-container-low hover:bg-card-border text-text-main font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
};
