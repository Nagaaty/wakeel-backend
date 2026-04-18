import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  LayoutAnimation, UIManager, Platform, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { Empty } from '../../src/components/ui';
import { notificationsAPI, forumAPI } from '../../src/services/api';
import {
  getNotificationPermissionStatus,
  registerForPushNotifications,
} from '../../src/utils/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListSkeleton } from '../../src/components/Skeleton';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SOCIAL_TYPES   = new Set(['forum_like', 'forum_comment', 'forum_share']);
const SYSTEM_TYPES   = new Set(['booking', 'payment', 'reminder', 'broadcast', 'system', 'review']);

const TYPE_BADGE: Record<string, string> = {
  booking:       '📅', payment:      '💰', message:    '💬',
  review:        '⭐', system:        '🔔', reminder:   '⏰', broadcast: '📣',
  forum_like:    '👍', forum_comment: '💬', forum_share:'🔁',
};

/** Strip "مشاركة" placeholder and other garbage from notification body preview */
function cleanNotifBody(body: string | null | undefined): string {
  if (!body) return '';
  // Remove surrounding quotes if present
  const stripped = body.replace(/^[""](.*)[""]$/, '$1').trim();
  if (!stripped || stripped === 'مشاركة' || stripped === 'مشاركة.') return 'منشورك الأصلي';
  return stripped;
}


// ── Parse actor name from notification title e.g. "💬 Omar liked your post"
function extractActorName(title: string): string {
  // Title format: "emoji name action" — strip leading emoji + space
  const cleaned = title.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+/u, '').trim();
  // First word(s) before action verbs
  const firstVerb = cleaned.search(/(أعجبه|علّق|أعاد|liked|commented|shared|reacted)/u);
  return firstVerb > 0 ? cleaned.substring(0, firstVerb).trim() : cleaned.split(' ').slice(0, 2).join(' ');
}

// ── Avatar component — shows photo if available, else initials ring
function NotifAvatar({ url, name, size = 48, gold, bg }: {
  url?: string | null; name?: string; size?: number; gold: string; bg: string;
}) {
  const initials = (name || '?').split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase();
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#ddd' }} />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: gold + '25',
      borderWidth: 2, borderColor: gold + '80',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: gold, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

// ── Wakeel "W" circle for system notifications
function WakeelAvatar({ size = 48, gold }: { size?: number; gold: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: gold, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#1a1a2e', fontWeight: '900', fontSize: size * 0.4 }}>W</Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const C      = useTheme();
  const insets = useSafeAreaInsets();

  const [notifs,     setNotifs]     = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState<'all' | 'unread'>('all');
  const [permStatus, setPermStatus] = useState<string>('granted');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { getNotificationPermissionStatus().then(setPermStatus); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const d: any = await notificationsAPI.getAll();
      setNotifs(Array.isArray(d) ? d : d?.notifications || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => {
    await notificationsAPI.markRead(id).catch(() => {});
    setNotifs(p => p.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAll = async () => {
    await notificationsAPI.markAllRead().catch(() => {});
    setNotifs(p => p.map(n => ({ ...n, is_read: true })));
  };

  // Social → deep-link to the specific post page (LinkedIn/Facebook style)
  // System → expand inline panel
  const handleTap = async (n: any) => {
    if (!n.is_read) markRead(n.id);
    if (SOCIAL_TYPES.has(n.type)) {
      const d = n.data
        ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data)
        : {};

      // ── forum_share: ALWAYS navigate to the reposter's post, not the original ──
      // Look up the repost created by actorId of originalPostId in real time.
      // This fixes both old notifications (wrong link in DB) and new ones.
      if (n.type === 'forum_share') {
        const actorId       = d?.actorId;
        const originalPostId = d?.originalPostId || d?.postId;
        if (actorId && originalPostId) {
          try {
            const res: any = await forumAPI.getRepostByUser(originalPostId, actorId);
            const repostId = res?.repost_id || res?.data?.repost_id;
            if (repostId) {
              router.push({ pathname: '/post/[id]', params: { id: String(repostId) } } as any);
              return;
            }
          } catch {}
        }
        // Fallback: try link field
        if (n.link && n.link.startsWith('/post/')) {
          router.push({ pathname: '/post/[id]', params: { id: n.link.replace('/post/', '') } } as any);
          return;
        }
        router.push('/(tabs)/forum' as any);
        return;
      }

      // ── forum_like / forum_comment: go to the post directly ──
      let postId: string | null = d?.postId ? String(d.postId) : null;
      if (!postId && n.link && n.link.startsWith('/post/')) {
        postId = n.link.replace('/post/', '');
      }
      if (postId) {
        router.push({ pathname: '/post/[id]', params: { id: postId } } as any);
      } else {
        router.push('/(tabs)/forum' as any);
      }
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => prev === n.id ? null : n.id);
  };

  const filtered  = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs;
  const unreadCnt = notifs.filter(n => !n.is_read).length;

  const timeAgo = (iso: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'الآن';
    if (mins < 60) return `${mins}د`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}س`;
    const days = Math.floor(hrs / 24);
    if (days < 7)  return `${days}ي`;
    return `${Math.floor(days / 7)}أ`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: C.surface,
        paddingTop: insets.top + 4,
        paddingHorizontal: 16, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 20, fontFamily: 'CormorantGaramond-Bold' }}>الإشعارات</Text>
            {unreadCnt > 0 && (
              <View style={{ backgroundColor: '#e74c3c', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{unreadCnt}</Text>
              </View>
            )}
          </View>
          {unreadCnt > 0 && (
            <TouchableOpacity onPress={markAll}>
              <Text style={{ color: C.gold, fontSize: 13 }}>قراءة الكل</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['all', 'unread'] as const).map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                borderWidth: 1,
                borderColor: filter === f ? C.gold : C.border,
                backgroundColor: filter === f ? C.gold : 'transparent',
              }}>
              <Text style={{ color: filter === f ? '#fff' : C.text, fontSize: 13, fontWeight: filter === f ? '700' : '400' }}>
                {f === 'all' ? 'الكل' : 'غير مقروءة'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Push permission banner ─────────────────────────────────────── */}
      {permStatus !== 'granted' && permStatus !== 'unavailable' && (
        <View style={{
          backgroundColor: C.gold + '10', borderBottomWidth: 1, borderBottomColor: C.gold + '25',
          padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
        }}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
          <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>فعّل الإشعارات لتلقي تنبيهات الحجوزات والرسائل</Text>
          <TouchableOpacity
            onPress={async () => { const r = await registerForPushNotifications(); setPermStatus(r.status); }}
            style={{ backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>تفعيل</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── List ──────────────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          !loading
            ? <Empty C={C} icon="🔔" title="لا توجد إشعارات" />
            : <ListSkeleton C={C} count={8} type="notification" />
        }
        renderItem={({ item: n }) => {
          const isRead     = !!n.is_read;
          const isExpanded = expandedId === n.id;
          const isSocial   = SOCIAL_TYPES.has(n.type);
          const badge      = TYPE_BADGE[n.type] || '🔔';

          // Actor data for social — from DB data column or fallback-parsed from title
          let actorData: any = null;
          if (isSocial) {
            if (n.data) {
              actorData = typeof n.data === 'string' ? JSON.parse(n.data) : n.data;
            } else {
              // Fallback: extract name from title when data column not deployed yet
              actorData = { actorName: extractActorName(n.title), actorAvatar: null, actorRole: null, actorId: null };
            }
          }

          return (
            <View>
              {/* ── LinkedIn-style row ────────────────────────────── */}
              <TouchableOpacity
                onPress={() => handleTap(n)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: C.border,
                  backgroundColor: isRead ? 'transparent' : C.gold + '08',
                }}>

                {/* Unread blue dot — leftmost (LinkedIn style) */}
                <View style={{ width: 10, alignItems: 'center', marginRight: 6 }}>
                  {!isRead && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0a66c2' }} />
                  )}
                </View>

                {/* Avatar + badge overlay */}
                <View style={{ marginRight: 12 }}>
                  {isSocial && actorData ? (
                    <NotifAvatar
                      url={actorData.actorAvatar}
                      name={actorData.actorName}
                      size={52}
                      gold={C.gold}
                      bg={C.bg}
                    />
                  ) : (
                    <WakeelAvatar size={52} gold={C.gold} />
                  )}
                  {/* Action type badge — bottom right of avatar */}
                  <View style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: C.surface,
                    borderWidth: 2, borderColor: C.bg,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 11 }}>{badge}</Text>
                  </View>
                </View>

                {/* Text block */}
                <View style={{ flex: 1 }}>
                  {/* Primary text: full title (actor name IS the title from backend) */}
                  <Text
                    style={{
                      color: C.text,
                      fontWeight: isRead ? '400' : '600',
                      fontSize: 14,
                      lineHeight: 20,
                      textAlign: 'right',
                    }}
                    numberOfLines={isSocial ? 2 : 3}>
                    {n.title}
                  </Text>
                  {/* Body preview (comment text / post snippet / booking detail) */}
                  {n.body ? (
                    <Text
                      style={{ color: C.muted, fontSize: 13, marginTop: 3, lineHeight: 18, textAlign: 'right' }}
                      numberOfLines={isSocial ? 1 : 2}>
                      {cleanNotifBody(n.body)}
                    </Text>
                  ) : null}
                  {/* Time + expand hint for system */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 5 }}>
                    <Text style={{ color: isRead ? C.muted : '#0a66c2', fontSize: 12, fontWeight: isRead ? '400' : '600' }}>
                      {timeAgo(n.created_at)}
                    </Text>
                    {!isSocial && (
                      <Text style={{ color: C.gold + '88', fontSize: 11 }}>
                        {isExpanded ? '▲' : '▼'}
                      </Text>
                    )}
                    {isSocial && (
                      <Text style={{ color: '#0a66c2', fontSize: 12, fontWeight: '600' }}>
                        عرض المنشور ›
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>

              {/* ── System notification expand panel (booking/payment etc.) ── */}
              {!isSocial && isExpanded && (
                <View style={{
                  marginHorizontal: 16, marginBottom: 10,
                  backgroundColor: C.card,
                  borderRadius: 12,
                  borderWidth: 1, borderColor: C.gold + '30',
                  overflow: 'hidden',
                  elevation: 3,
                  shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
                }}>
                  {/* Header */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: C.gold + '10',
                    paddingHorizontal: 14, paddingVertical: 10,
                    borderBottomWidth: 1, borderBottomColor: C.gold + '20',
                  }}>
                    <WakeelAvatar size={32} gold={C.gold} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>Wakeel</Text>
                      <Text style={{ color: C.muted, fontSize: 11 }}>منصة المحامين المعتمدة</Text>
                    </View>
                    <Text style={{ color: C.muted, fontSize: 11 }}>{timeAgo(n.created_at)}</Text>
                  </View>
                  {/* Full detail */}
                  <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 6, textAlign: 'right' }}>{n.title}</Text>
                    <Text style={{ color: C.text, fontSize: 14, lineHeight: 22, textAlign: 'right' }}>{n.body}</Text>
                  </View>
                  {/* Close */}
                  <TouchableOpacity
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setExpandedId(null);
                    }}
                    style={{
                      marginHorizontal: 16, marginBottom: 14,
                      paddingVertical: 9, borderRadius: 10,
                      borderWidth: 1, borderColor: C.border,
                      alignItems: 'center',
                    }}>
                    <Text style={{ color: C.muted, fontSize: 13 }}>إغلاق</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}
