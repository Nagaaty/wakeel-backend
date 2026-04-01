// ─── Wakeel — In-App Paymob Payment Flow ─────────────────────────────────────
// Screen: /payment-flow?bookingId=X&amount=Y&lawyerName=Z&service=W
//
// Features:
//   • Step 1 — Choose payment method (card, Vodafone Cash, Fawry, InstaPay, Installments)
//   • Step 2 — Method-specific input (card details, phone, Fawry reference, installment plan)
//   • Step 3 — Processing → Success / Failed animation
//   • Promo code input with live discount calculation
//   • Full Arabic RTL + English bilingual via useI18n()
//   • Integrates with /api/payments/initiate and /api/payments/confirm
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Animated, Easing, Platform,
  KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/hooks/useTheme';
import { useI18n } from '../src/i18n';
import { Btn, Card, ErrMsg, Inp, Spinner } from '../src/components/ui';
import { useScreenshotPrevention } from '../src/hooks/useScreenshotPrevention';
import { paymentsAPI, promosAPI, installmentsAPI } from '../src/services/api';

// ─── Payment method definitions ───────────────────────────────────────────────
const PAYMENT_METHODS = [
  {
    id:    'card',
    icon:  '💳',
    nameKey: 'payment.card'  as const,
    subKey:  'payment.card.sub' as const,
    color: '#2563EB',
  },
  {
    id:    'vodafone',
    icon:  '📱',
    nameKey: 'payment.vodafone' as const,
    subKey:  'payment.vodafone.sub' as const,
    color: '#E60000',
  },
  {
    id:    'fawry',
    icon:  '🏪',
    nameKey: 'payment.fawry' as const,
    subKey:  'payment.fawry.sub' as const,
    color: '#F97316',
  },
  {
    id:    'instapay',
    icon:  '⚡',
    nameKey: 'payment.instapay' as const,
    subKey:  'payment.instapay.sub' as const,
    color: '#7C3AED',
  },
  {
    id:    'installment',
    icon:  '📆',
    nameKey: 'payment.installment' as const,
    subKey:  '' as const,
    color: '#059669',
  },
];

// Hard-coded fallback promos (matches existing book.tsx)
const PROMOS: Record<string, number | string> = {
  WELCOME20: 0.20,
  LEGAL10:   0.10,
  FIRST50:   50,
  VIP30:     0.30,
  LC2025:    0.15,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function PaymentFlowScreen() {
  const C       = useTheme();
  const { t, isRTL } = useI18n();
  useScreenshotPrevention(); // Payment screen — block screenshots
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{
    bookingId?:  string;
    amount?:     string;
    lawyerName?: string;
    service?:    string;
  }>();

  const bookingId  = params.bookingId  || '';
  const baseAmount = parseInt(params.amount || '500', 10);
  const lawyerName = params.lawyerName || '';
  const service    = params.service    || '';

  // ── State ──
  const [step,           setStep]           = useState<1 | 2 | 3>(1);
  const [method,         setMethod]         = useState('card');
  const [promo,          setPromo]          = useState('');
  const [promoMsg,       setPromoMsg]       = useState('');
  const [promoApplied,   setPromoApplied]   = useState(false);
  const [discount,       setDiscount]       = useState(0);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState('');
  const [paymentStatus,  setPaymentStatus]  = useState<'idle'|'processing'|'success'|'failed'>('idle');
  const [fawryRef,       setFawryRef]       = useState('');

  // Card fields
  const [cardNum,   setCardNum]   = useState('');
  const [cardName,  setCardName]  = useState('');
  const [cardExp,   setCardExp]   = useState('');
  const [cardCVV,   setCardCVV]   = useState('');

  // Vodafone / InstaPay phone
  const [phone,     setPhone]     = useState('');

  // Installment plan display
  const [installPlan, setInstallPlan] = useState<{
    months:     number;
    perMonth:   number;
    firstDue:   string;
    secondDue:  string;
    thirdDue:   string;
  } | null>(null);

  // ── Animations ──
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpac  = useRef(new Animated.Value(0)).current;
  const spinAnim     = useRef(new Animated.Value(0)).current;

  // Final amount
  const finalAmount = Math.max(0, baseAmount - discount);
  const installAmt  = Math.round(finalAmount / 3);

  // ── Build installment plan on mount ──────────────────────────────────────
  useEffect(() => {
    const today  = new Date();
    const m1 = new Date(today); m1.setMonth(m1.getMonth() + 1);
    const m2 = new Date(today); m2.setMonth(m2.getMonth() + 2);
    setInstallPlan({
      months:    3,
      perMonth:  installAmt,
      firstDue:  'Today',
      secondDue: m1.toLocaleDateString('en-EG', { month: 'short', day: 'numeric' }),
      thirdDue:  m2.toLocaleDateString('en-EG', { month: 'short', day: 'numeric' }),
    });
  }, [installAmt]);

  // ── Promo ─────────────────────────────────────────────────────────────────
  const applyPromo = async () => {
    const code = promo.trim().toUpperCase();
    if (!code) return;
    setPromoMsg(''); setPromoApplied(false); setDiscount(0);
    try {
      const d: any = await promosAPI.validate(code);
      const disc = d.discount_type === 'percent'
        ? Math.round(baseAmount * d.discount_value / 100)
        : d.discount_value;
      setDiscount(disc); setPromoApplied(true);
      setPromoMsg(`🎉 ${d.message || `-${disc} EGP applied!`}`);
    } catch {
      const p = PROMOS[code];
      if (p !== undefined) {
        const disc = typeof p === 'number' && p < 1
          ? Math.round(baseAmount * p) : Number(p);
        setDiscount(disc); setPromoApplied(true);
        setPromoMsg(`🎉 ${typeof p === 'number' && p < 1 ? `${p * 100}%` : `EGP ${p}`} off!`);
      } else {
        setPromoMsg('⚠️ Invalid code. Try WELCOME20 or FIRST50');
      }
    }
  };

  // ── Payment submit ────────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!bookingId) { setError('Missing booking ID'); return; }
    setError(''); setLoading(true);
    setPaymentStatus('processing');

    // Spin animation
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.linear })
    ).start();

    setStep(3);

    try {
      const payload: any = {
        bookingId,
        method,
        amount: finalAmount,
        promoCode: promoApplied ? promo.trim() : undefined,
      };

      if (method === 'card') {
        payload.card = { number: cardNum, name: cardName, expiry: cardExp, cvv: cardCVV };
      } else if (method === 'vodafone' || method === 'instapay') {
        payload.phone = phone;
      } else if (method === 'installment') {
        payload.installments = 3;
      }

      const result: any = await paymentsAPI.initiate(payload);

      // Paymob returns a checkout URL for card/wallets
      if (result?.checkoutUrl) {
        router.push({ pathname: '/payment-webview', params: { url: result.checkoutUrl, bookingId: bookingId || '', amount: String(finalAmount) } } as any);
      }

      // If Fawry — show reference number
      if (method === 'fawry' && result?.fawryRef) {
        setFawryRef(result.fawryRef);
      }

      // Mark success
      setPaymentStatus('success');
      spinAnim.stopAnimation();
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 180 }),
        Animated.timing(successOpac,  { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();

    } catch (err: any) {
      setPaymentStatus('failed');
      setError(err?.message || t('payment.failed'));
      spinAnim.stopAnimation();
    } finally {
      setLoading(false);
    }
  };

  const serif = { fontFamily: 'CormorantGaramond-Bold' };
  const textDir = { textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left' };

  // ── STEP 3 — Result screen ─────────────────────────────────────────────────
  if (step === 3) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        {paymentStatus === 'processing' && (
          <>
            <Spinner C={C} size="large" />
            <Text style={{ color: C.muted, marginTop: 20, fontSize: 15, ...textDir }}>
              {t('app.loading')}
            </Text>
          </>
        )}

        {paymentStatus === 'success' && (
          <Animated.View style={{ alignItems: 'center', opacity: successOpac, transform: [{ scale: successScale }] }}>
            <View style={{
              width: 100, height: 100, borderRadius: 50,
              backgroundColor: `${C.green}18`, borderWidth: 2, borderColor: C.green,
              alignItems: 'center', justifyContent: 'center', marginBottom: 24,
            }}>
              <Text style={{ fontSize: 52 }}>✅</Text>
            </View>
            <Text style={{ ...serif, color: C.text, fontSize: 28, fontWeight: '700', marginBottom: 8, ...textDir }}>
              {t('payment.success')}
            </Text>
            <Text style={{ color: C.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 8 }}>
              {isRTL ? `تم الدفع بنجاح بمبلغ ${finalAmount} ج.م` : `Payment of ${finalAmount} EGP confirmed`}
            </Text>
            {method === 'fawry' && fawryRef ? (
              <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 18, marginVertical: 16, width: '100%' }}>
                <Text style={{ color: C.muted, fontSize: 12, marginBottom: 4, textAlign: 'center' }}>
                  {isRTL ? 'رقم مرجع فوري' : 'Fawry Reference Number'}
                </Text>
                <Text style={{ color: C.gold, fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: 3 }}>
                  {fawryRef}
                </Text>
                <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                  {isRTL ? 'ادفع هذا الرقم في أي منفذ فوري خلال ٢٤ ساعة' : 'Pay this code at any Fawry outlet within 24 hours'}
                </Text>
              </View>
            ) : null}
            {method === 'installment' && installPlan ? (
              <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 18, marginVertical: 16, width: '100%' }}>
                <Text style={{ color: C.text, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>
                  {t('install.title')}
                </Text>
                {[
                  { label: t('install.month1'), date: installPlan.firstDue, status: 'paid' },
                  { label: t('install.month2'), date: installPlan.secondDue, status: 'pending' },
                  { label: t('install.month3'), date: installPlan.thirdDue, status: 'pending' },
                ].map((item, i) => (
                  <View key={i} style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ color: C.muted, fontSize: 13 }}>{item.label}</Text>
                    <Text style={{ color: C.muted, fontSize: 11 }}>{item.date}</Text>
                    <View style={{
                      backgroundColor: item.status === 'paid' ? `${C.green}18` : `${C.warn}18`,
                      borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
                    }}>
                      <Text style={{ color: item.status === 'paid' ? C.green : C.warn, fontSize: 11, fontWeight: '700' }}>
                        {item.status === 'paid' ? t('install.paid') : `${installPlan.perMonth} EGP`}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            <Btn C={C} full size="lg" onPress={() => router.replace('/bookings' as any)} style={{ marginTop: 8 }}>
              {isRTL ? 'عرض حجوزاتي' : 'View My Bookings'}
            </Btn>
          </Animated.View>
        )}

        {paymentStatus === 'failed' && (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 72, marginBottom: 20 }}>⚠️</Text>
            <Text style={{ ...serif, color: C.red, fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
              {t('payment.failed')}
            </Text>
            {error ? <Text style={{ color: C.muted, textAlign: 'center', marginBottom: 20 }}>{error}</Text> : null}
            <Btn C={C} full size="lg" onPress={() => { setStep(1); setPaymentStatus('idle'); setError(''); }}>
              {t('app.retry')}
            </Btn>
            <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 14 }}>
              <Text style={{ color: C.muted, fontSize: 13 }}>{t('app.back')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>

      {/* ── Header ── */}
      <View style={{
        backgroundColor: C.surface, paddingTop: insets.top + 12,
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <TouchableOpacity onPress={() => step === 2 ? setStep(1) : router.back()}>
            <Text style={{ color: C.text, fontSize: 24 }}>{isRTL ? '›' : '‹'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ ...serif, color: C.text, fontSize: 20, fontWeight: '700', ...textDir }}>
              {t('payment.title')}
            </Text>
            {lawyerName ? (
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 2, ...textDir }}>
                {isRTL ? `مع ${lawyerName}` : `with ${lawyerName}`}
                {service ? ` • ${service}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={{ backgroundColor: `${C.gold}20`, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: C.gold, fontWeight: '700', fontSize: 15 }}>{finalAmount} EGP</Text>
          </View>
        </View>
        {/* Step bar */}
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2].map(s => (
            <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: step >= s ? C.gold : C.border }} />
          ))}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {error ? <ErrMsg C={C} msg={error} /> : null}

        {/* ══ STEP 1 — Choose Method ══ */}
        {step === 1 && (
          <>
            {/* Promo code */}
            <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10, ...textDir }}>
                🎟️ {t('payment.promoCode')}
              </Text>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                <TextInput
                  value={promo}
                  onChangeText={t2 => { setPromo(t2); setPromoMsg(''); setPromoApplied(false); setDiscount(0); }}
                  placeholder={t('payment.promoPlaceholder')}
                  placeholderTextColor={C.muted}
                  autoCapitalize="characters"
                  style={{
                    flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: promoApplied ? C.green : C.border,
                    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 14,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                />
                <TouchableOpacity onPress={applyPromo} style={{
                  backgroundColor: C.gold, borderRadius: 10,
                  paddingHorizontal: 18, justifyContent: 'center',
                }}>
                  <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>{t('payment.applyPromo')}</Text>
                </TouchableOpacity>
              </View>
              {promoMsg ? (
                <Text style={{ color: promoApplied ? C.green : C.red, fontSize: 12, marginTop: 8, ...textDir }}>
                  {promoMsg}
                </Text>
              ) : null}
            </View>

            {/* Price summary */}
            <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 12, ...textDir }}>
                📋 {isRTL ? 'ملخص الدفع' : 'Payment Summary'}
              </Text>
              {[
                { label: t('payment.basePrice'), val: baseAmount,  color: C.text  },
                { label: t('payment.platformFee'), val: 50,        color: C.muted },
                discount > 0 ? { label: t('payment.discount'), val: -discount, color: C.green } : null,
              ].filter(Boolean).map((row: any, i: number) => (
                <View key={i} style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between', marginBottom: 8,
                }}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{row.label}</Text>
                  <Text style={{ color: row.color, fontWeight: '600', fontSize: 13 }}>
                    {row.val > 0 ? '+' : ''}{row.val} EGP
                  </Text>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>{t('payment.total')}</Text>
                <Text style={{ ...serif, color: C.gold, fontWeight: '900', fontSize: 20 }}>
                  {finalAmount} EGP
                </Text>
              </View>
            </View>

            {/* Payment methods */}
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 12, ...textDir }}>
              {t('payment.method')}
            </Text>
            {PAYMENT_METHODS.map(pm => {
              const sel = method === pm.id;
              const sub = pm.id === 'installment'
                ? `${installAmt} EGP × 3 ${isRTL ? 'أشهر' : 'months'}`
                : (pm.subKey ? t(pm.subKey) : '');
              return (
                <TouchableOpacity
                  key={pm.id}
                  onPress={() => setMethod(pm.id)}
                  style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center', gap: 14,
                    backgroundColor: sel ? `${pm.color}15` : C.card,
                    borderWidth: 2, borderColor: sel ? pm.color : C.border,
                    borderRadius: 14, padding: 14, marginBottom: 10,
                  }}
                >
                  <View style={{
                    width: 46, height: 46, borderRadius: 12,
                    backgroundColor: `${pm.color}20`,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1, borderColor: `${pm.color}30`,
                  }}>
                    <Text style={{ fontSize: 24 }}>{pm.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: sel ? pm.color : C.text, fontWeight: '700', fontSize: 14, ...textDir }}>
                      {t(pm.nameKey)}
                    </Text>
                    {sub ? (
                      <Text style={{ color: C.muted, fontSize: 12, marginTop: 2, ...textDir }}>{sub}</Text>
                    ) : null}
                  </View>
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    borderWidth: 2, borderColor: sel ? pm.color : C.border,
                    backgroundColor: sel ? pm.color : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
            <Btn C={C} full size="lg" onPress={() => setStep(2)} style={{ marginTop: 8 }}>
              {t('app.continue')} →
            </Btn>
          </>
        )}

        {/* ══ STEP 2 — Method-specific input ══ */}
        {step === 2 && (
          <>
            {/* Card inputs */}
            {method === 'card' && (
              <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 16 }}>
                <Text style={{ ...serif, color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 16, ...textDir }}>
                  💳 {isRTL ? 'بيانات البطاقة' : 'Card Details'}
                </Text>

                {/* Card preview */}
                <View style={{
                  backgroundColor: '#1C2029', borderRadius: 16, padding: 20, marginBottom: 20,
                  minHeight: 110, justifyContent: 'space-between',
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#EEE9DF80', fontSize: 11, letterSpacing: 1 }}>DEBIT / CREDIT</Text>
                    <Text style={{ fontSize: 20 }}>💳</Text>
                  </View>
                  <Text style={{ color: '#EEE9DF', fontSize: 18, letterSpacing: 3, fontWeight: '600', marginTop: 10 }}>
                    {(cardNum || '•••• •••• •••• ••••').replace(/(.{4})/g, '$1 ').trim()}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                    <Text style={{ color: '#EEE9DF', fontSize: 13 }}>{cardName || 'FULL NAME'}</Text>
                    <Text style={{ color: '#EEE9DF', fontSize: 13 }}>{cardExp || 'MM/YY'}</Text>
                  </View>
                </View>

                <Inp C={C} label={isRTL ? 'رقم البطاقة' : 'Card Number'}
                  value={cardNum} onChangeText={(v: string) => setCardNum(v.replace(/\D/g,'').slice(0,16))}
                  placeholder="1234 5678 9012 3456" keyboardType="numeric" />
                <Inp C={C} label={isRTL ? 'الاسم على البطاقة' : 'Name on Card'}
                  value={cardName} onChangeText={setCardName} autoCapitalize="words"
                  placeholder={isRTL ? 'الاسم كما يظهر على البطاقة' : 'As it appears on the card'} />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Inp C={C} label={isRTL ? 'تاريخ الانتهاء' : 'Expiry'}
                      value={cardExp} onChangeText={(v: string) => {
                        const clean = v.replace(/\D/g,'').slice(0,4);
                        setCardExp(clean.length > 2 ? `${clean.slice(0,2)}/${clean.slice(2)}` : clean);
                      }} placeholder="MM/YY" keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Inp C={C} label="CVV" value={cardCVV}
                      onChangeText={(v: string) => setCardCVV(v.replace(/\D/g,'').slice(0,4))}
                      placeholder="•••" keyboardType="numeric" secureTextEntry />
                  </View>
                </View>
              </View>
            )}

            {/* Vodafone / InstaPay */}
            {(method === 'vodafone' || method === 'instapay') && (
              <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 16 }}>
                <Text style={{ ...serif, color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 16, ...textDir }}>
                  {method === 'vodafone' ? '📱 Vodafone Cash' : '⚡ InstaPay'}
                </Text>
                <Inp C={C}
                  label={isRTL ? 'رقم الهاتف المسجل' : 'Registered Phone Number'}
                  value={phone} onChangeText={setPhone}
                  placeholder="01X XXXX XXXX" keyboardType="phone-pad" />
                <View style={{ backgroundColor: `${C.warn}12`, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: `${C.warn}30` }}>
                  <Text style={{ color: C.warn, fontSize: 12, ...textDir }}>
                    {method === 'vodafone'
                      ? (isRTL ? 'ستتلقى رسالة تأكيد على هاتفك المسجل في فودافون كاش' : 'You will receive a confirmation SMS on your Vodafone Cash number')
                      : (isRTL ? 'ستتلقى إشعار تحويل على تطبيق InstaPay الخاص بك' : 'You will receive a transfer notification on your InstaPay app')}
                  </Text>
                </View>
              </View>
            )}

            {/* Fawry */}
            {method === 'fawry' && (
              <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 16 }}>
                <Text style={{ ...serif, color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 16, ...textDir }}>
                  🏪 Fawry
                </Text>
                <View style={{ backgroundColor: `${C.gold}10`, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: `${C.gold}25`, marginBottom: 16 }}>
                  <Text style={{ color: C.muted, fontSize: 12, marginBottom: 4, textAlign: 'center' }}>
                    {isRTL ? 'سيتم إنشاء رقم مرجعي عند الضغط على ادفع' : 'A reference number will be generated when you press Pay'}
                  </Text>
                  <Text style={{ color: C.text, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                    {isRTL
                      ? 'اذهب إلى أي منفذ فوري، واطلب دفع فاتورة "وكيل" برقمك المرجعي خلال ٢٤ ساعة'
                      : 'Visit any Fawry outlet and ask to pay "Wakeel" bill using your reference number within 24 hours'}
                  </Text>
                </View>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 20 }}>💡</Text>
                  <Text style={{ color: C.muted, fontSize: 12, flex: 1, ...textDir }}>
                    {isRTL ? 'يمكنك الدفع في أي محل قريب يحمل علامة فوري' : 'Pay at supermarkets, pharmacies, or any outlet with the Fawry logo'}
                  </Text>
                </View>
              </View>
            )}

            {/* Installments */}
            {method === 'installment' && installPlan && (
              <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 16 }}>
                <Text style={{ ...serif, color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 6, ...textDir }}>
                  📆 {t('install.title')}
                </Text>
                <Text style={{ color: C.muted, fontSize: 12, marginBottom: 20, ...textDir }}>
                  {t('install.subtitle')}
                </Text>
                {[
                  { n: t('install.month1'), d: installPlan.firstDue,  amt: installAmt, status: 'today'   },
                  { n: t('install.month2'), d: installPlan.secondDue, amt: installAmt, status: 'upcoming' },
                  { n: t('install.month3'), d: installPlan.thirdDue,  amt: installAmt, status: 'upcoming' },
                ].map((inst, i) => (
                  <View key={i} style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center', gap: 14, marginBottom: 14,
                  }}>
                    <View style={{
                      width: 42, height: 42, borderRadius: 21,
                      backgroundColor: inst.status === 'today' ? `${C.gold}20` : `${C.border}50`,
                      borderWidth: 2, borderColor: inst.status === 'today' ? C.gold : C.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ color: inst.status === 'today' ? C.gold : C.muted, fontWeight: '700', fontSize: 14 }}>
                        {i + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: '600', fontSize: 14, ...textDir }}>{inst.n}</Text>
                      <Text style={{ color: C.muted, fontSize: 12, ...textDir }}>{inst.d}</Text>
                    </View>
                    <View>
                      <Text style={{ color: inst.status === 'today' ? C.gold : C.muted, fontWeight: '700', fontSize: 16 }}>
                        {inst.amt} EGP
                      </Text>
                      {inst.status === 'today' && (
                        <Text style={{ color: C.green, fontSize: 10, fontWeight: '700', textAlign: 'center' }}>
                          {isRTL ? 'اليوم' : 'TODAY'}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
                <View style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }} />
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{t('payment.total')}</Text>
                  <Text style={{ color: C.gold, fontWeight: '800', fontSize: 16 }}>{finalAmount} EGP</Text>
                </View>
                <View style={{
                  backgroundColor: `${C.green}10`, borderRadius: 10, padding: 12,
                  borderWidth: 1, borderColor: `${C.green}25`, marginTop: 14,
                }}>
                  <Text style={{ color: C.green, fontSize: 12, textAlign: 'center', fontWeight: '600' }}>
                    {isRTL ? '✅ لا توجد فوائد أو رسوم إضافية على التقسيط' : '✅ No interest or extra fees on installments'}
                  </Text>
                </View>
              </View>
            )}

            {/* Secure badge + Pay button */}
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: C.muted, fontSize: 11 }}>
                {t('payment.securePayment')}
              </Text>
            </View>
            <Btn C={C} full size="lg" onPress={handlePay} disabled={loading} style={{ marginBottom: 8 }}>
              {loading ? t('app.loading') : `${t('payment.payNow')} — ${finalAmount} EGP`}
            </Btn>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => setStep(1)}>
              <Text style={{ color: C.muted, fontSize: 13 }}>{t('app.back')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
