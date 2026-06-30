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
import { selUser } from '../../src/features/auth/authSlice';

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
  criminal: 'جنائي',
  family: 'أسرة',
  corporate: 'شركات',
  realestate: 'عقار',
  labor: 'عمل',
  civil: 'مدني',
};

const QUICK = [
  { ar: 'عندي قضية طلاق ونفقة وأبحث عن محامٍ', en: 'I have a divorce and alimony case and need a lawyer' },
  { ar: 'أريد تأسيس شركة تجارية جديدة في مصر', en: 'I want to register a new commercial company in Egypt' },
  { ar: 'حدثت مشكلة في العمل وتم فصلي تعسفياً', en: 'I had an issue at work and was wrongfully terminated' },
  { ar: 'أحتاج لمحامٍ لمراجعة عقد إيجار شقة', en: 'I need a lawyer to review a property rental contract' },
  { ar: 'أبحث عن محامٍ جنائي شاطر لقضية جنحة', en: 'I am looking for a criminal lawyer for a misdemeanor' },
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  lawyers: any[];
  isError?: boolean;
  topic?: string | null;
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
        <Text style={{ color: '#000', fontWeight: '800', fontSize: 14, fontFamily: 'Cairo-Bold' }}>
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
      ? `أهلاً ${user?.name?.split(' ')[0] || ''}! أنا مساعدك الذكي لمطابقة وتوصية المحامين المناسبين لقضيتك 🤖\n\nأخبرني بكلماتك الخاصة عن مشكلتك أو قضيتك القانونية، وسأقوم بتحليلها فوراً لأرشح لك أفضل المحامين المعتمدين المتخصصين لمساعدتك!`
      : `Hello ${user?.name?.split(' ')[0] || ''}! I'm your AI Lawyer Matcher & Recommendation assistant 🤖\n\nSimply describe your legal case or situation, and I will analyze it to recommend the best certified lawyers to help you immediately!`,
    lawyers: [],
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSorts, setActiveSorts] = useState<Record<string, string>>({});

  const handleSortChange = async (msgId: string, topic: string | null, sortType: string) => {
    setActiveSorts(prev => ({ ...prev, [msgId]: sortType }));
    const spec = topic ? SPEC_MAP[topic] : null;
    let list: any[] = [];
    try {
      let d: any;
      if (spec) {
        d = await lawyersAPI.list({ cat: spec, limit: 3, sort: sortType }).catch(() => null);
      }
      list = (d?.lawyers || d?.data || []);
      if (list.length === 0) {
        const fallbackRes: any = await lawyersAPI.list({ limit: 3, sort: sortType }).catch(() => null);
        list = (fallbackRes?.lawyers || fallbackRes?.data || []);
      }
      list = list.slice(0, 3);
    } catch {
      list = [];
    }
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, lawyers: list } : m));
  };

  // Build the system prompt with user context
  const buildSystem = () => {
    const userContext = user
      ? `The user's name is ${user.name}, role: ${user.role}.`
      : '';
    return `You are Wakeel AI (مساعد وكيل الذكي) — a smart matching assistant for Wakeel.eg, Egypt's premier legal marketplace.

${userContext}

Your ONLY job is to analyze the client's legal issue, identify which area of Egyptian law it belongs to, and guide them to consult the recommended specialists below.

STRICT RULES:
1. NEVER give detailed legal advice, cite specific legal articles, or attempt to solve the client's case yourself.
2. Politely acknowledge their situation in the same language they write (Arabic or English). Default to Arabic.
3. Clearly identify the legal specialty (e.g., Family Law / الأحوال الشخصية, Criminal Law / القانون الجنائي, Labor Law / قانون العمل, Corporate & Commercial / قانون الشركات والتجارة, Real Estate / قانون العقارات, Civil Law / قانون مدني).
4. Keep your response friendly and brief (under 3-4 sentences). 
5. Tell them they should consult one of the recommended verified specialists listed below to get official, safe legal advice.
6. Append exactly one tag at the very end of your response to trigger the backend filter: [TOPIC:criminal] [TOPIC:family] [TOPIC:labor] [TOPIC:realestate] [TOPIC:corporate] [TOPIC:civil]`;
  };

  const fetchMatchingLawyers = async (topic: string | null) => {
    try {
      const spec = topic ? SPEC_MAP[topic] : null;
      let d: any;
      if (spec) {
        d = await lawyersAPI.list({ cat: spec, limit: 3, sort: 'rating' }).catch(() => null);
      }
      
      let list = (d?.lawyers || d?.data || []);
      if (list.length === 0) {
        // Fallback: get any top-rated lawyers if specific category is empty or query failed
        const fallbackRes: any = await lawyersAPI.list({ limit: 3, sort: 'rating' }).catch(() => null);
        list = (fallbackRes?.lawyers || fallbackRes?.data || []);
      }
      
      return list.slice(0, 3);
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
        topic,
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
          topic,
          isError: true,
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '⚠️ حدث خطأ مؤقت. يمكنك إعادة المحاولة أو التحدث مع محامٍ مباشرة.',
          lawyers,
          topic,
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
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
              ⚡ ترشيحات المحامين الأكثر ملاءمة لقضيتك:
            </Text>

            {/* Sorting Pills */}
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={() => handleSortChange(item.id, item.topic || null, 'rating')}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
                  backgroundColor: (activeSorts[item.id] || 'rating') === 'rating' ? C.gold : '#1a1a2e',
                  borderWidth: 1, borderColor: (activeSorts[item.id] || 'rating') === 'rating' ? C.gold : C.border,
                }}
              >
                <Text style={{ fontSize: 11, color: (activeSorts[item.id] || 'rating') === 'rating' ? '#000' : C.text, fontWeight: 'bold' }}>
                  ⭐ الأعلى تقييماً
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleSortChange(item.id, item.topic || null, 'price_asc')}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
                  backgroundColor: (activeSorts[item.id] || 'rating') === 'price_asc' ? C.gold : '#1a1a2e',
                  borderWidth: 1, borderColor: (activeSorts[item.id] || 'rating') === 'price_asc' ? C.gold : C.border,
                }}
              >
                <Text style={{ fontSize: 11, color: (activeSorts[item.id] || 'rating') === 'price_asc' ? '#000' : C.text, fontWeight: 'bold' }}>
                  💸 الأنسب سعراً
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleSortChange(item.id, item.topic || null, 'experience')}
                style={{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
                  backgroundColor: (activeSorts[item.id] || 'rating') === 'experience' ? C.gold : '#1a1a2e',
                  borderWidth: 1, borderColor: (activeSorts[item.id] || 'rating') === 'experience' ? C.gold : C.border,
                }}
              >
                <Text style={{ fontSize: 11, color: (activeSorts[item.id] || 'rating') === 'experience' ? '#000' : C.text, fontWeight: 'bold' }}>
                  💼 الأكثر خبرة
                </Text>
              </TouchableOpacity>
            </View>

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
