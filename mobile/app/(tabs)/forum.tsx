import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { Avatar, Spinner, Btn } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { forumAPI } from '../../src/services/api';
import { useAuth } from '../../src/hooks/useAuth';

export default function ForumTab() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  
  const feedBg = '#EBEDF0'; 

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  // Comment modal state
  const [commentPost, setCommentPost]   = useState<any | null>(null);
  const [answers, setAnswers]           = useState<any[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answerText, setAnswerText]     = useState('');
  const [postingAnswer, setPostingAnswer] = useState(false);
  // Repost modal state
  const [repostPost, setRepostPost]     = useState<any | null>(null);
  const [repostText, setRepostText]     = useState('');
  const [postingRepost, setPostingRepost] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const res: any = await forumAPI.getQuestions();
      setPosts(res.questions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (id: number) => {
    if (likedPosts.has(id)) return; // Prevent double liking
    
    // Optimistic UI update & track local visually
    setLikedPosts(prev => new Set(prev).add(id));
    setPosts(prev => prev.map(p => p.id === id ? { ...p, likes_count: (p.likes_count||0)+1 } : p));
    try {
      await forumAPI.likeQuestion(id);
    } catch {
      // Revert if failed
      setLikedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, likes_count: Math.max(0, (p.likes_count||1)-1) } : p));
    }
  };

  const handlePost = async () => {
    if (!newPostText.trim()) return;
    try {
      setPosting(true);
      await forumAPI.createQuestion({ 
        question: newPostText, 
        category: 'الكل',
        anonymous: false 
      });
      setNewPostText('');
      setModalOpen(false);
      loadPosts();
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  };

  const openComments = useCallback(async (post: any) => {
    setCommentPost(post);
    setAnswers([]);
    setAnswersLoading(true);
    try {
      const res: any = await forumAPI.getAnswers(post.id);
      setAnswers(res.answers || []);
    } catch {} finally { setAnswersLoading(false); }
  }, []);

  const submitAnswer = useCallback(async () => {
    if (!answerText.trim() || !commentPost) return;
    setPostingAnswer(true);
    try {
      await forumAPI.createAnswer(commentPost.id, answerText.trim());
      setAnswerText('');
      const res: any = await forumAPI.getAnswers(commentPost.id);
      setAnswers(res.answers || []);
      setPosts(prev => prev.map(p => p.id === commentPost.id ? { ...p, answer_count: (p.answer_count || 0) + 1 } : p));
    } catch {} finally { setPostingAnswer(false); }
  }, [answerText, commentPost]);

  const handleShare = useCallback((post: any) => {
    setRepostPost(post);
    setRepostText('');
  }, []);

  const submitRepost = useCallback(async () => {
    if (!repostPost) return;
    setPostingRepost(true);
    try {
      const quote = `🔁 ${isRTL ? 'إعادة نشر' : 'Repost'}: "${repostPost.question.slice(0, 80)}${repostPost.question.length > 80 ? '...' : ''}"\n\n${repostText}`;
      await forumAPI.createQuestion({ question: quote, category: repostPost.category || 'الكل', anonymous: false });
      setPosts(prev => prev.map(p => p.id === repostPost.id ? { ...p, shares_count: (p.shares_count || 0) + 1 } : p));
      setRepostPost(null);
      loadPosts();
    } catch {}
    finally { setPostingRepost(false); }
  }, [repostPost, repostText, isRTL]);


  return (
    <View style={{ flex: 1, backgroundColor: feedBg }}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <View style={{ paddingTop: insets.top + 16, backgroundColor: C.surface, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#D3D6DB' }}>
        <View style={{ paddingHorizontal: 16, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, fontFamily: 'CormorantGaramond-Bold' }}>
            {isRTL ? 'مجتمع وكيل' : 'Wakeel Community'}
          </Text>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 16 }}>
            <TouchableOpacity style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: feedBg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>🔍</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: feedBg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>🔔</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id.toString()}
        refreshing={loading}
        onRefresh={loadPosts}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* ─── Social Composer (Like Facebook/LinkedIn) ────────────────── */}
            <View style={{ backgroundColor: C.surface, padding: 16, marginBottom: 8, borderBottomWidth: 1, borderColor: '#D3D6DB' }}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                <Avatar C={C} initials="ME" size={44} />
                <TouchableOpacity onPress={() => setModalOpen(true)} style={{ flex: 1, backgroundColor: feedBg, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Text style={{ color: '#65676B', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }}>
                    {isRTL ? 'بم تفكر؟ نصيحة، أو سؤال قانوني...' : 'What\'s on your mind? A legal tip or question...'}
                  </Text>
                </TouchableOpacity>
              </View>
              {/* Quick Actions */}
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderColor: feedBg }}>
                {(isRTL
                ? [['صورة/فيديو', '📸'], ['ملف/مستند', '📎'], ['استشارة حية', '⚖️']]
                : [['Photo/Video', '📸'], ['File/Doc', '📎'], ['Live Consult', '⚖️']]
              ).map(([label, icon], i) => (
                <TouchableOpacity key={i} style={{ flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18 }}>{icon}</Text>
                  <Text style={{ color: '#65676B', fontWeight: '600', fontSize: 13 }}>{label}</Text>
                </TouchableOpacity>
              ))}
              </View>
            </View>
          </>
        }
        renderItem={({ item: p }) => (
          // ─── Post Card ────────────────────────────────────────────────────────
          <View style={{ backgroundColor: C.surface, marginBottom: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D3D6DB' }}>
            
            {/* Author Header */}
            <View style={{ padding: 16, paddingBottom: 10, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
              <Avatar C={C} initials={p.asked_by ? p.asked_by.substring(0, 2).toUpperCase() : '؟'} size={48} />
              <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{p.asked_by || 'مستخدم'}</Text>
                  {p.verified && <Text style={{ fontSize: 12 }}>☑️</Text>}
                </View>
                <Text style={{ color: '#65676B', fontSize: 13, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>{p.category}</Text>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Text style={{ color: '#8A8D91', fontSize: 12 }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : 'اليوم'}</Text>
                  <Text style={{ color: '#8A8D91', fontSize: 12 }}>•</Text>
                  <Text style={{ color: '#8A8D91', fontSize: 12 }}>🌎 العامة</Text>
                </View>
              </View>
              <TouchableOpacity style={{ padding: 8 }}>
                <Text style={{ fontSize: 18, color: '#65676B', fontWeight: '800' }}>⋯</Text>
              </TouchableOpacity>
            </View>

            {/* Post Body */}
            <Text style={{ paddingHorizontal: 16, fontSize: 15, color: C.text, lineHeight: 24, textAlign: isRTL ? 'right' : 'left', marginBottom: p.image_url ? 8 : 12 }}>
              {p.question}
            </Text>

            {/* Optional Media (Edge to Edge) */}
            {p.image_url && (
              <Image 
                source={{ uri: p.image_url }} 
                style={{ width: '100%', height: 250, backgroundColor: '#E5E5E5' }} 
                resizeMode="cover" 
              />
            )}

            {/* Metrics Row (Likes, Comments counts) */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ backgroundColor: '#1877F2', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 10 }}>👍</Text>
                </View>
                <Text style={{ color: '#65676B', fontSize: 13 }}>{p.likes_count || 0}</Text>
              </View>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 }}>
                <Text style={{ color: '#65676B', fontSize: 13 }}>{p.answer_count || 0} {isRTL ? 'تعليق' : 'comments'}</Text>
                <Text style={{ color: '#65676B', fontSize: 13 }}>{p.shares_count || 0} {isRTL ? 'إعادة نشر' : 'reposts'}</Text>
              </View>
            </View>

            {/* Interactive Action Bar */}
            <View style={{ marginHorizontal: 16, borderTopWidth: 1, borderColor: feedBg, paddingVertical: 4, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
              
              <TouchableOpacity onPress={() => handleLike(p.id)} style={{ flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 20, color: likedPosts.has(p.id) ? '#1877F2' : '#65676B' }}>{likedPosts.has(p.id) ? '👍' : '🤍'}</Text>
                <Text style={{ color: likedPosts.has(p.id) ? '#1877F2' : '#65676B', fontSize: 14, fontWeight: likedPosts.has(p.id) ? '700' : '600' }}>
                  {isRTL ? 'أعجبني' : 'Like'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => openComments(p)} style={{ flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 20, color: '#65676B' }}>💬</Text>
                <Text style={{ color: '#65676B', fontSize: 14, fontWeight: '600' }}>{isRTL ? 'تعليق' : 'Comment'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => handleShare(p)} style={{ flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 20, color: '#65676B' }}>🔁</Text>
                <Text style={{ color: '#65676B', fontSize: 14, fontWeight: '600' }}>{isRTL ? 'إعادة نشر' : 'Repost'}</Text>
              </TouchableOpacity>

            </View>
          </View>
        )}
      />

      {/* ─── Floating Action Button (FAB) ───────────────────────────────── */}
      <TouchableOpacity
        onPress={() => setModalOpen(true)}
        style={{
          position: 'absolute',
          bottom: 24,
          right: isRTL ? undefined : 24,
          left: isRTL ? 24 : undefined,
          backgroundColor: C.gold,
          width: 60, height: 60, borderRadius: 30,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: C.gold, shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4, shadowRadius: 10, elevation: 8
        }}
      >
        <Text style={{ fontSize: 24, color: '#FFF' }}>✍️</Text>
      </TouchableOpacity>

      {/* ─── Comments Modal (Redesigned) ───────────────────────────── */}
      <Modal visible={!!commentPost} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCommentPost(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', fontFamily: 'CormorantGaramond-Bold' }}>
              {isRTL ? '💬 الردود' : '💬 Replies'}
            </Text>
            <TouchableOpacity onPress={() => { setCommentPost(null); setAnswerText(''); }}
              style={{ backgroundColor: C.card2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: C.muted, fontSize: 14, fontWeight: '600' }}>{isRTL ? 'إغلاق' : 'Close'}</Text>
            </TouchableOpacity>
          </View>

          {/* Original Post Summary */}
          {commentPost && (
            <View style={{ margin: 12, backgroundColor: C.gold + '12', borderLeftWidth: 3, borderLeftColor: C.gold, borderRadius: 10, padding: 12 }}>
              <Text style={{ color: C.muted, fontSize: 11, marginBottom: 4, fontWeight: '600' }}>
                {isRTL ? '📌 السؤال الأصلي' : '📌 Original Question'}
              </Text>
              <Text style={{ color: C.text, fontSize: 13, lineHeight: 20 }} numberOfLines={3}>{commentPost.question}</Text>
            </View>
          )}

          {/* Answers list */}
          {answersLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.gold} size="large" /></View>
          ) : (
            <FlatList
              data={answers}
              keyExtractor={a => String(a.id)}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 20 }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingTop: 50, gap: 10 }}>
                  <Text style={{ fontSize: 48 }}>💭</Text>
                  <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>
                    {isRTL ? 'لا توجد ردود بعد' : 'No replies yet'}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center' }}>
                    {isRTL ? 'كن أول من يشارك رأيه القانوني!' : 'Be the first to share your legal insight!'}
                  </Text>
                </View>
              }
              renderItem={({ item: a }) => (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: a.is_accepted ? C.gold + '25' : C.card2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: a.is_accepted ? C.gold : C.muted }}>
                      {(a.lawyer_name || 'م').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, borderTopLeftRadius: 4, padding: 12, borderWidth: 1, borderColor: a.is_accepted ? C.gold + '40' : C.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{a.lawyer_name || (isRTL ? 'محامي' : 'Lawyer')}</Text>
                      {a.is_accepted && <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>✔️ {isRTL ? 'مقبول' : 'Accepted'}</Text>}
                    </View>
                    <Text style={{ color: C.text, fontSize: 14, lineHeight: 22 }}>{a.answer}</Text>
                    <Text style={{ color: C.muted, fontSize: 11, marginTop: 6 }}>
                      {new Date(a.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US')}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}

          {/* Answer input */}
          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: C.border, flexDirection: 'row', gap: 10, alignItems: 'flex-end', paddingBottom: insets.bottom + 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.gold + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: C.gold }}>
                {user?.name ? user.name.substring(0, 2).toUpperCase() : 'ME'}
              </Text>
            </View>
            <TextInput
              multiline
              placeholder={isRTL ? 'شارك رأيك القانوني...' : 'Share your legal insight...'}
              placeholderTextColor={C.muted}
              value={answerText}
              onChangeText={setAnswerText}
              style={{ flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: C.text, fontSize: 14, maxHeight: 100, textAlign: isRTL ? 'right' : 'left' }}
            />
            <TouchableOpacity onPress={submitAnswer} disabled={!answerText.trim() || postingAnswer}
              style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: answerText.trim() ? C.gold : C.dim, alignItems: 'center', justifyContent: 'center' }}>
              {postingAnswer ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontSize: 18 }}>{isRTL ? '←' : '→'}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Create Post Modal ─────────────────────────────────────────── */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.surface }}>
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
          {/* Modal Header */}
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <TouchableOpacity onPress={() => setModalOpen(false)}>
              <Text style={{ color: C.text, fontSize: 16 }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', fontFamily: 'CormorantGaramond-Bold' }}>
              {isRTL ? 'إنشاء منشور' : 'New Post'}
            </Text>
            <TouchableOpacity onPress={handlePost} disabled={!newPostText.trim() || posting}>
              <Text style={{ color: !newPostText.trim() || posting ? C.muted : C.gold, fontSize: 16, fontWeight: '700' }}>
                {isRTL ? 'نشر' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={{ padding: 16, flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 }}>
            <Avatar C={C} initials={user?.name ? user.name.substring(0,2).toUpperCase() : 'ME'} size={44} />
            <Text style={{ fontWeight: '700', fontSize: 16, color: C.text, marginTop: 10 }}>
              {user?.name || (isRTL ? 'أنت' : 'You')}
            </Text>
          </View>

          <TextInput
            autoFocus
            multiline
            placeholder={isRTL ? 'بم تفكر؟ نصيحة، أو سؤال قانوني...' : 'What\'s on your mind? A legal question or tip...'}
            placeholderTextColor={C.muted}
            value={newPostText}
            onChangeText={setNewPostText}
            style={{ flex: 1, paddingHorizontal: 20, fontSize: 18, textAlign: isRTL ? 'right' : 'left', color: C.text, textAlignVertical: 'top' }}
          />

          {/* Bottom Toolbar */}
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 20 }}>
            <TouchableOpacity><Text style={{ fontSize: 24 }}>📸</Text></TouchableOpacity>
            <TouchableOpacity><Text style={{ fontSize: 24 }}>📎</Text></TouchableOpacity>
            <TouchableOpacity><Text style={{ fontSize: 24 }}>👤</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Repost Modal ─────────────────────────────────────────────── */}
      <Modal visible={!!repostPost} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setRepostPost(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.surface }}>
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <TouchableOpacity onPress={() => setRepostPost(null)}>
              <Text style={{ color: C.text, fontSize: 16 }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', fontFamily: 'CormorantGaramond-Bold' }}>
              🔁 {isRTL ? 'إعادة نشر' : 'Repost'}
            </Text>
            <TouchableOpacity onPress={submitRepost} disabled={postingRepost}>
              <Text style={{ color: postingRepost ? C.muted : C.gold, fontSize: 16, fontWeight: '700' }}>
                {postingRepost ? '⏳' : (isRTL ? 'نشر' : 'Share')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16 }}>
            <TextInput
              autoFocus={false}
              multiline
              placeholder={isRTL ? 'أضف تعليقك (اختياري)...' : 'Add your comment (optional)...'}
              placeholderTextColor={C.muted}
              value={repostText}
              onChangeText={setRepostText}
              style={{ fontSize: 16, color: C.text, textAlign: isRTL ? 'right' : 'left', minHeight: 60, marginBottom: 16 }}
            />
            {/* Quoted post preview */}
            {repostPost && (
              <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 }}>
                <Text style={{ color: C.muted, fontSize: 11, marginBottom: 6, fontWeight: '600' }}>
                  🔁 {repostPost.asked_by || (isRTL ? 'مستخدم' : 'User')}
                </Text>
                <Text style={{ color: C.text, fontSize: 14, lineHeight: 22 }} numberOfLines={4}>
                  {repostPost.question}
                </Text>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
