// ─── Wakeel Client Profile — Premium LinkedIn-style redesign ─────────────────
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  RefreshControl, Alert, Platform, FlatList, Switch, Animated, ActivityIndicator, Modal, I18nManager,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme, toggleTheme, isDark } from '../../src/theme';
import { Share, Image } from 'react-native';
import { hapticLight, hapticSelect } from '../../src/utils/haptics';
import { useAuth } from '../../src/hooks/useAuth';
import { Avatar, Tag, Btn, Section, Card, Spinner } from '../../src/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';
import { forumAPI, bookingsAPI, favoritesAPI } from '../../src/services/api';

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_CASES: any[] = [
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
      <Text style={{ color, fontSize: 22, fontWeight: '800', fontFamily: 'Cairo-Bold', marginTop: 4 }}>{value}</Text>
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
        <Text style={{ color: C.gold, fontWeight: '700', fontSize: 20, fontFamily: 'Cairo-Bold' }}>{total} EGP</Text>
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

  const [refreshing, setRefreshing]         = useState(false);

  const [savedPosts, setSavedPosts]         = useState<any[]>([]);
  const [savedLoaded, setSavedLoaded]       = useState(false);

  const [myPosts, setMyPosts]               = useState<any[]>([]);
  const [myPostsLoading, setMyPostsLoading] = useState(false);
  const [myPostsLoaded, setMyPostsLoaded]   = useState(false);

  const [upcomingBooking, setUpcomingBooking] = useState<any>(null);
  const [consultCount, setConsultCount]       = useState(0);
  const [favLawyers, setFavLawyers]           = useState<any[]>([]);

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

  const serif = { fontFamily: 'Cairo-Bold' };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const loadSavedPosts = useCallback(async () => {
    if (savedLoaded) return;
    try {
      const res: any = await forumAPI.getSavedPosts();
      setSavedPosts(res?.questions || []);
      setSavedLoaded(true);
    } catch { setSavedPosts([]); }
  }, [savedLoaded]);

  const loadMyPosts = useCallback(async () => {
    if (myPostsLoaded || !user?.id) return;
    setMyPostsLoading(true);
    try {
      const res: any = await forumAPI.getUserPosts(user.id);
      setMyPosts(res?.questions || []);
      setMyPostsLoaded(true);
    } catch { setMyPosts([]); }
    finally { setMyPostsLoading(false); }
  }, [myPostsLoaded, user?.id]);

  const loadBookings = useCallback(async () => {
    try {
      const res: any = await bookingsAPI.list();
      const all: any[] = res?.bookings || res || [];
      setConsultCount(all.length);
      const now = Date.now();
      const upcoming = all
        .filter((b: any) => ['confirmed','pending'].includes(b.status) && new Date(b.scheduled_at || b.date).getTime() > now)
        .sort((a: any, b: any) => new Date(a.scheduled_at || a.date).getTime() - new Date(b.scheduled_at || b.date).getTime());
      setUpcomingBooking(upcoming[0] || null);
    } catch { setUpcomingBooking(null); }
  }, []);

  const loadFavLawyers = useCallback(async () => {
    try {
      const res: any = await favoritesAPI.list();
      setFavLawyers(res?.favorites || res || []);
    } catch { setFavLawyers([]); }
  }, []);

  useEffect(() => {
    loadSavedPosts();
    loadMyPosts();
    loadBookings();
    loadFavLawyers();
  }, [loadSavedPosts, loadMyPosts, loadBookings, loadFavLawyers]);

  const handleUnsave = async (id: number) => {
    setSavedPosts(prev => prev.filter(p => p.id !== id));
    try { await forumAPI.savePost(id); } catch {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setSavedLoaded(false);
    setMyPostsLoaded(false);
    await Promise.all([loadBookings(), loadFavLawyers()]);
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
        {/* ── HERO COVER + AVATAR (Facebook style) ── */}
        <View>
          <View style={{ height: 150, backgroundColor: C.gold, overflow: 'hidden' }}>
            {user?.cover_url ? (
              <Image source={{ uri: user.cover_url }} style={{ width: '100%', height: '100%', position: 'absolute' }} />
            ) : (
              <>
                <View style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: '#fff', opacity: 0.07 }} />
                <View style={{ position: 'absolute', right: 60, top: -10, width: 120, height: 120, borderRadius: 60, backgroundColor: '#fff', opacity: 0.05 }} />
                <View style={{ position: 'absolute', left: -20, bottom: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: '#000', opacity: 0.07 }} />
              </>
            )}
            <View style={{ position: 'absolute', top: insets.top + 12, right: 16 }}>
              <TouchableOpacity onPress={() => setSettingsVisible(true)}
                style={{ backgroundColor: 'rgba(0,0,0,0.35)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>⚙️</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar — physical left, Facebook style */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              const uri = user?.avatar_url || user?.avatar;
              if (uri) setAvatarModalVisible(true);
              else router.push('/edit-profile' as any);
            }}
            style={{
              position: 'absolute',
              bottom: -44,
              right: isRTL ? 16 : undefined,
              left: isRTL ? undefined : 16,
            }}>
            {user?.avatar_url || user?.avatar ? (
              <Image source={{ uri: user.avatar_url || user.avatar }}
                style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 4, borderColor: C.bg }} />
            ) : (
              <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: C.gold, borderWidth: 4, borderColor: C.bg, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 }}>
                <Text style={{ fontSize: 30, fontWeight: '800', color: '#fff', fontFamily: 'Cairo-Bold' }}>{initials || 'CL'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── IDENTITY CARD ── */}
        <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 18, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
          {/* direction:'ltr' wrapper forces physical-left layout regardless of RTL */}
          <View style={{ direction: 'ltr' } as any}>
            <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', fontFamily: 'Cairo-Bold', letterSpacing: -0.3 }}>{user?.name || 'مستخدم وكيل'}</Text>
          </View>

          {/* Action pills */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <TouchableOpacity onPress={() => router.push('/edit-profile' as any)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.gold, borderWidth: 1.5, borderColor: C.gold }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#000' }}>{isRTL ? 'تعديل الملف' : 'Edit Profile'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { const msg = `${isRTL ? 'ملفي الشخصي على وكيل' : 'My profile on Wakeel'}: ${user?.name || ''}`; require('react-native').Share.share({ message: msg }); }}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.border }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{isRTL ? 'مشاركة الملف' : 'Share Profile'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/saved-posts' as any)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.border }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{isRTL ? 'المحفوظات' : 'Saved Posts'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── STATS BAR — numbers only, no emoji ── */}
        <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
          {[
            { value: myPosts.length,    label: isRTL ? 'منشوراتي' : 'Posts' },
            { value: consultCount,      label: isRTL ? 'استشارات' : 'Consults' },
            { value: savedPosts.length, label: isRTL ? 'محفوظات'  : 'Saved' },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 16,
              borderRightWidth: i < 2 ? 1 : 0, borderRightColor: C.border }}>
              <Text style={{ color: C.gold, fontSize: 22, fontWeight: '800', fontFamily: 'Cairo-Bold' }}>{s.value}</Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 2, fontWeight: '500' }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── UPCOMING CONSULTATION ── */}
        {upcomingBooking && (() => {
          const d = new Date(upcomingBooking.scheduled_at || upcomingBooking.date);
          const dateStr = d.toLocaleDateString('ar-EG', { weekday: 'long', month: 'short', day: 'numeric' });
          const timeStr = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
          const minsUntil = (d.getTime() - Date.now()) / 60000;
          const lawyerInitial = (upcomingBooking.lawyer_name || 'م').charAt(0).toUpperCase();
          return (
            <View style={{ marginHorizontal: 16, marginTop: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden' }}>
              <View style={{ height: 3, backgroundColor: C.gold }} />
              <View style={{ padding: 16 }}>
                <Text style={{ color: C.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 10 }}>
                  {isRTL ? 'الجلسة القادمة' : 'UPCOMING SESSION'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#000', fontSize: 17, fontWeight: '800' }}>{lawyerInitial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{upcomingBooking.lawyer_name || (isRTL ? 'المحامي' : 'Lawyer')}</Text>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{dateStr}  ·  {timeStr}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  {minsUntil < 30 && (
                    <TouchableOpacity onPress={() => router.push('/video' as any)}
                      style={{ flex: 1, backgroundColor: C.gold, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                      <Text style={{ color: '#000', fontWeight: '800', fontSize: 13 }}>{isRTL ? 'انضم للجلسة' : 'Join Session'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => router.push('/(tabs)/consults' as any)}
                    style={{ flex: 1, borderWidth: 1.5, borderColor: C.gold, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>{isRTL ? 'عرض التفاصيل' : 'View Details'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })()}

        {/* ── ACTIVITY — LinkedIn style ── */}
        <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, marginTop: 8 }}>

          {/* Section header */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center', height: 32 }}>
                <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', fontFamily: 'Cairo-Bold' }}>{isRTL ? 'النشاط' : 'Activity'}</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/forum' as any)} style={{ borderWidth: 1, borderColor: C.gold, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 }}>
                <Text style={{ color: C.gold, fontSize: 14, fontWeight: '700' }}>{isRTL ? 'إنشاء منشور' : 'Create a post'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {myPostsLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator color={C.gold} size="large" />
            </View>
          ) : (() => {
            // ── Smart content extraction ──────────────────────────────────────
            const posts = myPosts
              .map((p: any) => {
                let origData: any = null;
                try {
                  origData = p.original_post_data
                    ? (typeof p.original_post_data === 'string' ? JSON.parse(p.original_post_data) : p.original_post_data)
                    : null;
                } catch { origData = null; }

                const isRepostStr = p.question?.includes('[إعادة نشر من') || false;
                const isRepost = !!origData || p.question === 'مشاركة' || isRepostStr;

                // Strip out all chained repost tags like "[إعادة نشر من lawyer 1]:"
                const cleanCaption = p.question ? p.question.replace(/\[إعادة نشر من.*?\]:\s*/g, '').trim() : '';
                
                // If the user just typed "." or nothing, consider it empty so we show original post
                const userCaption = (cleanCaption && cleanCaption !== '.' && cleanCaption !== 'مشاركة') ? cleanCaption : null;
                const originalText = origData?.question ? origData.question.replace(/\[إعادة نشر من.*?\]:\s*/g, '').trim() : null;
                
                const displayText = userCaption || originalText;

                return { ...p, _isRepost: isRepost, _userCaption: userCaption, _origData: origData, _displayText: displayText };
              })
              .filter((p: any) => p._displayText && p._displayText.trim().length > 0);

            if (posts.length === 0) return (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center' }}>
                  {isRTL ? 'لا يوجد نشاط بعد · اطرح سؤالاً في المنتدى' : 'No activity yet · Ask a question in the forum'}
                </Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/forum' as any)}
                  style={{ marginTop: 14, backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 }}>
                  <Text style={{ color: '#000', fontWeight: '800', fontSize: 13 }}>{isRTL ? 'انتقل للمنتدى' : 'Go to Forum'}</Text>
                </TouchableOpacity>
              </View>
            );

            return (
              <>
                {posts.slice(0, 3).map((p: any, idx: number) => {
                  const diff = Date.now() - new Date(p.created_at).getTime();
                  const days = Math.floor(diff / 86400000);
                  const hours = Math.floor(diff / 3600000);
                  const mins = Math.floor(diff / 60000);
                  let ago = '';
                  if (days > 30) ago = Math.floor(days / 30) + (isRTL ? 'ش' : 'mo');
                  else if (days > 0) ago = days + (isRTL ? 'ي' : 'd');
                  else if (hours > 0) ago = hours + (isRTL ? 'س' : 'h');
                  else ago = mins + (isRTL ? 'د' : 'm');

                  const actionText = p._isRepost
                    ? (isRTL ? 'أعاد نشر هذا' : 'reposted this')
                    : (isRTL ? 'نشر هذا' : 'posted this');

                  return (
                    <TouchableOpacity key={p.id} activeOpacity={0.7}
                      onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } } as any)}
                      style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: C.border }}>

                      {/* Action label + timestamp — LinkedIn style */}
                      <View style={{ flexDirection: 'row-reverse', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>
                          {user?.name || ''} <Text style={{ color: C.muted, fontWeight: 'normal', fontSize: 13 }}>{actionText} • {ago}</Text>
                        </Text>
                      </View>

                      {/* Content preview — clean text */}
                      <Text style={{ color: C.text, fontSize: 15, lineHeight: 22, textAlign: 'right', fontFamily: 'Cairo-Regular' }} numberOfLines={3}>
                        {p._displayText}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Show all button — LinkedIn "Show all →" */}
                <TouchableOpacity
                  onPress={() => router.push('/all-activity' as any)}
                  style={{ borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>
                    {isRTL ? 'عرض الكل ←' : 'Show all →'}
                  </Text>
                </TouchableOpacity>
              </>
            );
          })()}

        </View>

      </ScrollView>


      {/* ══ AVATAR FULLSCREEN MODAL ══ */}
      <Modal visible={avatarModalVisible} transparent animationType="fade" onRequestClose={() => setAvatarModalVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}
          activeOpacity={1} onPress={() => setAvatarModalVisible(false)}>
          {(user?.avatar_url || user?.avatar) && (
            <Image
              source={{ uri: user.avatar_url || user.avatar }}
              style={{ width: 300, height: 300, borderRadius: 150 }}
              resizeMode="cover"
            />
          )}
          <Text style={{ color: '#fff', marginTop: 24, fontSize: 13, opacity: 0.6 }}>
            {isRTL ? 'اضغط في أي مكان للإغلاق' : 'Tap anywhere to close'}
          </Text>
        </TouchableOpacity>
      </Modal>

      {/* ══ SETTINGS MODAL ══ */}
      <Modal visible={settingsVisible} animationType="slide" transparent={true} onRequestClose={() => setSettingsVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ ...serif, color: C.text, fontSize: 20, fontWeight: '800' }}>{isRTL ? 'الإعدادات' : 'Settings'}</Text>
              <TouchableOpacity onPress={() => setSettingsVisible(false)} style={{ backgroundColor: C.card, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.text, fontSize: 20, fontWeight: '800' }}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ fontSize: 20 }}>{dark ? '🌙' : '☀️'}</Text>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{dark ? (isRTL ? 'الوضع الداكن' : 'Dark Mode') : (isRTL ? 'الوضع الفاتح' : 'Light Mode')}</Text>
                </View>
                <Switch value={dark} onValueChange={() => { toggleTheme(); setDark(!dark); hapticSelect(); }} trackColor={{ true: C.gold }} thumbColor="#fff" />
              </View>
              {[
                { icon: '🛡️', label: isRTL ? 'إعدادات الحساب' : 'Account Settings', route: '/account-settings' },
                { icon: '🔔', label: isRTL ? 'إعدادات الإشعارات' : 'Notifications',    route: '/notification-settings' },
                { icon: '✏️', label: isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile',    route: '/edit-profile' },
                { icon: '🎁', label: isRTL ? 'الإحالات والمكافآت' : 'Referrals',        route: '/referral' },
                { icon: '💬', label: isRTL ? 'الدعم الفني' : 'Support',                 route: '/support' },
              ].map((item, i, arr) => (
                <TouchableOpacity
                  key={item.route}
                  onPress={() => { setSettingsVisible(false); router.push(item.route as any); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: i < arr.length - 1 ? 1 : 1, borderBottomColor: C.border }}
                >
                  <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', flex: 1 }}>{item.label}</Text>
                  <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => { setSettingsVisible(false); handleLogout(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <Text style={{ fontSize: 20 }}>🚪</Text>
                <Text style={{ color: C.red, fontSize: 14, fontWeight: '700', flex: 1 }}>{isRTL ? 'تسجيل الخروج' : 'Sign Out'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

