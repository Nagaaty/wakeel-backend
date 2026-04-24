import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, ScrollView, Image, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Share, Dimensions, DeviceEventEmitter, Animated } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { Avatar, Spinner, Btn } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { forumAPI, uploadAPI } from '../../src/services/api';
import { useAuth } from '../../src/hooks/useAuth';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Video, ResizeMode } from 'expo-av';
import HashtagText from '../../src/components/HashtagText';
import MentionInput from '../../src/components/MentionInput';
import { useForumSocket } from '../../src/hooks/useForumSocket';
import { PostCard, AutoSizingImage } from '../../src/components/forum/PostCard';

import { timeAgo } from '../../src/utils/date';

/**
 * Strip old-format repost chain text like "[إعادة نشر من lawyer1]:[إعادة نشر من X]: ."
 * This is garbage data written by the old system. Show clean content only.
 */
function cleanQuotedText(text: string | null | undefined): string {
  if (!text) return '';
  const lines = text.split('\n').filter(line => !line.trim().match(/^\[.+\][:：]?\s*$/));
  const cleaned = lines.join('\n').trim();
  return cleaned === '.' ? '' : cleaned;
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
  const [postCategory, setPostCategory] = useState('الكل');
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [dislikedPosts, setDislikedPosts] = useState<Set<number>>(new Set());
  const [savedPosts, setSavedPosts] = useState<Set<number>>(new Set());
  // Sort feed
  const [sortMode, setSortMode] = useState<'new' | 'hot' | 'top' | 'rising'>('new');
  // Community stats + trending
  const [stats, setStats] = useState<any>(null);
  const [trending, setTrending] = useState<any[]>([]);
  // Comment modal state
  const [commentPost, setCommentPost]   = useState<any | null>(null);
  const [answers, setAnswers]           = useState<any[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answerText, setAnswerText]       = useState('');
  const [postingAnswer, setPostingAnswer] = useState(false);
  const [replyingTo, setReplyingTo]     = useState<{ name: string; answerId: number } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [replies, setReplies] = useState<Record<number, any[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Set<number>>(new Set());
  const [likedAnswers, setLikedAnswers] = useState<Set<number>>(new Set());
  const [dislikedAnswers, setDislikedAnswers] = useState<Set<number>>(new Set());

  // Share modal state
  const [sharingPost, setSharingPost]     = useState<any | null>(null);
  const [repostPost, setRepostPost]       = useState<any | null>(null);
  const [repostText, setRepostText]       = useState('');
  const [postingRepost, setPostingRepost] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedFile, setAttachedFile]   = useState<string | null>(null);
  const [uploading, setUploading]         = useState(false);
  const [fullscreenMedia, setFullscreenMedia]     = useState<any | null>(null);
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
        videoMaxDuration: 120, // 2 min max
      });
      if (!result.canceled) {
        setUploading(true);
        const asset = result.assets[0];
        const isVideo = asset.type === 'video' || (asset.mimeType || '').startsWith('video/');
        const ext    = isVideo ? 'mp4' : 'jpg';
        const mime   = isVideo ? (asset.mimeType || 'video/mp4') : (asset.mimeType || 'image/jpeg');
        const filename = `forum_media_${Date.now()}.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri: asset.uri, name: filename, type: mime } as any);
        formData.append('folder', 'forum');
        try {
          const res: any = await uploadAPI.upload(formData);
          if (res?.url) setAttachedImage(res.url);  // re-uses same state; PostCard handles video
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
    loadPosts(sortMode);
    loadStats();
    loadTrending();
  }, []);

  const loadPosts = async (sort: string = sortMode) => {
    try {
      setLoading(true);
      if (user?.id) {
        const [res, savedRes]: any = await Promise.all([
          forumAPI.getQuestions({ sort }),
          forumAPI.getSavedPosts().catch(() => ({ questions: [] }))
        ]);
        setPosts(res.questions || []);
        const svd = new Set<number>((savedRes?.questions || []).map((q: any) => q.id));
        setSavedPosts(svd);
      } else {
        const res: any = await forumAPI.getQuestions({ sort });
        setPosts(res.questions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res: any = await forumAPI.getForumStats();
      setStats(res?.stats || null);
    } catch {}
  };

  const loadTrending = async () => {
    try {
      const res: any = await forumAPI.getTrending();
      setTrending(res?.trending || []);
    } catch {}
  };

  const handleLike = useCallback(async (id: number) => {
    const isLiked = likedPosts.has(id);
    const wasDisliked = dislikedPosts.has(id);

    setPosts(prev => prev.map(p => {
      if (p.id !== id) return p;
      let newLikes = (p.likes_count || 0);
      let newDislikes = (p.dislikes_count || 0);
      
      if (isLiked) {
        newLikes = Math.max(0, newLikes - 1);
      } else {
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

    try {
      await forumAPI.likeQuestion(id);
    } catch {}
  }, [likedPosts, dislikedPosts]);

  const handleDislike = useCallback(async (id: number) => {
    const isDisliked = dislikedPosts.has(id);
    const wasLiked = likedPosts.has(id);

    setPosts(prev => prev.map(p => {
      if (p.id !== id) return p;
      let newLikes = p.likes_count || 0;
      let newDislikes = p.dislikes_count || 0;

      if (isDisliked) {
        newDislikes = Math.max(0, newDislikes - 1);
      } else {
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
  }, [likedPosts, dislikedPosts]);

  const handleSave = useCallback(async (id: number) => {
    const isSaved = savedPosts.has(id);
    if (isSaved) setSavedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
    else setSavedPosts(prev => new Set(prev).add(id));
    try { await forumAPI.savePost(id); }
    catch {
      if (isSaved) setSavedPosts(prev => new Set(prev).add(id));
      else setSavedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, [savedPosts]);

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

  const handlePost = async () => {
    const text = newPostText.trim();
    // Allow posting if: sharing (repost), has text, or has an attached image/file
    if (!sharingPost && !text && !attachedImage) return;
    try {
      setPosting(true);
      const questionText = sharingPost
        ? (text || 'مشاركة')   // non-empty fallback for DB
        : (text || '');        // image-only posts send empty string; backend accepts it
      // createQuestion returns the new post — capture its ID for the notification link
      const createRes: any = await forumAPI.createQuestion({
        question: questionText,
        category: sharingPost ? 'الكل' : postCategory,
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
      setPostCategory('الكل');
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

  const toggleReplies = useCallback(async (answerId: number) => {
    if (expandedReplies.has(answerId)) {
      setExpandedReplies(prev => { const n = new Set(prev); n.delete(answerId); return n; });
    } else {
      setExpandedReplies(prev => new Set(prev).add(answerId));
      if (!replies[answerId]) {
        setLoadingReplies(prev => new Set(prev).add(answerId));
        try {
          const res: any = await forumAPI.getReplies(answerId);
          setReplies(prev => ({ ...prev, [answerId]: res.replies || [] }));
        } catch {} finally {
          setLoadingReplies(prev => { const n = new Set(prev); n.delete(answerId); return n; });
        }
      }
    }
  }, [expandedReplies, replies]);

  const submitAnswer = useCallback(async () => {
    if (!answerText.trim() || !commentPost) return;
    const targetReplyId = replyingTo?.answerId ?? null;
    setPostingAnswer(true);
    try {
      const text = replyingTo ? `@${replyingTo.name.replace(/\s+/g, '_')} ${answerText.trim()}` : answerText.trim();
      await forumAPI.createAnswer(commentPost.id, text, targetReplyId ?? undefined);
      setAnswerText('');
      setReplyingTo(null);
      const res: any = await forumAPI.getAnswers(commentPost.id);
      setAnswers(res.answers || []);
      if (targetReplyId !== null) {
        setReplies(prev => { const next = { ...prev }; delete next[targetReplyId]; return next; });
        setExpandedReplies(prev => new Set(prev).add(targetReplyId));
        try {
          const repRes: any = await forumAPI.getReplies(targetReplyId);
          setReplies(prev => ({ ...prev, [targetReplyId]: repRes.replies || [] }));
        } catch {}
      }
      setPosts(prev => prev.map(p => p.id === commentPost.id ? { ...p, answer_count: (p.answer_count || 0) + 1 } : p));
    } catch {} finally { setPostingAnswer(false); }
  }, [answerText, commentPost, replyingTo]);

  const handleLikeAnswer = useCallback(async (answerId: number) => {
    const isLiked = likedAnswers.has(answerId);
    const wasDisliked = dislikedAnswers.has(answerId);

    setAnswers(prev => prev.map((a: any) => {
      if (a.id !== answerId) return a;
      let newLikes = a.likes_count || 0;
      let newDislikes = a.dislikes_count || 0;
      if (isLiked) newLikes = Math.max(0, newLikes - 1);
      else {
        newLikes++;
        if (wasDisliked) newDislikes = Math.max(0, newDislikes - 1);
      }
      return { ...a, likes_count: newLikes, dislikes_count: newDislikes };
    }));

    if (isLiked) setLikedAnswers(prev => { const n = new Set(prev); n.delete(answerId); return n; });
    else {
      setLikedAnswers(prev => new Set(prev).add(answerId));
      if (wasDisliked) setDislikedAnswers(prev => { const n = new Set(prev); n.delete(answerId); return n; });
    }
    try { await forumAPI.likeAnswer(answerId); } catch {}
  }, [likedAnswers, dislikedAnswers]);

  const handleDislikeAnswer = useCallback(async (answerId: number) => {
    const isDisliked = dislikedAnswers.has(answerId);
    const wasLiked = likedAnswers.has(answerId);

    setAnswers(prev => prev.map((a: any) => {
      if (a.id !== answerId) return a;
      let newLikes = a.likes_count || 0;
      let newDislikes = a.dislikes_count || 0;
      if (isDisliked) newDislikes = Math.max(0, newDislikes - 1);
      else {
        newDislikes++;
        if (wasLiked) newLikes = Math.max(0, newLikes - 1);
      }
      return { ...a, likes_count: newLikes, dislikes_count: newDislikes };
    }));

    if (isDisliked) setDislikedAnswers(prev => { const n = new Set(prev); n.delete(answerId); return n; });
    else {
      setDislikedAnswers(prev => new Set(prev).add(answerId));
      if (wasLiked) setLikedAnswers(prev => { const n = new Set(prev); n.delete(answerId); return n; });
    }
    try { await forumAPI.dislikeAnswer(answerId); } catch {}
  }, [likedAnswers, dislikedAnswers]);

  // Repost — opens compose modal for sharing inside the app
  const handleShare = useCallback((post: any) => {
    setNewPostText('');        
    setAttachedImage(null);
    setAttachedFile(null);
    setSharingPost(post);      
    setModalOpen(true);
  }, []);

  // Share Externally — triggers native share sheet (Facebook, WhatsApp, etc)
  const handleNativeShare = useCallback(async (post: any) => {
    try {
      const url = `https://wakeel.app/post/${post.id}`
      const message = `✨ ${post.asked_by || 'مستخدم'}\n`
        + `💡 ${post.question || 'شارك في مجتمع وكيل'}\n\n`
        + `🔗 ألقِ نظرة على وكيل: ${url}`;
      await Share.share({
        message: message,
        title: 'Wakeel App'
      });
    } catch (e) {
      console.error(e);
    }
    setMenuPost(null); // close menu if open
  }, []);


  return (
    <View style={{ flex: 1, backgroundColor: feedBg }}>

      <Animated.FlatList
        data={posts}
        keyExtractor={p => p.id.toString()}
        refreshing={loading}
        onRefresh={() => loadPosts(sortMode)}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={6}
        updateCellsBatchingPeriod={50}
        viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
        onViewableItemsChanged={useCallback(({ viewableItems }: any) => {
          DeviceEventEmitter.emit('visible_posts', viewableItems.map((v: any) => v.item.id));
        }, [])}

        ListHeaderComponent={
          <>
            {/* 1. The Social Composer */}
            <View style={{ paddingVertical: 14, paddingHorizontal: 16, marginBottom: 6, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#D3D6DB' }}>
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
            </View>

            {/* 2. Feed Controls (Sort & Saved) */}
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#EBEDF0', marginBottom: 8 }}>
              {/* Filter Tabs */}
              <View style={{ flex: 1, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                {([
                  ['hot',    '🔥', isRTL ? 'رائج'   : 'Hot'],
                  ['top',    '⭐', isRTL ? 'الأعلى' : 'Top'],
                  ['new',    '✨', isRTL ? 'جديد'   : 'New'],
                  ['rising', '📈', isRTL ? 'صاعد'   : 'Rising'],
                ] as const).map(([mode, icon, label]) => (
                  <TouchableOpacity key={mode}
                    onPress={() => { setSortMode(mode); loadPosts(mode); }}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      gap: 4, paddingVertical: 12,
                      borderBottomWidth: 3,
                      borderBottomColor: sortMode === mode ? C.gold : 'transparent' }}>
                    <Text style={{ fontSize: 13 }}>{icon}</Text>
                    <Text style={{ fontSize: 12, fontWeight: sortMode === mode ? '800' : '500',
                      color: sortMode === mode ? C.gold : '#888' }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Saved Posts Action (Edge) */}
              <View style={{ width: 1, height: 24, backgroundColor: '#E5E7EB', marginHorizontal: 2 }} />
              <TouchableOpacity onPress={() => router.push('/saved-posts' as any)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="bookmark-outline" size={22} color={C.text} />
              </TouchableOpacity>
            </View>
          </>
        }

        renderItem={useCallback(({ item: p }: any) => {
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

          return (
            <PostCard
              key={p.id}
              p={p}
              C={C}
              user={user}
              isRTL={isRTL}
              liked={likedPosts.has(p.id)}
              disliked={dislikedPosts.has(p.id)}
              saved={savedPosts.has(p.id)}
              onLike={handleLike}
              onDislike={handleDislike}
              onSave={handleSave}
              onComment={openComments}
              onShare={handleShare}
              onNativeShare={handleNativeShare}
              onMediaTap={setFullscreenMedia}
              onMenuTap={setMenuPost}
              onReactorsTap={openReactors}
              catStyle={catStyle}
            />
          );
        }, [posts, likedPosts, dislikedPosts, savedPosts, C, user, isRTL])}
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

      {/* ─── Create Post Modal ─────────────────────────────────────────── */}
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.surface }}>
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
          {/* Modal Header */}
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <TouchableOpacity onPress={() => { setModalOpen(false); setSharingPost(null); setNewPostText(''); setAttachedImage(null); }}>
              <Text style={{ color: C.text, fontSize: 16 }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', fontFamily: 'Cairo-Bold' }}>
              {sharingPost ? (isRTL ? '🔁 إعادة نشر' : '🔁 Repost') : (isRTL ? 'إنشاء منشور' : 'New Post')}
            </Text>
            {/* نشر: always enabled when sharing (caption is optional like LinkedIn), requires text for new posts */}
            <TouchableOpacity onPress={handlePost} disabled={(sharingPost ? false : (!newPostText.trim() && !attachedImage)) || posting}>
              <Text style={{ color: ((sharingPost ? false : (!newPostText.trim() && !attachedImage)) || posting) ? C.muted : C.gold, fontSize: 16, fontWeight: '700' }}>
                {posting ? '...' : (isRTL ? 'نشر' : 'Post')}
              </Text>
            </TouchableOpacity>
          </View>
          
          <View style={{ padding: 16, flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 }}>
            <Avatar C={C} initials={user?.name ? user.name.substring(0,2).toUpperCase() : 'ME'} size={44} />
            <Text style={{ fontWeight: '700', fontSize: 16, color: C.text, marginTop: 10 }}>
              {user?.name || (isRTL ? 'أنت' : 'You')}
            </Text>
          </View>

          <MentionInput
            value={newPostText}
            onChangeText={setNewPostText}
            placeholder={sharingPost
              ? (isRTL ? 'أضف تعليقك (اختياري)...' : 'Add a comment (optional)...')
              : (isRTL ? 'بم تفكر؟ نصيحة، أو سؤال قانوني...' : "What's on your mind? A legal question or tip...")}
            placeholderTextColor={C.muted}
            gold={C.gold}
            maxHeight={160}
            style={{ paddingHorizontal: 20, paddingTop: 12 }}
            inputStyle={{ fontSize: 18, color: C.text, textAlignVertical: 'top', minHeight: 80 }}
          />

          {/* Category selector strip (only for non-reposts) */}
          {!sharingPost && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ maxHeight: 52, flexGrow: 0 }}
              contentContainerStyle={{
                paddingHorizontal: 16, paddingVertical: 8, gap: 8,
                flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap',
              }}>
              {['الكل', 'جنائي', 'تجاري', 'عقاري', 'أسرة', 'عمالي', 'إداري', 'دستوري'].map(cat => {
                const cs = catStyle(cat);
                const active = postCategory === cat;
                return (
                  <TouchableOpacity key={cat} onPress={() => setPostCategory(cat)}
                    style={{
                      height: 32, paddingHorizontal: 14, borderRadius: 16, flexShrink: 0,
                      backgroundColor: active ? cs.text : cs.bg,
                      borderWidth: 1.5, borderColor: active ? cs.text : cs.bg,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : cs.text }}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

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
              <AutoSizingImage uri={attachedImage} />
              {attachedFile && <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>📎 {attachedFile}</Text>}
              <TouchableOpacity onPress={() => { setAttachedImage(null); setAttachedFile(null); }}
                style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom Toolbar */}
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 20 }}>
            <TouchableOpacity onPress={pickImage} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 22 }}>📸</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>صورة</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickFile} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 22 }}>📎</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>ملف</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled style={{ flexDirection: 'row', alignItems: 'center', gap: 5, opacity: 0.4 }}>
              <Text style={{ fontSize: 22 }}>🎙️</Text>
              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600' }}>قريباً</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Comment / Thread Modal ─────────────────────────────────────── */}
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
              <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={C.gold} /></View>
            ) : (
              <FlatList
                data={answers}
                keyExtractor={(item: any) => String(item.id)}
                contentContainerStyle={{ paddingBottom: 60 }}
                ListHeaderComponent={
                  <>
                    {commentPost && (
                      <View style={{ marginBottom: 16 }}>
                        <PostCard
                          p={commentPost}
                          C={C}
                          user={user}
                          isRTL={isRTL}
                          liked={likedPosts.has(commentPost.id)}
                          disliked={dislikedPosts.has(commentPost.id)}
                          saved={savedPosts.has(commentPost.id)}
                          onLike={handleLike}
                          onDislike={handleDislike}
                          onSave={handleSave}
                          onComment={() => {}}
                          onShare={handleShare}
                          onNativeShare={handleNativeShare}
                          onMediaTap={setFullscreenMedia}
                          onMenuTap={setMenuPost}
                          onReactorsTap={openReactors}
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
                      <InitialsAvatar name={a.lawyer_name} size={30} gold={C.gold} />
                      <View style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontWeight: '700', color: C.text }}>{a.lawyer_name || 'مستخدم'}</Text>
                        {a.lawyer_role === 'lawyer' && <Text style={{ color: C.gold, fontSize: 10 }}>⚖️</Text>}
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
                <Text style={{ color: C.muted, fontSize: 12, fontFamily: 'Cairo-Regular' }} numberOfLines={1}>الرد على: {replyingTo.name}</Text>
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
                style={{ flex: 1, backgroundColor: C.bg, color: C.text, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, textAlign: isRTL ? 'right' : 'left', fontFamily: 'Cairo-Regular', fontSize: 14, borderWidth: 1, borderColor: C.border }}
              />
              <TouchableOpacity onPress={submitAnswer} disabled={!answerText.trim() || postingAnswer}
                style={{ backgroundColor: answerText.trim() ? C.gold : C.border, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}>
                {postingAnswer
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Ionicons name="send" size={18} color="#FFF" />}
              </TouchableOpacity>
            </View>
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
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', fontFamily: 'Cairo-Bold' }}>
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

      {/* ─── Immersive Fullscreen Media Viewer (Like TikTok / FB) ──────── */}
      <Modal visible={!!fullscreenMedia} transparent animationType="fade" onRequestClose={() => setFullscreenMedia(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.98)', justifyContent: 'center' }}>
          
          {/* Close Header */}
          <View style={{ position: 'absolute', top: insets.top || 20, left: 0, right: 0, zIndex: 10, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 }}>
            <TouchableOpacity onPress={() => setFullscreenMedia(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '200' }}>✕</Text>
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
              <InitialsAvatar name={fullscreenMedia?.asked_by} size={32} gold={C.gold} />
              <View>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{fullscreenMedia?.asked_by || 'مستخدم'}</Text>
                {fullscreenMedia?.created_at && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{timeAgo(fullscreenMedia.created_at)}</Text>}
              </View>
            </View>
          </View>

          {/* Media Content */}
          <TouchableOpacity activeOpacity={1} onPress={() => setFullscreenMedia(null)} style={{ flex: 1 }}>
            {fullscreenMedia && !!fullscreenMedia.image_url?.match(/\.(mp4|mov|webm)$/i) ? (
              <Video 
                source={{ uri: fullscreenMedia.image_url }} 
                style={{ width: '100%', height: '100%' }} 
                resizeMode={ResizeMode.CONTAIN} 
                shouldPlay 
                isLooping 
                useNativeControls={false} 
              />
            ) : fullscreenMedia ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <AutoSizingImage uri={fullscreenMedia.image_url} />
              </View>
            ) : null}
          </TouchableOpacity>

          {/* Interaction Bar Overlay (Bottom) */}
          {fullscreenMedia && (
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
              {/* Subtle Dark Wash for Text Readability */}
              <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', backgroundColor: 'rgba(0,0,0,0.45)' }} pointerEvents="none" />
              
              <View style={{ paddingBottom: (insets.bottom || 20) + 12, paddingTop: 40, paddingHorizontal: 20 }}>
                {/* Post Caption (TikTok / FB Native Caption) */}
                {fullscreenMedia.question && fullscreenMedia.question !== 'مشاركة' && (
                  <ScrollView style={{ maxHeight: 120, marginBottom: 16 }} showsVerticalScrollIndicator={false}>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', lineHeight: 24, textAlign: 'right', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>
                      {fullscreenMedia.question}
                    </Text>
                  </ScrollView>
                )}

                {/* Interaction Action Row */}
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Vote Cluster */}
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 24, paddingHorizontal: 6, paddingVertical: 4 }}>
                  <TouchableOpacity onPress={() => handleLike(fullscreenMedia.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8, borderRadius: 18, backgroundColor: likedPosts.has(fullscreenMedia.id) ? '#FF450030' : 'transparent' }}>
                    <Ionicons name="arrow-up" size={22} color={likedPosts.has(fullscreenMedia.id) ? '#FF4500' : '#FFF'} />
                  </TouchableOpacity>
                  <Text style={{ color: likedPosts.has(fullscreenMedia.id) ? '#FF4500' : dislikedPosts.has(fullscreenMedia.id) ? '#7193FF' : '#FFF', fontSize: 14, fontWeight: '800', minWidth: 24, textAlign: 'center' }}>
                    {((fullscreenMedia.likes_count || 0) - (fullscreenMedia.dislikes_count || 0)) > 0 ? `+${(fullscreenMedia.likes_count || 0) - (fullscreenMedia.dislikes_count || 0)}` : (fullscreenMedia.likes_count || 0) - (fullscreenMedia.dislikes_count || 0)}
                  </Text>
                  <TouchableOpacity onPress={() => handleDislike(fullscreenMedia.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ padding: 8, borderRadius: 18, backgroundColor: dislikedPosts.has(fullscreenMedia.id) ? '#7193FF30' : 'transparent' }}>
                    <Ionicons name="arrow-down" size={22} color={dislikedPosts.has(fullscreenMedia.id) ? '#7193FF' : '#FFF'} />
                  </TouchableOpacity>
                </View>

                {/* Comment */}
                <TouchableOpacity onPress={() => { setFullscreenMedia(null); openComments(fullscreenMedia); }} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="chatbubble-outline" size={22} color="#FFF" />
                  </View>
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>{(fullscreenMedia.answer_count || 0) > 0 ? fullscreenMedia.answer_count : 'تعليق'}</Text>
                </TouchableOpacity>

                {/* Repost (Share) */}
                <TouchableOpacity onPress={() => { setFullscreenMedia(null); handleShare(fullscreenMedia); }} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="repeat" size={24} color="#FFF" />
                  </View>
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>نشر</Text>
                </TouchableOpacity>

                {/* Save */}
                <TouchableOpacity onPress={() => handleSave(fullscreenMedia.id)} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={savedPosts.has(fullscreenMedia.id) ? 'bookmark' : 'bookmark-outline'} size={22} color={savedPosts.has(fullscreenMedia.id) ? C.gold : '#FFF'} />
                  </View>
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>حفظ</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          )}

        </View>
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
                onPress={() => {
                  setMenuPost(null);
                  menuPost && handleNativeShare(menuPost);
                }}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}>
                <Text style={{ fontSize: 22 }}>📤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, textAlign: 'right' }}>مشاركة خارجية</Text>
                  <Text style={{ color: C.muted, fontSize: 12, textAlign: 'right' }}>إرسال لفيسبوك وتطبيقات أخرى</Text>
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
                  setMenuPost(null);
                  menuPost && handleNativeShare(menuPost);
                }}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16 }}>
                <Text style={{ fontSize: 22 }}>📤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, textAlign: 'right' }}>مشاركة خارجية</Text>
                  <Text style={{ color: C.muted, fontSize: 12, textAlign: 'right' }}>إرسال لفيسبوك وتطبيقات أخرى</Text>
                </View>
              </TouchableOpacity>
              <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 16 }} />
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
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', fontFamily: 'Cairo-Bold' }}>✏️ تعديل المنشور</Text>
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
