import React, { useState, useEffect } from 'react';
import {
  getNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermissions,
  dispatchAppNotification,
  NotificationSettings,
} from '../lib/notificationService';
import { Bildirim } from '../types';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddInAppNotification?: (notif: Bildirim) => void;
  showToast?: (msg: string) => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  onAddInAppNotification,
  showToast,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getNotificationSettings());
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermissionGranted(Notification.permission === 'granted');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      saveNotificationSettings(updated);
      return updated;
    });
  };

  const updateTime = (key: keyof NotificationSettings, value: string) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value };
      saveNotificationSettings(updated);
      return updated;
    });
  };

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermissions();
    setPermissionGranted(granted);
    if (granted) {
      showToast?.('✅ Bildirim izni başarıyla verildi!');
    } else {
      showToast?.('⚠️ Bildirim izni verilmedi veya tarayıcı tarafından kısıtlandı.');
    }
  };

  const handleSendTestNotification = async () => {
    setIsSendingTest(true);
    try {
      await requestNotificationPermissions();
      await dispatchAppNotification({
        type: 'system',
        title: '🔔 EduMind Test Bildirimi',
        message: 'Harika! Telefon bildirimlerin ve uygulama içi bildirimlerin başarıyla çalışıyor. 🎯',
        onAddInAppNotification,
      });
      showToast?.('🚀 Test bildirimi telefonunuza ve bildirim panelinize iletildi!');
    } catch (e) {
      showToast?.('❌ Test bildirimi gönderilirken bir hata oluştu.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSaveAndClose = () => {
    saveNotificationSettings(settings);
    showToast?.('💾 Bildirim ayarları güncellendi.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 pb-20 sm:pb-4 animate-fadeIn">
      <div className="bg-card-bg w-full max-w-lg rounded-3xl p-6 border border-card-border space-y-4 shadow-2xl max-h-[85dvh] sm:max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-card-border pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <span className="material-symbols-outlined text-2xl">notifications_active</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-text-main">Bildirim & Hatırlatıcı Ayarları</h3>
              <p className="text-[11px] text-text-muted">Telefon ve Uygulama İçi Bildirimleri Yönet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main p-1.5 rounded-full hover:bg-surface-container-low cursor-pointer transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 overscroll-contain space-y-5 pr-1">

        {/* Native Notification Permission & Test Trigger Box */}
        <div className="bg-primary/5 dark:bg-primary/10 p-4 rounded-2xl border border-primary/20 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-xs font-bold text-text-main">Telefon Bildirim Durumu</span>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              {permissionGranted ? '🟢 Aktif / İzinli' : '🟡 İzin Gerekebilir'}
            </span>
          </div>
          <p className="text-[11px] text-text-muted">
            Uygulama kapalıyken veya arka plandayken çalışma ve tekrar hatırlatıcılarını kaçırmamak için bildirimlerin açık olduğundan emin olun.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleRequestPermission}
              className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-surface-container-low hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main font-bold text-xs border border-card-border transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm text-primary">security</span>
              <span>İzinleri Kontrol Et</span>
            </button>
            <button
              type="button"
              onClick={handleSendTestNotification}
              disabled={isSendingTest}
              className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-extrabold text-xs shadow-sm transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">send</span>
              <span>{isSendingTest ? 'Gönderiliyor...' : '🔔 Test Bildirimi Gönder'}</span>
            </button>
          </div>
        </div>

        {/* Section 1: Ders ve Çalışma Hatırlatıcıları */}
        <section className="space-y-3">
          <h4 className="font-extrabold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">menu_book</span>
            <span>Ders ve Çalışma Hatırlatıcıları</span>
          </h4>

          <div className="space-y-2">
            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-card-border space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-text-main">🎯 Günlük Hedef & Çalışma Hatırlatıcı</p>
                  <p className="text-[11px] text-text-muted">Belirlediğin çalışma saatlerinde motive edici bildirim al.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.dailyGoal}
                  onChange={() => toggle('dailyGoal')}
                  className="w-5 h-5 accent-primary rounded-md cursor-pointer shrink-0"
                />
              </div>
              {settings.dailyGoal && (
                <div className="pt-2 border-t border-card-border/60 flex items-center justify-between text-xs animate-fadeIn">
                  <span className="text-text-muted font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-primary">schedule</span>
                    <span>Hatırlatıcı Saati:</span>
                  </span>
                  <input
                    type="time"
                    value={settings.dailyGoalTime || '19:00'}
                    onChange={(e) => updateTime('dailyGoalTime', e.target.value)}
                    className="px-2.5 py-1 text-xs bg-card-bg border border-card-border rounded-lg text-text-main font-mono font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>

            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-card-border flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-text-main">🧠 Hata Havuzu & Soru Tekrarı</p>
                <p className="text-[11px] text-text-muted">Hata havuzunda ve Ebbinghaus eğrisinde bekleyen soruları hatırlat.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.errorPoolReview}
                onChange={() => toggle('errorPoolReview')}
                className="w-5 h-5 accent-primary rounded-md cursor-pointer shrink-0"
              />
            </div>

            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-card-border flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-text-main">🔥 Seri (Streak) Koruma Hatırlatıcısı</p>
                <p className="text-[11px] text-text-muted">Günlük serini ve kazandığın XP'leri kaybetmemen için uyar.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.streakReminder}
                onChange={() => toggle('streakReminder')}
                className="w-5 h-5 accent-primary rounded-md cursor-pointer shrink-0"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Sosyal ve Pomodoro Bildirimleri */}
        <section className="space-y-3">
          <h4 className="font-extrabold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">groups</span>
            <span>Sosyal ve Pomodoro Bildirimleri</span>
          </h4>

          <div className="space-y-2">
            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-card-border flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-text-main">👥 Arkadaşlık ve Ortak Oda Davetleri</p>
                <p className="text-[11px] text-text-muted">Arkadaşlarından gelen Pomodoro oda davetleri ve arkadaşlık istekleri.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.friendActivity}
                onChange={() => toggle('friendActivity')}
                className="w-5 h-5 accent-primary rounded-md cursor-pointer shrink-0"
              />
            </div>

            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-card-border flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-text-main">📊 Haftalık Gelişim ve Başarı Raporu</p>
                <p className="text-[11px] text-text-muted">Haftalık net analizleri ve sıralama değişim raporları.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.weeklyReport}
                onChange={() => toggle('weeklyReport')}
                className="w-5 h-5 accent-primary rounded-md cursor-pointer shrink-0"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Motivasyon ve Güncellemeler */}
        <section className="space-y-3">
          <h4 className="font-extrabold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">tips_and_updates</span>
            <span>Motivasyon ve Güncellemeler</span>
          </h4>

          <div className="space-y-2">
            {/* Daily Study Motivation Notification */}
            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-card-border space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">hotel_class</span>
                  </div>
                  <div>
                    <p className="text-xs font-black text-text-main">🌟 Günlük Ders Motivasyon Bildirimleri</p>
                    <p className="text-[11px] text-text-muted font-medium">Her gün çalışma azmini artıracak ilham verici ders koçu sözleri ve sınav tavsiyeleri al.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.dailyMotivation ?? true}
                  onChange={() => toggle('dailyMotivation')}
                  className="w-5 h-5 accent-primary rounded-md cursor-pointer shrink-0"
                />
              </div>

              {settings.dailyMotivation && (
                <div className="pt-2 border-t border-card-border/60 flex items-center justify-between text-xs animate-fadeIn">
                  <span className="text-text-muted font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-amber-500">schedule</span>
                    <span>Bildirim Saati:</span>
                  </span>
                  <input
                    type="time"
                    value={settings.dailyMotivationTime || '09:30'}
                    onChange={(e) => updateTime('dailyMotivationTime', e.target.value)}
                    className="px-2.5 py-1 text-xs bg-card-bg border border-card-border rounded-lg text-text-main font-mono font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>

            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-card-border flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-text-main">🚀 Sınav Hedefi ve Motivasyon İpuçları</p>
                <p className="text-[11px] text-text-muted">Hedeflediğin sınav için geri sayım uyarıları ve motivasyon sözleri.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.campaigns}
                onChange={() => toggle('campaigns')}
                className="w-5 h-5 accent-primary rounded-md cursor-pointer shrink-0"
              />
            </div>

            <div className="bg-surface-container-low p-3.5 rounded-2xl border border-card-border flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-text-main">✨ Yeni Özellikler ve Yapay Zeka Güncellemeleri</p>
                <p className="text-[11px] text-text-muted">EduMind yenilikleri ve soru çözüm güncellemeleri.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.updates}
                onChange={() => toggle('updates')}
                className="w-5 h-5 accent-primary rounded-md cursor-pointer shrink-0"
              />
            </div>
          </div>
        </section>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-card-border shrink-0 flex justify-end">
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="w-full bg-primary text-white font-extrabold text-xs py-3.5 rounded-2xl hover:bg-primary-hover active:scale-95 transition-all cursor-pointer shadow-md"
          >
            💾 Ayarları Kaydet ve Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
