// ─── Wakeel — LawyerPostsTab (Chunk 3c) ──────────────────────────────────────
// Reusable list of a user's forum posts. Designed to drop into a profile page
// (lawyer/[id].tsx or user/[id].tsx) as a tab body. Self-contained: it
// fetches its own data once on mount.
//
// Why a separate component? The chunk 2.1 lawyer/[id].tsx has substantial
// per-deployment customization (office map, pricing cards, etc.) that the
// 3c chunk shouldn't risk overwriting. Cleaner to ship a drop-in.
//
// Usage:
//   <LawyerPostsTab userId={lawyerId} />
//
// Each row navigates to /post/[id] for the full-thread view. Hashtags
// remain tappable inside post bodies (HashtagText).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';
import { forumAPI } from '../../services/api';
import HashtagText from '../HashtagText';

function timeAgoSimple(iso: string, isRTL: boolean) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2)  return isRTL ? 'الآن' : 'now';
  if (m < 60) return isRTL ? `منذ ${m} د` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return isRTL ? `منذ ${h} س` : `${h}h`;
  const d = Math.floor(h / 24);
  return isRTL ? `منذ ${d} يوم` : `${d}d`;
}

interface Props {
  userId: string | number;
  /** Optional empty-state caption */
  emptyText?: string;
}

export function LawyerPostsTab({ userId, emptyText }: Props) {
  const C = useTheme();
  const { isRTL } = useI18n();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded,  setLoaded]  = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res: any = await forumAPI.getUserPosts(userId);
      setPosts(res?.questions || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (!loaded && loading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  if (loaded && posts.length === 0) {
    return (
      <View style={{ paddingVertical: 50, alignItems: 'center' }}>
        <Text style={{ fontSize: 36, marginBottom: 8 }}>📝</Text>
        <Text style={{ color: C.muted, fontSize: 14 }}>
          {emptyText || (isRTL ? 'لا توجد مشاركات بعد' : 'No posts yet')}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(p: any) => String(p.id)}
      scrollEnabled={false}  // assumes parent provides scroll
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />
      }
      contentContainerStyle={{ paddingVertical: 8 }}
      renderItem={({ item: p }) => (
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } } as any)}
          activeOpacity={0.85}
          style={{
            backgroundColor: C.card,
            marginHorizontal: 12, marginBottom: 8,
            padding: 14, borderRadius: 12,
            borderWidth: 1, borderColor: C.border,
          }}
        >
          <Text style={{ color: C.muted, fontSize: 11, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>
            {timeAgoSimple(p.created_at, isRTL)}{p.category ? ` · ${p.category}` : ''}
          </Text>
          <HashtagText
            text={p.question || ''}
            style={{
              color: C.text, fontSize: 14, lineHeight: 21,
              fontFamily: 'Cairo-Regular',
              textAlign: isRTL ? 'right' : 'left',
            }}
            goldColor={C.gold}
            numberOfLines={4}
          />
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 18, marginTop: 10 }}>
            <Text style={{ color: C.muted, fontSize: 12 }}>↑ {p.likes_count || 0}</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>💬 {p.answer_count || 0}</Text>
            {(p.shares_count || 0) > 0 && (
              <Text style={{ color: C.muted, fontSize: 12 }}>🔁 {p.shares_count}</Text>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
