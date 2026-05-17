import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  InteractionManager,} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { Btn, Card } from '../src/components/ui';
import { aiAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

const LAW_CATS = ['قانون الأسرة','جنائي','شركات','عقارات','عمالي','مدني','إداري'];
const STEPS = ['نوع القضية','تفاصيل الحالة','نتائج التحليل'];

export default function PredictorScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ cat: '', strength: 'medium', evidence: 'some', priorRecord: false, opponentLawyer: false });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const upd = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const predict = async () => {
    setLoading(true);
    try {
      // Call aiAPI.analyzeCase with case details
      const caseText = `نوع القضية: ${form.cat}. قوة الموقف: ${form.strength}. الأدلة: ${form.evidence}. سجل جنائي: ${form.priorRecord ? 'نعم' : 'لا'}. الخصم لديه محامٍ: ${form.opponentLawyer ? 'نعم' : 'لا'}.`;
      const aiResult: any = await aiAPI.analyzeCase(caseText).catch(() => null);

      // Use AI result if available, otherwise fall back to local calculation
      let w = 60, s = 25, l = 15;
      if (aiResult?.win_probability) {
        w = aiResult.win_probability;
        s = aiResult.settle_probability || 25;
        l = 100 - w - s;
      } else {
        if (form.strength === 'strong') { w += 20; s -= 10; l -= 10; }
        if (form.strength === 'weak')   { w -= 25; l += 20; s += 5; }
        if (form.evidence === 'strong') { w += 10; l -= 5;  s -= 5; }
        if (form.evidence === 'none')   { w -= 15; l += 10; s += 5; }
        if (form.priorRecord)           { w -= 10; l += 8;  s += 2; }
        if (form.opponentLawyer)        { w -= 5;  l += 3;  s += 2; }
      }
      const tot = w + s + l;
      setResult({
        win:    Math.max(5, Math.min(90, Math.round(w / tot * 100))),
        settle: Math.max(5, Math.min(60, Math.round(s / tot * 100))),
        lose:   Math.max(5, Math.min(70, Math.round(l / tot * 100))),
        aiPowered: !!aiResult?.win_probability,
      });
      setStep(3);
    } catch {
      // Fallback calculation if everything fails
      let w = 60, s = 25, l = 15;
      if (form.strength === 'strong') { w += 20; s -= 10; l -= 10; }
      if (form.strength === 'weak')   { w -= 25; l += 20; s += 5; }
      const tot = w + s + l;
      setResult({
        win:    Math.max(5, Math.min(90, Math.round(w / tot * 100))),
        settle: Math.max(5, Math.min(60, Math.round(s / tot * 100))),
        lose:   Math.max(5, Math.min(70, Math.round(l / tot * 100))),
        aiPowered: false,
      });
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1); setResult(null);
    setForm({ cat: '', strength: 'medium', evidence: 'some', priorRecord: false, opponentLawyer: false });
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(s => s - 1) : router.back()}>
            <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 20, fontFamily: 'Cairo-Bold' }}>🔮 محلل نتائج القضايا</Text>
            <Text style={{ color: C.muted, fontSize: 12 }}>الخطوة {step} من 3: {STEPS[step - 1]}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1, 2, 3].map(s => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: step >= s ? C.gold : C.border }} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Disclaimer */}
        <View style={{ backgroundColor: C.warn + '12', borderWidth: 1, borderColor: C.warn + '25', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 20 }}>
          <Text style={{ color: C.muted, fontSize: 12 }}>⚠️ تقدير عام بالذكاء الاصطناعي — ليس استشارة قانونية. استشر محامياً معتمداً لقضيتك.</Text>
        </View>

        {/* Step 1 — Category */}
        {step === 1 && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 14 }}>نوع القضية</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
              {LAW_CATS.map(cat => (
                <TouchableOpacity key={cat} onPress={() => upd('cat', cat)}
                  style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, borderWidth: 2, borderColor: form.cat === cat ? C.gold : C.border, backgroundColor: form.cat === cat ? C.gold + '20' : 'transparent' }}>
                  <Text style={{ color: form.cat === cat ? C.gold : C.text, fontWeight: form.cat === cat ? '700' : '400', fontSize: 13 }}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Btn C={C} full disabled={!form.cat} onPress={() => setStep(2)}>التالي ←</Btn>
          </>
        )}

        {/* Step 2 — Details */}
        {step === 2 && (
          <>
            {([
              { label: '💪 قوة موقفك القانوني', key: 'strength', options: [['strong', 'قوي'], ['medium', 'متوسط'], ['weak', 'ضعيف']] as [string, string][] },
              { label: '📂 الأدلة المتاحة',     key: 'evidence', options: [['strong', 'قوية'], ['some', 'جزئية'], ['none', 'لا توجد']] as [string, string][] },
            ]).map(({ label, key, options }) => (
              <View key={key} style={{ marginBottom: 20 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>{label}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {options.map(([val, lb]) => (
                    <TouchableOpacity key={val} onPress={() => upd(key, val)}
                      style={{ flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: (form as any)[key] === val ? C.gold : C.border, backgroundColor: (form as any)[key] === val ? C.gold + '15' : 'transparent', alignItems: 'center' }}>
                      <Text style={{ color: (form as any)[key] === val ? C.gold : C.muted, fontSize: 13, fontWeight: (form as any)[key] === val ? '700' : '400' }}>{lb}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            <Card C={C} style={{ marginBottom: 20 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 12 }}>عوامل إضافية</Text>
              {([
                ['priorRecord',    'لديّ سجل جنائي أو سوابق'],
                ['opponentLawyer', 'الخصم يملك محامياً متمرساً'],
              ] as [keyof typeof form, string][]).map(([key, label]) => (
                <View key={key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ color: C.text, fontSize: 13 }}>{label}</Text>
                  <TouchableOpacity onPress={() => upd(key, !form[key])}
                    style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: form[key] ? C.gold : '#DDD', justifyContent: 'center', alignItems: form[key] ? 'flex-end' : 'flex-start', paddingHorizontal: 3 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff' }} />
                  </TouchableOpacity>
                </View>
              ))}
            </Card>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn C={C} full variant="ghost" onPress={() => setStep(1)}>← السابق</Btn>
              <Btn C={C} full disabled={loading} onPress={predict}>
                {loading ? '⏳ يحلل...' : '🔮 توقع النتيجة'}
              </Btn>
            </View>
            {loading && (
              <View style={{ alignItems: 'center', padding: 20 }}>
                <ActivityIndicator color={C.gold} size="large" />
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 10 }}>يحلل الذكاء الاصطناعي قضيتك...</Text>
              </View>
            )}
          </>
        )}

        {/* Step 3 — Results */}
        {step === 3 && result && (
          <>
            {result.aiPowered && (
              <View style={{ backgroundColor: C.green + '15', borderWidth: 1, borderColor: C.green + '30', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: C.green, fontSize: 12, fontWeight: '600' }}>✨ تحليل بالذكاء الاصطناعي</Text>
              </View>
            )}
            <Card C={C} style={{ marginBottom: 16, backgroundColor: '#1a1a2e', borderColor: '#2d2d44' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 20, textAlign: 'center' }}>📊 تقدير احتمالات النتيجة</Text>
              {[
                { label: 'فوز كامل ✅', val: result.win,    color: '#22C55E' },
                { label: 'تسوية 🤝',    val: result.settle, color: C.gold },
                { label: 'خسارة ❌',    val: result.lose,   color: '#EF4444' },
              ].map(r => (
                <View key={r.label} style={{ marginBottom: 18 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ color: '#ccc', fontSize: 13 }}>{r.label}</Text>
                    <Text style={{ color: r.color, fontWeight: '800', fontSize: 20 }}>{r.val}%</Text>
                  </View>
                  <View style={{ backgroundColor: '#333', borderRadius: 6, height: 12, overflow: 'hidden' }}>
                    <View style={{ width: `${r.val}%` as any, height: '100%', backgroundColor: r.color, borderRadius: 6 }} />
                  </View>
                </View>
              ))}
            </Card>

            <Card C={C} style={{ marginBottom: 16 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>💡 التوصية</Text>
              <Text style={{ color: C.muted, fontSize: 13, lineHeight: 22 }}>
                {result.win >= 60
                  ? 'موقفك قوي. ننصحك بتوكيل محامٍ متخصص لتعظيم فرص الفوز واستكمال الأدلة قبل الجلسة الأولى.'
                  : result.win >= 40
                  ? 'الوضع متوازن. فكّر في التسوية الودية أو تقوية أدلتك. المحامي الجيد قد يحسّن نتيجتك كثيراً.'
                  : 'الوضع صعب. استشارة محامٍ خبير أمر ضروري. قد تكون التسوية الخيار الأفضل.'}
              </Text>
            </Card>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn C={C} full onPress={() => router.push('/lawyers' as any)}>⚖️ ابحث عن محامٍ</Btn>
              <Btn C={C} full variant="ghost" onPress={reset}>🔄 تحليل جديد</Btn>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
