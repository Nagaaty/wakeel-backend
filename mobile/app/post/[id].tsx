/**
 * Post Detail Screen — /post/[id]
 * Opens from notification tap (like LinkedIn/Facebook full-post view).
 * Shows the post header, body, image, reactions bar, and all comments below.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { forumAPI } from '../../src/services/api';

function Avatar({ url, name, size = 42, gold }: { url?: string | null; name?: string; size?: number; gold: string }) {
  const initials = (name || '?').split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase();
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: gold + '28', borderWidth: 1.5, borderColor: gold + '60', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: gold, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

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

export default function PostDetail() {
  const { id }   = useLocalSearchParams<{ id: string }>();
  const C        = useTheme();
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();

  const [post,          setPost]          = useState<any>(null);
  const [answers,       setAnswers]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [answersLoading,setAnswersLoading]= useState(true);
  const [liked,         setLiked]         = useState(false);
  const [answerText,    setAnswerText]    = useState('');
  const [posting,       setPosting]       = useState(false);

  const loadPost = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res: any = await forumAPI.getQuestion(id);
      setPost(res?.question || res?.data?.question || null);
    } catch (e) {
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

  const handleLike = async () => {
    if (!post || liked) return;
    setLiked(true);
    setPost((p: any) => ({ ...p, likes_count: (p.likes_count || 0) + 1 }));
    await forumAPI.likeQuestion(id).catch(() => {
      setLiked(false);
      setPost((p: any) => ({ ...p, likes_count: Math.max(0, (p.likes_count || 1) - 1) }));
    });
  };

  const submitAnswer = async () => {
    if (!answerText.trim() || posting) return;
    setPosting(true);
    try {
      await forumAPI.createAnswer(id, answerText.trim());
      setAnswerText('');
      await loadAnswers();
      setPost((p: any) => ({ ...p, answer_count: (p.answer_count || 0) + 1 }));
    } catch { Alert.alert('خطأ', 'تعذّر إرسال التعليق'); }
    finally { setPosting(false); }
  };

  const goToProfile = () => {
    if (!post) return;
    if (post.user_id === user?.id) {
      router.push(user?.role === 'lawyer' ? '/(lawyer-tabs)/profile' : '/(tabs)/profile' as any);
    } else if (post.user_role === 'lawyer') {
      router.push({ pathname: '/lawyer/[id]', params: { id: post.user_id } } as any);
    } else {
      router.push({ pathname: '/user/[id]', params: { id: post.user_id } } as any);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#EBEDF0' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: C.surface,
        paddingTop: insets.top + 4,
        paddingBottom: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#D3D6DB',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ fontSize: 26, color: C.text, lineHeight: 30 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 18, fontFamily: 'CormorantGaramond-Bold', flex: 1 }}>المنشور</Text>
      </View>

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {loading && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.gold} size="large" />
        </View>
      )}

      {!loading && !post && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Text style={{ fontSize: 48 }}>😕</Text>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>لم يتم العثور على المنشور</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }}>
            <Text style={{ color: '#000', fontWeight: '700' }}>عودة</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && post && (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

          {/* ── Post Card ──────────────────────────────────────────── */}
          <View style={{ backgroundColor: C.surface, marginBottom: 8, borderBottomWidth: 1, borderTopWidth: 1, borderColor: '#D3D6DB' }}>

            {/* Author row */}
            <View style={{ padding: 16, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={goToProfile}>
                <Avatar url={post.user_avatar_url} name={post.asked_by} size={50} gold={C.gold} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <TouchableOpacity onPress={goToProfile}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{post.asked_by || 'مستخدم'}</Text>
                </TouchableOpacity>
                <Text style={{ color: '#65676B', fontSize: 12, marginTop: 2 }}>{post.category}</Text>
                <Text style={{ color: '#8A8D91', fontSize: 11, marginTop: 1 }}>
                  {timeAgo(post.created_at)} · 🌎 العامة
                </Text>
              </View>
            </View>

            {/* Post text */}
            <Text style={{ paddingHorizontal: 16, fontSize: 16, color: C.text, lineHeight: 26, textAlign: 'right', marginBottom: post.image_url ? 8 : 14 }}>
              {post.question}
            </Text>

            {/* Image */}
            {post.image_url && (
              <Image source={{ uri: post.image_url }} style={{ width: '100%', height: 260, backgroundColor: '#eee' }} resizeMode="cover" />
            )}

            {/* Stats row */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ backgroundColor: '#1877F2', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 10 }}>👍</Text>
                </View>
                <Text style={{ color: '#65676B', fontSize: 13 }}>{post.likes_count || 0}</Text>
              </View>
              <Text style={{ color: '#65676B', fontSize: 13 }}>{post.answer_count || 0} تعليق</Text>
            </View>

            {/* Action bar */}
            <View style={{ marginHorizontal: 16, borderTopWidth: 1, borderColor: '#EBEDF0', paddingVertical: 4, flexDirection: 'row', justifyContent: 'space-around' }}>
              <TouchableOpacity
                onPress={handleLike}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 20, color: liked ? '#1877F2' : '#65676B' }}>{liked ? '👍' : '🤍'}</Text>
                <Text style={{ color: liked ? '#1877F2' : '#65676B', fontSize: 14, fontWeight: liked ? '700' : '600' }}>أعجبني</Text>
              </TouchableOpacity>
              <View style={{ width: 1, backgroundColor: '#EBEDF0' }} />
              <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 }}>
                <Text style={{ fontSize: 20, color: '#65676B' }}>💬</Text>
                <Text style={{ color: '#65676B', fontSize: 14, fontWeight: '600' }}>تعليق</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Comments Section ───────────────────────────────────── */}
          <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderColor: '#D3D6DB' }}>
            <Text style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, color: C.text, fontWeight: '700', fontSize: 15 }}>
              التعليقات {answers.length > 0 ? `(${answers.length})` : ''}
            </Text>

            {answersLoading ? (
              <ActivityIndicator color={C.gold} style={{ paddingVertical: 20 }} />
            ) : answers.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 30, gap: 8 }}>
                <Text style={{ fontSize: 36 }}>💭</Text>
                <Text style={{ color: C.muted, fontSize: 14 }}>لا توجد تعليقات بعد. كن الأول!</Text>
              </View>
            ) : (
              answers.map((a, idx) => (
                <View key={a.id || idx} style={{
                  flexDirection: 'row', gap: 10, padding: 12, paddingTop: idx === 0 ? 4 : 12,
                  borderTopWidth: idx > 0 ? 1 : 0, borderColor: '#EBEDF0',
                }}>
                  <TouchableOpacity onPress={() => {
                    if (a.lawyer_role === 'lawyer')
                      router.push({ pathname: '/lawyer/[id]', params: { id: a.lawyer_id } } as any);
                  }}>
                    <Avatar url={a.lawyer_avatar} name={a.lawyer_name} size={38} gold={C.gold} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <View style={{ backgroundColor: '#F0F2F5', borderRadius: 12, borderTopLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 10 }}>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, textAlign: 'right' }}>
                        {a.lawyer_name || 'محامٍ'}{a.is_accepted ? ' ✔️' : ''}
                      </Text>
                      {a.specialization && (
                        <Text style={{ color: C.gold, fontSize: 11, textAlign: 'right', marginBottom: 4 }}>⚖️ {a.specialization}</Text>
                      )}
                      <Text style={{ color: C.text, fontSize: 14, lineHeight: 22, textAlign: 'right' }}>{a.answer}</Text>
                    </View>
                    <Text style={{ color: '#8A8D91', fontSize: 11, marginTop: 4, textAlign: 'right' }}>{timeAgo(a.created_at)}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* ── Reply input (fixed bottom) ──────────────────────────────── */}
      {!loading && post && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: C.surface,
          borderTopWidth: 1, borderTopColor: '#D3D6DB',
          flexDirection: 'row', alignItems: 'flex-end', gap: 10,
          paddingHorizontal: 12, paddingTop: 10,
          paddingBottom: insets.bottom + 10,
        }}>
          <Avatar url={user?.avatar_url} name={user?.name} size={38} gold={C.gold} />
          <TextInput
            value={answerText}
            onChangeText={setAnswerText}
            placeholder="اكتب تعليقاً..."
            placeholderTextColor={C.muted}
            multiline
            style={{
              flex: 1, backgroundColor: '#F0F2F5', borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 10,
              color: C.text, fontSize: 14, maxHeight: 100,
              textAlign: 'right',
            }}
          />
          <TouchableOpacity
            onPress={submitAnswer}
            disabled={!answerText.trim() || posting}
            style={{
              width: 42, height: 42, borderRadius: 21,
              backgroundColor: answerText.trim() ? C.gold : C.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
            {posting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={{ color: '#fff', fontSize: 18 }}>↩</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
