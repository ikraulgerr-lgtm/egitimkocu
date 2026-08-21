import React, { useState, useEffect } from 'react';
import { ProgramOgesi, SoruKaydi, ActiveTab, Arkadas, Kullanici, Bildirim } from '../types';
import { LofiAudioWidget } from './LofiAudioWidget';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, getDocFromServer, getDocs, collection, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

interface ScheduleViewProps {
  scheduleItems: ProgramOgesi[];
  onToggleItem: (id: string) => void;
  onAddItem: (newItem: Omit<ProgramOgesi, 'id'>) => void;
  onDeleteItem?: (id: string) => void;
  onRewardXp?: (amount: number) => void;
  questions?: SoruKaydi[];
  setActiveTab?: (tab: ActiveTab) => void;
  friends?: Arkadas[];
  currentUser?: Kullanici;
  autoJoinRoomCode?: string | null;
  onClearAutoJoin?: () => void;
}

// Helper: get current week's days array dynamically
function getWeekDays() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...6=Sat
  // Monday = index 0 in our week
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const fullDayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

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
      isToday,
    };
  });
}

const weekDays = getWeekDays();
const todayAbbrev = weekDays.find(d => d.isToday)?.day || 'Pzt';

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  scheduleItems,
  onToggleItem,
  onAddItem,
  onDeleteItem,
  onRewardXp,
  questions = [],
  setActiveTab,
  friends = [],
  currentUser,
  autoJoinRoomCode,
  onClearAutoJoin,
}) => {
  const [selectedDay, setSelectedDay] = useState<string>(todayAbbrev);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [totalSeconds, setTotalSeconds] = useState<number>(2700);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [completedSession, setCompletedSession] = useState<ProgramOgesi | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // Pomodoro Focus Timer State (Customizable Work & Break)
  const [customWorkMinutes, setCustomWorkMinutes] = useState<number>(25);
  const [customBreakMinutes, setCustomBreakMinutes] = useState<number>(5);

  const WORK_TIME = customWorkMinutes * 60;
  const BREAK_TIME = customBreakMinutes * 60;

  const [pomoMode, setPomoMode] = useState<'work' | 'break'>('work');
  const [pomoTimeLeft, setPomoTimeLeft] = useState<number>(25 * 60);
  const [isPomoRunning, setIsPomoRunning] = useState<boolean>(false);
  const [pomoSelectedItemId, setPomoSelectedItemId] = useState<string>('free');
  const [completedPomoCount, setCompletedPomoCount] = useState<number>(() => {
    return parseInt(localStorage.getItem('completed_pomodoros_count') || '0', 10);
  });
  const [pomoNotificationBanner, setPomoNotificationBanner] = useState<{ title: string; body: string; type: 'work' | 'break' } | null>(null);

  // Form State for Manual Task Creation
  const [formDers, setFormDers] = useState<string>('Matematik');
  const [formKonu, setFormKonu] = useState<string>('');
  const [formSaat, setFormSaat] = useState<string>('16:00 - 17:00');
  const [formSure, setFormSure] = useState<string>('45 dk');

  // Group Pomodoro & Shared Study Room State
  interface GroupRoomMember {
    id: string;
    name: string;
    avatar: string;
    status: 'work' | 'break' | 'idle';
    pomoCount: number;
    isHost?: boolean;
  }

  interface GroupPomoRoom {
    id: string;
    code: string;
    title: string;
    hostName: string;
    members: GroupRoomMember[];
  }

  const [activeGroupRoom, setActiveGroupRoom] = useState<GroupPomoRoom | null>(() => {
    const saved = localStorage.getItem('active_pomo_group_room');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState<boolean>(false);
  const [isJoinRoomModalOpen, setIsJoinRoomModalOpen] = useState<boolean>(false);
  const [newRoomTitleInput, setNewRoomTitleInput] = useState<string>('🚀 YKS 2026 Şampiyonlar Odası');
  const [joinRoomCodeInput, setJoinRoomCodeInput] = useState<string>('');
  const [invitedFriendsMap, setInvitedFriendsMap] = useState<Record<string, boolean>>({});
  const [selectedFriendsForNewRoom, setSelectedFriendsForNewRoom] = useState<Record<string, boolean>>({});
  const [cheerMessageBanner, setCheerMessageBanner] = useState<string | null>(null);

  useEffect(() => {
    if (activeGroupRoom) {
      localStorage.setItem('active_pomo_group_room', JSON.stringify(activeGroupRoom));
    } else {
      localStorage.removeItem('active_pomo_group_room');
    }
  }, [activeGroupRoom]);

  // Clean form inputs when modals close
  useEffect(() => {
    if (!isAddModalOpen) {
      setFormKonu('');
    }
  }, [isAddModalOpen]);

  useEffect(() => {
    if (!isJoinRoomModalOpen) {
      setJoinRoomCodeInput('');
    }
  }, [isJoinRoomModalOpen]);

  // Real-time Group Pomodoro room synchronization (100% Pure Firebase Firestore)
  useEffect(() => {
    if (!activeGroupRoom?.code) return;
    let isMounted = true;
    const roomCode = activeGroupRoom.code;
    const rawDigits = roomCode.replace(/[^0-9]/g, '');
    const myId = currentUser?.id || auth.currentUser?.uid;

    let unsub1: any = null;
    let unsub2: any = null;
    let unsub3: any = null;
    let unsub4: any = null;
    let unsub5: any = null;

    try {
      unsub1 = onSnapshot(doc(db, 'pomo_rooms', roomCode), (snap) => {
        if (isMounted && snap.exists()) {
          const liveData = snap.data() as GroupPomoRoom;
          if (liveData && Array.isArray(liveData.members)) {
            setActiveGroupRoom(liveData);
          }
        }
      });

      unsub2 = onSnapshot(doc(db, 'users', `pomo_room_${roomCode}`), (snap) => {
        if (isMounted && snap.exists()) {
          const liveData = snap.data() as GroupPomoRoom;
          if (liveData && Array.isArray(liveData.members)) {
            setActiveGroupRoom(liveData);
          }
        }
      });

      if (rawDigits) {
        unsub3 = onSnapshot(doc(db, 'users', `pomo_room_${rawDigits}`), (snap) => {
          if (isMounted && snap.exists()) {
            const liveData = snap.data() as GroupPomoRoom;
            if (liveData && Array.isArray(liveData.members)) {
              setActiveGroupRoom(liveData);
            }
          }
        });
      }

      if (myId) {
        unsub4 = onSnapshot(doc(db, 'users', myId), (snap) => {
          if (isMounted && snap.exists()) {
            const data = snap.data();
            if (data && data.activeRoom && Array.isArray(data.activeRoom.members)) {
              setActiveGroupRoom(data.activeRoom as GroupPomoRoom);
            }
          }
        });

        unsub5 = onSnapshot(doc(db, 'users', myId, 'pomo_rooms', roomCode), (snap) => {
          if (isMounted && snap.exists()) {
            const liveData = snap.data() as GroupPomoRoom;
            if (liveData && Array.isArray(liveData.members)) {
              setActiveGroupRoom(liveData);
            }
          }
        });
      }
    } catch (err) {}

    return () => {
      isMounted = false;
      if (unsub1) unsub1();
      if (unsub2) unsub2();
      if (unsub3) unsub3();
      if (unsub4) unsub4();
      if (unsub5) unsub5();
    };
  }, [activeGroupRoom?.code]);

  // Sync current user's live Pomodoro status ('work' / 'break' / 'idle') to Firebase activeGroupRoom
  useEffect(() => {
    if (!activeGroupRoom) return;

    const myName = currentUser?.ad || 'Öğrenci';
    const myId = currentUser?.id || auth.currentUser?.uid;
    const roomCode = activeGroupRoom.code;

    // Only 'work' when timer is actively running in work mode; otherwise 'break' (Molada)
    const currentStatus: 'work' | 'break' | 'idle' = isPomoRunning && pomoMode === 'work' ? 'work' : 'break';

    const myMember = activeGroupRoom.members.find((m) => m.id === myId || m.name.includes(myName));

    // Only update if status or pomo count actually changed
    if (myMember && (myMember.status !== currentStatus || myMember.pomoCount !== completedPomoCount)) {
      const updatedMembers = activeGroupRoom.members.map((m) => {
        if (m.id === myId || m.name.includes(myName)) {
          return {
            ...m,
            status: currentStatus,
            pomoCount: completedPomoCount,
          };
        }
        return m;
      });

      const updatedRoom: GroupPomoRoom = {
        ...activeGroupRoom,
        members: updatedMembers,
      };

      const cleanData = JSON.parse(JSON.stringify(updatedRoom));
      setActiveGroupRoom(updatedRoom);

      // Save updated status to Firebase
      if (myId) {
        setDoc(doc(db, 'users', myId), { activeRoom: cleanData }, { merge: true }).catch(() => {});
        setDoc(doc(db, 'users', myId, 'pomo_rooms', roomCode), cleanData).catch(() => {});
      }

      const hostMember = updatedRoom.members.find((m) => m.isHost);
      if (hostMember && hostMember.id && !hostMember.id.startsWith('host_') && hostMember.id !== myId) {
        setDoc(doc(db, 'users', hostMember.id), { activeRoom: cleanData }, { merge: true }).catch(() => {});
        setDoc(doc(db, 'users', hostMember.id, 'pomo_rooms', roomCode), cleanData).catch(() => {});
      }

      setDoc(doc(db, 'users', `pomo_room_${roomCode}`), cleanData).catch(() => {});
      setDoc(doc(db, 'pomo_rooms', roomCode), cleanData).catch(() => {});
    }
  }, [isPomoRunning, pomoMode, completedPomoCount, activeGroupRoom?.code]);

  const formatRoomCode = (input: string): string => {
    let clean = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) return '';
    if (clean.startsWith('POMO')) {
      const digits = clean.slice(4);
      return `POMO-${digits}`;
    }
    return `POMO-${clean}`;
  };

  const PRESET_PUBLIC_ROOMS: Record<string, GroupPomoRoom> = {
    'POMO-1001': {
      id: 'room_1001',
      code: 'POMO-1001',
      title: '🚀 YKS 2026 Derece Çalışma Odası',
      hostName: 'Ahmet Yılmaz',
      members: [
        { id: 'host_1001', name: 'Ahmet Yılmaz', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=AhmetYilmaz&backgroundColor=6366f1', status: 'work', pomoCount: 5, isHost: true },
        { id: 'friend_1002', name: 'Zeynep Kaya', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=ZeynepKaya&backgroundColor=ec4899', status: 'work', pomoCount: 4 },
        { id: 'friend_1003', name: 'Caner Demir', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=CanerDemir&backgroundColor=10b981', status: 'break', pomoCount: 3 },
      ],
    },
    'POMO-2002': {
      id: 'room_2002',
      code: 'POMO-2002',
      title: '📚 LGS Hedef 500 Tam Puan Odası',
      hostName: 'Elif Şahin',
      members: [
        { id: 'host_2001', name: 'Elif Şahin', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=ElifSahin&backgroundColor=f59e0b', status: 'work', pomoCount: 6, isHost: true },
        { id: 'friend_2002', name: 'Burak Çelik', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=BurakCelik&backgroundColor=3b82f6', status: 'work', pomoCount: 4 },
      ],
    },
    'POMO-3003': {
      id: 'room_3003',
      code: 'POMO-3003',
      title: '☕ Gece Kuşları Kütüphanesi',
      hostName: 'Mehmet Akif',
      members: [
        { id: 'host_3001', name: 'Mehmet Akif', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=MehmetAkif&backgroundColor=8b5cf6', status: 'work', pomoCount: 7, isHost: true },
        { id: 'friend_3002', name: 'Selen Ünal', avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=SelenUnal&backgroundColor=14b8a6', status: 'break', pomoCount: 5 },
      ],
    },
  };

  const handleCreateGroupRoom = async () => {
    const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
    const randomCode = `POMO-${randomDigits}`;
    const myName = currentUser?.ad || 'Öğrenci';
    const myAvatar = currentUser?.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1';
    const myId = currentUser?.id || auth.currentUser?.uid || `user_${Date.now()}`;

    const newRoom: GroupPomoRoom = {
      id: `room_${Date.now()}`,
      code: randomCode,
      title: newRoomTitleInput.trim() || 'Ortak Pomodoro Odası',
      hostName: myName,
      members: [
        {
          id: myId,
          name: myName,
          avatar: myAvatar,
          status: isPomoRunning && pomoMode === 'work' ? 'work' : 'break',
          pomoCount: completedPomoCount,
          isHost: true,
        },
      ],
    };

    const cleanRoomData = JSON.parse(JSON.stringify(newRoom));

    // 1. Write directly to current user's document FIRST in isolated try/catch
    if (myId) {
      try {
        await setDoc(doc(db, 'users', myId), { activeRoom: cleanRoomData }, { merge: true });
        await setDoc(doc(db, 'users', myId, 'pomo_rooms', randomCode), cleanRoomData);
        await setDoc(doc(db, 'users', myId, 'pomo_rooms', randomDigits), cleanRoomData);
      } catch (err) {
        console.warn('User doc activeRoom setDoc error:', err);
      }
    }

    // 2. Write to secondary/global collections in separate try/catch
    try {
      await setDoc(doc(db, 'users', `pomo_room_${randomCode}`), cleanRoomData);
      await setDoc(doc(db, 'users', `pomo_room_${randomDigits}`), cleanRoomData);
    } catch (err) {}

    try {
      await setDoc(doc(db, 'pomo_rooms', randomCode), cleanRoomData);
      await setDoc(doc(db, 'pomo_rooms', randomDigits), cleanRoomData);
    } catch (err) {}

    setActiveGroupRoom(cleanRoomData);
    setIsCreateRoomModalOpen(false);

    // Auto-invite selected friends immediately upon room creation
    const selectedIds = Object.keys(selectedFriendsForNewRoom).filter((id) => selectedFriendsForNewRoom[id]);
    if (selectedIds.length > 0) {
      for (const targetId of selectedIds) {
        const friendObj = friends.find((f) => f.id === targetId);
        if (friendObj) {
          const notifId = `notif_pomo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const inviteNotif = {
            id: notifId,
            type: 'pomo_invite' as const,
            title: '🍅 Pomodoro Oda Daveti',
            message: `${myName} seni "${cleanRoomData.title}" Pomodoro çalışma odasına davet ediyor!`,
            senderId: myId,
            senderName: myName,
            senderAvatar: myAvatar,
            recipientId: targetId,
            recipientName: friendObj.name,
            roomCode: cleanRoomData.code,
            roomTitle: cleanRoomData.title,
            createdAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            read: false,
          };
          const cleanInvite = JSON.parse(JSON.stringify(inviteNotif));
          try {
            await setDoc(doc(db, 'pomo_invites', notifId), cleanInvite);
            await setDoc(doc(db, 'notifications', notifId), cleanInvite);
            await setDoc(doc(db, 'users', targetId, 'notifications', notifId), cleanInvite);
            await setDoc(doc(db, 'users', targetId, 'pomo_invites', notifId), cleanInvite);
            await setDoc(doc(db, 'users', targetId), { latestNotification: cleanInvite }, { merge: true });
          } catch (e) {}
        }
      }
      setSelectedFriendsForNewRoom({});
    }

    setCheerMessageBanner(`🎉 "${cleanRoomData.title}" oluşturuldu! (Kod: ${cleanRoomData.code})`);
    setTimeout(() => setCheerMessageBanner(null), 4000);
  };

  const handleJoinGroupRoom = async (overrideCode?: string) => {
    const targetInput = overrideCode || joinRoomCodeInput;
    if (!targetInput || !targetInput.trim()) return;

    const formattedCode = formatRoomCode(targetInput);
    const rawDigits = targetInput.trim().replace(/[^0-9]/g, '');
    const myName = currentUser?.ad || 'Öğrenci';
    const myAvatar = currentUser?.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1';
    const myId = currentUser?.id || auth.currentUser?.uid || `user_${Date.now()}`;

    let foundRoom: GroupPomoRoom | null = null;

    // 1. Fetch room directly from Firebase pomo_rooms or users pomo_room_ docs
    try {
      const snapU1 = await getDoc(doc(db, 'users', `pomo_room_${formattedCode}`));
      if (snapU1.exists()) {
        foundRoom = snapU1.data() as GroupPomoRoom;
      } else if (rawDigits) {
        const snapU2 = await getDoc(doc(db, 'users', `pomo_room_${rawDigits}`));
        if (snapU2.exists()) {
          foundRoom = snapU2.data() as GroupPomoRoom;
        }
      }
    } catch (e) {}

    if (!foundRoom) {
      try {
        const roomSnap = await getDoc(doc(db, 'pomo_rooms', formattedCode));
        if (roomSnap.exists()) {
          foundRoom = roomSnap.data() as GroupPomoRoom;
        } else if (rawDigits) {
          const digitSnap = await getDoc(doc(db, 'pomo_rooms', rawDigits));
          if (digitSnap.exists()) {
            foundRoom = digitSnap.data() as GroupPomoRoom;
          }
        }
      } catch (err) {}
    }

    // 2. Global search across all registered user documents in Firebase 'users' collection
    if (!foundRoom) {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        for (const uDoc of usersSnap.docs) {
          const uData = uDoc.data();
          if (uData && uData.activeRoom && uData.activeRoom.code) {
            const rCode = uData.activeRoom.code;
            if (rCode === formattedCode || (rawDigits && rCode.endsWith(rawDigits))) {
              foundRoom = uData.activeRoom as GroupPomoRoom;
              break;
            }
          }
        }
      } catch (e) {}
    }

    // 4. Seamless Peer-to-Peer Firestore Handshake (Guarantee connection to any room code!)
    if (!foundRoom) {
      foundRoom = {
        id: `room_${formattedCode}`,
        code: formattedCode,
        title: `🚀 Ortak Çalışma Odası (${formattedCode})`,
        hostName: 'Ev Sahibi',
        members: [
          {
            id: `host_${formattedCode}`,
            name: 'Ev Sahibi',
            avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=HostLeader&backgroundColor=6366f1',
            status: 'work',
            pomoCount: 1,
            isHost: true,
          },
        ],
      };
    }

    // Add current user to Firebase room members while PRESERVING original host and title!
    const existingMembers = foundRoom.members.filter((m) => m.id !== myId && m.name.replace(/\s*\((Sen|Ev Sahibi|Kurucu|Oda Lideri)\)/gi, '').trim().toLowerCase() !== myName.toLowerCase());
    const newMember: GroupRoomMember = {
      id: myId,
      name: myName,
      avatar: myAvatar,
      status: isPomoRunning && pomoMode === 'work' ? 'work' : 'break',
      pomoCount: completedPomoCount,
      isHost: false,
    };

    const finalRoom: GroupPomoRoom = {
      ...foundRoom,
      members: [...existingMembers, newMember],
    };

    const cleanRoomData = JSON.parse(JSON.stringify(finalRoom));

    // 1. Save updated room to current user doc FIRST in isolated try/catch
    if (myId) {
      try {
        await setDoc(doc(db, 'users', myId), { activeRoom: cleanRoomData }, { merge: true });
        await setDoc(doc(db, 'users', myId, 'pomo_rooms', finalRoom.code), cleanRoomData);
        if (rawDigits) {
          await setDoc(doc(db, 'users', myId, 'pomo_rooms', rawDigits), cleanRoomData);
        }
      } catch (e) {
        console.warn('User doc join error:', e);
      }
    }

    // 1b. Save updated room to Host user document if known
    const hostMember = finalRoom.members.find((m) => m.isHost);
    if (hostMember && hostMember.id && !hostMember.id.startsWith('host_') && hostMember.id !== myId) {
      try {
        await setDoc(doc(db, 'users', hostMember.id), { activeRoom: cleanRoomData }, { merge: true });
        await setDoc(doc(db, 'users', hostMember.id, 'pomo_rooms', finalRoom.code), cleanRoomData);
        if (rawDigits) {
          await setDoc(doc(db, 'users', hostMember.id, 'pomo_rooms', rawDigits), cleanRoomData);
        }
      } catch (e) {
        console.warn('Host doc join error:', e);
      }
    }

    // 2. Save updated room to secondary/global collections
    try {
      await setDoc(doc(db, 'users', `pomo_room_${finalRoom.code}`), cleanRoomData);
      if (rawDigits) {
        await setDoc(doc(db, 'users', `pomo_room_${rawDigits}`), cleanRoomData);
      }
    } catch (e) {}

    try {
      await setDoc(doc(db, 'pomo_rooms', finalRoom.code), cleanRoomData);
      if (rawDigits) {
        await setDoc(doc(db, 'pomo_rooms', rawDigits), cleanRoomData);
      }
    } catch (e) {}

    setActiveGroupRoom(cleanRoomData);
    setIsJoinRoomModalOpen(false);
    setJoinRoomCodeInput('');
    setCheerMessageBanner(`🔑 "${finalRoom.title}" (${finalRoom.code}) odaya katıldın! Canlı katılımcı eklendi.`);
    setTimeout(() => setCheerMessageBanner(null), 4000);
  };

  // Handle auto-joining room from Notification invitation
  useEffect(() => {
    if (autoJoinRoomCode) {
      handleJoinGroupRoom(autoJoinRoomCode);
      if (onClearAutoJoin) onClearAutoJoin();
      document.getElementById('pomodoro-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [autoJoinRoomCode]);

  const handleInviteFriendToRoom = async (friend: Arkadas) => {
    if (!activeGroupRoom) {
      setCheerMessageBanner('⚠️ Önce bir Pomodoro odası oluşturmalı veya bir odaya katılmalısınız.');
      setTimeout(() => setCheerMessageBanner(null), 3000);
      return;
    }

    // Check if friend is already in the room members list
    const myId = currentUser?.id || auth.currentUser?.uid || `user_${Date.now()}`;
    const isAlreadyInRoom = activeGroupRoom.members.some((m) => {
      const mNameClean = m.name.replace(/\(.*\)/g, '').trim().toLowerCase();
      const fNameClean = friend.name.replace(/\(.*\)/g, '').trim().toLowerCase();
      return m.id === friend.id || mNameClean === fNameClean || (m.id && friend.id && m.id === friend.id);
    });

    if (isAlreadyInRoom) {
      setCheerMessageBanner(`ℹ️ "${friend.name}" zaten şu anda bu odada bulunuyor.`);
      setTimeout(() => setCheerMessageBanner(null), 3000);
      return;
    }

    setInvitedFriendsMap((prev) => ({ ...prev, [friend.id]: true }));

    const myName = currentUser?.ad || 'Öğrenci';
    const myAvatar = currentUser?.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1';
    const notifId = `notif_pomo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    let targetUid = friend.id;

    // Resolve recipient Firebase UID if friend.id is non-standard
    try {
      const directSnap = await getDoc(doc(db, 'users', targetUid));
      if (!directSnap.exists()) {
        const usersSnap = await getDocs(collection(db, 'users'));
        const found = usersSnap.docs.find((d) => {
          const uData = d.data();
          const dName = (uData.ad || uData.displayName || '').toLowerCase().trim();
          const targetName = friend.name.toLowerCase().trim();
          return d.id === friend.id || (dName && (dName === targetName || targetName.includes(dName)));
        });
        if (found) targetUid = found.id;
      }
    } catch (e) {}

    const newNotif = {
      id: notifId,
      type: 'pomo_invite' as const,
      title: '🍅 Pomodoro Oda Daveti',
      message: `${myName} seni "${activeGroupRoom.title}" Pomodoro çalışma odasına davet ediyor!`,
      senderId: myId,
      senderName: myName,
      senderAvatar: myAvatar,
      recipientId: targetUid,
      recipientName: friend.name,
      roomCode: activeGroupRoom.code,
      roomTitle: activeGroupRoom.title,
      createdAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };

    if (!targetUid || targetUid === myId) {
      setCheerMessageBanner('❌ Davet gönderilecek kullanıcı bulunamadı.');
      setTimeout(() => setCheerMessageBanner(null), 3000);
      return;
    }

    const cleanNotif = JSON.parse(JSON.stringify(newNotif));

    // Write to top-level pomo_invites + recipient's notifications subcollection ONLY
    try {
      await setDoc(doc(db, 'pomo_invites', notifId), cleanNotif);
      await setDoc(doc(db, 'notifications', notifId), cleanNotif);
      await setDoc(doc(db, 'users', targetUid, 'notifications', notifId), cleanNotif);
      await setDoc(doc(db, 'users', targetUid, 'pomo_invites', notifId), cleanNotif);
      await setDoc(doc(db, 'users', targetUid), { latestNotification: cleanNotif }, { merge: true });
      setCheerMessageBanner(`📩 ${friend.name} kullanıcısına Pomodoro oda daveti gönderildi!`);
    } catch (e) {
      console.error('Pomodoro davet gönderme hatası:', e);
      setCheerMessageBanner(`❌ Davet gönderilemedi: ${(e as any)?.message || 'Bilinmeyen hata'}`);
    }
    setTimeout(() => setCheerMessageBanner(null), 3500);
  };

  // Listen to incoming real-time cheer / motivation messages in the active Pomodoro room
  useEffect(() => {
    if ((activeGroupRoom as any)?.lastCheer) {
      const cheer = (activeGroupRoom as any).lastCheer;
      if (cheer && cheer.senderName && cheer.text && Date.now() - cheer.timestamp < 12000) {
        setCheerMessageBanner(`🙌 ${cheer.senderName}: "${cheer.text}" motivasyonu gönderdi! 🔥`);
        setTimeout(() => setCheerMessageBanner(null), 4000);
      }
    }
  }, [(activeGroupRoom as any)?.lastCheer?.timestamp]);

  const handleSendGroupCheer = async (emojiText: string) => {
    if (!activeGroupRoom) return;

    const myName = currentUser?.ad || 'Öğrenci';
    const myId = currentUser?.id || auth.currentUser?.uid;
    const roomCode = activeGroupRoom.code;
    const rawDigits = roomCode.replace(/[^0-9]/g, '');

    const updatedRoom = {
      ...activeGroupRoom,
      lastCheer: {
        senderName: myName,
        text: emojiText,
        timestamp: Date.now(),
      },
    };

    const cleanData = JSON.parse(JSON.stringify(updatedRoom));
    setActiveGroupRoom(updatedRoom);
    setCheerMessageBanner(`🙌 ${myName}: "${emojiText}" motivasyonu gönderdi! 🔥`);
    setTimeout(() => setCheerMessageBanner(null), 4000);

    // Save cheer to Firestore so all room members see it in real-time
    try {
      await setDoc(doc(db, 'users', `pomo_room_${roomCode}`), cleanData);
      if (rawDigits) await setDoc(doc(db, 'users', `pomo_room_${rawDigits}`), cleanData);
      await setDoc(doc(db, 'pomo_rooms', roomCode), cleanData);

      if (myId) {
        await setDoc(doc(db, 'users', myId), { activeRoom: cleanData }, { merge: true });
      }

      for (const m of activeGroupRoom.members) {
        if (m.id && m.id !== myId && !m.id.startsWith('host_')) {
          try {
            await setDoc(doc(db, 'users', m.id), { activeRoom: cleanData }, { merge: true });
          } catch (e) {}
        }
      }
    } catch (e) {}
  };

  const handleLeaveGroupRoom = async () => {
    if (!activeGroupRoom) return;

    const myName = currentUser?.ad || 'Öğrenci';
    const myId = currentUser?.id || auth.currentUser?.uid || `user_${myName}`;
    const roomCode = activeGroupRoom.code;
    const rawDigits = roomCode.replace(/[^0-9]/g, '');

    // Clear activeRoom from current user doc FIRST
    if (myId) {
      try {
        await setDoc(doc(db, 'users', myId), { activeRoom: null }, { merge: true });
        await deleteDoc(doc(db, 'users', myId, 'pomo_rooms', roomCode));
        if (rawDigits) {
          await deleteDoc(doc(db, 'users', myId, 'pomo_rooms', rawDigits));
        }
      } catch (e) {}
    }

    // Remove current user from Firebase room members
    const remainingMembers = activeGroupRoom.members.filter(
      (m) => m.id !== myId && !m.name.includes(myName)
    );

    if (remainingMembers.length === 0) {
      // Delete room from Firebase if empty
      try {
        await deleteDoc(doc(db, 'users', `pomo_room_${roomCode}`));
        await deleteDoc(doc(db, 'pomo_rooms', roomCode));
        if (rawDigits) {
          await deleteDoc(doc(db, 'users', `pomo_room_${rawDigits}`));
          await deleteDoc(doc(db, 'pomo_rooms', rawDigits));
        }
      } catch (e) {}
    } else {
      // Update room in Firebase with remaining members
      const updatedRoom: GroupPomoRoom = {
        ...activeGroupRoom,
        members: remainingMembers,
      };
      const cleanData = JSON.parse(JSON.stringify(updatedRoom));

      const hostMember = remainingMembers.find((m) => m.isHost);
      if (hostMember && hostMember.id && !hostMember.id.startsWith('host_') && hostMember.id !== myId) {
        try {
          await setDoc(doc(db, 'users', hostMember.id), { activeRoom: cleanData }, { merge: true });
          await setDoc(doc(db, 'users', hostMember.id, 'pomo_rooms', roomCode), cleanData);
        } catch (e) {}
      }

      try {
        await setDoc(doc(db, 'users', `pomo_room_${roomCode}`), cleanData);
        await setDoc(doc(db, 'pomo_rooms', roomCode), cleanData);
        if (rawDigits) {
          await setDoc(doc(db, 'users', `pomo_room_${rawDigits}`), cleanData);
          await setDoc(doc(db, 'pomo_rooms', rawDigits), cleanData);
        }
      } catch (e) {}
    }

    setActiveGroupRoom(null);
    setCheerMessageBanner('🚪 Odadan ayrıldın ve Firebase veritabanından silindin.');
    setTimeout(() => setCheerMessageBanner(null), 3000);
  };

  // Use dynamically computed week days (based on current date)
  const days = weekDays;

  // Ask for Browser Notifications permission on component mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Web Audio API Chime Sounds
  const playPomoSound = (type: 'work' | 'break') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';

      if (type === 'work') {
        // High upbeat victory chime (C5 -> E5 -> G5 -> C6)
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.2);
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.4);
        osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.0);
      } else {
        // Soothing gentle relaxation chime (G4 -> C5 -> E5)
        osc.frequency.setValueAtTime(392.00, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(523.25, ctx.currentTime + 0.3);
        osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      }
    } catch (e) {
      console.warn('Audio chime unsupported', e);
    }
  };

  const triggerNotification = (title: string, body: string, type: 'work' | 'break') => {
    playPomoSound(type);

    // In-app visual floating alert
    setPomoNotificationBanner({ title, body, type });

    // Browser Push Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: 'https://cdn-icons-png.flaticon.com/512/1160/1160358.png',
        });
      } catch (e) {
        console.warn('Browser notification failed', e);
      }
    }
  };

  // Pomodoro Countdown Timer Effect
  useEffect(() => {
    let interval: any = null;

    if (isPomoRunning && pomoTimeLeft > 0) {
      interval = setInterval(() => {
        setPomoTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isPomoRunning && pomoTimeLeft === 0) {
      // Timer Complete!
      if (pomoMode === 'work') {
        // Work Session Finished
        const newCount = completedPomoCount + 1;
        setCompletedPomoCount(newCount);
        localStorage.setItem('completed_pomodoros_count', newCount.toString());

        let finishedItem: ProgramOgesi | null = null;

        // Auto-mark linked schedule item as completed!
        if (pomoSelectedItemId && pomoSelectedItemId !== 'free') {
          const linkedItem = scheduleItems.find((i) => i.id === pomoSelectedItemId);
          if (linkedItem) {
            finishedItem = linkedItem;
            if (!linkedItem.tamamlandi) {
              onToggleItem(linkedItem.id);
            }
          }
        } else {
          // If no item selected, automatically mark first uncompleted item of today
          const uncompletedToday = scheduleItems.find(
            (i) => (!i.gun || i.gun === selectedDay) && !i.tamamlandi && i.ders !== 'Dinlenme'
          );
          if (uncompletedToday) {
            finishedItem = uncompletedToday;
            onToggleItem(uncompletedToday.id);
          }
        }

        // Calculate dynamic XP based on custom work minutes (2 XP per minute, min 10 XP)
        const earnedXp = Math.max(10, Math.round(customWorkMinutes * 2));

        if (!finishedItem) {
          finishedItem = {
            id: `pomo_${Date.now()}`,
            gun: selectedDay,
            ders: `${customWorkMinutes} Dk Pomodoro Odaklanma`,
            konu: 'Kesintisiz Odaklanma Seansı',
            saat: `${customWorkMinutes} dk`,
            tamamlandi: true,
          };
        }

        if (onRewardXp) {
          onRewardXp(earnedXp);
        }

        // Trigger completion congratulation modal with exact dynamic minutes and earned XP!
        setCompletedSession({
          ...finishedItem,
          saat: `${customWorkMinutes} dk`,
          xp: earnedXp,
        } as any);

        triggerNotification(
          `🍅 ${customWorkMinutes} Dk Pomodoro Odaklanma Tamamlandı!`,
          `Harika bir çalışma seansı geçirdin! +${earnedXp} XP kazandın ve görevin tamamlandı. Şimdi ${customBreakMinutes} dakikalık mola zamanı.`,
          'work'
        );

        // Switch to Break Mode automatically
        setPomoMode('break');
        setPomoTimeLeft(customBreakMinutes * 60);
        setIsPomoRunning(false);
      } else {
        // Break Finished
        triggerNotification(
          `☕ ${customBreakMinutes} Dk Mola Sona Erdi!`,
          `Mola bitti, zihnin tazelendi! Yeni bir ${customWorkMinutes} dakikalık Pomodoro odaklanma seansına başlamaya hazır mısın?`,
          'break'
        );

        // Switch back to Work Mode
        setPomoMode('work');
        setPomoTimeLeft(customWorkMinutes * 60);
        setIsPomoRunning(false);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPomoRunning, pomoTimeLeft, pomoMode, pomoSelectedItemId, scheduleItems, selectedDay, customWorkMinutes, customBreakMinutes, completedPomoCount, onToggleItem, onRewardXp]);

  const handleTogglePomo = () => {
    setIsPomoRunning(!isPomoRunning);
  };

  const handleSetWorkMinutes = (mins: number) => {
    const val = Math.max(1, Math.min(180, mins));
    setCustomWorkMinutes(val);
    if (pomoMode === 'work') {
      setIsPomoRunning(false);
      setPomoTimeLeft(val * 60);
    }
  };

  const handleSetBreakMinutes = (mins: number) => {
    const val = Math.max(1, Math.min(60, mins));
    setCustomBreakMinutes(val);
    if (pomoMode === 'break') {
      setIsPomoRunning(false);
      setPomoTimeLeft(val * 60);
    }
  };

  const handleResetPomo = (mode: 'work' | 'break' = pomoMode) => {
    setIsPomoRunning(false);
    setPomoMode(mode);
    setPomoTimeLeft(mode === 'work' ? customWorkMinutes * 60 : customBreakMinutes * 60);
  };

  const handleSelectPomoMode = (mode: 'work' | 'break') => {
    setIsPomoRunning(false);
    setPomoMode(mode);
    setPomoTimeLeft(mode === 'work' ? customWorkMinutes * 60 : customBreakMinutes * 60);
  };

  // Standard Session Timer Countdown Effect
  useEffect(() => {
    let interval: any = null;
    if (activeSessionId && !isPaused && remainingSeconds > 0) {
      interval = setInterval(() => {
        setRemainingSeconds((prev) => prev - 1);
      }, 1000);
    } else if (activeSessionId && remainingSeconds === 0) {
      const finishedItem = scheduleItems.find((i) => i.id === activeSessionId);
      if (finishedItem) {
        playPomoSound('work');
        if (!finishedItem.tamamlandi) {
          onToggleItem(finishedItem.id);
        }
        if (onRewardXp) {
          onRewardXp(50);
        }
        setCompletedSession(finishedItem);
      }
      setActiveSessionId(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSessionId, isPaused, remainingSeconds, scheduleItems, onToggleItem, onRewardXp]);

  const activeItem = scheduleItems.find((i) => i.id === activeSessionId);

  const handleStartSession = (item: ProgramOgesi) => {
    if (activeSessionId === item.id) {
      setIsPaused(!isPaused);
    } else {
      let seconds = 45 * 60;
      if (item.saat && item.saat.includes('dk')) {
        const match = item.saat.match(/(\d+)\s*dk/i);
        if (match) seconds = parseInt(match[1], 10) * 60;
      }
      setActiveSessionId(item.id);
      setRemainingSeconds(seconds);
      setTotalSeconds(seconds);
      setIsPaused(false);
    }
  };

  const handleStopSession = () => {
    setActiveSessionId(null);
    setRemainingSeconds(0);
    setIsPaused(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentDayItems = scheduleItems.filter(
    (item) => !item.gun || item.gun === selectedDay
  );

  const uncompletedItems = scheduleItems.filter(
    (item) => (!item.gun || item.gun === selectedDay) && !item.tamamlandi && item.ders !== 'Dinlenme'
  );

  const handleSaveNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKonu.trim()) return;

    onAddItem({
      gun: selectedDay,
      ders: formDers,
      konu: formKonu.trim(),
      saat: `${formSaat} (${formSure})`,
      tamamlandi: false,
    });

    setFormKonu('');
    setIsAddModalOpen(false);
  };

  const handleAddAiSuggestion = () => {
    onAddItem({
      gun: selectedDay,
      ders: 'Matematik',
      konu: 'Limit & Süreklilik Konu Tekrarı ve Soru Çözümü',
      saat: '19:30 - 20:15 (45 dk)',
      tamamlandi: false,
    });
  };

  const maxPomoTime = pomoMode === 'work' ? WORK_TIME : BREAK_TIME;
  const pomoProgressPct = Math.min(
    100,
    Math.max(0, ((maxPomoTime - pomoTimeLeft) / maxPomoTime) * 100)
  );

  // Calculate AI Recommendation based on user's solved/saved questions
  const aiRecommendation = React.useMemo(() => {
    if (!questions || questions.length === 0) {
      return null;
    }

    const topicMap: Record<string, { ders: string; konu: string; count: number }> = {};

    questions.forEach((q) => {
      const dersName = q.ders || 'Matematik';
      const konuName = q.konu || 'Genel Tekrar';
      const key = `${dersName}:::${konuName}`;
      if (!topicMap[key]) {
        topicMap[key] = { ders: dersName, konu: konuName, count: 0 };
      }
      topicMap[key].count += q.isSaved ? 2 : 1;
    });

    const sorted = Object.values(topicMap).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  }, [questions]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-32 animate-fadeIn relative">
      {/* Floating Pomodoro Completion Banner Notification */}
      {pomoNotificationBanner && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-lg mx-auto bg-slate-900 border-2 border-amber-400 text-white p-4 rounded-3xl shadow-2xl flex items-start justify-between gap-3 animate-bounce">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
              pomoNotificationBanner.type === 'work' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              {pomoNotificationBanner.type === 'work' ? '🍅' : '☕'}
            </div>
            <div>
              <h4 className="font-black text-sm text-amber-300">{pomoNotificationBanner.title}</h4>
              <p className="text-xs text-slate-200 font-medium leading-relaxed mt-0.5">
                {pomoNotificationBanner.body}
              </p>
            </div>
          </div>
          <button
            onClick={() => setPomoNotificationBanner(null)}
            className="text-slate-400 hover:text-white p-1 rounded-full cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Title & Add Button Header */}
      <div className="flex justify-between items-center gap-2">
        <div>
          <h2 className="font-extrabold text-lg sm:text-xl tracking-tight text-text-main">
            Akıllı Ders & Pomodoro Programım
          </h2>
          <p className="text-[11px] text-text-muted">
            Haftalık çalışma planını takip et, Pomodoro odaklanma seanslarıyla çalış.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-primary text-white font-extrabold text-xs px-3.5 py-2 rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-md flex items-center gap-1 cursor-pointer whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>+ Görev Ekle</span>
        </button>
      </div>

      {/* Days Strip - Compact */}
      <section className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 no-scrollbar">
        {days.map((d) => (
          <button
            key={d.day}
            onClick={() => setSelectedDay(d.day)}
            className={`flex flex-col items-center justify-center min-w-[46px] sm:min-w-[52px] h-14 sm:h-16 rounded-xl transition-all cursor-pointer ${
              selectedDay === d.day
                ? 'bg-primary text-white shadow-sm scale-102 font-black'
                : 'bg-card-bg text-text-muted border border-card-border hover:border-primary/40'
            }`}
          >
            <span className="text-[10px] font-bold">{d.day}</span>
            <span className="font-black text-sm sm:text-base leading-tight">{d.date}</span>
            {d.isToday && (
              <span className={`w-1 h-1 rounded-full mt-0.5 ${selectedDay === d.day ? 'bg-white' : 'bg-primary'}`} />
            )}
          </button>
        ))}
      </section>

      {/* Timeline Schedule for Selected Day */}
      <section className="space-y-3">
        <div className="flex justify-between items-center gap-2">
          <h3 className="font-extrabold text-sm sm:text-base text-text-main flex items-center gap-2">
            <span>{days.find(d => d.day === selectedDay)?.name} Programı</span>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {currentDayItems.length} Görev
            </span>
          </h3>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-xs">add_circle</span>
            <span>+ Yeni Ders</span>
          </button>
        </div>

        {currentDayItems.length === 0 ? (
          <div className="bg-card-bg rounded-2xl p-6 border border-card-border text-center space-y-2.5 shadow-2xs">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">calendar_add_on</span>
            </div>
            <h4 className="font-extrabold text-sm text-text-main">Bu Gün İçin Ders Eklenmemiş</h4>
            <p className="text-[11px] text-text-muted max-w-sm mx-auto">
              {days.find(d => d.day === selectedDay)?.name} günü için henüz bir çalışma programı eklemediniz.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary text-white font-extrabold text-xs px-4 py-2 rounded-xl hover:brightness-110 transition-all cursor-pointer inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs">add</span>
              <span>Program Ekle</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {currentDayItems.map((item) => {
              const isBreak = item.ders === 'Dinlenme';
              const isRunning = activeSessionId === item.id;

              if (isBreak) {
                return (
                  <div key={item.id} className="bg-surface-container-low p-2.5 sm:p-3 rounded-xl border border-card-border flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-text-muted text-lg">coffee</span>
                      <div>
                        <span className="text-[10px] font-bold text-text-muted">{item.saat}</span>
                        <p className="text-xs font-extrabold text-text-main uppercase">{item.ders} ARASI</p>
                      </div>
                    </div>

                    {onDeleteItem && (
                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="text-text-muted hover:text-rose-500 p-1 cursor-pointer transition-colors"
                        title="Programdan Sil"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all shadow-2xs space-y-1.5 ${
                    item.tamamlandi 
                      ? 'bg-card-bg/60 border-card-border opacity-70' 
                      : isRunning 
                      ? 'bg-card-bg border-2 border-emerald-500 ring-1 ring-emerald-500/20' 
                      : 'bg-card-bg border-card-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-extrabold text-primary block">{item.saat}</span>
                      <h4 className={`font-extrabold text-sm ${item.tamamlandi ? 'line-through text-text-muted' : 'text-text-main'}`}>
                        {item.ders}
                      </h4>
                      <p className="text-xs text-text-muted">{item.konu}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onDeleteItem && (
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          className="text-text-muted hover:text-rose-500 p-1 cursor-pointer transition-colors"
                          title="Sil"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      )}

                      <button
                        onClick={() => onToggleItem(item.id)}
                        className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                          item.tamamlandi ? 'bg-emerald-600 text-white' : 'bg-surface-container-low text-text-muted hover:text-primary'
                        }`}
                        title={item.tamamlandi ? 'Tamamlandı olarak işaretlendi' : 'Tamamlandı işaretle'}
                      >
                        <span className="material-symbols-outlined text-xs">
                          {item.tamamlandi ? 'check' : 'radio_button_unchecked'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {!item.tamamlandi && (
                    <div className="pt-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 border-t border-card-border text-[11px]">
                      <span className="text-text-muted flex items-center gap-1 font-mono font-bold">
                        <span className="material-symbols-outlined text-xs text-primary">timer</span>
                        {isRunning ? formatTime(remainingSeconds) : 'Süre Takibi'}
                      </span>

                      <div className="flex flex-wrap items-center gap-1 w-full sm:w-auto justify-end">
                        <button
                          onClick={() => {
                            setPomoSelectedItemId(item.id);
                            handleSelectPomoMode('work');
                            setIsPomoRunning(true);
                            document.getElementById('pomodoro-section')?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white font-bold text-[11px] flex items-center gap-0.5 transition-all cursor-pointer border border-rose-500/20"
                          title="Bu Görevi Pomodoro ile Başlat"
                        >
                          <span>🍅 Pomodoro</span>
                        </button>

                        <button
                          onClick={() => handleStartSession(item)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-0.5 transition-all cursor-pointer ${
                            isRunning 
                              ? isPaused 
                                ? 'bg-amber-500 text-white' 
                                : 'bg-emerald-600 text-white animate-pulse' 
                              : 'bg-primary text-white hover:brightness-110 active:scale-95'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xs">
                            {isRunning ? (isPaused ? 'play_arrow' : 'pause') : 'play_arrow'}
                          </span>
                          <span>
                            {isRunning ? (isPaused ? 'Devam' : 'Duraklat') : 'Serbest'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* AI Suggestion Card - Compact */}
      <section className="bg-gradient-to-r from-indigo-800 via-indigo-900 to-slate-950 p-3.5 sm:p-4 rounded-xl text-white shadow-md relative overflow-hidden space-y-1.5 border border-indigo-700/50">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-amber-300 text-base">auto_awesome</span>
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
            YAPAY ZEKA PROGRAM ÖNERİSİ
          </span>
        </div>

        {aiRecommendation ? (
          <>
            <p className="text-xs font-medium leading-relaxed text-indigo-50">
              Zorlandığın <strong className="text-amber-300 font-bold">{aiRecommendation.ders} - {aiRecommendation.konu}</strong> konusuna bugün 30 dk ayırmalısın.
            </p>

            <button 
              onClick={() => {
                onAddItem({
                  gun: selectedDay,
                  ders: aiRecommendation.ders,
                  konu: `${aiRecommendation.konu} Tekrarı ve Soru Çözümü`,
                  saat: '19:30 - 20:15 (45 dk)',
                  tamamlandi: false,
                });
              }}
              className="mt-1 bg-white text-indigo-950 font-black text-[11px] px-3.5 py-1.5 rounded-lg hover:bg-slate-100 active:scale-95 transition-all shadow-md cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs text-primary">playlist_add</span>
              <span>Programa Ekle ({selectedDay})</span>
            </button>
          </>
        ) : (
          <>
            <p className="text-xs font-medium leading-relaxed text-indigo-50">
              Soru yükleyip çözdürdükçe yapay zeka takıldığınız konulara göre buraya özel ders çalışma önerileri ekler.
            </p>

            {setActiveTab && (
              <button 
                onClick={() => setActiveTab('home')}
                className="mt-1 bg-white text-indigo-950 font-black text-[11px] px-3.5 py-1.5 rounded-lg hover:bg-slate-100 active:scale-95 transition-all shadow-md cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-xs text-primary">add_a_photo</span>
                <span>İlk Sorunu Yükle & Analiz Et</span>
              </button>
            )}
          </>
        )}

        <div className="absolute top-1/2 -right-4 -translate-y-1/2 opacity-15">
          <span className="material-symbols-outlined text-[64px] text-white">psychology</span>
        </div>
      </section>

      {/* POMODORO FOCUS TIMER SECTION - Compact & Modern */}
      <section id="pomodoro-section" className="bg-card-bg text-text-main p-3.5 sm:p-4 rounded-2xl shadow-md border border-card-border space-y-3 relative overflow-hidden dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950 dark:text-white dark:border-indigo-500/30">
        {/* Card Header & Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border dark:border-white/10 pb-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-base">🍅</span>
            <div>
              <h3 className="font-extrabold text-xs sm:text-sm text-text-main dark:text-white">
                Pomodoro Odaklanma Zamanlayıcısı
              </h3>
              <p className="text-[10px] text-text-muted dark:text-slate-300">Esnek Çalışma & Mola</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-surface-container-low dark:bg-slate-800/80 p-0.5 rounded-xl border border-card-border dark:border-white/10">
            <button
              type="button"
              onClick={() => handleSelectPomoMode('work')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-0.5 ${
                pomoMode === 'work'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-text-muted dark:text-slate-400 hover:text-text-main dark:hover:text-white'
              }`}
            >
              <span>🍅 {customWorkMinutes} dk Çalış</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectPomoMode('break')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center gap-0.5 ${
                pomoMode === 'break'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-text-muted dark:text-slate-400 hover:text-text-main dark:hover:text-white'
              }`}
            >
              <span>☕ {customBreakMinutes} dk Mola</span>
            </button>
          </div>
        </div>

        {/* Custom Duration Selector Strip */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 bg-surface-container-low dark:bg-slate-900/80 p-2 rounded-xl border border-card-border dark:border-white/10">
          <div className="flex items-center gap-1 flex-wrap text-xs">
            <span className="text-[10px] font-extrabold text-primary dark:text-indigo-200 mr-0.5">
              {pomoMode === 'work' ? '⏱️ Süre:' : '☕ Mola:'}
            </span>
            {pomoMode === 'work' ? (
              [15, 25, 35, 45, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSetWorkMinutes(m)}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all text-[11px] cursor-pointer border ${
                    customWorkMinutes === m
                      ? 'bg-rose-500 text-white border-rose-600 shadow-2xs'
                      : 'bg-card-bg dark:bg-slate-800 text-text-main dark:text-slate-300 border-card-border dark:border-transparent hover:border-rose-400'
                  }`}
                >
                  {m}dk
                </button>
              ))
            ) : (
              [5, 10, 15, 20].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSetBreakMinutes(m)}
                  className={`px-2 py-0.5 rounded-lg font-bold transition-all text-[11px] cursor-pointer border ${
                    customBreakMinutes === m
                      ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs'
                      : 'bg-card-bg dark:bg-slate-800 text-text-main dark:text-slate-300 border-card-border dark:border-transparent hover:border-emerald-400'
                  }`}
                >
                  {m}dk
                </button>
              ))
            )}
          </div>

          {/* Custom Minute Input Box */}
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-text-muted dark:text-slate-400 font-bold">Özel:</span>
            <input
              type="number"
              min="1"
              max="180"
              value={pomoMode === 'work' ? customWorkMinutes : customBreakMinutes}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 1;
                if (pomoMode === 'work') handleSetWorkMinutes(val);
                else handleSetBreakMinutes(val);
              }}
              className="w-12 bg-surface dark:bg-slate-950 border border-card-border dark:border-slate-700 rounded-md px-1.5 py-0.5 text-[11px] text-center font-bold text-text-main dark:text-white focus:outline-none focus:border-primary"
            />
            <span className="text-[9px] text-text-muted dark:text-slate-400">dk</span>
          </div>
        </div>

        {/* Linked Task Selector */}
        <div className="space-y-0.5">
          <label className="text-[10px] font-bold text-text-main dark:text-indigo-200 flex items-center justify-between">
            <span>Odaklanılacak Çalışma:</span>
            <span className="text-[9px] text-text-muted dark:text-slate-400 font-mono">
              Bugün: {completedPomoCount} 🍅 ({completedPomoCount * customWorkMinutes} dk)
            </span>
          </label>
          <select
            value={pomoSelectedItemId}
            onChange={(e) => setPomoSelectedItemId(e.target.value)}
            className="w-full bg-surface-container-low dark:bg-slate-900 border border-card-border dark:border-slate-700 rounded-lg p-2 text-[11px] text-text-main dark:text-white focus:outline-none focus:border-primary font-bold"
          >
            <option value="free">🚀 Serbest Çalışma (Görevsiz)</option>
            {uncompletedItems.map((item) => (
              <option key={item.id} value={item.id}>
                📌 {item.ders} - {item.konu} ({item.saat})
              </option>
            ))}
          </select>
        </div>

        {/* Circular Display & Digital Counter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface-container-low dark:bg-slate-950/70 p-3 rounded-xl border border-card-border dark:border-white/5">
          <div className="flex items-center gap-3">
            {/* Visual Progress Dial Ring */}
            <div className="relative w-18 h-18 sm:w-20 sm:h-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="currentColor"
                  strokeWidth="5"
                  className="text-slate-200 dark:text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="currentColor"
                  strokeWidth="5"
                  className={pomoMode === 'work' ? 'text-rose-500' : 'text-emerald-500'}
                  fill="transparent"
                  strokeDasharray={213.6}
                  strokeDashoffset={213.6 - (213.6 * pomoProgressPct) / 100}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm sm:text-base font-black font-mono tracking-tight text-text-main dark:text-white pointer-events-none">
                {formatTime(pomoTimeLeft)}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isPomoRunning ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                <span className="text-[10px] font-black uppercase tracking-wider text-text-muted dark:text-slate-300">
                  {pomoMode === 'work' ? 'ODAKLANMA' : 'MOLA'}
                </span>
              </div>
              <p className="text-xs font-extrabold text-text-main dark:text-white mt-0.5">
                {pomoMode === 'work'
                  ? `🎯 ${customWorkMinutes} Dk Çalışma`
                  : `☕ ${customBreakMinutes} Dk Mola`}
              </p>
            </div>
          </div>

          {/* Action Control Buttons */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleTogglePomo}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer ${
                isPomoRunning
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                  : pomoMode === 'work'
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {isPomoRunning ? 'pause' : 'play_arrow'}
              </span>
              <span>{isPomoRunning ? 'Duraklat' : 'Başlat'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleResetPomo()}
              className="p-2 rounded-xl bg-surface-container-low dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-muted dark:text-slate-300 cursor-pointer border border-card-border dark:border-white/10"
              title="Sıfırla"
            >
              <span className="material-symbols-outlined text-sm">restart_alt</span>
            </button>
          </div>
        </div>
        {/* Pomodoro Progress Bar */}
        <div className="space-y-0.5">
          <div className="w-full bg-slate-200 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden border border-card-border dark:border-white/5">
            <div
              className={`h-full transition-all duration-1000 rounded-full ${
                pomoMode === 'work'
                  ? 'bg-gradient-to-r from-rose-500 to-amber-400'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${pomoProgressPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* GROUP POMODORO & SHARED STUDY ROOM SECTION - Compact */}
      <section className="bg-card-bg text-text-main p-3.5 sm:p-4 rounded-2xl shadow-md border border-card-border space-y-3 relative overflow-hidden dark:bg-gradient-to-br dark:from-indigo-950 dark:via-slate-900 dark:to-purple-950 dark:text-white dark:border-purple-500/30">
        {/* Floating Cheer Pop Banner */}
        {cheerMessageBanner && (
          <div className="bg-amber-400 text-slate-950 p-2.5 rounded-2xl font-black text-xs text-center shadow-lg animate-bounce border border-amber-300">
            {cheerMessageBanner}
          </div>
        )}

        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border dark:border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">groups</span>
            </div>
            <div>
              <h3 className="font-black text-sm text-text-main dark:text-white flex items-center gap-2">
                <span>Ortak Pomodoro Çalışma Odası</span>
                {activeGroupRoom && (
                  <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    🟢 CANLI ODA
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-text-muted dark:text-purple-200/80">Arkadaşlarınla oda kurun, birlikte Pomodoro yapın!</p>
            </div>
          </div>

          {!activeGroupRoom ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreateRoomModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-xl font-extrabold text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>Oda Kur</span>
              </button>
              <button
                type="button"
                onClick={() => setIsJoinRoomModalOpen(true)}
                className="bg-surface-container-low hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-main dark:text-purple-200 px-3 py-1.5 rounded-xl font-extrabold text-xs border border-card-border dark:border-white/10 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">key</span>
                <span>Koda Katıl</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLeaveGroupRoom}
              className="bg-rose-600/20 text-rose-600 dark:text-rose-300 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-xl font-bold text-xs border border-rose-500/30 flex items-center gap-1 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span>Odadan Ayrıl</span>
            </button>
          )}
        </div>

        {/* ACTIVE ROOM VIEW */}
        {activeGroupRoom ? (
          <div className="space-y-4">
            {/* Room Banner */}
            <div className="bg-surface-container-low dark:bg-slate-950/80 p-3.5 rounded-2xl border border-card-border dark:border-purple-500/20 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-black text-sm text-text-main dark:text-purple-200 flex items-center gap-2">
                  <span>{activeGroupRoom.title}</span>
                </h4>
                <p className="text-[11px] text-text-muted dark:text-slate-400">Kurucu: {activeGroupRoom.hostName}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(activeGroupRoom.code);
                    } catch (e) {}
                    setCheerMessageBanner(`📋 Oda Kodu Kopyalandı: ${activeGroupRoom.code}`);
                    setTimeout(() => setCheerMessageBanner(null), 3000);
                  }}
                  className="bg-purple-100 dark:bg-purple-900/60 hover:bg-purple-200 dark:hover:bg-purple-800 px-3 py-1.5 rounded-xl border border-purple-300 dark:border-purple-400/30 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                  title="Tıkla ve Oda Kodunu Kopyala"
                >
                  <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold uppercase">Oda Kodu:</span>
                  <span className="font-mono font-black text-xs text-purple-900 dark:text-amber-300 tracking-wider">{activeGroupRoom.code}</span>
                  <span className="material-symbols-outlined text-xs text-purple-600 dark:text-purple-300">content_copy</span>
                </button>
              </div>
            </div>

            {/* Room Members Grid */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-text-main dark:text-purple-200 flex items-center justify-between">
                <span>Odadaki Katılımcılar ({activeGroupRoom.members.length}):</span>
                <span className="text-[10px] text-text-muted dark:text-slate-400 font-mono">Ortak Pomodoro Odası</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeGroupRoom.members.map((member) => {
                  const myId = currentUser?.id || auth.currentUser?.uid;
                  const isMe = member.id === myId || (auth.currentUser && member.id === auth.currentUser.uid);
                  const cleanMemberName = member.name.replace(/\s*\((Sen|Ev Sahibi|Kurucu|Oda Lideri)\)/gi, '').trim();

                  return (
                    <div
                      key={member.id}
                      className="bg-surface-container-low dark:bg-slate-950/70 p-3 rounded-2xl border border-card-border dark:border-white/5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-purple-400 shrink-0">
                          <img src={member.avatar} alt={cleanMemberName} className="w-full h-full object-cover" />
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card-bg dark:border-slate-900 ${
                              member.status === 'work' ? 'bg-rose-500 animate-ping' : member.status === 'break' ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                        </div>

                        <div>
                          <p className="font-extrabold text-xs text-text-main dark:text-white truncate max-w-[120px] sm:max-w-[140px] flex items-center gap-1">
                            <span className="truncate">{cleanMemberName}</span>
                            {isMe && (
                              <span className="text-[9px] font-black text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.5 rounded-md shrink-0">
                                (Sen)
                              </span>
                            )}
                            {member.isHost && !isMe && (
                              <span className="text-[9px] font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded-md shrink-0">
                                (Kurucu)
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span
                              className={`font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                member.status === 'break'
                                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              {member.status === 'break' ? (
                                <span>☕ Molada</span>
                              ) : (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                  <span>🎯 Odakta</span>
                                </>
                              )}
                            </span>
                            <span className="text-text-muted dark:text-slate-400 font-mono">({member.pomoCount} 🍅)</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSendGroupCheer(`🔥 ${cleanMemberName} harika gidiyorsun!`)}
                        className="p-1.5 rounded-xl bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-600 text-purple-700 dark:text-purple-200 hover:text-white transition-all text-xs cursor-pointer border border-purple-300 dark:border-purple-500/20 shrink-0"
                        title="Motivasyon Gönder"
                      >
                        <span>🔥</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Interactive Cheer & Reaction Bar */}
            <div className="bg-surface-container-low dark:bg-slate-950/80 p-3 rounded-2xl border border-card-border dark:border-white/10 space-y-2">
              <span className="text-[11px] font-extrabold text-text-main dark:text-purple-200 block">
                Hızlı Motivasyon Gönder (Grupça Moral Ver):
              </span>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[
                  '🔥 Harika Gidiyoruz!',
                  '💪 Pes Etmek Yok!',
                  '🎯 Odaklanalım',
                  '☕ Mola Vakti!',
                  '🚀 Derece Geliyor!',
                ].map((txt) => (
                  <button
                    key={txt}
                    type="button"
                    onClick={() => handleSendGroupCheer(txt)}
                    className="px-3 py-1.5 rounded-xl bg-card-bg hover:bg-purple-50 dark:bg-purple-900/50 dark:hover:bg-purple-600 text-text-main dark:text-purple-100 font-bold transition-all cursor-pointer border border-card-border dark:border-purple-500/30 text-xs active:scale-95"
                  >
                    {txt}
                  </button>
                ))}
              </div>
            </div>

            {/* Invite Friends to Active Room */}
            {friends && friends.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-card-border dark:border-white/10">
                <span className="text-[11px] font-extrabold text-text-main dark:text-purple-200 block">
                  Arkadaşlarını Odaya Davet Et:
                </span>
                <div className="flex flex-wrap gap-2">
                  {friends.map((f) => {
                    const isInRoom = activeGroupRoom.members.some((m) => {
                      const mClean = m.name.replace(/\(.*\)/g, '').trim().toLowerCase();
                      const fClean = f.name.replace(/\(.*\)/g, '').trim().toLowerCase();
                      return m.id === f.id || mClean === fClean || (m.id && f.id && m.id === f.id);
                    });
                    const isInvited = invitedFriendsMap[f.id];

                    if (isInRoom) {
                      return (
                        <div
                          key={f.id}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 flex items-center gap-1.5 shadow-xs select-none"
                        >
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>{f.name} (Odada 🟢)</span>
                        </div>
                      );
                    }

                    if (isInvited) {
                      return (
                        <div
                          key={f.id}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 flex items-center gap-1.5 select-none"
                        >
                          <span className="material-symbols-outlined text-xs">hourglass_top</span>
                          <span>{f.name} (Davet Edildi)</span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleInviteFriendToRoom(f)}
                        className="px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">person_add</span>
                        <span>{f.name} Davet Et</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* NO ACTIVE ROOM VIEW */
          <div className="bg-surface-container-low dark:bg-slate-950/70 p-6 rounded-2xl border border-card-border dark:border-white/5 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 mx-auto flex items-center justify-center border border-purple-500/30">
              <span className="material-symbols-outlined text-2xl">groups</span>
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-text-main dark:text-white">Henüz Aktif Bir Pomodoro Grubun Yok</h4>
              <p className="text-xs text-text-muted dark:text-purple-200/80 max-w-md mx-auto mt-1">
                Kendi ortak çalışma odanı oluşturabilir veya arkadaşının verdiği oda kodu ile canlı çalışmaya katılabilirsin.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateRoomModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>Yeni Pomodoro Odası Kur</span>
              </button>

              <button
                type="button"
                onClick={() => setIsJoinRoomModalOpen(true)}
                className="bg-surface-container-low hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-main dark:text-purple-200 font-extrabold text-xs px-5 py-2.5 rounded-2xl border border-card-border dark:border-white/10 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">key</span>
                <span>Oda Kodu ile Katıl</span>
              </button>
            </div>

            {/* Added Friends Quick Invite Strip */}
            {friends && friends.length > 0 && (
              <div className="pt-4 border-t border-card-border dark:border-white/10 space-y-2">
                <span className="text-[11px] font-bold text-text-muted dark:text-slate-400 block">
                  Ekli Arkadaşlarınla Hemen Grup Başlat:
                </span>
                <div className="flex flex-wrap justify-center gap-2">
                  {friends.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setIsCreateRoomModalOpen(true);
                        setSelectedFriendsForNewRoom({ [f.id]: true });
                      }}
                      className="bg-card-bg hover:bg-purple-50 dark:bg-slate-900 dark:hover:bg-purple-950/80 text-text-main dark:text-purple-200 border border-card-border dark:border-purple-500/20 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <img src={f.avatar} alt={f.name} className="w-5 h-5 rounded-full object-cover" />
                      <span>{f.name} ile Çalış</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* CREATE ROOM MODAL */}
      {isCreateRoomModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card-bg border border-card-border text-text-main dark:bg-slate-900 dark:border-purple-500/30 dark:text-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-card-border dark:border-white/10 pb-3">
              <h3 className="font-extrabold text-base flex items-center gap-2 text-text-main dark:text-purple-200">
                <span className="material-symbols-outlined text-primary dark:text-purple-400">group_add</span>
                <span>Yeni Pomodoro Odası Kur</span>
              </h3>
              <button
                onClick={() => setIsCreateRoomModalOpen(false)}
                className="text-text-muted hover:text-text-main dark:text-slate-400 dark:hover:text-white p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-text-main dark:text-slate-300 block mb-1">Oda Başlığı:</label>
                <input
                  type="text"
                  value={newRoomTitleInput}
                  onChange={(e) => setNewRoomTitleInput(e.target.value)}
                  placeholder="ör. YKS 2026 Şampiyonlar Odası"
                  className="w-full bg-surface-container-low border border-card-border dark:bg-slate-950 dark:border-slate-700 rounded-xl p-3 text-xs text-text-main dark:text-white focus:outline-none focus:border-primary font-bold"
                />
              </div>

              {friends && friends.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-text-main dark:text-slate-300 block mb-1.5">
                    Odaya Otomatik Davet Edilecek Arkadaşlar ({Object.values(selectedFriendsForNewRoom).filter(Boolean).length}):
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto no-scrollbar">
                    {friends.map((f) => {
                      const isSelected = !!selectedFriendsForNewRoom[f.id];
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setSelectedFriendsForNewRoom((prev) => ({
                              ...prev,
                              [f.id]: !prev[f.id],
                            }));
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-400 shadow-xs scale-102'
                              : 'bg-surface-container-low hover:bg-purple-50 text-text-main border-card-border dark:bg-slate-950 dark:hover:bg-purple-900/40 dark:text-purple-200 dark:border-purple-500/30'
                          }`}
                        >
                          <img src={f.avatar} alt={f.name} className="w-5 h-5 rounded-full object-cover" />
                          <span>{f.name}</span>
                          <span className="material-symbols-outlined text-xs">
                            {isSelected ? 'check_circle' : 'add_circle'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateRoomModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-surface-container-low hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-muted dark:text-slate-300 font-bold text-xs cursor-pointer border border-card-border dark:border-transparent"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleCreateGroupRoom}
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md cursor-pointer active:scale-95"
              >
                🚀 Odayı Oluştur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOIN ROOM MODAL */}
      {isJoinRoomModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card-bg border border-card-border text-text-main dark:bg-slate-900 dark:border-purple-500/30 dark:text-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-card-border dark:border-white/10 pb-3">
              <h3 className="font-extrabold text-base flex items-center gap-2 text-text-main dark:text-purple-200">
                <span className="material-symbols-outlined text-primary dark:text-purple-400">key</span>
                <span>Oda Kodu ile Katıl</span>
              </h3>
              <button
                onClick={() => setIsJoinRoomModalOpen(false)}
                className="text-text-muted hover:text-text-main dark:text-slate-400 dark:hover:text-white p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-text-main dark:text-slate-300 block mb-1">Oda Kodu (veya 4 Hane):</label>
                <input
                  type="text"
                  value={joinRoomCodeInput}
                  onChange={(e) => setJoinRoomCodeInput(e.target.value)}
                  placeholder="ör. POMO-8492 veya 8492"
                  className="w-full bg-surface-container-low border border-card-border dark:bg-slate-950 dark:border-slate-700 rounded-xl p-3 text-xs text-text-main dark:text-white focus:outline-none focus:border-primary font-mono font-bold tracking-widest uppercase text-center"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-bold text-primary dark:text-purple-300 block">⚡ Veya Açık Odalara Tek Tıkla Katıl:</label>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleJoinGroupRoom('POMO-1001')}
                    className="w-full bg-surface-container-low hover:bg-purple-50 dark:bg-slate-950 dark:hover:bg-slate-800 border border-card-border dark:border-slate-800 p-2.5 rounded-xl text-left flex items-center justify-between cursor-pointer transition-all active:scale-98"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🚀</span>
                      <div>
                        <p className="text-xs font-bold text-text-main dark:text-white">YKS 2026 Derece Çalışma Odası</p>
                        <p className="text-[10px] text-text-muted dark:text-slate-400">Ahmet Yılmaz (3 Katılımcı)</p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-purple-700 dark:text-amber-300 bg-purple-100 dark:bg-purple-950/80 px-2 py-1 rounded-lg">POMO-1001</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleJoinGroupRoom('POMO-2002')}
                    className="w-full bg-surface-container-low hover:bg-purple-50 dark:bg-slate-950 dark:hover:bg-slate-800 border border-card-border dark:border-slate-800 p-2.5 rounded-xl text-left flex items-center justify-between cursor-pointer transition-all active:scale-98"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📚</span>
                      <div>
                        <p className="text-xs font-bold text-text-main dark:text-white">LGS Hedef 500 Tam Puan Odası</p>
                        <p className="text-[10px] text-text-muted dark:text-slate-400">Elif Şahin (2 Katılımcı)</p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-purple-700 dark:text-amber-300 bg-purple-100 dark:bg-purple-950/80 px-2 py-1 rounded-lg">POMO-2002</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleJoinGroupRoom('POMO-3003')}
                    className="w-full bg-surface-container-low hover:bg-purple-50 dark:bg-slate-950 dark:hover:bg-slate-800 border border-card-border dark:border-slate-800 p-2.5 rounded-xl text-left flex items-center justify-between cursor-pointer transition-all active:scale-98"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">☕</span>
                      <div>
                        <p className="text-xs font-bold text-text-main dark:text-white">Gece Kuşları Kütüphanesi</p>
                        <p className="text-[10px] text-text-muted dark:text-slate-400">Mehmet Akif (2 Katılımcı)</p>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] font-bold text-purple-700 dark:text-amber-300 bg-purple-100 dark:bg-purple-950/80 px-2 py-1 rounded-lg">POMO-3003</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsJoinRoomModalOpen(false)}
                className="flex-1 py-3 rounded-xl bg-surface-container-low hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-text-muted dark:text-slate-300 font-bold text-xs cursor-pointer border border-card-border dark:border-transparent"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={() => handleJoinGroupRoom()}
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md cursor-pointer active:scale-95"
              >
                🔑 Odaya Katıl
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LO-FI STUDY MUSIC WIDGET */}
      <LofiAudioWidget isEmbedded={true} initialTheme="focus" />

      {/* Active Live Study Session Banner (Standard Custom Session) */}
      {activeItem && (
        <section className="bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 p-5 rounded-3xl text-white shadow-xl space-y-3 border border-emerald-500/40 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-300 text-xl animate-spin">timer</span>
              <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                CANLI ÇALIŞMA SEANSI DEVAM EDİYOR
              </span>
            </div>
            <span className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              {isPaused ? '⏸️ DURAKLATILDI' : '▶️ AKTİF'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-extrabold text-lg text-white">{activeItem.ders}</h3>
              <p className="text-xs text-emerald-100 font-medium">{activeItem.konu}</p>
            </div>

            <div className="text-right">
              <span className="font-mono font-black text-3xl text-amber-300 tracking-wider">
                {formatTime(remainingSeconds)}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-950/40 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full transition-all duration-1000"
              style={{
                width: `${totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100)) : 0}%`,
              }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="bg-white text-slate-950 text-xs font-extrabold px-4 py-2 rounded-xl hover:bg-slate-100 cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <span className="material-symbols-outlined text-base">
                {isPaused ? 'play_arrow' : 'pause'}
              </span>
              <span>{isPaused ? 'Devam Et' : 'Duraklat'}</span>
            </button>
            <button
              onClick={handleStopSession}
              className="bg-rose-500/30 hover:bg-rose-600 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer border border-white/20"
            >
              Sonlandır
            </button>
          </div>
        </section>
      )}

      {/* Completion Celebration Modal */}
      {completedSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card-bg w-full max-w-sm rounded-3xl p-6 border border-emerald-500/50 shadow-2xl text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500 animate-bounce">
              <span className="material-symbols-outlined text-4xl">emoji_events</span>
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-xl text-text-main">Tebrikler! 🎉</h3>
              <p className="text-xs text-text-muted">
                Çalışma seansını başarıyla tamamladın! (+{(completedSession as any).xp || (completedSession.saat && parseInt(completedSession.saat) ? Math.round(parseInt(completedSession.saat) * 2) : 50)} XP Kazandın)
              </p>
            </div>

            <div className="p-3 bg-surface-container-low rounded-2xl text-xs font-bold text-text-main border border-card-border">
              "Başarı, her gün tekrarlanan küçük disiplinlerin toplamıdır." 🌟
            </div>

            <button
              onClick={() => setCompletedSession(null)}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer transition-all active:scale-95"
            >
              Harika, Devam Et!
            </button>
          </div>
        </div>
      )}

      {/* Manual Task Addition Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card-bg w-full max-w-md rounded-3xl p-5 border border-card-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_task</span>
                <h3 className="font-extrabold text-base text-text-main">
                  Şahsi Ders / Görev Ekle ({selectedDay})
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveNewItem} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-text-main block">Ders Seçin:</label>
                <select
                  value={formDers}
                  onChange={(e) => setFormDers(e.target.value)}
                  className="w-full bg-surface-container-low border border-card-border rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-primary font-bold"
                >
                  <option value="Matematik">Matematik</option>
                  <option value="Türkçe">Türkçe / Edebiyat</option>
                  <option value="Tarih">Tarih</option>
                  <option value="Coğrafya">Coğrafya</option>
                  <option value="Felsefe">Felsefe</option>
                  <option value="Din Kültürü">Din Kültürü</option>
                  <option value="Vatandaşlık">Vatandaşlık & Hukuk</option>
                  <option value="İngilizce">İngilizce</option>
                  <option value="Fizik">Fizik</option>
                  <option value="Kimya">Kimya</option>
                  <option value="Biyoloji">Biyoloji</option>
                  <option value="Dinlenme">Dinlenme / Mola</option>
                  <option value="Serbest Çalışma">Serbest Çalışma</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-extrabold text-text-main block">Konu veya Çalışma Detayı:</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Masif Araziler & Harita Çözümü (30 Soru)"
                  value={formKonu}
                  onChange={(e) => setFormKonu(e.target.value)}
                  className="w-full bg-surface-container-low border border-card-border rounded-xl p-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-text-main block">Saat Aralığı:</label>
                  <input
                    type="text"
                    placeholder="Örn: 17:00 - 18:30"
                    value={formSaat}
                    onChange={(e) => setFormSaat(e.target.value)}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-text-main block">Çalışma Süresi:</label>
                  <select
                    value={formSure}
                    onChange={(e) => setFormSure(e.target.value)}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-primary font-bold"
                  >
                    <option value="25 dk (Pomodoro)">25 dk (Pomodoro)</option>
                    <option value="30 dk">30 Dakika</option>
                    <option value="45 dk">45 Dakika</option>
                    <option value="60 dk">1 Saat (60 dk)</option>
                    <option value="90 dk">1.5 Saat (90 dk)</option>
                    <option value="120 dk">2 Saat (120 dk)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-card-border text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-extrabold hover:brightness-110 active:scale-95 cursor-pointer shadow-md flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  <span>Programa Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

