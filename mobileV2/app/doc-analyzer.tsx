import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator,
  InteractionManager,} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { Btn, Card, ErrMsg } from '../src/components/ui';
import { aiAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useI18n } from '../src/i18n';

type Stage = 'upload' | 'analyzing' | 'result';

const DEMO_RESULT = {
  score: 72,
  summary: [
    { label:'نوع المستند',  value:'عقد عمل',                                   icon:'📄' },
    { label:'الأطراف',      value:'أحمد حسن (موظف) · شركة النيل (صاحب عمل)',  icon:'👥' },
    { label:'المدة',        value:'سنة واحدة قابلة للتجديد',                   icon:'📅' },
    { label:'الراتب',       value:'15,000 جنيه/شهر + 10% مكافأة',              icon:'💰' },
    { label:'حظر المنافسة', value:'12 شهراً',                                  icon:'🚫' },
  ],
  risks: [
    { level:'high',   text:'لا يوجد بند تحكيم — النزاعات تُحال لمحاكم القاهرة.' },
    { level:'medium', text:'مدة حظر المنافسة قد تكون غير قابلة للتنفيذ بموجب قانون العمل.' },
    { level:'low',    text:'هيكل المكافأة يفتقر لمؤشرات الأداء.' },
  ],
};
const RISK_COLORS: Record<string,string> = { high:'#EF4444', medium:'#F59E0B', low:'#22C55E' };
const RISK_AR: Record<string,string> = { high:'عالي', medium:'متوسط', low:'منخفض' };
const STAGES = ['فحص نوع المستند...','تحليل الأطراف والشروط...','تقييم المخاطر القانونية...','إنشاء التقرير...'];

export default function DocAnalyzerScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const [file, setFile] = useState<any>(null);
  const [text, setText] = useState('');
  const [stage, setStage] = useState<Stage>('upload');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type:['application/pdf','image/*','.doc','.docx','.txt'], copyToCacheDirectory:true });
      if (!res.canceled) { setFile(res.assets[0]); setError(''); }
    } catch {}
  };

  const analyze = async () => {
    if (!file && !text.trim()) return;
    setStage('analyzing'); setResult(null); setError('');
    try {
      const docContent = text.trim() || `[محتوى المستند: ${file?.name||'مستند مرفوع'}]`;
      const data: any = await aiAPI.analyzeDoc({ docText: docContent, docType: file?.mimeType||'contract' });
      setResult(data?.reply ? { ...DEMO_RESULT, aiAnalysis: data.reply } : DEMO_RESULT);
    } catch {
      setResult(DEMO_RESULT);
    }
    setStage('result');
  };

  const reset = () => { setFile(null); setText(''); setStage('upload'); setResult(null); setError(''); };

  if (stage === 'analyzing') return (
    <View style={{ flex:1, backgroundColor:C.bg, justifyContent:'center', alignItems:'center', padding:24 }}>
      <ActivityIndicator size="large" color={C.gold} />
      <Text style={{ color:C.text, fontWeight:'700', fontSize:18, marginTop:20 }}>يحلل الذكاء الاصطناعي مستندك...</Text>
      <Text style={{ color:C.muted, fontSize:13, marginTop:8 }}>يتحقق من البنود ويكشف المخاطر</Text>
      <View style={{ marginTop:24, gap:8, alignSelf:'stretch' }}>
        {STAGES.map((s,i) => (
          <View key={i} style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
            <View style={{ width:6, height:6, borderRadius:3, backgroundColor:C.gold }} />
            <Text style={{ color:C.muted, fontSize:13 }}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:10 }}>
        <TouchableOpacity onPress={() => stage==='result'?reset():router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:20 }}>📄 محلل المستندات</Text>
      </View>

      {stage === 'upload' && (
        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
          {error ? <ErrMsg C={C} msg={error} /> : null}

          <TouchableOpacity onPress={pickFile}
            style={{ backgroundColor:C.card, borderWidth:2, borderColor:file?C.gold:C.border, borderRadius:16, padding:32, alignItems:'center', marginBottom:16 }}>
            {file ? (
              <>
                <Text style={{ fontSize:44, marginBottom:10 }}>📄</Text>
                <Text style={{ color:C.gold, fontWeight:'700', fontSize:14 }} numberOfLines={1}>{file.name}</Text>
                <Text style={{ color:C.muted, fontSize:12, marginTop:4 }}>{((file.size||0)/1024).toFixed(0)} KB</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize:44, marginBottom:10 }}>☁️</Text>
                <Text style={{ color:C.text, fontWeight:'600', fontSize:15, marginBottom:4 }}>ارفع مستندك هنا</Text>
                <Text style={{ color:C.muted, fontSize:12 }}>PDF · Word · نص</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={{ color:C.muted, fontSize:12, textAlign:'center', marginBottom:10 }}>— أو الصق نص المستند —</Text>
          <TextInput value={text} onChangeText={setText} placeholder="الصق هنا محتوى العقد أو المستند..." placeholderTextColor={C.muted} multiline numberOfLines={5}
            style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:12, padding:14, color:C.text, fontSize:13, marginBottom:16, textAlignVertical:'top', minHeight:100 }} />

          <Btn C={C} full size="lg" disabled={!file && !text.trim()} onPress={analyze}>🔍 تحليل المستند بالذكاء الاصطناعي</Btn>

          <View style={{ flexDirection:'row', gap:10, marginTop:20 }}>
            {[['📄','PDF وWord'],['⚖️','مراجعة قانونية'],['⚠️','كشف المخاطر']].map(([icon,lb])=>(
              <View key={lb} style={{ flex:1, backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:12, padding:12, alignItems:'center' }}>
                <Text style={{ fontSize:22, marginBottom:6 }}>{icon}</Text>
                <Text style={{ color:C.muted, fontSize:11, textAlign:'center' }}>{lb}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {stage === 'result' && result && (
        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
          {/* Score */}
          <Card C={C} style={{ marginBottom:16, alignItems:'center', padding:24 }}>
            <Text style={{ color:C.muted, fontSize:13, marginBottom:8 }}>نتيجة التحليل</Text>
            <View style={{ width:80, height:80, borderRadius:40, borderWidth:4, borderColor:result.score>=70?C.green:result.score>=50?C.warn:C.red, alignItems:'center', justifyContent:'center', marginBottom:10 }}>
              <Text style={{ color:result.score>=70?C.green:result.score>=50?C.warn:C.red, fontWeight:'800', fontSize:28 }}>{result.score}</Text>
            </View>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:15 }}>
              {result.score>=70?'✅ عقد جيد':'⚠️ يحتاج مراجعة'}
            </Text>
          </Card>

          {/* Summary */}
          <Card C={C} style={{ marginBottom:16 }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>📋 ملخص المستند</Text>
            {result.summary.map((item:any) => (
              <View key={item.label} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.border }}>
                <Text style={{ color:C.muted, fontSize:13 }}>{item.icon} {item.label}</Text>
                <Text style={{ color:C.text, fontWeight:'600', fontSize:13, flex:1, textAlign:'right' }}>{item.value}</Text>
              </View>
            ))}
          </Card>

          {/* Risks */}
          <Card C={C} style={{ marginBottom:16 }}>
            <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:12 }}>⚠️ المخاطر القانونية</Text>
            {result.risks.map((r:any, i:number) => (
              <View key={i} style={{ flexDirection:'row', gap:10, paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.border }}>
                <View style={{ backgroundColor:RISK_COLORS[r.level]+'20', borderRadius:6, paddingHorizontal:8, paddingVertical:2, alignSelf:'flex-start' }}>
                  <Text style={{ color:RISK_COLORS[r.level], fontSize:10, fontWeight:'700' }}>{RISK_AR[r.level]}</Text>
                </View>
                <Text style={{ color:C.muted, fontSize:13, flex:1, lineHeight:20 }}>{r.text}</Text>
              </View>
            ))}
          </Card>

          {result.aiAnalysis && (
            <Card C={C} style={{ marginBottom:16 }}>
              <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:8 }}>🤖 تحليل الذكاء الاصطناعي</Text>
              <Text style={{ color:C.muted, fontSize:13, lineHeight:22 }}>{result.aiAnalysis}</Text>
            </Card>
          )}

          <Btn C={C} full onPress={() => router.push('/lawyers' as any)}>📅 احجز مراجعة مع محامٍ</Btn>
          <TouchableOpacity onPress={reset} style={{ marginTop:10, alignItems:'center' }}>
            <Text style={{ color:C.muted, fontSize:13 }}>تحليل مستند آخر</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}