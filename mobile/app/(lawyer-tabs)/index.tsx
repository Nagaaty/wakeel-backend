import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { Avatar } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';
import { useAuth } from '../../src/hooks/useAuth';
import { bookingsAPI, analyticsAPI } from '../../src/services/api';

export default function LawyerDashboardIndex() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const { user } = useAuth();

  const [refreshing, setRefreshing]     = useState(false);
  const [bookings,   setBookings]       = useState<any[]>([]);
  const [stats,      setStats]          = useState({ earnings: 0, sessions_today: 0, pending: 0 });
  const [loading,    setLoading]        = useState(true);

  const today = new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  const load = useCallback(async () => {
    try {
      const [bookRes, analyticsRes] = await Promise.allSettled([
        bookingsAPI.list({ status: 'pending', limit: 10 }),
        analyticsAPI.lawyer(),
      ]);

      if (bookRes.status === 'fulfilled') {
        const list: any[] = (bookRes.value as any)?.bookings || [];
        setBookings(list.filter((b: any) => b.status === 'pending'));
      }

      if (analyticsRes.status === 'fulfilled') {
        const d = analyticsRes.value as any;
        setStats({
          earnings:       d?.earnings_this_month || d?.total_earnings || 0,
          sessions_today: d?.sessions_today || d?.completed_sessions || 0,
          pending:        d?.pending_bookings   || 0,
        });
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleBookingAction = async (bookingId: number, action: 'confirmed' | 'rejected') => {
    try {
      await bookingsAPI.update(bookingId, { status: action });
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      setStats(s => ({ ...s, pending: Math.max(0, s.pending - 1) }));
    } catch (e: any) { console.warn('Booking update failed', e?.message); }
  };

  const statCards = [
    { val: stats.earnings > 0 ? `${stats.earnings.toLocaleString()} EGP` : '—', label: isRTL ? 'أرباح الشهر' : "This Month's Earnings", icon: '💰' },
    { val: stats.sessions_today > 0 ? `${stats.sessions_today}` : '0',           label: isRTL ? 'جلسات مكتملة' : 'Completed Sessions',    icon: '📅' },
    { val: bookings.length > 0      ? `${bookings.length}`      : '0',           label: isRTL ? 'طلبات معلقة' : 'Pending Requests',        icon: '⏳' },
  ];

  const initials = (user?.name || 'LA').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
      >
        {/* Top Header Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => router.push('/account-settings' as any)}
            style={{ borderColor: C.green, borderWidth: 1, backgroundColor: C.green + '14', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.green }} />
            <Text style={{ color: C.green, fontSize: 13, fontWeight: '700' }}>
              {isRTL ? 'متاح الآن' : 'Available'}
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>
                {user?.name || (isRTL ? 'الأستاذ المحامي' : 'Attorney')}
              </Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{today}</Text>
            </View>
            <Avatar C={C} initials={initials} size={46} url={user?.avatar_url} />
          </View>
        </View>

        {/* Stats Cards */}
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color={C.gold} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
            {statCards.map((s, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</Text>
                <Text style={{ color: C.gold, fontSize: 16, fontWeight: '700', fontFamily: 'CormorantGaramond-Bold', textAlign: 'center' }}>{s.val}</Text>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 4, textAlign: 'center' }}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Pending Requests */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.gold }} />
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', flex: 1 }}>
            {isRTL ? 'طلبات تحتاج ردك' : 'Requests Awaiting Reply'}
          </Text>
          {bookings.length > 0 && (
            <View style={{ backgroundColor: '#FDE68A', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: '#92400E', fontSize: 12, fontWeight: '700' }}>{bookings.length}</Text>
            </View>
          )}
        </View>

        {!loading && bookings.length === 0 && (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🎉</Text>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>
              {isRTL ? 'لا طلبات معلقة' : 'No Pending Requests'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
              {isRTL ? 'سيظهر هنا أي طلب حجز جديد من العملاء' : 'New client booking requests will appear here'}
            </Text>
          </View>
        )}

        {bookings.map((r: any, i: number) => {
          const clientName  = r.client_name || r.client?.name || (isRTL ? 'عميل' : 'Client');
          const bookingDate = r.booking_date || r.scheduled_at
            ? new Date(r.booking_date || r.scheduled_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })
            : '—';
          const timeSlot    = r.start_time || '';
          const caseType    = r.case_type || r.type || (isRTL ? 'استشارة' : 'Consultation');
          const fee         = r.amount || r.consultation_fee || '—';

          return (
            <View key={r.id || i} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 18, marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <Text style={{ color: C.gold, fontWeight: '700', fontSize: 15 }}>{fee} EGP</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>{clientName}</Text>
                  <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>
                    {bookingDate}{timeSlot ? ` • ${timeSlot}` : ''} • {caseType}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => handleBookingAction(r.id, 'rejected')}
                  style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14 }}>
                    ✗ {isRTL ? 'رفض' : 'Decline'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleBookingAction(r.id, 'confirmed')}
                  style={{ flex: 1, backgroundColor: '#DCFCE7', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 14 }}>
                    ✓ {isRTL ? 'قبول' : 'Accept'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* 2x2 Grid Shortcuts */}
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 14, marginTop: 12 }}>
          {isRTL ? 'لوحة التحكم' : 'Dashboard'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[
            { icon: '💰', label: isRTL ? 'المدفوعات' : 'Earnings',     href: '/installments' },
            { icon: '📅', label: isRTL ? 'الحجوزات' : 'Bookings',      href: '/bookings' },
            { icon: '📊', label: isRTL ? 'نظرة عامة (CRM)' : 'Overview (CRM)', href: '/analytics' },
            { icon: '📝', label: isRTL ? 'وظائف قانونية' : 'Post a Job', href: '/jobs' },
          ].map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => router.push(item.href as any)}
              style={{
                flex: 1, minWidth: '44%', backgroundColor: C.card,
                borderWidth: 1, borderColor: C.border, borderRadius: 14,
                padding: 20, alignItems: 'center', gap: 10
              }}>
              <Text style={{ fontSize: 32 }}>{item.icon}</Text>
              <Text style={{ color: C.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}
