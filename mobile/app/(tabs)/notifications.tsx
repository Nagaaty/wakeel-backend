import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  LayoutAnimation, UIManager, Platform, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { Empty } from '../../src/components/ui';
import { notificationsAPI } from '../../src/services/api';
import {
  getNotificationPermissionStatus,
  registerForPushNotifications,
} from '../../src/utils/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListSkeleton } from '../../src/components/Skeleton';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SOCIAL_TYPES = new Set(['forum_like', 'forum_comment', 'forum_share']);

const TYPE_ICONS: Record<string, string> = {
  booking: '📅', payment: '💰', message: '💬',
  review: '⭐', system: '🔔', reminder: '⏰', broadcast: '📣',
  forum_like: '👍', forum_comment: '💬', forum_share: '🔁',
};

// — Wakeel "W" system avatar
function WakeelAvatar({ size = 44, gold }: { size?: number; gold: string }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: gold,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#1a1a2e', fontWeight: '900', fontSize: size * 0.42 }}>W</Text>
    </View>
  );
}

// — Actor avatar (for social notifications)
function ActorAvatar({ url, name, size = 44, gold }: { url?: string; name?: string; size?: number; gold: string }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#eee' }} />;
  }
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: gold + '30', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: gold + '60' }}>
      <Text style={{ color: gold, fontWeight: '800', fontSize: size * 0.38 }}>{initials}</Text>
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

  const handleTap = (n: any) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const nextId = expandedId === n.id ? null : n.id;
    setExpandedId(nextId);
    if (nextId && !n.is_read) markRead(n.id);
  };

  const filtered  = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs;
  const unreadCnt = notifs.filter(n => !n.is_read).length;

  const timeAgo = (iso: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: C.surface,
        paddingTop: insets.top + 4,
        paddingHorizontal: 16, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 20, fontFamily: 'CormorantGaramond-Bold' }}>
              الإشعارات
            </Text>
            {unreadCnt > 0 && (
              <View style={{ backgroundColor: '#e74c3c', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
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

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['all', 'unread'] as const).map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
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
          backgroundColor: C.gold + '10',
          borderBottomWidth: 1, borderBottomColor: C.gold + '25',
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

      {/* ── Notification list ──────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          !loading
            ? <Empty C={C} icon="🔔" title="لا توجد إشعارات" />
            : <ListSkeleton C={C} count={6} type="notification" />
        }
        renderItem={({ item: n }) => {
          const isRead     = !!n.is_read;
          const isExpanded = expandedId === n.id;
          const isSocial   = SOCIAL_TYPES.has(n.type);
          const icon       = TYPE_ICONS[n.type] || '🔔';
          // Parse actor data for social notifications
          const actorData  = isSocial && n.data ? (typeof n.data === 'string' ? JSON.parse(n.data) : n.data) : null;

          return (
            <View>
              {/* ── Row ──────────────────────────────────────────────── */}
              <TouchableOpacity
                onPress={() => handleTap(n)}
                activeOpacity={0.75}
                style={{
                  flexDirection: 'row', gap: 12,
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: isExpanded ? 0 : 1,
                  borderBottomColor: C.border,
                  backgroundColor: isRead
                    ? (isExpanded ? C.card + 'aa' : 'transparent')
                    : C.gold + '0C',
                }}>

                {/* Avatar: actor pic for social, W for system */}
                <View>
                  {isSocial && actorData ? (
                    <ActorAvatar url={actorData.actorAvatar} name={actorData.actorName} size={46} gold={C.gold} />
                  ) : (
                    <WakeelAvatar size={46} gold={C.gold} />
                  )}
                  {/* Type icon badge */}
                  <View style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: C.surface,
                    borderWidth: 1.5, borderColor: C.gold + '44',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 11 }}>{icon}</Text>
                  </View>
                </View>

                {/* Content */}
                <View style={{ flex: 1 }}>
                  {/* Sender line */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 1 }}>
                    <Text style={{ color: C.gold, fontWeight: '700', fontSize: 12 }}>
                      {isSocial && actorData ? actorData.actorName : 'Wakeel'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={{ color: C.muted, fontSize: 11 }}>{timeAgo(n.created_at)}</Text>
                      {!isRead && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold }} />}
                    </View>
                  </View>

                  {/* Title */}
                  <Text style={{ color: C.text, fontWeight: isRead ? '500' : '700', fontSize: 14 }}>{n.title}</Text>

                  {/* Preview body (collapsed) */}
                  {!isExpanded && (
                    <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{n.body}</Text>
                  )}

                  <Text style={{ color: C.gold + '99', fontSize: 11, marginTop: 4 }}>
                    {isExpanded ? '▲ إخفاء' : '▼ عرض التفاصيل'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* ── Expanded detail panel ─────────────────────────── */}
              {isExpanded && (
                <View style={{
                  marginHorizontal: 16, marginBottom: 10,
                  backgroundColor: C.card,
                  borderRadius: 14,
                  borderWidth: 1, borderColor: C.gold + '33',
                  overflow: 'hidden',
                  shadowColor: '#000', shadowOpacity: 0.10,
                  shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
                  elevation: 4,
                }}>
                  {/* Panel header */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: C.gold + '12',
                    paddingHorizontal: 14, paddingVertical: 10,
                    borderBottomWidth: 1, borderBottomColor: C.gold + '22',
                  }}>
                    {isSocial && actorData ? (
                      <ActorAvatar url={actorData.actorAvatar} name={actorData.actorName} size={34} gold={C.gold} />
                    ) : (
                      <WakeelAvatar size={34} gold={C.gold} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>
                        {isSocial && actorData ? actorData.actorName : 'Wakeel'}
                      </Text>
                      <Text style={{ color: C.muted, fontSize: 11 }}>
                        {isSocial && actorData
                          ? (actorData.actorRole === 'lawyer' ? 'محامٍ معتمد' : 'عضو في المنتدى')
                          : 'منصة المحامين المعتمدة'
                        }
                      </Text>
                    </View>
                    <Text style={{ color: C.muted, fontSize: 11 }}>{timeAgo(n.created_at)}</Text>
                  </View>

                  {/* Full message */}
                  <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 8 }}>{n.title}</Text>
                    <Text style={{ color: C.text, fontSize: 14, lineHeight: 22 }}>{n.body}</Text>

                    {/* Post snippet preview for social */}
                    {isSocial && actorData?.postSnippet && (
                      <View style={{ marginTop: 12, padding: 10, backgroundColor: C.bg, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: C.gold }}>
                        <Text style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>📌 المنشور</Text>
                        <Text style={{ color: C.text, fontSize: 13 }} numberOfLines={3}>
                          {actorData.postSnippet}{actorData.postSnippet.length >= 80 ? '…' : ''}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Action buttons */}
                  <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
                    {/* Social: View Post + View Profile */}
                    {isSocial && actorData ? (
                      <>
                        <TouchableOpacity
                          onPress={() => {
                            setExpandedId(null);
                            // Navigate to forum tab — the forum will show the feed
                            router.push('/(tabs)/forum' as any);
                          }}
                          style={{ flex: 1, backgroundColor: C.gold, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                          <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>عرض المنشور ›</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => {
                            setExpandedId(null);
                            if (actorData.actorRole === 'lawyer') {
                              router.push({ pathname: '/lawyer/[id]', params: { id: actorData.actorId } } as any);
                            } else {
                              router.push({ pathname: '/user/[id]', params: { id: actorData.actorId } } as any);
                            }
                          }}
                          style={{ flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: C.gold }}>
                          <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>عرض الملف ›</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      // System notification: just close
                      <TouchableOpacity
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setExpandedId(null);
                        }}
                        style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
                        <Text style={{ color: C.muted, fontSize: 13 }}>إغلاق</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Close row for social too */}
                  {isSocial && (
                    <TouchableOpacity
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedId(null);
                      }}
                      style={{ marginHorizontal: 16, marginBottom: 14, paddingVertical: 8, alignItems: 'center' }}>
                      <Text style={{ color: C.muted, fontSize: 12 }}>إغلاق</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}
