// ─── Wakeel Lawyer Profile — Premium Redesign ─────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, Alert, Animated, Switch, Share } from 'react-native';
import { useTheme, toggleTheme, isDark } from '../../src/theme';
import { Avatar, Card, Badge, Btn, Empty } from '../../src/components/ui';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/hooks/useAuth';
import { useI18n } from '../../src/i18n';

// ─── Animated Stat Chip ───────────────────────────────────────────────────────
function StatChip({ value, label, color, icon, delay }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay, useNativeDriver: true, tension: 80, friction: 8 }).start();
  }, []);
  return (
    <Animated.View style={{ flex: 1, alignItems: 'center', opacity: anim, transform: [{ scale: anim }] }}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={{ color, fontSize: 20, fontWeight: '800', fontFamily: 'CormorantGaramond-Bold', marginTop: 4 }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </Animated.View>
  );
}

// ─── Tool Card ────────────────────────────────────────────────────────────────
function ToolCard({ icon, label, sublabel, onPress, C, color }: any) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 50 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50 }),
    ]).start();
    onPress?.();
  };
  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity onPress={press} activeOpacity={0.85}
        style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 18, alignItems: 'center', gap: 8, minHeight: 100, justifyContent: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: (color || C.gold) + '18', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 22 }}>{icon}</Text>
        </View>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, textAlign: 'center' }}>{label}</Text>
        {sublabel && <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center' }}>{sublabel}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Availability Calendar ────────────────────────────────────────────────────
function AvailabilityCalendar({ C, onBack, isRTL }: any) {
  const DAYS_AR  = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const DAYS_EN  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DAYS = isRTL ? DAYS_AR : DAYS_EN;
  const SLOTS = ['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
  const [sched, setSched] = useState<Record<number,string[]>>({
    0:[], 1:['9:00','10:00','11:00','14:00','15:00'],
    2:['9:00','10:00','11:00','14:00','15:00'], 3:['9:00','10:00','11:00'],
    4:['9:00','10:00','11:00','14:00','15:00'], 5:[], 6:[],
  });
  const [saved, setSaved] = useState(false);
  const toggle = (d: number, s: string) =>
    setSched(p => { const a=[...(p[d]||[])]; const i=a.indexOf(s); if(i>=0)a.splice(i,1);else a.push(s); setSaved(false); return {...p,[d]:a}; });
  const save = () => { setSaved(true); Alert.alert('✅', isRTL ? 'تم حفظ جدول العمل!' : 'Schedule saved!'); };
  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:12 }}>
        <TouchableOpacity onPress={onBack}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <View style={{ flex:1 }}>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>
            {isRTL ? 'تقويم التوفر' : 'Availability Calendar'}
          </Text>
          <Text style={{ color:C.muted, fontSize:12 }}>
            {isRTL ? 'حدد أوقات عملك الأسبوعية' : 'Set your weekly working hours'}
          </Text>
        </View>
        {saved && <Text style={{ color:C.green, fontSize:12, fontWeight:'600' }}>✅ {isRTL ? 'محفوظ' : 'Saved'}</Text>}
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        {DAYS.map((day, d) => {
          const daySlots = sched[d]||[]; const isOff = daySlots.length===0;
          return (
            <View key={d} style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14, marginBottom:10 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:isOff?0:12 }}>
                <Text style={{ color:C.text, fontWeight:'700', fontSize:14 }}>{day}</Text>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                  {isOff && <Text style={{ color:C.muted, fontSize:12 }}>{isRTL ? 'إجازة' : 'Off'}</Text>}
                  <TouchableOpacity onPress={()=>{setSched(p=>({...p,[d]:p[d]?.length?[]:['9:00','10:00','11:00','14:00','15:00']}));setSaved(false);}}
                    style={{ width:44, height:26, borderRadius:13, backgroundColor:isOff?C.border:C.gold, justifyContent:'center', alignItems:isOff?'flex-start':'flex-end', paddingHorizontal:3 }}>
                    <View style={{ width:20, height:20, borderRadius:10, backgroundColor:'#fff' }} />
                  </TouchableOpacity>
                </View>
              </View>
              {!isOff && <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>
                {SLOTS.map(slot => { const active=daySlots.includes(slot); return (
                  <TouchableOpacity key={slot} onPress={()=>toggle(d,slot)}
                    style={{ paddingHorizontal:10, paddingVertical:6, borderRadius:8, borderWidth:1, borderColor:active?C.gold:C.border, backgroundColor:active?C.gold:'transparent' }}>
                    <Text style={{ color:active?'#fff':C.text, fontSize:12 }}>{slot}</Text>
                  </TouchableOpacity>
                ); })}
              </View>}
            </View>
          );
        })}
        <Btn C={C} full onPress={save}>
          💾 {isRTL ? 'حفظ جدول العمل' : 'Save Schedule'}
        </Btn>
      </ScrollView>
    </View>
  );
}

// ─── Client CRM ───────────────────────────────────────────────────────────────
function ClientCRMPage({ C, onBack, isRTL }: any) {
  const CLIENTS = [
    { id:1, name:'Mohammed Ahmed', nameAr:'\u0645\u062d\u0645\u062f \u0623\u062d\u0645\u062f \u0639\u0644\u064a', phone:'01012345678', cases:3, lastContact:'2025-03-05', totalPaid:2400, urgency:'urgent' },
    { id:2, name:'Fatima Mahmoud', nameAr:'\u0641\u0627\u0637\u0645\u0629 \u0645\u062d\u0645\u0648\u062f', phone:'01098765432', cases:1, lastContact:'2025-02-20', totalPaid:650,  urgency:'normal' },
    { id:3, name:'Khaled Ibrahim', nameAr:'\u062e\u0627\u0644\u062f \u0625\u0628\u0631\u0627\u0647\u064a\u0645', phone:'01155667788', cases:2, lastContact:'2025-01-15', totalPaid:1200, urgency:'low'    },
  ];
  const [selected,setSelected]=useState<any>(null);
  const UC:Record<string,string>={urgent:C.red,normal:C.gold,low:C.green};
  const urgencyLabel = (u: string) => {
    if (u === 'urgent') return isRTL ? '\ud83d\udd34 \u0639\u0627\u062c\u0644'   : '\ud83d\udd34 Urgent';
    if (u === 'normal') return isRTL ? '\ud83d\udfe1 \u0639\u0627\u062f\u064a'   : '\ud83d\udfe1 Normal';
    return isRTL ? '\ud83d\udfe2 \u0645\u0631\u0646' : '\ud83d\udfe2 Flexible';
  };
  if (selected) return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:12 }}>
        <TouchableOpacity onPress={()=>setSelected(null)}><Text style={{ color:C.text, fontSize:22 }}>\u2039</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>{isRTL ? '\u0645\u0644\u0641 \u0627\u0644\u0639\u0645\u064a\u0644' : 'Client Profile'}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        <Card C={C} style={{ marginBottom:14 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:14 }}>
            <Avatar C={C} initials={(isRTL ? selected.nameAr : selected.name)[0]} size={52} />
            <View>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:16 }}>{isRTL ? selected.nameAr : selected.name}</Text>
              <Text style={{ color:UC[selected.urgency], fontSize:12, fontWeight:'600', marginTop:2 }}>{urgencyLabel(selected.urgency)}</Text>
            </View>
          </View>
          {[
            [isRTL ? '\ud83d\udcf1 \u0627\u0644\u0647\u0627\u062a\u0641' : '\ud83d\udcf1 Phone',       selected.phone],
            [isRTL ? '\u2696\ufe0f \u0627\u0644\u0642\u0636\u0627\u064a\u0627' : '\u2696\ufe0f Cases',    `${selected.cases}`],
            [isRTL ? '\ud83d\udcb0 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a' : '\ud83d\udcb0 Paid',      `${selected.totalPaid} EGP`],
            [isRTL ? '\ud83d\udcc5 \u0622\u062e\u0631 \u062a\u0648\u0627\u0635\u0644' : '\ud83d\udcc5 Last Contact', selected.lastContact],
          ].map(([k,v])=>(
            <View key={k as string} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.border }}>
              <Text style={{ color:C.muted, fontSize:13 }}>{k as string}</Text>
              <Text style={{ color:C.text, fontWeight:'600', fontSize:13 }}>{v as string}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:10 }}>
        <TouchableOpacity onPress={onBack}><Text style={{ color:C.text, fontSize:22 }}>\u2039</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>{isRTL ? '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621' : 'Client CRM'}</Text>
      </View>
      <FlatList data={CLIENTS} keyExtractor={item=>String(item.id)} contentContainerStyle={{ padding:16, paddingBottom:100 }}
        renderItem={({item:cl})=>(
          <TouchableOpacity onPress={()=>setSelected(cl)} style={{ flexDirection:'row', gap:12, alignItems:'center', backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14, marginBottom:10 }}>
            <Avatar C={C} initials={(isRTL ? cl.nameAr : cl.name)[0]} size={46} />
            <View style={{ flex:1 }}>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:14 }}>{isRTL ? cl.nameAr : cl.name}</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>{cl.cases} {isRTL ? '\u0642\u0636\u0627\u064a\u0627' : 'cases'} \u2022 {cl.totalPaid} EGP</Text>
            </View>
            <View style={{ width:8, height:8, borderRadius:4, backgroundColor:UC[cl.urgency] }} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}


// ─── Outcome Tracker ─────────────────────────────────────────────────────────
function OutcomeTrackerPage({ C, onBack }: any) {
  const [outcomes] = useState<any[]>([
    {id:1, type:'جنائي',  outcome:'won',     date:'2025-02-10', desc:'تبرئة في قضية احتيال'},
    {id:2, type:'أسرة',   outcome:'settled', date:'2025-01-20', desc:'حضانة مشتركة بالتراضي'},
  ]);
  const CFG: Record<string,any> = {
    won:     { label:'فزنا ✅',   color:'#22C55E', bg:'#DCFCE7' },
    settled: { label:'تسوية 🤝', color:'#F59E0B', bg:'#FEF3C7' },
  };
  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:10 }}>
        <TouchableOpacity onPress={onBack}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>متتبع نتائج القضايا</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:14, paddingBottom:80 }}>
        {outcomes.map(o => {
          const cfg = CFG[o.outcome];
          return (
            <View key={o.id} style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:12, padding:14, marginBottom:10, flexDirection:'row', gap:12, alignItems:'center' }}>
              <View style={{ flex:1 }}>
                <Text style={{ color:C.text, fontWeight:'700', fontSize:13 }}>{o.desc}</Text>
                <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{o.type} · {o.date}</Text>
              </View>
              <View style={{ backgroundColor:cfg.bg, borderRadius:8, paddingHorizontal:10, paddingVertical:4 }}>
                <Text style={{ color:cfg.color, fontSize:11, fontWeight:'700' }}>{cfg.label}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── MAIN Lawyer Profile ──────────────────────────────────────────────────────
export default function LawyerProfileTab() {
  const C = useTheme();
  const serif = { fontFamily: 'CormorantGaramond-Bold' };
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { isRTL } = useI18n();
  const [dark, setDark] = React.useState(isDark());
  const [online, setOnline] = useState(true);
  const [tab, setTab] = useState<'overview' | 'tools' | 'earnings'>('overview');
  const [subPage, setSubPage] = useState<null | 'calendar' | 'crm' | 'outcomes'>(null);

  const onlinePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!online) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(onlinePulse, { toValue: 1.4, duration: 800, useNativeDriver: true }),
        Animated.timing(onlinePulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [online]);

  const handleLogout = () => Alert.alert('Sign Out', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: logout },
  ]);

  if (subPage === 'calendar') return <AvailabilityCalendar C={C} isRTL={isRTL} onBack={() => setSubPage(null)} />;
  if (subPage === 'crm')      return <ClientCRMPage        C={C} isRTL={isRTL} onBack={() => setSubPage(null)} />;
  if (subPage === 'outcomes') return <OutcomeTrackerPage   C={C} isRTL={isRTL} onBack={() => setSubPage(null)} />;

  const initials = (user?.name || 'LA').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* ── DARK COVER ── */}
        <View>
          <View style={{ height: 160, backgroundColor: '#0F172A', overflow: 'hidden' }}>
            {/* Decorative rings */}
            <View style={{ position: 'absolute', left: -50, top: -50, width: 200, height: 200, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(200,168,75,0.2)' }} />
            <View style={{ position: 'absolute', left: -20, top: -20, width: 140, height: 140, borderRadius: 70,  borderWidth: 1, borderColor: 'rgba(200,168,75,0.12)' }} />
            <View style={{ position: 'absolute', right: -30, bottom: -40, width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
            <View style={{ position: 'absolute', right: 20, top: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(200,168,75,0.08)' }} />
            {/* Top-right action buttons */}
            <View style={{ position: 'absolute', top: insets.top + 12, right: 16, flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => Share.share({ title: `${user?.name || 'محامي'} | وكيل للمحامين`, message: `⚖️ ${user?.name || 'محامي معتمد'} — محامٍ معتمد متخصص في القانون الجنائي والتجاري.\nاحجز استشارتك عبر تطبيق وكيل: https://wakeel-api.onrender.com` })}
                style={{ backgroundColor: 'rgba(200,168,75,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(200,168,75,0.4)', flexDirection: 'row', alignItems: 'center', gap: 5 }}
              >
                <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700' }}>📤 Share</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/lawyer-setup' as any)}
                style={{ backgroundColor: 'rgba(200,168,75,0.2)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(200,168,75,0.4)' }}>
                <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700' }}>✏️ Edit</Text>
              </TouchableOpacity>
            </View>
            {/* Scale bar in cover */}
            <View style={{ position: 'absolute', bottom: 16, left: 120, flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(200,168,75,0.7)', fontSize: 22 }}>⚖️</Text>
              <Text style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>WAKEEL LAW</Text>
            </View>
          </View>

          {/* Avatar overlapping cover */}
          <View style={{ position: 'absolute', bottom: -48, left: 20 }}>
            {/* Gold verification ring */}
            <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#C8A84B', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a2035', shadowColor: '#C8A84B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 }}>
              <Text style={{ fontSize: 32, fontWeight: '800', color: '#C8A84B', fontFamily: 'CormorantGaramond-Bold' }}>{initials}</Text>
            </View>
            {/* Verified badge */}
            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#C8A84B', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✓</Text>
            </View>
          </View>
        </View>

        {/* ── NAME + INFO ── */}
        <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...serif, color: C.text, fontSize: 22, fontWeight: '800' }}>{user?.name || 'Dr. Lawyer'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={{ backgroundColor: '#C8A84B22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#C8A84B44' }}>
                  <Text style={{ color: '#C8A84B', fontSize: 11, fontWeight: '700' }}>⚖️ Verified Lawyer</Text>
                </View>
              </View>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>قانون جنائي وتجاري · القاهرة</Text>
            </View>

            {/* Online toggle */}
            <TouchableOpacity onPress={() => setOnline(o => !o)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: online ? '#22C55E18' : C.card, borderWidth: 1, borderColor: online ? '#22C55E50' : C.border }}>
              <View style={{ position: 'relative', width: 10, height: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: online ? '#22C55E' : C.muted }} />
                {online && (
                  <Animated.View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E40', transform: [{ scale: onlinePulse }] }} />
                )}
              </View>
              <Text style={{ color: online ? '#22C55E' : C.muted, fontSize: 12, fontWeight: '700' }}>{online ? 'Online' : 'Offline'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── DARK STATS STRIP ── */}
          <View style={{ backgroundColor: '#0F172A', borderRadius: 16, padding: 20, marginTop: 20, flexDirection: 'row' }}>
            <StatChip value="92%"  label="Win Rate"   color="#22C55E" icon="🏆" delay={0}   />
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 }} />
            <StatChip value="18"   label="Years Exp." color="#C8A84B" icon="📅" delay={80}  />
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 }} />
            <StatChip value="4.9⭐" label="312 Reviews" color="#F59E0B" icon="📝" delay={160} />
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 4 }} />
            <StatChip value="1,200" label="EGP/hr"     color="#818CF8" icon="💰" delay={240} />
          </View>
        </View>

        {/* ── PILL TABS ── */}
        <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16 }}>
          {([['overview', '📊', 'Overview'], ['tools', '🛠️', 'Tools'], ['earnings', '💰', 'Earnings']] as const).map(([id, icon, label]) => (
            <TouchableOpacity key={id} onPress={() => setTab(id as any)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 24, backgroundColor: tab === id ? '#0F172A' : C.card, borderWidth: 1, borderColor: tab === id ? '#C8A84B66' : C.border }}>
              <Text style={{ fontSize: 14 }}>{icon}</Text>
              <Text style={{ color: tab === id ? '#C8A84B' : C.muted, fontSize: 12, fontWeight: '700' }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>

          {/* ══ OVERVIEW TAB ══ */}
          {tab === 'overview' && (
            <View style={{ gap: 14 }}>
              {/* Win Rate Bar */}
              <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ ...serif, color: C.text, fontSize: 16, fontWeight: '700' }}>Profile Stats</Text>
                  <Text style={{ color: '#22C55E', fontWeight: '800', fontSize: 18 }}>92%</Text>
                </View>
                <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4, marginBottom: 12 }}>
                  <View style={{ height: 8, width: '92%', backgroundColor: '#22C55E', borderRadius: 4 }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#22C55E', fontWeight: '800', fontSize: 18 }}>287</Text>
                    <Text style={{ color: C.muted, fontSize: 11 }}>Won ✓</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: C.border }} />
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: C.red, fontWeight: '800', fontSize: 18 }}>25</Text>
                    <Text style={{ color: C.muted, fontSize: 11 }}>Lost ✗</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: C.border }} />
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#F59E0B', fontWeight: '800', fontSize: 18 }}>4.9</Text>
                    <Text style={{ color: C.muted, fontSize: 11 }}>Rating ⭐</Text>
                  </View>
                </View>
              </View>

              {/* Upcoming Consultations */}
              <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden' }}>
                <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ ...serif, color: C.text, fontSize: 16, fontWeight: '700' }}>Upcoming Consultations</Text>
                  <Text style={{ color: C.gold, fontSize: 12, fontWeight: '700' }}>3 today</Text>
                </View>
                {[
                  { name: 'Mohammed Al-Said', type: 'Criminal Defense', time: '2025-03-05 9:00 AM', status: 'confirmed', color: '#22C55E' },
                  { name: 'Rana Hassan',      type: 'Drug Offense',     time: '2025-03-07 11:00 AM', status: 'pending',   color: '#F59E0B' },
                  { name: 'Karim Nour',       type: 'Fraud Investigation', time: '2025-03-12 2:00 PM',  status: 'confirmed', color: '#22C55E' },
                ].map((c, i, arr) => (
                  <View key={c.name} style={{ padding: 14, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar C={C} initials={c.name.split(' ').map(w => w[0]).join('').slice(0,2)} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{c.name}</Text>
                      <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{c.type} · {c.time}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {c.status === 'pending' && (
                        <>
                          <TouchableOpacity style={{ backgroundColor: C.red + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Text style={{ color: C.red, fontSize: 12, fontWeight: '700' }}>✗</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={{ backgroundColor: '#22C55E20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '700' }}>✓</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <View style={{ backgroundColor: c.color + '20', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ color: c.color, fontSize: 11, fontWeight: '700' }}>{c.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Specializations */}
              <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16 }}>
                <Text style={{ ...serif, color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Specializations</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['قانون جنائي ⚖️', 'قانون الأسرة 👨‍👩‍👧', 'قانون تجاري 🏢', 'عقود ودراسات قانونية 📜', 'نقض وطعون 🔍'].map(s => (
                    <View key={s} style={{ backgroundColor: '#C8A84B18', borderWidth: 1, borderColor: '#C8A84B44', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '600' }}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* ══ TOOLS TAB ══ */}
          {tab === 'tools' && (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <ToolCard C={C} icon="📅" label="Availability Calendar" sublabel="Manage your schedule" color="#22C55E" onPress={() => setSubPage('calendar')} />
                <ToolCard C={C} icon="👥" label="Client CRM" sublabel="Manage clients" color="#818CF8" onPress={() => setSubPage('crm')} />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <ToolCard C={C} icon="⚖️" label="Case Outcomes" sublabel="Track win/loss record" color="#F59E0B" onPress={() => setSubPage('outcomes')} />
                <ToolCard C={C} icon="⚙️" label="Account Settings" sublabel="Edit your profile" color={C.gold} onPress={() => router.push('/lawyer-setup' as any)} />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <ToolCard C={C} icon="📊" label="Analytics Dashboard" sublabel="Coming soon" color="#EC4899" onPress={() => {}} />
                <ToolCard C={C} icon="⭐" label="Subscription Plans" sublabel="Upgrade your plan" color="#C8A84B" onPress={() => {}} />
              </View>

              {/* Settings panel */}
              <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden', marginTop: 8 }}>
                <Text style={{ ...serif, color: C.text, fontSize: 16, fontWeight: '700', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>⚙️ Quick Settings</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 22 }}>{dark ? '🌙' : '☀️'}</Text>
                    <Text style={{ color: C.text, fontSize: 14, fontWeight: '600' }}>{dark ? 'Dark Mode' : 'Light Mode'}</Text>
                  </View>
                  <Switch value={dark} onValueChange={() => { toggleTheme(); setDark(!dark); }} trackColor={{ true: '#C8A84B' }} thumbColor="#fff" />
                </View>
                <TouchableOpacity onPress={() => router.push('/account-settings' as any)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <Text style={{ fontSize: 22 }}>⚙️</Text>
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '600', flex: 1 }}>
                    {isRTL ? 'إعدادات الحساب' : 'Account Settings'}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 16 }}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogout}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                  <Text style={{ fontSize: 22 }}>🚪</Text>
                  <Text style={{ color: C.red, fontSize: 14, fontWeight: '700', flex: 1 }}>
                    {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ══ EARNINGS TAB ══ */}
          {tab === 'earnings' && (
            <View style={{ gap: 12 }}>
              {/* Summary card */}
              <View style={{ backgroundColor: '#0F172A', borderRadius: 16, padding: 20 }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>This Month's Earnings</Text>
                <Text style={{ color: '#C8A84B', fontSize: 36, fontWeight: '800', fontFamily: 'CormorantGaramond-Bold', marginTop: 4 }}>3,200 EGP</Text>
                <View style={{ flexDirection: 'row', gap: 20, marginTop: 16 }}>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Sessions</Text>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>4</Text>
                  </View>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Avg / Session</Text>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>800 EGP</Text>
                  </View>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Pending</Text>
                    <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 16 }}>500 EGP</Text>
                  </View>
                </View>
              </View>

              {/* Recent payments */}
              <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, overflow: 'hidden' }}>
                <Text style={{ ...serif, color: C.text, fontSize: 16, fontWeight: '700', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>Recent Payments</Text>
                {[
                  { name: 'Mohammed Al-Said', amount: 800, date: '2025-03-05', status: 'paid' },
                  { name: 'Rana Hassan',      amount: 1200, date: '2025-02-28', status: 'paid' },
                  { name: 'Karim Nour',       amount: 700, date: '2025-02-20', status: 'paid' },
                  { name: 'Pending Session',  amount: 500, date: '2025-03-12', status: 'pending' },
                ].map((p, i, arr) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                    <View>
                      <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>{p.name}</Text>
                      <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{p.date}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ color: p.status === 'paid' ? '#22C55E' : '#F59E0B', fontWeight: '800', fontSize: 15 }}>{p.amount} EGP</Text>
                      <View style={{ backgroundColor: (p.status === 'paid' ? '#22C55E' : '#F59E0B') + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ color: p.status === 'paid' ? '#22C55E' : '#F59E0B', fontSize: 10, fontWeight: '700' }}>{p.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}
