import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Linking } from 'react-native';
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

  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [stats, setStats] = useState({ earnings: 0, done: 0, pending: 0, upcoming: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'earnings'>('overview');

  const load = useCallback(async () => {
    try {
      const [bookRes, analyticsRes] = await Promise.allSettled([
        bookingsAPI.list({ limit: 50 }),
        analyticsAPI.lawyer(),
      ]);

      if (bookRes.status === 'fulfilled') {
        const list: any[] = (bookRes.value as any)?.bookings || [];
        setBookings(list);
      }

      if (analyticsRes.status === 'fulfilled') {
        const d = analyticsRes.value as any;
        setStats({
          earnings: d?.total_earnings || 0,
          done: d?.completed_sessions || 0,
          pending: d?.pending_bookings || 0,
          upcoming: d?.upcoming_sessions || 0,
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
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: action } : b));
      if (action === 'confirmed') {
        setStats(s => ({ ...s, pending: Math.max(0, s.pending - 1), upcoming: s.upcoming + 1 }));
      } else {
        setStats(s => ({ ...s, pending: Math.max(0, s.pending - 1) }));
      }
    } catch (e: any) { console.warn('Booking update failed', e?.message); }
  };

  const statCards = [
    { val: stats.earnings > 0 ? `${stats.earnings.toLocaleString()}` : '0', label: isRTL ? 'EGP' : 'EGP', icon: '💰' },
    { val: stats.done > 0 ? `${stats.done}` : '0',           label: isRTL ? 'مكتمل' : 'Done',    icon: '✅' },
    { val: stats.pending > 0     ? `${stats.pending}`      : '0',           label: isRTL ? 'معلق' : 'Pending',        icon: '⏳' },
    { val: stats.upcoming > 0    ? `${stats.upcoming}`     : '0',           label: isRTL ? 'قادم' : 'Upcoming',       icon: '📅' },
  ];

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');

  const renderBookingCard = (r: any, showActions: boolean) => {
    const clientName  = r.client_name || r.client?.name || (isRTL ? 'عميل' : 'Client');
    const bookingDate = r.booking_date || r.scheduled_at
      ? new Date(r.booking_date || r.scheduled_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g,'-')
      : '—';
    const timeSlot    = r.start_time || '9:00 AM';
    const caseType    = r.case_type || r.type || (isRTL ? 'استشارة' : 'Consultation');
    const fee         = r.amount || r.consultation_fee || '500';

    return (
      <View key={r.id} style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 18, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, textAlign: isRTL ? 'right' : 'left' }}>{clientName}</Text>
            <Text style={{ color: C.muted, fontSize: 13, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
              {caseType} • {bookingDate} {timeSlot}
            </Text>
          </View>
        </View>

        {showActions ? (
          <View style={{ flexDirection: 'row-reverse', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row-reverse', gap: 12, flex: 1 }}>
              <TouchableOpacity
                onPress={() => handleBookingAction(r.id, 'rejected')}
                style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14 }}>
                  ✗ {isRTL ? 'رفض' : 'Decline'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleBookingAction(r.id, 'confirmed')}
                style={{ flex: 1, backgroundColor: '#DCFCE7', borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 14 }}>
                  ✓ {isRTL ? 'قبول' : 'Accept'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 8, alignItems: 'center' }}>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 14 }}>EGP {fee}</Text>
            </View>
            <View style={{ backgroundColor: '#FFEDD5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                <Text style={{ color: '#C2410C', fontSize: 12, fontWeight: '700' }}>{isRTL ? 'معلق' : 'pending'}</Text>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12 }}>
                <Text style={{ color: '#16A34A', fontSize: 12, fontWeight: '700' }}>{isRTL ? 'مؤكد' : 'confirmed'}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderOverview = () => (
    <View>
      {/* 1. Lawyer Tools at the top */}
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
         <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>{isRTL ? 'أدوات المحامي 🛠️' : 'Lawyer Tools 🛠️'}</Text>
      </View>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
        {[
          { icon: '⭐️', label: isRTL ? 'تقييمات العملاء' : 'Client Reviews', href: '/reviews' },
          { icon: '👥', label: isRTL ? 'العملاء' : 'Clients', href: '/crm' },
          { icon: '📅', label: isRTL ? 'جدول التوفر' : 'Schedule', href: '/schedule' },
        ].map((item, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => router.push(item.href as any)}
            style={{
              flex: 1, minWidth: '30%', backgroundColor: C.surface,
              borderWidth: 1, borderColor: C.border, borderRadius: 14,
              padding: 16, alignItems: 'center', gap: 8
            }}>
            <Text style={{ fontSize: 24 }}>{item.icon}</Text>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 2. Upcoming Consultations */}
      <View style={{ backgroundColor: '#EFECE5', borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: C.border }}>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' }}>
          {isRTL ? 'الاستشارات القادمة' : 'Upcoming Consultations'}
        </Text>
        {confirmedBookings.length === 0 && pendingBookings.length === 0 ? (
          <Text style={{ color: C.muted, textAlign: 'center', padding: 10 }}>{isRTL ? 'لا توجد استشارات قادمة' : 'No upcoming consultations'}</Text>
        ) : (
          <View>
            {confirmedBookings.slice(0,3).map(b => renderBookingCard(b, false))}
            {pendingBookings.slice(0,3).map(b => renderBookingCard(b, true))}
          </View>
        )}
      </View>

      {/* 3. Profile Stats */}
      <View style={{ backgroundColor: '#EFECE5', borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: C.border }}>
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'right' }}>
          {isRTL ? 'Profile Stats' : 'Profile Stats'}
        </Text>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row-reverse', gap: 12 }}>
                <Text style={{ color: '#D97706', fontWeight: '700' }}>92%</Text>
                <Text style={{ color: '#DC2626', fontWeight: '700' }}>25L✗</Text>
                <Text style={{ color: '#16A34A', fontWeight: '700' }}>287W✓</Text>
            </View>
        </View>
        <View style={{ height: 6, backgroundColor: C.border, borderRadius: 4, width: '100%', marginBottom: 16 }}>
            <View style={{ height: 6, backgroundColor: '#16A34A', borderRadius: 4, width: '92%' }} />
        </View>

        <View style={{ flexDirection: 'row-reverse', justifyContent: 'center', gap: 24, alignItems: 'center' }}>
            <Text style={{ color: C.muted, fontWeight: '600' }}>{isRTL ? 'years 18 📅' : 'years 18 📅'}</Text>
            <Text style={{ color: C.muted, fontWeight: '600' }}>{isRTL ? 'reviews 312 📝' : 'reviews 312 📝'}</Text>
            <Text style={{ color: '#D97706', fontWeight: '700' }}>4.9 ⭐️</Text>
        </View>
      </View>
    </View>
  );

  const renderBookings = () => (
    <View>
      {pendingBookings.length > 0 && (
        <View style={{ marginBottom: 24 }}>
           {pendingBookings.map(b => renderBookingCard(b, true))}
        </View>
      )}
      {confirmedBookings.map(b => renderBookingCard(b, false))}
      {pendingBookings.length === 0 && confirmedBookings.length === 0 && (
          <Text style={{ textAlign: 'center', color: C.muted, marginTop: 40 }}>{isRTL ? 'لا توجد حجوزات' : 'No bookings'}</Text>
      )}
    </View>
  );

  const renderEarnings = () => (
    <View>
       <View style={{ flexDirection: 'row', gap: 14, marginBottom: 24 }}>
          <View style={{ flex: 1, backgroundColor: '#EFECE5', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20, alignItems: 'center' }}>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 8, fontWeight: '600' }}>{isRTL ? 'Pending Payout' : 'Pending Payout'}</Text>
            <Text style={{ color: '#16A34A', fontSize: 24, fontWeight: '700', fontFamily: 'CormorantGaramond-Bold' }}>EGP {pendingBookings.reduce((a,b)=>a+(b.amount||b.consultation_fee||500), 0)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#EFECE5', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20, alignItems: 'center' }}>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 8, fontWeight: '600' }}>{isRTL ? 'Total Earned' : 'Total Earned'}</Text>
            <Text style={{ color: C.gold, fontSize: 24, fontWeight: '700', fontFamily: 'CormorantGaramond-Bold' }}>EGP {stats.earnings}</Text>
          </View>
       </View>

       <View style={{ backgroundColor: '#EFECE5', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border }}>
          {confirmedBookings.map((b, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: i === confirmedBookings.length-1 ? 0 : 1, borderBottomColor: C.border }}>
               <Text style={{ color: C.gold, fontWeight: '700', fontSize: 15 }}>EGP {b.amount || b.consultation_fee || 500}+</Text>
               <Text style={{ color: C.muted, fontSize: 13 }}>{(b.client_name || b.client?.name || 'Client')} • {new Date(b.created_at || new Date()).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g,'-')}</Text>
            </View>
          ))}
          {confirmedBookings.length === 0 && (
             <Text style={{ textAlign: 'center', color: C.muted, padding: 10 }}>{isRTL ? 'لا توجد معاملات بعد' : 'No transactions yet'}</Text>
          )}
       </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
      >
        {/* Top 4 Stats Row */}
        {loading ? (
             <ActivityIndicator color={C.gold} style={{ marginVertical: 30 }} />
        ) : (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, marginBottom: 24 }}>
                {statCards.map((s, i) => (
                <View key={i} style={{ flex: 1, backgroundColor: '#EFECE5', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</Text>
                    <Text style={{ color: C.gold, fontSize: 18, fontWeight: '700', fontFamily: 'CormorantGaramond-Bold', textAlign: 'center' }}>{s.val}</Text>
                    <Text style={{ color: C.muted, fontSize: 11, marginTop: 4, textAlign: 'center' }}>{s.label}</Text>
                </View>
                ))}
            </View>
        )}

        {/* Segmented Tab Selector */}
        <View style={{ flexDirection: 'row', backgroundColor: '#EFECE5', borderRadius: 12, padding: 4, marginBottom: 24 }}>
           {[
             { id: 'earnings', label: isRTL ? 'Earnings 💰' : 'Earnings 💰' },
             { id: 'bookings', label: isRTL ? 'Bookings 📅' : 'Bookings 📅' },
             { id: 'overview', label: isRTL ? 'Overview 📊' : 'Overview 📊' }
           ].map((tab) => {
             const isActive = activeTab === tab.id;
             return (
               <TouchableOpacity 
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id as any)}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: isActive ? '#FFFFFF' : 'transparent', borderRadius: 10, shadowColor: isActive ? '#000' : 'transparent', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: isActive ? 2 : 0 }}>
                  <Text style={{ color: isActive ? C.text : C.muted, fontWeight: isActive ? '700' : '500', fontSize: 14 }}>{tab.label}</Text>
               </TouchableOpacity>
             )
           })}
        </View>

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'bookings' && renderBookings()}
        {activeTab === 'earnings' && renderEarnings()}

      </ScrollView>
    </View>
  );
}
