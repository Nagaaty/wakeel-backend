import React, { useEffect, useState, useCallback, memo } from 'react';

const BOOKING_CARD_HEIGHT = 160; // estimated fixed height
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchBookings, updateBooking,
  selBookings, selBLoading,
} from '../src/store/slices/bookingsSlice';
import { useTheme } from '../src/hooks/useTheme';
import { useAuth } from '../src/hooks/useAuth';
import { Badge, Spinner, Empty, Btn, ErrMsg } from '../src/components/ui';
import { invoicesAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppDispatch } from '../src/store';
import { useI18n } from '../src/i18n';
import { ListSkeleton } from '../src/components/Skeleton';
import { hapticMedium, hapticSuccess, hapticError } from '../src/utils/haptics';
import { recordCompletedConsultation } from '../src/utils/storeReview';

const STATUS: Record<string, { color: string; label: string; icon: string }> = {
  pending:   { color: '#F59E0B', label: 'قيد الانتظار', icon: '⏳' },
  confirmed: { color: '#3B82F6', label: 'مؤكد',          icon: '✅' },
  completed: { color: '#22C55E', label: 'مكتمل',         icon: '🏆' },
  cancelled: { color: '#EF4444', label: 'ملغي',          icon: '❌' },
  rejected:  { color: '#EF4444', label: 'مرفوض',         icon: '🚫' },
};
const SVC_ICONS: Record<string, string> = {
  text: '💬', voice: '📞', video: '📹', inperson: '🏛️', document: '📄', consultation: '⚖️',
};
const FILTERS = [['all','الكل'],['pending','انتظار'],['confirmed','مؤكد'],['completed','مكتمل'],['cancelled','ملغي']];

export default function BookingsScreen() {
  const C        = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const insets   = useSafeAreaInsets();
  const { isLawyer } = useAuth();
  const params   = useLocalSearchParams<{ success?: string }>();
  const { isRTL, t } = useI18n();
  const bookings = useSelector(selBookings);
  const loading  = useSelector(selBLoading);

  const [filter,     setFilter]     = useState('all');
  const [actioning,  setActioning]  = useState<string | null>(null);
  const [error,      setError]      = useState('');
  const [successMsg, setSuccessMsg] = useState(params.success ? '✅ تم الحجز والدفع بنجاح!' : '');

  useEffect(() => {
    dispatch(fetchBookings({})).unwrap().catch((e: any) => setError(e?.message || 'تعذر تحميل الحجوزات'));
  }, []);

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 5000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  const changeStatus = async (id: string, status: string) => {
    setActioning(id); setError('');
    try {
      await dispatch(updateBooking({ id, status })).unwrap();
      // Trigger review prompt after completing a consultation
      if (status === 'completed') {
        await recordCompletedConsultation();
      }
    }
    catch (e: any) { setError(e?.message || 'تعذر تحديث الحجز'); }
    finally { setActioning(null); }
  };

  const downloadInvoice = async (bookingId: string) => {
    try {
      await invoicesAPI.create(bookingId);
      Alert.alert('✅', 'تم إنشاء الفاتورة! ستصلك على بريدك الإلكتروني.');
    } catch (e: any) { Alert.alert('خطأ', e?.message || 'تعذر إنشاء الفاتورة'); }
  };

  const filtered  = filter === 'all' ? bookings : bookings.filter((b: any) => b.status === filter);
  const upcoming  = bookings.filter((b: any) => b.status === 'confirmed' && new Date(b.booking_date) >= new Date());

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 20, fontFamily: 'CormorantGaramond-Bold' }}>
            {isLawyer ? isRTL ? 'جلساتي' : 'My Sessions' : t('profile.myBookings')}
          </Text>
        </View>

        {successMsg ? (
          <View style={{ backgroundColor: C.green + '15', borderWidth: 1, borderColor: C.green + '40', borderRadius: 10, padding: 10, marginBottom: 8 }}>
            <Text style={{ color: C.green, fontWeight: '700', fontSize: 13 }}>{successMsg}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={{ padding:16 }}>
            <ErrMsg C={C} msg={error} />
            <TouchableOpacity onPress={() => { setError(''); dispatch(fetchBookings({})); }}
              style={{ marginTop:8, padding:10, backgroundColor:C.card, borderRadius:10, borderWidth:1, borderColor:C.border, alignItems:'center' }}>
              <Text style={{ color:C.gold, fontWeight:'600', fontSize:13 }}>🔄 إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <FlatList
          horizontal data={FILTERS} keyExtractor={item => item[0]}
          showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}
          renderItem={({ item: [f, lb] }) => (
            <TouchableOpacity onPress={() => setFilter(f)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: filter === f ? C.gold : C.border, backgroundColor: filter === f ? C.gold : 'transparent' }}>
              <Text style={{ color: filter === f ? '#fff' : C.text, fontSize: 12, fontWeight: filter === f ? '700' : '400' }}>{lb}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String((item as any).id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading && bookings.length === 0} onRefresh={() => dispatch(fetchBookings({}))} tintColor={C.gold} />}
        removeClippedSubviews={true}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={8}
        ListHeaderComponent={
          upcoming.length > 0 ? (
            <View style={{ backgroundColor: C.gold + '10', borderWidth: 1, borderColor: C.gold + '30', borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 14, marginBottom: 8 }}>⏰ القادم</Text>
              {[upcoming[0]].map((b: any) => (
                <View key={b.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <View>
                    <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>
                      {isLawyer ? b.client_name : b.lawyer_name}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                      📅 {b.booking_date} · ⏰ {b.start_time?.slice(0, 5)}
                      {b.service_type === 'video' ? ' · 📹 فيديو' : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {b.service_type === 'video' && (
                      <Btn C={C} size="sm" onPress={() => router.push({ pathname: '/video', params: { booking: b.id } } as any)}>
                        📹 انضم
                      </Btn>
                    )}
                    <Btn C={C} size="sm" variant="ghost" onPress={() => router.push(b.conversation_id ? `/messages?convId=${b.conversation_id}` : '/messages/index' as any)}>
                      💬 راسل
                    </Btn>
                  </View>
                </View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <Empty C={C} icon="📅" title="لا توجد حجوزات"
              action={!isLawyer ? { label: 'ابحث عن محامٍ', onPress: () => router.push('/lawyers' as any) } : undefined}
            />
          ) : (
            <ListSkeleton C={C} count={3} type="booking" />
          )
        }
        renderItem={({ item: b }) => {
          const cfg        = STATUS[(b as any).status] || STATUS.pending;
          const isUpcoming = new Date((b as any).booking_date) >= new Date();
          const otherName  = isLawyer ? (b as any).client_name : (b as any).lawyer_name;
          return (
            <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>
                    {SVC_ICONS[(b as any).service_type] || '⚖️'} {otherName}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>
                    📅 {(b as any).booking_date} · ⏰ {(b as any).start_time?.slice(0, 5)} · #{String((b as any).id).slice(-6)}
                  </Text>
                </View>
                <Badge C={C} color={cfg.color}>{cfg.icon} {cfg.label}</Badge>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                <Text style={{ color: C.gold, fontWeight: '700', fontSize: 15 }}>{(b as any).fee} جنيه</Text>
                <Badge C={C} color={(b as any).payment_status === 'paid' ? C.green : '#F59E0B'}>
                  {(b as any).payment_status === 'paid' ? '💳 مدفوع' : '💳 غير مدفوع'}
                </Badge>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {/* Client actions */}
                {!isLawyer && (b as any).status === 'confirmed' && (b as any).service_type === 'video' && (
                  <Btn C={C} size="sm" onPress={() => router.push({ pathname: '/video', params: { booking: (b as any).id } } as any)}>
                    📹 انضم للجلسة
                  </Btn>
                )}
                {!isLawyer && (b as any).status === 'confirmed' && isUpcoming && (
                  <Btn C={C} size="sm" variant="ghost" disabled={actioning === (b as any).id}
                    onPress={() => changeStatus((b as any).id, 'cancelled')}>
                    {actioning === (b as any).id ? '⏳' : t('app.cancel')}
                  </Btn>
                )}
                {!isLawyer && (b as any).payment_status === 'unpaid' && (b as any).status !== 'cancelled' && (
                  <Btn C={C} size="sm" onPress={() => router.push(`/book?lawyer=${(b as any).lawyer_id}` as any)}>
                    💳 إتمام الدفع
                  </Btn>
                )}
                {!isLawyer && (b as any).status === 'completed' && (
                  <Btn C={C} size="sm" variant="ghost" onPress={() => downloadInvoice((b as any).id)}>
                    🧾 تنزيل الفاتورة
                  </Btn>
                )}
                {!isLawyer && (b as any).status === 'completed' && (
                  <Btn C={C} size="sm" variant="ghost" onPress={() => router.push(`/lawyer/${(b as any).lawyer_id}` as any)}>
                    ⭐ تقييم
                  </Btn>
                )}

                {/* Lawyer actions */}
                {isLawyer && (b as any).status === 'pending' && (
                  <>
                    <Btn C={C} size="sm" disabled={actioning === (b as any).id}
                      onPress={() => changeStatus((b as any).id, 'confirmed')}>
                      {actioning === (b as any).id ? '⏳' : t('app.confirm')}
                    </Btn>
                    <Btn C={C} size="sm" variant="ghost" disabled={actioning === (b as any).id}
                      onPress={() => changeStatus((b as any).id, 'rejected')}>
                      {actioning === (b as any).id ? '⏳' : '❌ رفض'}
                    </Btn>
                  </>
                )}
                {isLawyer && (b as any).status === 'confirmed' && !isUpcoming && (
                  <Btn C={C} size="sm" disabled={actioning === (b as any).id}
                    onPress={() => changeStatus((b as any).id, 'completed')}>
                    {actioning === (b as any).id ? '⏳' : t('booking.completed')}
                  </Btn>
                )}

                {/* Common */}
                <Btn C={C} size="sm" variant="ghost" onPress={() => router.push((b as any).conversation_id ? `/messages?convId=${(b as any).conversation_id}` : '/messages/index' as any)}>
                  💬 رسالة
                </Btn>
              </View>
            </View>
          );
        }}
      />

      {!isLawyer && (
        <TouchableOpacity onPress={() => router.push('/lawyers' as any)}
          style={{ position: 'absolute', bottom: insets.bottom + 20, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.gold, borderRadius: 28, paddingHorizontal: 18, paddingVertical: 14, elevation: 6, shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 8 }}>
          <Text style={{ color: '#fff', fontSize: 20 }}>+</Text>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>حجز جديد</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
