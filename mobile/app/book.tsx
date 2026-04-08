// ─── Wakeel — Book Consultation — Sprint 2: Real Calendar Slot Picker ─────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, TextInput, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { useAuth } from '../src/hooks/useAuth';
import { useI18n } from '../src/i18n';
import { hapticLight, hapticMedium, hapticSuccess, hapticSelect, hapticError } from '../src/utils/haptics';
import { Btn, Spinner, ErrMsg, Avatar } from '../src/components/ui';
import { lawyersAPI, bookingsAPI, paymentsAPI, promosAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ── Service types ─────────────────────────────────────────────────────────────
const SERVICE_TYPES = [
  { id:'text',     label:'استشارة نصية',  labelEn:'Text Consultation',  icon:'💬', desc:'رد كتابي خلال 4 ساعات',   descEn:'Written reply within 4 hrs', mul:0.5  },
  { id:'voice',    label:'مكالمة صوتية',  labelEn:'Voice Call',         icon:'📞', desc:'مكالمة مباشرة 30 دقيقة',   descEn:'30-minute live call',         mul:1    },
  { id:'video',    label:'استشارة فيديو', labelEn:'Video Consultation', icon:'📹', desc:'مكالمة فيديو 45 دقيقة',    descEn:'45-minute video call',        mul:1.5  },
  { id:'inperson', label:'لقاء شخصي',     labelEn:'In-Person Meeting',  icon:'🏛️', desc:'في مكتب المحامي',           descEn:"At lawyer's office",          mul:2    },
  { id:'document', label:'مراجعة وثيقة',  labelEn:'Document Review',    icon:'📄', desc:'مراجعة عقد أو وثيقة',       descEn:'Contract / doc review',       mul:1.5  },
];

const URGENCY_OPTS = [
  { id:'urgent',   label:'🔴 عاجل - الآن',    labelEn:'🔴 Urgent — ASAP',    extra:50  },
  { id:'normal',   label:'🟡 هذا الأسبوع',    labelEn:'🟡 This Week',         extra:0   },
  { id:'flexible', label:'🟢 مرن',             labelEn:'🟢 Flexible',          extra:-25 },
];

const PROMO_CODES: Record<string, number> = { WELCOME20:0.20, LEGAL10:0.10, FIRST50:50, VIP30:0.30, LC2025:0.15 };

const PAYMENT_METHODS = [
  { id:'card',        icon:'💳', label:'بطاقة ائتمان / خصم',     labelEn:'Credit / Debit Card'   },
  { id:'vodafone',    icon:'📱', label:'فودافون كاش',             labelEn:'Vodafone Cash'          },
  { id:'fawry',       icon:'🏪', label:'فوري',                    labelEn:'Fawry'                  },
  { id:'instapay',    icon:'⚡', label:'InstaPay',                 labelEn:'InstaPay'               },
  { id:'installment', icon:'📆', label:'الدفع على 3 أقساط',       labelEn:'Pay in 3 Installments'  },
];

// ── Calendar helpers ──────────────────────────────────────────────────────────
function getDatesForMonth(year: number, month: number) {
  const today = new Date(); today.setHours(0,0,0,0);
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const days: Array<{ date: Date; disabled: boolean }> = [];
  // Leading empty slots
  for (let i = 0; i < first.getDay(); i++) days.push({ date: new Date(0), disabled: true });
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({ date, disabled: date < today });
  }
  return days;
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const AR_DAYS   = ['أح','إث','ث','أر','خ','ج','س'];
const EN_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── Calendar Component ────────────────────────────────────────────────────────
function CalendarPicker({ C, selectedDate, onSelect, isRTL }: any) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const days = getDatesForMonth(viewYear, viewMonth);
  const selISO = selectedDate;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const canGoPrev = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 }}>
      {/* Month nav */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <TouchableOpacity onPress={prevMonth} disabled={!canGoPrev}
          style={{ padding: 8, opacity: canGoPrev ? 1 : 0.3 }}>
          <Text style={{ color: C.gold, fontSize: 20, fontWeight: '700' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, fontFamily: 'CormorantGaramond-Bold' }}>
          {isRTL ? AR_MONTHS[viewMonth] : EN_MONTHS[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
          <Text style={{ color: C.gold, fontSize: 20, fontWeight: '700' }}>›</Text>
        </TouchableOpacity>
      </View>
      {/* Day headers */}
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {(isRTL ? AR_DAYS : EN_DAYS).map(d => (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '600' }}>{d}</Text>
          </View>
        ))}
      </View>
      {/* Day grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((item, i) => {
          if (item.disabled && item.date.getTime() === 0) {
            return <View key={`empty-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />;
          }
          const iso = toISO(item.date);
          const isSel = iso === selISO;
          const isToday = iso === toISO(new Date());
          return (
            <TouchableOpacity key={iso} disabled={item.disabled}
              onPress={() => onSelect(iso)}
              style={{ width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{
                width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSel ? C.gold : isToday ? C.gold + '20' : 'transparent',
                borderWidth: isToday && !isSel ? 1 : 0, borderColor: C.gold,
              }}>
                <Text style={{
                  fontSize: 13, fontWeight: isSel || isToday ? '700' : '400',
                  color: isSel ? '#fff' : item.disabled ? C.dim : C.text,
                }}>{item.date.getDate()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function BookScreen() {
  const C = useTheme();
  const { t, isRTL } = useI18n();
  const { isLoggedIn } = useAuth();
  const { lawyer: lawyerId } = useLocalSearchParams<{ lawyer?: string }>();
  const insets = useSafeAreaInsets();
  const serif = { fontFamily: 'CormorantGaramond-Bold' };

  const [step,       setStep]       = useState(1);
  const [lawyer,     setLawyer]     = useState<any>(null);
  const [slots,      setSlots]      = useState<Array<{ time: string; available: boolean }>>([]);
  const [loading,    setLoading]    = useState(true);
  const [slotsLoad,  setSlotsLoad]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const [promo,        setPromo]        = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoMsg,     setPromoMsg]     = useState('');
  const [discount,     setDiscount]     = useState(0);

  const [form, setForm] = useState({
    serviceType:   'voice',
    date:          '',
    time:          '',
    urgency:       'normal',
    notes:         '',
    paymentMethod: 'card',
  });

  const STEPS = [
    isRTL ? 'نوع الخدمة' : t('booking.step1'),
    isRTL ? 'التاريخ والوقت' : t('booking.step2'),
    isRTL ? 'التأكيد والدفع' : t('booking.step3'),
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

  // ── Load slots when date changes ─────────────────────────────────────────
  useEffect(() => {
    if (!form.date || !lawyerId) return;
    setSlotsLoad(true);
    lawyersAPI.getAvailability(Number(lawyerId), form.date)
      .then((d: any) => setSlots(d.slots || []))
      .catch(() => setSlots([
        { time:'09:00', available:true }, { time:'09:30', available:false },
        { time:'10:00', available:true }, { time:'10:30', available:true  },
        { time:'11:00', available:true }, { time:'11:30', available:false },
        { time:'14:00', available:true }, { time:'14:30', available:true  },
        { time:'15:00', available:true }, { time:'15:30', available:false },
        { time:'16:00', available:true }, { time:'16:30', available:true  },
      ]))
      .finally(() => setSlotsLoad(false));
  }, [form.date, lawyerId]);

  // ── Price calc ───────────────────────────────────────────────────────────
  const svc          = SERVICE_TYPES.find(s => s.id === form.serviceType)!;
  const urgencyExtra = URGENCY_OPTS.find(u => u.id === form.urgency)?.extra || 0;
  const basePrice    = parseFloat(lawyer?.consultation_fee || '500');
  const svcPrice     = Math.round(basePrice * (svc?.mul || 1));
  const platformFee  = 50;
  const subtotal     = svcPrice + platformFee + urgencyExtra;
  const finalPrice   = Math.max(0, subtotal - discount);
  const installAmt   = Math.round(finalPrice / 3);

  // ── Promo ────────────────────────────────────────────────────────────────
  const applyPromo = async () => {
    const code = promo.trim().toUpperCase();
    if (!code) return;
    setPromoMsg(''); setPromoApplied(false); setDiscount(0);
    try {
      const d: any = await promosAPI.validate(code);
      const disc = d.discount_type === 'percent' ? Math.round(subtotal * d.discount_value / 100) : d.discount_value;
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
  const confirm = async () => { hapticMedium();
    setSubmitting(true); setError('');
    
    // Safety fallback for Expo Router sometimes dropping useLocalSearchParams
    const finalLawyerId = Number(lawyer?.id || lawyerId);

    if (!finalLawyerId || !form.date || !form.time) {
      setError(isRTL ? 'بيانات الحجز غير مكتملة، يرجى المحاولة مرة أخرى.' : 'Incomplete booking data, please try again.');
      setSubmitting(false);
      return;
    }

    try {
      const booking: any = await bookingsAPI.create({
        lawyerId: finalLawyerId, bookingDate: form.date, startTime: form.time,
        serviceType: form.serviceType, notes: form.notes,
        urgency: form.urgency, fee: finalPrice,
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
      const msg = e?.message || (isRTL ? 'حدث خطأ. تحقق من اتصالك وحاول مجدداً.' : 'Something went wrong. Check your connection and try again.');
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <View style={{ flex:1, backgroundColor:C.bg, justifyContent:'center', alignItems:'center' }}>
      <Spinner C={C} size="large" />
    </View>
  );

  const availableSlots = slots.filter(s => s.available);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex:1, backgroundColor:C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(s => s-1) : router.back()}>
            <Text style={{ color:C.text, fontSize:22 }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <Text style={{ ...serif, color:C.text, fontWeight:'700', fontSize:18 }}>
              {isRTL ? `حجز مع ${lawyer?.name}` : `Book with ${lawyer?.name}`}
            </Text>
            <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>
              {isRTL ? `الخطوة ${step} من 3 — ` : `Step ${step} of 3 — `}{STEPS[step-1]}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection:'row', gap:4 }}>
          {[1,2,3].map(s => (
            <View key={s} style={{ flex:1, height:4, borderRadius:2, backgroundColor: step>=s ? C.gold : C.border }} />
          ))}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        {error ? <ErrMsg C={C} msg={error} /> : null}

        {/* ══ STEP 1 — Service Type ══ */}
        {step === 1 && (
          <>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:15, marginBottom:12 }}>
              {isRTL ? 'ماذا تحتاج؟' : 'What do you need?'}
            </Text>
            {SERVICE_TYPES.map(svcOpt => {
              const price = Math.round(basePrice * svcOpt.mul);
              const sel   = form.serviceType === svcOpt.id;
              return (
                <TouchableOpacity key={svcOpt.id}
                  onPress={() => setForm(f => ({ ...f, serviceType:svcOpt.id }))}
                  style={{ flexDirection:'row', alignItems:'center', gap:14, backgroundColor:sel?`${C.gold}18`:C.card, borderWidth:2, borderColor:sel?C.gold:C.border, borderRadius:14, padding:14, marginBottom:10 }}>
                  <Text style={{ fontSize:26 }}>{svcOpt.icon}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:sel?C.gold:C.text, fontWeight:'700', fontSize:14 }}>
                      {isRTL ? svcOpt.label : svcOpt.labelEn}
                    </Text>
                    <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>
                      {isRTL ? svcOpt.desc : svcOpt.descEn}
                    </Text>
                  </View>
                  <Text style={{ color:C.gold, fontWeight:'800', fontSize:15 }}>{price} {t('app.egp')}</Text>
                  {sel && <View style={{ width:20, height:20, borderRadius:10, backgroundColor:C.gold, alignItems:'center', justifyContent:'center' }}><Text style={{ color:'#fff', fontSize:11, fontWeight:'700' }}>✓</Text></View>}
                </TouchableOpacity>
              );
            })}
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:10, marginTop:8 }}>
              {isRTL ? 'مستوى الإلحاح' : 'Urgency'}
            </Text>
            {URGENCY_OPTS.map(u => {
              const sel = form.urgency === u.id;
              return (
                <TouchableOpacity key={u.id} onPress={() => setForm(f => ({ ...f, urgency:u.id }))}
                  style={{ flexDirection:'row', alignItems:'center', gap:12, backgroundColor:sel?`${C.gold}18`:C.card, borderWidth:2, borderColor:sel?C.gold:C.border, borderRadius:12, padding:12, marginBottom:8 }}>
                  <Text style={{ color:sel?C.gold:C.text, fontSize:14, flex:1, fontWeight:sel?'700':'400' }}>
                    {isRTL ? u.label : u.labelEn}
                  </Text>
                  {u.extra !== 0 && (
                    <Text style={{ color:u.extra > 0 ? C.red : C.green, fontWeight:'700', fontSize:13 }}>
                      {u.extra > 0 ? `+${u.extra}` : `${u.extra}`} {t('app.egp')}
                    </Text>
                  )}
                  {sel && <Text style={{ color:C.gold }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <Btn C={C} full size="lg" onPress={() => setStep(2)} style={{ marginTop:8 }}>
              {t('app.continue')} →
            </Btn>
          </>
        )}

        {/* ══ STEP 2 — Calendar Slot Picker ══ */}
        {step === 2 && (
          <>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:15, marginBottom:14 }}>
              {isRTL ? 'اختر التاريخ والوقت' : 'Select Date & Time'}
            </Text>

            {/* Calendar */}
            <CalendarPicker
              C={C}
              selectedDate={form.date}
              onSelect={(iso: string) => { hapticSelect(); setForm(f => ({ ...f, date: iso, time: '' })); }}
              isRTL={isRTL}
            />

            {/* Time slots */}
            {form.date && (
              <>
                <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:10 }}>
                  {isRTL ? `المواعيد المتاحة — ${form.date}` : `Available Slots — ${form.date}`}
                </Text>
                {slotsLoad ? (
                  <View style={{ alignItems:'center', padding:20 }}><Spinner C={C} /></View>
                ) : availableSlots.length === 0 ? (
                  <View style={{ backgroundColor:C.card, borderRadius:12, padding:20, alignItems:'center', borderWidth:1, borderColor:C.border, marginBottom:14 }}>
                    <Text style={{ fontSize:32, marginBottom:8 }}>📅</Text>
                    <Text style={{ color:C.muted, fontSize:14, textAlign:'center' }}>
                      {isRTL ? 'لا توجد مواعيد متاحة في هذا اليوم' : 'No available slots on this day'}
                    </Text>
                    <Text style={{ color:C.muted, fontSize:12, marginTop:4, textAlign:'center' }}>
                      {isRTL ? 'جرب يوماً آخر' : 'Try another date'}
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:16 }}>
                    {slots.map(s => (
                      <TouchableOpacity key={s.time}
                        disabled={!s.available}
                        onPress={() => { hapticSelect(); setForm(f => ({ ...f, time: s.time })); }}
                        style={{
                          paddingHorizontal:16, paddingVertical:11, borderRadius:12,
                          borderWidth: form.time === s.time ? 2 : 1,
                          borderColor: form.time === s.time ? C.gold : s.available ? C.border : C.dim,
                          backgroundColor: form.time === s.time ? `${C.gold}18` : s.available ? 'transparent' : C.card,
                          opacity: s.available ? 1 : 0.4,
                          minWidth: 80, alignItems: 'center',
                        }}>
                        <Text style={{ color: form.time === s.time ? C.gold : s.available ? C.text : C.muted, fontSize:13, fontWeight: form.time === s.time ? '700' : '400' }}>
                          {s.time}
                        </Text>
                        {!s.available && (
                          <Text style={{ color:C.muted, fontSize:9, marginTop:2 }}>
                            {isRTL ? 'محجوز' : 'Booked'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Notes */}
            <View style={{ marginBottom:16 }}>
              <Text style={{ color:C.muted, fontSize:12, fontWeight:'600', marginBottom:6 }}>
                📝 {t('booking.notes')}
              </Text>
              <TextInput value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes:v }))}
                placeholder={isRTL ? 'اشرح قضيتك باختصار...' : 'Briefly describe your case...'}
                placeholderTextColor={C.muted} multiline numberOfLines={3}
                style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:10, padding:12, color:C.text, fontSize:14, textAlignVertical:'top', minHeight:70, textAlign: isRTL ? 'right' : 'left' }} />
            </View>

            <Btn C={C} full size="lg" disabled={!form.date || !form.time} onPress={() => { hapticLight(); setStep(3); }}>
              {t('app.continue')} →
            </Btn>
          </>
        )}

        {/* ══ STEP 3 — Confirm & Pay ══ */}
        {step === 3 && (
          <>
            {/* Booking summary */}
            <View style={{ backgroundColor:C.card, borderRadius:14, padding:16, borderWidth:1, borderColor:C.border, marginBottom:14 }}>
              <Text style={{ ...serif, color:C.text, fontWeight:'700', fontSize:17, marginBottom:14 }}>
                {isRTL ? '📋 ملخص الحجز' : '📋 Booking Summary'}
              </Text>
              {[
                { icon:'👤', label:isRTL?'المحامي':'Lawyer', val:lawyer?.name },
                { icon:'🔧', label:isRTL?'نوع الخدمة':'Service', val: isRTL ? svc?.label : svc?.labelEn },
                { icon:'📅', label:isRTL?'التاريخ':'Date', val:form.date },
                { icon:'⏰', label:isRTL?'الوقت':'Time', val:form.time },
                { icon:'⚡', label:isRTL?'الأولوية':'Urgency', val: isRTL ? URGENCY_OPTS.find(u=>u.id===form.urgency)?.label : URGENCY_OPTS.find(u=>u.id===form.urgency)?.labelEn },
              ].map(row => (
                <View key={row.label} style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.border }}>
                  <Text style={{ color:C.muted, fontSize:13 }}>{row.icon} {row.label}</Text>
                  <Text style={{ color:C.text, fontWeight:'600', fontSize:13 }}>{row.val}</Text>
                </View>
              ))}
            </View>

            {/* Promo code */}
            <View style={{ backgroundColor:C.card, borderRadius:14, padding:16, borderWidth:1, borderColor:C.border, marginBottom:14 }}>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:13, marginBottom:9 }}>
                🎟️ {t('payment.promoCode')}
              </Text>
              <View style={{ flexDirection:'row', gap:8 }}>
                <TextInput value={promo}
                  onChangeText={v => { setPromo(v); setPromoApplied(false); setPromoMsg(''); setDiscount(0); }}
                  placeholder="WELCOME20" placeholderTextColor={C.muted}
                  autoCapitalize="characters" editable={!promoApplied}
                  style={{ flex:1, backgroundColor:C.card2, borderWidth:1, borderColor:promoApplied?C.green:C.border, borderRadius:10, padding:10, color:C.text, fontSize:13 }} />
                <Btn C={C} size="sm" onPress={applyPromo} disabled={promoApplied||!promo.trim()} variant={promoApplied?'success':'ghost'}>
                  {promoApplied ? '✓' : t('payment.applyPromo')}
                </Btn>
              </View>
              {promoMsg ? <Text style={{ color:promoApplied?C.green:C.red, fontSize:12, marginTop:6 }}>{promoMsg}</Text> : null}
            </View>

            {/* Price breakdown */}
            <View style={{ backgroundColor:C.card, borderRadius:14, padding:16, borderWidth:1, borderColor:C.border, marginBottom:14 }}>
              {[
                { label:isRTL?'السعر الأساسي':t('payment.basePrice'), val:svcPrice, color:C.text },
                { label:isRTL?'رسوم المنصة':t('payment.platformFee'), val:platformFee, color:C.muted },
                urgencyExtra !== 0 ? { label:isRTL?'رسوم الإلحاح':t('payment.urgencyFee'), val:urgencyExtra, color:urgencyExtra>0?C.red:C.green } : null,
                discount > 0 ? { label:`🎉 ${isRTL?'خصم':t('payment.discount')}`, val:-discount, color:C.green } : null,
              ].filter(Boolean).map((row: any, i) => (
                <View key={i} style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:7 }}>
                  <Text style={{ color:C.muted, fontSize:13 }}>{row.label}</Text>
                  <Text style={{ color:row.color, fontWeight:'600', fontSize:13 }}>
                    {row.val > 0 ? `+${row.val}` : row.val} {t('app.egp')}
                  </Text>
                </View>
              ))}
              <View style={{ height:1, backgroundColor:C.border, marginVertical:8 }} />
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <Text style={{ color:C.text, fontWeight:'700', fontSize:16 }}>{t('payment.total')}</Text>
                <Text style={{ ...serif, color:C.gold, fontWeight:'900', fontSize:24 }}>
                  {finalPrice} {t('app.egp')}
                </Text>
              </View>
              {form.paymentMethod === 'installment' && (
                <View style={{ backgroundColor:`${C.accent}10`, borderRadius:10, padding:10, marginTop:10, borderWidth:1, borderColor:`${C.accent}25` }}>
                  <Text style={{ color:C.accent, fontSize:12, fontWeight:'600', textAlign:'center' }}>
                    3 × {installAmt} {t('app.egp')} / {t('install.perMonth')}
                  </Text>
                </View>
              )}
            </View>

            {/* Payment method */}
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:10 }}>
              {t('payment.method')}
            </Text>
            {PAYMENT_METHODS.map(m => {
              const sel = form.paymentMethod === m.id;
              return (
                <TouchableOpacity key={m.id} onPress={() => setForm(f => ({ ...f, paymentMethod:m.id }))}
                  style={{ flexDirection:'row', alignItems:'center', gap:12, backgroundColor:sel?`${C.gold}12`:C.card, borderWidth:2, borderColor:sel?C.gold:C.border, borderRadius:13, padding:13, marginBottom:8 }}>
                  <Text style={{ fontSize:22 }}>{m.icon}</Text>
                  <Text style={{ flex:1, color:sel?C.gold:C.text, fontWeight:sel?'700':'400', fontSize:14 }}>
                    {isRTL ? m.label : m.labelEn}
                  </Text>
                  <View style={{ width:18, height:18, borderRadius:9, borderWidth:2, borderColor:sel?C.gold:C.border, backgroundColor:sel?C.gold:'transparent', alignItems:'center', justifyContent:'center' }}>
                    {sel && <Text style={{ color:'#fff', fontSize:10, fontWeight:'700' }}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={{ alignItems:'center', marginVertical:10 }}>
              <Text style={{ color:C.muted, fontSize:11 }}>🔒 {t('payment.securePayment')}</Text>
            </View>

            <Btn C={C} full size="lg" disabled={submitting} onPress={confirm} style={{ marginBottom:8 }}>
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
