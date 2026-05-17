import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/hooks/useAuth';
import { useI18n } from '../src/i18n';
import { forumAPI, usersAPI } from '../src/services/api';
import { PostCard } from '../src/components/forum/PostCard';

function timeAgo(iso: string, isRTL: boolean) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2)  return isRTL ? 'الآن' : 'now';
  if (m < 60) return isRTL ? `منذ ${m} د` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return isRTL ? `منذ ${h} س` : `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return isRTL ? `منذ ${d}ي` : `${d}d`;
  return Math.floor(d / 30) + (isRTL ? 'ش' : 'mo');
}

export default function AllActivityScreen() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('Posts');
  const [posts, setPosts]         = useState<any[]>([]);
  const [comments, setComments]   = useState<any[]>([]);
  const [reactions, setReactions] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  const loadAll = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      // Posts tab — user's own posts
      const postsRes: any = await forumAPI.getUserPosts(user.id);
      const cleaned = (postsRes?.questions || []).map((p: any) => ({
        ...p,
        question: p.question ? p.question.replace(/\[إعادة نشر من.*?\]:\s*/g, '').trim() : ''
      }));
      setPosts(cleaned);

      // Activity feed contains comments and likes (via usersAPI.getActivity)
      const actRes: any = await usersAPI.getActivity(user.id, { limit: 50 });
      const activity: any[] = actRes?.activity || [];

      // Comments = action_type === 'comment'
      setComments(activity.filter((r: any) => r.action_type === 'comment'));

      // Reactions = action_type === 'like'
      setReactions(activity.filter((r: any) => r.action_type === 'like'));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const tabs = ['Posts', 'Comments', 'Reactions'];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{
        title: isRTL ? 'كل النشاط' : 'All activity',
        headerStyle: { backgroundColor: C.surface },
        headerTintColor: C.text,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: isRTL ? 0 : -8, marginRight: isRTL ? -8 : 0 }}>
            <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={C.text} />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView>
        {/* Followers header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 4 }}>{isRTL ? 'خاص بك' : 'Private to you'}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{isRTL ? 'المتابعون' : 'Followers'} ({(user as any)?.followers_count || 0})</Text>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={C.muted} />
          </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 }}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                borderColor: activeTab === tab ? C.gold : C.border,
                backgroundColor: activeTab === tab ? C.gold : 'transparent'
              }}>
              <Text style={{ color: activeTab === tab ? '#000' : C.text, fontWeight: '700', fontSize: 14 }}>
                {isRTL ? (tab === 'Posts' ? 'منشورات' : tab === 'Comments' ? 'تعليقات' : 'تفاعلات') : tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={C.gold} size="large" />
          </View>
        ) : activeTab === 'Posts' ? (
          // ── POSTS TAB ──────────────────────────────────────────────────────
          <View style={{ marginTop: 8 }}>
            {posts.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontSize: 14 }}>{isRTL ? 'لا يوجد منشورات بعد' : 'No posts yet'}</Text>
              </View>
            ) : posts.map(p => (
              <View key={p.id} style={{ marginBottom: 8, backgroundColor: C.surface }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
                  {user?.avatar_url || user?.avatar ? (
                    <Image source={{ uri: user.avatar_url || user.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                  ) : (
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.gold + '25', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: C.gold, fontSize: 12, fontWeight: '800' }}>{(user?.name || 'U').charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={{ color: C.text, fontSize: 14, flex: 1 }}>
                    <Text style={{ fontWeight: '700' }}>{user?.name}</Text>
                    <Text style={{ color: C.muted }}> {p.original_post_id ? (isRTL ? 'أعاد نشر هذا' : 'reposted this') : (isRTL ? 'نشر هذا' : 'posted this')}</Text>
                  </Text>
                  <Ionicons name="ellipsis-vertical" size={20} color={C.muted} />
                </View>
                <PostCard
                  p={p} C={C} user={user} isRTL={isRTL}
                  catStyle={() => ({ bg: C.gold + '18', text: C.gold })}
                  onComment={() => router.push({ pathname: '/post/[id]', params: { id: p.id } } as any)}
                  onLike={() => {}} onDislike={() => {}} onSave={() => {}} onShare={() => {}} onMediaTap={() => {}} onMenuTap={() => {}} onReactorsTap={() => {}}
                />
              </View>
            ))}
          </View>
        ) : activeTab === 'Comments' ? (
          // ── COMMENTS TAB ──────────────────────────────────────────────────
          <View style={{ marginTop: 8 }}>
            {comments.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontSize: 14 }}>{isRTL ? 'لا يوجد تعليقات بعد' : 'No comments yet'}</Text>
              </View>
            ) : comments.map((r: any) => (
              <TouchableOpacity key={r.row_id} activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/post/[id]', params: { id: r.target_post_id } } as any)}
                style={{ backgroundColor: C.surface, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {user?.avatar_url || user?.avatar ? (
                    <Image source={{ uri: user.avatar_url || user.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                  ) : (
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.gold + '25', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: C.gold, fontSize: 12, fontWeight: '800' }}>{(user?.name || 'U').charAt(0)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14 }}>
                      <Text style={{ fontWeight: '700' }}>{user?.name}</Text>
                      <Text style={{ color: C.muted }}> {isRTL ? 'علّق على منشور' : 'commented on a post'}</Text>
                      {r.target_post_author ? <Text style={{ color: C.muted }}>{isRTL ? ' لـ' : ' by'} {r.target_post_author}</Text> : null}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{timeAgo(r.ts, isRTL)}</Text>
                  </View>
                </View>
                {/* Original post snippet */}
                <View style={{ backgroundColor: C.bg, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: C.gold }}>
                  <Text style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{isRTL ? 'المنشور الأصلي' : 'Original post'}</Text>
                  <Text style={{ color: C.text, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
                    {r.target_post_snippet || '—'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          // ── REACTIONS TAB ─────────────────────────────────────────────────
          <View style={{ marginTop: 8 }}>
            {reactions.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontSize: 14 }}>{isRTL ? 'لا يوجد تفاعلات بعد' : 'No reactions yet'}</Text>
              </View>
            ) : reactions.map((r: any) => (
              <TouchableOpacity key={r.row_id} activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/post/[id]', params: { id: r.target_post_id } } as any)}
                style={{ backgroundColor: C.surface, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {user?.avatar_url || user?.avatar ? (
                    <Image source={{ uri: user.avatar_url || user.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                  ) : (
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.gold + '25', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: C.gold, fontSize: 12, fontWeight: '800' }}>{(user?.name || 'U').charAt(0)}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: 14 }}>
                      <Text style={{ fontWeight: '700' }}>{user?.name}</Text>
                      <Text style={{ color: C.muted }}> {isRTL ? '👍 أعجب بمنشور' : '👍 liked a post'}</Text>
                      {r.target_post_author ? <Text style={{ color: C.muted }}>{isRTL ? ' لـ' : ' by'} {r.target_post_author}</Text> : null}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{timeAgo(r.ts, isRTL)}</Text>
                  </View>
                </View>
                {/* Post snippet */}
                <View style={{ backgroundColor: C.bg, borderRadius: 10, padding: 12, borderLeftWidth: 3, borderLeftColor: C.gold + '80' }}>
                  <Text style={{ color: C.text, fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
                    {r.target_post_snippet || '—'}
                  </Text>
                  {(r.likes_count || 0) > 0 && (
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>👍 {r.likes_count}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
