import { Kullanici, SoruKaydi, Arkadas } from '../types';

export interface Rozet {
  id: string;
  baslik: string;
  aciklama: string;
  gorevText: string;
  icon: string;
  renk: string; // Tailwind color name for text/icon (e.g., 'text-amber-500')
  bgRenk: string; // Tailwind color for bg
  borderRenk: string;
  unlocked: boolean;
  mevcutMiktar: number;
  hedefMiktar: number;
  xpOdulu: number;
}

export function calculateBadges(
  user: Kullanici,
  questions: SoruKaydi[] = [],
  friends: Arkadas[] = []
): Rozet[] {
  const totalQuestions = questions.length;
  const solvedQuestions = questions.filter((q) => q.isSolved).length;
  const flashcardPractices = user.flashcardPractices || 0;
  const invitedFriends = friends.filter((f) => f.isInvitedByMe).length;
  const nightQuestions = questions.filter((q) => {
    if (!q.olusturmaTarihi) return false;
    const date = new Date(q.olusturmaTarihi);
    const hour = date.getHours();
    return hour >= 22 || hour < 6;
  }).length;

  return [
    {
      id: 'badge_first_step',
      baslik: 'İlk Adım',
      aciklama: 'Eğitim Koçum AI ile ilk sorunun fotoğrafını çekerek veya yazarak pedagojik analiz başlattın.',
      gorevText: '1 adet soru analizi kaydet',
      icon: 'rocket_launch',
      renk: 'text-indigo-500 dark:text-indigo-400',
      bgRenk: 'bg-indigo-500/10',
      borderRenk: 'border-indigo-500/30',
      unlocked: totalQuestions >= 1,
      mevcutMiktar: Math.min(totalQuestions, 1),
      hedefMiktar: 1,
      xpOdulu: 25,
    },
    {
      id: 'badge_error_hunter',
      baslik: 'Hata Avcısı',
      aciklama: 'Yanlış yaptığın soruları pes etmeden tekrar inceleyip başarıyla çözüldü olarak işaretledin.',
      gorevText: 'Yanlış havuzundaki 3 soruyu çöz',
      icon: 'pest_control',
      renk: 'text-amber-500 dark:text-amber-400',
      bgRenk: 'bg-amber-500/10',
      borderRenk: 'border-amber-500/30',
      unlocked: solvedQuestions >= 3,
      mevcutMiktar: Math.min(solvedQuestions, 3),
      hedefMiktar: 3,
      xpOdulu: 50,
    },
    {
      id: 'badge_flashcard_master',
      baslik: 'Kavram Ustası',
      aciklama: 'Yanlış sorularındaki en zor 3 kavram kartlarını (Flashcards) çevirerek pratik yaptın.',
      gorevText: '1 kez Kavram Kartları seansını tamamla',
      icon: 'style',
      renk: 'text-purple-500 dark:text-purple-400',
      bgRenk: 'bg-purple-500/10',
      borderRenk: 'border-purple-500/30',
      unlocked: flashcardPractices >= 1,
      mevcutMiktar: Math.min(flashcardPractices, 1),
      hedefMiktar: 1,
      xpOdulu: 30,
    },
    {
      id: 'badge_streak_7',
      baslik: '7 Gün Seri',
      aciklama: 'Disiplinli çalışmayı alışkanlık haline getirdin ve 7 gün boyunca kesintisiz çalışarak seriyi korudun.',
      gorevText: '7 günlük öğrenme serisine ulaş',
      icon: 'auto_awesome',
      renk: 'text-emerald-500 dark:text-emerald-400',
      bgRenk: 'bg-emerald-500/10',
      borderRenk: 'border-emerald-500/30',
      unlocked: user.seri >= 7,
      mevcutMiktar: Math.min(user.seri, 7),
      hedefMiktar: 7,
      xpOdulu: 100,
    },
    {
      id: 'badge_night_owl',
      baslik: 'Gece Kuşu',
      aciklama: 'Gece saat 22:00 ile 06:00 arasında odaklanıp soru analizi yaparak gece çalışması gerçekleştirdin.',
      gorevText: 'Gece saatlerinde (22:00-06:00) 1 soru çöz',
      icon: 'bedtime',
      renk: 'text-blue-500 dark:text-blue-400',
      bgRenk: 'bg-blue-500/10',
      borderRenk: 'border-blue-500/30',
      unlocked: nightQuestions >= 1 || (user.nightOwlUnlocked === true),
      mevcutMiktar: nightQuestions >= 1 || user.nightOwlUnlocked ? 1 : 0,
      hedefMiktar: 1,
      xpOdulu: 35,
    },
    {
      id: 'badge_xp_300',
      baslik: 'Derece Adayı',
      aciklama: 'Çalışmalarınla toplam 300 XP puan barajını aşarak liderlik tablosunda üst sıralara tırmandın.',
      gorevText: 'Toplam 300 XP puanına ulaş',
      icon: 'emoji_events',
      renk: 'text-yellow-500 dark:text-yellow-400',
      bgRenk: 'bg-yellow-500/10',
      borderRenk: 'border-yellow-500/30',
      unlocked: user.xp >= 300,
      mevcutMiktar: Math.min(user.xp, 300),
      hedefMiktar: 300,
      xpOdulu: 75,
    },
    {
      id: 'badge_social_hero',
      baslik: 'Topluluk Destekçisi',
      aciklama: 'Arkadaşlarını Eğitim Koçum ailesine davet ederek birlikte öğrenme ortamına katkı sağladın.',
      gorevText: 'En az 1 arkadaşını platforma davet et',
      icon: 'group_add',
      renk: 'text-rose-500 dark:text-rose-400',
      bgRenk: 'bg-rose-500/10',
      borderRenk: 'border-rose-500/30',
      unlocked: invitedFriends >= 1 || (user.invitedCount && user.invitedCount >= 1) ? true : false,
      mevcutMiktar: Math.min(invitedFriends || (user.invitedCount || 0), 1),
      hedefMiktar: 1,
      xpOdulu: 50,
    },
    {
      id: 'badge_subject_master',
      baslik: 'Konu Ustası',
      aciklama: 'Farklı derslerden toplam 10 soru analizi tamamlayarak konu hakimiyetini kanıtladın.',
      gorevText: 'Toplam 10 soru analizi tamamla',
      icon: 'school',
      renk: 'text-teal-500 dark:text-teal-400',
      bgRenk: 'bg-teal-500/10',
      borderRenk: 'border-teal-500/30',
      unlocked: totalQuestions >= 10,
      mevcutMiktar: Math.min(totalQuestions, 10),
      hedefMiktar: 10,
      xpOdulu: 150,
    },
  ];
}
