import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, Alert, ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchBookings, updateBooking,
  selBookings, selBLoading, selBError,
} from '../../src/store/slices/bookingsSlice';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { invoicesAPI } from '../../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppDispatch } from '../../src/store';
import { useI18n } from '../../src/i18n';
import { recordCompletedConsultation } from '../../src/utils/storeReview';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, {
  color: string; bg: string; icon: string;
  label: string; desc: string;
}> = {
  pending: {
    color: '#D97706', bg: '#FEF3C7',
    icon: '⏳', label: 'قيد المراجعة',
    desc: 'حجزك تحت المراجعة · سيتم التأكيد قريباً',
  },
  confirmed: {
    color: '#2563EB', bg: '#EFF6FF',
    icon: '✅', label: 'مؤكد',
    desc: 'حجزك مؤكد · موعدك محجوز ومدفوع',
  },
  completed: {
    color: '#16A34A', bg: '#F0FDF4',
    icon: '🏆', label: 'مكتمل',
    desc: 'انتهت الجلسة · شاركنا رأيك بتقييم',
  },
  cancelled: {
    color: '#DC2626', bg: '#FEF2F2',
    icon: '❌', label: 'ملغي',
    desc: 'تم إلغاء هذا الحجز',
  },
  rejected: {
    color: '#DC2626', bg: '#FEF2F2',
    icon: '🚫', label: 'مرفوض',
    desc: 'لم يتمكن المحامي من قبول الحجز · يمكنك الحجز مجدداً',
  },
};

const SVC_LABELS: Record<string, { icon: string; label: string }> = {
  video:       { icon: '📹', label: 'استشارة فيديو' },
  chat:        { icon: '💬', label: 'استشارة نصية' },
  phone:       { icon: '📞', label: 'مكالمة صوتية' },
  inperson:    { icon: '🏛️', label: 'لقاء شخصي' },
  document:    { icon: '📄', label: 'مراجعة وثيقة' },
  consultation:{ icon: '⚖️', label: 'استشارة قانونية' },
};

const FILTERS = [
  { key: 'all',       label: 'الكل' },
  { key: 'confirmed', label: '✅ مؤكد' },
  { key: 'pending',   label: '⏳ انتظار' },
  { key: 'completed', label: '🏆 مكتمل' },
  { key: 'cancelled', label: '❌ ملغي' },
];

// ─── Helper: is consultation happening "now" (within 30 min) ─────────────────
function isHappeningNow(bookingDate: string, startTime: string): boolean {
  if (!bookingDate || !startTime) return false;
  try {
    const dt = new Date(`${bookingDate}T${startTime}`);
    const now = new Date();
    const diffMin = (dt.getTime() - now.getTime()) / 60000;
    return diffMin >= -60 && diffMin <= 30; // 30 min before → 60 min after
  } catch { return false; }
}

function isUpcoming(bookingDate: string): boolean {
  if (!bookingDate) return false;
  try {
    return new Date(bookingDate) >= new Date(new Date().toDateString());
  } catch { return false; }
}

// ─── Consultation Card ────────────────────────────────────────────────────────
function ConsultCard({
  b, C, isLawyer, actioning, onChangeStatus, onInvoice, t,
}: any) {
  const status = b.status || 'pending';
  const cfg    = STATUS_CFG[status] || STATUS_CFG.pending;
  const svc    = SVC_LABELS[(b.service_type || '').toLowerCase()] || SVC_LABELS.consultation;
  const name   = isLawyer ? b.client_name : b.lawyer_name;
  const lawyerId = b.lawyer_id || b.lawyer_user_id;
  const isPaid   = b.payment_status === 'paid' || status === 'confirmed' || status === 'completed';
  const upcoming = isUpcoming(b.booking_date);
  const happeningNow = isHappeningNow(b.booking_date, b.start_time);
  const isActioning  = actioning === b.id;

  return (
    <View style={{
      backgroundColor: C.card,
      borderRadius: 18,
      marginBottom: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: C.border,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    }}>
      {/* ── Status Banner ── */}
      <View style={{
        backgroundColor: cfg.bg,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: cfg.color + '30',
      }}>
        <Text style={{ fontSize: 18 }}>{cfg.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: cfg.color, fontWeight: '700', fontSize: 13 }}>{cfg.label}</Text>
          <Text style={{ color: cfg.color + 'CC', fontSize: 11, marginTop: 1 }}>{cfg.desc}</Text>
        </View>
        <View style={{
          backgroundColor: cfg.color + '20',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 20,
        }}>
          <Text style={{ color: cfg.color, fontSize: 11, fontWeight: '700' }}>{svc.icon} {svc.label}</Text>
        </View>
      </View>

      {/* ── Main Info ── */}
      <View style={{ padding: 16 }}>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 17, marginBottom: 4 }}>
          {name || '—'}
        </Text>
        {b.specialization ? (
          <Text style={{ color: C.gold, fontSize: 12, marginBottom: 8 }}>{b.specialization}</Text>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
          {b.booking_date ? (
            <Text style={{ color: C.muted, fontSize: 13 }}>
              📅 {b.booking_date}
            </Text>
          ) : null}
          {b.start_time ? (
            <Text style={{ color: C.muted, fontSize: 13 }}>
              ⏰ {b.start_time?.slice(0, 5)}
            </Text>
          ) : null}
        </View>

        {/* ── Payment Row ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          gap: 10, marginBottom: 14,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}>
          <Text style={{ color: C.gold, fontWeight: '800', fontSize: 18 }}>
            {b.fee ?? b.amount ?? '—'} <Text style={{ fontSize: 13, fontWeight: '400' }}>جنيه</Text>
          </Text>
          <View style={{
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
            backgroundColor: isPaid ? '#16A34A20' : '#D9770620',
          }}>
            <Text style={{ color: isPaid ? '#16A34A' : '#D97706', fontWeight: '700', fontSize: 12 }}>
              {isPaid ? '💳 مدفوع' : '💳 غير مدفوع'}
            </Text>
          </View>
          <Text style={{ color: C.muted, fontSize: 11, marginLeft: 'auto' }}>
            #{String(b.id).slice(-6).toUpperCase()}
          </Text>
        </View>

        {/* ── Action Buttons ── */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>

          {/* 📹 JOIN NOW — shown when confirmed + time is near */}
          {!isLawyer && status === 'confirmed' && (b.service_type === 'video' || b.service_type === 'chat' || b.service_type === 'phone') && (
            happeningNow ? (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/video', params: { booking: b.id } } as any)}
                style={{
                  flex: 1, backgroundColor: C.gold,
                  paddingVertical: 14, borderRadius: 12,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>📹 انضم الآن</Text>
              </TouchableOpacity>
            ) : (
              <View style={{
                flex: 1, backgroundColor: C.gold + '20', borderWidth: 1,
                borderColor: C.gold + '50', paddingVertical: 12,
                borderRadius: 12, alignItems: 'center',
                flexDirection: 'row', justifyContent: 'center', gap: 8,
              }}>
                <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>⏰ قريباً · {b.start_time?.slice(0, 5)}</Text>
              </View>
            )
          )}

          {/* Complete Payment */}
          {!isLawyer && !isPaid && status !== 'cancelled' && status !== 'rejected' && (
            <TouchableOpacity
              onPress={() => router.push(`/book?lawyer=${lawyerId}` as any)}
              style={{
                backgroundColor: '#D97706', paddingHorizontal: 14,
                paddingVertical: 10, borderRadius: 10,
                flexDirection: 'row', alignItems: 'center', gap: 6,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>💳 إتمام الدفع</Text>
            </TouchableOpacity>
          )}

          {/* Cancel (only if upcoming + confirmed/pending) */}
          {!isLawyer && (status === 'confirmed' || status === 'pending') && upcoming && (
            <TouchableOpacity
              disabled={isActioning}
              onPress={() =>
                Alert.alert('تأكيد الإلغاء', 'هل تريد إلغاء هذا الحجز؟', [
                  { text: 'لا', style: 'cancel' },
                  { text: 'نعم، إلغاء', style: 'destructive', onPress: () => onChangeStatus(b.id, 'cancelled') },
                ])
              }
              style={{
                borderWidth: 1, borderColor: '#DC262640',
                backgroundColor: '#DC262610', paddingHorizontal: 14,
                paddingVertical: 10, borderRadius: 10,
                flexDirection: 'row', alignItems: 'center', gap: 6,
                opacity: isActioning ? 0.5 : 1,
              }}
            >
              <Text style={{ color: '#DC2626', fontWeight: '600', fontSize: 13 }}>
                {isActioning ? '⏳' : '❌ إلغاء'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Message */}
          <TouchableOpacity
            onPress={() => router.push(
              b.conversation_id
                ? (`/messages?convId=${b.conversation_id}` as any)
                : ('/messages/index' as any)
            )}
            style={{
              borderWidth: 1, borderColor: C.border,
              backgroundColor: C.surface, paddingHorizontal: 14,
              paddingVertical: 10, borderRadius: 10,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}
          >
            <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>💬 رسالة</Text>
          </TouchableOpacity>

          {/* Download Receipt (completed + paid) */}
          {!isLawyer && status === 'completed' && isPaid && (
            <TouchableOpacity
              onPress={() => onInvoice(b.id)}
              style={{
                borderWidth: 1, borderColor: C.border,
                backgroundColor: C.surface, paddingHorizontal: 14,
                paddingVertical: 10, borderRadius: 10,
                flexDirection: 'row', alignItems: 'center', gap: 6,
              }}
            >
              <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>🧾 إيصال</Text>
            </TouchableOpacity>
          )}

          {/* Rate (completed, client only) */}
          {!isLawyer && status === 'completed' && lawyerId && (
            <TouchableOpacity
              onPress={() => router.push(`/lawyer/${lawyerId}` as any)}
              style={{
                borderWidth: 1, borderColor: C.gold + '60',
                backgroundColor: C.gold + '15', paddingHorizontal: 14,
                paddingVertical: 10, borderRadius: 10,
                flexDirection: 'row', alignItems: 'center', gap: 6,
              }}
            >
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>⭐ قيّم</Text>
            </TouchableOpacity>
          )}

          {/* Book Again (completed / cancelled / rejected) */}
          {!isLawyer && ['completed', 'cancelled', 'rejected'].includes(status) && lawyerId && (
            <TouchableOpacity
              onPress={() => router.push(`/lawyer/${lawyerId}` as any)}
              style={{
                borderWidth: 1, borderColor: C.gold + '40',
                backgroundColor: C.gold + '10', paddingHorizontal: 14,
                paddingVertical: 10, borderRadius: 10,
                flexDirection: 'row', alignItems: 'center', gap: 6,
              }}
            >
              <Text style={{ color: C.gold, fontWeight: '600', fontSize: 13 }}>🔄 احجز مجدداً</Text>
            </TouchableOpacity>
          )}

          {/* ── Lawyer actions ── */}
          {isLawyer && status === 'pending' && (
            <>
              <TouchableOpacity
                disabled={isActioning}
                onPress={() => onChangeStatus(b.id, 'confirmed')}
                style={{
                  backgroundColor: '#16A34A', paddingHorizontal: 14,
                  paddingVertical: 10, borderRadius: 10, opacity: isActioning ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  {isActioning ? '⏳' : '✅ قبول'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isActioning}
                onPress={() => onChangeStatus(b.id, 'rejected')}
                style={{
                  backgroundColor: '#DC262620', borderWidth: 1, borderColor: '#DC262640',
                  paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                  opacity: isActioning ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#DC2626', fontWeight: '600', fontSize: 13 }}>
                  {isActioning ? '⏳' : '❌ رفض'}
                </Text>
              </TouchableOpacity>
            </>
          )}
          {isLawyer && status === 'confirmed' && !upcoming && (
            <TouchableOpacity
              disabled={isActioning}
              onPress={() => onChangeStatus(b.id, 'completed')}
              style={{
                backgroundColor: '#16A34A', paddingHorizontal: 14,
                paddingVertical: 10, borderRadius: 10, opacity: isActioning ? 0.5 : 1,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                {isActioning ? '⏳' : '🏆 إنهاء الجلسة'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ C, isLawyer }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32 }}>
      <Text style={{ fontSize: 64, marginBottom: 16 }}>📅</Text>
      <Text style={{ color: C.text, fontWeight: '700', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>
        {isLawyer ? 'لا توجد جلسات بعد' : 'لا توجد استشارات بعد'}
      </Text>
      <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
        {isLawyer
          ? 'عند حجز عميل معك، ستظهر جلساتك هنا'
          : 'ابحث عن محامٍ مناسب واحجز استشارتك الأولى'}
      </Text>
      {!isLawyer && (
        <TouchableOpacity
          onPress={() => router.push('/lawyers' as any)}
          style={{
            backgroundColor: '#9A6F2A',
            paddingHorizontal: 28, paddingVertical: 14,
            borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>🔍 ابحث عن محامٍ</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MyConsultationsScreen() {
  const C        = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const insets   = useSafeAreaInsets();
  const { isLawyer } = useAuth();
  const { t } = useI18n();

  const bookings = useSelector(selBookings);
  const loading  = useSelector(selBLoading);
  const apiError = useSelector(selBError);

  const [filter,    setFilter]    = useState('all');
  const [actioning, setActioning] = useState<string | null>(null);
  const [error,     setError]     = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    dispatch(fetchBookings({}))
      .unwrap()
      .catch((e: any) => setError(e?.message || 'تعذر تحميل الاستشارات'));
  }, [dispatch]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchBookings({})).unwrap().catch(() => {});
    setRefreshing(false);
  }, [dispatch]);

  const onChangeStatus = useCallback(async (id: string, status: string) => {
    setActioning(id);
    try {
      await dispatch(updateBooking({ id, status })).unwrap();
      if (status === 'completed') await recordCompletedConsultation().catch(() => {});
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر تحديث الحجز');
    } finally {
      setActioning(null);
    }
  }, [dispatch]);

  const onInvoice = useCallback(async (bookingId: string) => {
    try {
      await invoicesAPI.create(bookingId);
      Alert.alert('✅', 'تم إنشاء الإيصال! ستصلك نسخة على بريدك الإلكتروني.');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر إنشاء الإيصال');
    }
  }, []);

  const filtered = filter === 'all'
    ? bookings
    : bookings.filter((b: any) => b.status === filter);

  // Stats bar
  const total     = bookings.length;
  const confirmed = bookings.filter((b: any) => b.status === 'confirmed').length;
  const completed = bookings.filter((b: any) => b.status === 'completed').length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Header ── */}
      <View style={{
        backgroundColor: C.surface,
        paddingTop: insets.top + 8,
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
      }}>
        <Text style={{
          color: C.text, fontWeight: '800', fontSize: 22,
          fontFamily: 'Cairo-Bold', marginBottom: 4,
        }}>
          {isLawyer ? '⚖️ جلساتي' : '📋 استشاراتي'}
        </Text>

        {/* Stats Row */}
        {total > 0 && (
          <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
            <Text style={{ color: C.muted, fontSize: 12 }}>الكل: <Text style={{ color: C.text, fontWeight: '700' }}>{total}</Text></Text>
            {confirmed > 0 && <Text style={{ color: C.muted, fontSize: 12 }}>مؤكد: <Text style={{ color: '#2563EB', fontWeight: '700' }}>{confirmed}</Text></Text>}
            {completed > 0 && <Text style={{ color: C.muted, fontSize: 12 }}>مكتمل: <Text style={{ color: '#16A34A', fontWeight: '700' }}>{completed}</Text></Text>}
          </View>
        )}

        {/* Error Banner */}
        {(error || apiError) ? (
          <TouchableOpacity
            onPress={() => { setError(''); load(); }}
            style={{
              backgroundColor: '#DC262615', borderWidth: 1,
              borderColor: '#DC262640', borderRadius: 10,
              padding: 10, marginBottom: 8,
              flexDirection: 'row', alignItems: 'center', gap: 8,
            }}
          >
            <Text style={{ color: '#DC2626', flex: 1, fontSize: 13 }}>
              ⚠️ {error || apiError}
            </Text>
            <Text style={{ color: '#DC2626', fontWeight: '700' }}>🔄 إعادة</Text>
          </TouchableOpacity>
        ) : null}

        {/* Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => setFilter(key)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8,
                borderRadius: 20, borderWidth: 1,
                borderColor: filter === key ? C.gold : C.border,
                backgroundColor: filter === key ? C.gold : 'transparent',
              }}
            >
              <Text style={{
                color: filter === key ? '#fff' : C.text,
                fontSize: 12, fontWeight: filter === key ? '700' : '400',
              }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── List ── */}
      {loading && bookings.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={C.gold} />
          <Text style={{ color: C.muted, marginTop: 12, fontSize: 14 }}>جاري التحميل…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String((item as any).id)}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 100,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={C.gold}
              colors={[C.gold]}
            />
          }
          ListEmptyComponent={<EmptyState C={C} isLawyer={isLawyer} />}
          renderItem={({ item: b }) => (
            <ConsultCard
              key={(b as any).id}
              b={b}
              C={C}
              isLawyer={isLawyer}
              actioning={actioning}
              onChangeStatus={onChangeStatus}
              onInvoice={onInvoice}
              t={t}
            />
          )}
        />
      )}

      {/* ── FAB: Book New ── */}
      {!isLawyer && (
        <TouchableOpacity
          onPress={() => router.push('/lawyers' as any)}
          style={{
            position: 'absolute',
            bottom: insets.bottom + 16,
            right: 16,
            backgroundColor: C.gold,
            borderRadius: 28,
            paddingHorizontal: 20,
            paddingVertical: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            elevation: 6,
            shadowColor: '#9A6F2A',
            shadowOpacity: 0.4,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18 }}>+</Text>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>استشارة جديدة</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
