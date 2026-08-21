import React, { useState, useEffect } from 'react';
import { Kullanici, Arkadas } from '../types';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

interface LeaderboardViewProps {
  currentUser: Kullanici;
  friends?: Arkadas[];
  onOpenInviteModal: () => void;
}

interface LeaderUser {
  id?: string;
  rank: number;
  name: string;
  kullaniciAdi?: string;
  avatar: string;
  xp: number;
  streak: number;
  prevRank?: number;
  isCurrentUser?: boolean;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  currentUser,
  friends = [],
  onOpenInviteModal,
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'global'>('friends');
  const [globalUsers, setGlobalUsers] = useState<LeaderUser[]>([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState<boolean>(false);
  const [sentRequestUserIds, setSentRequestUserIds] = useState<{ [uid: string]: boolean }>({});

  // Real-time live synchronization of all registered users from Firestore
  useEffect(() => {
    setIsLoadingGlobal(true);
    const uColRef = collection(db, 'users');

    const unsubscribe = onSnapshot(
      uColRef,
      (snap) => {
        let fetchedList: LeaderUser[] = snap.docs.map((dSnap) => {
          const data = dSnap.data();
          const isSelf = dSnap.id === currentUser.id || (data.email && data.email === currentUser.email);
          const nameStr = data.ad || 'Öğrenci';
          return {
            id: dSnap.id,
            rank: 0,
            name: isSelf ? `${currentUser.ad || nameStr} (Sen)` : nameStr,
            kullaniciAdi: isSelf ? (currentUser.kullaniciAdi || data.kullaniciAdi || 'ogrenci') : (data.kullaniciAdi || 'ogrenci'),
            avatar: isSelf ? (currentUser.avatarUrl || data.avatarUrl) : (data.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'),
            xp: isSelf ? (typeof currentUser.xp === 'number' ? currentUser.xp : (data.xp || 0)) : (typeof data.xp === 'number' ? data.xp : 0),
            streak: isSelf ? (currentUser.seri || data.seri || 1) : (typeof data.seri === 'number' ? data.seri : 1),
            isCurrentUser: isSelf,
          };
        });

        // Ensure current user is in the list
        const hasSelf = fetchedList.some((u) => u.isCurrentUser);
        if (!hasSelf) {
          fetchedList.push({
            id: currentUser.id,
            rank: 0,
            name: `${currentUser.ad || 'Öğrenci'} (Sen)`,
            kullaniciAdi: currentUser.kullaniciAdi || 'ogrenci',
            avatar: currentUser.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
            xp: currentUser.xp || 0,
            streak: currentUser.seri || 1,
            isCurrentUser: true,
          });
        }

        // Sort descending by XP
        fetchedList.sort((a, b) => b.xp - a.xp);

        // Assign ranks
        const rankedGlobal = fetchedList.map((item, idx) => ({
          ...item,
          rank: idx + 1,
        }));

        setGlobalUsers(rankedGlobal);
        setIsLoadingGlobal(false);
      },
      (err) => {
        console.warn('Realtime Leaderboard sync warning:', err);
        setIsLoadingGlobal(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Build dynamic friends list including currentUser, sorted by XP descending
  const userEntry: LeaderUser = {
    id: currentUser.id,
    rank: 1,
    name: `${currentUser.ad} (Sen)`,
    kullaniciAdi: currentUser.kullaniciAdi || 'ogrenci',
    avatar: currentUser.avatarUrl,
    xp: currentUser.xp,
    streak: currentUser.seri,
    isCurrentUser: true,
  };

  const rawFriendsList: LeaderUser[] = [
    userEntry,
    ...friends.map((f) => ({
      id: f.id,
      rank: 0,
      name: f.name,
      kullaniciAdi: f.kullaniciAdi,
      avatar: f.avatar,
      xp: f.xp,
      streak: f.streak,
    })),
  ];

  rawFriendsList.sort((a, b) => b.xp - a.xp);

  const friendsData: LeaderUser[] = rawFriendsList.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  // Global dataset uses fetched registered users from Firestore
  const globalData: LeaderUser[] = globalUsers.length > 0 ? globalUsers : friendsData;

  const displayUsers = activeTab === 'friends' ? friendsData : globalData;
  const top1 = displayUsers.find((u) => u.rank === 1);
  const top2 = displayUsers.find((u) => u.rank === 2);
  const top3 = displayUsers.find((u) => u.rank === 3);

  const handleSendFriendRequest = async (userItem: LeaderUser) => {
    if (!auth.currentUser) {
      alert('Arkadaşlık isteği göndermek için lütfen önce giriş yapın.');
      return;
    }

    const targetUid = userItem.id;
    if (!targetUid) {
      alert('Bu kullanıcının kimliği doğrulanamadı.');
      return;
    }

    const notifId = `notif_friend_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const myName = currentUser.ad || 'Öğrenci';
    const myAvatar = currentUser.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1';

    const friendNotif = {
      id: notifId,
      type: 'friend_request' as const,
      title: '👥 Arkadaşlık İsteği',
      message: `${myName} sana arkadaşlık isteği gönderdi! İsteği kabul ederek arkadaş sıralamasında yarışabilirsiniz.`,
      senderId: auth.currentUser.uid,
      senderName: myName,
      senderAvatar: myAvatar,
      recipientId: targetUid,
      recipientName: userItem.name.replace(' (Sen)', ''),
      createdAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };

    const cleanNotif = JSON.parse(JSON.stringify(friendNotif));

    try {
      await setDoc(doc(db, 'friend_invites', notifId), cleanNotif);
      await setDoc(doc(db, 'notifications', notifId), cleanNotif);
      await setDoc(doc(db, 'users', targetUid, 'notifications', notifId), cleanNotif);
      await setDoc(doc(db, 'users', targetUid, 'friend_invites', notifId), cleanNotif);
      await setDoc(doc(db, 'users', targetUid), { latestNotification: cleanNotif }, { merge: true });
      setSentRequestUserIds((prev) => ({ ...prev, [targetUid]: true }));
      alert(`📩 ${userItem.name} kullanıcısına arkadaşlık isteği gönderildi!`);
    } catch (e: any) {
      console.error('İstek gönderme hatası:', e);
      alert(`❌ İstek gönderilemedi: ${e?.message || 'Bilinmeyen hata'}`);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-32 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-card-border pb-3">
        <div>
          <h2 className="font-extrabold text-2xl tracking-tight text-text-main">
            Liderlik Tablosu
          </h2>
          <p className="text-xs text-text-muted font-medium">Haftalık XP ve seri sıralaması</p>
        </div>

        <button
          onClick={onOpenInviteModal}
          className="bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          <span>Arkadaşlarını Davet Et</span>
        </button>
      </div>

      {/* Friends / Global Switcher */}
      <div className="bg-surface-container-low p-1 rounded-xl flex border border-card-border">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'friends'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          Arkadaşlarım ({friendsData.length})
        </button>
        <button
          onClick={() => setActiveTab('global')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'global'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          Global TÜRKİYE
        </button>
      </div>

      {/* Top 3 Podium Visual */}
      {top1 && (
        <section className="bg-gradient-to-b from-primary/10 via-card-bg to-card-bg rounded-3xl p-6 border border-card-border shadow-xs">
          <div className="flex items-end justify-center gap-3 sm:gap-6 h-64 max-w-md mx-auto">
            {/* 2nd Place */}
            <div className="flex flex-col items-center flex-1 group">
              {top2 ? (
                <>
                  <div className="relative mb-2">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-slate-300 p-0.5 overflow-hidden shadow-md group-hover:scale-105 transition-transform">
                      <img src={top2.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'} alt={top2.name} className="w-full h-full object-cover rounded-full" />
                    </div>
                    <div className="absolute -bottom-2 -right-1 bg-slate-300 text-slate-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">
                      2
                    </div>
                  </div>
                  <span className="font-extrabold text-xs text-text-main truncate w-20 text-center">{top2.name}</span>
                  <div className="h-24 w-full bg-slate-200 dark:bg-slate-800 rounded-t-2xl mt-2 flex items-end justify-center pb-2 border-t-2 border-slate-300">
                    <span className="text-primary font-black text-xs">{top2.xp} XP</span>
                  </div>
                </>
              ) : (
                <button
                  onClick={onOpenInviteModal}
                  className="w-full flex flex-col items-center group/btn cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-card-border flex items-center justify-center text-text-muted mb-2 group-hover/btn:border-primary group-hover/btn:text-primary transition-colors">
                    <span className="material-symbols-outlined text-lg">add</span>
                  </div>
                  <span className="text-[10px] font-bold text-text-muted">Arkadaş Ekle</span>
                  <div className="h-24 w-full bg-surface-container-low/40 rounded-t-2xl mt-2 border-t-2 border-dashed border-card-border" />
                </button>
              )}
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center flex-1 relative -top-4 group">
              <div className="relative mb-2">
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-2xl animate-bounce">👑</span>
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-amber-400 p-0.5 overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                  <img src={top1.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'} alt={top1.name} className="w-full h-full object-cover rounded-full" />
                </div>
                <div className="absolute -bottom-2 -right-1 bg-amber-400 text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-md">
                  1
                </div>
              </div>
              <span className="font-black text-xs sm:text-sm text-text-main truncate w-24 text-center">{top1.name}</span>
              <div className="h-36 w-full bg-gradient-to-t from-primary/20 to-primary/40 rounded-t-2xl mt-2 flex items-end justify-center pb-2 border-t-2 border-amber-400">
                <span className="text-primary font-black text-xs sm:text-sm">{top1.xp} XP</span>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center flex-1 group">
              {top3 ? (
                <>
                  <div className="relative mb-2">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-4 border-amber-700/60 p-0.5 overflow-hidden shadow-md group-hover:scale-105 transition-transform">
                      <img src={top3.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'} alt={top3.name} className="w-full h-full object-cover rounded-full" />
                    </div>
                    <div className="absolute -bottom-2 -right-1 bg-amber-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black">
                      3
                    </div>
                  </div>
                  <span className="font-extrabold text-xs text-text-main truncate w-20 text-center">{top3.name}</span>
                  <div className="h-16 w-full bg-amber-900/10 dark:bg-amber-950/40 rounded-t-2xl mt-2 flex items-end justify-center pb-2 border-t-2 border-amber-700/60">
                    <span className="text-primary font-black text-xs">{top3.xp} XP</span>
                  </div>
                </>
              ) : (
                <button
                  onClick={onOpenInviteModal}
                  className="w-full flex flex-col items-center group/btn cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-dashed border-card-border flex items-center justify-center text-text-muted mb-2 group-hover/btn:border-primary group-hover/btn:text-primary transition-colors">
                    <span className="material-symbols-outlined text-lg">add</span>
                  </div>
                  <span className="text-[10px] font-bold text-text-muted">Arkadaş Ekle</span>
                  <div className="h-16 w-full bg-surface-container-low/40 rounded-t-2xl mt-2 border-t-2 border-dashed border-card-border" />
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Rankings List */}
      <section className="bg-card-bg rounded-3xl p-4 border border-card-border shadow-xs space-y-2">
        <h3 className="text-xs font-black text-text-muted uppercase tracking-wider px-2 mb-2">
          {activeTab === 'friends' ? 'Arkadaş Sıralaması' : 'Global Türkiye Sıralaması'}
        </h3>

        {displayUsers.map((userItem) => {
          const isAlreadyFriend = friends.some(
            (f) =>
              (f.id && userItem.id && f.id === userItem.id) ||
              (f.name && userItem.name && f.name.toLowerCase().trim() === userItem.name.replace(' (Sen)', '').toLowerCase().trim())
          );
          const isSent = userItem.id ? sentRequestUserIds[userItem.id] : false;

          return (
            <div
              key={`${userItem.id || userItem.name}_${userItem.rank}`}
              className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                userItem.isCurrentUser
                  ? 'bg-primary/10 border-primary/40 shadow-xs'
                  : 'bg-surface-container-low border-card-border hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-6 text-center font-black text-sm ${
                  userItem.rank === 1 ? 'text-amber-500 font-extrabold' : userItem.rank === 2 ? 'text-slate-400' : userItem.rank === 3 ? 'text-amber-700' : 'text-text-muted'
                }`}>
                  {userItem.rank}
                </span>

                <div className="w-10 h-10 rounded-full overflow-hidden border border-card-border shrink-0">
                  <img src={userItem.avatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'} alt={userItem.name} className="w-full h-full object-cover" />
                </div>

                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`font-extrabold text-xs sm:text-sm ${userItem.isCurrentUser ? 'text-primary' : 'text-text-main'}`}>
                      {userItem.name}
                    </p>
                    {userItem.kullaniciAdi && (
                      <span className="text-[10px] font-mono text-primary font-bold">
                        @{userItem.kullaniciAdi}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <span className="text-amber-500 font-bold">🔥 {userItem.streak} Gün Seri</span>
                    {userItem.prevRank && (
                      <span>Geçen Hafta: #{userItem.prevRank}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <p className="font-black text-xs sm:text-sm text-primary">{userItem.xp}</p>
                  <p className="text-[9px] font-bold text-text-muted">XP</p>
                </div>

                {!userItem.isCurrentUser && (
                  isAlreadyFriend ? (
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] sm:text-[11px] font-black flex items-center gap-1 shrink-0">
                      <span className="material-symbols-outlined text-xs">check</span>
                      <span>Arkadaşsınız</span>
                    </span>
                  ) : isSent ? (
                    <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] sm:text-[11px] font-black flex items-center gap-1 shrink-0">
                      <span className="material-symbols-outlined text-xs">done</span>
                      <span>İstek İletildi</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendFriendRequest(userItem)}
                      className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-600 text-purple-800 hover:text-white dark:bg-purple-950/70 dark:hover:bg-purple-600 dark:text-purple-300 dark:hover:text-white border border-purple-300 dark:border-purple-500/40 text-[11px] font-black cursor-pointer transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-xs">person_add</span>
                      <span>İstek Gönder</span>
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Invite Friends Banner */}
      <section className="bg-primary/10 p-4 sm:p-5 rounded-2xl text-text-main shadow-xs relative overflow-hidden border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative z-10 space-y-1 max-w-lg">
          <div className="flex items-center gap-1.5 text-primary font-black text-xs">
            <span className="material-symbols-outlined text-base">group_add</span>
            <span>Birlikte Yarışın</span>
          </div>
          <h3 className="font-black text-sm sm:text-base text-text-main">Arkadaşlarını Davet Et</h3>
          <p className="text-xs text-text-muted font-medium leading-relaxed">
            Arkadaşlarını davet et veya ekle, birlikte soru çözerken <strong className="text-primary font-black">+50 XP bonus</strong> kazan!
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenInviteModal}
          className="bg-primary hover:bg-primary-hover text-white font-black text-xs px-4 py-2.5 rounded-xl active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-sm">share</span>
          <span>Arkadaşlarını Davet Et</span>
        </button>
      </section>
    </div>
  );
};
