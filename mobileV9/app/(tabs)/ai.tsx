import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, Modal,
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
  sortType?: string;
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
  
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minExp, setMinExp] = useState<number>(0);
  const [selectedSort, setSelectedSort] = useState<string>('rating');

  const openFilterModal = (msgId: string, currentTopic: string | null) => {
    setActiveMsgId(msgId);
    
    // Default to the user's city if not set yet
    if (!selectedCity && user?.city) {
      setSelectedCity(user.city);
    }
    
    setFilterModalVisible(true);
  };

  const applyFilters = async () => {
    if (!activeMsgId) return;
    setFilterModalVisible(false);

    const msg = messages.find(m => m.id === activeMsgId);
    if (!msg) return;

    const topic = msg.topic || null;
    const spec = topic ? SPEC_MAP[topic] : null;

    let list: any[] = [];
    try {
      const params: any = {
        limit: 3,
        sort: selectedSort,
      };
      if (spec) params.cat = spec;
      if (selectedCity) params.city = selectedCity;
      if (maxPrice) params.maxPrice = maxPrice;
      if (minExp) params.minExperience = minExp;

      const d = await lawyersAPI.list(params).catch(() => null);
      list = (d?.lawyers || d?.data || []);
      
      if (list.length === 0) {
        // Fallback: relax filters to get matching lawyers
        const fallbackParams: any = { limit: 3, sort: selectedSort };
        if (spec) fallbackParams.cat = spec;
        const fallbackRes = await lawyersAPI.list(fallbackParams).catch(() => null);
        list = (fallbackRes?.lawyers || fallbackRes?.data || []);
      }
      list = list.slice(0, 3);
    } catch {
      list = [];
    }

    setMessages(prev => prev.map(m => m.id === activeMsgId ? { ...m, lawyers: list } : m));
  };

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

Your job is to analyze the client's legal issue, identify the area of Egyptian law, ask how they want to sort the recommendations, and then match them with lawyers.

CONVERSATION FLOW:
1. When the client first describes their legal issue, politely acknowledge their situation, identify the legal specialty, and ask them if they want to sort the recommended lawyers by:
   - 1. Highest Rated (التقييم الأعلى)
   - 2. Budget Friendly (الأنسب سعراً)
   - 3. Most Experienced (الأكثر خبرة)
   At the very end of your response, append the tag: [ASK_SORT:specialty] (where specialty is one of: criminal, family, labor, realestate, corporate, civil). Do NOT append any other tags.

2. When the user responds with their sorting preference (e.g. "Highest Rated", "Budget", "Experience"), reply briefly and append the tag: [TOPIC:specialty:sort_type] at the very end of your response.
   - specialty: one of: criminal, family, labor, realestate, corporate, civil.
   - sort_type: rating (for highest rated), price_asc (for budget/cheap), experience (for most experienced).
   Example: [TOPIC:labor:price_asc] or [TOPIC:family:rating].

STRICT RULES:
1. NEVER give detailed legal advice, cite specific legal articles, or attempt to solve the client's case yourself.
2. Politely respond in the same language they write (Arabic or English). Default to Arabic.
3. Keep your responses friendly and brief (under 3 sentences).`;
  };

  const fetchMatchingLawyers = async (topic: string | null, sortType: string = 'rating') => {
    try {
      const spec = topic ? SPEC_MAP[topic] : null;
      let d: any;
      const params: any = { limit: 3, sort: sortType };
      if (spec) params.cat = spec;
      // Prioritize regional matches based on user's city
      if (user?.city) params.city = user.city;

      if (spec) {
        d = await lawyersAPI.list(params).catch(() => null);
      }
      
      let list = (d?.lawyers || d?.data || []);
      if (list.length === 0) {
        // Fallback: relax city filter to find any matching specialists nationally
        if (params.city) {
          delete params.city;
          const fallbackRes = await lawyersAPI.list(params).catch(() => null);
          list = (fallbackRes?.lawyers || fallbackRes?.data || []);
        }
      }
      
      if (list.length === 0) {
        // Absolute fallback: get any top-rated lawyers
        const absoluteFallback = await lawyersAPI.list({ limit: 3, sort: sortType }).catch(() => null);
        list = (absoluteFallback?.lawyers || absoluteFallback?.data || []);
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

      let topic: string | null = null;
      let sortType: string = 'rating';
      let lawyers: any[] = [];
      let isWaitingForSort = false;

      // Check for ASK_SORT tag first
      const askSortMatch = reply.match(/\[ASK_SORT:(\w+)\]/);
      if (askSortMatch) {
        topic = askSortMatch[1];
        isWaitingForSort = true;
        reply = reply.replace(/\[ASK_SORT:\w+\]/g, '').trim();
      } else {
        // Check for TOPIC tag with sort
        const topicMatch = reply.match(/\[TOPIC:(\w+):?(\w+)?\]/);
        if (topicMatch) {
          topic = topicMatch[1];
          sortType = topicMatch[2] || 'rating';
          reply = reply.replace(/\[TOPIC:\w+:?\w*\]/g, '').trim();
          
          // Fetch lawyers with the specified sort type
          lawyers = await fetchMatchingLawyers(topic, sortType);
        } else {
          // Fallback detection
          topic = detectTopic(content + ' ' + reply);
          lawyers = await fetchMatchingLawyers(topic);
        }
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        lawyers,
        topic,
        sortType: isWaitingForSort ? 'ask' : sortType,
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
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, flex: 1 }}>
                ⚡ ترشيحات المحامين الأكثر ملاءمة لقضيتك:
              </Text>
              <TouchableOpacity
                onPress={() => openFilterModal(item.id, item.topic || null)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                  borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
                }}
              >
                <Text style={{ fontSize: 11 }}>⚙️</Text>
                <Text style={{ color: C.text, fontSize: 10, fontWeight: 'bold' }}>
                  {isRTL ? 'تصفية وترتيب' : 'Filter / Sort'}
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

      {/* Quick Sorting replies */}
      {(() => {
        const lastMsg = messages[messages.length - 1];
        const isWaitingForSort = lastMsg && lastMsg.role === 'assistant' && lastMsg.sortType === 'ask';
        if (!isWaitingForSort) return null;
        return (
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 }}>
              {isRTL ? 'اختر ترتيب التوصيات:' : 'Select recommendation order:'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={() => send(isRTL ? 'الأعلى تقييماً' : 'Highest Rated')}
                style={{ backgroundColor: C.gold, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
              >
                <Text style={{ color: '#000', fontSize: 12, fontWeight: 'bold' }}>⭐ {isRTL ? 'الأعلى تقييماً' : 'Top Rated'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => send(isRTL ? 'الأنسب سعراً' : 'Budget Friendly')}
                style={{ backgroundColor: C.gold, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
              >
                <Text style={{ color: '#000', fontSize: 12, fontWeight: 'bold' }}>💸 {isRTL ? 'الأنسب سعراً' : 'Budget'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => send(isRTL ? 'الأكثر خبرة' : 'Most Experienced')}
                style={{ backgroundColor: C.gold, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
              >
                <Text style={{ color: '#000', fontSize: 12, fontWeight: 'bold' }}>💼 {isRTL ? 'الأكثر خبرة' : 'Experience'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

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

      {/* Filter Bottom Sheet Modal */}
      <Modal
        visible={filterModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: C.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 24,
            maxHeight: '80%',
          }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: 'bold' }}>
                {isRTL ? 'تصفية وترتيب المحامين' : 'Filter & Sort Lawyers'}
              </Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Text style={{ color: C.muted, fontSize: 18, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* City Selection */}
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              {isRTL ? 'المنطقة / المحافظة:' : 'Region / City:'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {['', 'Cairo', 'Giza', 'Alexandria', 'Mansoura', 'Tanta'].map(city => (
                <TouchableOpacity
                  key={city}
                  onPress={() => setSelectedCity(city)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
                    backgroundColor: selectedCity === city ? C.gold : C.surface,
                    borderWidth: 1, borderColor: selectedCity === city ? C.gold : C.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: selectedCity === city ? '#000' : C.text, fontWeight: '600' }}>
                    {city === '' ? (isRTL ? 'كل المدن' : 'All Cities') : city}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Price Selection */}
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              {isRTL ? 'الحد الأقصى لسعر الاستشارة:' : 'Max Consultation Fee:'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {[{ label: isRTL ? 'أي سعر' : 'Any', val: null }, { label: '300 ج.م', val: 300 }, { label: '600 ج.م', val: 600 }, { label: '1000 ج.م', val: 1000 }].map(p => (
                <TouchableOpacity
                  key={String(p.val)}
                  onPress={() => setMaxPrice(p.val)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
                    backgroundColor: maxPrice === p.val ? C.gold : C.surface,
                    borderWidth: 1, borderColor: maxPrice === p.val ? C.gold : C.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: maxPrice === p.val ? '#000' : C.text, fontWeight: '600' }}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Experience Selection */}
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              {isRTL ? 'الحد الأدنى للخبرة:' : 'Min Experience:'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {[{ label: isRTL ? 'أي خبرة' : 'Any', val: 0 }, { label: '5+ سنوات', val: 5 }, { label: '10+ سنوات', val: 10 }, { label: '15+ سنة', val: 15 }].map(e => (
                <TouchableOpacity
                  key={e.val}
                  onPress={() => setMinExp(e.val)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
                    backgroundColor: minExp === e.val ? C.gold : C.surface,
                    borderWidth: 1, borderColor: minExp === e.val ? C.gold : C.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: minExp === e.val ? '#000' : C.text, fontWeight: '600' }}>
                    {e.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sorting Order */}
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
              {isRTL ? 'ترتيب النتائج حسب:' : 'Sort By:'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
              {[{ label: isRTL ? '⭐ الأعلى تقييماً' : '⭐ Rating', val: 'rating' }, { label: isRTL ? '💸 الأنسب سعراً' : '💸 Budget', val: 'price_asc' }, { label: isRTL ? '💼 الأكثر خبرة' : '💼 Experience', val: 'experience' }].map(s => (
                <TouchableOpacity
                  key={s.val}
                  onPress={() => setSelectedSort(s.val)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16,
                    backgroundColor: selectedSort === s.val ? C.gold : C.surface,
                    borderWidth: 1, borderColor: selectedSort === s.val ? C.gold : C.border,
                  }}
                >
                  <Text style={{ fontSize: 12, color: selectedSort === s.val ? '#000' : C.text, fontWeight: '600' }}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Apply Action Button */}
            <TouchableOpacity
              onPress={applyFilters}
              style={{
                backgroundColor: C.gold, borderRadius: 12,
                paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>
                {isRTL ? 'تطبيق التصفية' : 'Apply Filters'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
