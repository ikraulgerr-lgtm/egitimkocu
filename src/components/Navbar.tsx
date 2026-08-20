import React from 'react';
import { ActiveTab, Kullanici } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  user: Kullanici;
  onWatchAd: () => void;
}

export const TopHeader: React.FC<{
  user: Kullanici;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onWatchAd: () => void;
  onOpenExamCountdown?: () => void;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
}> = ({
  user,
  activeTab,
  setActiveTab,
  onWatchAd,
  onOpenExamCountdown,
  unreadNotificationsCount = 0,
  onOpenNotifications,
}) => {
  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const getDaysRemaining = () => {
    const dateStr = user.targetExamDate || '2027-06-19';
    const targetTime = new Date(`${dateStr}T10:00:00`).getTime();
    const diff = targetTime - Date.now();
    if (isNaN(diff) || diff <= 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const daysRemaining = getDaysRemaining();
  const examLabel = user.targetExam === 'Özel' ? (user.customExamName || 'Sınav') : (user.targetExam || 'YKS');

  return (
    <header className="sticky top-0 z-40 bg-surface/90 dark:bg-background/90 backdrop-blur-md border-b border-card-border/40 transition-colors pt-safe">
      <div className="flex justify-between items-center px-2.5 sm:px-4 py-2 sm:py-3 max-w-7xl mx-auto gap-2">
        <div 
          className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group shrink-0 min-w-0"
          onClick={() => {
            triggerHaptic();
            setActiveTab('home');
          }}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-primary group-hover:scale-105 transition-transform shrink-0">
            <img 
              src={user.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1'} 
              alt={user.ad} 
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm xs:text-base sm:text-xl tracking-tight text-primary flex items-center gap-1 truncate">
              <span className="truncate">Eğitim Koçum</span>
              <span className="hidden xs:inline">AI</span>
              {user.isPremium && (
                <span className="text-[9px] sm:text-[10px] bg-amber-400 text-slate-900 font-bold px-1 sm:px-1.5 py-0.5 rounded uppercase shrink-0">
                  PRO
                </span>
              )}
            </h1>
            <p className="text-[11px] text-text-muted font-medium hidden sm:block">{user.sinif}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Notification Bell Button */}
          <button
            onClick={() => {
              triggerHaptic();
              if (onOpenNotifications) onOpenNotifications();
            }}
            title="Bildirimler & Pomodoro Oda Davetleri"
            className="relative bg-purple-100 dark:bg-purple-950/90 hover:bg-purple-200 dark:hover:bg-purple-900 text-purple-900 dark:text-purple-200 border border-purple-300/80 dark:border-purple-700/80 p-1.5 rounded-full flex items-center justify-center shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-base">notifications</span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Exam Countdown Button (compact pill) */}
          <button
            onClick={() => {
              triggerHaptic();
              if (onOpenExamCountdown) onOpenExamCountdown();
            }}
            title="Sınav Geri Sayımı - Kalan Süreyi Göster ve Sınav Değiştir"
            className="bg-indigo-100 dark:bg-indigo-950/90 hover:bg-indigo-200 dark:hover:bg-indigo-900 text-indigo-900 dark:text-indigo-200 border border-indigo-300/80 dark:border-indigo-700/80 px-2 sm:px-2.5 py-1 rounded-full flex items-center gap-1 font-extrabold text-[11px] sm:text-xs shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <span className="text-xs">{user.targetExam === 'Hazırlanmıyorum' ? '🎯' : '⏳'}</span>
            <span>
              {user.targetExam === 'Hazırlanmıyorum'
                ? 'Genel Çalışma'
                : `${user.targetExam === 'Özel' ? (user.customExamName || 'Sınav') : (user.targetExam || 'YKS')}: ${daysRemaining}g`}
            </span>
          </button>

          {/* XP Badge */}
          <div
            onClick={() => setActiveTab('leaderboard')}
            title="Mevcut XP Puanınız - Liderlik Sıralaması"
            className="bg-amber-100 dark:bg-amber-950/90 hover:bg-amber-200 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700/80 px-2 sm:px-2.5 py-1 rounded-full flex items-center gap-1 font-extrabold text-[11px] sm:text-xs shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <span className="text-xs">⚡</span>
            <span>{user.xp} XP</span>
          </div>

          {/* Deneme Netleri Quick Access */}
          <button
            onClick={() => setActiveTab('deneme')}
            title="Deneme Sınavı Net Takibi & Grafik Raporu"
            className={`hidden md:flex px-2.5 py-1 rounded-full items-center gap-1 font-bold text-xs cursor-pointer active:scale-95 transition-all border ${
              activeTab === 'deneme'
                ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                : 'bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-900 border-purple-300/80 dark:border-purple-700/80'
            }`}
          >
            <span className="material-symbols-outlined text-sm">analytics</span>
            <span>Deneme</span>
          </button>

          {/* Soru Kredisi Badge */}
          <button
            onClick={onWatchAd}
            title="Soru Hakkı Detayı - Reklam İzleyerek Soru Hakkı Kazan"
            className={`${
              !user.isPremium && user.kredi < 1
                ? 'flex bg-amber-100 dark:bg-amber-950/90 text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900 border-amber-300 dark:border-amber-700 animate-pulse'
                : 'hidden lg:flex bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-900 border-emerald-300/80 dark:border-emerald-700/80'
            } px-2 sm:px-2.5 py-1 rounded-full items-center gap-1 font-extrabold text-[11px] sm:text-xs cursor-pointer active:scale-95 transition-all border shrink-0`}
          >
            <span className="material-symbols-outlined text-sm">
              {!user.isPremium && user.kredi < 1 ? 'warning' : 'assignment'}
            </span>
            <span>
              {user.isPremium
                ? 'PRO'
                : !user.isPremium && user.kredi < 1
                ? '0 Hak (+1)'
                : `${user.kredi}/${user.maxKredi} Hak`}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

export const BottomNavBar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const isQuestionsTabActive = activeTab === 'errorPool' || activeTab === 'solution';
  const isGrowthTabActive = activeTab === 'stats' || activeTab === 'leaderboard' || activeTab === 'schedule' || activeTab === 'deneme';

  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const navItems = [
    {
      id: 'home' as ActiveTab,
      label: 'Ana Sayfa',
      icon: 'home',
      isActive: activeTab === 'home',
      onClick: () => {
        triggerHaptic();
        setActiveTab('home');
      },
    },
    {
      id: 'errorPool' as ActiveTab,
      label: 'Sorularım',
      icon: 'collections_bookmark',
      isActive: isQuestionsTabActive,
      onClick: () => {
        triggerHaptic();
        setActiveTab('errorPool');
      },
    },
    {
      id: 'community' as ActiveTab,
      label: 'Topluluk',
      icon: 'forum',
      isActive: activeTab === 'community',
      onClick: () => {
        triggerHaptic();
        setActiveTab('community');
      },
    },
    {
      id: 'stats' as ActiveTab,
      label: 'Gelişim',
      icon: 'insights',
      isActive: isGrowthTabActive,
      onClick: () => {
        triggerHaptic();
        setActiveTab('stats');
      },
    },
    {
      id: 'profile' as ActiveTab,
      label: 'Profil',
      icon: 'person',
      isActive: activeTab === 'profile',
      onClick: () => {
        triggerHaptic();
        setActiveTab('profile');
      },
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 dark:bg-background/95 backdrop-blur-xl border-t border-card-border/80 py-1.5 sm:py-2 px-3 pb-safe shadow-2xl transition-colors">
      <div className="max-w-lg mx-auto flex justify-between items-center gap-1.5 sm:gap-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            id={`nav-item-${item.id}`}
            onClick={item.onClick}
            className={`flex flex-col items-center justify-center py-2 px-2 rounded-2xl transition-all duration-200 cursor-pointer flex-1 min-w-0 ${
              item.isActive
                ? 'bg-primary text-white font-bold shadow-md scale-105'
                : 'text-text-muted hover:text-text-main hover:bg-surface-container-low'
            }`}
          >
            <span className={`material-symbols-outlined text-xl sm:text-2xl ${item.isActive ? 'fill-1' : ''}`}>
              {item.icon}
            </span>
            <span className="text-[11px] font-bold tracking-tight truncate max-w-full leading-tight mt-0.5">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};
