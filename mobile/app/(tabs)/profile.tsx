// ─── Wakeel Client Profile — Premium LinkedIn-style redesign ─────────────────
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  RefreshControl, Alert, Platform, FlatList, Switch, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme, toggleTheme, isDark } from '../../src/theme';
import { Share } from 'react-native';
import { hapticLight, hapticSelect } from '../../src/utils/haptics';
import { useAuth } from '../../src/hooks/useAuth';
import { Avatar, Tag, Btn, Section, Card, Spinner } from '../../src/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_CASES = [
  {
    id: 1, lawyerId: 1, lawyerName: 'Dr. Ahmed Hassan', lawyerInitials: 'AH',
    type: 'Criminal Defense', status: 'Active',
    date: '2025-02-10', nextSession: '2025-03-10',
    notes: 'Initial consultation completed. Gathering evidence.',
    docs: ['Contract_v1.pdf', 'ID_Copy.jpg'],
    timeline: [
      { date: '2025-02-10', event: 'Case Opened',         detail: 'Initial consultation with Dr. Ahmed Hassan.',         done: true  },
      { date: '2025-02-15', event: 'Documents Submitted', detail: 'Client submitted ID, contracts, and evidence files.', done: true  },
      { date: '2025-02-28', event: 'Court Filing',         detail: 'Case filed at Cairo Criminal Court.',               done: true  },
      { date: '2025-03-10', event: 'First Hearing',        detail: 'Scheduled hearing — preparation in progress.',      done: false },
      { date: '2025-04-01', event: 'Final Verdict',        detail: 'Expected ruling date.',                             done: false },
    ],
  },
  {
    id: 2, lawyerId: 2, lawyerName: 'Dr. Nadia El-Masri', lawyerInitials: 'NE',
    type: 'Divorce Proceedings', status: 'Completed',
    date: '2024-11-01', nextSession: null,
    notes: 'Case resolved. Divorce finalized.',
    docs: ['Court_Order.pdf'],
    timeline: [
      { date: '2024-11-01', event: 'Case Opened',   detail: 'Divorce consultation.',                          done: true },
      { date: '2024-11-20', event: 'Mediation',      detail: 'Mediation session completed.',                  done: true },
      { date: '2024-12-10', event: 'Court Hearing',  detail: 'Hearing at Family Court, Alexandria.',          done: true },
      { date: '2025-01-05', event: 'Case Closed',    detail: 'Divorce finalized. Case resolved successfully.',done: true },
    ],
  },
];

const DEMO_MESSAGES = [
  { lawyerId: 1, lawyerName: 'Dr. Ahmed Hassan',   lawyerInitials: 'AH', lastMsg: 'Please review the documents I uploaded.', time: '10:07 AM', unread: 2 },
  { lawyerId: 2, lawyerName: 'Dr. Nadia El-Masri', lawyerInitials: 'NE', lastMsg: "Hello! I'll be ready for our session.",    time: 'Yesterday', unread: 0 },
];

const DEMO_PAYMENTS = [
  { id: 1, lawyer: 'Dr. Ahmed Hassan',   date: '2025-03-05', amount: 550, status: 'paid', method: '💳 Card',     lawyerInitials: 'AH' },
  { id: 2, lawyer: 'Dr. Nadia El-Masri', date: '2025-02-10', amount: 800, status: 'paid', method: '📱 Vodafone', lawyerInitials: 'NE' },
];

const DOC_CHECKLISTS: Record<number, { name: string; items: string[] }> = {
  1: { name: 'Criminal Defense', items: ['Valid National ID', 'Police report', 'Witness contacts', 'Evidence photos', 'Prior legal records', 'Employment letter', 'Medical reports'] },
  2: { name: 'Family Law',       items: ['Marriage certificate', 'National IDs', "Children's birth certificates", 'Property deeds', 'Bank statements', 'Proof of income', 'Custody evidence'] },
};

const EXPENSE_CATS = ['Consultation', 'Court Fees', 'Document Prep', 'Translation', 'Travel', 'Other'];

// ─── Animated Stat Chip ───────────────────────────────────────────────────────
function StatChip({ value, label, color, icon, delay }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay, useNativeDriver: true, tension: 80, friction: 8 }).start();
  }, []);
  return (
    <Animated.View style={{ flex: 1, alignItems: 'center', opacity: anim, transform: [{ scale: anim }] }}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ color, fontSize: 22, fontWeight: '800', fontFamily: 'CormorantGaramond-Bold', marginTop: 4 }}>{value}</Text>
      <Text style={{ color: '#888', fontSize: 11, marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </Animated.View>
  );
}

// ─── CaseTimeline ─────────────────────────────────────────────────────────────
function CaseTimeline({ caseData, C }: any) {
  const [fileName, setFileName] = useState('');
  const [uploaded, setUploaded]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const doUpload = () => { if (!fileName.trim()) return; setUploading(true); setTimeout(() => { setUploading(false); setUploaded(true); }, 1600); };
  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20, marginTop: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>📍 Case Timeline</Text>
        <Tag C={C} color={caseData.status === 'Active' ? C.green : C.accent}>{caseData.status}</Tag>
      </View>
      <View style={{ paddingLeft: 20, position: 'relative' }}>
        <View style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, backgroundColor: C.border }} />
        {caseData.timeline.map((step: any, i: number) => (
          <View key={i} style={{ position: 'relative', marginBottom: 20 }}>
            <View style={{ position: 'absolute', left: -20, top: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: step.done ? C.gold : C.border, borderWidth: 2, borderColor: step.done ? C.goldD : C.dim, alignItems: 'center', justifyContent: 'center' }}>
              {step.done && <Text style={{ color: '#000', fontSize: 8, fontWeight: '700' }}>✓</Text>}
            </View>
            <View style={{ paddingLeft: 8 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                <Text style={{ color: step.done ? C.text : C.muted, fontWeight: step.done ? '700' : '400', fontSize: 14 }}>{step.event}</Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>{step.date}</Text>
                {!step.done && <Tag C={C} color={C.warn}>Upcoming</Tag>}
              </View>
              <Text style={{ color: C.muted, fontSize: 12, lineHeight: 18 }}>{step.detail}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16, marginTop: 4 }}>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', marginBottom: 12 }}>📎 Upload Document</Text>
        {!uploaded ? (
          <>
            <View style={{ borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>📁</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>PDF, JPG, PNG up to 10MB</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={fileName} onChangeText={setFileName} placeholder="Type filename..." placeholderTextColor={C.muted}
                style={{ flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: C.text, fontSize: 13 }} />
              <Btn C={C} onPress={doUpload} disabled={!fileName || uploading} size="md">{uploading ? '⏳' : 'Upload'}</Btn>
            </View>
          </>
        ) : (
          <View style={{ backgroundColor: `${C.green}10`, borderWidth: 1, borderColor: `${C.green}30`, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>✅</Text>
            <View>
              <Text style={{ color: C.green, fontWeight: '700', fontSize: 14 }}>Document uploaded successfully</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{fileName} • Shared with your lawyer</Text>
            </View>
          </View>
        )}
        {caseData.docs?.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>Existing documents</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {caseData.docs.map((d: string) => (
                <View key={d} style={{ backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 12, color: C.accent }}>📄 {d}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── DocChecklist ─────────────────────────────────────────────────────────────
function DocChecklist({ caseId, C }: any) {
  const checklist = DOC_CHECKLISTS[caseId] || DOC_CHECKLISTS[1];
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const done = Object.values(checked).filter(Boolean).length;
  const total = checklist.items.length;
  const pct = total > 0 ? done / total : 0;
  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20, marginTop: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>📋 Document Checklist</Text>
        <Tag C={C} color={done === total ? C.green : C.warn}>{done}/{total} ready</Tag>
      </View>
      <View style={{ backgroundColor: C.border, borderRadius: 4, height: 6, marginBottom: 16 }}>
        <View style={{ backgroundColor: C.gold, width: `${pct * 100}%` as any, height: '100%', borderRadius: 4 }} />
      </View>
      {checklist.items.map((item, i) => (
        <TouchableOpacity key={i} onPress={() => setChecked(c => ({ ...c, [i]: !c[i] }))}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8, borderBottomWidth: i < total - 1 ? 1 : 0, borderBottomColor: C.border }}>
          <View style={{ width: 20, height: 20, borderRadius: 4, marginTop: 1, backgroundColor: checked[i] ? C.gold : 'transparent', borderWidth: 2, borderColor: checked[i] ? C.gold : C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {checked[i] && <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>✓</Text>}
          </View>
          <Text style={{ flex: 1, color: checked[i] ? C.muted : C.text, fontSize: 13, lineHeight: 20, textDecorationLine: checked[i] ? 'line-through' : 'none' }}>{item}</Text>
        </TouchableOpacity>
      ))}
      {done === total && (
        <View style={{ backgroundColor: `${C.green}10`, borderWidth: 1, borderColor: `${C.green}30`, borderRadius: 10, padding: 12, marginTop: 14, alignItems: 'center' }}>
          <Text style={{ color: C.green, fontWeight: '700', fontSize: 13 }}>✅ All documents ready!</Text>
        </View>
      )}
    </View>
  );
}

// ─── ExpenseTracker ───────────────────────────────────────────────────────────
function ExpenseTracker({ C }: any) {
  const [expenses, setExpenses] = useState([
    { id: 1, desc: 'Initial Consultation - Dr. Ahmed Hassan', amount: 550, date: '2025-02-10', cat: 'Consultation' },
    { id: 2, desc: 'Court Filing Fee',                        amount: 200, date: '2025-02-15', cat: 'Court Fees'   },
    { id: 3, desc: 'Document Translation',                    amount: 150, date: '2025-02-20', cat: 'Other'        },
  ]);
  const [newDesc, setNewDesc] = useState('');
  const [newAmt,  setNewAmt]  = useState('');
  const [newCat,  setNewCat]  = useState('Consultation');
  const [showCats, setShowCats] = useState(false);
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  const addExpense = () => {
    if (!newDesc || !newAmt) return;
    setExpenses(e => [...e, { id: Date.now(), desc: newDesc, amount: +newAmt, date: new Date().toISOString().slice(0, 10), cat: newCat }]);
    setNewDesc(''); setNewAmt('');
  };
  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20, marginTop: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>💸 Case Expenses</Text>
        <Text style={{ color: C.gold, fontWeight: '700', fontSize: 20, fontFamily: 'CormorantGaramond-Bold' }}>{total} EGP</Text>
      </View>
      {expenses.map(e => (
        <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, backgroundColor: C.card2, borderRadius: 9, marginBottom: 8 }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ color: C.text, fontSize: 13 }}>{e.desc}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <Text style={{ color: C.muted, fontSize: 11 }}>{e.date}</Text>
              <Tag C={C} color={C.accent}>{e.cat}</Tag>
            </View>
          </View>
          <Text style={{ color: C.gold, fontWeight: '700', fontSize: 14 }}>{e.amount} EGP</Text>
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
        <Text style={{ color: C.muted, fontSize: 12 }}>Add Expense</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
        <TextInput value={newDesc} onChangeText={setNewDesc} placeholder="Description..." placeholderTextColor={C.muted}
          style={{ flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, color: C.text, fontSize: 13 }} />
        <TextInput value={newAmt} onChangeText={setNewAmt} placeholder="EGP" placeholderTextColor={C.muted} keyboardType="numeric"
          style={{ width: 72, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9, color: C.text, fontSize: 13 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity onPress={() => setShowCats(!showCats)}
          style={{ flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: C.muted, fontSize: 13 }}>{newCat}</Text>
          <Text style={{ color: C.muted }}>▾</Text>
        </TouchableOpacity>
        <Btn C={C} onPress={addExpense} disabled={!newDesc || !newAmt} size="sm">+ Add</Btn>
      </View>
      {showCats && (
        <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginTop: 6, overflow: 'hidden' }}>
          {EXPENSE_CATS.map(cat => (
            <TouchableOpacity key={cat} onPress={() => { setNewCat(cat); setShowCats(false); }}
              style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.text, fontSize: 13 }}>{cat}</Text>
              {newCat === cat && <Text style={{ color: C.gold }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── MAIN ProfileTab ──────────────────────────────────────────────────────────
export default function ProfileTab() {
  const C = useTheme();
  const { t, isRTL } = useI18n();
  const [dark, setDark] = React.useState(isDark());
  const { user, isLawyer, isAdmin, logout, initials } = useAuth();
  const insets = useSafeAreaInsets();

  const [tab, setTab]                     = useState<'cases' | 'messages' | 'payments'>('cases');
  const [cases, setCases]                 = useState(DEMO_CASES);
  const [expandedCase, setExpandedCase]   = useState<number | null>(null);
  const [caseSubTab, setCaseSubTab]       = useState<Record<number, 'timeline' | 'checklist' | 'expenses'>>({});
  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null);
  const [refreshing, setRefreshing]       = useState(false);

  const serif     = { fontFamily: 'CormorantGaramond-Bold' };
  const activeCount = cases.filter(c => c.status === 'Active').length;
  const totalSpent  = DEMO_PAYMENTS.reduce((a, p) => a + p.amount, 0);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
  };

  if (isAdmin) return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ fontSize: 48 }}>🛡️</Text>
      <Text style={{ ...serif, color: C.text, fontSize: 22, fontWeight: '700' }}>Admin Panel</Text>
      <Btn C={C} size="lg" onPress={() => router.push('/admin/index' as any)}>Open Admin Panel</Btn>
      <TouchableOpacity onPress={handleLogout} style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: C.red + '15', borderRadius: 12, borderWidth: 1, borderColor: C.red + '40' }}>
        <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLawyer) return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Text style={{ fontSize: 48 }}>⚖️</Text>
      <Text style={{ ...serif, color: C.text, fontSize: 22, fontWeight: '700' }}>Lawyer Dashboard</Text>
      <Btn C={C} size="lg" onPress={() => router.push('/(lawyer-tabs)/' as any)}>Open Dashboard</Btn>
      <TouchableOpacity onPress={handleLogout} style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: C.red + '15', borderRadius: 12, borderWidth: 1, borderColor: C.red + '40' }}>
        <Text style={{ color: C.red, fontWeight: '700', fontSize: 13 }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO COVER ── */}
        <View>
          {/* Gold gradient cover band */}
          <View style={{ height: 140, backgroundColor: C.gold, overflow: 'hidden' }}>
            {/* Decorative overlay rings */}
            <View style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: '#fff', opacity: 0.06 }} />
            <View style={{ position: 'absolute', right: 40, top: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff', opacity: 0.05 }} />
            <View style={{ position: 'absolute', left: -30, bottom: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: '#000', opacity: 0.08 }} />
            {/* Top-right action buttons */}
            <View style={{ position: 'absolute', top: insets.top + 12, right: 16, flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => Share.share({ title: `${user?.name || 'وكيل'} على تطبيق وكيل`, message: `🏛️ تواصل مع ${user?.name || 'مستخدم وكيل'} عبر منصة وكيل للمحامين المعتمدين في مصر.\nhttps://wakeel-api.onrender.com` })}
                style={{ backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>📤 Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/edit-profile' as any)}
                style={{ backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✏️ Edit</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar overlapping cover */}
          <View style={{ position: 'absolute', bottom: -44, left: 20 }}>
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: C.gold + '30', borderWidth: 4, borderColor: C.bg, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 }}>
              <Text style={{ fontSize: 30, fontWeight: '800', color: C.gold, fontFamily: 'CormorantGaramond-Bold' }}>
                {initials || 'CL'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── NAME + SUBTITLE ── */}
        <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ ...serif, color: C.text, fontSize: 24, fontWeight: '800' }}>{user?.name || 'مستخدم وكيل'}</Text>
          <Text style={{ color: C.muted, fontSize: 13, marginTop: 3 }}>
            {isRTL ? 'عميل مسجل · منصة وكيل للمحامين' : 'Registered Client · Wakeel Legal Platform'}
          </Text>

          {/* ── STAT CHIPS ── */}
          <View style={{ flexDirection: 'row', marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: C.border }}>
            <StatChip value={cases.length}     label={isRTL ? 'القضايا' : 'Cases'}         color={C.gold}    icon="📋" delay={0}   />
            <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 4 }} />
            <StatChip value={activeCount}      label={isRTL ? 'نشطة' : 'Active'}           color={C.green}   icon="⚡" delay={80}  />
            <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 4 }} />
            <StatChip value={`${totalSpent}₩`} label={isRTL ? 'المدفوعات' : 'Spent (EGP)'} color={C.accent}  icon="💳" delay={160} />
          </View>
        </View>

        {/* ── PILL TABS ── */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16 }}>
          {([['cases', '📋', isRTL ? 'القضايا' : 'Cases'], ['messages', '💬', isRTL ? 'الرسائل' : 'Messages'], ['payments', '💳', isRTL ? 'المدفوعات' : 'Payments']] as const).map(([id, icon, label]) => (
            <TouchableOpacity key={id} onPress={() => setTab(id as any)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 24, backgroundColor: tab === id ? C.gold : C.card, borderWidth: 1, borderColor: tab === id ? C.gold : C.border }}>
              <Text style={{ fontSize: 14 }}>{icon}</Text>
              <Text style={{ color: tab === id ? '#fff' : C.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>

          {/* ══ CASES TAB ══ */}
          {tab === 'cases' && (
            <View style={{ gap: 14 }}>
              {cases.map(c => {
                const expanded  = expandedCase === c.id;
                const subTab    = caseSubTab[c.id] || 'timeline';
                const canCancel = c.nextSession ? (new Date(c.nextSession).getTime() - Date.now()) / 3_600_000 > 12 : false;
                const isActive  = c.status === 'Active';
                const isDone    = c.status === 'Completed';
                return (
                  <View key={c.id} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden' }}>
                    {/* Status bar accent */}
                    <View style={{ height: 4, backgroundColor: isActive ? C.green : isDone ? C.gold : C.border }} />
                    <View style={{ padding: 20 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                          <Avatar C={C} initials={c.lawyerInitials} size={46} />
                          <View>
                            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{c.type}</Text>
                            <Text style={{ color: C.muted, fontSize: 13, marginTop: 1 }}>{c.lawyerName}</Text>
                            <Tag C={C} color={isActive ? C.green : C.accent} style={{ marginTop: 4 }}>{c.status}</Tag>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: C.muted, fontSize: 12 }}>Started: {c.date}</Text>
                          {c.nextSession && <Text style={{ color: C.gold, fontSize: 12, marginTop: 2 }}>Next: {c.nextSession}</Text>}
                        </View>
                      </View>
                      <View style={{ backgroundColor: C.card2, borderRadius: 10, padding: 12, marginBottom: 14 }}>
                        <Text style={{ color: C.muted, fontSize: 13, lineHeight: 19 }}>{c.notes}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                        <Btn C={C} variant="ghost" size="sm" onPress={() => router.push(c.convId ? `/messages?convId=${c.convId}` : '/messages/index' as any)}>💬 Message</Btn>
                        {isActive && <Btn C={C} variant="accent" size="sm" onPress={() => router.push('/video' as any)}>📹 Join Call</Btn>}
                        {isDone && <Btn C={C} variant="ghost" size="sm">⭐ Review</Btn>}
                        <Btn C={C} variant="dark" size="sm" onPress={() => setExpandedCase(expanded ? null : c.id)}>
                          {expanded ? '▲ Hide' : '▼ Details'}
                        </Btn>
                        {isActive && c.nextSession && (() => {
                          if (cancelConfirm === c.id) return (
                            <View style={{ width: '100%', backgroundColor: `${C.red}08`, borderWidth: 1.5, borderColor: C.red, borderRadius: 10, padding: 14, marginTop: 4 }}>
                              <Text style={{ color: C.red, fontWeight: '600', fontSize: 13, marginBottom: 6 }}>Cancel this booking and get a full refund?</Text>
                              <Text style={{ color: C.muted, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>Refund within 3-5 business days.</Text>
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity onPress={() => { setCases(prev => prev.map(x => x.id === c.id ? { ...x, status: 'Cancelled' } : x)); setCancelConfirm(null); }}
                                  style={{ flex: 1, backgroundColor: C.red, borderRadius: 8, padding: 10, alignItems: 'center' }}>
                                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Yes, Cancel & Refund</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setCancelConfirm(null)}
                                  style={{ flex: 1, backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, alignItems: 'center' }}>
                                  <Text style={{ color: C.muted, fontSize: 13 }}>Keep Booking</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                          return (
                            <Btn C={C} variant={canCancel ? 'danger' : 'ghost'} size="sm"
                              onPress={() => { if (!canCancel) { Alert.alert('❌', 'Cannot cancel within 12 hours.'); return; } setCancelConfirm(c.id); }}
                              style={{ opacity: canCancel ? 1 : 0.5 }}>
                              {canCancel ? '🔴 Cancel & Refund' : '⏱ <12h No Refund'}
                            </Btn>
                          );
                        })()}
                      </View>
                    </View>
                    {expanded && (
                      <View style={{ paddingHorizontal: 20, paddingBottom: 20, borderTopWidth: 1, borderTopColor: C.border }}>
                        <View style={{ flexDirection: 'row', gap: 3, marginTop: 16, marginBottom: 4, backgroundColor: C.bg, borderRadius: 10, padding: 3 }}>
                          {([['timeline', '📍 Timeline'], ['checklist', '📋 Checklist'], ['expenses', '💸 Expenses']] as const).map(([id, label]) => (
                            <TouchableOpacity key={id} onPress={() => setCaseSubTab(prev => ({ ...prev, [c.id]: id }))}
                              style={{ flex: 1, backgroundColor: subTab === id ? C.card : 'transparent', borderWidth: 1, borderColor: subTab === id ? C.border : 'transparent', borderRadius: 8, paddingVertical: 7, alignItems: 'center' }}>
                              <Text style={{ color: subTab === id ? C.text : C.muted, fontSize: 12, fontWeight: subTab === id ? '700' : '400' }}>{label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {subTab === 'timeline'  && <CaseTimeline  caseData={c} C={C} />}
                        {subTab === 'checklist' && <DocChecklist  caseId={c.lawyerId} C={C} />}
                        {subTab === 'expenses'  && <ExpenseTracker C={C} />}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ══ MESSAGES TAB ══ */}
          {tab === 'messages' && (
            <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden' }}>
              {DEMO_MESSAGES.map((m: { lawyerId: number; lawyerName: string; lawyerInitials: string; lastMsg: string; time: string; unread: number; convId?: string }) => (
                <TouchableOpacity key={m.lawyerId} onPress={() => router.push(m.convId ? `/messages?convId=${m.convId}` : '/messages/index' as any)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Avatar C={C} initials={m.lawyerInitials} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{m.lawyerName}</Text>
                      <Text style={{ color: C.muted, fontSize: 11 }}>{m.time}</Text>
                    </View>
                    <Text style={{ color: C.muted, fontSize: 12 }} numberOfLines={1}>{m.lastMsg}</Text>
                  </View>
                  {m.unread > 0 && (
                    <View style={{ backgroundColor: C.gold, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                      <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>{m.unread}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ══ PAYMENTS TAB ══ */}
          {tab === 'payments' && (
            <View style={{ gap: 10 }}>
              {DEMO_PAYMENTS.map(p => (
                <View key={p.id} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                    <View>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{p.lawyer}</Text>
                      <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{p.date} • {p.method}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={{ ...serif, color: C.gold, fontWeight: '700', fontSize: 20 }}>{p.amount} EGP</Text>
                      <Tag C={C} color={C.green}>✓ {p.status}</Tag>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Btn C={C} variant="ghost" size="sm" style={{ flex: 1 }}>🖨️ Receipt</Btn>
                    <Btn C={C} variant="danger" size="sm" style={{ flex: 1 }}>💸 Refund</Btn>
                  </View>
                </View>
              ))}
              <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontSize: 14 }}>Total Spent</Text>
                <Text style={{ ...serif, color: C.gold, fontWeight: '700', fontSize: 20 }}>{totalSpent} EGP</Text>
              </View>
            </View>
          )}

          {/* ══ SETTINGS SECTION ══ */}
          <View style={{ marginTop: 32, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden' }}>
            <Text style={{ ...serif, color: C.text, fontSize: 16, fontWeight: '700', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
              ⚙️ {isRTL ? 'الإعدادات' : 'Settings'}
            </Text>
            {/* Dark mode */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 22 }}>{dark ? '🌙' : '☀️'}</Text>
                <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{dark ? (isRTL ? 'الوضع الداكن' : 'Dark Mode') : (isRTL ? 'الوضع الفاتح' : 'Light Mode')}</Text>
              </View>
              <Switch value={dark} onValueChange={() => { toggleTheme(); setDark(!dark); hapticSelect(); }} trackColor={{ true: C.gold }} thumbColor="#fff" />
            </View>
            {/* Referral */}
            <TouchableOpacity onPress={() => router.push('/referral' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontSize: 22 }}>🎁</Text>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{isRTL ? 'الإحالات والمكافآت' : 'Referrals & Rewards'}</Text>
              <Text style={{ color: C.muted }}>›</Text>
            </TouchableOpacity>
            {/* Support */}
            <TouchableOpacity onPress={() => router.push('/support' as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ fontSize: 22 }}>💬</Text>
              <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{isRTL ? 'الدعم الفني' : 'Support'}</Text>
              <Text style={{ color: C.muted }}>›</Text>
            </TouchableOpacity>
            {/* Sign out */}
            <TouchableOpacity onPress={handleLogout} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
              <Text style={{ fontSize: 22 }}>🚪</Text>
              <Text style={{ color: C.red, fontSize: 14, fontWeight: '700', flex: 1 }}>{isRTL ? 'تسجيل الخروج' : 'Sign Out'}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
