import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuth } from '../../src/hooks/useAuth';
import { Card, Spinner, Btn, ErrMsg } from '../../src/components/ui';
import { adminAPI } from '../../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';

function MiniBar({ value, max, color, C }: any) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ backgroundColor: C.border, borderRadius: 4, height: 8, overflow: 'hidden', flex: 1 }}>
      <View style={{ width: `${pct}%` as any, height: '100%', backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

export default function AdminScreen() {
  const C = useTheme();
  const { t, isRTL, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'bookings' | 'users'>('overview');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const d = await adminAPI.stats();
      setStats(d);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل الإحصائيات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) { router.replace('/(tabs)' as any); return; }
    load();
  }, [isAdmin]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}><Spinner C={C} /></View>;

  const s = stats || {};
  const totalRevenue = parseFloat(s.revenue?.total || 0);
  const monthRevenue = parseFloat(s.revenue?.this_month || 0);

  const quickLinks = [
    { icon: '⚖️', label: 'توثيق المحامين',  path: '/admin/verification', badge: s.pendingLawyers },
    { icon: '🎫', label: 'تذاكر الدعم',     path: '/admin/support',      badge: s.openTickets   },
    { icon: '🎟️', label: 'أكواد الخصم',     path: '/admin/promos',       badge: 0               },
    { icon: '📊', label: 'تحليلات تفصيلية', path: '/analytics',          badge: 0               },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()}><Text style={{ color: C.text, fontSize: 22 }}>‹</Text></TouchableOpacity>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 20, fontFamily: 'CormorantGaramond-Bold' }}>🛡️ لوحة المشرف</Text>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 10, padding: 3 }}>
          {(['overview', 'bookings', 'users'] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: tab === t ? C.surface : 'transparent', alignItems: 'center' }}>
              <Text style={{ color: tab === t ? C.text : C.muted, fontWeight: tab === t ? '700' : '400', fontSize: 12 }}>
                {t === 'overview' ? 'نظرة عامة' : t === 'bookings' ? 'الحجوزات' : 'المستخدمون'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
      >
        {error ? (
          <View style={{ padding:16 }}>
            <ErrMsg C={C} msg={error} />
            <TouchableOpacity onPress={() => { setError(''); load(); }}
              style={{ marginTop:8, padding:10, backgroundColor:C.card, borderRadius:10, borderWidth:1, borderColor:C.border, alignItems:'center' }}>
              <Text style={{ color:C.gold, fontWeight:'600', fontSize:13 }}>🔄 إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {tab === 'overview' && (
          <>
            {/* Stat grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {[
                ['👥', s.users?.total || 0,        'مستخدمون',  '#3B82F6'],
                ['⚖️', s.lawyers?.verified || 0,   'محامون',     C.gold],
                ['📅', s.bookings?.total || 0,     'حجوزات',    C.green],
                ['💰', `${(totalRevenue/1000).toFixed(1)}k`, 'إيرادات ج', C.gold],
              ].map(([icon, val, label, color]) => (
                <View key={label as string} style={{ width: '47%', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 }}>
                  <Text style={{ fontSize: 26, marginBottom: 4 }}>{icon as string}</Text>
                  <Text style={{ color: color as string, fontWeight: '800', fontSize: 22 }}>{val as any}</Text>
                  <Text style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>{label as string}</Text>
                  {label === 'إيرادات ج' && (
                    <Text style={{ color: C.green, fontSize: 11, marginTop: 4, fontWeight: '600' }}>
                      هذا الشهر: {(monthRevenue/1000).toFixed(1)}k ج
                    </Text>
                  )}
                </View>
              ))}
            </View>

            {/* Revenue bar */}
            <Card C={C} style={{ marginBottom: 16 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>💰 الإيرادات</Text>
              {[
                ['إجمالي', totalRevenue, C.gold],
                ['هذا الشهر', monthRevenue, C.green],
              ].map(([lb, val, col]) => (
                <View key={lb as string} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ color: C.muted, fontSize: 12 }}>{lb as string}</Text>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{(val as number).toLocaleString()} ج</Text>
                  </View>
                  <MiniBar value={val as number} max={Math.max(totalRevenue, 1)} color={col as string} C={C} />
                </View>
              ))}
            </Card>

            {/* Quick links */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {quickLinks.map(ql => (
                <TouchableOpacity key={ql.path} onPress={() => router.push(ql.path as any)}
                  style={{ width: '47%', backgroundColor: C.card, borderWidth: 1, borderColor: ql.badge ? C.gold : C.border, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, position: 'relative' }}>
                  {ql.badge > 0 && (
                    <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: C.red, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{ql.badge}</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 26 }}>{ql.icon}</Text>
                  <Text style={{ color: C.text, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{ql.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* New users today */}
            {s.newUsersToday > 0 && (
              <Card C={C}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 8 }}>📈 اليوم</Text>
                {[
                  ['👤 مستخدمون جدد', s.newUsersToday || 0],
                  ['📅 حجوزات اليوم',  s.todayBookings  || 0],
                ].map(([lb, v]) => (
                  <View key={lb as string} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <Text style={{ color: C.muted, fontSize: 13 }}>{lb as string}</Text>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{v as number}</Text>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        {tab === 'bookings' && (
          <Card C={C}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>إحصائيات الحجوزات</Text>
            {[
              ['📅 الإجمالي',   s.bookings?.total     || 0, C.gold],
              ['✅ مكتملة',      s.bookings?.completed || 0, C.green],
              ['⏳ معلقة',       s.bookings?.pending   || 0, '#F59E0B'],
              ['❌ ملغية',       s.bookings?.cancelled || 0, C.red],
              ['📅 اليوم',      s.todayBookings        || 0, C.accent],
              ['💰 إيرادات الكل', `${totalRevenue.toLocaleString()} ج`, C.green],
            ].map(([label, value, color]) => (
              <View key={label as string} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' as any, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ color: C.muted, fontSize: 13 }}>{label as string}</Text>
                <Text style={{ color: color as string, fontWeight: '700', fontSize: 15 }}>{value as any}</Text>
              </View>
            ))}
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 10 }}>توزيع الحالات</Text>
              {[
                ['مكتملة', s.bookings?.completed || 0, C.green],
                ['معلقة',  s.bookings?.pending   || 0, '#F59E0B'],
                ['ملغية',  s.bookings?.cancelled || 0, C.red],
              ].map(([lb, v, col]) => (
                <View key={lb as string} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <Text style={{ color: C.muted, fontSize: 12, width: 50 }}>{lb as string}</Text>
                  <MiniBar value={v as number} max={Math.max(s.bookings?.total || 1, 1)} color={col as string} C={C} />
                  <Text style={{ color: C.text, fontSize: 12, width: 30 }}>{v as number}</Text>
                </View>
              ))}
            </View>
            <Btn C={C} full onPress={() => router.push('/admin/verification' as any)} style={{ marginTop: 14 }}>
              ⚖️ إدارة توثيق المحامين
            </Btn>
          </Card>
        )}

        {tab === 'users' && (
          <Card C={C}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>إحصائيات المستخدمين</Text>
            {[
              ['👥 الإجمالي',    s.users?.total   || 0, C.accent],
              ['⚖️ المحامون',    s.lawyers?.total   || 0, C.gold],
              ['✅ موثقون',       s.lawyers?.verified || 0, C.green],
              ['⏳ بانتظار التوثيق', s.pendingLawyers || 0, '#F59E0B'],
              ['👤 العملاء',     (s.users?.total || 0) - (s.lawyers?.total || 0), C.muted],
            ].map(([label, value, color]) => (
              <View key={label as string} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ color: C.muted, fontSize: 13 }}>{label as string}</Text>
                <Text style={{ color: color as string, fontWeight: '700', fontSize: 15 }}>{value as number}</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
