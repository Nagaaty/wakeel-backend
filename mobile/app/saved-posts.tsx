import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, Share, Modal, KeyboardAvoidingView, Platform, TextInput,
  ActivityIndicator, RefreshControl, StatusBar, I18nManager,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/hooks/useTheme';
import { forumAPI } from '../src/services/api';
import HashtagText from '../src/components/HashtagText';
import { PostCard } from '../src/components/forum/PostCard';
import { useAuth } from '../src/hooks/useAuth';
import { InitialsAvatar } from '../src/components/ui';

I18nManager.forceRTL(true);

const GOLD = '#C8A84B';

function timeAgo(iso: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

/** Category color map */
const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  'جنائي':    { bg: '#FEE2E2', text: '#DC2626' },
  'تجاري':   { bg: '#DBEAFE', text: '#1D4ED8' },
  'عقاري':   { bg: '#D1FAE5', text: '#065F46' },
  'أسرة':    { bg: '#FDE8FF', text: '#9333EA' },
  'عمالي':   { bg: '#FEF3C7', text: '#B45309' },
  'إداري':   { bg: '#E0F2FE', text: '#0369A1' },
  'دستوري':  { bg: '#F3F4F6', text: '#374151' },
  'الكل':    { bg: '#F3F4F6', text: '#6B7280' },
};
function catStyle(cat: string) {
  return CAT_COLORS[cat] || { bg: '#F3F4F6', text: '#6B7280' };
}

export default function SavedPosts() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unsavingIds, setUnsavingIds] = useState<Set<number>>(new Set());

  // Interaction States
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [dislikedPosts, setDislikedPosts] = useState<Set<number>>(new Set());

  // Comment Modal State
  const [commentPost, setCommentPost]   = useState<any | null>(null);
  const [answers, setAnswers]           = useState<any[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answerText, setAnswerText]       = useState('');
  const [postingAnswer, setPostingAnswer] = useState(false);
  const [replyingTo, setReplyingTo]     = useState<{ name: string; answerId: number } | null>(null);
  const [likedAnswers, setLikedAnswers] = useState<Set<number>>(new Set());
  const [dislikedAnswers, setDislikedAnswers] = useState<Set<number>>(new Set());

  // Share Modal State
  const [sharingPost, setSharingPost]     = useState<any | null>(null);
  const [repostText, setRepostText]       = useState('');
  const [postingRepost, setPostingRepost] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res: any = await forumAPI.getSavedPosts();
      setPosts(res?.questions || []);
    } catch {
      // Graceful fail — show empty state
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUnsave = async (id: number) => {
    setUnsavingIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setPosts(prev => prev.filter(p => p.id !== id));
      setUnsavingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, 400);
    try { await forumAPI.savePost(id); } catch {}
  };

  const handleLike = async (id: number) => {
    const isLiked = likedPosts.has(id);
    const wasDisliked = dislikedPosts.has(id);

    setPosts(prev => prev.map(p => {
      if (p.id !== id) return p;
      let newLikes = (p.likes_count || 0);
      let newDislikes = (p.dislikes_count || 0);
      if (isLiked) newLikes = Math.max(0, newLikes - 1);
      else {
        newLikes++;
        if (wasDisliked) newDislikes = Math.max(0, newDislikes - 1);
      }
      return { ...p, likes_count: newLikes, dislikes_count: newDislikes };
    }));

    if (isLiked) {
      setLikedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
    } else {
      setLikedPosts(prev => new Set(prev).add(id));
      if (wasDisliked) setDislikedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
    try { await forumAPI.likeQuestion(id); } catch {}
  };

  const handleDislike = async (id: number) => {
    const isDisliked = dislikedPosts.has(id);
    const wasLiked = likedPosts.has(id);

    setPosts(prev => prev.map(p => {
      if (p.id !== id) return p;
      let newLikes = p.likes_count || 0;
      let newDislikes = p.dislikes_count || 0;
      if (isDisliked) newDislikes = Math.max(0, newDislikes - 1);
      else {
        newDislikes++;
        if (wasLiked) newLikes = Math.max(0, newLikes - 1);
      }
      return { ...p, likes_count: newLikes, dislikes_count: newDislikes };
    }));

    if (isDisliked) {
      setDislikedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
    } else {
      setDislikedPosts(prev => new Set(prev).add(id));
      if (wasLiked) setLikedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
    try { await forumAPI.dislikePost(id); } catch {}
  };

  const openComments = async (post: any) => {
    setCommentPost(post);
    setAnswers([]);
    setAnswersLoading(true);
    try {
      const res: any = await forumAPI.getAnswers(post.id);
      setAnswers(res.answers || []);
    } catch {} finally { setAnswersLoading(false); }
  };

  const submitAnswer = async () => {
    if (!answerText.trim() || !commentPost || postingAnswer) return;
    const targetReplyId = replyingTo?.answerId ?? null;
    setPostingAnswer(true);
    try {
      const text = replyingTo ? `@${replyingTo.name.replace(/\s+/g, '_')} ${answerText.trim()}` : answerText.trim();
      await forumAPI.createAnswer(commentPost.id, text, targetReplyId ?? undefined);
      setAnswerText('');
      setReplyingTo(null);
      const res: any = await forumAPI.getAnswers(commentPost.id);
      setAnswers(res.answers || []);
      setPosts(prev => prev.map(p => p.id === commentPost.id ? { ...p, answer_count: (p.answer_count || 0) + 1 } : p));
    } catch {} finally { setPostingAnswer(false); }
  };

  const handleLikeAnswer = async (answerId: number) => {
    const isLiked = likedAnswers.has(answerId);
    if(isLiked) { setLikedAnswers(prev => { const n = new Set(prev); n.delete(answerId); return n; }); }
    else { setLikedAnswers(prev => new Set(prev).add(answerId)); }
    try { await forumAPI.likeAnswer(answerId); } catch {}
  };
  
  const handleDislikeAnswer = async (answerId: number) => {
    const isDisliked = dislikedAnswers.has(answerId);
    if(isDisliked) { setDislikedAnswers(prev => { const n = new Set(prev); n.delete(answerId); return n; }); }
    else { setDislikedAnswers(prev => new Set(prev).add(answerId)); }
    try { await forumAPI.dislikeAnswer(answerId); } catch {}
  };

  const handleNativeShare = async (post: any) => {
    try {
      const url = `https://wakeel.app/post/${post.id}`
      const message = `✨ ${post.asked_by || 'مستخدم'}\n💡 ${post.question || 'شارك في مجتمع وكيل'}\n\n🔗 ألقِ نظرة على وكيل: ${url}`;
      await Share.share({ message, title: 'Wakeel App' });
    } catch (e) {}
  };

  const handleShare = (post: any) => {
    setRepostText('');        
    setSharingPost(post);      
  };

  const submitRepost = async () => {
    if (!sharingPost || postingRepost) return;
    setPostingRepost(true);
    try {
      const origDataOfShared = sharingPost.original_post_data
        ? (typeof sharingPost.original_post_data === 'string'
            ? JSON.parse(sharingPost.original_post_data)
            : sharingPost.original_post_data)
        : null;
      const original_data = origDataOfShared ? { original_post_id: sharingPost.original_post_id, original_post_data: origDataOfShared } : {
        original_post_id: sharingPost.id,
        original_post_data: {
          authorName:   sharingPost.asked_by        || 'مستخدم',
          authorAvatar: sharingPost.user_avatar_url || null,
          authorRole:   sharingPost.user_role       || null,
          authorId:     sharingPost.user_id         || null,
          category:     sharingPost.category        || '',
          question:     sharingPost.question        || '',
          image_url:    sharingPost.image_url       || null,
        },
      };

      const createRes: any = await forumAPI.createQuestion({
        question: repostText || 'مشاركة',
        category: 'الكل',
        anonymous: false,
        ...original_data
      });
      const newRepostId = createRes?.question?.id || createRes?.data?.question?.id || null;
      forumAPI.sharePost(sharingPost.id, newRepostId ? { repost_id: newRepostId } : undefined).catch(console.error);

      setPosts(prev => prev.map(p =>
        p.id === sharingPost.id ? { ...p, shares_count: (p.shares_count || 0) + 1 } : p
      ));
      setSharingPost(null);
    } catch {} finally { setPostingRepost(false); }
  };

  const renderItem = ({ item: p, index }: { item: any; index: number }) => {
    const isBusy = unsavingIds.has(p.id);

    return (
      <View style={{ marginTop: index === 0 ? 8 : 0, opacity: isBusy ? 0.5 : 1 }}>
        <PostCard
          p={p}
          C={C}
          user={user}
          isRTL={true}
          liked={likedPosts.has(p.id)}
          disliked={dislikedPosts.has(p.id)}
          saved={!isBusy}
          onLike={handleLike}
          onDislike={handleDislike}
          onSave={handleUnsave}
          onComment={() => openComments(p)}
          catStyle={catStyle}
          onShare={() => handleShare(p)}
          onNativeShare={() => handleNativeShare(p)}
          onMediaTap={() => {}}
          onMenuTap={() => {}}
          onReactorsTap={() => {}}
        />
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingBottom: 14,
        paddingHorizontal: 16,
        backgroundColor: C.surface,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
      }}>
        {/* Gold accent line */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: GOLD + '40' }} />

        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, fontFamily: 'Cairo-Bold' }}>
            المنشورات المحفوظة
          </Text>
          {posts.length > 0 && (
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {posts.length} منشور محفوظ
            </Text>
          )}
        </View>

        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: C.card,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: C.border,
          }}
        >
          <Text style={{ fontSize: 20, color: C.text, lineHeight: 24 }}>‹</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={GOLD} size="large" />
          <Text style={{ color: C.muted, fontSize: 14 }}>جاري التحميل…</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 }}>
          <View style={{
            width: 90, height: 90, borderRadius: 45,
            backgroundColor: GOLD + '15', alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: GOLD + '30',
          }}>
            <Text style={{ fontSize: 44 }}>🔖</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center' }}>
            لا توجد منشورات محفوظة
          </Text>
          <Text style={{ fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 22 }}>
            احفظ المنشورات المفيدة من منتدى وكيل للرجوع إليها لاحقاً
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              marginTop: 8, backgroundColor: GOLD, borderRadius: 12,
              paddingHorizontal: 28, paddingVertical: 13,
            }}
          >
            <Text style={{ color: '#000', fontWeight: '800', fontSize: 15 }}>تصفح المنتدى</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id.toString()}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={GOLD} colors={[GOLD]} />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <Text style={{ textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 16, marginBottom: 4 }}>
              — نهاية المحفوظات —
            </Text>
          }
        />
      )}

      {/* ─── Comment Modal Overlay ─────────────────────────────────────── */}
      <Modal visible={!!commentPost} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCommentPost(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
          {/* Header */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>التعليقات</Text>
            <TouchableOpacity onPress={() => setCommentPost(null)}>
              <Text style={{ fontSize: 16, color: C.muted, fontWeight: '600' }}>إغلاق</Text>
            </TouchableOpacity>
          </View>

          {/* List */}
          <View style={{ flex: 1 }}>
            {answersLoading ? (
              <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={GOLD} /></View>
            ) : (
              <FlatList
                data={answers}
                keyExtractor={(item: any) => String(item.id)}
                contentContainerStyle={{ paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  <>
                    {commentPost && (
                      <View style={{ marginBottom: 16 }}>
                        <PostCard
                          p={commentPost}
                          C={C}
                          user={user}
                          isRTL={true}
                          liked={likedPosts.has(commentPost.id)}
                          disliked={dislikedPosts.has(commentPost.id)}
                          saved={true}
                          onLike={handleLike}
                          onDislike={handleDislike}
                          onSave={() => {}}
                          onComment={() => {}}
                          onShare={() => handleNativeShare(commentPost)}
                          onNativeShare={() => handleNativeShare(commentPost)}
                          onMediaTap={() => {}}
                          onMenuTap={() => {}}
                          onReactorsTap={() => {}}
                          catStyle={catStyle}
                        />
                      </View>
                    )}
                    {answers.length === 0 && (
                      <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ fontSize: 40, marginBottom: 10 }}>💬</Text>
                        <Text style={{ color: C.muted, fontSize: 16 }}>كن أول من يعلق!</Text>
                      </View>
                    )}
                  </>
                }
                renderItem={({ item: a }) => (
                  <View style={{ marginBottom: 16, marginHorizontal: 16, backgroundColor: C.surface, padding: 12, borderRadius: 12 }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <InitialsAvatar name={a.lawyer_name} size={30} gold={GOLD} />
                      <View style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontWeight: '700', color: C.text }}>{a.lawyer_name || 'مستخدم'}</Text>
                        {a.lawyer_role === 'lawyer' && <Text style={{ color: GOLD, fontSize: 10 }}>⚖️</Text>}
                        <Text style={{ color: C.muted, fontSize: 11 }}>{timeAgo(a.created_at)}</Text>
                      </View>
                    </View>
                    <Text style={{ color: C.text, fontSize: 14, textAlign: 'right', marginBottom: 10 }}>{a.answer}</Text>
                    
                    {/* Reply Action */}
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 16 }}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 4, paddingVertical: 2, gap: 2, borderWidth: 1, borderColor: C.border }}>
                        <TouchableOpacity onPress={() => handleLikeAnswer(a.id)} style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 16, backgroundColor: likedAnswers.has(a.id) ? '#FF450018' : 'transparent' }}>
                          <Text style={{ fontSize: 13, color: likedAnswers.has(a.id) ? '#FF4500' : '#818384', fontWeight: '800' }}>▲</Text>
                        </TouchableOpacity>
                        <Text style={{ fontSize: 12, fontWeight: '800', minWidth: 20, textAlign: 'center', color: likedAnswers.has(a.id) ? '#FF4500' : dislikedAnswers.has(a.id) ? '#7193FF' : '#1A1A1A' }}>
                          { (a.likes_count || 0) - (a.dislikes_count || 0) > 0 ? `+${(a.likes_count || 0) - (a.dislikes_count || 0)}` : (a.likes_count || 0) - (a.dislikes_count || 0) }
                        </Text>
                        <TouchableOpacity onPress={() => handleDislikeAnswer(a.id)} style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 16, backgroundColor: dislikedAnswers.has(a.id) ? '#7193FF18' : 'transparent' }}>
                          <Text style={{ fontSize: 13, color: dislikedAnswers.has(a.id) ? '#7193FF' : '#818384', fontWeight: '800' }}>▼</Text>
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity onPress={() => setReplyingTo({ answerId: a.id, name: a.lawyer_name || 'مستخدم' })}>
                        <Text style={{ color: C.muted, fontSize: 13, fontWeight: '600' }}>رد 💬</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </View>

          {/* Input Area */}
          <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 12, paddingBottom: 24 }}>
            {replyingTo && (
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg, padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>الرد على: {replyingTo.name}</Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </TouchableOpacity>
              </View>
            )}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={answerText}
                onChangeText={setAnswerText}
                placeholder="اكتب تعليقاً..."
                placeholderTextColor={C.muted}
                style={{ flex: 1, backgroundColor: C.bg, color: C.text, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, textAlign: 'right', fontSize: 14, borderWidth: 1, borderColor: C.border }}
              />
              <TouchableOpacity onPress={submitAnswer} disabled={!answerText.trim() || postingAnswer}
                style={{ backgroundColor: answerText.trim() ? GOLD : C.border, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}>
                {postingAnswer
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Ionicons name="send" size={18} color="#FFF" />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Share / Repost Modal ────────────────────────────────────────────── */}
      <Modal visible={!!sharingPost} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSharingPost(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
          {/* Header */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface }}>
            <TouchableOpacity onPress={() => { setSharingPost(null); setRepostText(''); }}>
              <Text style={{ color: C.text, fontSize: 16 }}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', fontFamily: 'Cairo-Bold' }}>
              إعادة نشر متقدمة
            </Text>
            <TouchableOpacity onPress={submitRepost} disabled={postingRepost}>
              <Text style={{ color: postingRepost ? C.muted : GOLD, fontSize: 16, fontWeight: '800' }}>
                {postingRepost ? '...' : 'نشر'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, flexDirection: 'row-reverse', gap: 12 }}>
            <InitialsAvatar name={user?.name} size={44} gold={GOLD} />
            <Text style={{ fontWeight: '800', fontSize: 16, color: C.text, marginTop: 10 }}>أنت</Text>
          </View>

          <TextInput
            value={repostText}
            onChangeText={setRepostText}
            placeholder="أضف تعليقك (اختياري)..."
            placeholderTextColor={C.muted}
            multiline
            style={{ paddingHorizontal: 20, paddingTop: 12, fontSize: 18, color: C.text, textAlign: 'right', textAlignVertical: 'top', minHeight: 80 }}
          />

          {/* Quoted Shared Post Preview */}
          {sharingPost && (
            <View style={{
              marginHorizontal: 16, marginTop: 8, marginBottom: 4,
              borderWidth: 1, borderColor: C.border,
              borderRadius: 12, overflow: 'hidden',
            }}>
              {/* Card header */}
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 12, backgroundColor: C.card }}>
                <InitialsAvatar name={sharingPost.asked_by} size={36} gold={GOLD} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, textAlign: 'right' }}>{sharingPost.asked_by || 'مستخدم'}</Text>
                  <Text style={{ color: C.muted, fontSize: 11, textAlign: 'right' }}>{sharingPost.category}</Text>
                </View>
              </View>
              {/* Card body */}
              <View style={{ padding: 12, backgroundColor: C.surface }}>
                <Text style={{ color: C.text, fontSize: 13, lineHeight: 20, textAlign: 'right' }} numberOfLines={4}>
                  {sharingPost.question}
                </Text>
              </View>
              {sharingPost.image_url && (
                <Image source={{ uri: sharingPost.image_url }} style={{ width: '100%', height: 120 }} resizeMode="cover" />
              )}
            </View>
          )}

        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
