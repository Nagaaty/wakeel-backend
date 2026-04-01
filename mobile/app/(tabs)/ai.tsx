import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { aiAPI } from '../../src/services/api';
import { Avatar, Stars } from '../../src/components/ui';
import { useI18n } from '../../src/i18n';

// ─── Lawyer data matching reference exactly ────────────────────────────────────
const LAWYERS = [
  { id:1, name:'Dr. Ahmed Hassan',   initials:'AH', cat:4, rating:4.9, exp:18, price:500,  city:'Cairo',       verified:true  },
  { id:2, name:'Dr. Nadia El-Masri', initials:'NE', cat:1, rating:4.8, exp:14, price:650,  city:'Alexandria',  verified:true  },
  { id:3, name:'Khaled Mansour',     initials:'KM', cat:2, rating:4.7, exp:9,  price:400,  city:'Cairo',       verified:true  },
  { id:4, name:'Sara Fouad',         initials:'SF', cat:3, rating:4.6, exp:6,  price:350,  city:'Giza',        verified:true  },
  { id:5, name:'Dr. Omar Shafik',    initials:'OS', cat:5, rating:4.9, exp:22, price:800,  city:'Cairo',       verified:true  },
  { id:6, name:'Layla Ibrahim',      initials:'LI', cat:6, rating:4.5, exp:4,  price:300,  city:'Cairo',       verified:false },
];

// Topic → category id → filter lawyers (matches reference getLawyers exactly)
const TOPIC_CAT_ID: Record<string, number> = {
  criminal: 4, family: 1, corporate: 2,
  realestate: 3, labor: 5, civil: 6,
};

const TOPIC_CATS: Record<string, string[]> = {
  criminal:   ['جنائي','جريمة','سجن','غش','سرقة','عقوبة','criminal','crime','fraud','arrest'],
  family:     ['طلاق','حضانة','نفقة','زواج','ميراث','خلع','divorce','custody','alimony','marriage'],
  corporate:  ['شركة','عقد','تجاري','أعمال','company','business','contract','commercial'],
  realestate: ['إيجار','عقار','طرد','رهن','شقة','rent','lease','property','eviction'],
  labor:      ['فصل','راتب','عمل','موظف','fired','termination','salary','labor','employee'],
  civil:      ['دين','قرض','تعويض','دعوى','debt','loan','compensation','lawsuit','damages'],
};

function detectTopic(text: string): string | null {
  const lower = text.toLowerCase();
  let best: string | null = null, bestN = 0;
  Object.entries(TOPIC_CATS).forEach(([topic, kws]) => {
    const n = kws.filter(k => lower.includes(k)).length;
    if (n > bestN) { bestN = n; best = topic; }
  });
  return bestN > 0 ? best : null;
}

function getLawyers(topic: string | null) {
  if (!topic) return [];
  const catId = TOPIC_CAT_ID[topic];
  if (!catId) return [];
  return LAWYERS.filter(l => l.cat === catId)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3);
}

const QUICK = [
  'ما حقوقي إذا طُردت من العمل؟',
  'كيف أرفع دعوى طلاق؟',
  'ما عقوبة الاحتيال في القانون المصري؟',
  'كيف أسجل شركة في مصر؟',
  'ما حقوق المستأجر في مصر؟',
  'كيف أحصل على نفقة الأطفال؟',
];

const SYSTEM = `You are a specialized AI legal assistant for Wakeel.eg, Egypt's #1 legal marketplace.
Answer questions about Egyptian law in Arabic — clearly, practically, and concisely.
Focus on Egyptian law specifically (Civil Code, Labor Law No.12/2003, Personal Status Law, Criminal Code, etc).
Always advise consulting a certified Egyptian lawyer for complex matters.
If the question involves a legal specialty, end your response with exactly one of:
[TOPIC:criminal] [TOPIC:family] [TOPIC:labor] [TOPIC:realestate] [TOPIC:corporate] [TOPIC:civil]
Only add the tag when a specialist lawyer would genuinely help.`;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  lawyers: typeof LAWYERS;
}

// ─── Lawyer mini-card — matches reference exactly ──────────────────────────────
function LawyerMiniCard({ lawyer, C, onBook }: any) {
  const serif = { fontFamily: 'CormorantGaramond-Bold' };
  return (
    <View style={{
      backgroundColor: C.card,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 12, padding: 12,
      flexDirection: 'row', alignItems: 'center', gap: 11,
      marginBottom: 7,
    }}>
      {/* Avatar */}
      <View style={{
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: C.gold,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Text style={{ ...serif, color: '#000', fontWeight: '800', fontSize: 14 }}>
          {lawyer.initials}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>
          {lawyer.name}{lawyer.verified ? ' ✓' : ''}
        </Text>
        <Text style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>
          ⭐ {lawyer.rating} · {lawyer.exp} سنة · {lawyer.city}
        </Text>
        <Text style={{ color: C.gold, fontWeight: '700', fontSize: 12, marginTop: 1 }}>
          {lawyer.price} جنيه
        </Text>
      </View>

      {/* Book button — matches reference style */}
      <TouchableOpacity
        onPress={() => onBook(lawyer)}
        style={{
          backgroundColor: C.gold,
          borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8,
          flexShrink: 0,
        }}
      >
        <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>احجز الآن</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AIScreen() {
  const C       = useTheme();
  const insets  = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0', role: 'assistant',
      content: 'أهلاً! أنا المستشار القانوني الذكي لـ Wakeel\n\nأستطيع مساعدتك في قانون الأسرة، الجنائي، العمل، العقارات، الشركات، والمدني.\n\nاسألني أي سؤال قانوني!',
      lawyers: [],
    }
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, lawyers: [] };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role as any, content: m.content }));
      const d: any  = await aiAPI.chat(history, SYSTEM);
      let reply     = d.reply || d.text || 'عذراً، حاول مرة أخرى.';

      // Extract [TOPIC:xxx] tag from reply (matches reference exactly)
      let topic: string | null = null;
      const tagMatch = reply.match(/\[TOPIC:(\w+)\]/);
      if (tagMatch) { topic = tagMatch[1]; reply = reply.replace(/\[TOPIC:\w+\]/g, '').trim(); }
      if (!topic) topic = detectTopic(content + ' ' + reply);

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        lawyers: getLawyers(topic),
      }]);
    } catch {
      const topic = detectTopic(content);
      setMessages(prev => [...prev, {
        id:      (Date.now() + 1).toString(),
        role:    'assistant',
        content: '⚠️ خدمة الذكاء الاصطناعي غير متاحة حالياً.\n\nيمكنك التحدث مع أحد محامينا المعتمدين مباشرة.',
        lawyers: getLawyers(topic),
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
  }, [messages, loading]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={{ marginBottom: 14, paddingHorizontal: 16 }}>
        {/* Bubble row */}
        <View style={{ flexDirection: 'row', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: 8 }}>
          {/* AI avatar (left side) */}
          {!isUser && (
            <View style={{
              width: 34, height: 34, borderRadius: 10,
              backgroundColor: C.gold,
              alignItems: 'center', justifyContent: 'center',
              alignSelf: 'flex-end', marginBottom: 2, flexShrink: 0,
            }}>
              <Text style={{ fontSize: 18 }}>⚖️</Text>
            </View>
          )}

          {/* Message bubble — matches reference border-radius pattern */}
          <View style={{
            maxWidth: '82%',
            backgroundColor: isUser ? C.gold : C.card,
            borderRadius: 18,
            borderBottomRightRadius: isUser ? 4 : 18,
            borderBottomLeftRadius: isUser ? 18 : 4,
            padding: 13,
            borderWidth: isUser ? 0 : 1,
            borderColor: C.border,
          }}>
            <Text style={{ color: isUser ? '#000' : C.text, fontSize: 13, lineHeight: 22 }}>
              {item.content}
            </Text>
          </View>
        </View>

        {/* ── Lawyer mini-cards — matches reference exactly ── */}
        {!isUser && item.lawyers.length > 0 && (
          <View style={{ marginTop: 10, marginLeft: 42 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
              ⚡ محامون متخصصون في قضيتك
            </Text>
            {item.lawyers.map(l => (
              <LawyerMiniCard
                key={l.id}
                lawyer={l}
                C={C}
                onBook={(lawyer: any) => router.push({ pathname: '/book', params: { lawyer: lawyer.id } } as any)}
              />
            ))}
            <Text style={{ fontSize: 10, color: C.muted, fontStyle: 'italic', marginTop: 4 }}>
              ⚠️ معلومات عامة — استشر محامياً معتمداً.
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: C.bg }}
      keyboardVerticalOffset={0}
    >
      {/* Header — dark gradient matching reference */}
      <View style={{
        backgroundColor: '#1a1a2e',
        paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 14,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <View style={{
          width: 42, height: 42, borderRadius: 12,
          backgroundColor: C.gold,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 22 }}>⚖️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>المستشار القانوني الذكي</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22C55E' }} />
            <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '600' }}>متاح الآن • Claude AI</Text>
          </View>
        </View>
      </View>

      {/* Message list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{ paddingVertical: 16 }}
        style={{ flex: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      />

      {/* Typing indicator — 3 animated dots matching reference */}
      {loading && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Text>⚖️</Text>
          </View>
          <View style={{
            backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
            borderRadius: 18, borderBottomLeftRadius: 4,
            paddingHorizontal: 16, paddingVertical: 12,
            flexDirection: 'row', gap: 5, alignItems: 'center',
          }}>
            {[0, 1, 2].map(j => (
              <View key={j} style={{
                width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.gold, opacity: 0.6 + j * 0.2,
              }} />
            ))}
          </View>
        </View>
      )}

      {/* Quick questions — shown only at start */}
      {messages.length <= 2 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
            أسئلة شائعة
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {QUICK.map(q => (
              <TouchableOpacity key={q} onPress={() => send(q)}
                style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ color: C.text, fontSize: 11 }}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Input row */}
      <View style={{
        backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
        paddingHorizontal: 16, paddingTop: 12,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
        flexDirection: 'row', gap: 10, alignItems: 'flex-end',
      }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send()}
          placeholder="اسأل عن أي موضوع قانوني..."
          placeholderTextColor={C.muted}
          multiline
          style={{
            flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
            borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
            color: C.text, fontSize: 14, maxHeight: 100,
          }}
        />
        <TouchableOpacity
          onPress={() => send()}
          disabled={!input.trim() || loading}
          style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: input.trim() && !loading ? C.gold : C.dim,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 18, color: input.trim() && !loading ? '#000' : C.muted }}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
        <Text style={{ color: C.muted, fontSize: 10, textAlign: 'center' }}>
          معلومات قانونية عامة فقط • استشر محامياً معتمداً للحالات المعقدة
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
