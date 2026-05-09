import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  RefreshControl, Alert, ScrollView,
  ActivityIndicator, Image, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
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

// ─── Live clock — updates every 30s, shared across all cards ─────────────────
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ─── Helper: Parse Booking Time (handles DD-MM-YYYY gracefully) ────────────
function parseBookingTime(dateStr: string, timeStr: string): number {
  if (!dateStr) return NaN;
  let d = dateStr;
  const p = d.split('-');
  if (p.length === 3 && p[0].length === 2 && p[2].length === 4) {
    d = `${p[2]}-${p[1]}-${p[0]}`; // Convert DD-MM-YYYY to YYYY-MM-DD
  }
  return new Date(`${d}T${(timeStr || '23:59').slice(0, 5)}:00`).getTime();
}

// Returns 'locked' | 'open' | 'past'
function getJoinState(bookingDate: string, startTime: string, now: Date): 'locked' | 'open' | 'past' {
  if (!bookingDate || !startTime) return 'locked';
  try {
    const timeMs = parseBookingTime(bookingDate, startTime);
    if (isNaN(timeMs)) return 'locked';
    // TEMPORARY UNLOCK FOR TESTING
    // const diffMin = (timeMs - now.getTime()) / 60000;
    // if (diffMin > 15)   return 'locked'; // more than 15 min away
    // if (diffMin < -90)  return 'past';   // ended more than 90 min ago
    return 'open';
  } catch { return 'locked'; }
}

// Returns human-readable Arabic countdown string
function getCountdown(bookingDate: string, startTime: string, now: Date): string {
  if (!bookingDate || !startTime) return '';
  try {
    const timeMs = parseBookingTime(bookingDate, startTime);
    if (isNaN(timeMs)) return '';
    const diffMs  = timeMs - now.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin <= 0 && diffMin > -90) return 'جارية الآن';
    if (diffMin <= 0) return '';
    if (diffMin < 60) return `تبدأ بعد ${diffMin} دقيقة`;
    const hrs  = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    if (hrs < 24) return mins > 0 ? `تبدأ بعد ${hrs} ساعة و ${mins} دقيقة` : `تبدأ بعد ${hrs} ساعة`;
    const days = Math.floor(hrs / 24);
    const remH = hrs % 24;
    return remH > 0 ? `تبدأ بعد ${days} يوم و ${remH} ساعة` : `تبدأ بعد ${days} يوم`;
  } catch { return ''; }
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, {
  color: string; bg: string; icon: string;
  label: string; desc: string;
}> = {
  pending: {
    color: '#D97706', bg: '#FEF3C7',
    icon: 'clock', label: 'قيد المراجعة',
    desc: 'حجزك تحت المراجعة · سيتم التأكيد قريباً',
  },
  confirmed: {
    color: '#2563EB', bg: '#EFF6FF',
    icon: 'check-circle', label: 'مؤكد',
    desc: 'حجزك مؤكد · موعدك محجوز ومدفوع',
  },
  completed: {
    color: '#16A34A', bg: '#F0FDF4',
    icon: 'award', label: 'مكتمل',
    desc: 'انتهت الجلسة · شاركنا رأيك بتقييم',
  },
  cancelled: {
    color: '#DC2626', bg: '#FEF2F2',
    icon: 'x-circle', label: 'ملغي',
    desc: 'تم إلغاء هذا الحجز',
  },
  rejected: {
    color: '#DC2626', bg: '#FEF2F2',
    icon: 'slash', label: 'مرفوض',
    desc: 'لم يتمكن المحامي من قبول الحجز · يمكنك الحجز مجدداً',
  },
};

const SVC_LABELS: Record<string, { icon: string; label: string }> = {
  video:       { icon: 'video', label: 'استشارة فيديو' },
  chat:        { icon: 'message-circle', label: 'استشارة نصية' },
  phone:       { icon: 'phone', label: 'مكالمة صوتية' },
  inperson:    { icon: 'map-pin', label: 'لقاء شخصي' },
  document:    { icon: 'file-text', label: 'مراجعة وثيقة' },
  consultation:{ icon: 'briefcase', label: 'استشارة قانونية' },
};

const FILTERS = [
  { key: 'all',       label: 'الكل' },
  { key: 'confirmed', label: 'مؤكد' },
  { key: 'pending',   label: 'انتظار' },
  { key: 'completed', label: 'مكتمل' },
  { key: 'cancelled', label: 'ملغي' },
];


// ─── Lawyer Avatar ────────────────────────────────────────────────────────────
function LawyerAvatar({ name, uri, size = 46 }: { name: string; uri?: string; size?: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#9A6F2A20' }}
      />
    );
  }
  const initials = name
    ? name.trim().split(/\s+/).map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase()
    : '?';
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#9A6F2A',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: '#C8A84B40',
    }}>
      <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '800' }}>{initials}</Text>
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ label, C }: { label: string; C: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4 }}>
      <Text style={{ color: C.gold, fontWeight: '800', fontSize: 13 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
    </View>
  );
}

// ─── Consultation Card ────────────────────────────────────────────────────────
function ConsultCard({
  b, C, isLawyer, actioning, onChangeStatus, onInvoice, t,
}: any) {
  const status = b.status || 'pending';
  const cfg    = STATUS_CFG[status] || STATUS_CFG.pending;
  const svc    = SVC_LABELS[(b.service_type || '').toLowerCase()] || SVC_LABELS.consultation;
  const name   = isLawyer ? b.client_name : b.lawyer_name;
  const avatarUri = isLawyer ? b.client_avatar_url : b.lawyer_avatar_url;
  const lawyerId = b.lawyer_id || b.lawyer_user_id;
  const isPaid   = b.payment_status === 'paid' || status === 'confirmed' || status === 'completed';
  const isActioning  = actioning === b.id;
  const now          = useNow();
  const joinState    = (status === 'confirmed' && ['video','chat','phone'].includes((b.service_type||'').toLowerCase()))
    ? getJoinState(b.booking_date, b.start_time, now)
    : null;
  const countdown    = getCountdown(b.booking_date, b.start_time, now);
  const upcoming     = (() => {
    try { return new Date(b.booking_date) >= new Date(new Date().toDateString()); }
    catch { return false; }
  })();

  const isChatService = (b.service_type || '').toLowerCase() === 'chat';
  const isMessagingActive = isChatService;

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
        backgroundColor: C.card,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
      }}>
        <Feather name={cfg.icon as any} size={20} color={cfg.color} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: cfg.color, fontWeight: '700', fontSize: 13 }}>{cfg.label}</Text>
          <Text style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>{cfg.desc}</Text>
        </View>
        <View style={{
          borderWidth: 1,
          borderColor: C.border,
          backgroundColor: C.surface,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 20,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Feather name={svc.icon as any} size={12} color={C.text} /><Text style={{ color: C.text, fontSize: 11, fontWeight: '700' }}>{svc.label}</Text></View>
        </View>
      </View>

      {/* ── Main Info ── */}
      <View style={{ padding: 16 }}>
        {/* Avatar + Name row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <LawyerAvatar name={name || ''} uri={avatarUri || undefined} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>
              {name || '—'}
            </Text>
            {b.specialization ? (
              <Text style={{ color: C.gold, fontSize: 12, marginTop: 2 }}>{b.specialization}</Text>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
          {b.booking_date ? (<View style={{flexDirection: 'row', alignItems:'center', gap:6}}><Feather name='calendar' size={14} color={C.muted}/><Text style={{ color: C.muted, fontSize: 13 }}>{b.booking_date}</Text></View>) : null}
          {b.start_time ? (<View style={{flexDirection: 'row', alignItems:'center', gap:6}}><Feather name='clock' size={14} color={C.muted}/><Text style={{ color: C.muted, fontSize: 13 }}>{b.start_time?.slice(0, 5)}</Text></View>) : null}
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
              {isPaid ? 'مدفوع' : 'غير مدفوع'}
            </Text>
          </View>
          <Text style={{ color: C.muted, fontSize: 11, marginLeft: 'auto' }}>
            #{String(b.id).slice(-6).toUpperCase()}
          </Text>
        </View>

        {/* ── Location Row (For In-Person Only) ── */}
        {(b.service_type || '').toLowerCase() === 'inperson' && (
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            marginBottom: 14, padding: 12, borderRadius: 12,
            backgroundColor: C.card2, borderWidth: 1, borderColor: C.border
          }}>
            <Feather name='map-pin' size={20} color={C.gold} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>
                {b.lawyer_office || b.lawyer_city || 'عنوان المكتب غير متوفر'}
              </Text>
              {(b.lawyer_office || b.lawyer_city) && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(b.lawyer_office || b.lawyer_city)}`)}
                  style={{ marginTop: 4 }}
                >
                  <Text style={{ color: C.gold, fontSize: 12, textDecorationLine: 'underline' }}>
                    🗺️ فتح في الخرائط
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── Action Buttons ── */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>

          {/* ── 📹 JOIN BUTTON — 3 states ── */}
          {!isLawyer && joinState !== null && joinState !== 'past' && (
            joinState === 'open' ? (
              <TouchableOpacity
                onPress={() => Linking.openURL(`https://meet.jit.si/wakeel-consultation-${b.id}`)}
                style={{
                  flex: 1, backgroundColor: C.gold,
                  paddingVertical: 14, borderRadius: 12,
                  alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: 8,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}><Feather name='video' size={16} color='#fff' /> فتح غرفة الفيديو</Text>
              </TouchableOpacity>
            ) : (
              // LOCKED state
              <View style={{
                flex: 1, borderWidth: 1, borderColor: C.border,
                backgroundColor: C.surface, borderRadius: 12,
                paddingVertical: 10, paddingHorizontal: 8,
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 16, marginBottom: 2 }}>🔒</Text>
                <Text style={{ color: C.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>
                  يفتح قبل 15 دقيقة من الموعد
                </Text>
                {countdown ? (
                  <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                    {countdown}
                  </Text>
                ) : null}
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
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}><Feather name='credit-card' size={14} color='#fff' /> إتمام الدفع</Text>
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
                borderWidth: 1, borderColor: C.border,
                backgroundColor: C.surface, paddingHorizontal: 14,
                paddingVertical: 10, borderRadius: 10,
                flexDirection: 'row', alignItems: 'center', gap: 6,
                opacity: isActioning ? 0.5 : 1,
              }}
            >
              <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>
                {isActioning ? '⏳' : 'إلغاء'}
              </Text>
            </TouchableOpacity>
          )}

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
              <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}><Feather name='file-text' size={14} color={C.text} /> إيصال</Text>
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
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}><Feather name='star' size={14} color={C.gold} /> قيّم</Text>
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
              <Text style={{ color: C.gold, fontWeight: '600', fontSize: 13 }}><Feather name='refresh-cw' size={14} color={C.gold} /> احجز مجدداً</Text>
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

        {/* ── Message link — conditional based on service type & time ── */}
        {isMessagingActive && (
          <TouchableOpacity
            onPress={() => router.push(
              b.conversation_id
                ? (`/messages?convId=${b.conversation_id}` as any)
                : (`/messages/index?newChatWith=${isLawyer ? b.client_id : lawyerId}&bookingRef=${b.id}` as any)
            )}
            style={{ marginTop: 10, alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 2 }}
          >
            <Text style={{ color: C.muted, fontSize: 12, textDecorationLine: 'underline' }}>
              {isLawyer ? '💬 راسل العميل' : '💬 راسل المحامي'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ C, isLawyer }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 32 }}>
      <Feather name='calendar' size={48} color={C.muted} style={{marginBottom: 16}} />
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
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}><Feather name='search' size={16} color='#fff' /> ابحث عن محامٍ</Text>
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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

  // Section grouping for 'all' filter — Upcoming vs Past
  const filtered = filter === 'all' ? bookings : bookings.filter((b: any) => b.status === filter);
  const now0 = new Date();
  const upcomingList = (filter === 'all' ? bookings : filtered).filter((b: any) => {
    if (['cancelled','rejected','completed'].includes(b.status)) return false;
    const t = parseBookingTime(b.booking_date, b.start_time);
    if (isNaN(t)) return true; // Show unparseable dates just in case
    return t > now0.getTime() - 5400000;
  }).sort((a: any, b: any) => {
    const ta = parseBookingTime(a.booking_date, a.start_time);
    const tb = parseBookingTime(b.booking_date, b.start_time);
    if (isNaN(ta) || isNaN(tb)) return 0;
    return ta - tb; // ASCENDING: closest date first
  });

  const pastList = (filter === 'all' ? bookings : filtered).filter((b: any) => {
    if (['cancelled','rejected','completed'].includes(b.status)) return true;
    const t = parseBookingTime(b.booking_date, b.start_time);
    if (isNaN(t)) return false; // Hide unparseable dates from past to avoid duplicates
    return t <= now0.getTime() - 5400000;
  }).sort((a: any, b: any) => {
    const ta = parseBookingTime(a.booking_date, a.start_time);
    const tb = parseBookingTime(b.booking_date, b.start_time);
    if (isNaN(ta) || isNaN(tb)) return 0;
    return tb - ta; // DESCENDING: most recent past first
  });
  const showSections = filter === 'all';
  const listData: any[] = showSections
    ? [
        ...(upcomingList.length > 0 ? [{ _sectionHeader: 'القادمة', _id: '__upcoming__' }, ...upcomingList] : []),
        ...(pastList.length > 0    ? [{ _sectionHeader: 'السابقة', _id: '__past__' },    ...pastList    ] : []),
      ]
    : filtered;

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
          {isLawyer ? 'جلساتي' : 'استشاراتي'}
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
                paddingHorizontal: 14, paddingVertical: 8,
                borderRadius: 20, borderWidth: 1,
                minWidth: 70,
                borderColor: filter === key ? C.gold : C.border,
                backgroundColor: filter === key ? C.gold : 'transparent',
              }}
            >
              <Text style={{
                color: filter === key ? '#fff' : C.text,
                fontSize: 12, fontWeight: filter === key ? '700' : '400',
                textAlign: 'center',
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
          data={listData}
          keyExtractor={item => (item as any)._id || String((item as any).id)}
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
          renderItem={({ item: b }) => {
            if ((b as any)._sectionHeader) {
              return <SectionHeader label={(b as any)._sectionHeader} C={C} />;
            }
            return (
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
            );
          }}
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
