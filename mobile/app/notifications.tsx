import React, { useEffect, useState, useCallback } from 'react';

const NOTIF_ROW_HEIGHT = 73;
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme';
import { Spinner, Empty, ErrMsg } from '../src/components/ui';
import { notificationsAPI } from '../src/services/api';
import { getNotificationPermissionStatus, registerForPushNotifications } from '../src/utils/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';
import { ListSkeleton } from '../src/components/Skeleton';

const TYPE_ICONS: Record<string, string> = {
  booking: '📅', payment: '💰', message: '💬',
  review: '⭐', system: '🔔', reminder: '⏰', broadcast: '📣',
};

export default function NotificationsScreen() {
  const C      = useTheme();
  const insets = useSafeAreaInsets();
  const { isRTL, t } = useI18n();
  const [notifs,   setNotifs]   = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [filter,     setFilter]     = useState<'all' | 'unread'>('all');
  const [permStatus, setPermStatus] = useState<string>('granted');

  useEffect(() => {
    getNotificationPermissionStatus().then(setPermStatus);
  }, []);

  const load = async () => {
    try {
      const d: any = await notificationsAPI.getAll();
      setNotifs(Array.isArray(d) ? d : d?.notifications || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id: number) => {
    await notificationsAPI.markRead(id).catch(() => {});
    setNotifs(p => p.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  };

  const markAll = async () => {
    await notificationsAPI.markAllRead().catch(() => {});
    setNotifs(p => p.map(n => ({ ...n, read_at: new Date().toISOString() })));
  };

  const filtered  = filter === 'unread' ? notifs.filter(n => !n.read_at) : notifs;
  const unreadCnt = notifs.filter(n => !n.read_at).length;

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60)   return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)    return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 20, fontFamily: 'CormorantGaramond-Bold' }}>الإشعارات</Text>
            {unreadCnt > 0 && (
              <View style={{ backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
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

      {error ? <View style={{ paddingHorizontal:16, paddingTop:8 }}><ErrMsg C={C} msg={error} /></View> : null}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[['all',t('app.all')],['unread',isRTL ? 'غير مقروءة' : 'Unread']].map(([f, lb]) => (
            <TouchableOpacity key={f} onPress={() => setFilter(f as any)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: filter === f ? C.gold : C.border, backgroundColor: filter === f ? C.gold : 'transparent' }}>
              <Text style={{ color: filter === f ? '#fff' : C.text, fontSize: 13, fontWeight: filter === f ? '700' : '400' }}>{lb}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Permission prompt banner */}
      {permStatus !== 'granted' && permStatus !== 'unavailable' && (
        <View style={{ backgroundColor: C.gold + '10', borderBottomWidth: 1, borderBottomColor: C.gold + '25', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
          <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>
            {isRTL ? 'فعّل الإشعارات لتلقي تنبيهات الحجوزات والرسائل' : 'Enable notifications for booking and message alerts'}
          </Text>
          <TouchableOpacity onPress={async () => { const r = await registerForPushNotifications(); setPermStatus(r.status); }}
            style={{ backgroundColor: C.gold, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 }}>
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>{isRTL ? 'تفعيل' : 'Enable'}</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        getItemLayout={(_d, i) => ({ length: NOTIF_ROW_HEIGHT, offset: NOTIF_ROW_HEIGHT * i, index: i })}
        removeClippedSubviews={true}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={8}
        ListEmptyComponent={!loading ? <Empty C={C} icon="🔔" title="لا توجد إشعارات" /> : <ListSkeleton C={C} count={6} type="notification" />}
        renderItem={({ item: n }) => {
          const read = !!n.read_at;
          const icon = TYPE_ICONS[n.type] || '🔔';
          return (
            <TouchableOpacity onPress={() => { markRead(n.id); if (n.link) router.push(n.link); }}
              style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: read ? 'transparent' : C.gold + '08' }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={{ color: C.text, fontWeight: read ? '500' : '700', fontSize: 14, flex: 1 }}>{n.title}</Text>
                  {!read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold, marginLeft: 8, marginTop: 4 }} />}
                </View>
                <Text style={{ color: C.muted, fontSize: 13, marginTop: 3, lineHeight: 18 }}>{n.body}</Text>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{timeAgo(n.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
