import React, { useState, useEffect } from 'react';
import { DenemeRecord, DenemeDersResult } from '../types';
import { getDenemeler, saveDeneme, deleteDeneme } from '../lib/storage';

interface DenemeTakibiViewProps {
  onRewardXp?: (amount: number) => void;
  showToast?: (msg: string) => void;
}

const DEFAULT_SUBJECTS_MAP: Record<string, Array<{ name: string; maxQuestions: number }>> = {
  TYT: [
    { name: 'Türkçe', maxQuestions: 40 },
    { name: 'Sosyal Bilimler', maxQuestions: 20 },
    { name: 'Temel Matematik', maxQuestions: 40 },
    { name: 'Fen Bilimleri', maxQuestions: 20 },
  ],
  AYT: [
    { name: 'Matematik', maxQuestions: 40 },
    { name: 'Fizik', maxQuestions: 14 },
    { name: 'Kimya', maxQuestions: 13 },
    { name: 'Biyoloji', maxQuestions: 13 },
    { name: 'Edebiyat', maxQuestions: 24 },
    { name: 'Tarih-1', maxQuestions: 10 },
    { name: 'Coğrafya-1', maxQuestions: 6 },
  ],
  LGS: [
    { name: 'Türkçe', maxQuestions: 20 },
    { name: 'Matematik', maxQuestions: 20 },
    { name: 'Fen Bilimleri', maxQuestions: 20 },
    { name: 'T.C. İnkılap', maxQuestions: 10 },
    { name: 'Din Kültürü', maxQuestions: 10 },
    { name: 'İngilizce', maxQuestions: 10 },
  ],
  YDT: [
    { name: 'İngilizce / Yabancı Dil', maxQuestions: 80 },
  ],
  KPSS: [
    { name: 'Genel Yetenek (Mat/Türkçe)', maxQuestions: 60 },
    { name: 'Genel Kültür (Tarih/Coğ/Anayasa)', maxQuestions: 60 },
  ],
  'Diğer': [
    { name: 'Genel Bölüm 1', maxQuestions: 30 },
    { name: 'Genel Bölüm 2', maxQuestions: 30 },
  ],
};

export const DenemeTakibiView: React.FC<DenemeTakibiViewProps> = ({ onRewardXp, showToast }) => {
  const [denemeler, setDenemeler] = useState<DenemeRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('HEPSİ');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [sinavTuru, setSinavTuru] = useState<'TYT' | 'AYT' | 'LGS' | 'YDT' | 'KPSS' | 'Diğer'>('TYT');
  const [yayinEvi, setYayinEvi] = useState('');
  const [tarih, setTarih] = useState(new Date().toISOString().split('T')[0]);
  const [notlar, setNotlar] = useState('');
  const [dersInputlar, setDersInputlar] = useState<Array<{ dersAdi: string; dogru: number; yanlis: number; bos: number; maxQ: number }>>([]);

  useEffect(() => {
    setDenemeler(getDenemeler());
  }, []);

  // Clean form when modal opens or closes
  useEffect(() => {
    if (!isModalOpen) {
      setYayinEvi('');
      setNotlar('');
      setTarih(new Date().toISOString().split('T')[0]);
    }
  }, [isModalOpen]);

  // When sinavTuru changes in modal, load template subjects
  useEffect(() => {
    const template = DEFAULT_SUBJECTS_MAP[sinavTuru] || DEFAULT_SUBJECTS_MAP['Diğer'];
    setDersInputlar(
      template.map((t) => ({
        dersAdi: t.name,
        dogru: 0,
        yanlis: 0,
        bos: t.maxQuestions,
        maxQ: t.maxQuestions,
      }))
    );
  }, [sinavTuru]);

  const handleScoreChange = (index: number, field: 'dogru' | 'yanlis', val: number) => {
    setDersInputlar((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const numVal = Math.max(0, isNaN(val) ? 0 : val);

      if (field === 'dogru') {
        item.dogru = Math.min(item.maxQ, numVal);
      } else if (field === 'yanlis') {
        item.yanlis = Math.min(item.maxQ - item.dogru, numVal);
      }

      item.bos = Math.max(0, item.maxQ - (item.dogru + item.yanlis));
      updated[index] = item;
      return updated;
    });
  };

  const calculateNet = (dogru: number, yanlis: number) => {
    return Math.max(0, Number((dogru - yanlis / 4).toFixed(2)));
  };

  const currentTotalNet = dersInputlar.reduce((acc, curr) => acc + calculateNet(curr.dogru, curr.yanlis), 0);

  const handleAddDeneme = (e: React.FormEvent) => {
    e.preventDefault();
    if (!yayinEvi.trim()) {
      alert('Lütfen deneme adını veya yayın evini belirtiniz.');
      return;
    }

    const derslerResult: DenemeDersResult[] = dersInputlar.map((d) => ({
      dersAdi: d.dersAdi,
      dogru: d.dogru,
      yanlis: d.yanlis,
      bos: d.bos,
      net: calculateNet(d.dogru, d.yanlis),
    }));

    const newRecord: DenemeRecord = {
      id: `deneme_${Date.now()}`,
      sinavTuru,
      yayinEvi: yayinEvi.trim(),
      tarih: tarih || new Date().toISOString().split('T')[0],
      dersler: derslerResult,
      toplamNet: Number(currentTotalNet.toFixed(2)),
      notlar: notlar.trim() || '',
      createdAt: Date.now(),
    };

    const updatedList = saveDeneme(newRecord);
    setDenemeler(updatedList);
    setIsModalOpen(false);

    // Reset Form
    setYayinEvi('');
    setNotlar('');

    if (onRewardXp) onRewardXp(40);
    if (showToast) showToast(`🎉 ${sinavTuru} deneme neti başarıyla kaydedildi! (+40 XP)`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Bu deneme kaydını silmek istediğinizden emin misiniz?')) {
      const updated = deleteDeneme(id);
      setDenemeler(updated);
      if (showToast) showToast('Deneme kaydı silindi.');
    }
  };

  // Filtered List
  const filteredDenemeler = denemeler.filter((d) => {
    if (activeFilter === 'HEPSİ') return true;
    return d.sinavTuru === activeFilter;
  });

  // Calculate Statistics
  const totalCount = denemeler.length;
  const avgNet = totalCount > 0 ? (denemeler.reduce((acc, curr) => acc + curr.toplamNet, 0) / totalCount).toFixed(1) : '0';
  const maxNetRecord = totalCount > 0 ? [...denemeler].sort((a, b) => b.toplamNet - a.toplamNet)[0] : null;

  // Calculate Trend (difference between last 2 exams of same type)
  const sortedByDate = [...denemeler].sort((a, b) => new Date(a.tarih).getTime() - new Date(b.tarih).getTime());
  const netDiff =
    sortedByDate.length >= 2
      ? (sortedByDate[sortedByDate.length - 1].toplamNet - sortedByDate[sortedByDate.length - 2].toplamNet).toFixed(2)
      : null;

  return (
    <div className="space-y-4 sm:space-y-5 pb-20">
      {/* Header Banner - Compact & Modern */}
      <div className="bg-gradient-to-r from-indigo-600 via-primary to-purple-600 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
          <span className="material-symbols-outlined text-[120px]">analytics</span>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white">
              <span className="material-symbols-outlined text-xs">trending_up</span>
              Deneme Net İstatistiği
            </div>
            <h1 className="text-lg sm:text-xl font-black">Deneme Sınavı Net Takibi</h1>
            <p className="text-xs text-white/85 font-medium">
              TYT, AYT ve LGS deneme netlerini düzenli kaydet, gelişimini takip et.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto bg-white text-primary hover:bg-slate-100 font-extrabold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-base">add_chart</span>
            <span>+ Yeni Deneme Ekle</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid - Compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-surface p-3 sm:p-3.5 rounded-xl border border-card-border shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold">Toplam Deneme</span>
            <span className="material-symbols-outlined text-primary text-base">assignment</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-text-main">{totalCount} Adet</div>
          <p className="text-[10px] text-text-muted">Kayıtlı denemeler</p>
        </div>

        <div className="bg-surface p-3 sm:p-3.5 rounded-xl border border-card-border shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold">Ortalama Net</span>
            <span className="material-symbols-outlined text-indigo-500 text-base">insights</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-text-main">{avgNet} Net</div>
          <p className="text-[10px] text-text-muted">Genel ortalama</p>
        </div>

        <div className="bg-surface p-3 sm:p-3.5 rounded-xl border border-card-border shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold">En Yüksek Net</span>
            <span className="material-symbols-outlined text-amber-500 text-base">emoji_events</span>
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400">
            {maxNetRecord ? `${maxNetRecord.toplamNet} N` : '-'}
          </div>
          <p className="text-[10px] text-text-muted truncate">
            {maxNetRecord ? `${maxNetRecord.sinavTuru} - ${maxNetRecord.yayinEvi}` : 'Henüz veri yok'}
          </p>
        </div>

        <div className="bg-surface p-3 sm:p-3.5 rounded-xl border border-card-border shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold">Son Değişim</span>
            <span className="material-symbols-outlined text-emerald-500 text-base">show_chart</span>
          </div>
          <div
            className={`text-lg sm:text-xl font-black ${
              netDiff && parseFloat(netDiff) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {netDiff !== null ? `${parseFloat(netDiff) >= 0 ? '+' : ''}${netDiff} N` : '-'}
          </div>
          <p className="text-[10px] text-text-muted">Son 2 deneme farkı</p>
        </div>
      </div>

      {/* Filter Tabs & List Header */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-card-border overflow-x-auto">
            {['HEPSİ', 'TYT', 'AYT', 'LGS', 'YDT', 'KPSS'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  activeFilter === tab
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-container-high'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <span className="text-xs text-text-muted font-bold">
            Gösterilen: {filteredDenemeler.length} Kayıt
          </span>
        </div>

        {/* List of Deneme Cards */}
        {filteredDenemeler.length === 0 ? (
          <div className="bg-surface p-8 text-center rounded-2xl border border-dashed border-card-border space-y-2">
            <span className="material-symbols-outlined text-3xl text-text-muted">find_in_page</span>
            <p className="text-xs font-bold text-text-main">
              {activeFilter === 'HEPSİ' ? 'Henüz kaydedilmiş bir deneme yok.' : `${activeFilter} türünde deneme bulunamadı.`}
            </p>
            <p className="text-[11px] text-text-muted max-w-sm mx-auto">
              Çözdüğün deneme sınavlarının netlerini girerek gelişimini hemen takip etmeye başla!
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-1 bg-primary text-white font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer hover:brightness-110"
            >
              + Deneme Ekle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {filteredDenemeler.map((d) => (
              <div
                key={d.id}
                className="bg-surface p-4 rounded-2xl border border-card-border shadow-2xs hover:border-primary/40 transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  {/* Card Top Info */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                          {d.sinavTuru}
                        </span>
                        <span className="text-[11px] text-text-muted font-semibold">{d.tarih}</span>
                      </div>
                      <h4 className="font-extrabold text-sm text-text-main mt-1">{d.yayinEvi}</h4>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xl font-black text-primary">{d.toplamNet}</div>
                      <span className="text-[9px] font-bold text-text-muted uppercase">Toplam Net</span>
                    </div>
                  </div>

                  {/* Subject Breakdown Badges */}
                  <div className="grid grid-cols-2 gap-1.5 bg-surface-container-low p-2.5 rounded-xl border border-card-border">
                    {d.dersler.map((ders, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-text-main truncate max-w-[80px]">{ders.dersAdi}:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-emerald-600 font-bold">{ders.dogru}D</span>
                          <span className="text-rose-500 font-bold">{ders.yanlis}Y</span>
                          <span className="font-black text-primary ml-0.5">={ders.net}N</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {d.notlar && (
                    <p className="text-[11px] text-text-muted bg-amber-500/10 text-amber-900 dark:text-amber-200 p-2 rounded-lg border border-amber-500/20 italic">
                      "{d.notlar}"
                    </p>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-card-border">
                  <span className="text-[10px] text-text-muted font-medium">
                    Doğruluk: %
                    {Math.round(
                      (d.dersler.reduce((a, b) => a + b.dogru, 0) /
                        Math.max(1, d.dersler.reduce((a, b) => a + b.dogru + b.yanlis + b.bos, 0))) *
                        100
                    )}
                  </span>

                  <button
                    onClick={() => handleDelete(d.id)}
                    className="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visual Chart Graphic Section - Moved to Bottom */}
      {sortedByDate.length > 0 && (
        <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-card-border shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-text-main flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-lg">ssid_chart</span>
                Net Gelişim Trend Grafiği
              </h3>
              <p className="text-[11px] text-text-muted">Zaman içerisindeki deneme netlerinizin yükseliş grafiği</p>
            </div>
            <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
              {sortedByDate.length} Deneme
            </span>
          </div>

          {/* SVG Bar / Trend Chart */}
          <div className="pt-2 pb-1">
            <div className="h-40 w-full flex items-end justify-between gap-2 sm:gap-3 px-1 border-b border-card-border pb-1.5">
              {sortedByDate.map((d, i) => {
                const maxVal = Math.max(...sortedByDate.map((item) => item.toplamNet), 100);
                const heightPercent = Math.max(12, Math.min(100, (d.toplamNet / maxVal) * 100));

                return (
                  <div key={d.id} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-10 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20 whitespace-nowrap shadow-lg">
                      {d.yayinEvi}: <span className="text-emerald-400">{d.toplamNet} Net</span>
                    </div>

                    <span className="text-[10px] font-black text-primary group-hover:scale-110 transition-all">
                      {d.toplamNet}
                    </span>

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[32px] bg-gradient-to-t from-primary/80 to-indigo-500 rounded-t-lg group-hover:brightness-125 transition-all shadow-2xs relative overflow-hidden"
                    >
                      <div className="absolute top-0 inset-x-0 h-0.5 bg-white/40" />
                    </div>

                    <span className="text-[9px] text-text-muted font-bold truncate max-w-[50px] text-center">
                      #{i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ADD DENEME MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-surface border border-card-border rounded-3xl w-full max-w-2xl shadow-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 my-auto">
            <div className="flex items-center justify-between border-b border-card-border pb-3 sm:pb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl sm:text-2xl">post_add</span>
                <h3 className="font-black text-base sm:text-lg text-text-main">Yeni Deneme Neti Ekle</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-main p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleAddDeneme} className="space-y-4">
              {/* Exam Type & Publisher */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1">Sınav Türü</label>
                  <select
                    value={sinavTuru}
                    onChange={(e) => setSinavTuru(e.target.value as any)}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl p-2.5 text-xs font-bold text-text-main focus:outline-none focus:border-primary"
                  >
                    <option value="TYT">TYT (Temel Yeterlilik)</option>
                    <option value="AYT">AYT (Alan Yeterlilik)</option>
                    <option value="LGS">LGS (Lise Geçiş)</option>
                    <option value="YDT">YDT (Yabancı Dil)</option>
                    <option value="KPSS">KPSS</option>
                    <option value="Diğer">Diğer Deneme</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1">Deneme / Yayın Evi Adı</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: 3D Türkiye Geneli-2"
                    value={yayinEvi}
                    onChange={(e) => setYayinEvi(e.target.value)}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl p-2.5 text-xs text-text-main focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-text-main mb-1">Tarih</label>
                  <input
                    type="date"
                    value={tarih}
                    onChange={(e) => setTarih(e.target.value)}
                    className="w-full bg-surface-container-low border border-card-border rounded-xl p-2.5 text-xs text-text-main focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Subject Scores Input Table */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-xs font-black text-text-main">Ders Bazlı Soru Net Tablosu</span>
                  <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary font-black text-xs px-3 py-1 rounded-full w-fit">
                    <span>Toplam Net:</span>
                    <span className="text-sm">{currentTotalNet.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-surface-container-low rounded-2xl border border-card-border p-2.5 sm:p-3 space-y-2.5 max-h-64 overflow-y-auto">
                  {dersInputlar.map((ders, idx) => {
                    const net = calculateNet(ders.dogru, ders.yanlis);

                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-surface p-2.5 sm:p-3 rounded-xl border border-card-border"
                      >
                        <span className="font-extrabold text-xs text-text-main min-w-[120px]">{ders.dersAdi}</span>

                        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-card-border/60">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-emerald-600">D:</span>
                            <input
                              type="number"
                              min={0}
                              max={ders.maxQ}
                              value={ders.dogru}
                              onChange={(e) => handleScoreChange(idx, 'dogru', parseInt(e.target.value))}
                              className="w-12 sm:w-14 bg-surface-container-low border border-card-border rounded-lg p-1 text-xs text-center font-bold"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-rose-500">Y:</span>
                            <input
                              type="number"
                              min={0}
                              max={ders.maxQ}
                              value={ders.yanlis}
                              onChange={(e) => handleScoreChange(idx, 'yanlis', parseInt(e.target.value))}
                              className="w-12 sm:w-14 bg-surface-container-low border border-card-border rounded-lg p-1 text-xs text-center font-bold"
                            />
                          </div>

                          <div className="text-[11px] text-text-muted font-bold px-1">
                            B: {ders.bos}
                          </div>

                          <div className="bg-primary/10 text-primary font-black text-xs px-2.5 py-1 rounded-lg shrink-0 ml-auto sm:ml-0">
                            {net} Net
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-extrabold text-text-main mb-1">Deneme Notları & Yorumunuz (İsteğe Bağlı)</label>
                <textarea
                  rows={2}
                  placeholder="Süre yetiştirme durumu, zorlanılan konular veya sınav stresi hakkındaki notlarınız..."
                  value={notlar}
                  onChange={(e) => setNotlar(e.target.value)}
                  className="w-full bg-surface-container-low border border-card-border rounded-xl p-2.5 text-xs text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              {/* Action Submit */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-card-border text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 sm:px-6 py-2.5 rounded-xl bg-primary text-white font-extrabold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  Netleri Kaydet (+40 XP)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
