import React, { useMemo } from 'react';
import { ProgramOgesi, ActiveTab } from '../types';

interface TodayScheduleSectionProps {
  scheduleItems: ProgramOgesi[];
  onToggleItem: (id: string) => void;
  onOpenCustomProgramModal: () => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const TodayScheduleSection: React.FC<TodayScheduleSectionProps> = ({
  scheduleItems,
  onToggleItem,
  onOpenCustomProgramModal,
  setActiveTab,
}) => {
  // Determine today's day abbreviation and formatted date
  const { todayAbbrev, fullDateString } = useMemo(() => {
    const today = new Date();
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const abbrev = dayNames[today.getDay()];

    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    };
    const formatted = today.toLocaleDateString('tr-TR', options);

    return { todayAbbrev: abbrev, fullDateString: formatted };
  }, []);

  // Filter tasks belonging to today
  const todaysTasks = useMemo(() => {
    return scheduleItems.filter((item) => item.gun === todayAbbrev);
  }, [scheduleItems, todayAbbrev]);

  const completedCount = todaysTasks.filter((t) => t.tamamlandi).length;
  const progressPercent = todaysTasks.length > 0 ? Math.round((completedCount / todaysTasks.length) * 100) : 0;

  return (
    <section className="bg-card-bg border border-card-border rounded-3xl p-5 shadow-xs space-y-4 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-card-border relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
            <span className="material-symbols-outlined text-2xl">calendar_month</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-text-main leading-tight">
                Bugünün Çalışma Programı
              </h3>
              <span className="bg-primary/10 text-primary text-[10px] font-black px-2.5 py-0.5 rounded-full border border-primary/20">
                {fullDateString}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Günlük hedeflerini tamamla, Pomodoro ile odaklanarak başarıya ulaş.
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={onOpenCustomProgramModal}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-primary to-indigo-600 hover:from-primary-hover hover:to-indigo-500 text-white font-extrabold text-xs shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
            <span>Özel Kamp Oluştur</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className="px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-text-main font-bold text-xs border border-card-border transition-all active:scale-95 cursor-pointer flex items-center gap-1"
          >
            <span>Tüm Takvim</span>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Progress Bar & Status */}
      {todaysTasks.length > 0 && (
        <div className="bg-surface-container-low p-3.5 rounded-2xl border border-card-border space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-text-main flex items-center gap-1.5">
              <span className="material-symbols-outlined text-emerald-500 text-base">task_alt</span>
              <span>Günün İlerleme Durumu:</span>
            </span>
            <span className="text-primary font-black">
              {completedCount} / {todaysTasks.length} Görev (%{progressPercent})
            </span>
          </div>
          <div className="w-full h-2.5 bg-card-bg rounded-full overflow-hidden border border-card-border">
            <div
              className="h-full bg-gradient-to-r from-primary via-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Task List or Empty State */}
      {todaysTasks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {todaysTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onToggleItem(task.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 group select-none ${
                task.tamamlandi
                  ? 'bg-emerald-500/5 border-emerald-500/30 text-text-muted opacity-80'
                  : 'bg-surface-container-low border-card-border hover:border-primary/50 text-text-main shadow-2xs hover:shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    task.tamamlandi
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                      : 'border-card-border bg-card-bg group-hover:border-primary'
                  }`}
                >
                  {task.tamamlandi && (
                    <span className="material-symbols-outlined text-sm font-black">check</span>
                  )}
                </div>

                {/* Task Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      task.tamamlandi ? 'bg-slate-500/10 text-slate-500' : 'bg-primary/10 text-primary border border-primary/20'
                    }`}>
                      {task.ders}
                    </span>
                    <span className="text-[10px] font-bold text-text-muted flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      <span>{task.saat}</span>
                    </span>
                  </div>
                  <h4 className={`text-xs font-bold mt-1 line-clamp-2 ${
                    task.tamamlandi ? 'line-through text-text-muted' : 'text-text-main group-hover:text-primary transition-colors'
                  }`}>
                    {task.konu}
                  </h4>
                </div>
              </div>

              {/* Quick Pomodoro button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTab('schedule');
                }}
                className="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                title="Bu ders için Pomodoro Odaklanma başlat"
              >
                <span className="text-base">🍅</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-2xl bg-surface-container-low border border-dashed border-card-border flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
            📅
          </div>
          <div className="max-w-md">
            <h4 className="font-extrabold text-sm text-text-main">
              Bugün İçin Planlanmış Görevin Yok
            </h4>
            <p className="text-xs text-text-muted mt-1 leading-relaxed">
              YKS, KPSS veya sınıf müfredatına özel hazır kamp programı oluşturarak hemen hedeflerini belirleyebilirsin.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCustomProgramModal}
            className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-extrabold text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            <span>Hemen Özel Kamp Programı Oluştur</span>
          </button>
        </div>
      )}
    </section>
  );
};
