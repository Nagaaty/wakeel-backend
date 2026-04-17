import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  Animated, LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { Spinner, Empty } from '../../src/components/ui';
import { notificationsAPI } from '../../src/services/api';
import { getNotificationPermissionStatus, registerForPushNotifications } from '../../src/utils/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';
import { ListSkeleton } from '../../src/components/Skeleton';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TYPE_ICONS: Record<string, string> = {
  booking: '📅', payment: '💰', message: '💬',
  review: '⭐', system: '🔔', reminder: '⏰', broadcast: '📣',
};

const LINK_LABELS: Record<string, string> = {
  '/bookings':        'عرض الحجوزات',
  '/lawyer/dashboard':'لوحة التحكم',
  '/messages':        'فتح المحادثات',
  '/notifications':   'الإشعارات',
};

export default function NotificationsScreen() {
  const C      = useTheme();
  const { t, isRTL } = useI18n();
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
    if (expandedId === n.id) {
      setExpandedId(null);
    } else {
      setExpandedId(n.id);
      if (!n.is_read) markRead(n.id);
    }
  };

  const filtered  = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs;
  const unreadCnt = notifs.filter(n => !n.is_read).length;

  const timeAgo = (iso: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)    return 'الآن';
    if (mins < 60)   return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)    return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 4, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 20, fontFamily: 'CormorantGaramond-Bold' }}>الإشعارات</Text>
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
          {([['all', 'الكل'], ['unread', 'غير مقروءة']] as const).map(([f, lb]) => (
            <TouchableOpacity key={f} onPress={() => setFilter(f as any)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: filter === f ? C.gold : C.border, backgroundColor: filter === f ? C.gold : 'transparent' }}>
              <Text style={{ color: filter === f ? '#fff' : C.text, fontSize: 13, fontWeight: filter === f ? '700' : '400' }}>{lb}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Push permission banner ─────────────────────────────────────── */}
      {permStatus !== 'granted' && permStatus !== 'unavailable' && (
        <View style={{ backgroundColor: C.gold + '10', borderBottomWidth: 1, borderBottomColor: C.gold + '25', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
          <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>فعّل الإشعارات لتلقي تنبيهات الحجوزات والرسائل</Text>
          <TouchableOpacity onPress={async () => { const r = await registerForPushNotifications(); setPermStatus(r.status); }}
            style={{ backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>تفعيل</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── List ───────────────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={!loading
          ? <Empty C={C} icon="🔔" title="لا توجد إشعارات" />
          : <ListSkeleton C={C} count={6} type="notification" />
        }
        renderItem={({ item: n }) => {
          const isRead    = !!n.is_read;
          const isExpanded = expandedId === n.id;
          const icon      = TYPE_ICONS[n.type] || '🔔';
          const linkLabel = n.link ? (LINK_LABELS[n.link] || 'فتح') : null;

          return (
            <View>
              {/* ── Row ── */}
              <TouchableOpacity
                onPress={() => handleTap(n)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', gap: 12,
                  paddingHorizontal: 16, paddingVertical: 14,
                  borderBottomWidth: isExpanded ? 0 : 1,
                  borderBottomColor: C.border,
                  backgroundColor: isRead ? (isExpanded ? C.card + 'cc' : 'transparent') : C.gold + '0C',
                }}>
                {/* Icon bubble */}
                <View style={{
                  width: 46, height: 46, borderRadius: 23,
                  backgroundColor: isExpanded ? C.gold + '20' : C.card,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: isExpanded ? 1.5 : 0, borderColor: C.gold + '60',
                }}>
                  <Text style={{ fontSize: 22 }}>{icon}</Text>
                </View>

                {/* Content */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ color: C.text, fontWeight: isRead ? '500' : '700', fontSize: 14, flex: 1 }}>{n.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {!isRead && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold }} />}
                      <Text style={{ color: C.muted, fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</Text>
                    </View>
                  </View>
                  {/* Preview (collapsed) */}
                  {!isExpanded && (
                    <Text style={{ color: C.muted, fontSize: 13, marginTop: 3 }} numberOfLines={2}>{n.body}</Text>
                  )}
                  <Text style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{timeAgo(n.created_at)}</Text>
                </View>
              </TouchableOpacity>

              {/* ── Expanded detail panel (Facebook-style) ── */}
              {isExpanded && (
                <View style={{
                  marginHorizontal: 16, marginBottom: 8,
                  backgroundColor: C.card,
                  borderRadius: 14,
                  borderWidth: 1, borderColor: C.border,
                  overflow: 'hidden',
                  shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
                  elevation: 3,
                }}>
                  {/* Detail header */}
                  <View style={{ backgroundColor: C.gold + '15', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border + '80', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>{icon}</Text>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, flex: 1 }}>{n.title}</Text>
                  </View>

                  {/* Full body */}
                  <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                    <Text style={{ color: C.text, fontSize: 14, lineHeight: 22 }}>{n.body}</Text>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>🕐 {timeAgo(n.created_at)}</Text>
                  </View>

                  {/* Action buttons */}
                  <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
                    {linkLabel && (
                      <TouchableOpacity
                        onPress={() => { setExpandedId(null); router.push(n.link as any); }}
                        style={{ flex: 1, backgroundColor: C.gold, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                        <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>{linkLabel} ›</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpandedId(null); }}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
                      <Text style={{ color: C.muted, fontSize: 13 }}>إغلاق</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}
