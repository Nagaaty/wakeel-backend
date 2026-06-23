import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity,
  RefreshControl, Alert, ScrollView,
  ActivityIndicator, Linking, Modal, TextInput, KeyboardAvoidingView, Platform
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchBookings, updateBooking,
  selBookings, selBLoading, selBError,
} from '../../src/features/consultations/bookingsSlice';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { invoicesAPI, lawyersAPI, messagesAPI } from '../../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppDispatch } from '../../src/store';
import { useI18n } from '../../src/i18n';
import { recordCompletedConsultation } from '../../src/utils/storeReview';
import { Image as ExpoImage } from 'expo-image';
import { resolveMediaUrl } from '../../src/services/api';

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
    const timeMs  = parseBookingTime(bookingDate, startTime);
    if (isNaN(timeMs)) return 'locked';
    const diffMin = (timeMs - now.getTime()) / 60000;
    if (diffMin > 15)  return 'locked'; // more than 15 min before start
    if (diffMin < -90) return 'past';   // ended more than 90 min ago
    return 'open';
  } catch { return 'locked'; }
}

// Returns human-readable countdown string
function getCountdown(bookingDate: string, startTime: string, now: Date, isRTL: boolean): string {
  if (!bookingDate || !startTime) return '';
  try {
    const timeMs = parseBookingTime(bookingDate, startTime);
    if (isNaN(timeMs)) return '';
    const diffMs  = timeMs - now.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin <= 0 && diffMin > -90) return isRTL ? 'جارية الآن' : 'In Progress';
    if (diffMin <= 0) return '';
    if (diffMin < 60) return isRTL ? `تبدأ بعد ${diffMin} دقيقة` : `Starts in ${diffMin} min`;
    const hrs  = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    if (hrs < 24) return mins > 0 ? (isRTL ? `تبدأ بعد ${hrs} ساعة و ${mins} دقيقة` : `Starts in ${hrs}h ${mins}m`) : (isRTL ? `تبدأ بعد ${hrs} ساعة` : `Starts in ${hrs}h`);
    const days = Math.floor(hrs / 24);
    const remH = hrs % 24;
    return remH > 0 ? (isRTL ? `تبدأ بعد ${days} يوم و ${remH} ساعة` : `Starts in ${days}d ${remH}h`) : (isRTL ? `تبدأ بعد ${days} يوم` : `Starts in ${days} days`);
  } catch { return ''; }
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = (isRTL: boolean): Record<string, any> => ({
  pending: {
    color: '#D97706', bg: '#FEF3C7', icon: 'clock',
    label: isRTL ? 'قيد المراجعة' : 'Pending',
    desc: isRTL ? 'حجزك تحت المراجعة · سيتم التأكيد قريباً' : 'Booking under review',
  },
  confirmed: {
    color: '#2563EB', bg: '#EFF6FF', icon: 'check-circle',
    label: isRTL ? 'مؤكد' : 'Confirmed',
    desc: isRTL ? 'حجزك مؤكد · موعدك محجوز ومدفوع' : 'Confirmed & paid',
  },
  completed: {
    color: '#16A34A', bg: '#F0FDF4', icon: 'award',
    label: isRTL ? 'مكتمل' : 'Completed',
    desc: isRTL ? 'انتهت الجلسة · شاركنا رأيك بتقييم' : 'Session ended',
  },
  cancelled: {
    color: '#DC2626', bg: '#FEF2F2', icon: 'x-circle',
    label: isRTL ? 'ملغي' : 'Cancelled',
    desc: isRTL ? 'تم إلغاء هذا الحجز' : 'Booking was cancelled',
  },
  rejected: {
    color: '#DC2626', bg: '#FEF2F2', icon: 'slash',
    label: isRTL ? 'مرفوض' : 'Rejected',
    desc: isRTL ? 'لم يتمكن المحامي من قبول الحجز' : 'Lawyer declined',
  },
});

const SVC_LABELS = (isRTL: boolean): Record<string, any> => ({
  video:       { icon: 'video', label: isRTL ? 'استشارة فيديو' : 'Video Call' },
  chat:        { icon: 'message-circle', label: isRTL ? 'استشارة نصية' : 'Text Chat' },
  phone:       { icon: 'phone', label: isRTL ? 'مكالمة صوتية' : 'Voice Call' },
  inperson:    { icon: 'map-pin', label: isRTL ? 'لقاء شخصي' : 'In-Person' },
  document:    { icon: 'file-text', label: isRTL ? 'مراجعة وثيقة' : 'Doc Review' },
  consultation:{ icon: 'briefcase', label: isRTL ? 'استشارة قانونية' : 'Consultation' },
});

const FILTERS = (isRTL: boolean) => [
  { key: 'all',       label: isRTL ? 'الكل' : 'All' },
  { key: 'confirmed', label: isRTL ? 'مؤكد' : 'Confirmed' },
  { key: 'pending',   label: isRTL ? 'انتظار' : 'Pending' },
  { key: 'completed', label: isRTL ? 'مكتمل' : 'Completed' },
  { key: 'cancelled', label: isRTL ? 'ملغي' : 'Cancelled' },
];


// ─── Lawyer Avatar ────────────────────────────────────────────────────────────
function LawyerAvatar({ name, uri, size = 46 }: { name: string; uri?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const resolvedUri = resolveMediaUrl(uri);
  const initials = name
    ? name.trim().split(/\s+/).map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <View style={{ width: size, height: size }}>
      {/* Initials always visible underneath */}
      <View style={{
        position: 'absolute',
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#9A6F2A30',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: '#C8A84B40',
      }}>
        <Text style={{ color: '#9A6F2A', fontSize: size * 0.38, fontWeight: '800' }}>{initials}</Text>
      </View>

      {/* Real photo overlays when it loads, goes away on error */}
      {resolvedUri && !failed && (
        <ExpoImage
          source={{ uri: resolvedUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          onError={() => setFailed(true)}
        />
      )}
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

function ConsultCard({
  b, C, isLawyer, actioning, onChangeStatus, onInvoice, onRateLawyer, isRTL, t,
}: any) {
  const status = b.status || 'pending';
  const cfg    = STATUS_CFG(isRTL)[status] || STATUS_CFG(isRTL).pending;
  const svc    = SVC_LABELS(isRTL)[(b.service_type || '').toLowerCase()] || SVC_LABELS(isRTL).consultation;
  const name   = isLawyer ? b.client_name : b.lawyer_name;
  const avatarUri = isLawyer ? b.client_avatar_url : b.lawyer_avatar_url;
  const lawyerId = b.lawyer_id || b.lawyer_user_id;
  const isPaid   = b.payment_status === 'paid' || status === 'confirmed' || status === 'completed';
  const isActioning  = actioning === b.id;
  const now          = useNow();
  const svcType = (b.service_type || '').toLowerCase();
  const isVideoSvc  = svcType === 'video';
  const isChatSvc   = svcType === 'chat' || svcType === 'text';
  const joinState = (status === 'confirmed') ? getJoinState(b.booking_date, b.start_time, now) : null;
  const countdown = getCountdown(b.booking_date, b.start_time, now, isRTL);
  const upcoming  = (() => {
    try { return new Date(b.booking_date) >= new Date(new Date().toDateString()); }
    catch { return false; }
  })();

  const rowDir = isRTL ? 'row' : 'row-reverse';
  const alignStart = isRTL ? 'flex-start' : 'flex-end';
  const alignEnd = isRTL ? 'flex-end' : 'flex-start';

  return (
    <View style={{
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 15,
      elevation: 4,
      borderWidth: 1,
      borderColor: '#F0EBE0'
    }}>
      {/* ── Top Row: Service Type & Status Badge ── */}
      <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 6, backgroundColor: '#F8F9FA', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
          <Feather name={svc.icon} size={14} color="#666" />
          <Text style={{ color: '#444', fontSize: 13, fontWeight: '700' }}>{svc.label}</Text>
        </View>
        <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 6, backgroundColor: cfg.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
          <Feather name={cfg.icon} size={14} color={cfg.color} />
          <Text style={{ color: cfg.color, fontSize: 13, fontWeight: '800' }}>{cfg.label}</Text>
        </View>
      </View>

      {/* ── Lawyer/Client Info ── */}
      <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <LawyerAvatar name={name || ''} uri={avatarUri || undefined} size={50} />
        <View style={{ flex: 1, alignItems: alignStart }}>
          <Text style={{ color: '#1A1A1A', fontWeight: '800', fontSize: 16 }}>{name || '—'}</Text>
          {b.specialization && <Text style={{ color: C.gold, fontSize: 12, marginTop: 2, fontWeight: '700' }}>{b.specialization}</Text>}
        </View>
        {/* Subtle Price */}
        <View style={{ alignItems: alignEnd }}>
          <Text style={{ color: '#1A1A1A', fontWeight: '800', fontSize: 16 }}>{b.fee ?? b.amount ?? '—'} <Text style={{ fontSize: 10, fontWeight: '600', color: '#666' }}>{isRTL ? 'ج.م' : 'EGP'}</Text></Text>
          <Text style={{ color: isPaid ? '#16A34A' : '#D97706', fontSize: 10, fontWeight: '800', marginTop: 2 }}>{isPaid ? (isRTL ? 'مدفوع' : 'Paid') : (isRTL ? 'غير مدفوع' : 'Unpaid')}</Text>
        </View>
      </View>

      {/* ── Date & Time ── */}
      <View style={{ flexDirection: rowDir, gap: 16, marginBottom: 16, backgroundColor: '#FDFBF7', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F5F0E8' }}>
        {b.booking_date && <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 6 }}><Feather name='calendar' size={14} color={C.gold}/><Text style={{ color: '#444', fontSize: 12, fontWeight: '700' }}>{b.booking_date}</Text></View>}
        {b.start_time && <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 6 }}><Feather name='clock' size={14} color={C.gold}/><Text style={{ color: '#444', fontSize: 12, fontWeight: '700' }}>{b.start_time?.slice(0, 5)}</Text></View>}
      </View>

      {/* ── Location Row (In-Person) ── */}
      {(b.service_type || '').toLowerCase() === 'inperson' && (
        <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 10, marginBottom: 16, padding: 12, borderRadius: 12, backgroundColor: '#FDFBF7', borderWidth: 1, borderColor: '#F0EBE0' }}>
          <Feather name='map-pin' size={16} color={C.gold} />
          <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
            <Text style={{ color: '#1A1A1A', fontWeight: '700', fontSize: 12 }}>{b.lawyer_office || b.lawyer_city || (isRTL ? 'عنوان المكتب غير متوفر' : 'Office address not available')}</Text>
            {(b.lawyer_office || b.lawyer_city) && (
              <TouchableOpacity onPress={() => {
                const url = `https://maps.google.com/?q=${encodeURIComponent(b.lawyer_office || b.lawyer_city)}`;
                try { require('react-native').Linking.openURL(url); } catch(e){}
              }} style={{ marginTop: 4 }}>
                <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>🗺️ {isRTL ? 'فتح في الخرائط' : 'Open in Maps'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Action Buttons Container ── */}
      <View style={{ flexDirection: 'column' }}>
        
        {/* Primary Actions Row (Large Buttons) */}
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10 }}>
          {/* Primary Communication Button */}
          {(status === 'confirmed' || status === 'completed') && lawyerId && (
            <TouchableOpacity
              onPress={async () => {
                try {
                  let convId = b.conversation_id;
                  if (!convId) {
                    const res: any = await messagesAPI.createConversation(lawyerId);
                    convId = res?.conversation?.id || res?.id;
                  }
                  router.push(convId ? `/messages?convId=${convId}` : '/messages' as any);
                } catch { router.push('/messages' as any); }
              }}
              style={{ flex: 1, backgroundColor: C.gold, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: rowDir, gap: 8 }}
            >
              <View>
                <Feather name='message-circle' size={16} color='#fff' />
                {b.unreadCount > 0 && (
                  <View style={{ position: 'absolute', top: -8, right: isRTL ? undefined : -8, left: isRTL ? -8 : undefined, backgroundColor: '#EF4444', minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, elevation: 2 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{b.unreadCount > 99 ? '99+' : b.unreadCount}</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{isLawyer ? (isRTL ? 'تواصل مع العميل' : 'Contact Client') : (isRTL ? 'تواصل مع المحامي' : 'Contact Lawyer')}</Text>
            </TouchableOpacity>
          )}

          {/* Video Button */}
          {status === 'confirmed' && joinState === 'open' && isVideoSvc && (
            <TouchableOpacity
              onPress={async () => {
                const zoomLink = b.lawyer_zoom_link;
                if (!zoomLink || !zoomLink.trim()) {
                  if (isLawyer) {
                    Alert.alert(
                      isRTL ? 'تنبيه' : 'Alert',
                      isRTL
                        ? 'لم تقم بتعيين رابط زووم الخاص بك. يرجى الانتقال إلى إعدادات الملف الشخصي لتعيينه.'
                        : 'You have not set your Zoom meeting link. Please go to profile settings to set it.'
                    );
                  } else {
                    Alert.alert(
                      isRTL ? 'تنبيه' : 'Alert',
                      isRTL
                        ? 'لم يقم المحامي بإضافة رابط زووم بعد. يرجى التواصل معه عبر المحادثة.'
                        : 'The lawyer has not added their Zoom meeting link yet. Please contact them via chat.'
                    );
                  }
                } else {
                  try {
                    let cleanLink = zoomLink.trim();
                    if (!cleanLink.startsWith('http://') && !cleanLink.startsWith('https://')) {
                      cleanLink = 'https://' + cleanLink;
                    }
                    const supported = await Linking.canOpenURL(cleanLink);
                    if (supported) {
                      await Linking.openURL(cleanLink);
                    } else {
                      Alert.alert(
                        isRTL ? 'خطأ' : 'Error',
                        isRTL ? 'تعذر فتح الرابط.' : 'Unable to open link.'
                      );
                    }
                  } catch (e: any) {
                    Alert.alert(isRTL ? 'خطأ' : 'Error', e.message);
                  }
                }
              }}
              style={{ flex: 1, backgroundColor: '#DC2626', paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: rowDir, gap: 8 }}
            >
              <Feather name='video' size={16} color='#fff' />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{isRTL ? 'انضم للفيديو' : 'Join Video'}</Text>
            </TouchableOpacity>
          )}

          {/* Locked Countdown */}
          {status === 'confirmed' && joinState === 'locked' && (
            <View style={{ flex: 1, backgroundColor: '#F8F9FA', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#666', fontSize: 10, fontWeight: '700' }}>{isRTL ? 'تفتح الجلسة قريباً' : 'Opens soon'}</Text>
              {countdown ? <Text style={{ color: C.gold, fontSize: 12, fontWeight: '800', marginTop: 2 }}>{countdown}</Text> : null}
            </View>
          )}

          {/* Payment */}
          {!isLawyer && !isPaid && status !== 'cancelled' && status !== 'rejected' && (
            <TouchableOpacity onPress={() => router.push(`/book?lawyer=${lawyerId}` as any)} style={{ flex: 1, backgroundColor: '#D97706', paddingVertical: 12, borderRadius: 12, flexDirection: rowDir, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Feather name='credit-card' size={14} color='#fff' /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{isRTL ? 'إتمام الدفع' : 'Pay Now'}</Text>
            </TouchableOpacity>
          )}

          {/* Lawyer actions */}
          {isLawyer && status === 'pending' && (
            <>
              <TouchableOpacity disabled={isActioning} onPress={() => onChangeStatus(b.id, 'confirmed')} style={{ flex: 1, backgroundColor: '#16A34A', paddingVertical: 12, borderRadius: 12, opacity: isActioning ? 0.5 : 1, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{isActioning ? '⏳' : (isRTL ? '✅ قبول' : '✅ Accept')}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={isActioning} onPress={() => onChangeStatus(b.id, 'rejected')} style={{ flex: 1, backgroundColor: '#FEF2F2', paddingVertical: 12, borderRadius: 12, opacity: isActioning ? 0.5 : 1, alignItems: 'center' }}>
                <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 14 }}>{isActioning ? '⏳' : (isRTL ? '❌ رفض' : '❌ Decline')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Secondary Actions Row (Small Utility Buttons) */}
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
          {/* Secondary Actions (Receipt, Rate, Cancel) */}
          {!isLawyer && isPaid && (
            <TouchableOpacity onPress={() => onInvoice(b.id)} style={{ backgroundColor: '#F8F9FA', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, flexDirection: rowDir, alignItems: 'center', gap: 6 }}>
              <Feather name='file-text' size={14} color='#444' /><Text style={{ color: '#444', fontWeight: '700', fontSize: 13 }}>{isRTL ? 'إيصال' : 'Receipt'}</Text>
            </TouchableOpacity>
          )}

          {!isLawyer && (status === 'completed' || (status === 'confirmed' && !upcoming)) && lawyerId && (
            <TouchableOpacity onPress={() => onRateLawyer(lawyerId)} style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, flexDirection: rowDir, alignItems: 'center', gap: 6 }}>
              <Feather name='star' size={14} color='#D97706' /><Text style={{ color: '#D97706', fontWeight: '800', fontSize: 13 }}>{isRTL ? 'قيّم' : 'Rate'}</Text>
            </TouchableOpacity>
          )}

          {!isLawyer && (status === 'confirmed' || status === 'pending') && upcoming && (
            <TouchableOpacity
              disabled={isActioning}
              onPress={() => Alert.alert(isRTL ? 'تأكيد الإلغاء' : 'Cancel Booking', isRTL ? 'هل تريد إلغاء هذا الحجز؟' : 'Are you sure you want to cancel?', [
                { text: isRTL ? 'لا' : 'No', style: 'cancel' }, { text: isRTL ? 'نعم، إلغاء' : 'Yes, Cancel', style: 'destructive', onPress: () => onChangeStatus(b.id, 'cancelled') }
              ])}
              style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, flexDirection: rowDir, alignItems: 'center', gap: 6, opacity: isActioning ? 0.5 : 1 }}
            >
              <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>{isActioning ? '⏳' : (isRTL ? 'إلغاء' : 'Cancel')}</Text>
            </TouchableOpacity>
          )}

          {/* Book Again */}
          {!isLawyer && (['completed', 'cancelled', 'rejected'].includes(status) || (status === 'confirmed' && !upcoming)) && lawyerId && (
            <TouchableOpacity onPress={() => router.push(`/lawyer/${lawyerId}` as any)} style={{ backgroundColor: '#FDFBF7', borderWidth: 1, borderColor: '#D4C9B0', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, flexDirection: rowDir, alignItems: 'center', gap: 6 }}>
              <Feather name='refresh-cw' size={14} color='#8A7D60' /><Text style={{ color: '#444', fontWeight: '800', fontSize: 13 }}>{isRTL ? 'احجز مجدداً' : 'Book Again'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ C, isLawyer, isRTL }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 }}>
      <Feather name='calendar' size={48} color={C.muted} style={{marginBottom: 16}} />
      <Text style={{ color: C.text, fontWeight: '800', fontSize: 18, textAlign: 'center', marginBottom: 8 }}>
        {isLawyer ? (isRTL ? 'لا توجد جلسات بعد' : 'No sessions yet') : (isRTL ? 'لا توجد استشارات بعد' : 'No consultations yet')}
      </Text>
      <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
        {isLawyer
          ? (isRTL ? 'عند حجز عميل معك، ستظهر جلساتك هنا' : 'When a client books you, sessions will appear here')
          : (isRTL ? 'ابحث عن محامٍ مناسب واحجز استشارتك الأولى' : 'Find a lawyer and book your first consultation')}
      </Text>
      {!isLawyer && (
        <TouchableOpacity
          onPress={() => router.push('/lawyers' as any)}
          style={{
            backgroundColor: C.gold,
            paddingHorizontal: 24, paddingVertical: 12,
            borderRadius: 12, flexDirection: isRTL ? 'row' : 'row-reverse', alignItems: 'center', gap: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{isRTL ? 'ابحث عن محامٍ' : 'Find a Lawyer'}</Text>
          <Feather name='search' size={16} color='#fff' />
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
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});

  const { isRTL } = useI18n();
  const [reviewModal, setReviewModal] = useState({ visible: false, lawyerId: 0, rating: 5, comment: '' });
  const [reviewing, setReviewing] = useState(false);

  const submitReview = useCallback(async () => {
    if (!reviewModal.lawyerId) return;
    setReviewing(true);
    try {
      await lawyersAPI.review(reviewModal.lawyerId, { rating: reviewModal.rating, comment: reviewModal.comment });
      Alert.alert('✅', isRTL ? 'تم إضافة التقييم بنجاح!' : 'Review submitted successfully!');
      setReviewModal({ visible: false, lawyerId: 0, rating: 5, comment: '' });
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || (isRTL ? 'تعذر إضافة التقييم' : 'Failed to submit review'));
    } finally {
      setReviewing(false);
    }
  }, [reviewModal, isRTL]);

  const load = useCallback(() => {
    dispatch(fetchBookings({}))
      .unwrap()
      .catch((e: any) => setError(e?.message || 'تعذر تحميل الاستشارات'));
  }, [dispatch]);

  const loadUnreadCounts = useCallback(async () => {
    try {
      const res: any = await require('../../src/services/api').messagesAPI.getConversations();
      const cvs = res?.conversations || res || [];
      const uMap: Record<string, number> = {};
      cvs.forEach((c: any) => {
        if (c.id && c.unread_count > 0) {
          uMap[c.id] = parseInt(c.unread_count, 10);
        }
      });
      setUnreadMap(uMap);
    } catch (e) {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadUnreadCounts();
    }, [load, loadUnreadCounts])
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

  const onInvoice = useCallback((bookingId: string) => {
    router.push(`/receipt/${bookingId}` as any);
  }, []);

  const filtered = filter === 'all' ? bookings : bookings.filter((b: any) => b.status === filter);
  const now0 = new Date();
  const upcomingList = (filter === 'all' ? bookings : filtered).filter((b: any) => {
    if (['cancelled','rejected','completed'].includes(b.status)) return false;
    const t = parseBookingTime(b.booking_date, b.start_time);
    if (isNaN(t)) return true;
    return t > now0.getTime() - 5400000;
  }).sort((a: any, b: any) => {
    const ta = parseBookingTime(a.booking_date, a.start_time);
    const tb = parseBookingTime(b.booking_date, b.start_time);
    if (isNaN(ta) || isNaN(tb)) return 0;
    return ta - tb;
  });

  const pastList = (filter === 'all' ? bookings : filtered).filter((b: any) => {
    if (['cancelled','rejected','completed'].includes(b.status)) return true;
    const t = parseBookingTime(b.booking_date, b.start_time);
    if (isNaN(t)) return false;
    return t <= now0.getTime() - 5400000;
  }).sort((a: any, b: any) => {
    const ta = parseBookingTime(a.booking_date, a.start_time);
    const tb = parseBookingTime(b.booking_date, b.start_time);
    if (isNaN(ta) || isNaN(tb)) return 0;
    return tb - ta;
  });
  const showSections = filter === 'all';
  const listData: any[] = showSections
    ? [
        ...(upcomingList.length > 0 ? [{ _sectionHeader: 'القادمة', _id: '__upcoming__' }, ...upcomingList] : []),
        ...(pastList.length > 0    ? [{ _sectionHeader: 'السابقة', _id: '__past__' },    ...pastList    ] : []),
      ]
    : filtered;

  const total     = bookings.length;
  const confirmed = bookings.filter((b: any) => b.status === 'confirmed').length;
  const completed = bookings.filter((b: any) => b.status === 'completed').length;

  const rowDir = isRTL ? 'row' : 'row-reverse';

  return (
    <View style={{ flex: 1, backgroundColor: '#FDFBF7' }}>
      <View style={{
        backgroundColor: '#FFFFFF',
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0EBE0',
      }}>
        <Text style={{
          color: '#1A1A1A', fontWeight: '800', fontSize: 22,
          marginBottom: 8, textAlign: isRTL ? 'left' : 'right'
        }}>
          {isLawyer ? (isRTL ? 'جلساتي' : 'My Sessions') : (isRTL ? 'استشاراتي' : 'My Consults')}
        </Text>

        {total > 0 && (
          <View style={{ flexDirection: rowDir, gap: 12, marginBottom: 12 }}>
            <Text style={{ color: '#666', fontSize: 12, fontWeight: '600' }}>{isRTL ? 'الكل:' : 'All:'} <Text style={{ color: '#1A1A1A', fontWeight: '800' }}>{total}</Text></Text>
            {confirmed > 0 && <Text style={{ color: '#666', fontSize: 12, fontWeight: '600' }}>{isRTL ? 'مؤكد:' : 'Confirmed:'} <Text style={{ color: '#2563EB', fontWeight: '800' }}>{confirmed}</Text></Text>}
            {completed > 0 && <Text style={{ color: '#666', fontSize: 12, fontWeight: '600' }}>{isRTL ? 'مكتمل:' : 'Completed:'} <Text style={{ color: '#16A34A', fontWeight: '800' }}>{completed}</Text></Text>}
          </View>
        )}

        {(error || apiError) ? (
          <TouchableOpacity
            onPress={() => { setError(''); load(); }}
            style={{
              backgroundColor: '#DC262610', borderWidth: 1,
              borderColor: '#DC262630', borderRadius: 8,
              padding: 8, marginBottom: 8,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}
          >
            <Text style={{ color: '#DC2626', flex: 1, fontSize: 12 }}>⚠️ {error || apiError}</Text>
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 12 }}>🔄</Text>
          </TouchableOpacity>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: rowDir }}>
          {FILTERS(isRTL).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => setFilter(key)}
              style={{
                paddingHorizontal: 16, paddingVertical: 10,
                borderRadius: 20, borderWidth: 1,
                borderColor: filter === key ? C.gold : '#E8E1D5',
                backgroundColor: filter === key ? C.gold : '#FDFBF7',
                shadowColor: filter === key ? C.gold : 'transparent',
                shadowOpacity: filter === key ? 0.3 : 0, shadowRadius: 6, elevation: filter === key ? 3 : 0,
              }}
            >
              <Text style={{
                color: filter === key ? '#fff' : '#666',
                fontSize: 13, fontWeight: filter === key ? '800' : '600',
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
        <View style={{ flex: 1 }}>
          <FlashList
            data={listData}
            keyExtractor={item => (item as any)._id || String((item as any).id)}
            contentContainerStyle={{
              padding: 16,
              paddingBottom: insets.bottom + 100,
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={C.gold}
                colors={[C.gold]}
              />
            }
            ListEmptyComponent={<EmptyState C={C} isLawyer={isLawyer} isRTL={isRTL} />}
            renderItem={({ item: b }) => {
              if ((b as any)._sectionHeader) {
                return (
                  <View style={{ flexDirection: isRTL ? 'row' : 'row-reverse', alignItems: 'center', gap: 10, marginVertical: 14 }}>
                    <Text style={{ color: C.gold, fontWeight: '800', fontSize: 15 }}>{(b as any)._sectionHeader === 'القادمة' ? (isRTL ? 'القادمة' : 'Upcoming') : (isRTL ? 'السابقة' : 'Past')}</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#E8E1D5' }} />
                  </View>
                );
              }
              return (
                <ConsultCard
                  key={(b as any).id}
                  b={{...b, unreadCount: unreadMap[b.conversation_id] || 0}}
                  C={C}
                  isLawyer={isLawyer}
                  actioning={actioning}
                  onChangeStatus={onChangeStatus}
                  onInvoice={onInvoice}
                  onRateLawyer={(lawyerId: number) => setReviewModal({ visible: true, lawyerId, rating: 5, comment: '' })}
                  isRTL={isRTL}
                  t={t}
                />
              );
            }}
          />
        </View>
      )}

      {/* ── FAB: Book New ── */}
      {!isLawyer && (
        <TouchableOpacity
          onPress={() => router.push('/lawyers' as any)}
          style={{
            position: 'absolute',
            bottom: insets.bottom + 16,
            right: isRTL ? 16 : undefined,
            left: isRTL ? undefined : 16,
            backgroundColor: C.gold,
            borderRadius: 24,
            paddingHorizontal: 20,
            paddingVertical: 12,
            flexDirection: isRTL ? 'row' : 'row-reverse',
            alignItems: 'center',
            gap: 8,
            elevation: 8,
            shadowColor: '#9A6F2A',
            shadowOpacity: 0.4,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Feather name='plus' size={18} color='#fff' />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{isRTL ? 'استشارة جديدة' : 'New Consult'}</Text>
        </TouchableOpacity>
      )}
      {/* ── Review Modal ── */}
      <Modal visible={reviewModal.visible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', backgroundColor: C.surface, borderRadius: 16, padding: 24, elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 } }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 16 }}>
              {isRTL ? 'تقييم المحامي' : 'Rate Lawyer'}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setReviewModal(p => ({ ...p, rating: star }))}>
                  <Feather name="star" size={36} color={star <= reviewModal.rating ? C.gold : C.border} style={{ fill: star <= reviewModal.rating ? C.gold : 'transparent' }} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: C.muted, fontWeight: '700', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? 'إضافة تعليق (اختياري)' : 'Add a comment (optional)'}
            </Text>
            <TextInput
              value={reviewModal.comment}
              onChangeText={t => setReviewModal(p => ({ ...p, comment: t }))}
              placeholder={isRTL ? 'اكتب رأيك هنا...' : 'Write your review here...'}
              placeholderTextColor={C.muted}
              multiline
              style={{
                borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14,
                color: C.text, minHeight: 100, textAlignVertical: 'top', textAlign: isRTL ? 'right' : 'left',
                backgroundColor: C.bg, marginBottom: 24
              }}
            />

            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setReviewModal({ visible: false, lawyerId: 0, rating: 5, comment: '' })}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.border, alignItems: 'center' }}
              >
                <Text style={{ color: C.text, fontWeight: '700' }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitReview}
                disabled={reviewing}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', opacity: reviewing ? 0.7 : 1 }}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>
                  {reviewing ? (isRTL ? 'جاري الإرسال...' : 'Submitting...') : (isRTL ? 'إرسال التقييم' : 'Submit Review')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}
