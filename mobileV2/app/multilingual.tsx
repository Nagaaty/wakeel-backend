import React, { useState, useRef, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform,
  InteractionManager,} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { aiAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

const QUICK: Record<string,string[]> = {
  ar: ['ما هي حقوقي كموظف؟','إزاي أرفع قضية طلاق؟','ما عقوبة الاحتيال في مصر؟','عقدي صح ولا لأ؟'],
  en: ['What are my rights as employee?','How long does divorce take?','Is my contract valid?','What is the eviction process?'],
};
const GREET: Record<string,string> = {
  ar: '👋 أهلاً! أنا مساعد Wakeel الذكي. اسألني أي سؤال قانوني بالعربية أو العامية المصرية.',
  en: '👋 Welcome! I am Wakeel AI. Ask me anything about Egyptian law in English or Arabic.',
};
const FALLBACK: Record<string,string[]> = {
  ar: ['بموجب القانون المصري، لك الحق في...','استناداً للمادة من القانون المدني...','أنصحك باستشارة محامٍ موثق لهذه القضية.'],
  en: ['Under Egyptian law, you have the right to...','Based on Egyptian Civil Code Article...','I recommend consulting a verified lawyer for this.'],
};

export default function MultilingualBotScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const [lang,   setLang]   = useState<'ar'|'en'>('ar');
  const [msgs,   setMsgs]   = useState([{ id: 1, from: 'bot', text: GREET.ar }]);
  const [input,  setInput]  = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => task.cancel();
  }, [msgs, typing]);

  const switchLang = () => {
    const nl: 'ar'|'en' = lang === 'ar' ? 'en' : 'ar';
    setLang(nl);
    setMsgs([{ id: Date.now(), from: 'bot', text: GREET[nl] }]);
    setInput('');
  };

  const send = async (txt?: string) => {
    const text = txt || input.trim();
    if (!text) return;
    setInput('');
    const userMsg = { id: Date.now(), from: 'user', text };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setTyping(true);
    try {
      const history = newMsgs.map(m => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text })) as any[];
      const system = lang === 'ar'
        ? 'أنت مساعد قانوني متخصص في القانون المصري. أجب بالعربية بشكل واضح وعملي. يمكنك فهم العامية المصرية.'
        : 'You are a legal assistant specializing in Egyptian law. Answer in English clearly and practically.';
      const data: any = await aiAPI.chat(history, system);
      setMsgs(m => [...m, { id: Date.now()+1, from: 'bot', text: data.reply || data.text || 'عذراً، حاول مرة أخرى.' }]);
    } catch {
      const r = FALLBACK[lang][Math.floor(Math.random()*3)];
      setMsgs(m => [...m, { id: Date.now()+1, from: 'bot', text: r }]);
    } finally { setTyping(false); }
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor:'#1a1a2e', paddingTop:insets.top+10, paddingHorizontal:16, paddingBottom:14, flexDirection:'row', alignItems:'center', gap:12 }}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color:'#aaa', fontSize:22 }}>‹</Text></TouchableOpacity>
        <View style={{ width:42, height:42, borderRadius:12, backgroundColor:C.gold, alignItems:'center', justifyContent:'center' }}>
          <Text style={{ fontSize:22 }}>🤖</Text>
        </View>
        <View style={{ flex:1 }}>
          <Text style={{ color:'#fff', fontWeight:'700', fontSize:15 }}>Wakeel AI — مساعد قانوني</Text>
          <Text style={{ color:'#22C55E', fontSize:11 }}>● متاح · عربي وإنجليزي</Text>
        </View>
        <TouchableOpacity onPress={switchLang}
          style={{ backgroundColor:C.gold+'25', borderWidth:1, borderColor:C.gold+'44', borderRadius:8, paddingHorizontal:12, paddingVertical:6 }}>
          <Text style={{ color:C.gold, fontWeight:'700', fontSize:12 }}>{lang==='ar'?'🌐 English':'🌐 عربي'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={{ flex:1 }}>
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding:16, gap:12 }}
          style={{ flex:1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
          ListFooterComponent={typing ? (
            <View style={{ flexDirection:'row', justifyContent:'flex-start', gap:8 }}>
              <View style={{ width:32, height:32, borderRadius:9, backgroundColor:C.gold, alignItems:'center', justifyContent:'center' }}>
                <Text>🤖</Text>
              </View>
              <View style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:18, padding:12, flexDirection:'row', gap:4 }}>
                {[0,1,2].map(i=><View key={i} style={{ width:7, height:7, borderRadius:4, backgroundColor:C.gold, opacity:0.5+(i*0.2) }} />)}
              </View>
            </View>
          ) : null}
          renderItem={({ item: m }) => {
            const isMine = m.from === 'user';
            return (
              <View style={{ flexDirection:'row', justifyContent:isMine?'flex-end':'flex-start', gap:8 }}>
                {!isMine && (
                  <View style={{ width:32, height:32, borderRadius:9, backgroundColor:C.gold, alignItems:'center', justifyContent:'center', alignSelf:'flex-end' }}>
                    <Text>🤖</Text>
                  </View>
                )}
                <View style={{ maxWidth:'80%', backgroundColor:isMine?C.gold:C.card, padding:12, borderRadius:18, borderBottomRightRadius:isMine?4:18, borderBottomLeftRadius:isMine?18:4, borderWidth:isMine?0:1, borderColor:C.border }}>
                  <Text style={{ color:isMine?'#fff':C.text, fontSize:13, lineHeight:21 }}>{m.text}</Text>
                </View>
              </View>
            );
          }}
        />

        {/* Quick questions */}
        {msgs.length <= 2 && (
          <View style={{ paddingHorizontal:16, paddingBottom:8 }}>
            <Text style={{ color:C.muted, fontSize:11, fontWeight:'700', marginBottom:8 }}>أسئلة شائعة</Text>
            <FlatList horizontal data={QUICK[lang]} keyExtractor={q=>q} showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap:8 }}
              renderItem={({ item:q }) => (
                <TouchableOpacity onPress={() => send(q)}
                  style={{ backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:20, paddingHorizontal:12, paddingVertical:6 }}>
                  <Text style={{ color:C.text, fontSize:11 }}>{q}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Input */}
        <View style={{ backgroundColor:C.surface, borderTopWidth:1, borderTopColor:C.border, paddingHorizontal:12, paddingVertical:10, paddingBottom:insets.bottom+10, flexDirection:'row', gap:10 }}>
          <TextInput value={input} onChangeText={setInput} onSubmitEditing={() => send()} returnKeyType="send"
            placeholder={lang==='ar'?'اسألني أي سؤال قانوني...':'Ask any legal question...'}
            placeholderTextColor={C.muted}
            style={{ flex:1, backgroundColor:C.card, borderWidth:1, borderColor:C.border, borderRadius:22, paddingHorizontal:14, paddingVertical:10, color:C.text, fontSize:14 }} />
          <TouchableOpacity onPress={() => send()} disabled={!input.trim()||typing}
            style={{ width:44, height:44, borderRadius:22, backgroundColor:!input.trim()||typing?C.dim:C.gold, alignItems:'center', justifyContent:'center' }}>
            <Text style={{ color:'#fff', fontSize:18 }}>→</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ textAlign:'center', fontSize:10, color:C.muted, paddingBottom:insets.bottom+4 }}>معلومات عامة فقط · استشر محامياً للحالات المعقدة</Text>
      </KeyboardAvoidingView>
    </View>
  );
}