// ─── Wakeel — Lawyer Outcome Tracker ─────────────────────────────────────────
// Route: /lawyer/outcome-tracker
// Track won/lost/settled/ongoing cases — verified by clients, shown on profile
// Matches OutcomeTrackerPage from wakeel-v2-preview-10.html
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { useI18n } from '../../src/i18n';
import { Gradient, GRADIENTS } from '../../src/components/Gradient';

type OutcomeId = 'won' | 'lost' | 'settled' | 'ongoing';

interface OutcomeEntry {
  id:      number;
  type:    string;
  outcome: OutcomeId;
  date:    string;
  desc:    string;
}

const OUTCOME_CONFIG: Record<OutcomeId, { label: string; color: string; bg: string; emoji: string }> = {
  won:     { label: 'فزنا ✅',   color: '#22C55E', bg: '#dcfce7', emoji: '✅' },
  settled: { label: 'تسوية 🤝', color: '#F59E0B', bg: '#fef3c7', emoji: '🤝' },
  lost:    { label: 'خسرنا ❌', color: '#EF4444', bg: '#fee2e2', emoji: '❌' },
  ongoing: { label: 'جارٍ ⚖️',  color: '#9A6F2A', bg: '#fef9ec', emoji: '⚖️' },
};

const INITIAL: OutcomeEntry[] = [
  { id:1, type:'جنائي', outcome:'won',     date:'2025-02-10', desc:'تبرئة في قضية احتيال' },
  { id:2, type:'أسرة',  outcome:'settled', date:'2025-01-20', desc:'حضانة مشتركة بالتراضي' },
  { id:3, type:'عمالي', outcome:'won',     date:'2025-03-01', desc:'تعويض فصل تعسفي 45,000 جنيه' },
  { id:4, type:'تجاري', outcome:'ongoing', date:'2025-03-10', desc:'نزاع عقاري لا يزال قيد النظر' },
];

export default function OutcomeTrackerScreen() {
  const C      = useTheme();
  const insets = useSafeAreaInsets();
  const { isRTL } = useI18n();
  const serif  = { fontFamily: 'CormorantGaramond-Bold' };

  const [outcomes, setOutcomes] = useState<OutcomeEntry[]>(INITIAL);
  const [showAdd,  setShowAdd]  = useState(false);
  const [form, setForm] = useState<{ type: string; outcome: OutcomeId; desc: string }>({ type: 'جنائي', outcome: 'won', desc: '' });

  const totalWins = outcomes.filter(o => o.outcome === 'won').length;
  const winRate   = outcomes.length > 0 ? Math.round((totalWins / outcomes.length) * 100) : 0;

  const addOutcome = () => {
    if (!form.desc.trim()) { Alert.alert('تنبيه', 'يرجى وصف القضية'); return; }
    setOutcomes(prev => [{
      ...form,
      id:   Date.now(),
      date: new Date().toISOString().slice(0, 10),
    }, ...prev]);
    setForm({ type: 'جنائي', outcome: 'won', desc: '' });
    setShowAdd(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: C.surface, paddingTop: insets.top + 10,
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.muted, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ ...serif, color: C.text, fontWeight: '700', fontSize: 18, flex: 1 }}>
          متتبع نتائج القضايا
        </Text>
        <TouchableOpacity onPress={() => setShowAdd(v => !v)}
          style={{ backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>+ نتيجة</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Stats banner — dark gradient matching reference */}
        <View style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          <Gradient colors={['#1a1a2e', '#2d2d44']} style={{ padding: 20, flexDirection: 'row', gap: 16 }}>
            {[
              [winRate + '%', 'نسبة الفوز',   C.gold   ],
              [totalWins,     'قضايا مكسوبة', '#22C55E'],
              [outcomes.length,'إجمالي',       '#fff'   ],
            ].map(([val, label, color], i) => (
              <React.Fragment key={label as string}>
                {i > 0 && <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />}
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ ...serif, color: color as string, fontWeight: '800', fontSize: 28 }}>{val as any}</Text>
                  <Text style={{ color: '#aaa', fontSize: 12, marginTop: 2 }}>{label as string}</Text>
                </View>
              </React.Fragment>
            ))}
          </Gradient>
        </View>

        {/* Trust notice */}
        <View style={{ backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac', borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <Text style={{ color: '#166534', fontSize: 12, lineHeight: 20 }}>
            ✅ هذه النتائج موثقة من عملاء حقيقيين — وليست أرقام ذاتية. هذا ما يجعل Wakeel مختلفاً.
          </Text>
        </View>

        {/* Add form */}
        {showAdd && (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.gold, borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>تسجيل نتيجة جديدة</Text>

            {/* Outcome selector */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {(Object.keys(OUTCOME_CONFIG) as OutcomeId[]).map(k => (
                <TouchableOpacity key={k} onPress={() => setForm(p => ({ ...p, outcome: k }))}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                    backgroundColor: form.outcome === k ? OUTCOME_CONFIG[k].bg : 'transparent',
                    borderWidth: 1, borderColor: form.outcome === k ? OUTCOME_CONFIG[k].color : C.border,
                  }}>
                  <Text style={{ color: OUTCOME_CONFIG[k].color, fontSize: 13, fontWeight: form.outcome === k ? '700' : '400' }}>
                    {OUTCOME_CONFIG[k].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              value={form.desc}
              onChangeText={v => setForm(p => ({ ...p, desc: v }))}
              placeholder="وصف مختصر للقضية..."
              placeholderTextColor={C.muted}
              style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 9, padding: 11, color: C.text, fontSize: 13, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={addOutcome} style={{ flex: 1, backgroundColor: C.gold, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>حفظ</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAdd(false)} style={{ flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                <Text style={{ color: C.text, fontSize: 14 }}>إلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Outcomes list */}
        {outcomes.map(o => {
          const cfg = OUTCOME_CONFIG[o.outcome];
          return (
            <View key={o.id} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: cfg.bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontSize: 22 }}>{cfg.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 3 }}>{o.desc}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>{o.type} · {o.date}</Text>
              </View>
              <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ color: cfg.color, fontSize: 11, fontWeight: '700' }}>{cfg.label}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
