// ─── Wakeel — ActivityFeed (Chunk 4a) ────────────────────────────────────────
// Renders the unified forum activity for a user. Each row is a small card:
//   • Action prefix in muted color: "💬 Commented on" / "👍 Liked" / "🔁 Reposted"
//   • Target post snippet (tappable → /post/[id])
//   • Time-ago indicator on the right
//
// Data shape (from backend):
//   { row_id, action_type, target_post_id, target_post_snippet,
//     target_post_author, ts, likes_count, answer_count }
//
// Action types: 'post' | 'repost' | 'comment' | 'like'
//
// Privacy: when the backend returns is_private:true, we render an empty
// state explaining the user keeps their activity private.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { usersAPI } from '../../services/api';
import HashtagText from '../HashtagText';

interface ActivityRow {
  row_id: string;
  action_type: 'post' | 'repost' | 'comment' | 'like';
  target_post_id: number;
  target_post_snippet: string;
  target_post_author?: string;
  ts: string;
  likes_count?: number;
  answer_count?: number;
}

function timeAgo(iso: string, isRTL: boolean) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2)  return isRTL ? 'الآن' : 'now';
  if (m < 60) return isRTL ? `منذ ${m} د` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return isRTL ? `منذ ${h} س` : `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return isRTL ? `منذ ${d}ي` : `${d}d`;
  const months = Math.floor(d / 30);
  return isRTL ? `منذ ${months}ش` : `${months}mo`;
}

function actionMeta(type: ActivityRow['action_type'], isRTL: boolean) {
  switch (type) {
    case 'post':    return { icon: '📝', label: isRTL ? 'نشر منشوراً'        : 'Posted'    };
    case 'repost':  return { icon: '🔁', label: isRTL ? 'أعاد نشر منشور'      : 'Reposted'   };
    case 'comment': return { icon: '💬', label: isRTL ? 'علّق على منشور'       : 'Commented on' };
    case 'like':    return { icon: '👍', label: isRTL ? 'أعجب بمنشور'         : 'Liked'      };
  }
}

interface Props {
  /** User whose activity to fetch */
  userId: string | number;
  /** Disable inner FlatList scrolling — when parent provides scroll */
  scrollEnabled?: boolean;
  /** Optional override for empty/private message */
  privateText?: string;
  emptyText?: string;
  /** When true (user is viewing their own profile), always show activity */
  isOwner?: boolean;
}

export function ActivityFeed({ userId, scrollEnabled = true, privateText, emptyText, isOwner = false }: Props) {
  const C = useTheme();
  const { isRTL } = useI18n();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setNextCursor(null);
    setHasMore(true);
    try {
      const res: any = await usersAPI.getActivity(userId, { limit: 25 });
      setRows(Array.isArray(res?.activity) ? res.activity : []);
      setNextCursor(res?.next_cursor || null);
      setHasMore(!!res?.has_more);
      setIsPrivate(!!res?.is_private);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const res: any = await usersAPI.getActivity(userId, { before: nextCursor, limit: 25 });
      const fresh: ActivityRow[] = Array.isArray(res?.activity) ? res.activity : [];
      setRows(prev => {
        const seen = new Set(prev.map(r => r.row_id));
        return [...prev, ...fresh.filter(r => !seen.has(r.row_id))];
      });
      setNextCursor(res?.next_cursor || null);
      setHasMore(!!res?.has_more);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }, [userId, loadingMore, loading, hasMore, nextCursor]);

  useEffect(() => { load(); }, [load]);

  if (!loaded && loading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator color={C.gold} />
      </View>
    );
  }

  if (isPrivate && !isOwner) {
    return (
      <View style={[styles.empty, { paddingVertical: 50 }]}>
        <Text style={{ fontSize: 36, marginBottom: 8 }}>🔒</Text>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 4, textAlign: 'center' }}>
          {isRTL ? 'النشاط خاص' : 'Activity is private'}
        </Text>
        <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', paddingHorizontal: 32 }}>
          {privateText || (isRTL
            ? 'اختار هذا المستخدم إخفاء نشاطه على المنتدى.'
            : 'This user has chosen to keep their forum activity private.')}
        </Text>
      </View>
    );
  }

  if (loaded && rows.length === 0) {
    return (
      <View style={[styles.empty, { paddingVertical: 50 }]}>
        <Text style={{ fontSize: 36, marginBottom: 8 }}>✨</Text>
        <Text style={{ color: C.muted, fontSize: 14 }}>
          {emptyText || (isRTL ? 'لا يوجد نشاط بعد' : 'No activity yet')}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.row_id}
      scrollEnabled={scrollEnabled}
      contentContainerStyle={{ paddingVertical: 8 }}
      refreshControl={
        <RefreshControl refreshing={loading && loaded} onRefresh={load} tintColor={C.gold} />
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={loadingMore ? (
        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
          <ActivityIndicator color={C.gold} size="small" />
        </View>
      ) : !hasMore && rows.length > 0 ? (
        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
          <Text style={{ color: C.muted, fontSize: 11 }}>
            {isRTL ? '— نهاية النشاط —' : '— End of activity —'}
          </Text>
        </View>
      ) : null}
      renderItem={({ item: r }) => {
        const meta = actionMeta(r.action_type, isRTL);
        return (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: r.target_post_id } } as any)}
            activeOpacity={0.85}
            style={[styles.row, { backgroundColor: C.surface, borderColor: C.border }]}
          >
            <View style={[styles.headerLine, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={{ fontSize: 13 }}>{meta.icon}</Text>
              <Text style={[styles.actionLabel, { color: C.muted, textAlign: isRTL ? 'right' : 'left' }]}>
                {meta.label}{r.target_post_author ? ` ${isRTL ? 'لـ' : '·'} ${r.target_post_author}` : ''}
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.timeAgo, { color: C.muted }]}>
                {timeAgo(r.ts, isRTL)}
              </Text>
            </View>

            <HashtagText
              text={r.target_post_snippet || ''}
              style={[styles.snippet, { color: C.text, textAlign: isRTL ? 'right' : 'left' }]}
              numberOfLines={3}
              goldColor={C.gold}
            />

            {(r.likes_count || r.answer_count) ? (
              <View style={[styles.statsLine, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {(r.likes_count || 0) > 0 && (
                  <Text style={[styles.stat, { color: C.muted }]}>↑ {r.likes_count}</Text>
                )}
                {(r.answer_count || 0) > 0 && (
                  <Text style={[styles.stat, { color: C.muted }]}>💬 {r.answer_count}</Text>
                )}
              </View>
            ) : null}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 12, marginBottom: 8,
    padding: 12, borderRadius: 12,
    borderWidth: 1,
  },
  headerLine: { alignItems: 'center', gap: 6, marginBottom: 6 },
  actionLabel: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  timeAgo: { fontSize: 11 },
  snippet: { fontSize: 14, lineHeight: 20, fontFamily: 'Cairo-Regular' },
  statsLine: { gap: 14, marginTop: 8 },
  stat: { fontSize: 11 },
  empty: { alignItems: 'center', justifyContent: 'center' },
});
