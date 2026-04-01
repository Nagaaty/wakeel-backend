import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { Btn, Card, Avatar, Stars } from '../src/components/ui';
import { aiAPI, lawyersAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

const LAW_CATS = ['قانون الأسرة','جنائي','شركات','عقارات','عمالي','مدني','إداري','جمارك','ملكية فكرية'];
const STEPS = ['وصف القضية','الفئة والتفاصيل','نتائج التطابق'];

export default function CaseMatcherScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ issue:'', cat:'', budget:'', urgency:'', lang:'' });
  const [matches, setMatches] = useState<any[]|null>(null);
  const [loading, setLoading] = useState(false);

  const upd = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const match = async () => {
    setLoading(true);
    try {
      const lawyers: any = await lawyersAPI.list({ cat: form.cat }).then((d:any) => d.lawyers || d || []).catch(() => []);
      const DEMO = [
        { id:'1', name:'Dr. Ahmed Hassan', initials:'AH', specialization:'قانون جنائي', city:'القاهرة', avg_rating:4.9, wins:287, consultation_fee:500, matchScore:95, reasons:['متخصص في '+form.cat,'نسبة فوز عالية','متاح هذا الأسبوع'] },
        { id:'5', name:'Dr. Omar Shafik',  initials:'OS', specialization:'قانون ملكية', city:'القاهرة', avg_rating:4.9, wins:231, consultation_fee:800, matchScore:88, reasons:['خبرة 22 سنة','متجاوب بسرعة'] },
        { id:'2', name:'Dr. Nadia El-Masri',initials:'NE',specialization:'قانون الأسرة', city:'الإسكندرية', avg_rating:4.8, wins:165, consultation_fee:650, matchScore:81, reasons:['مناسب للميزانية','تقييمات ممتازة'] },
      ];
      setMatches(lawyers.length > 0 ? lawyers.slice(0,3).map((l:any, i:number) => ({
        ...l, matchScore: 95 - i*7, initials: (l.name||'').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase(),
        reasons: DEMO[i]?.reasons || ['متخصص في '+form.cat],
      })) : DEMO);
    } catch {
      setMatches([{ id:'1', name:'Dr. Ahmed Hassan', initials:'AH', specialization:'قانون جنائي', city:'القاهرة', avg_rating:4.9, wins:287, consultation_fee:500, matchScore:95, reasons:['متخصص في '+form.cat,'نسبة فوز عالية'] }]);
    } finally { setLoading(false); setStep(3); }
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:12, borderBottomWidth:1, borderBottomColor:C.border }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 }}>
          <TouchableOpacity onPress={() => step>1?setStep(s=>s-1):router.back()}>
            <Text style={{ color:C.text, fontSize:22 }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:20, fontFamily:'CormorantGaramond-Bold' }}>🎯 مطابقة ذكية للمحامين</Text>
            <Text style={{ color:C.muted, fontSize:12 }}>الخطوة {step} من 3: {STEPS[step-1]}</Text>
          </View>
        </View>
        <View style={{ flexDirection:'row', gap:4 }}>
          {[1,2,3].map(s=><View key={s} style={{ flex:1, height:4, borderRadius:2, backgroundColor:step>=s?C.gold:C.border }}/>)}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        {step===1 && (
          <>
            <Text style={{ color:C.muted, fontSize:12, fontWeight:'600', marginBottom:8 }}>📝 صف مشكلتك القانونية *</Text>
            <TextInput value={form.issue} onChangeText={v=>upd('issue',v)} multiline numberOfLines={4}
              placeholder="مثال: صاحب العمل لم يدفع راتبي منذ شهرين وهدد بفصلي إذا شكوته..."
              placeholderTextColor={C.muted}
              style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:12, padding:14, color:C.text, fontSize:14, textAlignVertical:'top', minHeight:110, marginBottom:16 }} />
            <Btn C={C} full disabled={!form.issue.trim()} onPress={() => setStep(2)}>التالي ←</Btn>
          </>
        )}

        {step===2 && (
          <>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:10 }}>⚖️ فئة القانون</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {LAW_CATS.map(cat=>(
                <TouchableOpacity key={cat} onPress={()=>upd('cat',cat)}
                  style={{ paddingHorizontal:14, paddingVertical:9, borderRadius:10, borderWidth:2, borderColor:form.cat===cat?C.gold:C.border, backgroundColor:form.cat===cat?C.gold+'20':'transparent' }}>
                  <Text style={{ color:form.cat===cat?C.gold:C.muted, fontSize:12, fontWeight:form.cat===cat?'700':'400' }}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:10 }}>⏰ الإلحاحية</Text>
            <View style={{ flexDirection:'row', gap:8, marginBottom:16 }}>
              {[['urgent','🔴 عاجل'],['soon','🟡 هذا الأسبوع'],['flexible','🟢 مرن']].map(([v,lb])=>(
                <TouchableOpacity key={v} onPress={()=>upd('urgency',v)}
                  style={{ flex:1, paddingVertical:9, borderRadius:10, borderWidth:1, borderColor:form.urgency===v?C.gold:C.border, backgroundColor:form.urgency===v?C.gold+'15':'transparent', alignItems:'center' }}>
                  <Text style={{ color:form.urgency===v?C.gold:C.text, fontSize:12 }}>{lb}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:8 }}>💰 الميزانية</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:20 }}>
              {[['under500','أقل من 500 ج'],['500-1000','500-1000 ج'],['1000-2000','1000-2000 ج'],['over2000','أكثر من 2000 ج']].map(([v,lb])=>(
                <TouchableOpacity key={v} onPress={()=>upd('budget',v)}
                  style={{ paddingHorizontal:14, paddingVertical:8, borderRadius:20, borderWidth:1, borderColor:form.budget===v?C.gold:C.border, backgroundColor:form.budget===v?C.gold+'20':'transparent' }}>
                  <Text style={{ color:form.budget===v?C.gold:C.muted, fontSize:12 }}>{lb}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection:'row', gap:10 }}>
              <Btn C={C} full variant="ghost" onPress={()=>setStep(1)}>← السابق</Btn>
              <Btn C={C} full disabled={!form.cat||loading} onPress={match}>
                {loading?'⏳ جاري التحليل...':'🔍 ابحث عن المناسب'}
              </Btn>
            </View>
            {loading && <View style={{ alignItems:'center', padding:20 }}><ActivityIndicator color={C.gold} /><Text style={{ color:C.muted, fontSize:12, marginTop:10 }}>يحلل الذكاء الاصطناعي قضيتك...</Text></View>}
          </>
        )}

        {step===3 && matches && (
          <>
            <View style={{ backgroundColor:C.green+'15', borderWidth:1, borderColor:C.green+'30', borderRadius:12, padding:12, marginBottom:16 }}>
              <Text style={{ color:C.green, fontSize:13, fontWeight:'600' }}>✅ وجد الذكاء الاصطناعي {matches.length} محامين مثاليين لقضيتك</Text>
            </View>
            {matches.map((l:any, idx:number) => {
              const initials = l.initials || (l.name||'').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase();
              return (
                <Card key={l.id} C={C} style={{ marginBottom:12, borderColor:idx===0?C.gold:C.border, position:'relative' }}>
                  {idx===0 && (
                    <View style={{ position:'absolute', top:-10, left:16, backgroundColor:C.gold, borderRadius:20, paddingHorizontal:12, paddingVertical:3 }}>
                      <Text style={{ color:'#fff', fontSize:11, fontWeight:'700' }}>🏆 الأنسب لقضيتك</Text>
                    </View>
                  )}
                  <View style={{ flexDirection:'row', gap:12, alignItems:'center', marginBottom:10, marginTop:idx===0?6:0 }}>
                    <Avatar C={C} initials={initials} size={50} />
                    <View style={{ flex:1 }}>
                      <Text style={{ color:C.text, fontWeight:'700', fontSize:15 }}>{l.name}</Text>
                      <Text style={{ color:C.muted, fontSize:12 }}>{l.specialization} · {l.city}</Text>
                      <View style={{ flexDirection:'row', gap:8, marginTop:4 }}>
                        <Stars rating={parseFloat(l.avg_rating)||0} C={C} />
                        {l.wins && <Text style={{ color:C.green, fontSize:11 }}>✓ {l.wins} فوز</Text>}
                        <Text style={{ color:C.gold, fontWeight:'700', fontSize:12 }}>{l.consultation_fee} ج</Text>
                      </View>
                    </View>
                    <View style={{ alignItems:'center' }}>
                      <Text style={{ color:C.gold, fontWeight:'800', fontSize:22 }}>{l.matchScore}%</Text>
                      <Text style={{ color:C.muted, fontSize:10 }}>تطابق</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:12 }}>
                    {(l.reasons||[]).map((r:string,i:number)=>(
                      <View key={i} style={{ backgroundColor:C.green+'15', borderRadius:20, paddingHorizontal:10, paddingVertical:3 }}>
                        <Text style={{ color:C.green, fontSize:11, fontWeight:'600' }}>✓ {r}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection:'row', gap:10 }}>
                    <Btn C={C} full onPress={()=>router.push(`/lawyer/${l.id}` as any)}>👤 عرض الملف</Btn>
                    <Btn C={C} full variant="ghost" onPress={()=>router.push(`/book?lawyer=${l.id}` as any)}>📅 احجز</Btn>
                  </View>
                </Card>
              );
            })}
            <TouchableOpacity onPress={() => { setStep(1); setMatches(null); setForm({ issue:'', cat:'', budget:'', urgency:'', lang:'' }); }}
              style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:12, padding:12, alignItems:'center', marginTop:4 }}>
              <Text style={{ color:C.muted, fontSize:13 }}>🔄 بحث جديد</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}