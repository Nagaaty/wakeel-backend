import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, I18nManager } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';

I18nManager.forceRTL(true);

const HISTORY = [
  { id: 1, amount: 2400, date: '1 مارس 2025', method: 'تحويل بنكي', status: 'completed', ref: 'PAY-2025-001' },
  { id: 2, amount: 1850, date: '1 فبراير 2025', method: 'تحويل بنكي', status: 'completed', ref: 'PAY-2025-002' },
  { id: 3, amount: 3100, date: '1 يناير 2025', method: 'Vodafone Cash', status: 'completed', ref: 'PAY-2025-003' },
];

export default function PayoutScreen() {
  const C = useTheme();
  const { t, isRTL, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'request' | 'history' | 'bank'>('request');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [submitting, setSubmitting] = useState(false);
  const [bankDetails, setBankDetails] = useState({ name: 'أحمد حسن محمد', account: '1234567890', bank: 'بنك مصر', iban: 'EG380002000156789012345' });

  const BALANCE = 3800;
  const PENDING = 650;

  const requestPayout = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 100) { Alert.alert('خطأ', 'الحد الأدنى للسحب 100 جنيه'); return; }
    if (amt > BALANCE) { Alert.alert('خطأ', 'المبلغ المطلوب أكبر من الرصيد المتاح'); return; }
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1500));
    setSubmitting(false);
    Alert.alert('✅ تم الطلب', `سيتم تحويل ${amt} جنيه خلال 2-3 أيام عمل`);
    setAmount('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 18 }}>إدارة المدفوعات</Text>
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>طلب سحب · بيانات البنك · السجل</Text>
        </View>
      </View>

      {/* Balance cards */}
      <View style={{ flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 0 }}>
        <View style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 }}>
          <Text style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>الرصيد المتاح</Text>
          <Text style={{ color: C.green, fontWeight: '800', fontSize: 26 }}>{BALANCE.toLocaleString()}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>جنيه مصري</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 }}>
          <Text style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>قيد التحصيل</Text>
          <Text style={{ color: C.warn, fontWeight: '800', fontSize: 26 }}>{PENDING.toLocaleString()}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>جنيه مصري</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: 'row', backgroundColor: C.card, margin: 16, borderRadius: 12, padding: 4, gap: 4 }}>
        {([['request', '💸 طلب سحب'], ['bank', '🏦 البنك'], ['history', '📋 السجل']] as [string, string][]).map(([t, lb]) => (
          <TouchableOpacity key={t} onPress={() => setTab(t as any)}
            style={{ flex: 1, padding: 10, borderRadius: 9, backgroundColor: tab === t ? C.surface : 'transparent', alignItems: 'center' }}>
            <Text style={{ color: tab === t ? C.text : C.muted, fontSize: 12, fontWeight: tab === t ? '700' : '400' }}>{lb}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {tab === 'request' && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 14 }}>طلب صرف رصيد</Text>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>المبلغ المطلوب (جنيه)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="أدخل المبلغ (الحد الأدنى 100 جنيه)"
              placeholderTextColor={C.muted}
              keyboardType="numeric"
              style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, color: C.text, fontSize: 16, marginBottom: 14 }}
            />
            {/* Quick amounts */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[500, 1000, 2000, BALANCE].map(a => (
                <TouchableOpacity key={a} onPress={() => setAmount(String(a))}
                  style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                  <Text style={{ color: C.gold, fontSize: 13, fontWeight: '700' }}>{a === BALANCE ? 'الكل' : a.toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>طريقة الاستلام</Text>
            {[['bank', '🏦 تحويل بنكي', 'للحساب المسجل · 2-3 أيام عمل'], ['vodafone', '📱 Vodafone Cash', 'فوري · رسوم 1%'], ['instapay', '⚡ InstaPay', 'فوري · بدون رسوم']].map(([id, name, desc]) => (
              <TouchableOpacity key={id} onPress={() => setMethod(id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderWidth: 2, borderColor: method === id ? C.gold : C.border, borderRadius: 12, padding: 14, marginBottom: 8 }}>
                <Text style={{ fontSize: 20 }}>{name.split(' ')[0]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>{name.slice(2)}</Text>
                  <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{desc}</Text>
                </View>
                {method === id && <Text style={{ color: C.gold }}>✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={requestPayout} disabled={submitting}
              style={{ backgroundColor: submitting ? C.dim : C.gold, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{submitting ? '⏳ جاري الطلب...' : '💸 طلب السحب'}</Text>
            </TouchableOpacity>
            <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>يُحتجز 5% من كل معاملة كضمان لمدة 7 أيام</Text>
          </>
        )}

        {tab === 'bank' && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 14 }}>بيانات الحساب البنكي</Text>
            {[['👤 صاحب الحساب', bankDetails.name], ['🏦 البنك', bankDetails.bank], ['📋 رقم الحساب', bankDetails.account], ['🌐 IBAN', bankDetails.iban]].map(([label, val]) => (
              <View key={label} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <Text style={{ color: C.muted, fontSize: 12, marginBottom: 4 }}>{label}</Text>
                <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>{val}</Text>
              </View>
            ))}
            <TouchableOpacity style={{ backgroundColor: C.gold, borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>✏️ تعديل البيانات البنكية</Text>
            </TouchableOpacity>
          </>
        )}

        {tab === 'history' && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 14 }}>سجل المدفوعات</Text>
            {HISTORY.map(item => (
              <View key={item.id} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <Text style={{ color: C.green, fontWeight: '800', fontSize: 20 }}>{item.amount.toLocaleString()} ج</Text>
                  <View style={{ backgroundColor: '#22C55E20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: C.green, fontSize: 11, fontWeight: '700' }}>✅ مكتمل</Text>
                  </View>
                </View>
                <Text style={{ color: C.muted, fontSize: 12 }}>📅 {item.date} · {item.method}</Text>
                <Text style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>Ref: {item.ref}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
