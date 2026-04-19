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
import HashtagText from '../../src/components/HashtagText';
import { useForumSocket } from '../../src/hooks/useForumSocket';

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

/**
 * Strip old-format repost chain text like "[إعادة نشر من lawyer1]:[إعادة نشر من X]: ."
 * This is garbage data written by the old system. Show clean content only.
 */
function cleanQuotedText(text: string | null | undefined): string {
  if (!text) return '';
  // Remove lines starting with [ and ending with ]:
  const lines = text.split('\n').filter(line => !line.trim().match(/^\[.+\][:：]?\s*$/));
  const cleaned = lines.join('\n').trim();
  // Also strip the remaining orphan "." left by old chain
  return cleaned === '.' ? '' : cleaned;
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
  const [savedPosts, setSavedPosts] = useState<Set<number>>(new Set());
  // Comment modal state
  const [commentPost, setCommentPost]   = useState<any | null>(null);
  const [answers, setAnswers]           = useState<any[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answerText, setAnswerText]       = useState('');
  const [postingAnswer, setPostingAnswer] = useState(false);
  // Reply-to state (for replying to a specific comment)
  const [replyingTo, setReplyingTo]     = useState<{ name: string; answerId: number } | null>(null);
  // Nested comments state
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [replies, setReplies] = useState<Record<number, any[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Set<number>>(new Set());
  // Comment likes
  const [likedAnswers, setLikedAnswers] = useState<Set<number>>(new Set());
  // Share modal state
  const [sharingPost, setSharingPost]     = useState<any | null>(null);
  const [repostPost, setRepostPost]       = useState<any | null>(null);
  const [repostText, setRepostText]       = useState('');
  const [postingRepost, setPostingRepost] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile]   = useState<string | null>(null);
  const [uploading, setUploading]         = useState(false);
  const [lightboxUri, setLightboxUri]     = useState<string | null>(null);
  // Post ··· menu state
  const [menuPost, setMenuPost]           = useState<any | null>(null);
  // Edit post state
  const [editingPost, setEditingPost]     = useState<any | null>(null);
  const [editText, setEditText]           = useState('');
  const [savingEdit, setSavingEdit]       = useState(false);
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

  useForumSocket({
    onLike: ({ postId, likes_count }) => {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count } : p));
    },
    onComment: ({ postId, answer }) => {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, answer_count: (p.answer_count || 0) + 1 } : p));
      if (commentPost?.id === postId) {
        if (!answer.parent_answer_id) {
          setAnswers(prev => [answer, ...prev]);
        } else {
          setReplies(prev => ({ ...prev, [answer.parent_answer_id]: [...(prev[answer.parent_answer_id] || []), answer] }));
        }
      }
    },
    onNewPost: ({ post }) => {
      setPosts(prev => {
        if (prev.some(p => p.id === post.id)) return prev;
        return [post, ...prev];
      });
    },
    onShare: ({ postId, shares_count }) => {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, shares_count } : p));
    }
  });

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      if (user?.id) {
        const [res, savedRes]: any = await Promise.all([
          forumAPI.getQuestions(),
          forumAPI.getSavedPosts().catch(() => ({ questions: [] }))
        ]);
        setPosts(res.questions || []);
        const svd = new Set<number>((savedRes?.questions || []).map((q: any) => q.id));
        setSavedPosts(svd);
      } else {
        const res: any = await forumAPI.getQuestions();
        setPosts(res.questions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (id: number) => {
    const isLiked = likedPosts.has(id);
    // Optimistic toggle
    if (isLiked) {
      setLikedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, likes_count: Math.max(0, (p.likes_count||1)-1) } : p));
    } else {
      setLikedPosts(prev => new Set(prev).add(id));
      setPosts(prev => prev.map(p => p.id === id ? { ...p, likes_count: (p.likes_count||0)+1 } : p));
    }
    try {
      const res: any = await forumAPI.likeQuestion(id);
      // Sync server count
      const serverCount = res?.question?.likes_count ?? res?.data?.question?.likes_count;
      if (serverCount !== undefined) {
        setPosts(prev => prev.map(p => p.id === id ? { ...p, likes_count: serverCount } : p));
      }
      const liked = res?.liked ?? res?.data?.liked;
      if (liked === false) setLikedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
      else if (liked === true) setLikedPosts(prev => new Set(prev).add(id));
    } catch {
      // Revert on error
      if (isLiked) setLikedPosts(prev => new Set(prev).add(id));
      else { setLikedPosts(prev => { const n = new Set(prev); n.delete(id); return n; }); }
    }
  };

  const handleSave = async (id: number) => {
    const isSaved = savedPosts.has(id);
    if (isSaved) {
      setSavedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
    } else {
      setSavedPosts(prev => new Set(prev).add(id));
    }
    try {
      await forumAPI.savePost(id);
    } catch {
      if (isSaved) setSavedPosts(prev => new Set(prev).add(id));
      else { setSavedPosts(prev => { const n = new Set(prev); n.delete(id); return n; }); }
    }
  };

  const handleDeletePost = useCallback(async (post: any) => {
    Alert.alert(
      'حذف المنشور',
      'هل أنت متأكد أنك تريد حذف هذا المنشور؟ لا يمكن التراجع.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف', style: 'destructive',
          onPress: async () => {
            try {
              await forumAPI.deletePost(post.id);
              setPosts(prev => prev.filter(p => p.id !== post.id));
              setMenuPost(null);
            } catch {
              Alert.alert('خطأ', 'تعذّر حذف المنشور');
            }
          },
        },
      ]
    );
  }, []);

  const handleEditPost = useCallback((post: any) => {
    setMenuPost(null);
    setEditingPost(post);
    setEditText(post.question || '');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editText.trim() || !editingPost) return;
    setSavingEdit(true);
    try {
      await forumAPI.editPost(editingPost.id, editText.trim());
      setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, question: editText.trim() } : p));
      setEditingPost(null);
      setEditText('');
    } catch {
      Alert.alert('خطأ', 'تعذّر تعديل المنشور');
    } finally { setSavingEdit(false); }
  }, [editText, editingPost]);

  const handleLikeAnswer = useCallback(async (answerId: number) => {
    const isLiked = likedAnswers.has(answerId);
    // Optimistic toggle
    if (isLiked) {
      setLikedAnswers(prev => { const n = new Set(prev); n.delete(answerId); return n; });
      setAnswers(prev => prev.map(a => a.id === answerId ? { ...a, likes_count: Math.max(0, (a.likes_count||1)-1) } : a));
    } else {
      setLikedAnswers(prev => new Set(prev).add(answerId));
      setAnswers(prev => prev.map(a => a.id === answerId ? { ...a, likes_count: (a.likes_count||0)+1 } : a));
    }
    try {
      await forumAPI.likeAnswer(answerId);
    } catch {
      // Revert
      if (isLiked) setLikedAnswers(prev => new Set(prev).add(answerId));
      else setLikedAnswers(prev => { const n = new Set(prev); n.delete(answerId); return n; });
    }
  }, [likedAnswers]);


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
      // Prepend @name (with spaces replaced by underscores for regex matching) if replying to someone
      const text = replyingTo ? `@${replyingTo.name.replace(/\s+/g, '_')} ${answerText.trim()}` : answerText.trim();
      await forumAPI.createAnswer(commentPost.id, text, replyingTo?.answerId);
      if (replyingTo) { toggleReplies(replyingTo.answerId); }
      setAnswerText('');
      setReplyingTo(null);
      const res: any = await forumAPI.getAnswers(commentPost.id);
      setAnswers(res.answers || []);
      setPosts(prev => prev.map(p => p.id === commentPost.id ? { ...p, answer_count: (p.answer_count || 0) + 1 } : p));
    } catch {} finally { setPostingAnswer(false); }
  }, [answerText, commentPost, replyingTo]);

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
            <TouchableOpacity onPress={() => router.push('/saved-posts' as any)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: feedBg, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>🔖</Text>
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
          if (p.isHidden) {
            return (
              <View style={{ marginHorizontal: 16, marginBottom: 8, padding: 16, backgroundColor: '#FFF', borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 20 }}>🙈</Text>
                  <Text style={{ color: '#65676B', fontSize: 14, fontWeight: '600' }}>تم إخفاء هذا المنشور.</Text>
                </View>
                <TouchableOpacity onPress={() => setPosts(prev => prev.map(x => x.id === p.id ? { ...x, isHidden: false } : x))}>
                  <Text style={{ color: '#0A66C2', fontSize: 14, fontWeight: '700' }}>تراجع</Text>
                </TouchableOpacity>
              </View>
            );
          }

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
                      {p.user_flair ? (
                        <View style={{ backgroundColor: C.gold + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>{p.user_flair}</Text>
                        </View>
                      ) : p.user_role === 'lawyer' && (
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

                  {/* ··· menu — opens edit/delete for own posts, report/hide for others */}
                  <TouchableOpacity onPress={() => setMenuPost(p)} style={{ paddingTop: 4, paddingLeft: 4 }}>
                    <Text style={{ color: '#888', fontSize: 22, lineHeight: 22 }}>···</Text>
                  </TouchableOpacity>
                </View>

                {/* Post text (caption / sharer's thought) */}
                {p.question && p.question !== 'مشاركة' && (
                  <HashtagText
                      text={p.question}
                      goldColor="#0A66C2"
                      style={{
                        paddingHorizontal: 16, paddingBottom: isRepost ? 10 : (p.image_url ? 10 : 14),
                        fontSize: 15, lineHeight: 24, color: '#1A1A1A',
                        textAlign: 'right',
                      }}
                    />
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
                    {(() => {
                      const cleanText = cleanQuotedText(origData.question);
                      return cleanText ? (
                        <HashtagText
                          text={cleanText}
                          numberOfLines={5}
                          goldColor="#0A66C2"
                          style={{
                            padding: 10, paddingTop: 8,
                            fontSize: 14, lineHeight: 22, color: '#1A1A1A', textAlign: 'right',
                          }}
                        />
                      ) : null;
                    })()}

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

                {/* ── Action bar ── */}
                <View style={{
                  flexDirection: 'row-reverse',
                  borderTopWidth: 1, borderTopColor: '#F0F0F0',
                  paddingHorizontal: 8, paddingVertical: 4,
                  gap: 6,
                }}>
                  {/* أعجبني */}
                  <TouchableOpacity
                    onPress={() => handleLike(p.id)}
                    style={{
                      flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
                      gap: 4, paddingVertical: 8, borderRadius: 8,
                      backgroundColor: liked ? '#0A66C215' : 'transparent',
                    }}>
                    <Text style={{ fontSize: 17, color: liked ? '#0A66C2' : '#777' }}>
                      {liked ? '👍' : '🤍'}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: liked ? '700' : '500', color: liked ? '#0A66C2' : '#777' }}>
                      أعجبني
                    </Text>
                  </TouchableOpacity>

                  {/* تعليق */}
                  <TouchableOpacity
                    onPress={() => openComments(p)}
                    style={{
                      flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
                      gap: 4, paddingVertical: 8, borderRadius: 8,
                    }}>
                    <Text style={{ fontSize: 17, color: '#777' }}>💬</Text>
                    <Text style={{ fontSize: 11, fontWeight: '500', color: '#777' }}>تعليق</Text>
                  </TouchableOpacity>

                  {/* نشر */}
                  <TouchableOpacity
                    onPress={() => handleShare(p)}
                    style={{
                      flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
                      gap: 4, paddingVertical: 8, borderRadius: 8,
                    }}>
                    <Text style={{ fontSize: 17, color: '#777' }}>↩️</Text>
                    <Text style={{ fontSize: 11, fontWeight: '500', color: '#777' }}>نشر</Text>
                  </TouchableOpacity>

                  {/* حفظ — Bookmark with gold highlight when saved */}
                  <TouchableOpacity
                    onPress={() => handleSave(p.id)}
                    style={{
                      flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
                      gap: 4, paddingVertical: 8, borderRadius: 8,
                      backgroundColor: savedPosts.has(p.id) ? C.gold + '18' : 'transparent',
                      borderWidth: savedPosts.has(p.id) ? 1 : 0,
                      borderColor: savedPosts.has(p.id) ? C.gold + '50' : 'transparent',
                    }}>
                    <Text style={{ fontSize: 17, color: savedPosts.has(p.id) ? C.gold : '#777' }}>
                      {savedPosts.has(p.id) ? '🔖' : '🔖'}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: savedPosts.has(p.id) ? '700' : '500', color: savedPosts.has(p.id) ? C.gold : '#777' }}>
                      {savedPosts.has(p.id) ? 'محفوظ' : 'حفظ'}
                    </Text>
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
                  <View style={{ flex: 1 }}>
                    <View style={{ backgroundColor: C.card, borderRadius: 16, borderTopLeftRadius: 4, padding: 12, borderWidth: 1, borderColor: a.is_accepted ? C.gold + '40' : C.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{a.lawyer_name || (isRTL ? 'محامي' : 'Lawyer')}</Text>
                        {a.is_accepted && <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>✔️ {isRTL ? 'مقبول' : 'Accepted'}</Text>}
                      </View>
                      <Text style={{ color: C.text, fontSize: 14, lineHeight: 22, textAlign: 'right' }}>{a.answer}</Text>
                    </View>
                    {/* Like + Reply row under each comment */}
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, marginTop: 4, paddingHorizontal: 4 }}>
                      <Text style={{ color: C.muted, fontSize: 11 }}>{timeAgo(a.created_at)}</Text>
                      <TouchableOpacity onPress={() => handleLikeAnswer(a.id)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 14, color: likedAnswers.has(a.id) ? '#0A66C2' : '#888' }}>{likedAnswers.has(a.id) ? '👍' : '🤍'}</Text>
                        {(a.likes_count || 0) > 0 && <Text style={{ fontSize: 11, color: likedAnswers.has(a.id) ? '#0A66C2' : '#888', fontWeight: '600' }}>{a.likes_count}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setReplyingTo({ name: a.lawyer_name || 'محامٍ', answerId: a.id })} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 13, color: '#888' }}>↩️</Text>
                        <Text style={{ fontSize: 12, color: '#888', fontWeight: '600' }}>رد</Text>
                      </TouchableOpacity>
                    </View>
                    {(a.reply_count > 0 || expandedReplies.has(a.id)) && (
                      <View style={{ marginTop: 8 }}>
                        {a.reply_count > 0 && !expandedReplies.has(a.id) && (
                           <TouchableOpacity onPress={() => toggleReplies(a.id)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                             <Text style={{ color: C.gold, fontSize: 13, fontWeight: '700' }}>⤿ عرض {a.reply_count} ردود</Text>
                           </TouchableOpacity>
                        )}
                        {expandedReplies.has(a.id) && (
                          loadingReplies.has(a.id) ? <ActivityIndicator size="small" color={C.gold} /> :
                          <View style={{ gap: 12, paddingRight: 10, borderRightWidth: 2, borderColor: C.border, marginTop: 4 }}>
                            {(replies[a.id] || []).map((rep: any) => (
                              <View key={rep.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: C.muted }}>{(rep.lawyer_name || 'م').substring(0, 2).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View style={{ backgroundColor: '#F0F2F5', borderRadius: 14, borderTopLeftRadius: 4, padding: 10 }}>
                                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 12, marginBottom: 4 }}>{rep.lawyer_name}</Text>
                                    <Text style={{ color: C.text, fontSize: 13, textAlign: 'right' }}>{rep.answer}</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 4 }}>
                                    <Text style={{ color: C.muted, fontSize: 10 }}>{timeAgo(rep.created_at)}</Text>
                                    <TouchableOpacity onPress={() => handleLikeAnswer(rep.id)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                                      <Text style={{ fontSize: 12, color: likedAnswers.has(rep.id) ? '#0A66C2' : '#888' }}>{likedAnswers.has(rep.id) ? '👍' : '🤍'}</Text>
                                      {(rep.likes_count || 0) > 0 && <Text style={{ fontSize: 10, color: likedAnswers.has(rep.id) ? '#0A66C2' : '#888' }}>{rep.likes_count}</Text>}
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              )}
            />
          )}

          {/* Answer input */}
          <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingBottom: insets.bottom + 12 }}>
            {/* Replying-to indicator */}
            {replyingTo && (
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
                paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4,
                backgroundColor: C.gold + '15' }}>
                <Text style={{ color: C.gold, fontSize: 12, fontWeight: '600' }}>
                  ↩️ رد على {replyingTo.name}
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <Text style={{ color: C.muted, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.gold + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: C.gold }}>
                  {user?.name ? user.name.substring(0, 2).toUpperCase() : 'ME'}
                </Text>
              </View>
              <TextInput
                multiline
                placeholder={replyingTo ? `الرد على ${replyingTo.name}...` : (isRTL ? 'شارك رأيك القانوني...' : 'Share your legal insight...')}
                placeholderTextColor={C.muted}
                value={answerText}
                onChangeText={setAnswerText}
                style={{ flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: replyingTo ? C.gold : C.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: C.text, fontSize: 14, maxHeight: 100, textAlign: isRTL ? 'right' : 'left' }}
              />
              <TouchableOpacity onPress={submitAnswer} disabled={!answerText.trim() || postingAnswer}
                style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: answerText.trim() ? C.gold : C.dim, alignItems: 'center', justifyContent: 'center' }}>
                {postingAnswer ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontSize: 18 }}>{isRTL ? '←' : '→'}</Text>}
              </TouchableOpacity>
            </View>
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

      {/* ─── Post ··· Menu Bottom Sheet ────────────────────────────────── */}
      <Modal visible={!!menuPost} transparent animationType="slide" onRequestClose={() => setMenuPost(null)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
          activeOpacity={1}
          onPress={() => setMenuPost(null)}
        />
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingBottom: insets.bottom + 8, overflow: 'hidden',
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
          {/* Post preview */}
          {menuPost && (
            <Text style={{ paddingHorizontal: 16, paddingBottom: 12, color: C.muted, fontSize: 13, textAlign: 'right' }} numberOfLines={1}>
              {menuPost.question && menuPost.question !== 'مشاركة' ? menuPost.question : 'منشور'}
            </Text>
          )}
          <View style={{ height: 1, backgroundColor: C.border, marginBottom: 4 }} />

          {menuPost?.user_id === user?.id ? (
            // ── OWN POST: Edit + Delete
            <>
              <TouchableOpacity
                onPress={() => menuPost && handleEditPost(menuPost)}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}>
                <Text style={{ fontSize: 22 }}>✏️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, textAlign: 'right' }}>تعديل المنشور</Text>
                  <Text style={{ color: C.muted, fontSize: 12, textAlign: 'right' }}>تغيير نص منشورك</Text>
                </View>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 16 }} />
              <TouchableOpacity
                onPress={() => menuPost && handleDeletePost(menuPost)}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}>
                <Text style={{ fontSize: 22 }}>🗑️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#E53935', fontWeight: '700', fontSize: 16, textAlign: 'right' }}>حذف المنشور</Text>
                  <Text style={{ color: C.muted, fontSize: 12, textAlign: 'right' }}>سيختفي من المجتمع نهائياً</Text>
                </View>
              </TouchableOpacity>
            </>
          ) : (
            // ── OTHERS' POST: Hide + Report
            <>
              <TouchableOpacity
                onPress={() => {
                  if (menuPost) setPosts(prev => prev.map(p => p.id === menuPost.id ? { ...p, isHidden: true } : p));
                  setMenuPost(null);
                }}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}>
                <Text style={{ fontSize: 22 }}>🙈</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, textAlign: 'right' }}>إخفاء المنشور</Text>
                  <Text style={{ color: C.muted, fontSize: 12, textAlign: 'right' }}>لن يظهر في خلاصتك</Text>
                </View>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 16 }} />
              <TouchableOpacity
                onPress={() => {
                  setMenuPost(null);
                  Alert.alert('تم الإبلاغ', 'شكراً لتعليمنا. سيراجع فريقنا هذا المنشور قريباً.');
                }}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}>
                <Text style={{ fontSize: 22 }}>🚩</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#E53935', fontWeight: '700', fontSize: 16, textAlign: 'right' }}>إبلاغ</Text>
                  <Text style={{ color: C.muted, fontSize: 12, textAlign: 'right' }}>إبلاغ عن محتوى مخالف</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {/* Cancel */}
          <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 16, marginTop: 4 }} />
          <TouchableOpacity
            onPress={() => setMenuPost(null)}
            style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ color: C.muted, fontSize: 16, fontWeight: '600' }}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ─── Edit Post Modal ───────────────────────────────────────── */}
      <Modal visible={!!editingPost} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingPost(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.surface }}>
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
          {/* Header */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <TouchableOpacity onPress={() => { setEditingPost(null); setEditText(''); }}>
              <Text style={{ color: C.muted, fontSize: 16 }}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', fontFamily: 'CormorantGaramond-Bold' }}>✏️ تعديل المنشور</Text>
            <TouchableOpacity onPress={saveEdit} disabled={!editText.trim() || savingEdit}>
              <Text style={{ color: editText.trim() ? C.gold : C.muted, fontSize: 16, fontWeight: '700' }}>حفظ</Text>
            </TouchableOpacity>
          </View>
          {/* Text area */}
          <TextInput
            autoFocus
            multiline
            value={editText}
            onChangeText={setEditText}
            placeholder="نص المنشور..."
            placeholderTextColor={C.muted}
            style={{
              flex: 1, padding: 20, fontSize: 17, lineHeight: 28,
              color: C.text, textAlign: 'right', textAlignVertical: 'top',
            }}
          />
          {savingEdit && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={C.gold} size="large" />
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
