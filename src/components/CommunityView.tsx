import React, { useState, useEffect } from 'react';
import { ToplulukSoru, Kullanici, ToplulukCevap } from '../types';
import { formatRelativeTime } from '../lib/dateUtils';
import { getCommunityAiAnswerService } from '../lib/geminiClient';
import { FormattedMathText } from './FormattedMathText';
import { db, auth } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore';

interface CommunityViewProps {
  posts: ToplulukSoru[];
  user: Kullanici;
  onAddPost: (post: ToplulukSoru) => void;
  onToggleLike: (id: string) => void;
}

export const CommunityView: React.FC<CommunityViewProps> = ({
  posts,
  user,
  onAddPost,
  onToggleLike,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Hepsi');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAskModalOpen, setIsAskModalOpen] = useState<boolean>(false);
  const [isSubmittingAi, setIsSubmittingAi] = useState<boolean>(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  // Comment input per post
  const [userCommentInputs, setUserCommentInputs] = useState<{ [postId: string]: string }>({});
  const [isGeneratingAiForPost, setIsGeneratingAiForPost] = useState<{ [postId: string]: boolean }>({});

  // Local state for answers dynamically added to posts
  const [localPosts, setLocalPosts] = useState<ToplulukSoru[]>(posts);

  useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  // Real-time listener directly on the Firestore 'community' collection so EVERY question from EVERY user appears immediately
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'community'),
      (snap) => {
        if (!snap.empty) {
          const list: ToplulukSoru[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ToplulukSoru);
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setLocalPosts(list);
        }
      },
      (err) => {
        console.warn('CommunityView direct Firestore listener notice:', err);
      }
    );
    return () => unsub();
  }, []);

  // Re-render tick every 30 seconds to refresh relative timestamps dynamically
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Helper to persist updated post to Firestore so everyone sees it permanently
  const syncPostToFirestore = async (updatedPost: ToplulukSoru) => {
    try {
      const cleanPost = JSON.parse(JSON.stringify(updatedPost));
      await setDoc(doc(db, 'community', updatedPost.id), cleanPost, { merge: true });
    } catch (err) {
      console.warn('Community post sync error:', err);
    }
  };

  // New Question Form state
  const [newSubject, setNewSubject] = useState<string>('Matematik');
  const [newText, setNewText] = useState<string>('');
  const [askTarget, setAskTarget] = useState<'ai_and_community' | 'community_only'>('ai_and_community');

  const categories = ['Hepsi', 'Matematik', 'Fizik', 'Türkçe', 'Biyoloji', 'Kimya', 'Tarih'];

  const filteredPosts = localPosts.filter((post) => {
    const matchesCategory = selectedCategory === 'Hepsi' || post.ders === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      post.soruMetni.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.ders.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Create new post (with AI answer or community-only option)
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim() || isSubmittingAi) return;

    const isAiTarget = askTarget === 'ai_and_community';
    let aiAnswerText = '';

    if (isAiTarget) {
      setIsSubmittingAi(true);

      const userApiKey = (typeof localStorage !== 'undefined' && localStorage.getItem('gemini_api_key')) || '';
      try {
        aiAnswerText = await getCommunityAiAnswerService({
          ders: newSubject,
          soruMetni: newText,
          userApiKey,
        });
      } catch (err) {
        console.error('Community AI answer error:', err);
        aiAnswerText = `💡 ${newSubject} sorunuz için pedagojik adımlar hazırlandı. Çözüm adımlarını sırasıyla takip ederek işlem yapabilirsiniz.`;
      } finally {
        setIsSubmittingAi(false);
      }
    }

    const now = Date.now();
    const currentUid = user.id || (auth.currentUser ? auth.currentUser.uid : 'user');
    const newPost: ToplulukSoru = {
      id: `c_${now}`,
      userId: currentUid,
      yazarAd: user.ad || 'Öğrenci',
      yazarAvatar: user.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
      createdAt: now,
      zaman: 'Az önce',
      ders: newSubject,
      soruMetni: newText,
      cevapSayisi: isAiTarget ? 1 : 0,
      hasAiAnswer: isAiTarget,
      begeniSayisi: 1,
      isLiked: true,
      askTarget: askTarget,
      cevaplar: isAiTarget
        ? [
            {
              id: `ans_${now}`,
              yazarAd: 'Eğitim Koçum AI',
              avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=EduMindCoachAI&backgroundColor=6366f1',
              metin: aiAnswerText,
              isAi: true,
              createdAt: now,
              zaman: 'Az önce',
            },
          ]
        : [],
    };

    onAddPost(newPost);
    syncPostToFirestore(newPost);
    setNewText('');
    setIsAskModalOpen(false);
  };

  // Request new AI Answer for an existing post
  const handleRequestAiAnswer = async (postId: string, postDers: string, postSoruMetni: string) => {
    if (isGeneratingAiForPost[postId]) return;

    setIsGeneratingAiForPost((prev) => ({ ...prev, [postId]: true }));
    const userApiKey = (typeof localStorage !== 'undefined' && localStorage.getItem('gemini_api_key')) || '';

    try {
      const aiText = await getCommunityAiAnswerService({
        ders: postDers,
        soruMetni: postSoruMetni,
        userApiKey,
      });

      const now = Date.now();
      const newAiCevap: ToplulukCevap = {
        id: `ans_ai_${now}`,
        yazarAd: 'Eğitim Koçum AI',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=EduMindCoachAI&backgroundColor=6366f1',
        metin: aiText,
        isAi: true,
        createdAt: now,
        zaman: 'Az önce',
      };

      setLocalPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const updatedCevaplar = [...(p.cevaplar || []), newAiCevap];
            const updated = {
              ...p,
              cevaplar: updatedCevaplar,
              cevapSayisi: updatedCevaplar.length,
              hasAiAnswer: true,
            };
            syncPostToFirestore(updated);
            return updated;
          }
          return p;
        })
      );
      setExpandedPostId(postId);
    } catch (err) {
      console.error('Request AI Answer error:', err);
    } finally {
      setIsGeneratingAiForPost((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Add user comment to a post (Community only)
  const handleAddUserComment = (postId: string) => {
    const text = (userCommentInputs[postId] || '').trim();
    if (!text) return;

    const now = Date.now();
    const newComment: ToplulukCevap = {
      id: `ans_user_${now}`,
      yazarAd: user.ad || 'Öğrenci',
      avatar: user.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
      metin: text,
      isAi: false,
      createdAt: now,
      zaman: 'Az önce',
    };

    setLocalPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const updatedCevaplar = [...(p.cevaplar || []), newComment];
          const updated = {
            ...p,
            cevaplar: updatedCevaplar,
            cevapSayisi: updatedCevaplar.length,
          };
          syncPostToFirestore(updated);
          return updated;
        }
        return p;
      })
    );

    setUserCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    setExpandedPostId(postId);
  };

  // Add user comment AND trigger AI answer to that comment
  const handleAddUserCommentWithAi = async (postId: string, postDers: string, postSoruMetni: string) => {
    const text = (userCommentInputs[postId] || '').trim();
    if (!text || isGeneratingAiForPost[postId]) return;

    const now = Date.now();
    const newComment: ToplulukCevap = {
      id: `ans_user_${now}`,
      yazarAd: user.ad || 'Öğrenci',
      avatar: user.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=DegreeChampion&backgroundColor=6366f1',
      metin: text,
      isAi: false,
      createdAt: now,
      zaman: 'Az önce',
    };

    let intermediateUpdatedPost: ToplulukSoru | null = null;

    // 1. Add user comment first
    setLocalPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const updatedCevaplar = [...(p.cevaplar || []), newComment];
          const updated = {
            ...p,
            cevaplar: updatedCevaplar,
            cevapSayisi: updatedCevaplar.length,
          };
          intermediateUpdatedPost = updated;
          syncPostToFirestore(updated);
          return updated;
        }
        return p;
      })
    );

    setUserCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    setExpandedPostId(postId);

    // 2. Request AI answer for user comment
    setIsGeneratingAiForPost((prev) => ({ ...prev, [postId]: true }));
    const userApiKey = (typeof localStorage !== 'undefined' && localStorage.getItem('gemini_api_key')) || '';

    try {
      const combinedPrompt = `${postSoruMetni}\n\nÖğrenci Sorusu / Yorumu: ${text}`;
      const aiAnswerText = await getCommunityAiAnswerService({
        ders: postDers,
        soruMetni: combinedPrompt,
        userApiKey,
      });

      const aiNow = Date.now() + 1;
      const newAiCevap: ToplulukCevap = {
        id: `ans_ai_${aiNow}`,
        yazarAd: 'Eğitim Koçum AI',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=EduMindCoachAI&backgroundColor=6366f1',
        metin: aiAnswerText,
        isAi: true,
        createdAt: aiNow,
        zaman: 'Az önce',
      };

      setLocalPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const updatedCevaplar = [...(p.cevaplar || []), newAiCevap];
            const finalUpdated = {
              ...p,
              cevaplar: updatedCevaplar,
              cevapSayisi: updatedCevaplar.length,
              hasAiAnswer: true,
            };
            syncPostToFirestore(finalUpdated);
            return finalUpdated;
          }
          return p;
        })
      );
    } catch (err) {
      console.error('AI answer to comment error:', err);
    } finally {
      setIsGeneratingAiForPost((prev) => ({ ...prev, [postId]: false }));
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Compact Bar */}
      <section className="bg-card-bg px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-card-border shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">forum</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-black text-text-main truncate">
              Topluluk & Soru Paylaşımı
            </h2>
            <p className="text-[11px] text-text-muted font-medium truncate hidden xs:block">
              Sorularını paylaş, akranlarınla tartış & AI pedagojik çözüm al.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAskModalOpen(true)}
          className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-xs shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-base">add</span>
          <span>Soru Sor</span>
        </button>
      </section>

      {/* Filter and Search Bar */}
      <section className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Topluluk sorularında ve konularda ara..."
            className="w-full bg-surface-container-low border border-card-border rounded-2xl py-3 pl-11 pr-4 text-xs sm:text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-1 rounded-full cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border ${
                selectedCategory === cat
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-card-bg text-text-muted hover:text-text-main border-card-border hover:border-primary/40'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Posts List */}
      <section className="space-y-4">
        {filteredPosts.length === 0 ? (
          <div className="bg-card-bg p-8 rounded-3xl border border-dashed border-card-border text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-container-low text-text-muted flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">chat_bubble_outline</span>
            </div>
            <h3 className="font-black text-sm text-text-main">Henüz soru bulunamadı</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Bu kategoride henüz bir soru paylaşılmamış. İlk soruyu sen sorarak tartışmayı başlatabilirsin!
            </p>
            <button
              onClick={() => setIsAskModalOpen(true)}
              className="px-4 py-2 bg-primary/10 text-primary font-black text-xs rounded-xl hover:bg-primary/20 transition-colors cursor-pointer"
            >
              İlk Soruyu Sor
            </button>
          </div>
        ) : (
          filteredPosts.map((post) => {
            const isExpanded = expandedPostId === post.id;
            const isGeneratingAi = isGeneratingAiForPost[post.id];

            return (
              <article
                key={post.id}
                className="bg-card-bg p-5 sm:p-6 rounded-3xl border border-card-border shadow-xs hover:border-primary/30 transition-all space-y-4"
              >
                {/* Post Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={post.yazarAvatar}
                      alt={post.yazarAd}
                      className="w-10 h-10 rounded-full border border-card-border object-cover bg-surface-container-low shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-xs sm:text-sm text-text-main">{post.yazarAd}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-black border border-primary/20">
                          {post.ders}
                        </span>
                        {post.hasAiAnswer && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/20 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs">smart_toy</span>
                            <span>AI Yanıtlı</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-muted font-medium">
                        {formatRelativeTime(post.createdAt, post.zaman)}
                      </span>
                    </div>
                  </div>

                  {/* Ask Target Badge */}
                  {post.askTarget === 'community_only' && (
                    <span className="text-[10px] text-text-muted bg-surface-container-low px-2 py-1 rounded-lg font-bold shrink-0">
                      👥 Yalnızca Topluluk
                    </span>
                  )}
                </div>

                {/* Question Body */}
                <div className="text-xs sm:text-sm text-text-main font-medium leading-relaxed">
                  <FormattedMathText text={post.soruMetni} />
                </div>

                {/* Post Actions Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-card-border gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {/* Like Button */}
                    <button
                      onClick={() => {
                        onToggleLike(post.id);
                        const isLiked = !post.isLiked;
                        const begeniSayisi = isLiked ? (post.begeniSayisi || 0) + 1 : Math.max(0, (post.begeniSayisi || 0) - 1);
                        syncPostToFirestore({ ...post, isLiked, begeniSayisi });
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                        post.isLiked
                          ? 'bg-rose-500/10 text-rose-500'
                          : 'bg-surface-container-low text-text-muted hover:text-text-main'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-base ${post.isLiked ? 'fill-1' : ''}`}>
                        favorite
                      </span>
                      <span>{post.begeniSayisi || 0}</span>
                    </button>

                    {/* Expand Comments Button */}
                    <button
                      onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-surface-container-low text-text-muted hover:text-text-main transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">chat_bubble</span>
                      <span>{post.cevapSayisi || (post.cevaplar ? post.cevaplar.length : 0)} Yanıt</span>
                      <span className="material-symbols-outlined text-xs">
                        {isExpanded ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                  </div>

                  {/* Ask AI for this Question Button */}
                  {!post.hasAiAnswer && (
                    <button
                      onClick={() => handleRequestAiAnswer(post.id, post.ders, post.soruMetni)}
                      disabled={isGeneratingAi}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs border border-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingAi ? (
                        <>
                          <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                          <span>AI Çözüyor...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-xs">smart_toy</span>
                          <span>Yapay Zekadan Çözüm İste</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded Answers & Comments Section */}
                {isExpanded && (
                  <div className="space-y-4 pt-3 border-t border-card-border animate-fadeIn">
                    {/* Answers List */}
                    <div className="space-y-3">
                      {(!post.cevaplar || post.cevaplar.length === 0) ? (
                        <p className="text-xs text-text-muted italic py-1">Henüz yanıt yazılmamış. İlk yanıtı sen yaz!</p>
                      ) : (
                        post.cevaplar.map((c) => (
                          <div
                            key={c.id}
                            className={`p-3 sm:p-3.5 rounded-2xl space-y-1.5 min-w-0 max-w-full overflow-hidden break-words ${
                              c.isAi
                                ? 'bg-primary/5 border border-primary/20 text-text-main'
                                : 'bg-surface-container-low border border-card-border text-text-main'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={c.avatar}
                                  alt={c.yazarAd}
                                  className="w-6 h-6 rounded-full border border-card-border object-cover bg-card-bg shrink-0"
                                />
                                <span className="font-extrabold text-xs text-text-main flex items-center gap-1 truncate">
                                  {c.yazarAd}
                                  {c.isAi && (
                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-black shrink-0">
                                      BOT
                                    </span>
                                  )}
                                </span>
                              </div>
                              <span className="text-[10px] text-text-muted font-medium shrink-0">
                                {formatRelativeTime(c.createdAt, c.zaman)}
                              </span>
                            </div>
                            <div className="text-xs text-text-main font-medium pl-2 sm:pl-8 leading-relaxed min-w-0 max-w-full overflow-hidden break-words [word-break:break-word]">
                              <FormattedMathText text={c.metin} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Comment Input Form */}
                    <div className="space-y-2 pt-1">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={userCommentInputs[post.id] || ''}
                          onChange={(e) =>
                            setUserCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddUserComment(post.id);
                            }
                          }}
                          placeholder="Bu soruya bir cevap veya yorum yaz..."
                          className="flex-1 min-w-0 bg-surface-container-low border border-card-border focus:border-primary rounded-xl px-3 py-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none font-medium"
                        />

                        <div className="flex items-center gap-1.5 justify-end shrink-0">
                          {/* Direct Submit (Student only) */}
                          <button
                            type="button"
                            onClick={() => handleAddUserComment(post.id)}
                            disabled={!(userCommentInputs[post.id] || '').trim()}
                            className="flex-1 sm:flex-initial px-3 py-2 bg-surface-container-low hover:bg-primary/10 text-text-main hover:text-primary font-black text-xs rounded-xl disabled:opacity-50 transition-all cursor-pointer border border-card-border flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">send</span>
                            <span>Yanıtla</span>
                          </button>

                          {/* Submit & Request AI Evaluation for this Comment */}
                          <button
                            type="button"
                            onClick={() => handleAddUserCommentWithAi(post.id, post.ders, post.soruMetni)}
                            disabled={!(userCommentInputs[post.id] || '').trim() || isGeneratingAi}
                            className="flex-1 sm:flex-initial px-3 py-2 bg-primary text-white font-black text-xs rounded-xl disabled:opacity-50 hover:bg-primary-hover transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1"
                            title="Cevabını gönder ve Yapay Zeka Koçundan yorum al"
                          >
                            <span className="material-symbols-outlined text-sm">smart_toy</span>
                            <span>AI + Yanıt</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {/* Ask Question Modal */}
      {isAskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card-bg w-full max-w-lg rounded-3xl p-6 border border-card-border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar relative">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">add_comment</span>
                </div>
                <div>
                  <h3 className="font-black text-base text-text-main">Topluluğa Soru Sor</h3>
                  <p className="text-xs text-text-muted font-medium">Sorunu paylaş, diğer öğrencilerden ve AI'dan destek al</p>
                </div>
              </div>
              <button
                onClick={() => setIsAskModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low text-text-muted hover:text-text-main flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-4">
              {/* Subject Selection */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-text-main block">Ders Seçin:</label>
                <select
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full bg-surface-container-low border border-card-border rounded-xl p-3 text-xs font-bold text-text-main focus:outline-none focus:border-primary"
                >
                  <option value="Matematik">Matematik</option>
                  <option value="Fizik">Fizik</option>
                  <option value="Türkçe">Türkçe / Edebiyat</option>
                  <option value="Biyoloji">Biyoloji</option>
                  <option value="Kimya">Kimya</option>
                  <option value="Tarih">Tarih</option>
                  <option value="Coğrafya">Coğrafya</option>
                  <option value="Felsefe">Felsefe</option>
                  <option value="Genel Rehberlik">Genel Rehberlik</option>
                </select>
              </div>

              {/* Target Selector: AI or Community Only */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-text-main block">Cevap Tercihi:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAskTarget('ai_and_community')}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col gap-1 ${
                      askTarget === 'ai_and_community'
                        ? 'bg-primary/10 border-primary text-primary shadow-xs'
                        : 'bg-surface-container-low border-card-border text-text-muted hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs text-text-main">
                      <span className="material-symbols-outlined text-base text-primary">auto_awesome</span>
                      <span>AI + Topluluk</span>
                    </div>
                    <span className="text-[11px] text-text-muted font-medium leading-tight">
                      Sorunu sorar sormaz Eğitim Koçum AI ilk çözümü yazar, arkadaşlar da katkı verir.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAskTarget('community_only')}
                    className={`p-3 rounded-2xl text-left border transition-all cursor-pointer flex flex-col gap-1 ${
                      askTarget === 'community_only'
                        ? 'bg-primary/10 border-primary text-primary shadow-xs'
                        : 'bg-surface-container-low border-card-border text-text-muted hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs text-text-main">
                      <span className="material-symbols-outlined text-base text-primary">groups</span>
                      <span>Sadece Topluluk</span>
                    </div>
                    <span className="text-[11px] text-text-muted font-medium leading-tight">
                      Yalnızca diğer öğrenciler ve akranlar yanıt yazar.
                    </span>
                  </button>
                </div>
              </div>

              {/* Question Textarea */}
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-text-main block">Sorunuz veya Takıldığınız Nokta:</label>
                <textarea
                  required
                  rows={4}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Sorunuzun metnini, takıldığınız şıkkı veya merak ettiğiniz konuyu ayrıntılı yazın..."
                  className="w-full bg-surface-container-low border border-card-border focus:border-primary rounded-xl p-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none resize-none font-medium"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-card-border">
                <button
                  type="button"
                  onClick={() => setIsAskModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-card-border text-xs font-bold text-text-muted hover:text-text-main cursor-pointer"
                >
                  İptal
                </button>

                <button
                  type="submit"
                  disabled={!newText.trim() || isSubmittingAi}
                  className="px-5 py-2.5 rounded-xl bg-primary text-white font-black text-xs hover:bg-primary-hover shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingAi ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      <span>AI Cevabı Hazırlanıyor...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">send</span>
                      <span>Soruyu Paylaş</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
