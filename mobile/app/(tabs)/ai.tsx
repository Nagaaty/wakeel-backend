import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { aiAPI, lawyersAPI, supportAPI } from '../../src/services/api';
import { useI18n } from '../../src/i18n';
import { useSelector } from 'react-redux';
import { selUser } from '../../src/store/slices/authSlice';

// ─── Topic detection ────────────────────────────────────────────────────────
const TOPIC_CATS: Record<string, string[]> = {
  criminal:   ['جنائي','جريمة','سجن','غش','سرقة','عقوبة','criminal','crime','fraud','arrest','theft'],
  family:     ['طلاق','حضانة','نفقة','زواج','ميراث','خلع','divorce','custody','alimony','marriage','inheritance'],
  corporate:  ['شركة','عقد','تجاري','أعمال','company','business','contract','commercial'],
  realestate: ['إيجار','عقار','طرد','رهن','شقة','rent','lease','property','eviction','mortgage'],
  labor:      ['فصل','راتب','عمل','موظف','fired','termination','salary','labor','employee','pension'],
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

const SPEC_MAP: Record<string, string> = {
  criminal: 'القانون الجنائي',
  family: 'الأحوال الشخصية',
  corporate: 'قانون الشركات والتجارة',
  realestate: 'قانون العقارات',
  labor: 'قانون العمل',
  civil: 'قانون مدني',
};

const QUICK = [
  { ar: 'ما حقوقي إذا طُردت من العمل؟', en: 'What are my rights if fired from work?' },
  { ar: 'كيف أرفع دعوى طلاق؟', en: 'How do I file for divorce?' },
  { ar: 'ما عقوبة الاحتيال في مصر؟', en: 'What is the penalty for fraud in Egypt?' },
  { ar: 'كيف أسجل شركة في مصر؟', en: 'How do I register a company in Egypt?' },
  { ar: 'ما حقوق المستأجر في القانون؟', en: 'What are tenant rights under Egyptian law?' },
  { ar: 'كيف أحصل على نفقة الأطفال؟', en: 'How do I get child support?' },
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  lawyers: any[];
  isError?: boolean;
}

// ─── Lawyer Mini Card ────────────────────────────────────────────────────────
function LawyerMiniCard({ lawyer, C, onBook }: any) {
  return (
    <View style={{
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      borderRadius: 12, padding: 12, flexDirection: 'row',
      alignItems: 'center', gap: 11, marginBottom: 7,
    }}>
      <View style={{
        width: 42, height: 42, borderRadius: 21, backgroundColor: C.gold,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Text style={{ color: '#000', fontWeight: '800', fontSize: 14, fontFamily: 'CormorantGaramond-Bold' }}>
          {(lawyer.name || 'LA').substring(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>
          {lawyer.name}{lawyer.is_verified ? ' ✓' : ''}
        </Text>
        <Text style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>
          ⭐ {lawyer.avg_rating || '5.0'} · {lawyer.experience_years || 0} سنة · {lawyer.city || 'القاهرة'}
        </Text>
        <Text style={{ color: C.gold, fontWeight: '700', fontSize: 12, marginTop: 1 }}>
          {lawyer.consultation_fee || 400} جنيه
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => onBook(lawyer)}
        style={{ backgroundColor: C.gold, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8, flexShrink: 0 }}
      >
        <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>احجز الآن</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function AIScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const { isRTL } = useI18n();
  const user = useSelector(selUser);

  const [messages, setMessages] = useState<Message[]>([{
    id: '0', role: 'assistant',
    content: isRTL
      ? `أهلاً ${user?.name?.split(' ')[0] || ''}! أنا المستشار القانوني الذكي لـ Wakeel 🇪🇬\n\nأستطيع مساعدتك في:\n• قانون الأسرة والطلاق والميراث\n• القانون الجنائي\n• قانون العمل والفصل التعسفي\n• قانون العقارات والإيجارات\n• تأسيس الشركات\n• القانون المدني\n\nاسألني أي سؤال قانوني!`
      : `Hello ${user?.name?.split(' ')[0] || ''}! I'm Wakeel's AI Legal Advisor 🇪🇬\n\nI can help with Egyptian law on:\n• Family law, divorce & inheritance\n• Criminal law\n• Labor law & wrongful termination\n• Real estate & rental law\n• Company registration\n• Civil law & compensation\n\nAsk me anything!`,
    lawyers: [],
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Build the system prompt with user context
  const buildSystem = () => {
    const userContext = user
      ? `The user's name is ${user.name}, role: ${user.role}.`
      : '';
    return `You are Justice Advisor — Wakeel.eg's expert AI legal assistant, specialized exclusively in Egyptian law.

${userContext}

Your expertise covers:
- Civil Code (Law 131/1948)
- Criminal/Penal Code
- Commercial Code (Law 17/1999)  
- Family & Personal Status Law (Laws 1/2000 and 10/2004)
- Labor Law (Law 12/2003)
- Real Estate registration laws
- Company Law (Law 159/1981)
- Administrative Law

RULES:
1. Answer in the same language the user writes (Arabic or English). Default to Arabic.
2. Be practical, specific, and cite relevant Egyptian law articles when possible.
3. Structure longer answers with clear sections using emojis as headers.
4. Always end by noting you are an AI and recommending a certified Egyptian lawyer for their specific case.
5. If the question involves a legal specialty where a lawyer would genuinely help, append exactly one tag at the very end: [TOPIC:criminal] [TOPIC:family] [TOPIC:labor] [TOPIC:realestate] [TOPIC:corporate] [TOPIC:civil]
6. If the user is angry, distressed, or urgently needs help, acknowledge their feelings first before giving legal info.
7. Never refuse to answer legal questions about Egypt. Always try to help.`;
  };

  const fetchMatchingLawyers = async (topic: string | null) => {
    if (!topic) return [];
    try {
      const spec = SPEC_MAP[topic];
      const d: any = await lawyersAPI.list({ cat: spec, limit: 3, sort: 'rating' });
      return (d?.lawyers || d?.data || []).slice(0, 3);
    } catch { return []; }
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content, lawyers: [] };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role as any, content: m.content }));
      const d: any = await aiAPI.chat(history, buildSystem());
      let reply = d.reply || d.text || 'عذراً، حاول مرة أخرى.';

      // Extract topic tag
      let topic: string | null = null;
      const tagMatch = reply.match(/\[TOPIC:(\w+)\]/);
      if (tagMatch) { topic = tagMatch[1]; reply = reply.replace(/\[TOPIC:\w+\]/g, '').trim(); }
      if (!topic) topic = detectTopic(content + ' ' + reply);

      // Fetch real lawyers from DB matching the topic
      const lawyers = await fetchMatchingLawyers(topic);

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        lawyers,
      }]);
    } catch (e: any) {
      const isNotConfigured = e?.message?.includes('not configured') || e?.message?.includes('ANTHROPIC');
      const topic = detectTopic(content);
      const lawyers = await fetchMatchingLawyers(topic);

      if (isNotConfigured) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '⚠️ خدمة الذكاء الاصطناعي غير مُفعّلة بعد.\n\nيمكنك التحدث مع أحد محامينا المعتمدين مباشرة 👇',
          lawyers,
          isError: true,
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '⚠️ حدث خطأ مؤقت. يمكنك إعادة المحاولة أو التحدث مع محامٍ مباشرة.',
          lawyers,
          isError: true,
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const escalateToHuman = async () => {
    try {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      await supportAPI.createTicket({
        subject: 'طلب مساعدة من المستشار الذكي',
        message: lastUserMsg?.content || 'المستخدم يطلب مساعدة بشرية',
        category: 'legal_advice',
      });
      Alert.alert('✅', 'تم تحويلك لفريق الدعم. سيتواصل معك محامٍ قريباً!');
    } catch {
      router.push('/support' as any);
    }
  };

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
  }, [messages, loading]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={{ marginBottom: 14, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: isUser ? 'flex-end' : 'flex-start', gap: 8 }}>
          {!isUser && (
            <View style={{
              width: 34, height: 34, borderRadius: 10,
              backgroundColor: item.isError ? '#EF4444' : C.gold,
              alignItems: 'center', justifyContent: 'center',
              alignSelf: 'flex-end', marginBottom: 2, flexShrink: 0,
            }}>
              <Text style={{ fontSize: 18 }}>{item.isError ? '⚠️' : '⚖️'}</Text>
            </View>
          )}
          <View style={{
            maxWidth: '82%',
            backgroundColor: isUser ? C.gold : C.card,
            borderRadius: 18,
            borderBottomRightRadius: isUser ? 4 : 18,
            borderBottomLeftRadius: isUser ? 18 : 4,
            padding: 13,
            borderWidth: isUser ? 0 : 1,
            borderColor: item.isError ? '#EF444440' : C.border,
          }}>
            <Text style={{ color: isUser ? '#000' : C.text, fontSize: 13, lineHeight: 22 }}>
              {item.content}
            </Text>
          </View>
        </View>

        {/* Real lawyer cards from DB */}
        {!isUser && item.lawyers.length > 0 && (
          <View style={{ marginTop: 10, marginLeft: 42 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
              ⚡ محامون متخصصون في قضيتك
            </Text>
            {item.lawyers.map((l: any) => (
              <LawyerMiniCard
                key={l.id}
                lawyer={l}
                C={C}
                onBook={(lawyer: any) => router.push({ pathname: '/book', params: { lawyer: lawyer.id } } as any)}
              />
            ))}
            <Text style={{ fontSize: 10, color: C.muted, fontStyle: 'italic', marginTop: 4 }}>
              ⚠️ معلومات عامة — استشر محامياً معتمداً لحالتك.
            </Text>
          </View>
        )}

        {/* Escalate to human button on error messages */}
        {!isUser && item.isError && (
          <TouchableOpacity
            onPress={escalateToHuman}
            style={{
              marginTop: 8, marginLeft: 42,
              backgroundColor: '#1a1a2e', borderRadius: 10,
              paddingVertical: 10, paddingHorizontal: 16,
              flexDirection: 'row', alignItems: 'center', gap: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>👨‍⚖️</Text>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>تحدث مع محامٍ بشري</Text>
          </TouchableOpacity>
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
      {/* Header */}
      <View style={{
        backgroundColor: '#1a1a2e',
        paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 14,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <View style={{
          width: 42, height: 42, borderRadius: 12,
          backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center',
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
        <TouchableOpacity onPress={escalateToHuman} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20 }}>👨‍⚖️</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
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

      {/* Typing indicator */}
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
              <View key={j} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.gold, opacity: 0.6 + j * 0.2 }} />
            ))}
          </View>
        </View>
      )}

      {/* Quick questions — only at start */}
      {messages.length <= 2 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
            أسئلة شائعة
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {QUICK.map(q => (
              <TouchableOpacity key={q.ar} onPress={() => send(isRTL ? q.ar : q.en)}
                style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ color: C.text, fontSize: 11 }}>{isRTL ? q.ar : q.en}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Input */}
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
          placeholder={isRTL ? 'اسأل عن أي موضوع قانوني...' : 'Ask any legal question...'}
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
