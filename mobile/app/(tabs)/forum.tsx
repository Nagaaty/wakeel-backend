import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Share, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { Avatar, Spinner, Btn } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { forumAPI, uploadAPI } from '../../src/services/api';
import { useAuth } from '../../src/hooks/useAuth';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

/** Relative time — same pattern as LinkedIn (e.g. منذ 3 ساعات) */
function timeAgo(iso: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'الآن';
  if (mins < 60)  return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `منذ ${days} يوم`;
  const wks = Math.floor(days / 7);
  if (wks < 5)    return `منذ ${wks} أسبوع`;
  return `منذ ${Math.floor(days / 30)} شهر`;
}

/** Compact initials-only avatar — never shows role icons */
function InitialsAvatar({ name, size = 44, gold }: { name?: string; size?: number; gold: string }) {
  const ini = (name || '؟')
    .split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: gold + '20',
      borderWidth: 1.5, borderColor: gold + '60', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: gold, fontWeight: '800', fontSize: size * 0.35 }}>{ini}</Text>
    </View>
  );
}


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
  const [answerText, setAnswerText]       = useState('');
  const [postingAnswer, setPostingAnswer] = useState(false);
  // Share modal state
  const [sharingPost, setSharingPost]     = useState<any | null>(null);
  const [repostPost, setRepostPost]       = useState<any | null>(null);
  const [repostText, setRepostText]       = useState('');
  const [postingRepost, setPostingRepost] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile]   = useState<string | null>(null);
  const [uploading, setUploading]         = useState(false);
  const [lightboxUri, setLightboxUri]     = useState<string | null>(null);
  // Reactors sheet (who liked / reposted)
  const [reactorsSheet, setReactorsSheet] = useState<{
    type: 'likes' | 'reposts' | 'comments';
    postId: number;
    title: string;
  } | null>(null);
  const [reactorsList, setReactorsList]   = useState<any[]>([]);
  const [reactorsLoading, setReactorsLoading] = useState(false);
  const { user } = useAuth();

  const openReactors = useCallback(async (type: 'likes' | 'reposts' | 'comments', post: any) => {
    if (type === 'comments') { openComments(post); return; }
    const titles: Record<string, string> = {
      likes: `من أعجبه هذا المنشور (❤️)`,
      reposts: `من أعاد النشر (🔁)`,
    };
    setReactorsSheet({ type, postId: post.id, title: titles[type] });
    setReactorsList([]);
    setReactorsLoading(true);
    try {
      let data: any[];
      if (type === 'likes') {
        const res: any = await forumAPI.getLikers(post.id);
        data = res?.likers || [];
      } else {
        const res: any = await forumAPI.getReposts(post.id);
        data = (res?.reposts || []).map((r: any) => ({ ...r, isRepost: true }));
      }
      setReactorsList(data);
    } catch {} finally { setReactorsLoading(false); }
  }, []);


  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('', 'Photo library access required');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled) {
        setUploading(true);
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append('file', { uri: asset.uri, name: 'forum_media.jpg', type: asset.mimeType || 'image/jpeg' } as any);
        formData.append('folder', 'forum');
        try {
          const res: any = await uploadAPI.upload(formData);
          if (res?.url) setAttachedImage(res.url);
        } catch (e: any) { Alert.alert('Error', e?.message || 'Upload failed'); }
        finally { setUploading(false); }
        setModalOpen(true);
      }
    } catch (e: any) { Alert.alert('Error', e?.message); }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (!result.canceled) {
        setUploading(true);
        const file = result.assets[0];
        const formData = new FormData();
        formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
        formData.append('folder', 'forum_files');
        try {
          const res: any = await uploadAPI.upload(formData);
          if (res?.url) { setAttachedFile(file.name); setAttachedImage(res.url); }
        } catch (e: any) { Alert.alert('Error', e?.message || 'Upload failed'); }
        finally { setUploading(false); }
        setModalOpen(true);
      }
    } catch (e: any) { Alert.alert('Error', e?.message); }
  };

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
    const text = newPostText.trim();
    if (!sharingPost && !text) return;
    try {
      setPosting(true);
      const questionText = sharingPost
        ? (text || 'مشاركة')   // non-empty fallback for DB
        : text;
      // createQuestion returns the new post — capture its ID for the notification link
      const createRes: any = await forumAPI.createQuestion({
        question: questionText,
        category: 'الكل',
        anonymous: false,
        ...(attachedImage ? { image_url: attachedImage } : {}),
        // —— Repost chain: always link to the TRUE original, not an intermediate sharer ——
        ...(sharingPost ? (() => {
          const origDataOfShared = sharingPost.original_post_data
            ? (typeof sharingPost.original_post_data === 'string'
                ? JSON.parse(sharingPost.original_post_data)
                : sharingPost.original_post_data)
            : null;
          if (origDataOfShared) {
            return { original_post_id: sharingPost.original_post_id, original_post_data: origDataOfShared };
          }
          return {
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
        })() : {}),
      });

      if (sharingPost) {
        // Get the id of the newly created repost so the notification links to IT (LinkedIn style)
        const newRepostId = createRes?.question?.id || createRes?.data?.question?.id || null;
        // Pass repost_id so lawyer 2's notification opens lawyer 1's repost, not lawyer 2's original
        forumAPI.sharePost(sharingPost.id, newRepostId ? { repost_id: newRepostId } : undefined).catch(console.error);
        setPosts(prev => prev.map(p =>
          p.id === sharingPost.id ? { ...p, shares_count: (p.shares_count || 0) + 1 } : p
        ));
      }
      setNewPostText('');
      setAttachedImage(null);
      setAttachedFile(null);
      setSharingPost(null);
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

  // Share — opens compose modal with empty caption + stores the original post as a card
  const handleShare = useCallback((post: any) => {
    setNewPostText('');        // empty caption — user decides whether to add thoughts
    setAttachedImage(null);
    setAttachedFile(null);
    setSharingPost(post);      // track which post is being shared
    setModalOpen(true);
  }, []);


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
                <TouchableOpacity onPress={() => router.push(user?.role === 'lawyer' ? '/(lawyer-tabs)/profile' : '/(tabs)/profile' as any)}>
                  <Avatar C={C} url={user?.avatar_url} initials={(user?.name || 'U').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()} size={44} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setModalOpen(true)} style={{ flex: 1, backgroundColor: feedBg, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Text style={{ color: '#65676B', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }}>
                    {isRTL ? 'بم تفكر؟ نصيحة، أو سؤال قانوني...' : 'What\'s on your mind? A legal tip or question...'}
                  </Text>
                </TouchableOpacity>
              </View>
              {/* Quick Actions */}
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderColor: feedBg }}>
                <TouchableOpacity onPress={pickImage} style={{ flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18 }}>📸</Text>
                  <Text style={{ color: '#65676B', fontWeight: '600', fontSize: 13 }}>{isRTL ? 'صورة/فيديو' : 'Photo/Video'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={pickFile} style={{ flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18 }}>📎</Text>
                  <Text style={{ color: '#65676B', fontWeight: '600', fontSize: 13 }}>{isRTL ? 'ملف/مستند' : 'File/Doc'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setModalOpen(true)} style={{ flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18 }}>⚖️</Text>
                  <Text style={{ color: '#65676B', fontWeight: '600', fontSize: 13 }}>{isRTL ? 'استشارة حية' : 'Live Consult'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        renderItem={({ item: p }) => {
          const origData = p.original_post_data
            ? (typeof p.original_post_data === 'string'
                ? JSON.parse(p.original_post_data)
                : p.original_post_data)
            : null;
          const isRepost = !!origData;
          const liked = likedPosts.has(p.id);

          return (
            <View style={{ marginBottom: 8 }}>

              {/* ── Repost banner above card (like LinkedIn: "🔁 Name reposted") ── */}
              {isRepost && (
                <View style={{
                  flexDirection: 'row-reverse', alignItems: 'center',
                  gap: 6, paddingHorizontal: 20, paddingVertical: 6,
                  backgroundColor: feedBg,
                }}>
                  <Text style={{ color: '#00000060', fontSize: 12 }}>🔁</Text>
                  <Text style={{ color: '#00000060', fontSize: 12, fontWeight: '600' }}>
                    {p.asked_by || 'مستخدم'} أعاد النشر
                  </Text>
                </View>
              )}

              {/* ── White card with shadow ── */}
              <View style={{
                backgroundColor: '#FFFFFF',
                shadowColor: '#000',
                shadowOpacity: 0.08,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }}>

                {/* Author row */}
                <View style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'flex-start',
                  paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 12,
                }}>
                  {/* Avatar — tap to open profile */}
                  <TouchableOpacity onPress={() => {
                    if (p.user_id === user?.id) {
                      router.push(user?.role === 'lawyer' ? '/(lawyer-tabs)/profile' : '/(tabs)/profile' as any);
                    } else if (p.user_role === 'lawyer') {
                      router.push({ pathname: '/lawyer/[id]', params: { id: p.user_id } } as any);
                    } else {
                      router.push({ pathname: '/user/[id]', params: { id: p.user_id } } as any);
                    }
                  }}>
                    <InitialsAvatar name={p.asked_by} size={52} gold={C.gold} />
                  </TouchableOpacity>

                  {/* Name / role / time */}
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>
                        {p.asked_by || 'مستخدم'}
                      </Text>
                      {p.user_role === 'lawyer' && (
                        <View style={{ backgroundColor: C.gold + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>⚖️ محامٍ</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: '#666', fontSize: 13, marginTop: 2, textAlign: 'right' }}>
                      {p.category}
                    </Text>
                    <Text style={{ color: '#999', fontSize: 12, marginTop: 2, textAlign: 'right' }}>
                      {timeAgo(p.created_at)} · 🌐
                    </Text>
                  </View>

                  {/* ··· menu */}
                  <TouchableOpacity style={{ paddingTop: 4, paddingLeft: 4 }}>
                    <Text style={{ color: '#888', fontSize: 22, lineHeight: 22 }}>···</Text>
                  </TouchableOpacity>
                </View>

                {/* Post text (caption / sharer's thought) */}
                {p.question && p.question !== 'مشاركة' && (
                  <Text style={{
                    paddingHorizontal: 16, paddingBottom: isRepost ? 10 : (p.image_url ? 10 : 14),
                    fontSize: 15, lineHeight: 24, color: '#1A1A1A',
                    textAlign: 'right',
                  }}>
                    {p.question}
                  </Text>
                )}

                {/* Full-width image (original posts only) */}
                {!isRepost && p.image_url && (
                  <TouchableOpacity onPress={() => setLightboxUri(p.image_url)} activeOpacity={0.95}>
                    <Image
                      source={{ uri: p.image_url }}
                      style={{ width: '100%', height: 280, backgroundColor: '#E8E8E8' }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}

                {/* ── Quoted original post card ── */}
                {isRepost && origData && (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.original_post_id } } as any)}
                    style={{
                      marginHorizontal: 16, marginBottom: 12,
                      borderWidth: 1.5, borderColor: '#E0E0E0',
                      borderRadius: 10, overflow: 'hidden',
                      backgroundColor: '#F7F8FA',
                    }}>

                    {/* Original author in card */}
                    <View style={{
                      flexDirection: 'row-reverse', alignItems: 'center',
                      gap: 10, padding: 10, paddingBottom: 8,
                      borderBottomWidth: 1, borderBottomColor: '#ECECEC',
                    }}>
                      <InitialsAvatar name={origData.authorName} size={34} gold={C.gold} />
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={{ fontWeight: '700', fontSize: 13, color: '#1A1A1A' }}>
                          {origData.authorName || 'مستخدم'}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#888' }}>
                          {origData.authorRole === 'lawyer' ? '⚖️ محامٍ' : '👤 عميل'} · {origData.category}
                        </Text>
                      </View>
                    </View>

                    {/* Original content */}
                    <Text style={{
                      padding: 10, paddingTop: 8,
                      fontSize: 14, lineHeight: 22, color: '#1A1A1A', textAlign: 'right',
                    }} numberOfLines={5}>
                      {origData.question}
                    </Text>

                    {/* Original image */}
                    {origData.image_url && (
                      <Image
                        source={{ uri: origData.image_url }}
                        style={{ width: '100%', height: 160 }}
                        resizeMode="cover"
                      />
                    )}
                  </TouchableOpacity>
                )}

                {/* ── Stats row (only when > 0, tappable) ── */}
                {((p.likes_count || 0) + (p.answer_count || 0) + (p.shares_count || 0)) > 0 && (
                  <View style={{
                    flexDirection: 'row-reverse',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16, paddingVertical: 8,
                    borderTopWidth: 1, borderTopColor: '#F0F0F0',
                  }}>

                    {/* Likes */}
                    <TouchableOpacity
                      onPress={() => (p.likes_count || 0) > 0 && openReactors('likes', p)}
                      style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                      {(p.likes_count || 0) > 0 && (
                        <>
                          <Text style={{ color: '#444', fontSize: 13 }}>{p.likes_count}</Text>
                          <View style={{
                            width: 20, height: 20, borderRadius: 10,
                            backgroundColor: '#1877F2',
                            alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Text style={{ fontSize: 10, color: '#FFF' }}>👍</Text>
                          </View>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Comments + Reposts */}
                    <View style={{ flexDirection: 'row-reverse', gap: 14 }}>
                      {(p.answer_count || 0) > 0 && (
                        <TouchableOpacity onPress={() => openReactors('comments', p)}>
                          <Text style={{ color: '#666', fontSize: 13 }}>{p.answer_count} تعليق</Text>
                        </TouchableOpacity>
                      )}
                      {(p.shares_count || 0) > 0 && (
                        <TouchableOpacity onPress={() => openReactors('reposts', p)}>
                          <Text style={{ color: '#666', fontSize: 13 }}>{p.shares_count} إعادة نشر</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* ── Action bar (3 equal buttons in RTL order: أعجبني | تعليق | إعادة نشر) ── */}
                <View style={{
                  flexDirection: 'row-reverse',
                  borderTopWidth: 1, borderTopColor: '#F0F0F0',
                }}>
                  {/* أعجبني (Like) — rightmost in Arabic */}
                  <TouchableOpacity
                    onPress={() => handleLike(p.id)}
                    style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}>
                    <Text style={{ fontSize: 18, color: liked ? '#0A66C2' : '#606060' }}>
                      {liked ? '👍' : '🤍'}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: liked ? '700' : '600', color: liked ? '#0A66C2' : '#606060' }}>
                      أعجبني
                    </Text>
                  </TouchableOpacity>

                  <View style={{ width: 1, backgroundColor: '#F0F0F0', marginVertical: 8 }} />

                  {/* تعليق (Comment) */}
                  <TouchableOpacity
                    onPress={() => openComments(p)}
                    style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}>
                    <Text style={{ fontSize: 18, color: '#606060' }}>💬</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#606060' }}>تعليق</Text>
                  </TouchableOpacity>

                  <View style={{ width: 1, backgroundColor: '#F0F0F0', marginVertical: 8 }} />

                  {/* إعادة نشر (Repost) — leftmost in Arabic */}
                  <TouchableOpacity
                    onPress={() => handleShare(p)}
                    style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }}>
                    <Text style={{ fontSize: 18, color: '#606060' }}>↩️</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#606060' }}>إعادة نشر</Text>
                  </TouchableOpacity>
                </View>

              </View>
            </View>
          );
        }}
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
            <TouchableOpacity onPress={() => { setModalOpen(false); setSharingPost(null); setNewPostText(''); }}>
              <Text style={{ color: C.text, fontSize: 16 }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', fontFamily: 'CormorantGaramond-Bold' }}>
              {sharingPost ? (isRTL ? '🔁 مشاركة' : '🔁 Share') : (isRTL ? 'إنشاء منشور' : 'New Post')}
            </Text>
            {/* نشر: always active in share mode, requires text for new post */}
            <TouchableOpacity onPress={handlePost} disabled={(!sharingPost && !newPostText.trim()) || posting}>
              <Text style={{ color: ((!sharingPost && !newPostText.trim()) || posting) ? C.muted : C.gold, fontSize: 16, fontWeight: '700' }}>
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
            placeholder={sharingPost
              ? (isRTL ? 'أضف تعليقك (اختياري)...' : 'Add a comment (optional)...')
              : (isRTL ? 'بم تفكر؟ نصيحة، أو سؤال قانوني...' : "What's on your mind? A legal question or tip...")}
            placeholderTextColor={C.muted}
            value={newPostText}
            onChangeText={setNewPostText}
            style={{ paddingHorizontal: 20, paddingTop: 12, fontSize: 18, textAlign: isRTL ? 'right' : 'left', color: C.text, textAlignVertical: 'top', minHeight: 80 }}
          />

          {/* Shared post quoted card */}
          {sharingPost && (
            <View style={{
              marginHorizontal: 16, marginTop: 8, marginBottom: 4,
              borderWidth: 1, borderColor: C.border,
              borderRadius: 12, overflow: 'hidden',
            }}>
              {/* Card header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: C.card }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.gold + '28', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: C.gold, fontWeight: '800', fontSize: 13 }}>
                    {(sharingPost.asked_by || 'U').substring(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{sharingPost.asked_by || 'مستخدم'}</Text>
                  <Text style={{ color: C.muted, fontSize: 11 }}>{sharingPost.category}</Text>
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

          {/* Attached image preview */}
          {uploading && (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <ActivityIndicator color={C.gold} />
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>{isRTL ? 'جاري رفع الملف...' : 'Uploading...'}</Text>
            </View>
          )}
          {attachedImage && !uploading && (
            <View style={{ marginHorizontal: 20, marginBottom: 12, position: 'relative' }}>
              <Image source={{ uri: attachedImage }} style={{ width: '100%', height: 180, borderRadius: 12 }} resizeMode="cover" />
              {attachedFile && <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>📎 {attachedFile}</Text>}
              <TouchableOpacity onPress={() => { setAttachedImage(null); setAttachedFile(null); }}
                style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom Toolbar */}
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 20 }}>
            <TouchableOpacity onPress={pickImage}><Text style={{ fontSize: 24 }}>📸</Text></TouchableOpacity>
            <TouchableOpacity onPress={pickFile}><Text style={{ fontSize: 24 }}>📎</Text></TouchableOpacity>
            <TouchableOpacity><Text style={{ fontSize: 24 }}>👤</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>



      {/* ─── Reactors Sheet (Who Liked / Who Reposted) ──────────────────── */}
      <Modal
        visible={!!reactorsSheet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReactorsSheet(null)}>
        <View style={{ flex: 1, backgroundColor: C.surface }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', fontFamily: 'CormorantGaramond-Bold' }}>
              {reactorsSheet?.title}
            </Text>
            <TouchableOpacity onPress={() => setReactorsSheet(null)}
              style={{ backgroundColor: C.card2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: C.muted, fontWeight: '600' }}>إغلاق</Text>
            </TouchableOpacity>
          </View>
          {/* List */}
          {reactorsLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={C.gold} size="large" />
            </View>
          ) : reactorsList.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Text style={{ fontSize: 44 }}>{reactorsSheet?.type === 'likes' ? '❤️' : '🔁'}</Text>
              <Text style={{ color: C.muted, fontSize: 15 }}>لا يوجد بيانات بعد</Text>
            </View>
          ) : (
            <FlatList
              data={reactorsList}
              keyExtractor={(r, i) => String(r.id || i)}
              contentContainerStyle={{ padding: 12, gap: 8 }}
              renderItem={({ item: r }) => (
                <TouchableOpacity
                  onPress={() => {
                    setReactorsSheet(null);
                    if (r.isRepost) {
                      router.push({ pathname: '/post/[id]', params: { id: r.id } } as any);
                    } else if (r.role === 'lawyer') {
                      router.push({ pathname: '/lawyer/[id]', params: { id: r.id } } as any);
                    } else {
                      router.push({ pathname: '/user/[id]', params: { id: r.id } } as any);
                    }
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: C.card, borderRadius: 14 }}>
                  {/* Avatar */}
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.gold + '28', borderWidth: 1.5, borderColor: C.gold + '50', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: C.gold, fontWeight: '800', fontSize: 16 }}>
                      {(r.name || '?').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  {/* Info */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{r.name || 'مستخدم'}</Text>
                    {r.isRepost && r.question && (
                      <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{r.question}</Text>
                    )}
                    {!r.isRepost && (
                      <Text style={{ color: C.gold, fontSize: 12, marginTop: 2 }}>
                        {r.role === 'lawyer' ? '⚖️ محامٍ' : '👤 عميل'}
                      </Text>
                    )}
                  </View>
                  {/* Chevron */}
                  <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* ─── Fullscreen Image Lightbox ─────────────────────────────────── */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity
          onPress={() => setLightboxUri(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={1}
        >
          {/* Close button */}
          <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 10,
            backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, width: 40, height: 40,
            alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300' }}>✕</Text>
          </View>
          {lightboxUri && (
            <Image
              source={{ uri: lightboxUri }}
              style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 }}
              resizeMode="contain"
            />
          )}
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 16 }}>
            {isRTL ? 'اضغط في أي مكان للإغلاق' : 'Tap anywhere to close'}
          </Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
