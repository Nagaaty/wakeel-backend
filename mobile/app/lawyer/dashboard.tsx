import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  TextInput, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBookings, updateBooking, selBookings, selBLoading } from '../../src/store/slices/bookingsSlice';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuth } from '../../src/hooks/useAuth';
import { Avatar, Badge, Card, Section, Spinner, Btn, ErrMsg, Empty } from '../../src/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyticsAPI, lawyersAPI } from '../../src/services/api';
import type { AppDispatch } from '../../src/store';
import { useI18n } from '../../src/i18n';

type SubPage = 'calendar' | 'crm' | 'earnings' | 'notes' | 'outcomes' | 'folder' | null;

const DAYS  = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const SLOTS = ['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];

function AvailabilityCalendar({ C, onBack }: any) {
  const [sched, setSched] = useState<Record<number,string[]>>({
    0:[], 1:['9:00','10:00','11:00','14:00','15:00'],
    2:['9:00','10:00','11:00','14:00','15:00'], 3:['9:00','10:00','11:00'],
    4:['9:00','10:00','11:00','14:00','15:00'], 5:[], 6:[],
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggle = (d: number, s: string) =>
    setSched(p => { const a=[...(p[d]||[])]; const i=a.indexOf(s); if(i>=0)a.splice(i,1);else a.push(s); setSaved(false); return {...p,[d]:a}; });

  const save = async () => {
    setSaving(true);
    try { await lawyersAPI.saveAvailability(sched); setSaved(true); Alert.alert('✅','تم حفظ جدول العمل!'); }
    catch (e:any) { Alert.alert('خطأ', e?.message); }
    finally { setSaving(false); }
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:12 }}>
        <TouchableOpacity onPress={onBack}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <View style={{ flex:1 }}><Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>تقويم التوفر</Text><Text style={{ color:C.muted, fontSize:12 }}>حدد أوقات عملك الأسبوعية</Text></View>
        {saved && <Text style={{ color:C.green, fontSize:12, fontWeight:'600' }}>✅ محفوظ</Text>}
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        {DAYS.map((day, d) => {
          const daySlots = sched[d]||[]; const isOff = daySlots.length===0;
          return (
            <View key={d} style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14, marginBottom:10 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:isOff?0:12 }}>
                <Text style={{ color:C.text, fontWeight:'700', fontSize:14 }}>{day}</Text>
                <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                  {isOff && <Text style={{ color:C.muted, fontSize:12 }}>إجازة</Text>}
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
        <Btn C={C} full disabled={saving} onPress={save}>{saving?'⏳ جاري الحفظ...':'💾 حفظ جدول العمل'}</Btn>
      </ScrollView>
    </View>
  );
}

function ClientCRMPage({ C, onBack }: any) {
  const CLIENTS = [
    {id:1,name:'محمد أحمد علي',phone:'01012345678',cases:3,lastContact:'2025-03-05',totalPaid:2400,notes:'عميل منتظم. قضية جنائية + عمالية',urgency:'urgent'},
    {id:2,name:'فاطمة محمود',phone:'01098765432',cases:1,lastContact:'2025-02-20',totalPaid:650,notes:'قضية حضانة. تحتاج متابعة أسبوعية',urgency:'normal'},
    {id:3,name:'خالد إبراهيم',phone:'01155667788',cases:2,lastContact:'2025-01-15',totalPaid:1200,notes:'قضية إيجار. انتهت بتسوية',urgency:'low'},
    {id:4,name:'سارة حسن',phone:'01234567890',cases:1,lastContact:'2025-03-10',totalPaid:400,notes:'استشارة شركة جديدة',urgency:'normal'},
  ];
  const [selected,setSelected]=useState<any>(null);
  const [search,setSearch]=useState('');
  const UC:Record<string,string>={urgent:C.red,normal:C.gold,low:C.green};
  const filtered=CLIENTS.filter(c=>c.name.includes(search)||c.phone.includes(search));

  if (selected) return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:12 }}>
        <TouchableOpacity onPress={()=>setSelected(null)}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>ملف العميل</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        <Card C={C} style={{ marginBottom:14 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:12, marginBottom:14 }}>
            <Avatar C={C} initials={selected.name[0]} size={52} />
            <View><Text style={{ color:C.text, fontWeight:'700', fontSize:16 }}>{selected.name}</Text>
            <Text style={{ color:UC[selected.urgency], fontSize:12, fontWeight:'600', marginTop:2 }}>{selected.urgency==='urgent'?'🔴 عاجل':selected.urgency==='normal'?'🟡 عادي':'🟢 مرن'}</Text></View>
          </View>
          {[['📱 الهاتف',selected.phone],['⚖️ القضايا',`${selected.cases} قضية`],['💰 المدفوعات',`${selected.totalPaid} جنيه`],['📅 آخر تواصل',selected.lastContact]].map(([k,v])=>(
            <View key={k as string} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.border }}>
              <Text style={{ color:C.muted, fontSize:13 }}>{k as string}</Text><Text style={{ color:C.text, fontWeight:'600', fontSize:13 }}>{v as string}</Text>
            </View>
          ))}
        </Card>
        <Card C={C} style={{ marginBottom:14 }}>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:8 }}>📝 ملاحظات</Text>
          <Text style={{ color:C.muted, fontSize:14, lineHeight:22 }}>{selected.notes}</Text>
        </Card>
        <Btn C={C} full onPress={()=>router.push('/messages/index' as any)}>💬 راسل العميل</Btn>
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }}>
          <TouchableOpacity onPress={onBack}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>إدارة العملاء CRM</Text>
        </View>
        <View style={{ flexDirection:'row', backgroundColor:C.card2, borderWidth:1, borderColor:C.border, borderRadius:10, paddingHorizontal:12, paddingVertical:9, alignItems:'center', gap:8 }}>
          <Text>🔍</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="ابحث..." placeholderTextColor={C.muted} style={{ flex:1, color:C.text, fontSize:14 }} />
        </View>
      </View>
      <FlatList data={filtered} keyExtractor={item=>String(item.id)} keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding:16, paddingBottom:100 }}
        ListEmptyComponent={<Empty C={C} icon="👥" title="لا توجد عملاء" />}
        renderItem={({item:cl})=>(
          <TouchableOpacity onPress={()=>setSelected(cl)} style={{ flexDirection:'row', gap:12, alignItems:'center', backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14, marginBottom:10 }}>
            <Avatar C={C} initials={cl.name[0]} size={46} />
            <View style={{ flex:1 }}>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:14 }}>{cl.name}</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>{cl.cases} قضية · {cl.totalPaid} جنيه</Text>
            </View>
            <Badge C={C} color={UC[cl.urgency]}>{cl.urgency==='urgent'?'🔴':cl.urgency==='normal'?'🟡':'🟢'}</Badge>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function EarningsPage({ C, onBack, stats }: any) {
  const [period,setPeriod]=useState<'week'|'month'|'year'>('month');
  const s=stats?.stats||{}; const monthly=stats?.monthly||[];
  const earnings={week:parseFloat(s.earned_this_week||'0'),month:parseFloat(s.earned_this_month||'0'),year:parseFloat(s.total_earned||'0')};
  const maxR=Math.max(...monthly.map((m:any)=>parseFloat(m.revenue||0)),1);
  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:12 }}>
        <TouchableOpacity onPress={onBack}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>الأرباح والمدفوعات</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        <View style={{ flexDirection:'row', backgroundColor:C.card, borderRadius:12, padding:4, marginBottom:16 }}>
          {(['week','month','year'] as const).map(p=>(
            <TouchableOpacity key={p} onPress={()=>setPeriod(p)} style={{ flex:1, paddingVertical:8, borderRadius:9, backgroundColor:period===p?C.surface:'transparent', alignItems:'center' }}>
              <Text style={{ color:period===p?C.text:C.muted, fontWeight:period===p?'700':'400', fontSize:12 }}>{p==='week'?'أسبوع':p==='month'?'شهر':'سنة'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Card C={C} style={{ alignItems:'center', padding:24, marginBottom:16 }}>
          <Text style={{ color:C.muted, fontSize:13 }}>إجمالي الأرباح</Text>
          <Text style={{ color:C.gold, fontWeight:'800', fontSize:36, marginVertical:8 }}>{earnings[period].toLocaleString()} ج</Text>
          <View style={{ flexDirection:'row', gap:20 }}>
            <View style={{ alignItems:'center' }}><Text style={{ color:C.green, fontWeight:'700', fontSize:16 }}>{s.completed||0}</Text><Text style={{ color:C.muted, fontSize:11 }}>مكتملة</Text></View>
            <View style={{ width:1, backgroundColor:C.border }} />
            <View style={{ alignItems:'center' }}><Text style={{ color:C.gold, fontWeight:'700', fontSize:16 }}>{parseFloat(s.avg_fee||'0').toFixed(0)} ج</Text><Text style={{ color:C.muted, fontSize:11 }}>متوسط</Text></View>
          </View>
        </Card>
        {monthly.length>0&&(
          <Card C={C} style={{ marginBottom:16 }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:14 }}>الإيرادات الشهرية</Text>
            <View style={{ flexDirection:'row', alignItems:'flex-end', height:100, gap:4 }}>
              {monthly.slice(0,12).reverse().map((m:any,i:number)=>{
                const h=Math.max(4,Math.round((parseFloat(m.revenue||0)/maxR)*90));
                return <View key={i} style={{ flex:1, height:h, backgroundColor:C.gold, borderRadius:3, opacity:0.7+i*0.03 }} />;
              })}
            </View>
          </Card>
        )}
        <Btn C={C} full variant="ghost" onPress={()=>router.push('/analytics' as any)}>📊 تقرير مفصل</Btn>
      </ScrollView>
    </View>
  );
}

function CaseNotesPage({ C, onBack, bookings }: any) {
  const [notes,   setNotes]   = useState<any[]>([
    {id:1, client:'محمد أحمد',    date:'2025-03-05', title:'أولى جلسة استماع',   body:'طلب المحكمة مستندات إضافية. يجب تقديم شهادة الميلاد + سجل جنائي قبل 15 مارس.', important:true},
    {id:2, client:'فاطمة محمود',  date:'2025-02-20', title:'مستجدات الحضانة',    body:'الزوج وافق على الزيارة أسبوعياً. ننتظر توقيع الاتفاقية الرسمية.',             important:false},
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [form,    setForm]    = useState({ title: '', body: '', client: '' });

  const add = () => {
    if (!form.title || !form.body) return;
    setNotes(p => [...p, { ...form, id: Date.now(), date: new Date().toISOString().slice(0,10), important: false }]);
    setForm({ title: '', body: '', client: '' });
    setShowAdd(false);
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <TouchableOpacity onPress={onBack}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>ملاحظات القضايا 🔒</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAdd(true)}
          style={{ backgroundColor:C.gold, borderRadius:9, paddingHorizontal:12, paddingVertical:6 }}>
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:12 }}>+ ملاحظة</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding:14, paddingBottom:80 }}>
        <View style={{ backgroundColor:'#FEF3CD', borderWidth:1, borderColor:'#FDE68A', borderRadius:10, padding:12, marginBottom:14 }}>
          <Text style={{ color:'#92400E', fontSize:12 }}>🔒 هذه الملاحظات خاصة بك فقط. لا يراها العميل ولا أحد غيرك.</Text>
        </View>
        {showAdd && (
          <Card C={C} style={{ marginBottom:14, borderColor:C.gold }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>ملاحظة جديدة</Text>
            <TextInput value={form.client} onChangeText={v=>setForm(p=>({...p,client:v}))}
              placeholder="اسم العميل" placeholderTextColor={C.muted}
              style={{ backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:9, padding:10, color:C.text, fontSize:13, marginBottom:8 }} />
            <TextInput value={form.title} onChangeText={v=>setForm(p=>({...p,title:v}))}
              placeholder="عنوان الملاحظة *" placeholderTextColor={C.muted}
              style={{ backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:9, padding:10, color:C.text, fontSize:13, marginBottom:8 }} />
            <TextInput value={form.body} onChangeText={v=>setForm(p=>({...p,body:v}))}
              placeholder="محتوى الملاحظة *" placeholderTextColor={C.muted}
              multiline numberOfLines={4}
              style={{ backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:9, padding:10, color:C.text, fontSize:13, textAlignVertical:'top', minHeight:80, marginBottom:10 }} />
            <View style={{ flexDirection:'row', gap:8 }}>
              <Btn C={C} full onPress={add}>حفظ</Btn>
              <Btn C={C} full variant="ghost" onPress={()=>setShowAdd(false)}>إلغاء</Btn>
            </View>
          </Card>
        )}
        {notes.map(n => (
          <View key={n.id} style={{ backgroundColor:C.card, borderWidth:1, borderColor:n.important?C.gold:C.border, borderRadius:12, padding:14, marginBottom:10 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <View style={{ flex:1 }}>
                <Text style={{ color:C.text, fontWeight:'700', fontSize:14 }}>{n.important?'⭐ ':''}{n.title}</Text>
                <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{n.client} · {n.date}</Text>
              </View>
              <View style={{ backgroundColor:'#FEE2E2', borderRadius:6, paddingHorizontal:8, paddingVertical:3 }}>
                <Text style={{ color:'#EF4444', fontSize:10, fontWeight:'700' }}>خاص 🔒</Text>
              </View>
            </View>
            <Text style={{ color:C.muted, fontSize:13, lineHeight:22 }}>{n.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}


function OutcomeTrackerPage({ C, onBack, bookings }: any) {
  const [outcomes, setOutcomes] = useState<any[]>([
    {id:1, type:'جنائي',  outcome:'won',     date:'2025-02-10', desc:'تبرئة في قضية احتيال'},
    {id:2, type:'أسرة',   outcome:'settled', date:'2025-01-20', desc:'حضانة مشتركة بالتراضي'},
    {id:3, type:'عمالي',  outcome:'won',     date:'2025-03-01', desc:'تعويض فصل تعسفي 45,000 جنيه'},
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [form,    setForm]    = useState({ type:'جنائي', outcome:'won', desc:'' });

  const CFG: Record<string,{label:string,color:string,bg:string}> = {
    won:     { label:'فزنا ✅',   color:'#22C55E', bg:'#DCFCE7' },
    settled: { label:'تسوية 🤝', color:'#F59E0B', bg:'#FEF3C7' },
    lost:    { label:'خسرنا ❌', color:'#EF4444', bg:'#FEE2E2' },
    ongoing: { label:'جارٍ ⚖️',  color:'#9A6F2A', bg:'#FEF9EC' },
  };

  const totalWins = outcomes.filter(o => o.outcome === 'won').length;
  const winRate   = outcomes.length > 0 ? Math.round((totalWins / outcomes.length) * 100) : 0;

  const addOutcome = () => {
    if (!form.desc.trim()) return;
    setOutcomes(p => [...p, { ...form, id: Date.now(), date: new Date().toISOString().slice(0,10) }]);
    setForm({ type:'جنائي', outcome:'won', desc:'' });
    setShowAdd(false);
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <TouchableOpacity onPress={onBack}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>متتبع نتائج القضايا</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAdd(true)}
          style={{ backgroundColor:C.gold, borderRadius:9, paddingHorizontal:12, paddingVertical:6 }}>
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:12 }}>+ نتيجة</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding:14, paddingBottom:80 }}>
        {/* Stats */}
        <View style={{ backgroundColor:'#1a1a2e', borderRadius:16, padding:18, marginBottom:14, flexDirection:'row' }}>
          {[[winRate+'%','نسبة الفوز',C.gold],[String(totalWins),'مكسوبة','#22C55E'],[String(outcomes.length),'إجمالي','#fff']].map(([v,lb,col])=>(
            <View key={lb} style={{ flex:1, alignItems:'center' }}>
              <Text style={{ color:col, fontWeight:'800', fontSize:26 }}>{v}</Text>
              <Text style={{ color:'#aaa', fontSize:11, marginTop:2 }}>{lb}</Text>
            </View>
          ))}
        </View>

        {showAdd && (
          <Card C={C} style={{ marginBottom:14, borderColor:C.gold }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>تسجيل نتيجة جديدة</Text>
            {/* Outcome type */}
            <Text style={{ color:C.muted, fontSize:12, marginBottom:6 }}>النتيجة</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:12 }}>
              {Object.entries(CFG).map(([k, v]) => (
                <TouchableOpacity key={k} onPress={() => setForm(p=>({...p, outcome:k}))}
                  style={{ paddingHorizontal:12, paddingVertical:7, borderRadius:20, borderWidth:1, borderColor:form.outcome===k?C.gold:C.border, backgroundColor:form.outcome===k?C.gold+'20':'transparent' }}>
                  <Text style={{ color:form.outcome===k?C.gold:C.muted, fontSize:12 }}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput value={form.desc} onChangeText={v=>setForm(p=>({...p,desc:v}))}
              placeholder="وصف مختصر للقضية *" placeholderTextColor={C.muted}
              style={{ backgroundColor:C.bg, borderWidth:1, borderColor:C.border, borderRadius:9, padding:10, color:C.text, fontSize:13, marginBottom:10 }} />
            <View style={{ flexDirection:'row', gap:8 }}>
              <Btn C={C} full onPress={addOutcome}>حفظ</Btn>
              <Btn C={C} full variant="ghost" onPress={()=>setShowAdd(false)}>إلغاء</Btn>
            </View>
          </Card>
        )}

        {outcomes.map(o => {
          const cfg = CFG[o.outcome] || CFG.ongoing;
          return (
            <View key={o.id} style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:12, padding:14, marginBottom:10, flexDirection:'row', gap:12, alignItems:'center' }}>
              <View style={{ width:44, height:44, borderRadius:22, backgroundColor:cfg.bg, alignItems:'center', justifyContent:'center' }}>
                <Text style={{ fontSize:22 }}>{o.outcome==='won'?'✅':o.outcome==='settled'?'🤝':o.outcome==='lost'?'❌':'⚖️'}</Text>
              </View>
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


function SharedCaseFolderPage({ C, onBack }: any) {
  const [files,     setFiles]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    import('../../src/services/api').then(({ vaultAPI }) => {
      vaultAPI.list()
        .then((d: any) => setFiles(d.files || []))
        .catch(() => setFiles([]))
        .finally(() => setLoading(false));
    });
  }, []);

  const pickAndUpload = async () => {
    const { getDocumentAsync } = await import('expo-document-picker');
    const res = await getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (res.canceled) return;
    const file = res.assets[0];
    setUploading(true);
    try {
      const { vaultAPI } = await import('../../src/services/api');
      const formData = new FormData();
      formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
      const d: any = await vaultAPI.upload(formData);
      setFiles(p => [d.file || { id: Date.now(), name: file.name, size: '?', created_at: new Date().toISOString() }, ...p]);
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر رفع الملف');
    } finally { setUploading(false); }
  };

  const removeFile = async (id: string) => {
    Alert.alert('حذف', 'حذف هذا الملف؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        const { vaultAPI } = await import('../../src/services/api');
        await vaultAPI.delete(id).catch(() => {});
        setFiles(p => p.filter(f => f.id !== id));
      }},
    ]);
  };

  const ICONS: Record<string,string> = { pdf:'📕', img:'🖼️', zip:'📦', doc:'📘', jpeg:'🖼️', jpg:'🖼️', png:'🖼️' };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <TouchableOpacity onPress={onBack}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:17 }}>📁 ملفات القضايا المشتركة</Text>
        </View>
        <TouchableOpacity onPress={pickAndUpload} disabled={uploading}
          style={{ backgroundColor:C.gold, borderRadius:9, paddingHorizontal:12, paddingVertical:7 }}>
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:12 }}>{uploading?'⏳ رفع...':'+ رفع ملف'}</Text>
        </TouchableOpacity>
      </View>
      {loading
        ? <View style={{ padding:40, alignItems:'center' }}><ActivityIndicator color={C.gold} /></View>
        : files.length === 0
        ? <View style={{ padding:40, alignItems:'center' }}>
            <Text style={{ fontSize:40, marginBottom:12 }}>📁</Text>
            <Text style={{ color:C.muted }}>لا توجد ملفات. اضغط + لرفع ملف.</Text>
          </View>
        : <FlatList
            data={files}
            keyExtractor={item=>String(item.id)}
            contentContainerStyle={{ padding:14 }}
            renderItem={({ item:f }) => {
              const ext = (f.file_type || f.name?.split('.').pop() || 'pdf').toLowerCase();
              return (
                <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:12, padding:12, marginBottom:8, flexDirection:'row', gap:12, alignItems:'center' }}>
                  <Text style={{ fontSize:28 }}>{ICONS[ext]||'📎'}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={{ color:C.text, fontWeight:'600', fontSize:13 }} numberOfLines={1}>{f.name}</Text>
                    <Text style={{ color:C.muted, fontSize:11, marginTop:2 }}>{f.size} · {new Date(f.created_at).toLocaleDateString('ar-EG')}</Text>
                    {f.sharedWith && <Text style={{ color:C.gold, fontSize:11, marginTop:1 }}>مشارك مع: {f.sharedWith}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => removeFile(f.id)} style={{ padding:6 }}>
                    <Text style={{ color:C.red, fontSize:18 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
      }
    </View>
  );
}


// ─── OverviewTab ──────────────────────────────────────────────────────────────
function OverviewTab({ C, bookings, stats, TOOLS, setSubPage, changeStatus }: any) {
  const wins   = stats?.wins   || 287;
  const losses = stats?.losses || 25;
  const pct    = Math.round(wins / (wins + losses) * 100);
  const serif  = { fontFamily: 'CormorantGaramond-Bold' };
  return (
    <>
      {/* Upcoming consultations */}
      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:16, marginBottom:12, marginTop:8 }}>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>Upcoming Consultations</Text>
        {bookings.filter((b:any)=>b.status!=='completed'&&b.status!=='cancelled').slice(0,3).map((b:any)=>(
          <View key={b.id} style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border }}>
            <View style={{ flex:1 }}>
              <Text style={{ color:C.text, fontWeight:'600', fontSize:13 }}>{b.client_name}</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>{b.service_type} • {b.booking_date}</Text>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
              <View style={{ backgroundColor:b.status==='confirmed'?C.green+'18':C.warn+'18', borderRadius:20, paddingHorizontal:8, paddingVertical:3 }}>
                <Text style={{ color:b.status==='confirmed'?C.green:C.warn, fontSize:11, fontWeight:'700' }}>{b.status}</Text>
              </View>
              {b.status==='pending'&&(
                <View style={{ flexDirection:'row', gap:4 }}>
                  <TouchableOpacity onPress={()=>changeStatus(b.id,'confirmed')} style={{ backgroundColor:C.green+'18', borderRadius:7, paddingHorizontal:8, paddingVertical:4 }}>
                    <Text style={{ color:C.green, fontSize:11, fontWeight:'700' }}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>changeStatus(b.id,'rejected')} style={{ backgroundColor:C.red+'18', borderRadius:7, paddingHorizontal:8, paddingVertical:4 }}>
                    <Text style={{ color:C.red, fontSize:11, fontWeight:'700' }}>✗</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ))}
        {bookings.filter((b:any)=>b.status!=='completed'&&b.status!=='cancelled').length===0&&(
          <Text style={{ color:C.muted, fontSize:13, textAlign:'center', paddingVertical:10 }}>No upcoming consultations</Text>
        )}
      </View>
      {/* Profile stats — WinBar matching reference */}
      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:16, marginBottom:14 }}>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>Profile Stats</Text>
        <View style={{ flexDirection:'row', gap:12, marginBottom:4 }}>
          <Text style={{ color:C.green, fontSize:12, fontWeight:'600' }}>✓{wins}W</Text>
          <Text style={{ color:C.red,   fontSize:12, fontWeight:'600' }}>✗{losses}L</Text>
          <Text style={{ color:C.gold,  fontSize:12, fontWeight:'700' }}>{pct}%</Text>
        </View>
        <View style={{ backgroundColor:C.border, borderRadius:4, height:5, marginBottom:12 }}>
          <View style={{ backgroundColor:C.green, width:`${pct}%` as any, height:'100%', borderRadius:4 }} />
        </View>
        <View style={{ flexDirection:'row', gap:16 }}>
          <Text style={{ color:C.muted, fontSize:13 }}>⭐ <Text style={{ color:C.gold, fontWeight:'700' }}>4.9</Text></Text>
          <Text style={{ color:C.muted, fontSize:13 }}>📝 <Text style={{ color:C.text, fontWeight:'700' }}>312</Text> reviews</Text>
          <Text style={{ color:C.muted, fontSize:13 }}>📅 <Text style={{ color:C.text, fontWeight:'700' }}>18</Text> yrs</Text>
        </View>
      </View>
      {/* Tools grid */}
      <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:10 }}>Lawyer Tools</Text>
      {TOOLS.map((tool:any)=>(
        <TouchableOpacity key={tool.sub} onPress={()=>setSubPage(tool.sub)} activeOpacity={0.8}
          style={{ flexDirection:'row', alignItems:'center', gap:14, backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:14, marginBottom:8 }}>
          <View style={{ width:42, height:42, borderRadius:12, backgroundColor:C.card2, alignItems:'center', justifyContent:'center' }}>
            <Text style={{ fontSize:20 }}>{tool.icon}</Text>
          </View>
          <Text style={{ flex:1, color:C.text, fontWeight:'600', fontSize:14 }}>{tool.label}</Text>
          <Text style={{ color:C.muted, fontSize:18 }}>›</Text>
        </TouchableOpacity>
      ))}
    </>
  );
}

// ─── ScheduleTab — slot toggler grid matching reference exactly ────────────────
const ALL_SLOTS = ['8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','12:00 PM','2:00 PM','2:30 PM','3:00 PM','4:00 PM','5:00 PM'];

function ScheduleTab({ C }: any) {
  const [active, setActive] = useState(['9:00 AM','10:00 AM','11:00 AM','2:00 PM','3:00 PM']);
  const toggle = (s: string) => setActive(p => p.includes(s) ? p.filter(x=>x!==s) : [...p, s]);
  return (
    <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:16, marginTop:8 }}>
      <Text style={{ color:C.text, fontWeight:'700', fontSize:15, marginBottom:6 }}>Available Time Slots</Text>
      <Text style={{ color:C.muted, fontSize:13, lineHeight:19, marginBottom:16 }}>
        Toggle slots when you're available. Clients can only book active slots.
      </Text>
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
        {ALL_SLOTS.map(s => {
          const on = active.includes(s);
          return (
            <TouchableOpacity key={s} onPress={()=>toggle(s)}
              style={{ paddingHorizontal:14, paddingVertical:10, borderRadius:9, borderWidth:1, borderColor:on?C.green:C.border, backgroundColor:on?C.green+'12':'transparent', minWidth:82, alignItems:'center' }}>
              <Text style={{ color:on?C.green:C.muted, fontSize:13, fontWeight:on?'700':'400' }}>
                {on ? '✓ ' : ''}{s}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity onPress={()=>Alert.alert('✅','Schedule saved!')}
        style={{ backgroundColor:C.gold, borderRadius:12, padding:14, marginTop:18, alignItems:'center' }}>
        <Text style={{ color:'#000', fontWeight:'700', fontSize:15 }}>Save Schedule ✓</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── EarningsTab — matches reference earnings tab exactly ─────────────────────
function EarningsTab({ C, stats, onPayout }: any) {
  const [period, setPeriod] = useState<'week'|'month'|'year'>('month');
  const earnings = {
    week:  parseFloat(stats?.stats?.earned_this_week  || '0'),
    month: parseFloat(stats?.stats?.earned_this_month || '3800'),
    year:  parseFloat(stats?.stats?.total_earned      || '42500'),
  };
  const serif = { fontFamily: 'CormorantGaramond-Bold' };
  const DEMO_COMPLETED = [
    { client:'Mohammed Al-Said', date:'2025-03-05', fee:500 },
    { client:'Rana Hassan',      date:'2025-02-20', fee:500 },
    { client:'Karim Nour',       date:'2025-02-12', fee:500 },
    { client:'Dina Samir',       date:'2025-02-01', fee:500 },
  ];
  const totalEarned = DEMO_COMPLETED.reduce((a,b)=>a+b.fee, 0);
  const pending = 500;

  return (
    <>
      {/* Period selector */}
      <View style={{ flexDirection:'row', backgroundColor:C.card, marginTop:8, marginBottom:12, borderRadius:12, padding:4, gap:4 }}>
        {([['week','7 Days'],['month','30 Days'],['year','12 Months']] as [string,string][]).map(([v,l])=>(
          <TouchableOpacity key={v} onPress={()=>setPeriod(v as any)}
            style={{ flex:1, paddingVertical:8, borderRadius:9, backgroundColor:period===v?C.surface:'transparent', alignItems:'center' }}>
            <Text style={{ color:period===v?C.text:C.muted, fontWeight:period===v?'700':'400', fontSize:12 }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Big earnings number */}
      <View style={{ flexDirection:'row', gap:12, marginBottom:12 }}>
        <View style={{ flex:1, backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:18, alignItems:'center' }}>
          <Text style={{ color:C.muted, fontSize:12, marginBottom:6 }}>Total Earned</Text>
          <Text style={{ ...serif, color:C.gold, fontSize:32, fontWeight:'700' }}>{totalEarned}</Text>
          <Text style={{ color:C.muted, fontSize:12 }}>EGP</Text>
        </View>
        <View style={{ flex:1, backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, padding:18, alignItems:'center' }}>
          <Text style={{ color:C.muted, fontSize:12, marginBottom:6 }}>Pending Payout</Text>
          <Text style={{ ...serif, color:C.green, fontSize:32, fontWeight:'700' }}>{pending}</Text>
          <Text style={{ color:C.muted, fontSize:12 }}>EGP</Text>
        </View>
      </View>

      {/* Transaction list */}
      <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:14, overflow:'hidden', marginBottom:12 }}>
        {DEMO_COMPLETED.map((b,i)=>(
          <View key={i} style={{ flexDirection:'row', justifyContent:'space-between', padding:14, borderBottomWidth:i<DEMO_COMPLETED.length-1?1:0, borderBottomColor:C.border }}>
            <View>
              <Text style={{ color:C.text, fontSize:13, fontWeight:'500' }}>{b.client}</Text>
              <Text style={{ color:C.muted, fontSize:12, marginTop:2 }}>{b.date}</Text>
            </View>
            <Text style={{ color:C.gold, fontWeight:'700', fontSize:14 }}>+{b.fee} EGP</Text>
          </View>
        ))}
      </View>

      {/* Payout button — matches reference */}
      <TouchableOpacity onPress={onPayout}
        style={{ backgroundColor:C.accent, borderRadius:12, padding:15, alignItems:'center', marginBottom:8 }}>
        <Text style={{ color:'#fff', fontWeight:'700', fontSize:15 }}>💳 Request Payout</Text>
      </TouchableOpacity>

      <View style={{ flexDirection:'row', gap:8 }}>
        {[['📅 Schedule','/lawyer/dashboard'],['👥 Clients','/lawyer/dashboard'],['📊 Analytics','/analytics']].map(([l,p])=>(
          <TouchableOpacity key={l} onPress={()=>router.push(p as any)}
            style={{ flex:1, backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:10, padding:10, alignItems:'center' }}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'600' }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

export default function LawyerDashboardScreen() {
  const C=useTheme(); const dispatch=useDispatch<AppDispatch>();
  const {user,initials,logout}=useAuth();
  const bookings=useSelector(selBookings); const bLoading=useSelector(selBLoading);
  const insets=useSafeAreaInsets();
  const [subPage,setSubPage]=useState<SubPage>(null);
  const [stats,setStats]=useState<any>(null);
  const [error,setError]=useState('');
  const [tab,setTab]=useState<'overview'|'bookings'|'schedule'|'earnings'>('overview');
  const [acting,setActing]=useState<number|null>(null);
  const [refreshing,setRefreshing]=useState(false);

  const load=useCallback(async()=>{
    setError('');
    try { await dispatch(fetchBookings({})).unwrap(); setStats(await analyticsAPI.lawyer()); }
    catch(e:any){setError(e?.message||'تعذر تحميل البيانات');}
  },[dispatch]);

  useEffect(()=>{load();},[]);
  const onRefresh=async()=>{setRefreshing(true);await load();setRefreshing(false);};
  const changeStatus=async(id:number,status:string)=>{
    setActing(id);
    try{await dispatch(updateBooking({id,status})).unwrap();}
    catch(e:any){Alert.alert('خطأ',e?.message||'تعذر التحديث');}
    finally{setActing(null);}
  };

  if(subPage==='calendar') return <AvailabilityCalendar C={C} onBack={()=>setSubPage(null)} />;
  if(subPage==='crm')         return <ClientCRMPage C={C} onBack={()=>setSubPage(null)} />;
  if(subPage==='earnings')    return <EarningsPage C={C} onBack={()=>setSubPage(null)} stats={stats} />;
  if(subPage==='notes')       return <CaseNotesPage C={C} onBack={()=>setSubPage(null)} bookings={bookings} />;
  if(subPage==='outcomes')    return <OutcomeTrackerPage C={C} onBack={()=>setSubPage(null)} bookings={bookings} />;
  if(subPage==='folder')      return <SharedCaseFolderPage C={C} onBack={()=>setSubPage(null)} />;

  const pending=bookings.filter((b:any)=>b.status==='pending');
  const confirmed=bookings.filter((b:any)=>b.status==='confirmed');
  const s=stats?.stats||{};

  const TOOLS=[
    {icon:'📅',label:'تقويم التوفر',sub:'calendar' as SubPage},
    {icon:'👥',label:'إدارة العملاء CRM',sub:'crm' as SubPage},
    {icon:'💰',label:'الأرباح والمدفوعات',sub:'earnings' as SubPage},
    {icon:'📝',label:'ملاحظات القضايا',sub:'notes' as SubPage},
    {icon:'📊',label:'تتبع نتائج القضايا',sub:'outcomes' as SubPage},
    {icon:'📁',label:'مجلد القضايا المشترك',sub:'folder' as SubPage},
  ];

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
            <TouchableOpacity onPress={()=>router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
            <Avatar C={C} initials={initials} size={42} />
            <View><Text style={{ color:C.text, fontWeight:'700', fontSize:16 }}>{user?.name}</Text><Text style={{ color:C.green, fontSize:12 }}>● متاح للحجوزات</Text></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={()=>router.push('/lawyer-setup' as any)} style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:10, paddingHorizontal:10, paddingVertical:7 }}>
              <Text style={{ color:C.text, fontSize:12, fontWeight:'600' }}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [{text:'إلغاء'}, {text:'تسجيل الخروج', style:'destructive', onPress:logout}])} style={{ backgroundColor:C.red+'15', borderWidth:1, borderColor:C.red+'40', borderRadius:10, paddingHorizontal:10, paddingVertical:7 }}>
              <Text style={{ color:C.red, fontSize:12, fontWeight:'600' }}>🚪</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flexDirection:'row', gap:8 }}>
          {[[pending.length,'⏳','طلبات',C.warn],[confirmed.length,'📅','مؤكدة',C.accent],
            [parseFloat(s.earned_this_month||'0').toFixed(0)+'ج','💰','الشهر',C.green]].map(([v,icon,lb,col])=>(
            <View key={lb as string} style={{ flex:1, backgroundColor:C.card2, borderRadius:12, padding:10, alignItems:'center' }}>
              <Text style={{ fontSize:16 }}>{icon as string}</Text>
              <Text style={{ color:col as string, fontWeight:'800', fontSize:15, marginTop:2 }}>{v as any}</Text>
              <Text style={{ color:C.muted, fontSize:10, marginTop:1 }}>{lb as string}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick nav buttons */}
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, paddingHorizontal:14, paddingTop:10, paddingBottom:6 }}>
        {([['📅 الحجوزات','/bookings'],['⭐ اشتراكي','/subscription'],['💬 الرسائل','/messages/index'],['💲 الأسعار','/service-pricing']] as [string,string][]).map(([label,path])=>(
          <TouchableOpacity key={path} onPress={()=>router.push(path as any)}
            style={{ paddingHorizontal:12, paddingVertical:7, borderRadius:20, borderWidth:1, borderColor:C.border, backgroundColor:C.card }}>
            <Text style={{ color:C.text, fontSize:12, fontWeight:'600' }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection:'row', backgroundColor:C.card, marginHorizontal:14, marginBottom:4, borderRadius:12, padding:4 }}>
        {([['overview','📊 Overview'],['bookings','📅 Bookings'],['schedule','🕐 Schedule'],['earnings','💰 Earnings']] as [string,string][]).map(([t,lb])=>(
          <TouchableOpacity key={t} onPress={()=>setTab(t as any)} style={{ flex:1, paddingVertical:9, borderRadius:9, backgroundColor:tab===t?C.surface:'transparent', alignItems:'center' }}>
            <Text style={{ color:tab===t?C.text:C.muted, fontWeight:tab===t?'700':'400', fontSize:11 }}>{lb}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error?<View style={{ paddingHorizontal:16 }}><ErrMsg C={C} msg={error} /></View>:null}
      <ScrollView contentContainerStyle={{ paddingHorizontal:16, paddingBottom:100 }}
        refreshControl={<RefreshControl refreshing={refreshing||bLoading} onRefresh={onRefresh} tintColor={C.gold} />}>
        {tab==='overview'&&(
          <OverviewTab C={C} bookings={bookings} stats={stats} TOOLS={TOOLS} setSubPage={setSubPage} changeStatus={changeStatus} />
        )}
        {tab==='bookings'&&(
          <>
            {pending.length>0&&(<>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:10 }}>⏳ طلبات تحتاج ردك ({pending.length})</Text>
              {pending.map((b:any)=>(
                <Card key={b.id} C={C} style={{ marginBottom:10, borderColor:C.warn+'60' }}>
                  <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:4 }}>{b.client_name}</Text>
                  <Text style={{ color:C.muted, fontSize:12, marginBottom:b.notes?8:12 }}>📅 {b.booking_date} · ⏰ {b.start_time?.slice(0,5)} · {b.service_type} · {b.fee} ج</Text>
                  {b.notes&&<Text style={{ color:C.muted, fontSize:12, marginBottom:10, fontStyle:'italic' }}>"{b.notes}"</Text>}
                  <View style={{ flexDirection:'row', gap:8 }}>
                    <Btn C={C} full onPress={()=>changeStatus(b.id,'confirmed')} disabled={acting===b.id}>{acting===b.id?'⏳':'✅ قبول'}</Btn>
                    <Btn C={C} full variant="ghost" onPress={()=>changeStatus(b.id,'rejected')} disabled={acting===b.id}>❌ رفض</Btn>
                  </View>
                </Card>
              ))}
            </>)}
            {confirmed.length>0&&(<>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:10, marginTop:6 }}>📅 الجلسات القادمة ({confirmed.length})</Text>
              {confirmed.map((b:any)=>{
                const isToday=b.booking_date===new Date().toISOString().slice(0,10);
                return (
                  <Card key={b.id} C={C} style={{ marginBottom:10, borderColor:isToday?C.green+'60':C.border }}>
                    <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <View style={{ flex:1 }}>
                        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                          <Text style={{ color:C.text, fontWeight:'700', fontSize:14 }}>{b.client_name}</Text>
                          {isToday&&<Badge C={C} color={C.green}>اليوم</Badge>}
                        </View>
                        <Text style={{ color:C.muted, fontSize:12, marginTop:4 }}>📅 {b.booking_date} · ⏰ {b.start_time?.slice(0,5)}</Text>
                        <Text style={{ color:C.gold, fontWeight:'700', marginTop:4 }}>{b.fee} جنيه</Text>
                      </View>
                      <View style={{ gap:8 }}>
                        {b.service_type==='video'&&<Btn C={C} size="sm" onPress={()=>router.push({pathname:'/video',params:{booking:b.id}} as any)}>📹</Btn>}
                        <Btn C={C} size="sm" variant="ghost" onPress={()=>changeStatus(b.id,'completed')} disabled={acting===b.id}>🏆</Btn>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </>)}
            {pending.length===0&&confirmed.length===0&&!bLoading&&(
              <View style={{ padding:40, alignItems:'center' }}>
                <Text style={{ fontSize:48, marginBottom:12 }}>📅</Text>
                <Text style={{ color:C.muted, fontSize:14 }}>لا توجد حجوزات حالياً</Text>
                <Btn C={C} onPress={()=>router.push('/lawyer-setup' as any)} style={{ marginTop:16 }}>⚙️ إعداد الملف</Btn>
              </View>
            )}
          </>
        )}
        {tab==='schedule'&&(
          <ScheduleTab C={C} />
        )}
        {tab==='earnings'&&(
          <EarningsTab C={C} stats={stats} onPayout={()=>router.push('/lawyer/payout' as any)} />
        )}
      </ScrollView>
    </View>
  );
}
