// ─── Wakeel — Installment Plans Screen ───────────────────────────────────────
// Route: /installments
//
// Features:
//   • List all active + completed installment plans
//   • Timeline view of each installment (paid ✅ / due 🔔 / upcoming)
//   • Pay a due installment via the payment flow
//   • Payment progress bar per plan
//   • Full Arabic RTL + English via useI18n()
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/hooks/useTheme';
import { useI18n } from '../src/i18n';
import { Btn, Spinner, ErrMsg } from '../src/components/ui';
import { installmentsAPI } from '../src/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface InstallmentPayment {
  id:             string;
  installment_id: string;
  amount:         number;
  status:         'pending' | 'paid' | 'overdue';
  paid_at:        string | null;
  due_date:       string;
}

interface InstallmentPlan {
  id:              string;
  booking_id:      string;
  lawyer_name:     string;
  service_type:    string;
  total_amount:    number;
  paid_amount:     number;
  installments:    number;
  interval_days:   number;
  next_due_at:     string | null;
  status:          'active' | 'completed' | 'defaulted';
  created_at:      string;
  payments:        InstallmentPayment[];
}

// ─── Seed fallback data (shown when API is unavailable) ───────────────────────
const SEED_PLANS: InstallmentPlan[] = [
  {
    id:            'inst-1',
    booking_id:    'bk-1',
    lawyer_name:   'Dr. Ahmed Hassan',
    service_type:  'Video Consultation',
    total_amount:  900,
    paid_amount:   300,
    installments:  3,
    interval_days: 30,
    next_due_at:   new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    status:        'active',
    created_at:    new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    payments: [
      { id: 'p1', installment_id: 'inst-1', amount: 300, status: 'paid',    paid_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), due_date: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString() },
      { id: 'p2', installment_id: 'inst-1', amount: 300, status: 'pending', paid_at: null, due_date: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString() },
      { id: 'p3', installment_id: 'inst-1', amount: 300, status: 'pending', paid_at: null, due_date: new Date(Date.now() + 32 * 24 * 3600 * 1000).toISOString() },
    ],
  },
  {
    id:            'inst-2',
    booking_id:    'bk-2',
    lawyer_name:   'Dr. Nadia El-Masri',
    service_type:  'In-Person Meeting',
    total_amount:  1300,
    paid_amount:   1300,
    installments:  3,
    interval_days: 30,
    next_due_at:   null,
    status:        'completed',
    created_at:    new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
    payments: [
      { id: 'p4', installment_id: 'inst-2', amount: 434, status: 'paid', paid_at: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(), due_date: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString() },
      { id: 'p5', installment_id: 'inst-2', amount: 433, status: 'paid', paid_at: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString(), due_date: new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString() },
      { id: 'p6', installment_id: 'inst-2', amount: 433, status: 'paid', paid_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), due_date: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString() },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(iso: string, isRTL: boolean): string {
  const d = new Date(iso);
  return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({ plan, C, isRTL, t, onPay }: {
  plan:    InstallmentPlan;
  C:       any;
  isRTL:   boolean;
  t:       (k: any) => string;
  onPay:   (plan: InstallmentPlan, payment: InstallmentPayment) => void;
}) {
  const serif    = { fontFamily: 'Cairo-Bold' };
  const textDir  = { textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left' };
  const progress = plan.total_amount > 0 ? plan.paid_amount / plan.total_amount : 0;
  const remaining = plan.total_amount - plan.paid_amount;

  const statusColor = plan.status === 'completed' ? C.green
    : plan.status === 'defaulted' ? C.red : C.gold;
  const statusLabel = plan.status === 'completed' ? t('install.completed')
    : plan.status === 'defaulted' ? (isRTL ? 'متعثر' : 'Defaulted') : t('install.active');

  const nextDue = plan.payments.find(p => p.status === 'pending' || p.status === 'overdue');
  const daysLeft = nextDue ? daysUntil(nextDue.due_date) : null;

  return (
    <View style={{
      backgroundColor: C.card, borderRadius: 18, padding: 20,
      marginBottom: 16, borderWidth: 1, borderColor: C.border,
    }}>
      {/* Header */}
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, ...textDir }} numberOfLines={1}>
            {plan.lawyer_name}
          </Text>
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 2, ...textDir }}>
            {plan.service_type}
          </Text>
        </View>
        <View style={{
          backgroundColor: `${statusColor}15`,
          borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
          borderWidth: 1, borderColor: `${statusColor}30`,
          alignSelf: 'flex-start',
        }}>
          <Text style={{ color: statusColor, fontWeight: '700', fontSize: 11 }}>{statusLabel}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ color: C.muted, fontSize: 12 }}>
            {t('install.paid')}: {plan.paid_amount} EGP
          </Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>
            {t('install.remaining')}: {remaining} EGP
          </Text>
        </View>
        <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden' }}>
          <View style={{
            height: '100%',
            width: `${Math.min(100, progress * 100)}%`,
            backgroundColor: plan.status === 'completed' ? C.green : C.gold,
            borderRadius: 4,
          }} />
        </View>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <Text style={{ color: C.muted, fontSize: 10 }}>{Math.round(progress * 100)}% {isRTL ? 'مكتمل' : 'complete'}</Text>
          <Text style={{ ...serif, color: C.gold, fontWeight: '700', fontSize: 14 }}>
            {plan.total_amount} EGP
          </Text>
        </View>
      </View>

      {/* Next due alert */}
      {nextDue && daysLeft !== null && daysLeft <= 7 && (
        <View style={{
          backgroundColor: daysLeft < 0 ? `${C.red}15` : daysLeft <= 3 ? `${C.warn}15` : `${C.gold}10`,
          borderRadius: 10, padding: 10, marginBottom: 12,
          borderWidth: 1,
          borderColor: daysLeft < 0 ? `${C.red}30` : daysLeft <= 3 ? `${C.warn}30` : `${C.gold}25`,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center', gap: 8,
        }}>
          <Text style={{ fontSize: 16 }}>{daysLeft < 0 ? '🔴' : daysLeft <= 3 ? '🟠' : '🟡'}</Text>
          <Text style={{ color: daysLeft < 0 ? C.red : daysLeft <= 3 ? C.warn : C.gold, fontSize: 12, fontWeight: '600', flex: 1, ...textDir }}>
            {daysLeft < 0
              ? (isRTL ? `متأخر ${Math.abs(daysLeft)} يوم` : `${Math.abs(daysLeft)} days overdue`)
              : daysLeft === 0
                ? (isRTL ? 'القسط مستحق اليوم' : 'Payment due today')
                : (isRTL ? `القسط التالي خلال ${daysLeft} يوم` : `Next payment in ${daysLeft} days`)}
          </Text>
        </View>
      )}

      {/* Payment timeline */}
      <View style={{ marginBottom: 14 }}>
        {plan.payments.map((pmt, i) => {
          const isPaid    = pmt.status === 'paid';
          const isOverdue = pmt.status === 'overdue' || (pmt.status === 'pending' && daysUntil(pmt.due_date) < 0);
          const isDue     = pmt.status === 'pending' && daysUntil(pmt.due_date) >= 0;
          const dotColor  = isPaid ? C.green : isOverdue ? C.red : isDue ? C.gold : C.border;

          return (
            <View key={pmt.id} style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start', gap: 12, marginBottom: 10,
            }}>
              {/* Timeline dot + line */}
              <View style={{ alignItems: 'center', width: 24 }}>
                <View style={{
                  width: 24, height: 24, borderRadius: 12,
                  backgroundColor: `${dotColor}20`,
                  borderWidth: 2, borderColor: dotColor,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 11 }}>
                    {isPaid ? '✓' : isOverdue ? '!' : `${i + 1}`}
                  </Text>
                </View>
                {i < plan.payments.length - 1 && (
                  <View style={{ width: 2, height: 18, backgroundColor: isPaid ? C.green : C.border, marginTop: 2 }} />
                )}
              </View>

              {/* Payment details */}
              <View style={{ flex: 1, paddingTop: 2 }}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>
                    {isRTL ? `القسط ${i + 1}` : `Installment ${i + 1}`}
                  </Text>
                  <Text style={{ color: isPaid ? C.green : C.gold, fontWeight: '700', fontSize: 14 }}>
                    {pmt.amount} EGP
                  </Text>
                </View>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 2, ...textDir }}>
                  {isPaid
                    ? `${isRTL ? 'تم الدفع:' : 'Paid:'} ${formatDate(pmt.paid_at!, isRTL)}`
                    : `${isRTL ? 'تاريخ الاستحقاق:' : 'Due:'} ${formatDate(pmt.due_date, isRTL)}`}
                </Text>
              </View>

              {/* Pay button for pending */}
              {(pmt.status === 'pending' || pmt.status === 'overdue') && (
                <Btn C={C} size="sm" variant={isOverdue ? 'danger' : 'gold'} onPress={() => onPay(plan, pmt)}>
                  {t('install.payInstallment')}
                </Btn>
              )}
            </View>
          );
        })}
      </View>

      {/* Started date */}
      <Text style={{ color: C.dim, fontSize: 11, ...textDir }}>
        {isRTL ? `بدأ:` : `Started:`} {formatDate(plan.created_at, isRTL)}
      </Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function InstallmentsScreen() {
  const C      = useTheme();
  const { t, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const serif  = { fontFamily: 'Cairo-Bold' };

  const [plans,     setPlans]     = useState<InstallmentPlan[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState('');
  const [tab,       setTab]       = useState<'active' | 'completed'>('active');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const res: any = await installmentsAPI.list();
      setPlans(res.installments || res.data || SEED_PLANS);
    } catch {
      setPlans(SEED_PLANS); // fallback to seed data
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handlePay = (plan: InstallmentPlan, payment: InstallmentPayment) => {
    router.push({
      pathname: '/payment-flow',
      params: {
        bookingId:  plan.booking_id,
        amount:     String(payment.amount),
        lawyerName: plan.lawyer_name,
        service:    `${isRTL ? 'قسط' : 'Installment'} ${plan.payments.indexOf(payment) + 1} of ${plan.installments}`,
      },
    } as any);
  };

  const activePlans    = plans.filter(p => p.status === 'active');
  const completedPlans = plans.filter(p => p.status === 'completed' || p.status === 'defaulted');
  const displayed      = tab === 'active' ? activePlans : completedPlans;

  // Summary totals
  const totalDue = activePlans.reduce((sum, p) => {
    const nextDue = p.payments.find(pay => pay.status === 'pending' || pay.status === 'overdue');
    return sum + (nextDue?.amount || 0);
  }, 0);

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
      <Spinner C={C} size="large" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>

      {/* ── Header ── */}
      <View style={{
        backgroundColor: C.surface,
        paddingTop: insets.top + 12,
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: C.text, fontSize: 24 }}>{isRTL ? '›' : '‹'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ ...serif, color: C.text, fontSize: 22, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' }}>
              {t('install.title')}
            </Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 1, textAlign: isRTL ? 'right' : 'left' }}>
              {t('install.subtitle')}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={C.gold} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {error ? <ErrMsg C={C} msg={error} /> : null}

        {/* ── Summary card ── */}
        {activePlans.length > 0 && (
          <View style={{
            backgroundColor: C.card, borderRadius: 18, padding: 20,
            borderWidth: 1, borderColor: C.border, marginBottom: 20,
          }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 20 }}>
              {[
                { label: isRTL ? 'خطط نشطة' : 'Active Plans', val: activePlans.length, color: C.gold },
                { label: isRTL ? 'المستحق الآن' : 'Due Now',   val: `${totalDue} EGP`, color: totalDue > 0 ? C.warn : C.green },
                { label: isRTL ? 'مكتملة' : 'Completed',       val: completedPlans.length, color: C.green },
              ].map((stat, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ ...serif, color: stat.color, fontWeight: '900', fontSize: 22 }}>
                    {stat.val}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 2 }}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Tabs ── */}
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginBottom: 16 }}>
          {([
            { key: 'active',    label: `${t('install.active')} (${activePlans.length})` },
            { key: 'completed', label: `${t('install.completed')} (${completedPlans.length})` },
          ] as const).map(tb => (
            <TouchableOpacity
              key={tb.key}
              onPress={() => setTab(tb.key)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 12,
                backgroundColor: tab === tb.key ? `${C.gold}20` : C.card,
                borderWidth: 1, borderColor: tab === tb.key ? C.gold : C.border,
                alignItems: 'center',
              }}
            >
              <Text style={{
                color: tab === tb.key ? C.gold : C.muted,
                fontWeight: tab === tb.key ? '700' : '400',
                fontSize: 13,
              }}>
                {tb.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Plan list ── */}
        {displayed.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <Text style={{ fontSize: 52, marginBottom: 16 }}>📆</Text>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
              {t('install.noPlans')}
            </Text>
            <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center' }}>
              {isRTL
                ? 'يمكنك اختيار الدفع بالتقسيط عند حجز استشارة'
                : 'You can choose installments when booking a consultation'}
            </Text>
            <Btn C={C} onPress={() => router.push('/(tabs)/lawyers' as any)} style={{ marginTop: 20 }}>
              {t('lawyer.findLawyer')}
            </Btn>
          </View>
        ) : (
          displayed.map(plan => (
            <PlanCard key={plan.id} plan={plan} C={C} isRTL={isRTL} t={t} onPay={handlePay} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
