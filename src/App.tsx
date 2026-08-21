import React, { useState, useEffect, useRef } from 'react';
import { ActiveTab, Kullanici, SoruKaydi, ToplulukSoru, ProgramOgesi, HataTuru, Arkadas, DenemeRecord, Bildirim } from './types';
import {
  getUser,
  saveUser,
  getQuestions,
  saveQuestions,
  stripHeavyImages,
  getPosts,
  savePosts,
  getSchedule,
  saveSchedule,
  saveScheduleLocally,
  getFriends,
  saveFriends,
  addFriend,
  removeFriend,
  getTheme,
  saveTheme,
  resetToCleanState,
  saveDenemelerLocally,
} from './lib/storage';
import { getTurkeyDateString } from './lib/dateUtils';
import { trySolveMathExpression } from './lib/mathUtils';

import { TopHeader, BottomNavBar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { SolutionView } from './components/SolutionView';
import { ErrorPoolView } from './components/ErrorPoolView';
import { CommunityView } from './components/CommunityView';
import { StatsView } from './components/StatsView';
import { LeaderboardView } from './components/LeaderboardView';
import { ScheduleView } from './components/ScheduleView';
import { ProfileView } from './components/ProfileView';
import { DenemeTakibiView } from './components/DenemeTakibiView';

import { analyzeQuestionService, generateSimilarQuestionService } from './lib/geminiClient';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { runSmartNotificationChecks, sendNativeNotification, requestNotificationPermissions } from './lib/notificationService';
import { initializeAdMob } from './lib/admobService';
import { PremiumVideoModal } from './components/PremiumVideoModal';
import { NoCreditsModal } from './components/NoCreditsModal';
import { AuthModal } from './components/AuthModal';
import { QuizTestModal } from './components/QuizTestModal';
import { AiAnalyzingOverlay } from './components/AiAnalyzingOverlay';
import { InviteFriendsModal } from './components/InviteFriendsModal';
import { LofiAudioWidget } from './components/LofiAudioWidget';
import { ExamCountdownWidget } from './components/ExamCountdownWidget';
import { ErrorBoundary } from './components/ErrorBoundary';

import { auth, db, handleFirestoreError, OperationType, logoutFirebase } from './lib/firebase';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';

export function App() {
  const [user, setUserState] = useState<Kullanici>(getUser());
  const [questions, setQuestionsState] = useState<SoruKaydi[]>(getQuestions());
  const [posts, setPostsState] = useState<ToplulukSoru[]>(getPosts());
  const [schedule, setScheduleState] = useState<ProgramOgesi[]>(getSchedule());
  const [friends, setFriendsState] = useState<Arkadas[]>(getFriends());

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedQuestion, setSelectedQuestion] = useState<SoruKaydi | null>(questions[0] || null);

  const [theme, setThemeState] = useState<'light' | 'dark'>(getTheme());
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);
  const [isNoCreditsModalOpen, setIsNoCreditsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState<SoruKaydi | null>(null);
  const [quizList, setQuizList] = useState<SoruKaydi[]>([]);
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Bildirim[]>([]);
  const [isNotificationsCenterOpen, setIsNotificationsCenterOpen] = useState(false);
  const [pendingJoinRoomCode, setPendingJoinRoomCode] = useState<string | null>(null);
  const [activeBannerNotif, setActiveBannerNotif] = useState<Bildirim | null>(null);
  const deliveredNativeNotifsRef = useRef<Set<string>>(new Set());

  const cleanDeleteNotification = async (notifId: string) => {
    if (!notifId) return;
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    setActiveBannerNotif((prev) => (prev?.id === notifId ? null : prev));

    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await Promise.allSettled([
          deleteDoc(doc(db, 'users', uid, 'notifications', notifId)),
          deleteDoc(doc(db, 'users', uid, 'friend_invites', notifId)),
          deleteDoc(doc(db, 'friend_invites', notifId)),
          deleteDoc(doc(db, 'pomo_invites', notifId)),
          deleteDoc(doc(db, 'notifications', notifId)),
          setDoc(doc(db, 'users', uid), { latestNotification: null }, { merge: true }),
        ]);
      } catch (e) {}
    }
  };

  const notifyDeviceForIncomingInvite = (invite: Bildirim) => {
    if (!invite || !invite.id || deliveredNativeNotifsRef.current.has(invite.id)) return;
    deliveredNativeNotifsRef.current.add(invite.id);

    // Send native phone notification (status bar & lock screen)
    sendNativeNotification({
      title: invite.title || (invite.type === 'friend_request' ? '👥 Yeni Arkadaşlık İsteği' : '🍅 Pomodoro Oda Daveti'),
      body: invite.message || `${invite.senderName || 'Bir arkadaşın'} sana davet gönderdi!`,
      extra: { notifId: invite.id, type: invite.type },
    });

    // Device haptic vibration
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (e) {}
    }
  };

  // Request notification permissions and initialize AdMob on app mount
  useEffect(() => {
    requestNotificationPermissions();
    initializeAdMob();
  }, []);

  // Listen to Firestore real-time notifications, pomo_invites, friend_invites & real-time friends
  useEffect(() => {
    let unsubNotif: any = null;
    let unsubPomo: any = null;
    let unsubFriend: any = null;
    let unsubUserDoc: any = null;
    let unsubFriends: any = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const uid = firebaseUser.uid;
        requestNotificationPermissions();

        // 1. User notifications subcollection listener — guaranteed private to this user
        const notifRef = collection(db, 'users', uid, 'notifications');
        unsubNotif = onSnapshot(notifRef, (snap) => {
          if (!snap.empty) {
            const list = snap.docs
              .map((d) => ({ id: d.id, ...d.data() }) as Bildirim)
              .filter((n) => !n.isSenderCopy);
            setNotifications(list);
            const latestUnreadInvite = list.find((n) => {
              if (n.read) return false;
              if (n.type === 'friend_request') {
                const isAlreadyFriend = friendsState.some((f) => f.id === n.senderId);
                if (isAlreadyFriend) {
                  cleanDeleteNotification(n.id);
                  return false;
                }
                return true;
              }
              return n.type === 'pomo_invite';
            });
            if (latestUnreadInvite) {
              notifyDeviceForIncomingInvite(latestUnreadInvite);
              setActiveBannerNotif(latestUnreadInvite);
            }
          } else {
            setNotifications([]);
          }
        }, () => {});

        // 2. Top-level pomo_invites collection listener in Firebase
        unsubPomo = onSnapshot(collection(db, 'pomo_invites'), (snap) => {
          if (!snap.empty) {
            const list: Bildirim[] = [];
            snap.docs.forEach((d) => {
              const data = d.data() as Bildirim & { recipientId?: string; recipientName?: string };
              const isForMe = data.recipientId === uid || (data.recipientName && user.ad && data.recipientName.trim().toLowerCase() === user.ad.trim().toLowerCase());
              if (isForMe && !data.isSenderCopy && data.senderId !== uid) {
                list.push({ id: d.id, ...data });
              }
            });
            if (list.length > 0) {
              setNotifications((prev) => {
                const map = new Map<string, Bildirim>();
                prev.forEach((n) => map.set(n.id, n));
                list.forEach((n) => map.set(n.id, n));
                return Array.from(map.values());
              });
              const unreadInvite = list.find((n) => !n.read && n.type === 'pomo_invite');
              if (unreadInvite) {
                notifyDeviceForIncomingInvite(unreadInvite);
                setActiveBannerNotif(unreadInvite);
              }
            }
          }
        }, () => {});

        // 3. Top-level friend_invites collection listener in Firebase
        unsubFriend = onSnapshot(collection(db, 'friend_invites'), (snap) => {
          if (!snap.empty) {
            const list: Bildirim[] = [];
            snap.docs.forEach((d) => {
              const data = d.data() as Bildirim & { recipientId?: string; recipientName?: string };
              const isForMe = data.recipientId === uid || (data.recipientName && user.ad && data.recipientName.trim().toLowerCase() === user.ad.trim().toLowerCase());
              if (isForMe && !data.isSenderCopy && data.senderId !== uid) {
                const isAlreadyFriend = friendsState.some((f) => f.id === data.senderId);
                if (isAlreadyFriend) {
                  cleanDeleteNotification(d.id);
                } else {
                  list.push({ id: d.id, ...data });
                }
              }
            });
            if (list.length > 0) {
              setNotifications((prev) => {
                const map = new Map<string, Bildirim>();
                prev.forEach((n) => map.set(n.id, n));
                list.forEach((n) => map.set(n.id, n));
                return Array.from(map.values());
              });
              const unreadInvite = list.find((n) => !n.read && n.type === 'friend_request');
              if (unreadInvite) {
                notifyDeviceForIncomingInvite(unreadInvite);
                setActiveBannerNotif(unreadInvite);
              }
            }
          }
        }, () => {});

        // 4. Listen to real-time friends list so BOTH users update instantaneously!
        const friendsRef = collection(db, 'users', uid, 'friends');
        unsubFriends = onSnapshot(friendsRef, (fSnap) => {
          if (!fSnap.empty) {
            const loadedFriends: Arkadas[] = fSnap.docs.map((d) => d.data() as Arkadas);
            setFriendsState(loadedFriends);
            saveFriends(loadedFriends);
          }
        }, () => {});

        // 5. Also listen to user doc field 'latestNotification' for instant floating banner pop-up
        unsubUserDoc = onSnapshot(doc(db, 'users', uid), (userSnap) => {
          if (userSnap.exists()) {
            const uData = userSnap.data();
            if (uData && uData.latestNotification && !uData.latestNotification.read) {
              const lNotif = uData.latestNotification as Bildirim;
              if (lNotif.type === 'friend_request' || lNotif.type === 'pomo_invite') {
                notifyDeviceForIncomingInvite(lNotif);
                setActiveBannerNotif(lNotif);
              }
              setNotifications((prev) => {
                const exists = prev.some((n) => n.id === lNotif.id);
                if (!exists) return [lNotif, ...prev];
                return prev;
              });
            }
          }
        }, () => {});

      } else {
        setNotifications([]);
        setActiveBannerNotif(null);
        setFriendsState([]);
      }
    });

    // Top-level community collection real-time listener (available unconditionally for all users & newcomers)
    const unsubCommunity = onSnapshot(
      collection(db, 'community'),
      (cSnap) => {
        if (!cSnap.empty) {
          const loadedPosts: ToplulukSoru[] = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ToplulukSoru);
          loadedPosts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setPostsState(loadedPosts);
          savePosts(loadedPosts);
        }
      },
      (cErr) => {
        console.warn('Community snapshot listener warning:', cErr);
      }
    );

    return () => {
      unsubAuth();
      unsubCommunity();
      if (unsubNotif) unsubNotif();
      if (unsubPomo) unsubPomo();
      if (unsubFriend) unsubFriend();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubFriends) unsubFriends();
    };
  }, []);

  // Auto-reset 10 question credits at 00:00 TRT silently without toast popup
  useEffect(() => {
    const checkDailyReset = () => {
      if (!auth.currentUser) return; // Only reset if logged in
      const todayTr = getTurkeyDateString();
      if (user && user.lastResetDate !== todayTr) {
        const updatedUser: Kullanici = {
          ...user,
          kredi: 10,
          maxKredi: 10,
          lastResetDate: todayTr,
        };
        setUserState(updatedUser);
        saveUser(updatedUser);
        syncUserToFirestore(updatedUser);
        // Silent reset — no toast notification shown
      }
    };

    checkDailyReset();
    const timer = setInterval(checkDailyReset, 30000);
    window.addEventListener('focus', checkDailyReset);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', checkDailyReset);
    };
  }, [user?.lastResetDate, user?.id]);

  // Run smart notification reminders based on user preferences and daily progress (ONLY when user is logged in, once per session)
  useEffect(() => {
    if (auth.currentUser && user && user.id && !isAuthModalOpen) {
      const timeout = setTimeout(() => {
        if (!auth.currentUser) return;
        runSmartNotificationChecks({
          user,
          questions,
          onAddInAppNotification: (notif) => {
            if (!auth.currentUser) return;
            setNotifications((prev) => {
              const exists = prev.some((n) => n.id === notif.id);
              if (!exists) return [notif, ...prev];
              return prev;
            });
            // Background smart reminders only go to notification drawer, no intrusive floating banner
          },
        });
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [auth.currentUser?.uid, user?.id, isAuthModalOpen]);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userSnap = await getDoc(userDocRef);
          const todayTr = getTurkeyDateString();
          if (userSnap.exists()) {
            const data = userSnap.data() as Kullanici;
            let userKredi = data.kredi ?? 10;
            let userResetDate = data.lastResetDate || todayTr;

            if (userResetDate !== todayTr) {
              userKredi = 10;
              userResetDate = todayTr;
            }

            let cleanName = data.ad;
            if (!cleanName || cleanName === 'Selin Yılmaz' || cleanName === 'Yeni Öğrenci') {
              cleanName = firebaseUser.displayName || (user.ad && user.ad !== 'Selin Yılmaz' && user.ad !== 'Yeni Öğrenci' ? user.ad : 'Öğrenci');
            }
            const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1';
            let finalAvatar = data.avatarUrl;
            if (!finalAvatar || finalAvatar.includes('googleusercontent.com') || finalAvatar.includes('google.com')) {
              finalAvatar = DEFAULT_AVATAR;
            }

            const userData: Kullanici = {
              ...data,
              id: firebaseUser.uid,
              ad: cleanName,
              email: data.email || firebaseUser.email || 'ogrenci@egitimkocum.ai',
              avatarUrl: finalAvatar,
              kredi: userKredi,
              maxKredi: 10,
              lastResetDate: userResetDate,
            };
            setUserState(userData);
            saveUser(userData);
          } else {
            const initialName = firebaseUser.displayName || (user.ad && user.ad !== 'Selin Yılmaz' && user.ad !== 'Yeni Öğrenci' ? user.ad : 'Öğrenci');
            const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1';
            const newUserData: Kullanici = {
              id: firebaseUser.uid,
              ad: initialName,
              email: firebaseUser.email || user.email || 'ogrenci@egitimkocum.ai',
              kredi: 10,
              maxKredi: 10,
              seri: 1,
              xp: 0,
              isPremium: false,
              sinif: 'YKS / LGS Hazırlık',
              avatarUrl: DEFAULT_AVATAR,
              flashcardPractices: 0,
              nightOwlUnlocked: false,
              invitedCount: 0,
              lastResetDate: todayTr,
            };
            await setDoc(userDocRef, newUserData);
            setUserState(newUserData);
            saveUser(newUserData);

            // Clean state for fresh new registration
            setQuestionsState([]);
            saveQuestions([]);
            setScheduleState([]);
            saveSchedule([]);
            setFriendsState([]);
            saveFriends([]);
            setSelectedQuestion(null);
          }

          // Fetch user questions from Firestore & Disaster Recovery Mirror
          const currentLocalQuestions = getQuestions();
          let loadedFromFirestore: SoruKaydi[] = [];

          try {
            const qColRef = collection(db, 'users', firebaseUser.uid, 'questions');
            const qSnap = await getDocs(qColRef);
            if (!qSnap.empty) {
              loadedFromFirestore = qSnap.docs.map(doc => doc.data() as SoruKaydi);
            } else {
              // Check cloud backup archive document
              const backupSnap = await getDoc(doc(db, 'users', firebaseUser.uid, 'backup', 'questions_archive'));
              if (backupSnap.exists() && Array.isArray(backupSnap.data()?.questions)) {
                loadedFromFirestore = backupSnap.data().questions as SoruKaydi[];
              }
            }
          } catch (err) {
            console.warn('Could not fetch questions from Firestore, using local backup:', err);
          }

          // Safe Merge: Merge Firestore questions with Local Storage questions so nothing is ever lost
          const questionMap = new Map<string, SoruKaydi>();
          currentLocalQuestions.forEach((q) => {
            if (q && q.id) questionMap.set(q.id, q);
          });
          loadedFromFirestore.forEach((q) => {
            if (q && q.id) questionMap.set(q.id, q);
          });

          const mergedQuestions = Array.from(questionMap.values());
          if (mergedQuestions.length > 0) {
            setQuestionsState(mergedQuestions);
            saveQuestions(mergedQuestions);
            setSelectedQuestion((prev) => prev || mergedQuestions[0] || null);
          } else {
            const fallbackLocal = getQuestions();
            if (fallbackLocal.length > 0) {
              setQuestionsState(fallbackLocal);
              setSelectedQuestion(fallbackLocal[0]);
            }
          }

          // Fetch user schedule from Firestore
          const sColRef = collection(db, 'users', firebaseUser.uid, 'schedule');
          const sSnap = await getDocs(sColRef);
          if (!sSnap.empty) {
            const loadedSchedule: ProgramOgesi[] = sSnap.docs.map(doc => doc.data() as ProgramOgesi);
            setScheduleState(loadedSchedule);
            saveSchedule(loadedSchedule);
          } else {
            setScheduleState([]);
            saveSchedule([]);
          }

          // Fetch user friends from Firestore
          const fColRef = collection(db, 'users', firebaseUser.uid, 'friends');
          const fSnap = await getDocs(fColRef);
          if (!fSnap.empty) {
            const loadedFriends: Arkadas[] = fSnap.docs.map(doc => doc.data() as Arkadas);
            setFriendsState(loadedFriends);
            saveFriends(loadedFriends);
          } else {
            setFriendsState([]);
            saveFriends([]);
          }

          // Fetch user denemeler (mock exam tracking records) from Firestore
          const dColRef = collection(db, 'users', firebaseUser.uid, 'denemeler');
          const dSnap = await getDocs(dColRef);
          if (!dSnap.empty) {
            const loadedDenemeler: DenemeRecord[] = dSnap.docs.map(doc => doc.data() as DenemeRecord);
            saveDenemelerLocally(loadedDenemeler);
          } else {
            saveDenemelerLocally([]);
          }

          // Fetch community posts from Firestore
          try {
            const cColRef = collection(db, 'community');
            const cSnap = await getDocs(cColRef);
            if (!cSnap.empty) {
              const loadedPosts: ToplulukSoru[] = cSnap.docs.map(doc => doc.data() as ToplulukSoru);
              setPostsState(loadedPosts);
              savePosts(loadedPosts);
            }
          } catch (cErr) {
            console.warn('Community posts load warning:', cErr);
          }

          // Automatically close login modal once authentication is established
          setIsAuthModalOpen(false);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        // Logged-out state: user must sign in or register (no guest user overwrite)
        setIsAuthModalOpen(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Process invite link from URL parameters
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const inviteId = urlParams.get('invite');
    const inviteName = urlParams.get('name');
    const inviteAvatar = urlParams.get('avatar');
    const inviteXp = urlParams.get('xp');

    if (inviteId) {
      // Clean query parameter from URL bar without reload
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        // Ignore if restricted
      }

      // Check if current user is not inviting self
      if (inviteId !== user.id && (!auth.currentUser || inviteId !== auth.currentUser.uid)) {
        const friendName = inviteName ? decodeURIComponent(inviteName) : 'Davet Eden Öğrenci';
        const friendAvatar = inviteAvatar ? decodeURIComponent(inviteAvatar) : 'https://api.dicebear.com/7.x/adventurer/svg?seed=InviterStudent&backgroundColor=6366f1';
        const friendXp = inviteXp ? parseInt(inviteXp, 10) : 650;

        const inviterObj: Arkadas = {
          id: inviteId,
          name: friendName,
          avatar: friendAvatar,
          xp: friendXp,
          streak: 4,
          joinedAt: new Date().toLocaleDateString('tr-TR'),
        };

        const currentFriendsList = getFriends();
        const alreadyAdded = currentFriendsList.some((f) => f.id === inviteId || f.name.toLowerCase() === friendName.toLowerCase());

        if (!alreadyAdded) {
          // Mutually add to friends and Firestore!
          handleAddFriend(inviterObj);

          // Give current user +50 XP bonus for joining via invite!
          const updatedUser = { ...user, xp: user.xp + 50 };
          setUserState(updatedUser);
          saveUser(updatedUser);
          syncUserToFirestore(updatedUser);

          // Send an instant notification to the inviter in Firestore!
          const notifId = `notif_friend_joined_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const myName = user.ad && user.ad !== 'Selin Yılmaz' ? user.ad : 'Yeni Bir Öğrenci';
          const joinNotif: Bildirim = {
            id: notifId,
            type: 'friend_request',
            title: '🎉 Yeni Arkadaşın Katıldı!',
            message: `${myName} paylaştığın davet bağlantısı ile sana katıldı! Karşılıklı arkadaş oldunuz (+50 XP).`,
            senderId: user.id || auth.currentUser?.uid || 'student',
            senderName: myName,
            senderAvatar: user.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
            recipientId: inviteId,
            createdAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            read: false,
          };

          setDoc(doc(db, 'users', inviteId, 'notifications', notifId), joinNotif).catch(() => {});
          setDoc(doc(db, 'users', inviteId), { latestNotification: joinNotif }, { merge: true }).catch(() => {});

          setActiveTab('leaderboard');
          showToast(`🎉 ${friendName} seni Eğitim Koçum'a davet etti! Artık arkadaşsınız (+50 XP)!`);
        } else {
          showToast(`🤝 ${friendName} zaten arkadaş listenizde kayıtlı!`);
        }
      }
    }
  }, [user?.id]);

  // Helper to sync user state to Firestore & Firebase Auth profile
  const syncUserToFirestore = async (updatedUser: Kullanici) => {
    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, updatedUser, { merge: true });
        if (updatedUser.ad && auth.currentUser.displayName !== updatedUser.ad) {
          await updateProfile(auth.currentUser, { displayName: updatedUser.ad });
        }
      } catch (err) {
        console.warn('Error syncing user profile to Firestore:', err);
      }
    }
  };

  const handleUpdateUser = (updatedUser: Kullanici) => {
    setUserState(updatedUser);
    saveUser(updatedUser);
    syncUserToFirestore(updatedUser);
  };

  const handleAddFriend = async (newFriend: Arkadas) => {
    const updated = addFriend(newFriend);
    setFriendsState(updated);

    if (auth.currentUser) {
      const myUid = auth.currentUser.uid;
      const myFriendObj: Arkadas = {
        id: myUid,
        name: user.ad || 'Öğrenci',
        avatar: user.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
        xp: user.xp || 0,
        streak: user.seri || 1,
        joinedAt: new Date().toLocaleDateString('tr-TR'),
      };

      try {
        // Write to current user's friends collection in Firestore
        await setDoc(doc(db, 'users', myUid, 'friends', newFriend.id), { ...newFriend, userId: myUid });

        // MUTUAL PERSISTENCE: Write current user to friend's friends collection in Firestore!
        if (newFriend.id && !newFriend.id.startsWith('f_')) {
          await setDoc(doc(db, 'users', newFriend.id, 'friends', myUid), { ...myFriendObj, userId: newFriend.id });
        }
      } catch (err) {
        console.warn('Error saving friend mutually to Firestore:', err);
      }
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    const updated = removeFriend(friendId);
    setFriendsState(updated);
    if (auth.currentUser) {
      try {
        const fRef = doc(db, 'users', auth.currentUser.uid, 'friends', friendId);
        await deleteDoc(fRef);
      } catch (err) {
        console.warn('Error removing friend from Firestore:', err);
      }
    }
  };

  const handleStartQuiz = (q: SoruKaydi) => {
    setQuizList([q]);
    setQuizIndex(0);
    setQuizQuestion(q);
    setIsQuizModalOpen(true);
  };

  const handleStartSession = (list: SoruKaydi[]) => {
    if (!list || list.length === 0) return;
    setQuizList(list);
    setQuizIndex(0);
    setQuizQuestion(list[0]);
    setIsQuizModalOpen(true);
  };

  const handleNextQuiz = () => {
    if (quizList.length > 0 && quizIndex < quizList.length - 1) {
      const nextIdx = quizIndex + 1;
      setQuizIndex(nextIdx);
      setQuizQuestion(quizList[nextIdx]);
    } else {
      setIsQuizModalOpen(false);
    }
  };

  const handlePrevQuiz = () => {
    if (quizList.length > 0 && quizIndex > 0) {
      const prevIdx = quizIndex - 1;
      setQuizIndex(prevIdx);
      setQuizQuestion(quizList[prevIdx]);
    }
  };

  const handleQuizSuccess = async (q: SoruKaydi) => {
    const updatedQ = { ...q, isSolved: true };
    const updated = questions.map((item) => (item.id === q.id ? updatedQ : item));
    const updatedUser = { ...user, xp: user.xp + 30 };
    setQuestionsState(updated);
    saveQuestions(updated);
    setUserState(updatedUser);
    saveUser(updatedUser);
    syncUserToFirestore(updatedUser);

    if (auth.currentUser) {
      try {
        const qRef = doc(db, 'users', auth.currentUser.uid, 'questions', q.id);
        await setDoc(qRef, { ...updatedQ, userId: auth.currentUser.uid }, { merge: true });
      } catch (err) {
        console.warn('Error syncing quiz success to Firestore:', err);
      }
    }
    showToast('🎉 Tebrikler! Doğru Cevap! Soru "Çözüldü" olarak kaydedildi (+30 XP)');
  };

  const handleQuizFail = async (q: SoruKaydi) => {
    const updatedQ = { ...q, isSolved: false };
    const updated = questions.map((item) => (item.id === q.id ? updatedQ : item));
    setQuestionsState(updated);
    saveQuestions(updated);

    if (auth.currentUser) {
      try {
        const qRef = doc(db, 'users', auth.currentUser.uid, 'questions', q.id);
        await setDoc(qRef, { ...updatedQ, userId: auth.currentUser.uid }, { merge: true });
      } catch (err) {
        console.warn('Error syncing quiz fail to Firestore:', err);
      }
    }
    showToast('❌ Yanlış Cevap. Soru "Tekrar Etmeli" havuzuna kaydedildi.');
  };

  const handleToggleScheduleItem = async (id: string) => {
    const updated = schedule.map((item) => (item.id === id ? { ...item, tamamlandi: !item.tamamlandi } : item));
    setScheduleState(updated);
    saveSchedule(updated);

    const toggled = updated.find((i) => i.id === id);
    if (auth.currentUser && toggled) {
      try {
        const sRef = doc(db, 'users', auth.currentUser.uid, 'schedule', id);
        await setDoc(sRef, { ...toggled, userId: auth.currentUser.uid }, { merge: true });
      } catch (err) {
        console.warn('Error updating schedule item in Firestore:', err);
      }
    }
  };

  const handleAddScheduleItem = async (newItem: Omit<ProgramOgesi, 'id'>) => {
    const itemWithId: ProgramOgesi = {
      ...newItem,
      id: 'sch_' + Date.now(),
    };
    const updated = [itemWithId, ...schedule];
    setScheduleState(updated);
    saveSchedule(updated);

    if (auth.currentUser) {
      try {
        const sRef = doc(db, 'users', auth.currentUser.uid, 'schedule', itemWithId.id);
        await setDoc(sRef, { ...itemWithId, userId: auth.currentUser.uid });
      } catch (err) {
        console.warn('Error adding schedule item to Firestore:', err);
      }
    }
    showToast(`✅ "${newItem.ders} - ${newItem.konu}" ders programınıza eklendi!`);
  };

  const handleDeleteScheduleItem = async (id: string) => {
    const updated = schedule.filter((i) => i.id !== id);
    setScheduleState(updated);
    saveSchedule(updated);

    if (auth.currentUser) {
      try {
        const sRef = doc(db, 'users', auth.currentUser.uid, 'schedule', id);
        await deleteDoc(sRef);
      } catch (err) {
        console.warn('Error deleting schedule item from Firestore:', err);
      }
    }
    showToast('🗑️ Görev ders programından silindi.');
  };

  const handleAddToScheduleFromSolution = (ders: string, konu: string) => {
    handleAddScheduleItem({
      gun: 'Sal',
      ders: ders || 'Genel',
      konu: `${konu || 'Soru'} Tekrarı & Soru Çözümü`,
      saat: '20:00 - 20:45',
      tamamlandi: false,
    });
  };

  const handleResetData = async () => {
    resetToCleanState();
    localStorage.removeItem('completed_pomodoros_count');
    localStorage.removeItem('edumind_questions');
    localStorage.removeItem('edumind_schedule');
    localStorage.removeItem('edumind_friends');
    localStorage.removeItem('edumind_user');

    if (auth.currentUser) {
      try {
        const uid = auth.currentUser.uid;
        const userDocRef = doc(db, 'users', uid);
        const resetUserData: Kullanici = {
          id: uid,
          ad: auth.currentUser.displayName || 'Öğrenci',
          email: auth.currentUser.email || 'ogrenci@egitimkocum.ai',
          kredi: 10,
          maxKredi: 10,
          seri: 1,
          xp: 0,
          isPremium: false,
          sinif: 'YKS / LGS Hazırlık',
          avatarUrl: auth.currentUser.photoURL || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
          flashcardPractices: 0,
          nightOwlUnlocked: false,
          invitedCount: 0,
        };
        await setDoc(userDocRef, resetUserData);
        saveUser(resetUserData);
        setUserState(resetUserData);

        // Delete Firestore user questions completely
        const qSnap = await getDocs(collection(db, 'users', uid, 'questions'));
        const qDeletes = qSnap.docs.map((d) => deleteDoc(d.ref));

        // Delete Firestore user schedule completely
        const sSnap = await getDocs(collection(db, 'users', uid, 'schedule'));
        const sDeletes = sSnap.docs.map((d) => deleteDoc(d.ref));

        // Delete Firestore user friends completely
        const fSnap = await getDocs(collection(db, 'users', uid, 'friends'));
        const fDeletes = fSnap.docs.map((d) => deleteDoc(d.ref));

        await Promise.all([...qDeletes, ...sDeletes, ...fDeletes]);
      } catch (err) {
        console.warn('Error resetting Firestore user data:', err);
      }
    }

    setQuestionsState([]);
    saveQuestions([]);
    setScheduleState([]);
    saveSchedule([]);
    setFriendsState([]);
    saveFriends([]);
    setSelectedQuestion(null);
    setQuizQuestion(null);
    setQuizList([]);
    showToast('✨ Tüm veriler, sorular ve XP başarıyla 0\'a sıfırlandı!');
  };

  // Sync theme with HTML root class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleToggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Watch Ad & Earn Credits
  const handleWatchAd = () => {
    setIsNoCreditsModalOpen(true);
  };

  const handleWatchAdSuccess = (earnedCredits = 1) => {
    const maxKredi = user.isPremium ? 999 : 10;
    const newCredit = Math.min(maxKredi, user.kredi + earnedCredits);
    const updatedUser = {
      ...user,
      kredi: newCredit,
    };
    setUserState(updatedUser);
    saveUser(updatedUser);
    syncUserToFirestore(updatedUser);
    if (!user.isPremium && user.kredi >= 10) {
      showToast(`ℹ️ Soru hakkınız zaten maksimum seviyededir (10/10).`);
    } else {
      showToast(`🎉 +${earnedCredits} Soru Hakkı Kazanıldı! (${newCredit}/${maxKredi})`);
    }
  };

  // Dynamic question steps builder (never fallback to hardcoded math)
  const buildDynamicSteps = (customPrompt?: string, dersInput?: string, konuInput?: string) => {
    const text = (customPrompt || '').trim();

    // Check if input is a direct calculation (e.g. 125 / 5, 450 / 9, 3x + 6 = 18)
    const mathSolved = trySolveMathExpression(text);
    if (mathSolved) {
      return mathSolved;
    }

    const lower = text.toLowerCase();

    let detectedDers = dersInput && dersInput !== 'Genel Kültür' ? dersInput : 'Edebiyat / Türkçe';
    let detectedKonu = konuInput && konuInput !== 'Soru Metni & Akıl Yürütme' ? konuInput : 'Paragrafta Anlam ve Dil Bilgisi';
    let hataTuru: HataTuru = 'Kavram Yanılgısı';

    if (dersInput === 'Analiz Edilemedi') {
      detectedDers = 'Analiz Edilemedi';
      detectedKonu = konuInput || 'Soru İçermeyen Görsel';
    } else if (/\b(felsefe|sokrates|platon|aristoteles|epistemoloji|ontoloji|etik|ahlak felsefesi|estetik|varlık|empirizm|rasyonalizm|sezgicilik)\b/i.test(lower)) {
      detectedDers = 'Felsefe';
      detectedKonu = 'Varlık ve Bilgi Felsefesi';
    } else if (/\b(din|iman|ibadet|islam|kuran|sure|ayet|peygamber|hadis|mezhep|fıkıh|kelam|tasavvuf|ahlak)\b/i.test(lower)) {
      detectedDers = 'Din Kültürü';
      detectedKonu = 'İnanç, İbadet ve Ahlak';
    } else if (/\b(anayasa|hukuk|mahkeme|meclis|milletvekili|cumhurbaşkanı|yasa|kanun|yürütme|yargı|içtihat|hakim|hak)\b/i.test(lower)) {
      detectedDers = 'Vatandaşlık & Hukuk';
      detectedKonu = 'Anayasa Hukuku ve Devlet Düzeni';
    } else if (/\b(english|sentence|grammar|present|past|tense|verb|noun|adjective|pronoun|reading|comprehension|translation|vocabulary)\b/i.test(lower) || (/[a-zA-Z\s]{15,}/.test(text) && /\b(the|is|are|was|were|have|has|which|what|where|who)\b/i.test(lower))) {
      detectedDers = 'İngilizce';
      detectedKonu = 'Grammar & Reading Comprehension';
    } else if (lower.includes('tarih') || lower.includes('osmanlı') || lower.includes('savaş') || lower.includes('antlaşma') || lower.includes('devlet') || lower.includes('cumhuriyet') || lower.includes('inkılap') || lower.includes('padişah') || lower.includes('kongre') || lower.includes('fetih') || lower.includes('isyan') || lower.includes('batıcılık') || lower.includes('islamcılık') || lower.includes('fikir') || lower.includes('akım')) {
      detectedDers = 'Tarih';
      detectedKonu = 'Fikir Akımları ve İnkılap Tarihi';
    } else if (lower.includes('coğrafya') || lower.includes('iklim') || lower.includes('nüfus') || lower.includes('harita') || lower.includes('dağ') || lower.includes('ova') || lower.includes('masif') || lower.includes('arazi') || lower.includes('toprak') || lower.includes('plato') || lower.includes('körfez') || lower.includes('jeoloji') || lower.includes('fay') || lower.includes('deprem') || lower.includes('bölge')) {
      detectedDers = 'Coğrafya';
      detectedKonu = 'Türkiye Fiziki Coğrafyası ve Jeoloji';
    } else if (lower.includes('edebiyat') || lower.includes('roman') || lower.includes('şiir') || lower.includes('yazar') || lower.includes('eser') || lower.includes('paragraf') || lower.includes('cümle') || lower.includes('kelime')) {
      detectedDers = 'Edebiyat / Türkçe';
      detectedKonu = 'Edebi Akımlar ve Dil Bilgisi';
    } else if (lower.includes('hız') || lower.includes('kuvvet') || lower.includes('ivme') || lower.includes('fizik') || lower.includes('vektör') || lower.includes('atış') || lower.includes('enerji')) {
      detectedDers = 'Fizik';
      detectedKonu = 'Kinematik & Dinamik';
    } else if (lower.includes('mol') || lower.includes('bileşik') || lower.includes('asit') || lower.includes('kimya') || lower.includes('tepkim') || lower.includes('çözelti') || lower.includes('element')) {
      detectedDers = 'Kimya';
      detectedKonu = 'Mol Hesabı & Tepkimeler';
      hataTuru = 'İşlem Hatası';
    } else if (lower.includes('hücre') || lower.includes('dna') || lower.includes('biyoloji') || lower.includes('genetik') || lower.includes('protein') || lower.includes('organel')) {
      detectedDers = 'Biyoloji';
      detectedKonu = 'Hücre & Kalıtım';
    } else if (/\b(denklem|türev|integral|polinom|fonksiyon|matematik|geometri|parabol|trigonometri|katsayı)\b/i.test(lower) || /\b[x-z]\b/i.test(text) || /\d+/.test(text)) {
      detectedDers = 'Matematik';
      detectedKonu = 'Denklem ve Fonksiyon Çözümü';
      hataTuru = 'İşlem Hatası';
    }

    const isImageOnly = !text || text.includes('Görseldeki soruyu') || text.includes('detaylıca analiz');
    const userTextDisplay = isImageOnly ? `${detectedDers} — ${detectedKonu} Soru Çözümü` : (text || 'Soru Metni ve Verileri');

    let adim1Aciklama = `Soru metni ve verilen öncüller incelendi: "${userTextDisplay}"`;
    let adim1Dogru = `Sorudaki Temel İfade ve Veriler: ${userTextDisplay}`;
    let adim2Hatali = 'Soru öncüllerinde verilen kavramın eksik veya yanlış değerlendirilmesi';
    let adim2Dogru = 'Sorudaki Temel İlke ve Veriler Eksiksiz Uygulanmalıdır';
    let adim3Aciklama = `Sorudaki tüm veriler ${detectedDers} kurallarına göre değerlendirilerek doğru cevaba ulaşıldı.`;
    let adim3Dogru = `${detectedDers} kuralına uygun olarak yanıt doğrulandı.`;
    let sokratikIpucu = `Bu ${detectedDers} (${detectedKonu}) sorusunda 2. adımdaki kural uygulamasını kontrol etmek ister misin?`;
    let pedagojikTeshis = `2. Adımda ${detectedDers} kuralı uygulanırken işlem veya kavram hatası yapıldı.`;

    if (detectedDers === 'Edebiyat / Türkçe') {
      if (/\b(yazım|büyük harf|de\b|da\b|ki\b|mi\b|kesme|imla)\b/i.test(lower)) {
        detectedKonu = 'Yazım Kuralları ve İmla';
        hataTuru = 'Dikkat Eksikliği';
        adim1Aciklama = 'Cümledeki sözcüklerin TDK Yazım Kılavuzu ilkelerine göre doğrulukları tek tek incelendi.';
        adim1Dogru = 'İncelenen Cümledeki Kelimeler ve Ek Yapıları';
        adim2Hatali = 'Bağlaç olan "de/da" veya "ki" takısının ek olanlarla karıştırılarak bitişik/ayrı yazılması hatası veya özel isimlerde kesme işareti eksikliği';
        adim2Dogru = 'Cümleden çıkarıldığında anlam bozulmayan "de/da" ve "ki" bağlaçtır (AYRI yazılır). Bulunma eki "-de/-da" ile aitlik eki "-ki" BİTİŞİK yazılır.';
        adim3Aciklama = 'Cümledeki kelimelerin yazılışları TDK kuralına göre denetlenerek doğru yazım şekli bulundu.';
        adim3Dogru = 'Doğru Yazım Biçimi Doğrulandı.';
        sokratikIpucu = 'Cümledeki "de/da" ekini çıkarıp okuduğunda cümlenin anlamı bozuluyor mu, kontrol eder misin?';
        pedagojikTeshis = 'Bağlaç olan de/da veya ki kullanımı ile eklerin yazımı karıştırıldı.';
      } else if (/\b(noktalama|virgül|nokta|iki nokta|noktalı virgül|tırnak)\b/i.test(lower)) {
        detectedKonu = 'Noktalama İşaretleri';
        adim1Aciklama = 'Cümledeki noktalama işaretlerinin (virgül, iki nokta, noktalı virgül vb.) kullanım amaçları incelendi.';
        adim1Dogru = 'Cümledeki Noktalama Boşlukları ve Sembol İşlevleri';
        adim2Hatali = 'İki noktadan (:) sonra açıklama mı yoksa örnek dizilimi mi yapıldığına dikkat edilmeden harf yüksekliği hatası yapılması';
        adim2Dogru = 'İki noktadan sonra cümle gelirse büyük harfle, örnekler sıralanırsa küçük harfle başlanır. Sıralı cümlelerde virgül kullanılır.';
        adim3Aciklama = 'TDK Noktalama Kılavuzu kuralları uygulanarak doğru sembol dizilimi bulundu.';
        adim3Dogru = 'Noktalama Dizilimi Doğrulandı.';
        sokratikIpucu = 'İki noktadan sonra gelen kısım tam bir cümle kuruyor mu yoksa sadece örnek listesi mi?';
        pedagojikTeshis = 'İki nokta (:) ile noktalı virgül (;) kullanımı karıştırıldı.';
      } else if (/\b(fiilimsi|öge|özne|yüklem|nesne|tümleç)\b/i.test(lower)) {
        detectedKonu = 'Cümlenin Ögeleri ve Fiilimsiler';
        adim1Aciklama = 'Cümlenin yüklemi (çekimli fiili) belirlendi ve yükleme sorulan sorularla cümlenin öge yapısı incelendi.';
        adim1Dogru = 'Cümlenin Yüklemi ve Öge Yapısı';
        adim2Hatali = 'İsim ve sıfat tamlamalarının bölünerek yanlış öge olarak ayrılması';
        adim2Dogru = 'Tamlamalar ve fiilimsi öbekleri ASLA bölünmez! Yükleme "Kim/Ne?" ile Özne, "Ne/Neyi?" ile Nesne bulunur.';
        adim3Aciklama = 'Cümlenin öge dizilimi eksiksiz doğrulanarak doğru cevaba ulaşıldı.';
        adim3Dogru = 'Cümle Ögeleri Doğrulandı.';
        sokratikIpucu = 'Yüklemi bulduktan sonra özne sorusunu sorarken tamlamaları bölmeden grubu tek öge olarak aldın mı?';
        pedagojikTeshis = 'Tamlama öbeği yanlış bölündü veya zaman kipi ile fiilimsi eki karıştırıldı.';
      } else {
        detectedKonu = 'Paragrafta Anlam ve Metin Analizi';
        adim1Aciklama = 'Paragrafın konusu, ana düşüncesi (temel mesaj) ve yardımcı yargıları analiz edildi.';
        adim1Dogru = 'Metnin Odak Noktası ve Ana Vurgusu';
        adim2Hatali = 'Paragrafta geçen ikincil bir detay veya yardımcı düşüncenin, parçanın ana fikri sanılması';
        adim2Dogru = 'Ana düşünce; metnin tamamını kapsayan ve yazarın iletmek istediği en genel ve özetleyici yargıdır.';
        adim3Aciklama = 'Seçeneklerdeki yargılar metindeki temel mesaj ile karşılaştırılarak doğru cevap netleştirildi.';
        adim3Dogru = 'Paragrafın Ana Düşüncesi ve Doğru Şık Doğrulandı.';
        sokratikIpucu = 'Seçeneklerden hangisi paragraftaki ana mesajı bütünüyle özetliyor ve tüm metni kapsıyor?';
        pedagojikTeshis = 'Yardımcı yargı ile parçanın bütününe hâkim olan ana düşünce karıştırıldı.';
      }
    } else if (detectedDers === 'Tarih') {
      adim2Hatali = 'Fikir akımlarının veya olay dönemi ilkelerinin karıştırılması';
      adim2Dogru = 'İlgili Döneme Ait Tarihsel Kavram ve İlkeler Esas Alınmalıdır';
    } else if (detectedDers === 'Coğrafya') {
      adim2Hatali = 'Masif arazilerin genç fay kuşakları veya genç kıvrımlarla karıştırılması';
      adim2Dogru = 'Yıldız Dağları, Zonguldak, Menteşe, Anamur ve Kırşehir 1. Zaman Masifleridir';
    } else if (detectedDers === 'Fizik') {
      adim2Hatali = 'Kuvvet-ivme bağlantısında yön ve birim dönüşümü dikkatsizliği';
      adim2Dogru = 'F = m · a Dinamik Temel Prensibi Uygulanmalıdır';
    } else if (detectedDers === 'Kimya') {
      adim2Hatali = 'Mol kütlesi ile tanecik sayısı katsayısının karıştırılması';
      adim2Dogru = 'n = N / Nₐ Mol Bağıntısı Doğru Uygulanmalıdır';
    } else if (detectedDers === 'Biyoloji') {
      adim2Hatali = 'Pasif taşıma ile aktif taşıma ATP harcanım farkının ihmal edilmesi';
      adim2Dogru = 'Hücre Zarı Taşıma Kuralları ve Organel Görevleri Esas Alınmalıdır';
    } else if (detectedDers === 'Matematik') {
      adim2Hatali = 'Denklem çözülürken parantez açılımında işaret ve katsayı hatası';
      adim2Dogru = 'Bilinmeyen İfade Yalnız Bırakılarak Adım Adım İşlem Yapılmalıydı';
    }

    return {
      ders: detectedDers,
      konu: detectedKonu,
      hataTuru: hataTuru as HataTuru,
      ocrMetin: userTextDisplay,
      pedagojikTeshis: pedagojikTeshis,
      sokratikIpucu: sokratikIpucu,
      cozumAdimlari: [
        {
          adimNo: 1,
          baslik: 'Sorunun Kurulumu ve İncelemesi',
          aciklama: adim1Aciklama,
          isCorrect: true,
          dogruMetin: adim1Dogru,
        },
        {
          adimNo: 2,
          baslik: 'ADIM 2 (KRİTİK HATA VE DOĞRU KURAL)',
          aciklama: 'Kural veya kavram uygulanırken yapılan dikkatsizlik adımı:',
          isCorrect: false,
          hataliMetin: adim2Hatali,
          dogruMetin: adim2Dogru,
        },
        {
          adimNo: 3,
          baslik: 'Sonuç ve Doğrulama',
          aciklama: adim3Aciklama,
          isCorrect: true,
          dogruMetin: adim3Dogru,
        },
      ],
    };
  };

  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [analyzingMessage, setAnalyzingMessage] = useState('');

  // Analyze Question API
  const handleAnalyzeNewQuestion = async (imageData: string | null, customPrompt?: string, audioData?: string): Promise<boolean> => {
    if (!user.isPremium) {
      if (user.kredi <= 0) {
        setIsNoCreditsModalOpen(true);
        return false;
      }
      const updatedUser = {
        ...user,
        kredi: Math.max(0, user.kredi - 1),
        xp: user.xp + 50,
      };
      setUserState(updatedUser);
      saveUser(updatedUser);
      syncUserToFirestore(updatedUser);
    } else {
      const updatedUser = {
        ...user,
        xp: user.xp + 50,
      };
      setUserState(updatedUser);
      saveUser(updatedUser);
      syncUserToFirestore(updatedUser);
    }

    setIsAnalyzingAi(true);
    setAnalyzingMessage(audioData ? 'Sesli Soru Çözümleniyor...' : 'Yapay Zeka Pedagojik Tanı Koyuyor...');

    try {
      const userApiKey = localStorage.getItem('gemini_api_key') || '';

      const data = await analyzeQuestionService({
        imageData: imageData || undefined,
        audioData: audioData || undefined,
        customPrompt: customPrompt && customPrompt.trim() !== '' ? customPrompt.trim() : undefined,
        userApiKey: userApiKey,
      });

      const hasValidSteps = Array.isArray(data?.cozumAdimlari) && data.cozumAdimlari.length > 0;
      const isUnreadable = Boolean(data?.isUnreadable) || data?.ders === 'Analiz Edilemedi' || !hasValidSteps;

      if (isUnreadable) {
        // Refund credit when question cannot be analyzed (if non-PRO)
        if (!user.isPremium) {
          const refundedUser = {
            ...user,
            kredi: Math.min(user.maxKredi || 10, user.kredi + 1),
          };
          setUserState(refundedUser);
          saveUser(refundedUser);
          syncUserToFirestore(refundedUser);
        }
        setIsAnalyzingAi(false);
        showToast(data?.unreadableReason || '⚠️ Soru anlaşılamadı veya geçerli bir ders sorusu tespit edilemedi. Lütfen sorunuzu tekrar sorun.');
        return false;
      }

      const dynamicFallback = buildDynamicSteps(customPrompt, data?.ders, data?.konu);

      const newQ: SoruKaydi = {
        id: `q_${Date.now()}`,
        tarih: 'Şimdi',
        ders: data?.ders && data.ders !== 'Analiz Edilemedi' ? data.ders : dynamicFallback.ders,
        konu: data?.konu || dynamicFallback.konu,
        gorselUrl: imageData || undefined,
        ocrMetin: data?.ocrMetin || customPrompt || 'Görseldeki soru metni okundu ve analiz edildi.',
        hataTuru: data?.hataTuru || dynamicFallback.hataTuru,
        siklar: (data?.siklar && data.siklar.length >= 4) ? data.siklar : undefined,
        dogruSikIndex: typeof data?.dogruSikIndex === 'number' ? data.dogruSikIndex : undefined,
        kritikAdimIndex: data?.kritikAdimIndex || 2,
        pedagojikTeshis: data?.pedagojikTeshis || dynamicFallback.pedagojikTeshis,
        sokratikIpucu: data?.sokratikIpucu || dynamicFallback.sokratikIpucu,
        bilgiKartlari: (Array.isArray(data?.bilgiKartlari) && data.bilgiKartlari.length >= 3) ? data.bilgiKartlari : undefined,
        cozumAdimlari: (data?.cozumAdimlari && data.cozumAdimlari.length > 0) ? data.cozumAdimlari : dynamicFallback.cozumAdimlari,
        ebbinghausTarihi: new Date().toISOString().split('T')[0],
        olusturmaTarihi: new Date().toISOString().split('T')[0],
        isUnreadable: isUnreadable,
        isSaved: true,
      };

      const textOnlyQ = stripHeavyImages(newQ);

      setQuestionsState((prev) => {
        const nextQs = [textOnlyQ, ...prev];
        saveQuestions(nextQs);
        return nextQs;
      });

      if (auth.currentUser) {
        try {
          const qRef = doc(db, 'users', auth.currentUser.uid, 'questions', textOnlyQ.id);
          const safeData = JSON.parse(JSON.stringify({ ...textOnlyQ, userId: auth.currentUser.uid }));
          await setDoc(qRef, safeData, { merge: true });
        } catch (err) {
          console.warn('Error saving question to Firestore:', err);
        }
      }

      setSelectedQuestion(textOnlyQ);
      setActiveTab('solution');
      if (typeof window !== 'undefined') {
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
      }
      return true;
    } catch (err) {
      console.error('Error analyzing question:', err);
      // Refund credit when AI analysis fails for non-PRO users
      if (!user.isPremium) {
        const refundedUser = {
          ...user,
          kredi: Math.min(10, user.kredi + 1),
        };
        setUserState(refundedUser);
        saveUser(refundedUser);
        syncUserToFirestore(refundedUser);
      }
      setIsAnalyzingAi(false);
      showToast('⚠️ Soru analiz edilemedi, lütfen tekrar deneyin veya cevap verilebilir bir soru sorun.');
      return false;
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // Update questions list
  const handleUpdateQuestions = async (updatedQs: SoruKaydi[]) => {
    const textOnlyList = updatedQs.map((q) => stripHeavyImages(q));
    setQuestionsState(textOnlyList);
    saveQuestions(textOnlyList);

    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        for (const q of textOnlyList) {
          const qRef = doc(db, 'users', uid, 'questions', q.id);
          await setDoc(qRef, { ...q, userId: uid }, { merge: true });
        }
        const qSnap = await getDocs(collection(db, 'users', uid, 'questions'));
        const currentIds = new Set(textOnlyList.map((q) => q.id));
        for (const d of qSnap.docs) {
          if (!currentIds.has(d.id)) {
            await deleteDoc(d.ref);
          }
        }
      } catch (err) {
        console.warn('Error updating questions batch in Firestore:', err);
      }
    }
  };

  // Save to error pool
  const handleSaveToErrorPool = async (q: SoruKaydi) => {
    const updatedQ = stripHeavyImages({ ...q, isSaved: true });
    const exists = questions.some((item) => item.id === q.id);
    let updated: SoruKaydi[];
    if (exists) {
      updated = questions.map((item) => (item.id === q.id ? updatedQ : item));
    } else {
      updated = [updatedQ, ...questions];
    }
    setQuestionsState(updated);
    saveQuestions(updated);

    if (auth.currentUser) {
      try {
        const qRef = doc(db, 'users', auth.currentUser.uid, 'questions', q.id);
        await setDoc(qRef, { ...updatedQ, userId: auth.currentUser.uid }, { merge: true });
      } catch (err) {
        console.warn('Error saving question to error pool in Firestore:', err);
      }
    }
    showToast('📌 Soru Yanlış Havuzu\'na kaydedildi!');
  };

  // Save note only (no pool toast — just silently update question's kisiselNot)
  const handleSaveNote = async (q: SoruKaydi) => {
    const updatedQ = stripHeavyImages({ ...q });
    const exists = questions.some((item) => item.id === q.id);
    let updated: SoruKaydi[];
    if (exists) {
      updated = questions.map((item) => (item.id === q.id ? updatedQ : item));
    } else {
      updated = [updatedQ, ...questions];
    }
    setQuestionsState(updated);
    saveQuestions(updated);
    if (auth.currentUser) {
      try {
        const qRef = doc(db, 'users', auth.currentUser.uid, 'questions', q.id);
        await setDoc(qRef, { ...updatedQ, userId: auth.currentUser.uid }, { merge: true });
      } catch (err) {
        console.warn('Error saving note to Firestore:', err);
      }
    }
    // No toast shown here — inline alert in SolutionView handles feedback
  };

  // Generate similar question
  const handleGenerateSimilar = async (q: SoruKaydi, zorluk: 'Kolay' | 'Orta' | 'Zor' = 'Orta') => {
    setIsAnalyzingAi(true);
    setAnalyzingMessage(`Yapay Zeka "${q.konu || q.ders}" Konusunda Benzer Soru Üretiyor (${zorluk} Seviye)...`);

    try {
      const userApiKey = localStorage.getItem('gemini_api_key') || '';
      const data = await generateSimilarQuestionService({ question: q, targetZorluk: zorluk, userApiKey });

      if (!data || !data.ocrMetin || !data.siklar || data.siklar.length < 4) {
        throw new Error('Soru üretilemedi');
      }

      const similarQ: SoruKaydi = {
        ...q,
        id: `sim_${Date.now()}`,
        tarih: 'Şimdi',
        gorselUrl: '', // Clear old image for generated test questions!
        ders: data.ders || q.ders || 'Matematik',
        konu: data.konu || q.konu || 'Konu Pratiği',
        ocrMetin: data.ocrMetin || data.soruMetni || `${q.konu} alanında yeni pratik sorusu (${zorluk} Seviye)`,
        pedagojikTeshis: data.pedagojikTeshis || `${q.konu} konusundaki kural pekiştirme sorusu (${zorluk} Seviye).`,
        sokratikIpucu: data.sokratikIpucu || data.ipucu || `Bu yeni soruda ${q.konu} kuralını adım adım uygula.`,
        siklar: data.siklar || q.siklar,
        dogruSikIndex: data.dogruSikIndex ?? 0,
        cozumAdimlari: data.cozumAdimlari || q.cozumAdimlari,
        isSaved: false,
      };

      setSelectedQuestion(similarQ);
      setQuizQuestion(similarQ);
      setIsQuizModalOpen(true);
      showToast(`🎯 "${q.konu || q.ders}" konusunda ${zorluk} seviye benzer soru hazırlandı!`);
    } catch (err) {
      console.error('Error generating similar question:', err);
      showToast(`⚠️ "${q.konu || q.ders}" konusuyla ilgili benzer soru üretilemedi, lütfen tekrar deneyin.`);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // Posts / Likes in Community
  const handleAddPost = async (post: ToplulukSoru) => {
    const updated = [post, ...posts];
    setPostsState(updated);
    savePosts(updated);

    try {
      const pRef = doc(db, 'community', post.id);
      await setDoc(pRef, post);
    } catch (err) {
      console.warn('Error adding community post to Firestore:', err);
    }
    showToast('💬 Sorunuz toplulukta paylaşıldı!');
  };

  const handleToggleLikePost = async (id: string) => {
    let targetPost: ToplulukSoru | undefined;
    const updated = posts.map((p) => {
      if (p.id === id) {
        targetPost = {
          ...p,
          isLiked: !p.isLiked,
          begeniSayisi: p.isLiked ? p.begeniSayisi - 1 : p.begeniSayisi + 1,
        };
        return targetPost;
      }
      return p;
    });
    setPostsState(updated);
    savePosts(updated);

    if (targetPost) {
      try {
        const pRef = doc(db, 'community', id);
        await setDoc(pRef, targetPost, { merge: true });
      } catch (err) {
        console.warn('Error toggling post like in Firestore:', err);
      }
    }
  };



  // Upgrade user to PRO
  const handleUpgradeToPremium = async () => {
    const updated = {
      ...user,
      isPremium: true,
      maxKredi: 999,
      kredi: 999,
    };
    setUserState(updated);
    saveUser(updated);

    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, { isPremium: true, maxKredi: 999, kredi: 999 }, { merge: true });
      } catch (err) {
        console.warn('Error saving PRO status to Firestore:', err);
      }
    }

    showToast('👑 Tebrikler! Eğitim Koçum PRO üyeliğiniz aktif edildi!');
  };

  // Cancel PRO subscription
  const handleCancelPremium = async () => {
    const updated = {
      ...user,
      isPremium: false,
      maxKredi: 10,
      kredi: Math.min(user.kredi, 10),
    };
    setUserState(updated);
    saveUser(updated);

    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, { isPremium: false, maxKredi: 10, kredi: Math.min(user.kredi, 10) }, { merge: true });
      } catch (err) {
        console.warn('Error saving PRO cancellation to Firestore:', err);
      }
    }

    showToast('ℹ️ PRO aboneliğiniz iptal edildi. Standart 10 soru hakkı planına geçildi.');
  };

  // Auth update user
  const handleLoginSuccess = (partial: Partial<Kullanici>) => {
    const updated = { ...user, ...partial };
    setUserState(updated);
    saveUser(updated);
    syncUserToFirestore(updated);
    setIsAuthModalOpen(false);
    setActiveTab('home');
    showToast(`👋 Hoş geldiniz, ${updated.ad}!`);
  };

  return (
    <div className="min-h-screen bg-background text-text-main font-sans transition-colors duration-200">
      {/* Global Top Header */}
      <TopHeader
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onWatchAd={handleWatchAd}
        onOpenExamCountdown={() => setIsExamModalOpen(true)}
        unreadNotificationsCount={notifications.filter((n) => !n.read).length}
        onOpenNotifications={() => setIsNotificationsCenterOpen(true)}
      />

      {/* Main Screen Router */}
      <main className="max-w-7xl mx-auto px-4 pt-4 pb-36 sm:pb-44">
        {/* Sub Navigation Bar for "Sorularım" group */}
        {(activeTab === 'errorPool' || activeTab === 'solution') && (
          <div className="max-w-2xl mx-auto mb-5 bg-surface-container-low dark:bg-card-bg border border-card-border p-1.5 rounded-2xl flex items-center justify-center gap-1 shadow-xs">
            <button
              onClick={() => setActiveTab('errorPool')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'errorPool'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <span className="material-symbols-outlined text-base">history_edu</span>
              <span>Yanlış Havuzum</span>
            </button>
            <button
              onClick={() => setActiveTab('solution')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'solution'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <span className="material-symbols-outlined text-base">psychology</span>
              <span>Soru Analizi</span>
            </button>
          </div>
        )}

        {/* Sub Navigation Bar for "Gelişim" group */}
        {(activeTab === 'stats' || activeTab === 'leaderboard' || activeTab === 'schedule') && (
          <div className="max-w-2xl mx-auto mb-5 bg-surface-container-low dark:bg-card-bg border border-card-border p-1.5 rounded-2xl flex items-center justify-center gap-1 shadow-xs">
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'stats'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <span className="material-symbols-outlined text-base">bar_chart</span>
              <span>İstatistikler</span>
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <span className="material-symbols-outlined text-base">workspace_premium</span>
              <span>Sıralama</span>
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'schedule'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main'
              }`}
            >
              <span className="material-symbols-outlined text-base">calendar_month</span>
              <span>Program</span>
            </button>
          </div>
        )}

        {activeTab === 'home' && (
          <HomeView
            user={user}
            questions={questions}
            onSelectQuestion={(q) => {
              setSelectedQuestion(q);
              setActiveTab('solution');
            }}
            onUpdateQuestions={handleUpdateQuestions}
            onStartQuiz={handleStartQuiz}
            onStartSession={handleStartSession}
            setActiveTab={setActiveTab}
            onAnalyzeNewQuestion={handleAnalyzeNewQuestion}
            onWatchAd={handleWatchAd}
            onOpenNoCreditsModal={() => setIsNoCreditsModalOpen(true)}
            recentQuestionsCount={questions.length}
            onUpdateUser={handleUpdateUser}
          />
        )}

        {activeTab === 'solution' && (
          <SolutionView
            key={selectedQuestion?.id || 'empty_sol'}
            question={selectedQuestion}
            onSaveToErrorPool={handleSaveToErrorPool}
            onSaveNote={handleSaveNote}
            onGenerateSimilar={handleGenerateSimilar}
            onStartQuiz={handleStartQuiz}
            onAddToSchedule={handleAddToScheduleFromSolution}
            setActiveTab={setActiveTab}
            isSaved={selectedQuestion ? selectedQuestion.isSaved : false}
          />
        )}

        {activeTab === 'errorPool' && (
          <ErrorPoolView
            questions={questions}
            onSelectQuestion={(q) => {
              setSelectedQuestion(q);
              setActiveTab('solution');
              if (typeof window !== 'undefined') {
                window.scrollTo(0, 0);
                document.body.scrollTop = 0;
                document.documentElement.scrollTop = 0;
              }
            }}
            onUpdateQuestions={handleUpdateQuestions}
            onStartQuiz={handleStartQuiz}
            onStartSession={handleStartSession}
            setActiveTab={setActiveTab}
            onRewardXp={(amount) => {
              const updatedUser = {
                ...user,
                xp: user.xp + amount,
                flashcardPractices: (user.flashcardPractices || 0) + 1,
              };
              setUserState(updatedUser);
              saveUser(updatedUser);
              syncUserToFirestore(updatedUser);
              showToast(`🎉 Tebrikler! Bilgi Kartları seansını tamamladın (+${amount} XP)`);
            }}
          />
        )}

        {activeTab === 'community' && (
          <CommunityView
            posts={posts}
            user={user}
            onAddPost={handleAddPost}
            onToggleLike={handleToggleLikePost}
          />
        )}

        {activeTab === 'stats' && (
          <StatsView questions={questions} setActiveTab={setActiveTab} />
        )}

        {activeTab === 'deneme' && (
          <DenemeTakibiView
            onRewardXp={(amount) => {
              const updatedUser = { ...user, xp: user.xp + amount };
              setUserState(updatedUser);
              saveUser(updatedUser);
              syncUserToFirestore(updatedUser);
            }}
            showToast={showToast}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView
            currentUser={user}
            friends={friends}
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleView
            scheduleItems={schedule}
            questions={questions}
            setActiveTab={setActiveTab}
            friends={friends}
            currentUser={user}
            autoJoinRoomCode={pendingJoinRoomCode}
            onClearAutoJoin={() => setPendingJoinRoomCode(null)}
            onToggleItem={handleToggleScheduleItem}
            onAddItem={handleAddScheduleItem}
            onDeleteItem={handleDeleteScheduleItem}
            onRewardXp={(amount) => {
              const updatedUser = { ...user, xp: user.xp + amount };
              setUserState(updatedUser);
              saveUser(updatedUser);
              syncUserToFirestore(updatedUser);
              showToast(`🎉 Tebrikler! Çalışma seansı başarıyla tamamlandı (+${amount} XP)`);
            }}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            user={user}
            questions={questions}
            friends={friends}
            onOpenNotifications={() => setIsNotificationsCenterOpen(true)}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onOpenPremium={() => setIsPremiumModalOpen(true)}
            onCancelPremium={handleCancelPremium}
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            setActiveTab={setActiveTab}
            onResetData={handleResetData}
            onUpdateAvatar={(newAvatarUrl) => {
              const updatedUser = { ...user, avatarUrl: newAvatarUrl };
              setUserState(updatedUser);
              saveUser(updatedUser);
              syncUserToFirestore(updatedUser);
              showToast('Profil avatarınız başarıyla güncellendi!');
            }}
            onUpdateUser={(updatedFields) => {
              const updatedUser = { ...user, ...updatedFields };
              setUserState(updatedUser);
              saveUser(updatedUser);
              syncUserToFirestore(updatedUser);
              showToast('Profil ve ayarlarınız başarıyla güncellendi!');
            }}
            onLogout={async () => {
              try {
                await logoutFirebase();
              } catch (e) {}
              const cleanUser = resetToCleanState();
              setUserState(cleanUser);
              setQuestionsState([]);
              setScheduleState([]);
              setFriendsState([]);
              setNotifications([]);
              setActiveBannerNotif(null);
              setActiveTab('home');
              setIsAuthModalOpen(true);
              setToastMessage('👋 Oturum kapatıldı.');
              setTimeout(() => setToastMessage(null), 3000);
            }}
          />
        )}
      </main>

      {/* Global Bottom Navigation Bar */}
      <BottomNavBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onWatchAd={handleWatchAd}
      />

      {/* Modals */}
      <InviteFriendsModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        currentUser={user}
        friends={friends}
        onAddFriend={handleAddFriend}
        onRemoveFriend={handleRemoveFriend}
        showToast={showToast}
      />
      <QuizTestModal
        isOpen={isQuizModalOpen}
        question={quizQuestion}
        onClose={() => setIsQuizModalOpen(false)}
        onSolveSuccess={handleQuizSuccess}
        onSolveFail={handleQuizFail}
        onSaveToPool={handleSaveToErrorPool}
        currentIndex={quizIndex}
        totalQuestions={quizList.length}
        onNext={handleNextQuiz}
        onPrev={handlePrevQuiz}
      />

      <NotificationSettingsModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        onAddInAppNotification={(notif) => {
          setNotifications((prev) => {
            const exists = prev.some((n) => n.id === notif.id);
            if (!exists) return [notif, ...prev];
            return prev;
          });
          setActiveBannerNotif(notif);
        }}
        showToast={showToast}
      />

      <PremiumVideoModal
        isOpen={isPremiumModalOpen}
        onClose={() => setIsPremiumModalOpen(false)}
        onUpgradeSuccess={handleUpgradeToPremium}
      />

      <NoCreditsModal
        isOpen={isNoCreditsModalOpen}
        onClose={() => setIsNoCreditsModalOpen(false)}
        onWatchAdSuccess={handleWatchAdSuccess}
        onOpenProModal={() => setIsPremiumModalOpen(true)}
        userKredi={user.kredi}
        userMaxKredi={user.maxKredi || 10}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Notifications & Room Invitations Modal */}
      {isNotificationsCenterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-card-bg text-text-main rounded-3xl max-w-md w-full p-5 border border-card-border shadow-2xl space-y-4 relative">
            <div className="flex justify-between items-center border-b border-card-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
                  🔔
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-text-main">Bildirim Kutum</h3>
                  <p className="text-[11px] text-text-muted">Hatırlatıcılar, Davetler ve Uyarılar</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (auth.currentUser) {
                        try {
                          for (const n of notifications) {
                            await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', n.id));
                          }
                        } catch (e) {}
                      }
                      setNotifications([]);
                      showToast('🗑️ Tüm bildirimler temizlendi.');
                    }}
                    className="text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                  >
                    Tümünü Sil
                  </button>
                )}
                <button
                  onClick={() => setIsNotificationsCenterOpen(false)}
                  className="text-text-muted hover:text-text-main p-1.5 rounded-full hover:bg-surface-container-low cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
              {notifications.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <span className="material-symbols-outlined text-4xl text-text-muted opacity-40">notifications_off</span>
                  <p className="text-xs text-text-muted font-bold">Henüz yeni bir bildiriminiz veya oda davetiniz yok.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3.5 rounded-2xl bg-surface-container-low border border-card-border space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={notif.senderAvatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'}
                          alt={notif.senderName || 'Gönderen'}
                          className="w-10 h-10 rounded-full border border-primary/30 object-cover shrink-0"
                        />
                        <div>
                          <h4 className="font-extrabold text-xs text-text-main flex items-center gap-1.5">
                            <span>{notif.title}</span>
                            <span className="text-[10px] text-primary font-mono">({notif.createdAt})</span>
                          </h4>
                          <p className="text-xs text-text-muted font-medium leading-relaxed mt-0.5">{notif.message}</p>
                        </div>
                      </div>
                    </div>

                    {notif.isSenderCopy ? (
                      <div className="pt-2 flex items-center justify-between border-t border-card-border/50">
                        <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">hourglass_top</span>
                          <span>Karşı tarafın onayı bekleniyor...</span>
                        </span>
                        <button
                          onClick={async () => {
                            if (auth.currentUser) {
                              try {
                                await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', notif.id));
                              } catch (e) {}
                            }
                            setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                            showToast('🗑️ Gönderilen istek iptal edildi.');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-rose-500/10 text-rose-500 font-extrabold text-[11px] cursor-pointer transition-all border border-card-border"
                        >
                          🗑️ İptal Et
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2 flex items-center justify-end gap-2 border-t border-card-border/50">
                        {/* Generic Dismiss Button */}
                        <button
                          onClick={() => {
                            cleanDeleteNotification(notif.id);
                            showToast('🗑️ Bildirim silindi.');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-slate-200 dark:hover:bg-slate-800 text-text-muted hover:text-text-main font-bold text-xs cursor-pointer transition-all border border-card-border"
                        >
                          Sil
                        </button>

                        {/* Smart Reminder / Type Actions */}
                        {notif.type === 'pomo_invite' && notif.roomCode && (
                          <button
                            onClick={() => {
                              cleanDeleteNotification(notif.id);
                              setIsNotificationsCenterOpen(false);
                              setPendingJoinRoomCode(notif.roomCode || null);
                              setActiveTab('schedule');
                              showToast(`🚀 "${notif.roomTitle || notif.roomCode}" odaya katılım sağlanıyor!`);
                            }}
                            className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1"
                          >
                            <span>✅ Katıl (Kabul Et)</span>
                          </button>
                        )}

                        {notif.type === 'friend_request' && (
                          <button
                            onClick={async () => {
                              if (notif.senderId && auth.currentUser) {
                                const newFriendForMe: Arkadas = {
                                  id: notif.senderId,
                                  name: notif.senderName || 'Öğrenci',
                                  avatar: notif.senderAvatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
                                  xp: 100,
                                  streak: 1,
                                  joinedAt: new Date().toLocaleDateString('tr-TR'),
                                };
                                handleAddFriend(newFriendForMe);

                                try {
                                  const myFriendObjForSender: Arkadas = {
                                    id: user.id,
                                    name: user.ad || 'Öğrenci',
                                    avatar: user.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
                                    xp: user.xp || 0,
                                    streak: user.seri || 1,
                                    joinedAt: new Date().toLocaleDateString('tr-TR'),
                                  };
                                  await setDoc(doc(db, 'users', notif.senderId, 'friends', user.id), {
                                    ...myFriendObjForSender,
                                    userId: notif.senderId,
                                  });
                                } catch (e) {}
                              }
                              cleanDeleteNotification(notif.id);
                              setIsNotificationsCenterOpen(false);
                              showToast(`🤝 ${notif.senderName || 'Kullanıcı'} ile artık arkadaşsınız! (+50 XP)`);
                            }}
                            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1"
                          >
                            <span>✅ Kabul Et</span>
                          </button>
                        )}

                        {notif.type === 'daily_goal' && (
                          <button
                            onClick={async () => {
                              if (auth.currentUser) {
                                try {
                                  await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', notif.id));
                                } catch (e) {}
                              }
                              setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                              setIsNotificationsCenterOpen(false);
                              setActiveTab('schedule');
                            }}
                            className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-extrabold text-xs cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1"
                          >
                            <span>🎯 Programa Git</span>
                          </button>
                        )}

                        {notif.type === 'error_pool' && (
                          <button
                            onClick={async () => {
                              if (auth.currentUser) {
                                try {
                                  await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', notif.id));
                                } catch (e) {}
                              }
                              setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                              setIsNotificationsCenterOpen(false);
                              setActiveTab('errorPool');
                            }}
                            className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1"
                          >
                            <span>🧠 Hata Havuzunu Aç</span>
                          </button>
                        )}

                        {notif.type === 'streak' && (
                          <button
                            onClick={async () => {
                              if (auth.currentUser) {
                                try {
                                  await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', notif.id));
                                } catch (e) {}
                              }
                              setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                              setIsNotificationsCenterOpen(false);
                              setActiveTab('home');
                            }}
                            className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1"
                          >
                            <span>🔥 Soru Çöz</span>
                          </button>
                        )}

                        {notif.type === 'weekly_report' && (
                          <button
                            onClick={async () => {
                              if (auth.currentUser) {
                                try {
                                  await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', notif.id));
                                } catch (e) {}
                              }
                              setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                              setIsNotificationsCenterOpen(false);
                              setActiveTab('stats');
                            }}
                            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1"
                          >
                            <span>📊 Raporu Aç</span>
                          </button>
                        )}

                        {notif.type === 'exam_alert' && (
                          <button
                            onClick={async () => {
                              if (auth.currentUser) {
                                try {
                                  await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', notif.id));
                                } catch (e) {}
                              }
                              setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                              setIsNotificationsCenterOpen(false);
                              setIsExamModalOpen(true);
                            }}
                            className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-extrabold text-xs cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1"
                          >
                            <span>🚀 Hedefe Bak</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen AI Question Analysis Loading Overlay */}
      <AiAnalyzingOverlay
        isOpen={isAnalyzingAi}
        message={analyzingMessage}
      />

      {/* Global Floating Lo-Fi Audio Widget */}
      <LofiAudioWidget />

      {/* Target Exam Countdown Modal Window */}
      <ExamCountdownWidget
        user={user}
        onUpdateUser={handleUpdateUser}
        isOpen={isExamModalOpen}
        onClose={() => setIsExamModalOpen(false)}
      />

      {/* Floating Instant Notification Banner (Pops up ONLY for live friend or Pomodoro room invitations) - Logged in only */}
      {activeBannerNotif && auth.currentUser && !isAuthModalOpen && (activeBannerNotif.type === 'friend_request' || activeBannerNotif.type === 'pomo_invite') && (
        <div className="fixed top-3 left-4 right-4 z-50 max-w-md mx-auto animate-slideDown">
          <div className="bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-xl border border-purple-500/40 p-4 rounded-3xl shadow-2xl space-y-3 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={activeBannerNotif.senderAvatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'}
                  alt={activeBannerNotif.senderName || 'Gönderen'}
                  className="w-10 h-10 rounded-full border border-purple-400/50 object-cover shrink-0"
                />
                <div>
                  <h4 className="font-extrabold text-xs text-purple-300 flex items-center gap-1.5">
                    <span>{activeBannerNotif.title}</span>
                  </h4>
                  <p className="text-xs font-semibold text-slate-200 leading-tight mt-0.5">{activeBannerNotif.message}</p>
                </div>
              </div>

              <button
                onClick={() => setActiveBannerNotif(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/10">
              <button
                onClick={() => {
                  cleanDeleteNotification(activeBannerNotif.id);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold text-xs cursor-pointer border border-white/10 transition-all"
              >
                Kapat
              </button>

              {activeBannerNotif.type === 'pomo_invite' && activeBannerNotif.roomCode && (
                <button
                  onClick={() => {
                    const code = activeBannerNotif.roomCode;
                    cleanDeleteNotification(activeBannerNotif.id);
                    setPendingJoinRoomCode(code || null);
                    setActiveTab('schedule');
                    showToast(`🚀 "${activeBannerNotif.roomTitle || code}" odaya katıldın!`);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs cursor-pointer shadow-lg active:scale-95 transition-all flex items-center gap-1"
                >
                  <span>✅ Katıl (Kabul Et)</span>
                </button>
              )}

              {activeBannerNotif.type === 'friend_request' && (
                <button
                  onClick={async () => {
                    if (activeBannerNotif.senderId && auth.currentUser) {
                      const newFriendForMe: Arkadas = {
                        id: activeBannerNotif.senderId,
                        name: activeBannerNotif.senderName || 'Öğrenci',
                        avatar: activeBannerNotif.senderAvatar || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
                        xp: 100,
                        streak: 1,
                        joinedAt: new Date().toLocaleDateString('tr-TR'),
                      };
                      handleAddFriend(newFriendForMe);

                      try {
                        const myFriendObjForSender: Arkadas = {
                          id: user.id,
                          name: user.ad || 'Öğrenci',
                          avatar: user.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
                          xp: user.xp || 0,
                          streak: user.seri || 1,
                          joinedAt: new Date().toLocaleDateString('tr-TR'),
                        };
                        await setDoc(doc(db, 'users', activeBannerNotif.senderId, 'friends', user.id), {
                          ...myFriendObjForSender,
                          userId: activeBannerNotif.senderId,
                        });
                      } catch (e) {}
                    }
                    cleanDeleteNotification(activeBannerNotif.id);
                    showToast(`🤝 ${activeBannerNotif.senderName || 'Kullanıcı'} ile artık arkadaşsınız! (+50 XP)`);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs cursor-pointer shadow-lg active:scale-95 transition-all flex items-center gap-1"
                >
                  <span>✅ Kabul Et</span>
                </button>
              )}

              {activeBannerNotif.type === 'daily_goal' && (
                <button
                  onClick={() => {
                    setActiveBannerNotif(null);
                    setActiveTab('schedule');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-extrabold text-xs cursor-pointer shadow-lg active:scale-95 transition-all flex items-center gap-1"
                >
                  <span>🎯 Programa Git</span>
                </button>
              )}

              {activeBannerNotif.type === 'error_pool' && (
                <button
                  onClick={() => {
                    setActiveBannerNotif(null);
                    setActiveTab('errorPool');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs cursor-pointer shadow-lg active:scale-95 transition-all flex items-center gap-1"
                >
                  <span>🧠 Hata Havuzunu Aç</span>
                </button>
              )}

              {activeBannerNotif.type === 'streak' && (
                <button
                  onClick={() => {
                    setActiveBannerNotif(null);
                    setActiveTab('home');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs cursor-pointer shadow-lg active:scale-95 transition-all flex items-center gap-1"
                >
                  <span>🔥 Soru Çöz</span>
                </button>
              )}

              {activeBannerNotif.type === 'weekly_report' && (
                <button
                  onClick={() => {
                    setActiveBannerNotif(null);
                    setActiveTab('stats');
                  }}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs cursor-pointer shadow-lg active:scale-95 transition-all flex items-center gap-1"
                >
                  <span>📊 Raporu Aç</span>
                </button>
              )}

              {activeBannerNotif.type === 'exam_alert' && (
                <button
                  onClick={() => {
                    setActiveBannerNotif(null);
                    setIsExamModalOpen(true);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-extrabold text-xs cursor-pointer shadow-lg active:scale-95 transition-all flex items-center gap-1"
                >
                  <span>🚀 Hedefe Bak</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white font-bold text-xs px-5 py-3 rounded-full shadow-2xl border border-white/20 animate-fadeIn flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-primary">auto_awesome</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;
