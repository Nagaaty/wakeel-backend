// ─── Wakeel — Book Consultation (Chunk 2 — restructured flow) ────────────────
// New 3-step flow:
//   STEP 1 — Pick a date from the calendar
//   STEP 2 — Pick service type + time slot (filtered to what the lawyer
//            actually offers on that date, with the lawyer's actual prices)
//   STEP 3 — Confirm + payment
//
// Removed from previous version:
//   • "Urgency" tier (Urgent / This Week / Flexible) — was useless
//   • Hardcoded service multipliers (text=0.5×, video=1.5×, etc.) —
//     replaced with the lawyer's real per-type prices
//
// Accepts pre-filled params from lawyer profile: ?lawyer=…&preDate=…&preTime=…
// When pre-fills are present, jumps straight to step 2 or 3 as appropriate.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { useAuth } from '../src/hooks/useAuth';
import { useI18n } from '../src/i18n';
import { hapticLight, hapticMedium, hapticSuccess, hapticSelect, hapticError } from '../src/utils/haptics';
import * as DocumentPicker from 'expo-document-picker';
import { Btn, Spinner, ErrMsg } from '../src/components/ui';
import { lawyersAPI, bookingsAPI, paymentsAPI, promosAPI, uploadAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Service types ───────────────────────────────────────────────────────────
// Same IDs as service-pricing.tsx and the schedule matrix.
const SERVICE_TYPES = [
  { id: 'text',     icon: '💬', label: 'استشارة نصية',  labelEn: 'Text Consultation',  desc: 'رد كتابي خلال 4 ساعات', descEn: 'Written reply within 4 hrs' },
  { id: 'video',    icon: '📹', label: 'استشارة فيديو', labelEn: 'Video Consultation',  desc: 'مكالمة فيديو 45 دقيقة',  descEn: '45-minute video call' },
  { id: 'inperson', icon: '🏛️', label: 'لقاء شخصي',     labelEn: 'In-Person Meeting',   desc: 'في مكتب المحامي',         descEn: "At lawyer's office" },
  { id: 'document', icon: '📄', label: 'مراجعة وثيقة',  labelEn: 'Document Review',     desc: 'مراجعة عقد أو وثيقة',     descEn: 'Contract / doc review' },
];

const PROMO_CODES: Record<string, number> = { WELCOME20: 0.20, LEGAL10: 0.10, FIRST50: 50, VIP30: 0.30, LC2025: 0.15 };

const PAYMENT_METHODS = [
  { id: 'card',        icon: '💳', label: 'بطاقة ائتمان / خصم',     labelEn: 'Credit / Debit Card' },
  { id: 'vodafone',    icon: '📱', label: 'فودافون كاش',             labelEn: 'Vodafone Cash' },
  { id: 'fawry',       icon: '🏪', label: 'فوري',                    labelEn: 'Fawry' },
  { id: 'instapay',    icon: '⚡', label: 'InstaPay',                 labelEn: 'InstaPay' },
  { id: 'installment', icon: '📆', label: 'الدفع على 3 أقساط',       labelEn: 'Pay in 3 Installments' },
];

// ─── Calendar helpers ────────────────────────────────────────────────────────
function getDatesForMonth(year: number, month: number) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const days: Array<{ date: Date; disabled: boolean }> = [];
  for (let i = 0; i < first.getDay(); i++) days.push({ date: new Date(0), disabled: true });
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({ date, disabled: date < today });
  }
  return days;
}

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const AR_DAYS   = ['أح','إث','ث','أر','خ','ج','س'];
const EN_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function CalendarPicker({ C, selectedDate, onSelect, isRTL, isWorkingDay }: any) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const days = getDatesForMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const canGoPrev = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());
  const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayISO = toISO(new Date());

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <TouchableOpacity onPress={prevMonth} disabled={!canGoPrev} style={{ padding: 8, opacity: canGoPrev ? 1 : 0.3 }}>
          <Text style={{ color: C.gold, fontSize: 20, fontWeight: '700' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, fontFamily: 'Cairo-Bold' }}>
          {(isRTL ? AR_MONTHS : EN_MONTHS)[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
          <Text style={{ color: C.gold, fontSize: 20, fontWeight: '700' }}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {(isRTL ? AR_DAYS : EN_DAYS).map(d => (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '600' }}>{d}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((item, i) => {
          if (item.disabled && item.date.getTime() === 0) {
            return <View key={`empty-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />;
          }
          const iso = toISO(item.date);
          const isSel = iso === selectedDate;
          const isToday = iso === todayISO;
          // ── NEW: gate non-working days ─────────────────────────────────
          // If a predicate is passed and returns false for this date, the
          // day is unselectable AND visually greyed out. Past dates are
          // already handled by item.disabled.
          const lawyerOff = typeof isWorkingDay === 'function' && !item.disabled
            ? !isWorkingDay(item.date)
            : false;
          const fullyDisabled = item.disabled || lawyerOff;
          return (
            <TouchableOpacity
              key={iso}
              disabled={fullyDisabled}
              onPress={() => onSelect(iso)}
              style={{ width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{
                width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSel ? C.gold : isToday && !fullyDisabled ? C.gold + '20' : 'transparent',
                borderWidth: isToday && !isSel && !fullyDisabled ? 1 : 0, borderColor: C.gold,
              }}>
                <Text style={{
                  fontSize: 13, fontWeight: isSel || isToday ? '700' : '400',
                  color: isSel ? '#fff' : fullyDisabled ? C.dim : C.text,
                  textDecorationLine: lawyerOff ? 'line-through' : 'none',
                }}>{item.date.getDate()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function BookScreen() {
  const C = useTheme();
  const { t, isRTL } = useI18n();
  const { isLoggedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const serif = { fontFamily: 'Cairo-Bold' };

  // Pre-filled params from lawyer profile
  const params = useLocalSearchParams<{ lawyer?: string; preDate?: string; preTime?: string }>();
  const lawyerId = params.lawyer;

  // State
  const [step,       setStep]       = useState(1);
  const [lawyer,     setLawyer]     = useState<any>(null);
  const [slots,      setSlots]      = useState<Array<{ time: string; available: boolean }>>([]);
  const [enabledServices, setEnabledServices] = useState<string[]>(['video','text','inperson','document']);
  const [datePrices,      setDatePrices]      = useState<Record<string, number>>({});
  const [loading,    setLoading]    = useState(true);
  const [slotsLoad,  setSlotsLoad]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const [promo,        setPromo]        = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoMsg,     setPromoMsg]     = useState('');
  const [discount,     setDiscount]     = useState(0);

  const [form, setForm] = useState({
    serviceType:   '',          // Empty until user picks one in step 2
    date:          (params.preDate as string) || '',
    time:          (params.preTime as string) || '',
    notes:         '',
    documents:     [] as string[],
    paymentMethod: 'card',
  });

  const STEPS = [
    isRTL ? 'اختر التاريخ' : 'Pick a date',
    isRTL ? 'اختر النوع والوقت' : 'Pick type & time',
    isRTL ? 'التأكيد والدفع' : 'Confirm & pay',
  ];

  // ── Load lawyer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) { router.replace('/(auth)/login' as any); return; }
    if (!lawyerId)   { router.replace('/(tabs)/lawyers' as any); return; }
    lawyersAPI.get(lawyerId)
      .then(setLawyer)
      .catch(() => router.replace('/(tabs)/lawyers' as any))
      .finally(() => setLoading(false));
  }, [lawyerId]);

  // ── Pre-fill smart-jump: if user came in with preDate, skip to step 2 ────
  useEffect(() => {
    if (!loading && params.preDate && step === 1) {
      setStep(2);
    }
  }, [loading]);

  // ── Load slots + enabled services + prices when date changes ────────────
  useEffect(() => {
    if (!form.date || !lawyerId) return;
    setSlotsLoad(true);
    lawyersAPI.getAvailability(lawyerId as string, form.date)
      .then((d: any) => {
        setSlots(d.slots || []);
        if (Array.isArray(d.enabled_services)) {
          setEnabledServices(d.enabled_services);
        } else {
          setEnabledServices(['video','text','inperson','document']);
        }
        if (d.service_prices && typeof d.service_prices === 'object') {
          setDatePrices(d.service_prices);
        }
      })
      .catch(() => {
        setSlots([]);
        setEnabledServices(['video','text','inperson','document']);
      })
      .finally(() => setSlotsLoad(false));
  }, [form.date, lawyerId]);

  // ── Auto-select first enabled service if current one isn't allowed ──────
  useEffect(() => {
    if (!form.date) return;
    if (form.serviceType && !enabledServices.includes(form.serviceType)) {
      setForm(f => ({ ...f, serviceType: enabledServices[0] || '' }));
    }
  }, [enabledServices]);

  // ── Pricing — pulls from datePrices (lawyer's actual prices) ────────────
  // Falls back to lawyer.service_prices, then to consultation_fee multipliers
  // for safety. Never multiplies blindly anymore.
  const FALLBACK_MUL: Record<string, number> = { text: 0.5, video: 1.5, inperson: 2, document: 0.8 };
  const effectivePrices = useMemo(() => {
    const profilePrices = (lawyer?.service_prices && typeof lawyer.service_prices === 'object')
      ? lawyer.service_prices : {};
    const base = Number(lawyer?.consultation_fee) || 400;
    const merged: Record<string, number> = {};
    for (const t of ['text','video','inperson','document']) {
      merged[t] =
        Number(datePrices[t]) ||
        Number(profilePrices[t]) ||
        Math.round(base * (FALLBACK_MUL[t] || 1));
    }
    return merged;
  }, [datePrices, lawyer]);

  // ── Working-day predicate ────────────────────────────────────────────────
  // Used by the step-1 calendar to grey out days the lawyer doesn't work.
  // Logic mirrors what the backend /availability endpoint will eventually
  // return for that date — but computed locally so the calendar can render
  // 30+ dates without hitting the API once per day.
  //
  // Priority:
  //   1. If a date override exists with is_off=true → not workable
  //   2. If a date override exists with is_off=false → workable
  //      (lawyer made an explicit exception)
  //   3. Otherwise: workable iff the weekly schedule covers that weekday
  //   4. If lawyer has no schedule data at all (new lawyer) → assume Sun-Thu
  //      (matches the backend's "default fallback" behavior for new lawyers)
  const workingWeekdays = useMemo(() => {
    const set = new Set<number>();
    if (Array.isArray(lawyer?.availability_map)) {
      for (const row of lawyer.availability_map) {
        if (row?.day_of_week !== undefined) set.add(Number(row.day_of_week));
      }
    }
    return set;
  }, [lawyer]);

  const overrideMap = useMemo(() => {
    const m = new Map<string, { is_off: boolean; slots: any[] }>();
    if (Array.isArray(lawyer?.schedule_overrides)) {
      for (const o of lawyer.schedule_overrides) {
        const key = (o?.override_date || '').toString().split('T')[0];
        if (key) m.set(key, { is_off: !!o.is_off, slots: o.slots || [] });
      }
    }
    return m;
  }, [lawyer]);

  const isWorkingDay = (d: Date) => {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const ov = overrideMap.get(iso);
    if (ov) {
      if (ov.is_off) return false;
      // Override marks day as workable (custom slots)
      return Array.isArray(ov.slots) && ov.slots.length > 0;
    }
    if (workingWeekdays.size > 0) {
      return workingWeekdays.has(d.getDay());
    }
    // No data at all — backend's default fallback is Sun-Thu (0..4)
    if (lawyer?.has_set_schedule === false || lawyer?.has_set_schedule === undefined) {
      const dow = d.getDay();
      return dow >= 0 && dow <= 4;
    }
    return false;
  };

  const svcPrice    = form.serviceType ? (effectivePrices[form.serviceType] || 0) : 0;
  const platformFee = 50;
  const subtotal    = svcPrice + platformFee;
  const finalPrice  = Math.max(0, subtotal - discount);
  const installAmt  = Math.round(finalPrice / 3);

  // ── Promo ────────────────────────────────────────────────────────────────
  const applyPromo = async () => {
    const code = promo.trim().toUpperCase();
    if (!code) return;
    setPromoMsg(''); setPromoApplied(false); setDiscount(0);
    try {
      const d: any = await promosAPI.validate(code);
      const disc = d.discount_type === 'percent'
        ? Math.round(subtotal * d.discount_value / 100)
        : d.discount_value;
      setDiscount(disc); setPromoApplied(true);
      setPromoMsg(`🎉 ${d.message || `-${disc} EGP`}`);
    } catch {
      const p = PROMO_CODES[code];
      if (p !== undefined) {
        const disc = p < 1 ? Math.round(subtotal * p) : p;
        setDiscount(disc); setPromoApplied(true);
        setPromoMsg(`🎉 ${p < 1 ? `${p * 100}%` : `${p} EGP`} off!`);
      } else {
        setPromoMsg(isRTL ? '⚠️ كود غير صحيح. جرب WELCOME20' : '⚠️ Invalid code. Try WELCOME20');
      }
    }
  };

  // ── Confirm ──────────────────────────────────────────────────────────────
  const confirm = async () => {
    hapticMedium();
    setSubmitting(true); setError('');
    const finalLawyerId = lawyer?.id || lawyerId;
    if (!finalLawyerId || !form.date || !form.time || !form.serviceType) {
      setError(isRTL ? 'بيانات الحجز غير مكتملة، يرجى المحاولة مرة أخرى.' : 'Incomplete booking data, please try again.');
      setSubmitting(false);
      return;
    }
    try {
      const booking: any = await bookingsAPI.create({
        lawyerId: finalLawyerId,
        bookingDate: form.date,
        startTime: form.time,
        serviceType: form.serviceType,
        notes: form.notes,
        documents: form.documents,
        fee: finalPrice,
        promoCode: promoApplied ? promo.trim() : undefined,
      });
      const bookingId = booking?.booking?.id || booking?.id;
      if (bookingId) {
        const payment: any = await paymentsAPI.initiate({ bookingId, method: form.paymentMethod });
        if (payment?.checkoutUrl) {
          router.push({
            pathname: '/payment-webview',
            params: { url: payment.checkoutUrl, bookingId: String(bookingId), amount: String(finalPrice), method: form.paymentMethod },
          } as any);
          return;
        }
      }
      router.replace({ pathname: '/payment-result', params: { success: 'true', booking_id: String(bookingId || '') } } as any);
    } catch (e: any) {
      hapticError();
      const msg = e?.message || (isRTL ? 'حدث خطأ. تحقق من اتصالك وحاول مجدداً.' : 'Something went wrong.');
      setError(msg);
      Alert.alert(isRTL ? 'خطأ' : 'Error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
      <Spinner C={C} size="large" />
    </View>
  );

  const availableSlots = slots.filter(s => s.available);
  const selectedSvc = SERVICE_TYPES.find(s => s.id === form.serviceType);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: C.surface,
        paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(s => s - 1) : router.back()}>
            <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ ...serif, color: C.text, fontWeight: '700', fontSize: 18 }}>
              {isRTL ? `حجز مع ${lawyer?.name}` : `Book with ${lawyer?.name}`}
            </Text>
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
              {isRTL ? `الخطوة ${step} من 3 — ` : `Step ${step} of 3 — `}{STEPS[step - 1]}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3].map(s => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: step >= s ? C.gold : C.border }} />
          ))}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {error ? <ErrMsg C={C} msg={error} /> : null}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 1 — Pick a date
            ══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>
              {isRTL ? 'متى تريد الاستشارة؟' : 'When would you like the consultation?'}
            </Text>
            <CalendarPicker
              C={C}
              selectedDate={form.date}
              onSelect={(iso: string) => {
                hapticSelect();
                setForm(f => ({ ...f, date: iso, time: '', serviceType: '' }));
              }}
              isRTL={isRTL}
              isWorkingDay={isWorkingDay}
            />
            {/* Hint to user */}
            <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', marginTop: -8, marginBottom: 8 }}>
              {isRTL
                ? '— الأيام الباهتة غير متاحة لدى المحامي —'
                : '— Greyed days are not available with this lawyer —'}
            </Text>
            <Btn
              C={C} full size="lg"
              disabled={!form.date}
              onPress={() => { hapticLight(); setStep(2); }}
              style={{ marginTop: 8 }}
            >
              {form.date
                ? `${t('app.continue')} →`
                : (isRTL ? 'اختر تاريخاً للمتابعة' : 'Pick a date to continue')}
            </Btn>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 2 — Pick service type + time slot
            ══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <>
            {/* Selected date pill */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: C.gold + '15',
              borderWidth: 1, borderColor: C.gold + '40',
              borderRadius: 10, padding: 10, marginBottom: 14,
            }}>
              <Text style={{ fontSize: 14 }}>📅</Text>
              <Text style={{ color: C.text, fontSize: 13, flex: 1, fontWeight: '600' }}>
                {form.date}
              </Text>
              <TouchableOpacity onPress={() => { setStep(1); }}>
                <Text style={{ color: C.gold, fontSize: 12, fontWeight: '700' }}>
                  {isRTL ? 'تغيير' : 'Change'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Service type — only types lawyer enabled for this date */}
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>
              {isRTL ? 'نوع الاستشارة' : 'Consultation type'}
            </Text>

            {SERVICE_TYPES.filter(s => enabledServices.includes(s.id)).map(svcOpt => {
              const sel = form.serviceType === svcOpt.id;
              const price = effectivePrices[svcOpt.id] || 0;
              return (
                <TouchableOpacity
                  key={svcOpt.id}
                  onPress={() => { hapticSelect(); setForm(f => ({ ...f, serviceType: svcOpt.id })); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    backgroundColor: sel ? `${C.gold}18` : C.card,
                    borderWidth: 2, borderColor: sel ? C.gold : C.border,
                    borderRadius: 14, padding: 14, marginBottom: 10,
                  }}>
                  <Text style={{ fontSize: 26 }}>{svcOpt.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: sel ? C.gold : C.text, fontWeight: '700', fontSize: 14 }}>
                      {isRTL ? svcOpt.label : svcOpt.labelEn}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                      {isRTL ? svcOpt.desc : svcOpt.descEn}
                    </Text>
                  </View>
                  <Text style={{ color: C.gold, fontWeight: '800', fontSize: 15 }}>
                    {price} {t('app.egp')}
                  </Text>
                  {sel && (
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {SERVICE_TYPES.filter(s => enabledServices.includes(s.id)).length === 0 && (
              <View style={{ backgroundColor: C.card, borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 14 }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>🚫</Text>
                <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center' }}>
                  {isRTL
                    ? 'المحامي لا يقبل استشارات في هذا اليوم'
                    : 'The lawyer does not accept consultations on this day'}
                </Text>
              </View>
            )}

            {form.serviceType === 'inperson' && lawyer?.office && (
              <View style={{
                backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                borderRadius: 12, padding: 14, marginBottom: 16,
                flexDirection: 'row', gap: 12, alignItems: 'center'
              }}>
                <Text style={{ fontSize: 24 }}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 2 }}>
                    {isRTL ? 'سيتم اللقاء في هذا العنوان:' : 'Meeting will take place at:'}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'left' }}>
                    {lawyer.office}
                  </Text>
                </View>
              </View>
            )}

            {/* Time slots */}
            {form.serviceType && (
              <>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10, marginTop: 8 }}>
                  {isRTL ? `الأوقات المتاحة` : `Available times`}
                </Text>
                {slotsLoad ? (
                  <View style={{ alignItems: 'center', padding: 20 }}><Spinner C={C} /></View>
                ) : availableSlots.length === 0 ? (
                  <View style={{ backgroundColor: C.card, borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 14 }}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>📅</Text>
                    <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center' }}>
                      {isRTL ? 'لا توجد مواعيد متاحة في هذا اليوم' : 'No available slots on this day'}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                      {isRTL ? 'جرب يوماً آخر' : 'Try another date'}
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {slots.map(s => (
                      <TouchableOpacity
                        key={s.time}
                        disabled={!s.available}
                        onPress={() => { hapticSelect(); setForm(f => ({ ...f, time: s.time })); }}
                        style={{
                          paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12,
                          borderWidth: form.time === s.time ? 2 : 1,
                          borderColor: form.time === s.time ? C.gold : s.available ? C.border : C.dim,
                          backgroundColor: form.time === s.time ? `${C.gold}18` : s.available ? 'transparent' : C.card,
                          opacity: s.available ? 1 : 0.4,
                          minWidth: 80, alignItems: 'center',
                        }}>
                        <Text style={{
                          color: form.time === s.time ? C.gold : s.available ? C.text : C.muted,
                          fontSize: 13,
                          fontWeight: form.time === s.time ? '700' : '400',
                        }}>{s.time}</Text>
                        {!s.available && (
                          <Text style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>
                            {isRTL ? 'محجوز' : 'Booked'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Notes + documents — only after type+time chosen */}
            {form.serviceType && form.time && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                  📝 {t('booking.notes')}
                </Text>
                <TextInput
                  value={form.notes}
                  onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                  placeholder={isRTL ? 'اشرح قضيتك باختصار...' : 'Briefly describe your case...'}
                  placeholderTextColor={C.muted} multiline numberOfLines={3}
                  style={{
                    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                    borderRadius: 10, padding: 12, color: C.text, fontSize: 14,
                    textAlignVertical: 'top', minHeight: 70,
                    textAlign: isRTL ? 'right' : 'left', marginBottom: 12,
                  }} />

                <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
                  📎 {isRTL ? 'المستندات المرفقة (اختياري)' : 'Attached Documents (Optional)'}
                </Text>
                {form.documents.map((doc, i) => (
                  <View key={i} style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                    borderRadius: 8, padding: 10, marginBottom: 8,
                  }}>
                    <Text style={{ color: C.text, fontSize: 12, flex: 1 }} numberOfLines={1}>
                      {doc.split('/').pop()}
                    </Text>
                    <TouchableOpacity onPress={() => setForm(f => ({ ...f, documents: f.documents.filter((_, idx) => idx !== i) }))}>
                      <Text style={{ color: C.red, fontWeight: '700', fontSize: 16, marginLeft: 10 }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
                      if (!res.canceled && res.assets && res.assets[0]) {
                        setSubmitting(true);
                        const formData = new FormData();
                        const file = res.assets[0];
                        formData.append('file', { uri: file.uri, name: file.name || 'document', type: file.mimeType || 'application/octet-stream' } as any);
                        formData.append('folder', 'booking_docs');
                        const uploadRes: any = await uploadAPI.upload(formData);
                        if (uploadRes?.url) {
                          setForm(f => ({ ...f, documents: [...f.documents, uploadRes.url] }));
                        }
                      }
                    } catch (e: any) {
                      Alert.alert(isRTL ? 'خطأ في الرفع' : 'Upload error', e.message);
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    padding: 12, borderRadius: 10,
                    borderWidth: 1, borderColor: C.gold, borderStyle: 'dashed',
                    backgroundColor: C.gold + '10',
                  }}
                >
                  <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>
                    {isRTL ? '+ أضف مستند أو صورة' : '+ Add Document/Photo'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Btn
              C={C} full size="lg"
              disabled={!form.serviceType || !form.time || submitting}
              onPress={() => { hapticLight(); setStep(3); }}
            >
              {submitting ? '⏳...' : `${t('app.continue')} →`}
            </Btn>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            STEP 3 — Confirm + Pay
            ══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <>
            {/* Booking summary */}
            <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 14 }}>
              <Text style={{ ...serif, color: C.text, fontWeight: '700', fontSize: 17, marginBottom: 14 }}>
                {isRTL ? '📋 ملخص الحجز' : '📋 Booking Summary'}
              </Text>
              {[
                { icon: '👤', label: isRTL ? 'المحامي' : 'Lawyer',  val: lawyer?.name },
                { icon: '🔧', label: isRTL ? 'نوع الخدمة' : 'Service', val: isRTL ? selectedSvc?.label : selectedSvc?.labelEn },
                { icon: '📅', label: isRTL ? 'التاريخ' : 'Date',     val: form.date },
                { icon: '⏰', label: isRTL ? 'الوقت' : 'Time',       val: form.time },
              ].map(row => (
                <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{row.icon} {row.label}</Text>
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{row.val}</Text>
                </View>
              ))}
            </View>

            {/* Promo code */}
            <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 14 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 9 }}>
                🎟️ {t('payment.promoCode')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={promo}
                  onChangeText={v => { setPromo(v); setPromoApplied(false); setPromoMsg(''); setDiscount(0); }}
                  placeholder="WELCOME20" placeholderTextColor={C.muted}
                  autoCapitalize="characters" editable={!promoApplied}
                  style={{ flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: promoApplied ? C.green : C.border, borderRadius: 10, padding: 10, color: C.text, fontSize: 13 }} />
                <Btn C={C} size="sm" onPress={applyPromo} disabled={promoApplied || !promo.trim()} variant={promoApplied ? 'success' : 'ghost'}>
                  {promoApplied ? '✓' : t('payment.applyPromo')}
                </Btn>
              </View>
              {promoMsg ? <Text style={{ color: promoApplied ? C.green : C.red, fontSize: 12, marginTop: 6 }}>{promoMsg}</Text> : null}
            </View>

            {/* Price breakdown */}
            <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 14 }}>
              {[
                { label: isRTL ? 'السعر الأساسي' : t('payment.basePrice'), val: svcPrice, color: C.text },
                { label: isRTL ? 'رسوم المنصة' : t('payment.platformFee'), val: platformFee, color: C.muted },
                discount > 0 ? { label: `🎉 ${isRTL ? 'خصم' : t('payment.discount')}`, val: -discount, color: C.green } : null,
              ].filter(Boolean).map((row: any, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{row.label}</Text>
                  <Text style={{ color: row.color, fontWeight: '600', fontSize: 13 }}>
                    {row.val > 0 ? `+${row.val}` : row.val} {t('app.egp')}
                  </Text>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>{t('payment.total')}</Text>
                <Text style={{ ...serif, color: C.gold, fontWeight: '900', fontSize: 24 }}>
                  {finalPrice} {t('app.egp')}
                </Text>
              </View>
              {form.paymentMethod === 'installment' && (
                <View style={{ backgroundColor: `${C.accent}10`, borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: `${C.accent}25` }}>
                  <Text style={{ color: C.accent, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                    3 × {installAmt} {t('app.egp')} / {t('install.perMonth')}
                  </Text>
                </View>
              )}
            </View>

            {/* Payment method */}
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>
              {t('payment.method')}
            </Text>
            {PAYMENT_METHODS.map(m => {
              const sel = form.paymentMethod === m.id;
              return (
                <TouchableOpacity key={m.id} onPress={() => setForm(f => ({ ...f, paymentMethod: m.id }))}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    backgroundColor: sel ? `${C.gold}12` : C.card,
                    borderWidth: 2, borderColor: sel ? C.gold : C.border,
                    borderRadius: 13, padding: 13, marginBottom: 8,
                  }}>
                  <Text style={{ fontSize: 22 }}>{m.icon}</Text>
                  <Text style={{ flex: 1, color: sel ? C.gold : C.text, fontWeight: sel ? '700' : '400', fontSize: 14 }}>
                    {isRTL ? m.label : m.labelEn}
                  </Text>
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: sel ? C.gold : C.border, backgroundColor: sel ? C.gold : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {sel && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <Text style={{ color: C.muted, fontSize: 11 }}>🔒 {t('payment.securePayment')}</Text>
            </View>

            <Btn C={C} full size="lg" disabled={submitting} onPress={confirm} style={{ marginBottom: 8 }}>
              {submitting
                ? (isRTL ? 'جاري المعالجة...' : t('app.loading'))
                : `${t('payment.payNow')} — ${finalPrice} ${t('app.egp')}`}
            </Btn>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
