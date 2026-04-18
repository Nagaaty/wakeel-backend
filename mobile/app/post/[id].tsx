/**
 * Post Detail Screen — /post/[id]
 * LinkedIn/Facebook style dedicated post page.
 * Opened from notification tap.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Animated,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { forumAPI } from '../../src/services/api';

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function UserAvatar({
  url, name, size = 44, gold,
}: { url?: string | null; name?: string; size?: number; gold: string }) {
  const initials = (name || '؟')
    .split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase();
  if (url)
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#ddd' }}
      />
    );
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: gold + '28',
        borderWidth: 1.5, borderColor: gold + '70',
        alignItems: 'center', justifyContent: 'center',
      }}>
      <Text style={{ color: gold, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

function timeAgo(iso: string) {
  if (!iso) return '';
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1)  return 'الآن';
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
}

/* ─── Screen ─────────────────────────────────────────────────────────── */
export default function PostDetail() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const C         = useTheme();
  const insets    = useSafeAreaInsets();
  const { user }  = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [post,            setPost]           = useState<any>(null);
  const [answers,         setAnswers]        = useState<any[]>([]);
  const [loading,         setLoading]        = useState(true);
  const [answersLoading,  setAnswersLoading] = useState(true);
  const [liked,           setLiked]          = useState(false);
  const [likeCount,       setLikeCount]      = useState(0);
  const [answerText,      setAnswerText]     = useState('');
  const [posting,         setPosting]        = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;

  /* ─ Load ─ */
  const loadPost = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res: any = await forumAPI.getQuestion(id);
      const q = res?.question || res?.data?.question;
      setPost(q || null);
      setLikeCount(q?.likes_count || 0);
    } catch {
      Alert.alert('خطأ', 'تعذّر تحميل المنشور');
    } finally { setLoading(false); }
  }, [id]);

  const loadAnswers = useCallback(async () => {
    if (!id) return;
    try {
      setAnswersLoading(true);
      const res: any = await forumAPI.getAnswers(id);
      setAnswers(res?.answers || []);
    } catch {} finally { setAnswersLoading(false); }
  }, [id]);

  useEffect(() => {
    loadPost();
    loadAnswers();
  }, [loadPost, loadAnswers]);

  /* ─ Like with bouncy animation ─ */
  const handleLike = async () => {
    if (liked) return;
    setLiked(true);
    setLikeCount(c => c + 1);
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(likeScale, { toValue: 1,    useNativeDriver: true, speed: 20 }),
    ]).start();
    await forumAPI.likeQuestion(id).catch(() => {
      setLiked(false);
      setLikeCount(c => Math.max(0, c - 1));
    });
  };

  /* ─ Share (reposts as new post + notifies author) ─ */
  const handleShare = () => {
    forumAPI.sharePost(id).catch(console.error);
    Alert.alert(
      '🔁 إعادة نشر',
      'هل تريد إعادة نشر هذا المنشور في مجتمع وكيل؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نشر',
          onPress: () => {
            router.push({ pathname: '/(tabs)/forum' } as any);
          },
        },
      ]
    );
  };

  /* ─ Comment ─ */
  const submitAnswer = async () => {
    if (!answerText.trim() || posting) return;
    setPosting(true);
    try {
      await forumAPI.createAnswer(id, answerText.trim());
      setAnswerText('');
      await loadAnswers();
      setPost((p: any) => p ? { ...p, answer_count: (p.answer_count || 0) + 1 } : p);
      // Scroll to bottom
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } catch { Alert.alert('خطأ', 'تعذّر إرسال التعليق'); }
    finally { setPosting(false); }
  };

  /* ─ Profile nav ─ */
  const goToProfile = (userId: string, role: string) => {
    if (userId === user?.id) {
      router.push(user?.role === 'lawyer' ? '/(lawyer-tabs)/profile' : '/(tabs)/profile' as any);
    } else if (role === 'lawyer') {
      router.push({ pathname: '/lawyer/[id]', params: { id: userId } } as any);
    } else {
      router.push({ pathname: '/user/[id]', params: { id: userId } } as any);
    }
  };

  /* ──────────────────────────────────────────────────────────────────── */
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F0F2F5' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.bottom}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: C.surface,
        paddingTop: insets.top + 6,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#D3D6DB',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={{ fontSize: 28, color: C.text, lineHeight: 32 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: C.text, fontWeight: '800', fontSize: 18, fontFamily: 'CormorantGaramond-Bold', flex: 1 }}>
          المنشور
        </Text>
      </View>

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.gold} size="large" />
          <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>جاري تحميل المنشور…</Text>
        </View>
      )}

      {!loading && !post && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <Text style={{ fontSize: 52 }}>😕</Text>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 17 }}>لم يتم العثور على المنشور</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 11 }}>
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>العودة</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && post && (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}>

          {/* ── Post Card ──────────────────────────────────────────── */}
          {(() => {
            const origData = post.original_post_data
              ? (typeof post.original_post_data === 'string'
                  ? JSON.parse(post.original_post_data)
                  : post.original_post_data)
              : null;
            const isRepost = !!origData;

            return (
              <View style={{ backgroundColor: '#FFFFFF', marginBottom: 8,
                shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>

                {/* Repost banner (above author, like LinkedIn) */}
                {isRepost && (
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center',
                    gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
                    <Text style={{ color: '#00000055', fontSize: 12 }}>🔁</Text>
                    <Text style={{ color: '#00000055', fontSize: 12, fontWeight: '600' }}>
                      {post.asked_by || 'مستخدم'} أعاد النشر
                    </Text>
                  </View>
                )}

                {/* Author row */}
                <View style={{ paddingHorizontal: 16, paddingTop: isRepost ? 8 : 16,
                  paddingBottom: 10, flexDirection: 'row-reverse',
                  alignItems: 'flex-start', gap: 12 }}>
                  <TouchableOpacity onPress={() => goToProfile(post.user_id, post.user_role)}>
                    <UserAvatar url={post.user_avatar_url} name={post.asked_by} size={52} gold={C.gold} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>
                        {post.asked_by || 'مستخدم'}
                      </Text>
                      {post.user_role === 'lawyer' && (
                        <View style={{ backgroundColor: C.gold + '22', borderRadius: 6,
                          paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>⚖️ محامٍ</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: '#666', fontSize: 13, marginTop: 2 }}>{post.category}</Text>
                    <Text style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
                      {timeAgo(post.created_at)} · 🌐
                    </Text>
                  </View>
                </View>

                {/* Sharer's caption — hide 'مشاركة' placeholder */}
                {post.question && post.question !== 'مشاركة' && (
                  <Text style={{
                    paddingHorizontal: 16,
                    paddingBottom: isRepost ? 10 : (post.image_url ? 10 : 16),
                    fontSize: 16, lineHeight: 26, color: '#1A1A1A', textAlign: 'right',
                  }}>
                    {post.question}
                  </Text>
                )}

                {/* Full image (original posts only) */}
                {!isRepost && !!post.image_url && (
                  <Image
                    source={{ uri: post.image_url }}
                    style={{ width: '100%', height: 280, backgroundColor: '#E5E5E5' }}
                    resizeMode="cover"
                  />
                )}

                {/* Quoted original post card */}
                {isRepost && origData && (
                  <View style={{
                    marginHorizontal: 16, marginBottom: 14,
                    borderWidth: 1.5, borderColor: '#E0E0E0',
                    borderRadius: 10, overflow: 'hidden',
                    backgroundColor: '#F7F8FA',
                  }}>
                    {/* Original author */}
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center',
                      gap: 10, padding: 10, paddingBottom: 8,
                      borderBottomWidth: 1, borderBottomColor: '#ECECEC' }}>
                      <UserAvatar name={origData.authorName} size={34} gold={C.gold} />
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={{ fontWeight: '700', fontSize: 13, color: '#1A1A1A' }}>
                          {origData.authorName || 'مستخدم'}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#888' }}>
                          {origData.authorRole === 'lawyer' ? '⚖️ محامٍ' : '👤 عميل'} · {origData.category}
                        </Text>
                      </View>
                    </View>
                    {/* Original text */}
                    <Text style={{
                      padding: 10, paddingTop: 8,
                      fontSize: 14, lineHeight: 22, color: '#1A1A1A', textAlign: 'right',
                    }}>
                      {origData.question}
                    </Text>
                    {/* Original image */}
                    {origData.image_url && (
                      <Image
                        source={{ uri: origData.image_url }}
                        style={{ width: '100%', height: 180 }}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                )}

                {/* Stats row */}
                {(likeCount + (post.answer_count || answers.length) + (post.shares_count || 0)) > 0 && (
                  <View style={{
                    paddingHorizontal: 16, paddingVertical: 8,
                    flexDirection: 'row-reverse', justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTopWidth: 1, borderTopColor: '#F0F0F0',
                  }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                      {likeCount > 0 && (
                        <>
                          <Text style={{ color: '#555', fontSize: 13 }}>{likeCount}</Text>
                          <View style={{ backgroundColor: '#1877F2', width: 20, height: 20,
                            borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#FFF', fontSize: 10 }}>👍</Text>
                          </View>
                        </>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row-reverse', gap: 14 }}>
                      {(post.answer_count || answers.length) > 0 && (
                        <Text style={{ color: '#666', fontSize: 13 }}>
                          {post.answer_count || answers.length} تعليق
                        </Text>
                      )}
                      {(post.shares_count || 0) > 0 && (
                        <Text style={{ color: '#666', fontSize: 13 }}>
                          {post.shares_count} إعادة نشر
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* ── Action bar: RTL — أعجبني | تعليق | إعادة نشر ── */}
                <View style={{ flexDirection: 'row-reverse',
                  borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>

                  {/* أعجبني — rightmost in Arabic */}
                  <TouchableOpacity
                    onPress={handleLike}
                    style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center',
                      justifyContent: 'center', gap: 6, paddingVertical: 12 }}>
                    <Animated.Text
                      style={{ fontSize: 20, transform: [{ scale: likeScale }],
                        color: liked ? '#0A66C2' : '#606060' }}>
                      {liked ? '👍' : '🤍'}
                    </Animated.Text>
                    <Text style={{ fontSize: 13, fontWeight: liked ? '700' : '600',
                      color: liked ? '#0A66C2' : '#606060' }}>
                      أعجبني
                    </Text>
                  </TouchableOpacity>

                  <View style={{ width: 1, backgroundColor: '#F0F0F0', marginVertical: 8 }} />

                  {/* تعليق */}
                  <TouchableOpacity
                    onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
                    style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center',
                      justifyContent: 'center', gap: 6, paddingVertical: 12 }}>
                    <Text style={{ fontSize: 20, color: '#606060' }}>💬</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#606060' }}>تعليق</Text>
                  </TouchableOpacity>

                  <View style={{ width: 1, backgroundColor: '#F0F0F0', marginVertical: 8 }} />

                  {/* إعادة نشر — leftmost in Arabic */}
                  <TouchableOpacity
                    onPress={handleShare}
                    style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center',
                      justifyContent: 'center', gap: 6, paddingVertical: 12 }}>
                    <Text style={{ fontSize: 20, color: '#606060' }}>↩️</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#606060' }}>إعادة نشر</Text>
                  </TouchableOpacity>

                </View>
              </View>
            );
          })()}

          {/* ── Comments Section ───────────────────────────────────── */}
          <View style={{ backgroundColor: C.surface }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>
                {answers.length > 0 ? `التعليقات (${answers.length})` : 'التعليقات'}
              </Text>
            </View>

            {answersLoading ? (
              <ActivityIndicator color={C.gold} style={{ paddingVertical: 30 }} />
            ) : answers.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 36, gap: 10 }}>
                <Text style={{ fontSize: 42 }}>💭</Text>
                <Text style={{ color: C.muted, fontSize: 15 }}>لا توجد تعليقات بعد</Text>
                <Text style={{ color: C.muted, fontSize: 13 }}>كن أول من يشارك رأيه القانوني!</Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
                {answers.map((a, idx) => (
                  <View key={a.id || idx} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <TouchableOpacity onPress={() => a.lawyer_id && goToProfile(a.lawyer_id, a.lawyer_role || 'lawyer')}>
                      <UserAvatar url={a.lawyer_avatar} name={a.lawyer_name} size={40} gold={C.gold} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <View style={{
                        backgroundColor: '#F0F2F5',
                        borderRadius: 16, borderTopRightRadius: 4,
                        paddingHorizontal: 14, paddingVertical: 10,
                      }}>
                        <TouchableOpacity onPress={() => a.lawyer_id && goToProfile(a.lawyer_id, a.lawyer_role || 'lawyer')}>
                          <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, textAlign: 'right' }}>
                            {a.lawyer_name || 'محامٍ'}{a.is_accepted ? ' ✔️' : ''}
                          </Text>
                        </TouchableOpacity>
                        {a.specialization && (
                          <Text style={{ color: C.gold, fontSize: 11, textAlign: 'right', marginBottom: 4 }}>
                            ⚖️ {a.specialization}
                          </Text>
                        )}
                        <Text style={{ color: C.text, fontSize: 14, lineHeight: 22, textAlign: 'right' }}>
                          {a.answer}
                        </Text>
                      </View>
                      <Text style={{ color: '#8A8D91', fontSize: 11, marginTop: 4, textAlign: 'right' }}>
                        {timeAgo(a.created_at)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Reply Input (fixed bottom) ─────────────────────────────── */}
      {!loading && post && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: C.surface,
          borderTopWidth: 1, borderTopColor: '#D3D6DB',
          flexDirection: 'row', alignItems: 'flex-end', gap: 10,
          paddingHorizontal: 12, paddingTop: 10,
          paddingBottom: insets.bottom + 12,
        }}>
          <UserAvatar url={user?.avatar_url} name={user?.name} size={40} gold={C.gold} />
          <TextInput
            value={answerText}
            onChangeText={setAnswerText}
            placeholder="اكتب تعليقاً..."
            placeholderTextColor={C.muted}
            multiline
            style={{
              flex: 1,
              backgroundColor: '#F0F2F5',
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 10,
              color: C.text,
              fontSize: 14,
              maxHeight: 100,
              textAlign: 'right',
              borderWidth: 1,
              borderColor: '#E4E6EB',
            }}
          />
          <TouchableOpacity
            onPress={submitAnswer}
            disabled={!answerText.trim() || posting}
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: answerText.trim() ? C.gold : '#E4E6EB',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: C.gold, shadowOpacity: answerText.trim() ? 0.4 : 0,
              shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
              elevation: answerText.trim() ? 4 : 0,
            }}>
            {posting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={{ color: answerText.trim() ? '#000' : '#BCC0C4', fontSize: 20 }}>↩</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
