import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Modal, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, TextInput, Dimensions, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { forumAPI } from '../../src/services/api';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/i18n';
import HashtagText from '../../src/components/HashtagText';

// Helpers
function timeAgo(dateString: string) {
  const d = new Date(dateString);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'الآن';
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const days = Math.floor(h / 24);
  return `منذ ${days} يوم`;
}

function InitialsAvatar({ name, size, gold }: { name: string; size: number; gold: string }) {
  if (!name) name = 'مستخدم';
  const c1 = name.charAt(0);
  const pts = name.split(' ');
  const c2 = pts.length > 1 ? pts[1].charAt(0) : '';
  const init = (c1 + c2).toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: gold + '28', borderWidth: 1.5, borderColor: gold + '50',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <Text style={{ color: gold, fontSize: size * 0.45, fontWeight: '800' }}>{init}</Text>
    </View>
  );
}

export default function HashtagFeedScreen() {
  const { tag } = useLocalSearchParams();
  const router = useRouter();
  const C = useTheme();
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const feedBg = '#EBEDF0';

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  useEffect(() => {
    loadPosts();
  }, [tag]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const res: any = await forumAPI.getQuestions({ tag: tag as string });
      setPosts(res.questions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (id: number) => {
    const isLiked = likedPosts.has(id);
    if (isLiked) {
      setLikedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, likes_count: Math.max(0, (p.likes_count||1)-1) } : p));
    } else {
      setLikedPosts(prev => new Set(prev).add(id));
      setPosts(prev => prev.map(p => p.id === id ? { ...p, likes_count: (p.likes_count||0)+1 } : p));
    }
    try {
      const res: any = await forumAPI.likeQuestion(id);
      const serverCount = res?.question?.likes_count ?? res?.data?.question?.likes_count;
      if (serverCount !== undefined) {
        setPosts(prev => prev.map(p => p.id === id ? { ...p, likes_count: serverCount } : p));
      }
      const liked = res?.liked ?? res?.data?.liked;
      if (liked === false) setLikedPosts(prev => { const n = new Set(prev); n.delete(id); return n; });
      else if (liked === true) setLikedPosts(prev => new Set(prev).add(id));
    } catch {
      if (isLiked) setLikedPosts(prev => new Set(prev).add(id));
      else { setLikedPosts(prev => { const n = new Set(prev); n.delete(id); return n; }); }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: feedBg }}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <View style={{ paddingTop: insets.top + 16, backgroundColor: C.surface, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#D3D6DB' }}>
        <View style={{ paddingHorizontal: 16, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, color: C.text }}>{isRTL ? '→' : '←'}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0A66C2' }}>
            #{tag}
          </Text>
        </View>
      </View>

      <FlatList
        data={posts}
        keyExtractor={p => p.id.toString()}
        refreshing={loading}
        onRefresh={loadPosts}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={{ alignItems: 'center', paddingTop: 80, gap: 12 }}>
              <Text style={{ fontSize: 48 }}>🏷️</Text>
              <Text style={{ fontSize: 18, color: C.text, fontWeight: '600' }}>لا توجد منشورات بهذا الوسم</Text>
            </View>
          ) : null
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
            <View style={{ marginBottom: 8, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 }}>
              {isRepost && (
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 6, backgroundColor: feedBg }}>
                  <Text style={{ color: '#00000060', fontSize: 12 }}>🔁</Text>
                  <Text style={{ color: '#00000060', fontSize: 12, fontWeight: '600' }}>{p.asked_by || 'مستخدم'} أعاد النشر</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 12 }}>
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

                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#1A1A1A' }}>{p.asked_by || 'مستخدم'}</Text>
                    {p.user_role === 'lawyer' && (
                      <View style={{ backgroundColor: C.gold + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>⚖️ محامٍ</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: '#666', fontSize: 13, marginTop: 2, textAlign: 'right' }}>{p.category}</Text>
                  <Text style={{ color: '#999', fontSize: 12, marginTop: 2, textAlign: 'right' }}>{timeAgo(p.created_at)} · 🌐</Text>
                </View>
              </View>

              {p.question && p.question !== 'مشاركة' && (
                <HashtagText
                  text={p.question}
                  goldColor="#0A66C2"
                  style={{ paddingHorizontal: 16, paddingBottom: isRepost ? 10 : (p.image_url ? 10 : 14), fontSize: 15, lineHeight: 24, color: '#1A1A1A', textAlign: 'right' }}
                />
              )}

              {!isRepost && p.image_url && (
                <TouchableOpacity onPress={() => setLightboxUri(p.image_url)} activeOpacity={0.95}>
                  <Image source={{ uri: p.image_url }} style={{ width: '100%', height: 280, backgroundColor: '#E8E8E8' }} resizeMode="cover" />
                </TouchableOpacity>
              )}

              {isRepost && origData && (
                <TouchableOpacity onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.original_post_id } } as any)} activeOpacity={0.9} style={{ marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: '#D3D6DB', borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 12 }}>
                    <InitialsAvatar name={origData.authorName || 'U'} size={36} gold={C.gold} />
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: '#1A1A1A', fontWeight: '700', fontSize: 14 }}>{origData.authorName}</Text>
                        {origData.authorRole === 'lawyer' && <Text style={{ color: C.gold, fontSize: 10, fontWeight: '700' }}>⚖️ محامٍ</Text>}
                      </View>
                      <Text style={{ color: '#65676B', fontSize: 12 }}>{origData.category}</Text>
                    </View>
                  </View>
                  {origData.question && (
                    <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                      <HashtagText text={origData.question} goldColor="#0A66C2" numberOfLines={4} style={{ color: '#1A1A1A', fontSize: 14, lineHeight: 22, textAlign: 'right' }} />
                    </View>
                  )}
                  {origData.image_url && <Image source={{ uri: origData.image_url }} style={{ width: '100%', height: 160, backgroundColor: '#E8E8E8' }} resizeMode="cover" />}
                </TouchableOpacity>
              )}

              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 12 }}>💙</Text>
                  <Text style={{ color: '#65676B', fontSize: 13 }}>{p.likes_count || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
                  <Text style={{ color: '#65676B', fontSize: 13 }}>{p.answer_count || 0} تعليق</Text>
                  {p.shares_count > 0 && <Text style={{ color: '#65676B', fontSize: 13 }}>{p.shares_count} مشاركة</Text>}
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: '#EBEDF0', marginHorizontal: 16 }} />

              <View style={{ flexDirection: 'row-reverse', paddingHorizontal: 8, paddingVertical: 4 }}>
                <TouchableOpacity onPress={() => handleLike(p.id)} style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 18, color: liked ? '#0A66C2' : '#65676B' }}>{liked ? '👍' : '🤍'}</Text>
                  <Text style={{ color: liked ? '#0A66C2' : '#65676B', fontWeight: '600', fontSize: 13 }}>{isRTL ? 'أعجبني' : 'Like'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } } as any)} style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 18, color: '#65676B' }}>💬</Text>
                  <Text style={{ color: '#65676B', fontWeight: '600', fontSize: 13 }}>{isRTL ? 'تعليق' : 'Comment'}</Text>
                </TouchableOpacity>
                {!isRepost && (
                  <TouchableOpacity onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } } as any)} style={{ flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 18, color: '#65676B' }}>🔁</Text>
                    <Text style={{ color: '#65676B', fontWeight: '600', fontSize: 13 }}>{isRTL ? 'مشاركة' : 'Share'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity onPress={() => setLightboxUri(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }} activeOpacity={1}>
          <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '300' }}>✕</Text>
          </View>
          {lightboxUri && (
            <Image source={{ uri: lightboxUri }} style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 }} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
