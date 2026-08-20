import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { SoruKaydi, ActiveTab, HataTuru } from '../types';

interface StatsViewProps {
  questions?: SoruKaydi[];
  setActiveTab?: (tab: ActiveTab) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({
  questions = [],
  setActiveTab,
}) => {
  const [activeErrorIndex, setActiveErrorIndex] = useState<number | null>(null);
  const [selectedErrorType, setSelectedErrorType] = useState<string | null>(null);
  const [activeSubjectIndex, setActiveSubjectIndex] = useState<number | null>(null);

  const hasData = questions.length > 0;
  const totalSolved = questions.length;
  const savedErrorCount = questions.filter((q) => q.isSaved).length;
  const successRate = hasData ? Math.max(0, Math.round(((totalSolved - savedErrorCount) / totalSolved) * 100)) : 0;

  // Dynamic Subject Breakdown Calculations
  const subjectMap: Record<string, number> = {};
  questions.forEach((q) => {
    const ders = q.ders && q.ders.trim() ? q.ders.trim() : 'Diğer';
    subjectMap[ders] = (subjectMap[ders] || 0) + 1;
  });

  const lessonColors: Record<string, string> = {
    Matematik: '#6366f1',
    Fizik: '#06b6d4',
    Kimya: '#f59e0b',
    Biyoloji: '#10b981',
    Türkçe: '#ec4899',
    Tarih: '#8b5cf6',
    Coğrafya: '#14b8a6',
    Edebiyat: '#f43f5e',
    Felsefe: '#818cf8',
    İngilizce: '#3b82f6',
    Vatandaşlık: '#a855f7',
    Diğer: '#64748b',
  };

  const defaultPalette = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#f43f5e', '#3b82f6'];

  const subjectPieData = Object.entries(subjectMap).map(([name, count], idx) => ({
    name,
    value: count,
    color: lessonColors[name] || defaultPalette[idx % defaultPalette.length],
  }));

  const topSubject = subjectPieData.reduce(
    (prev, curr) => (curr.value > prev.value ? curr : prev),
    subjectPieData[0] || { name: 'Yok', value: 0 }
  );

  // Dynamic Real-time Hata Türü Calculations from SoruKaydi
  const errorCounts: Record<string, number> = {
    'Dikkat Eksikliği': 0,
    'Kavram Yanılgısı': 0,
    'İşlem Hatası': 0,
  };

  let totalCategorizedErrors = 0;
  questions.forEach((q) => {
    const rawHata = (q.hataTuru || '').toString();
    if (rawHata.includes('Dikkat') || rawHata.includes('dikkat')) {
      errorCounts['Dikkat Eksikliği']++;
      totalCategorizedErrors++;
    } else if (rawHata.includes('Kavram') || rawHata.includes('kavram')) {
      errorCounts['Kavram Yanılgısı']++;
      totalCategorizedErrors++;
    } else if (rawHata.includes('İşlem') || rawHata.includes('işlem') || rawHata.includes('İslem') || rawHata.includes('islem')) {
      errorCounts['İşlem Hatası']++;
      totalCategorizedErrors++;
    } else {
      // Default grouping fallback if unspecified
      errorCounts['Dikkat Eksikliği']++;
      totalCategorizedErrors++;
    }
  });

  const errorColors: Record<string, { color: string; bg: string; text: string; icon: string }> = {
    'Dikkat Eksikliği': { color: '#6366f1', bg: 'bg-indigo-500/10', text: 'text-indigo-500', icon: 'visibility_off' },
    'Kavram Yanılgısı': { color: '#f59e0b', bg: 'bg-amber-500/10', text: 'text-amber-500', icon: 'lightbulb' },
    'İşlem Hatası': { color: '#ef4444', bg: 'bg-rose-500/10', text: 'text-rose-500', icon: 'calculate' },
  };

  const errorPieData = [
    {
      name: 'Dikkat Eksikliği',
      shortName: 'Dikkat',
      value: errorCounts['Dikkat Eksikliği'],
      color: '#6366f1',
      icon: 'visibility_off',
    },
    {
      name: 'Kavram Yanılgısı',
      shortName: 'Kavram',
      value: errorCounts['Kavram Yanılgısı'],
      color: '#f59e0b',
      icon: 'lightbulb',
    },
    {
      name: 'İşlem Hatası',
      shortName: 'İşlem',
      value: errorCounts['İşlem Hatası'],
      color: '#ef4444',
      icon: 'calculate',
    },
  ];

  const activeErrorData = activeErrorIndex !== null ? errorPieData[activeErrorIndex] : null;

  const topErrorType = errorPieData.reduce(
    (prev, curr) => (curr.value > prev.value ? curr : prev),
    errorPieData[0] || { name: 'Yok', value: 0 }
  );

  // Filtered questions when user clicks on a pie slice or legend item
  const filteredErrorQuestions = selectedErrorType
    ? questions.filter((q) => {
        const rawHata = (q.hataTuru || '').toString();
        if (selectedErrorType === 'Dikkat Eksikliği') return rawHata.includes('Dikkat') || rawHata.includes('dikkat') || !rawHata;
        if (selectedErrorType === 'Kavram Yanılgısı') return rawHata.includes('Kavram') || rawHata.includes('kavram');
        if (selectedErrorType === 'İşlem Hatası') return rawHata.includes('İşlem') || rawHata.includes('işlem') || rawHata.includes('İslem') || rawHata.includes('islem');
        return false;
      })
    : [];

  // Recharts Custom Tooltip Component
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const pct = totalSolved > 0 ? Math.round((data.value / totalSolved) * 100) : 0;
      return (
        <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs shadow-xl border border-white/10 space-y-1 backdrop-blur-md">
          <p className="font-extrabold flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block shadow-xs" style={{ backgroundColor: data.payload.color }} />
            {data.name}
          </p>
          <p className="text-slate-300 font-medium">
            <strong className="text-white font-bold">{data.value} Soru</strong> (%{pct})
          </p>
          <p className="text-[10px] text-slate-400 font-semibold">Tıklayarak bu kategorideki soruları görün</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-32 animate-fadeIn">
      {/* Title */}
      <div className="flex flex-col xs:flex-row sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h2 className="font-extrabold text-xl sm:text-2xl tracking-tight text-text-main">
            Gelişim & Performans Analizi
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            {hasData ? `${totalSolved} adet çözülen soru üzerinden detaylı analiz raporu` : 'Sıfırlandı - Henüz soru analizi bulunmuyor'}
          </p>
        </div>
        {hasData && (
          <span className="bg-primary/10 text-primary font-bold text-xs px-3 py-1 rounded-full shrink-0">
            {totalSolved} Toplam Soru
          </span>
        )}
      </div>

      {/* DENEME SINAVI NET TAKİBİ BANNER CARD */}
      <div
        onClick={() => setActiveTab && setActiveTab('deneme')}
        className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-4 sm:p-5 rounded-3xl text-white shadow-xl border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-purple-400 hover:scale-[1.01] transition-all group relative overflow-hidden"
      >
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform shrink-0 mt-0.5 sm:mt-0">
            <span className="material-symbols-outlined text-2xl">analytics</span>
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-purple-500 text-white font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                YENİ MODÜL
              </span>
              <h3 className="font-extrabold text-sm sm:text-base text-white leading-snug">Deneme Sınavı Net Takibi</h3>
            </div>
            <p className="text-xs text-purple-200/80 font-medium leading-relaxed">
              TYT, AYT ve LGS netlerinizi kaydedin, gelişim eğrisini grafikte inceleyin!
            </p>
          </div>
        </div>

        <button className="w-full sm:w-auto bg-white text-purple-900 font-black text-xs px-4 py-2.5 rounded-xl shadow-md group-hover:bg-purple-100 transition-colors shrink-0 flex items-center justify-center gap-1 cursor-pointer">
          <span>Detaylı İncele</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </div>

      {!hasData ? (
        /* Zero Data / Clean Slate Empty State Card */
        <div className="bg-card-bg rounded-3xl p-8 border border-card-border text-center space-y-4 shadow-xs">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto border border-primary/20 shadow-xs">
            <span className="material-symbols-outlined text-4xl">query_stats</span>
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="font-extrabold text-lg text-text-main">Henüz Gelişim Verisi Bulunmuyor</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Ana sayfadan ilk sorunuzun fotoğrafını çekerek veya metin olarak yazarak pedagojik performans analizinizi oluşturabilirsiniz!
            </p>
          </div>
          {setActiveTab && (
            <button
              onClick={() => setActiveTab('home')}
              className="bg-primary text-white font-extrabold text-xs px-6 py-3 rounded-2xl hover:brightness-110 active:scale-95 transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">photo_camera</span>
              <span>İlk Sorunu Analiz Et</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Overall Success & Weekly Activity (Bento Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Overall Success Circular Progress Card */}
            <div className="md:col-span-5 bg-card-bg rounded-2xl p-6 border border-card-border flex flex-col items-center justify-center space-y-4 shadow-xs">
              <h3 className="font-extrabold text-base text-text-main text-center">Genel Başarı Oranı</h3>

              {/* SVG Circular Gauge */}
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-surface-container-low"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-primary transition-all duration-1000"
                    strokeWidth="10"
                    strokeDasharray="251.2"
                    strokeDashoffset={251.2 - (251.2 * successRate) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-primary">%{successRate}</span>
                  <span className="text-[10px] font-bold text-text-muted">
                    {successRate >= 70 ? 'Verimli' : 'Geliştirilebilir'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-text-muted text-center">
                {totalSolved} sorudan <span className="text-primary font-bold">{totalSolved - savedErrorCount} kadarı</span> tam çözümlendi.
              </p>
            </div>

            {/* Activity Bar Chart Card */}
            <div className="md:col-span-7 bg-card-bg rounded-2xl p-6 border border-card-border flex flex-col justify-between shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-extrabold text-base text-text-main">Aktivite Dağılımı</h3>
                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                  {totalSolved} Soru Çözüldü
                </span>
              </div>

              {/* Bar Chart Simulation */}
              <div className="flex items-end justify-between gap-2 h-44 px-2 pt-4">
                {[
                  { day: 'Pzt', val: Math.round(totalSolved * 0.1) },
                  { day: 'Sal', val: Math.round(totalSolved * 0.15) },
                  { day: 'Çar', val: Math.round(totalSolved * 0.2) },
                  { day: 'Per', val: Math.round(totalSolved * 0.1) },
                  { day: 'Cum', val: Math.round(totalSolved * 0.25) },
                  { day: 'Cmt', val: Math.round(totalSolved * 0.1) },
                  { day: 'Paz', val: Math.round(totalSolved * 0.1), active: true },
                ].map((bar, idx) => (
                  <div key={idx} className="flex flex-col items-center flex-1 gap-1.5 group">
                    <span className="text-[10px] font-bold text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                      {bar.val}
                    </span>
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-700 ${
                        bar.active ? 'bg-primary' : 'bg-primary/40 dark:bg-primary/20 hover:bg-primary'
                      }`}
                      style={{ height: `${Math.min(100, Math.max(15, bar.val * 15))}%` }}
                    />
                    <span className={`text-xs ${bar.active ? 'font-black text-primary' : 'text-text-muted font-bold'}`}>
                      {bar.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TWO PIE CHARTS SECTION: Ders Dağılımı + Hata Türü Dağılımı */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. PASTA GRAFİĞİ: Ders Bazlı Yanlış/Soru Dağılımı */}
            <div className="bg-card-bg rounded-2xl p-6 border border-card-border space-y-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-xl">pie_chart</span>
                    <h3 className="font-extrabold text-base text-text-main">Ders Bazlı Soru Dağılımı</h3>
                  </div>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                    Pasta Grafiği
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  En çok yanlış soru çözülen ders: <strong className="text-primary">{topSubject.name}</strong> ({topSubject.value} soru)
                </p>
              </div>

              {/* Pie Chart Component */}
              <div className="h-60 w-full flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subjectPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {subjectPieData.map((entry, index) => (
                        <Cell key={`cell-subject-${index}`} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Stats Overlay */}
                <div className="absolute pointer-events-none flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-text-main">{subjectPieData.length}</span>
                  <span className="text-[10px] font-bold text-text-muted">Farklı Ders</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-card-border/60">
                {subjectPieData.map((item, idx) => {
                  const pct = Math.round((item.value / totalSolved) * 100);
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-bold text-text-main truncate flex-1">{item.name}</span>
                      <span className="text-text-muted font-bold">{item.value} (%{pct})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. PASTA GRAFİĞİ: Hata Türü Dağılımı (Dikkat, Kavram, İşlem) */}
            <div className="bg-card-bg rounded-2xl p-6 border border-card-border space-y-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500 text-xl">analytics</span>
                    <h3 className="font-extrabold text-base text-text-main">Hata Türü Dağılımı</h3>
                  </div>
                  <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    İnteraktif Pedagojik Analiz
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  {selectedErrorType ? (
                    <span>Seçili Filtre: <strong className="text-primary">{selectedErrorType}</strong> (Temizlemek için tekrar tıklayın)</span>
                  ) : (
                    <span>En sık yapılan hata: <strong className="text-amber-600 dark:text-amber-400">{topErrorType.name}</strong> ({topErrorType.value} soru)</span>
                  )}
                </p>
              </div>

              {/* Pie Chart Component */}
              <div className="h-60 w-full flex items-center justify-center relative cursor-pointer">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={errorPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                      onMouseEnter={(_, index) => setActiveErrorIndex(index)}
                      onMouseLeave={() => setActiveErrorIndex(null)}
                      onClick={(_, index) => {
                        const name = errorPieData[index]?.name;
                        setSelectedErrorType(prev => prev === name ? null : name);
                      }}
                    >
                      {errorPieData.map((entry, index) => {
                        const isHovered = activeErrorIndex === index;
                        const isSelected = selectedErrorType === entry.name;
                        return (
                          <Cell
                            key={`cell-error-${index}`}
                            fill={entry.color}
                            stroke={isSelected ? '#ffffff' : isHovered ? '#ffffff' : 'transparent'}
                            strokeWidth={isSelected ? 3 : isHovered ? 2 : 0}
                            style={{
                              filter: isHovered || isSelected ? 'drop-shadow(0px 4px 10px rgba(0,0,0,0.3))' : 'none',
                              opacity: selectedErrorType && !isSelected ? 0.45 : 1,
                              cursor: 'pointer',
                              transition: 'all 0.3s ease',
                            }}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Dynamic Stats Overlay */}
                <div className="absolute pointer-events-none flex flex-col items-center justify-center text-center transition-all duration-300">
                  {activeErrorData ? (
                    <>
                      <span className="text-xl font-black" style={{ color: activeErrorData.color }}>
                        {activeErrorData.value} Soru
                      </span>
                      <span className="text-[10px] font-extrabold text-text-main">
                        {activeErrorData.shortName} (%{totalSolved > 0 ? Math.round((activeErrorData.value / totalSolved) * 100) : 0})
                      </span>
                    </>
                  ) : selectedErrorType ? (
                    <>
                      <span className="text-xl font-black text-primary">
                        {filteredErrorQuestions.length} Soru
                      </span>
                      <span className="text-[10px] font-extrabold text-text-main">
                        {selectedErrorType}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-black text-text-main">{totalSolved}</span>
                      <span className="text-[10px] font-bold text-text-muted">Toplam Hata</span>
                    </>
                  )}
                </div>
              </div>

              {/* Interactive Legend List */}
              <div className="grid grid-cols-1 gap-2 pt-2 border-t border-card-border/60">
                {errorPieData.map((item, idx) => {
                  const pct = totalSolved > 0 ? Math.round((item.value / totalSolved) * 100) : 0;
                  const isHovered = activeErrorIndex === idx;
                  const isSelected = selectedErrorType === item.name;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onMouseEnter={() => setActiveErrorIndex(idx)}
                      onMouseLeave={() => setActiveErrorIndex(null)}
                      onClick={() => setSelectedErrorType(prev => prev === item.name ? null : item.name)}
                      className={`flex items-center justify-between p-2 rounded-xl transition-all text-xs border cursor-pointer ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                          : isHovered
                          ? 'bg-surface-container-low border-card-border text-text-main'
                          : 'bg-transparent border-transparent text-text-muted hover:bg-surface-container-low/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm" style={{ color: item.color }}>
                          {item.icon}
                        </span>
                        <span className="font-extrabold text-text-main">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-main">{item.value} soru</span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-black"
                          style={{ backgroundColor: `${item.color}20`, color: item.color }}
                        >
                          %{pct}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Filtered Questions List (When error category is selected) */}
          {selectedErrorType && (
            <div className="bg-card-bg rounded-2xl p-6 border border-primary/30 space-y-4 shadow-sm animate-fadeIn">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">filter_list</span>
                  <h3 className="font-extrabold text-base text-text-main">
                    "{selectedErrorType}" İle İlgili Yanlış Sorular ({filteredErrorQuestions.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedErrorType(null)}
                  className="text-xs font-bold text-text-muted hover:text-text-main flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                  Filtreyi Temizle
                </button>
              </div>

              {filteredErrorQuestions.length === 0 ? (
                <p className="text-xs text-text-muted italic">Bu kategoride kaydedilmiş soru bulunmamaktadır.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredErrorQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="bg-surface-container-low/60 rounded-xl p-3 border border-card-border flex items-center gap-3 hover:border-primary/50 transition-all cursor-pointer"
                      onClick={() => setActiveTab && setActiveTab('solution')}
                    >
                      {q.gorselUrl ? (
                        <img src={q.gorselUrl} alt="Soru" className="w-12 h-12 rounded-lg object-cover border border-card-border" />
                      ) : (
                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold text-xs">
                          {q.ders?.[0] || 'S'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <span className="font-extrabold text-xs text-text-main truncate">{q.ders}</span>
                          <span className="text-[10px] text-text-muted font-medium">{q.konu}</span>
                        </div>
                        <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">{q.ocrMetin || q.sokratikIpucu || 'Soru detayları'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subject Performance Breakdown Progress Bars */}
          <section className="space-y-3">
            <h3 className="font-extrabold text-base text-text-main">Ders Bazlı Soru Detayı</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {subjectPieData.slice(0, 3).map((sub, idx) => (
                <div key={idx} className="bg-card-bg rounded-2xl p-4 border border-card-border space-y-2 shadow-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-sm text-text-main">{sub.name}</span>
                    <span className="text-xs font-black" style={{ color: sub.color }}>{sub.value} Soru</span>
                  </div>
                  <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, (sub.value / (totalSolved || 1)) * 100)}%`,
                        backgroundColor: sub.color,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-text-muted">%{Math.round((sub.value / totalSolved) * 100)} soru payı.</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

