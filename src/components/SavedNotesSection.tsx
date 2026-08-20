import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SoruKaydi, ActiveTab } from '../types';

interface SavedNotesSectionProps {
  questions: SoruKaydi[];
  onSelectQuestion: (q: SoruKaydi) => void;
  onUpdateQuestions?: (qs: SoruKaydi[]) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

interface NoteItem {
  id: string;
  questionId: string;
  type: 'kisisel' | 'voice';
  ders: string;
  konu: string;
  text: string;
  date: string;
  question: SoruKaydi;
  voiceNoteId?: string;
}

const COMMON_LESSONS = [
  'Matematik',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Türkçe',
  'Tarih',
  'Coğrafya',
  'Felsefe',
  'Din Kültürü',
  'İngilizce',
  'Genel',
];

export const SavedNotesSection: React.FC<SavedNotesSectionProps> = ({
  questions,
  onSelectQuestion,
  onUpdateQuestions,
  setActiveTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDers, setSelectedDers] = useState<string>('ALL');
  const [selectedKonu, setSelectedKonu] = useState<string>('ALL');

  // Modal / Form states for adding a new note directly
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDers, setNewDers] = useState('Matematik');
  const [newKonu, setNewKonu] = useState('');
  const [newText, setNewText] = useState('');

  // Editing note states
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [editNoteText, setEditNoteText] = useState('');

  // Accordion expanded state for note items
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());

  const toggleExpandNote = (id: string) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 1. Extract all note items from questions
  const allNotes = useMemo(() => {
    const list: NoteItem[] = [];

    questions.forEach((q) => {
      // Personal written note
      if (q.kisiselNot && q.kisiselNot.trim().length > 0) {
        list.push({
          id: `${q.id}_kisisel`,
          questionId: q.id,
          type: 'kisisel',
          ders: q.ders || 'Genel',
          konu: q.konu || 'Genel',
          text: q.kisiselNot,
          date: q.tarih || q.olusturmaTarihi || 'Tarih yok',
          question: q,
        });
      }

      // Voice notes array
      if (q.voiceNotes && Array.isArray(q.voiceNotes)) {
        q.voiceNotes.forEach((vn, idx) => {
          if (vn.text && vn.text.trim().length > 0) {
            list.push({
              id: vn.id || `${q.id}_vn_${idx}`,
              questionId: q.id,
              type: 'voice',
              ders: q.ders || 'Genel',
              konu: q.konu || 'Genel',
              text: vn.text,
              date: vn.date || q.tarih || q.olusturmaTarihi || 'Tarih yok',
              question: q,
              voiceNoteId: vn.id,
            });
          }
        });
      }
    });

    return list;
  }, [questions]);

  // Unique lessons list from notes & default lessons
  const availableLessons = useMemo(() => {
    const set = new Set<string>();
    allNotes.forEach((n) => {
      if (n.ders) set.add(n.ders);
    });
    COMMON_LESSONS.forEach((l) => set.add(l));
    return Array.from(set);
  }, [allNotes]);

  // Unique topics list based on selected lesson
  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    allNotes.forEach((n) => {
      if (selectedDers === 'ALL' || n.ders === selectedDers) {
        if (n.konu) set.add(n.konu);
      }
    });
    return Array.from(set);
  }, [allNotes, selectedDers]);

  // Filter notes based on keyword, ders, and konu
  const filteredNotes = useMemo(() => {
    return allNotes.filter((note) => {
      // Lesson filter
      if (selectedDers !== 'ALL' && note.ders !== selectedDers) {
        return false;
      }
      // Topic filter
      if (selectedKonu !== 'ALL' && note.konu !== selectedKonu) {
        return false;
      }
      // Search query (keyword match)
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.toLowerCase().trim();
        const textMatch = note.text.toLowerCase().includes(query);
        const dersMatch = note.ders.toLowerCase().includes(query);
        const konuMatch = note.konu.toLowerCase().includes(query);
        const ocrMatch = (note.question.ocrMetin || '').toLowerCase().includes(query);

        if (!textMatch && !dersMatch && !konuMatch && !ocrMatch) {
          return false;
        }
      }

      return true;
    });
  }, [allNotes, selectedDers, selectedKonu, searchQuery]);

  const isAllExpanded = useMemo(() => {
    return filteredNotes.length > 0 && filteredNotes.every((n) => expandedNoteIds.has(n.id));
  }, [filteredNotes, expandedNoteIds]);

  const toggleExpandAll = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    if (isAllExpanded) {
      setExpandedNoteIds(new Set());
    } else {
      setExpandedNoteIds(new Set(filteredNotes.map((n) => n.id)));
    }
  };

  // Handle Add New Custom Note directly
  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || !onUpdateQuestions) return;

    const todayStr = new Date().toLocaleDateString('tr-TR');
    const newQuestion: SoruKaydi = {
      id: 'note_' + Date.now(),
      gorselUrl: '',
      ocrMetin: `Not: ${newDers} - ${newKonu || 'Genel Not'}`,
      ders: newDers || 'Genel',
      konu: newKonu.trim() || 'Genel Not',
      hataTuru: 'Dikkat Eksikliği',
      kritikAdimIndex: 0,
      sokratikIpucu: '',
      kisiselNot: newText.trim(),
      cozumAdimlari: [],
      ebbinghausTarihi: new Date().toISOString().split('T')[0],
      olusturmaTarihi: todayStr,
      tarih: todayStr,
      isSaved: true,
    };

    onUpdateQuestions([newQuestion, ...questions]);
    setNewText('');
    setNewKonu('');
    setIsAddModalOpen(false);
  };

  // Handle Delete Note
  const handleDeleteNote = (note: NoteItem) => {
    if (!onUpdateQuestions) return;

    const updatedQuestions = questions.map((q) => {
      if (q.id === note.questionId) {
        if (note.type === 'kisisel') {
          return { ...q, kisiselNot: '' };
        } else if (note.type === 'voice' && q.voiceNotes) {
          return {
            ...q,
            voiceNotes: q.voiceNotes.filter((vn) => vn.id !== note.voiceNoteId),
          };
        }
      }
      return q;
    });

    onUpdateQuestions(updatedQuestions);
  };

  // Handle Save Edited Note
  const handleSaveEditNote = () => {
    if (!editingNote || !onUpdateQuestions) return;

    const updatedQuestions = questions.map((q) => {
      if (q.id === editingNote.questionId) {
        if (editingNote.type === 'kisisel') {
          return { ...q, kisiselNot: editNoteText };
        } else if (editingNote.type === 'voice' && q.voiceNotes) {
          return {
            ...q,
            voiceNotes: q.voiceNotes.map((vn) =>
              vn.id === editingNote.voiceNoteId ? { ...vn, text: editNoteText } : vn
            ),
          };
        }
      }
      return q;
    });

    onUpdateQuestions(updatedQuestions);
    setEditingNote(null);
    setEditNoteText('');
  };

  return (
    <section className="bg-card-bg border border-card-border p-4 sm:p-5 rounded-2xl shadow-xs space-y-4">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">sticky_note_2</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-text-main">
                Kaydedilen Notlarım
              </h3>
              <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-xs font-black px-2.5 py-0.5 rounded-full border border-amber-300/60 dark:border-amber-700/60">
                {filteredNotes.length} Not
              </span>
            </div>
            <p className="text-xs text-text-muted">
              Sorulara eklediğin kişisel ders notları ve özel ders açıklamaları
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="self-start sm:self-auto bg-primary hover:brightness-110 active:scale-95 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <span className="material-symbols-outlined text-base">add</span>
          <span>Hızlı Not Ekle</span>
        </button>
      </div>

      {/* Search Bar & Filters */}
      <div className="space-y-2.5">
        {/* Search Bar */}
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3.5 text-text-muted text-lg pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Notlarda, derslerde veya konularda anahtar kelime ara..."
            className="w-full pl-10 pr-9 py-2.5 bg-surface-container-low border border-card-border rounded-xl text-xs font-medium text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-text-muted hover:text-text-main p-0.5 cursor-pointer text-xs"
              title="Aramayı Temizle"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filters (Ders & Konu Dropdowns / Chips) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Ders Select */}
          <div className="flex items-center gap-2 bg-surface-container-low border border-card-border px-3 py-1.5 rounded-xl">
            <span className="material-symbols-outlined text-text-muted text-base shrink-0">
              menu_book
            </span>
            <span className="text-[11px] font-bold text-text-muted shrink-0">Ders:</span>
            <select
              value={selectedDers}
              onChange={(e) => {
                setSelectedDers(e.target.value);
                setSelectedKonu('ALL');
              }}
              className="w-full bg-transparent text-xs font-bold text-text-main focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tüm Dersler ({allNotes.length})</option>
              {availableLessons.map((l) => {
                const count = allNotes.filter((n) => n.ders === l).length;
                return (
                  <option key={l} value={l}>
                    {l} {count > 0 ? `(${count})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Konu Select */}
          <div className="flex items-center gap-2 bg-surface-container-low border border-card-border px-3 py-1.5 rounded-xl">
            <span className="material-symbols-outlined text-text-muted text-base shrink-0">
              topic
            </span>
            <span className="text-[11px] font-bold text-text-muted shrink-0">Konu:</span>
            <select
              value={selectedKonu}
              onChange={(e) => setSelectedKonu(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-text-main focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tüm Konular</option>
              {availableTopics.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filter Badges Info */}
        {(selectedDers !== 'ALL' || selectedKonu !== 'ALL' || searchQuery.trim()) && (
          <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold">Filtreler:</span>
              {selectedDers !== 'ALL' && (
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                  {selectedDers}
                  <button onClick={() => setSelectedDers('ALL')} className="hover:opacity-70">✕</button>
                </span>
              )}
              {selectedKonu !== 'ALL' && (
                <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                  {selectedKonu}
                  <button onClick={() => setSelectedKonu('ALL')} className="hover:opacity-70">✕</button>
                </span>
              )}
              {searchQuery.trim() && (
                <span className="bg-slate-200 dark:bg-slate-800 text-text-main px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
                  "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="hover:opacity-70">✕</button>
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedDers('ALL');
                setSelectedKonu('ALL');
                setSearchQuery('');
              }}
              className="text-primary font-bold hover:underline cursor-pointer shrink-0"
            >
              Filtreleri Temizle
            </button>
          </div>
        )}
      </div>

      {/* Note Items Accordion List */}
      {filteredNotes.length > 0 ? (
        <div className="space-y-2.5">
          {/* Header bar with expand/collapse all */}
          <div className="flex items-center justify-between px-1 pb-1 border-b border-card-border/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-muted">
                {filteredNotes.length} Not Listeleniyor
              </span>
              {expandedNoteIds.size > 0 && (
                <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  {expandedNoteIds.size} Açık
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={toggleExpandAll}
              className="text-xs font-bold text-primary hover:brightness-110 flex items-center gap-1 cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-base">
                {isAllExpanded ? 'unfold_less' : 'unfold_more'}
              </span>
              <span>{isAllExpanded ? 'Tümünü Daralt' : 'Tümünü Genişlet'}</span>
            </button>
          </div>

          {/* Accordion Cards */}
          <div className="space-y-2.5">
            {filteredNotes.map((note) => {
              const isExpanded = expandedNoteIds.has(note.id);
              const hasAudio = Boolean(
                note.question.sesliNot ||
                (note.question.voiceNotes && note.question.voiceNotes.length > 0)
              );

              return (
                <div
                  key={note.id}
                  className={`bg-surface-container-low border transition-all duration-200 rounded-2xl overflow-hidden shadow-2xs ${
                    isExpanded
                      ? 'border-amber-500/50 dark:border-amber-500/40 bg-card-bg shadow-xs ring-1 ring-amber-500/20'
                      : 'border-card-border hover:border-amber-500/30 hover:bg-surface-container-low/80'
                  }`}
                >
                  {/* Accordion Header (Clickable) */}
                  <button
                    type="button"
                    onClick={() => toggleExpandNote(note.id)}
                    className="w-full text-left p-3 sm:p-3.5 flex items-start justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {/* Type Icon */}
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          note.type === 'voice'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {note.type === 'voice' ? 'mic' : 'sticky_note_2'}
                        </span>
                      </div>

                      {/* Title, Badges & Collapsed Snippet */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-md border border-primary/20 shrink-0">
                            {note.ders}
                          </span>
                          <span className="bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-amber-500/20 truncate max-w-[130px]">
                            {note.konu}
                          </span>

                          {hasAudio && (
                            <span className="bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border border-purple-500/20 flex items-center gap-0.5 shrink-0">
                              <span className="material-symbols-outlined text-[12px]">graphic_eq</span>
                              <span>Ses Kaydı</span>
                            </span>
                          )}
                        </div>

                        {/* Collapsed Snippet */}
                        {!isExpanded && (
                          <p className="text-xs text-text-main font-semibold truncate opacity-90">
                            {note.text}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right Side: Date & Chevron */}
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <span className="text-[10px] font-semibold text-text-muted hidden sm:inline-block">
                        {note.date}
                      </span>
                      <div
                        className={`w-7 h-7 rounded-lg bg-surface-container border border-card-border flex items-center justify-center text-text-muted transition-transform duration-200 ${
                          isExpanded ? 'rotate-180 bg-amber-500/10 text-amber-600 border-amber-500/30' : ''
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">expand_more</span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Accordion Body */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-card-border/40">
                          {/* Date badge for mobile */}
                          <div className="flex items-center justify-between text-[11px] text-text-muted sm:hidden pt-1">
                            <span className="font-bold flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">calendar_today</span>
                              <span>Tarih:</span>
                            </span>
                            <span className="font-semibold">{note.date}</span>
                          </div>

                          {/* Main Note Text */}
                          <div className="bg-surface-container-low/80 border border-card-border/60 p-3 rounded-xl space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-text-muted flex items-center gap-1 mb-1">
                              <span className="material-symbols-outlined text-xs">notes</span>
                              <span>Not Metni:</span>
                            </span>
                            <p className="text-xs sm:text-sm text-text-main font-medium leading-relaxed whitespace-pre-wrap select-text">
                              {note.text}
                            </p>
                          </div>

                          {/* Audio Recording / Voice Notes Player */}
                          {hasAudio && (
                            <div className="bg-purple-500/5 border border-purple-500/20 p-3 rounded-xl space-y-2">
                              <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                                <span className="material-symbols-outlined text-base">volume_up</span>
                                <span className="text-xs font-extrabold">Ses Kayıtları & Anlatımlar</span>
                              </div>

                              {/* Primary Audio Player if sesliNot exists */}
                              {note.question.sesliNot && (
                                <div className="space-y-1">
                                  <span className="text-[10px] text-text-muted font-bold block">Sorunun Ses Kaydı:</span>
                                  <audio
                                    controls
                                    src={note.question.sesliNot}
                                    className="w-full h-9 rounded-lg border border-purple-500/20 focus:outline-none"
                                  />
                                </div>
                              )}

                              {/* Voice Notes List if array exists */}
                              {note.question.voiceNotes && note.question.voiceNotes.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <span className="text-[10px] text-text-muted font-bold block">Kayıtlı Sesli Notlar:</span>
                                  <div className="space-y-1.5">
                                    {note.question.voiceNotes.map((vn, idx) => (
                                      <div
                                        key={vn.id || idx}
                                        className="bg-card-bg border border-purple-500/15 p-2 rounded-lg text-xs space-y-0.5"
                                      >
                                        <div className="flex justify-between items-center text-[10px] text-text-muted font-semibold">
                                          <span>Sesli Not #{idx + 1}</span>
                                          <span>{vn.date}</span>
                                        </div>
                                        <p className="text-xs text-text-main font-medium">{vn.text}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Question Image or Context Snippet */}
                          {note.question && (
                            <div className="flex items-center gap-3 bg-card-bg/60 border border-card-border/50 p-2.5 rounded-xl">
                              {note.question.gorselUrl ? (
                                <img
                                  src={note.question.gorselUrl}
                                  alt="Soru Görseli"
                                  className="w-12 h-12 rounded-lg object-cover border border-card-border shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-surface-container border border-card-border flex items-center justify-center shrink-0 text-text-muted">
                                  <span className="material-symbols-outlined text-lg">help_outline</span>
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-bold text-text-muted block">İlgili Soru İçeriği:</span>
                                <p className="text-xs text-text-main truncate font-semibold">
                                  {note.question.ocrMetin || 'Soru metni bulunamadı'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Footer Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-card-border/40 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectQuestion(note.question);
                                setActiveTab('solution');
                              }}
                              className="bg-primary/10 hover:bg-primary/20 text-primary font-extrabold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <span className="material-symbols-outlined text-base">visibility</span>
                              <span>Soruyu Gör</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNote(note);
                                  setEditNoteText(note.text);
                                }}
                                className="bg-surface-container hover:bg-surface-container/80 text-text-main font-bold px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1 border border-card-border"
                                title="Notu Düzenle"
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                                <span className="hidden sm:inline">Düzenle</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note)}
                                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1 border border-rose-500/20"
                                title="Notu Sil"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                                <span className="hidden sm:inline">Sil</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-surface-container-low rounded-xl border border-dashed border-card-border space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-2xl">event_note</span>
          </div>
          <div>
            <p className="font-extrabold text-sm text-text-main">
              {searchQuery || selectedDers !== 'ALL' || selectedKonu !== 'ALL'
                ? 'Aradığınız kriterlere uygun not bulunamadı'
                : 'Henüz kaydedilmiş bir notunuz yok'}
            </p>
            <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
              Soru çözümlerinde soru detayına özel not ekleyebilir veya yukarıdaki "+ Hızlı Not Ekle" butonuyla yeni not oluşturabilirsiniz.
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Hızlı Not Ekle</span>
          </button>
        </div>
      )}

      {/* Add New Note Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card-bg border border-card-border w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500 text-xl">edit_note</span>
                <h3 className="font-extrabold text-base text-text-main">Yeni Ders Notu Ekle</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-text-muted hover:text-text-main p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-3">
              {/* Ders Selection */}
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Ders Seçin:</label>
                <select
                  value={newDers}
                  onChange={(e) => setNewDers(e.target.value)}
                  className="w-full bg-surface-container-low border border-card-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-primary cursor-pointer"
                >
                  {COMMON_LESSONS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              {/* Konu Input */}
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Konu Adı:</label>
                <input
                  type="text"
                  value={newKonu}
                  onChange={(e) => setNewKonu(e.target.value)}
                  placeholder="Örn: Türev, Paragrafta Anlam, Fizik Formülü vb."
                  className="w-full bg-surface-container-low border border-card-border rounded-xl px-3 py-2 text-xs font-medium text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
                />
              </div>

              {/* Note Text Area */}
              <div>
                <label className="block text-xs font-bold text-text-muted mb-1">Notunuz:</label>
                <textarea
                  rows={4}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Unutmaman gereken kritik kuralı, püf noktayı veya formülü yaz..."
                  className="w-full bg-surface-container-low border border-card-border rounded-xl px-3 py-2 text-xs font-medium text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted resize-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text-main bg-surface-container-low rounded-xl cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={!newText.trim()}
                  className="px-4 py-2 text-xs font-extrabold bg-primary hover:brightness-110 text-white rounded-xl disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {editingNote && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card-bg border border-card-border w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">edit</span>
                <h3 className="font-extrabold text-base text-text-main">
                  Notu Düzenle ({editingNote.ders} - {editingNote.konu})
                </h3>
              </div>
              <button
                onClick={() => setEditingNote(null)}
                className="text-text-muted hover:text-text-main p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <textarea
                rows={4}
                value={editNoteText}
                onChange={(e) => setEditNoteText(e.target.value)}
                className="w-full bg-surface-container-low border border-card-border rounded-xl px-3 py-2 text-xs font-medium text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted resize-none"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="px-4 py-2 text-xs font-bold text-text-muted hover:text-text-main bg-surface-container-low rounded-xl cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditNote}
                  disabled={!editNoteText.trim()}
                  className="px-4 py-2 text-xs font-extrabold bg-primary hover:brightness-110 text-white rounded-xl disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  Değişiklikleri Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
