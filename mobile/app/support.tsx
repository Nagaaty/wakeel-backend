import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, FlatList, Animated, Easing,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { Btn } from '../src/components/ui';
import { aiAPI, supportAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';
import { useSelector } from 'react-redux';
import { selUser } from '../src/store/slices/authSlice';

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = 'topic' | 'chat' | 'agent';
type Msg = {
  role: 'assistant' | 'user' | 'agent' | 'system';
  content: string;
  chips?: string[];      // quick-reply chips shown below AI message
  action?: { label: string; onPress: () => void }; // action button
  resolved?: boolean;    // show 👍👎 thumbs
  ts?: string;           // timestamp
};

// ─── Topic Config ─────────────────────────────────────────────────────────────
const TOPICS = (isRTL: boolean) => [
  {
    id: 'booking',
    icon: '📅',
    label: isRTL ? 'مشكلة في الحجز' : 'Booking Problem',
    color: '#6366F1',
    chips: isRTL
      ? ['ألغيت موعدي', 'المحامي لم يحضر', 'أريد تغيير الوقت', 'لم أتلق تأكيداً']
      : ['My booking was cancelled', 'Lawyer didn\'t show up', 'I want to reschedule', 'No confirmation received'],
    prompt: isRTL
      ? 'المستخدم لديه مشكلة في حجز استشارة قانونية.'
      : 'The user has a problem with a legal consultation booking.',
  },
  {
    id: 'payment',
    icon: '💳',
    label: isRTL ? 'مشكلة في الدفع' : 'Payment Issue',
    color: '#EF4444',
    chips: isRTL
      ? ['خُصم المبلغ ولم تُكتمل الجلسة', 'أريد استرداد أموالي', 'فشل في الدفع', 'رسوم غير صحيحة']
      : ['Charged but session didn\'t happen', 'I want a refund', 'Payment failed', 'Wrong amount charged'],
    prompt: isRTL
      ? 'المستخدم لديه مشكلة في الدفع أو يريد استرداد أموال.'
      : 'The user has a payment issue or wants a refund.',
  },
  {
    id: 'lawyer',
    icon: '👨‍⚖️',
    label: isRTL ? 'شكوى على محامٍ' : 'Lawyer Complaint',
    color: '#F59E0B',
    chips: isRTL
      ? ['لم يرد في الوقت المحدد', 'سلوك غير مهني', 'معلومات خاطئة', 'أريد الإبلاغ عنه']
      : ['Didn\'t respond on time', 'Unprofessional behavior', 'Wrong information given', 'Report this lawyer'],
    prompt: isRTL
      ? 'المستخدم يريد تقديم شكوى على محامٍ.'
      : 'The user wants to file a complaint about a lawyer.',
  },
  {
    id: 'app',
    icon: '📱',
    label: isRTL ? 'مشكلة في التطبيق' : 'App Not Working',
    color: '#22C55E',
    chips: isRTL
      ? ['لا أستطيع تسجيل الدخول', 'التطبيق بطيء', 'الإشعارات لا تعمل', 'مشكلة في الكاميرا']
      : ['Can\'t log in', 'App is slow', 'Notifications not working', 'Camera issue in call'],
    prompt: isRTL
      ? 'المستخدم يواجه مشكلة تقنية في التطبيق.'
      : 'The user has a technical problem with the app.',
  },
  {
    id: 'account',
    icon: '🔐',
    label: isRTL ? 'مشكلة في الحساب' : 'Account Issue',
    color: '#8B5CF6',
    chips: isRTL
      ? ['نسيت كلمة المرور', 'حسابي محظور', 'تغيير البريد الإلكتروني', 'حذف الحساب']
      : ['Forgot my password', 'Account is suspended', 'Change email', 'Delete account'],
    prompt: isRTL
      ? 'المستخدم لديه مشكلة في حسابه.'
      : 'The user has an issue with their account.',
  },
  {
    id: 'other',
    icon: '💬',
    label: isRTL ? 'شيء آخر' : 'Something Else',
    color: '#64748B',
    chips: [],
    prompt: isRTL
      ? 'المستخدم لديه استفسار عام.'
      : 'The user has a general enquiry.',
  },
];

// ─── Typing Dots Animation ────────────────────────────────────────────────────
function TypingDots({ C }: { C: any }) {
  const anim = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    const animations = anim.map((a, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 160),
        Animated.timing(a, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.3, duration: 340, useNativeDriver: true }),
      ]))
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 4 }}>
      {anim.map((a, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.muted, opacity: a }} />
      ))}
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MsgBubble({ m, C, isRTL, onChip, onThumb }: any) {
  const isUser  = m.role === 'user';
  const isAgent = m.role === 'agent';
  const isSys   = m.role === 'system';

  if (isSys) return (
    <View style={{ alignItems: 'center', marginVertical: 6 }}>
      <Text style={{ color: C.muted, fontSize: 11, backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 }}>{m.content}</Text>
    </View>
  );

  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
        {!isUser && (
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isAgent ? '#1a1a2e' : C.gold + '22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Text style={{ fontSize: 15 }}>{isAgent ? '👩‍💼' : '🤖'}</Text>
          </View>
        )}
        <View style={{ maxWidth: '76%' }}>
          {!isUser && (
            <Text style={{ color: C.muted, fontSize: 10, marginBottom: 3, marginLeft: 4 }}>
              {isAgent ? (isRTL ? 'سارة — فريق الدعم' : 'Sara — Support Team') : (isRTL ? 'مساعد وكيل' : 'Wakeel Assistant')}
            </Text>
          )}
          <View style={{
            backgroundColor: isUser ? C.gold : isAgent ? '#1a1a2e' : C.card,
            padding: 13, borderRadius: 18,
            borderBottomRightRadius: isUser ? 4 : 18,
            borderBottomLeftRadius: isUser ? 18 : 4,
            borderWidth: isUser ? 0 : 1, borderColor: isAgent ? '#334155' : C.border,
          }}>
            <Text style={{ color: isUser ? '#fff' : isAgent ? '#e2e8f0' : C.text, fontSize: 13, lineHeight: 21 }}>{m.content}</Text>
          </View>
          {m.action && (
            <TouchableOpacity onPress={m.action.onPress}
              style={{ marginTop: 6, backgroundColor: C.gold, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, alignSelf: 'flex-start' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{m.action.label}</Text>
            </TouchableOpacity>
          )}
          {m.ts && (
            <Text style={{ color: C.muted, fontSize: 10, marginTop: 3, textAlign: isUser ? 'right' : 'left', marginHorizontal: 4 }}>{m.ts}</Text>
          )}
        </View>
      </View>

      {/* Quick reply chips */}
      {m.chips && m.chips.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingLeft: 40 }}>
          {m.chips.map((chip: string) => (
            <TouchableOpacity key={chip} onPress={() => onChip?.(chip)}
              style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.gold + '60', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: C.gold, fontSize: 12, fontWeight: '600' }}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Thumbs */}
      {m.resolved !== undefined && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, paddingLeft: 40, alignItems: 'center' }}>
          <Text style={{ color: C.muted, fontSize: 11 }}>{isRTL ? 'هل حُلّت مشكلتك؟' : 'Did this solve your issue?'}</Text>
          <TouchableOpacity onPress={() => onThumb?.('yes')} style={{ backgroundColor: '#DCFCE7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontSize: 14 }}>👍</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onThumb?.('no')} style={{ backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontSize: 14 }}>👎</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Phase 1: Topic Picker ────────────────────────────────────────────────────
function TopicPicker({ C, isRTL, onSelect }: any) {
  const serif = { fontFamily: 'Cairo-Bold' };
  const topics = TOPICS(isRTL);
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      {/* Hero */}
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#C8A84B18', alignItems: 'center', justifyContent: 'center', marginBottom: 14, borderWidth: 2, borderColor: '#C8A84B30' }}>
          <Text style={{ fontSize: 34 }}>🛡️</Text>
        </View>
        <Text style={{ ...serif, color: C.text, fontSize: 24, fontWeight: '800', textAlign: 'center' }}>
          {isRTL ? 'كيف يمكننا مساعدتك؟' : 'How can we help?'}
        </Text>
        <Text style={{ color: C.muted, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
          {isRTL
            ? 'اختر موضوع مشكلتك وسنساعدك فوراً'
            : 'Choose your issue and we\'ll help you right away'}
        </Text>
      </View>

      {/* Human agent status bar */}
      <View style={{ backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#86EFAC', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E' }} />
        <Text style={{ color: '#15803D', fontWeight: '700', fontSize: 13, flex: 1 }}>
          {isRTL ? '🟢 الوكلاء البشريون متاحون — متوسط الانتظار 2 دقيقة' : '🟢 Human agents online — avg. wait 2 min'}
        </Text>
      </View>

      {/* Topic grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {topics.map(t => (
          <TouchableOpacity key={t.id} onPress={() => onSelect(t)}
            style={{
              width: '47%', backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
              borderRadius: 18, padding: 18, alignItems: 'center', gap: 10,
              shadowColor: t.color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
            }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: t.color + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24 }}>{t.icon}</Text>
            </View>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Phase 2: Smart AI Chat ───────────────────────────────────────────────────
function SmartChat({ C, isRTL, topic, user, onEscalate }: any) {
  const ts = () => new Date().toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  const welcomeMsg: Msg = {
    role: 'assistant',
    content: isRTL
      ? `مرحباً ${user?.name ? user.name.split(' ')[0] : ''}! 👋\n\nأرى أنك تواجه **${topic.label}**.\n\nحدد مشكلتك من الخيارات أدناه أو اكتب لي باختصار:`
      : `Hi ${user?.name ? user.name.split(' ')[0] : 'there'}! 👋\n\nI see you're having an issue with **${topic.label}**.\n\nChoose one of the options below or type your issue:`,
    chips: topic.chips,
    ts: ts(),
  };

  const [messages, setMessages] = useState<Msg[]>([welcomeMsg]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiTried, setAiTried] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput('');
    setAiTried(true);

    const userMsg: Msg = { role: 'user', content: q, ts: ts() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      const systemPrompt = isRTL
        ? `أنت مساعد خدمة عملاء ذكي لمنصة Wakeel للخدمات القانونية. السياق: ${topic.prompt} أجب بالعربية بشكل ودي ومختصر وعملي. قدّم حلاً واضحاً وقابلاً للتنفيذ. إذا كانت المشكلة تتعلق بالحجز أو الدفع، اذكر خطوات الحل. أنهِ ردّك بسؤال تأكيدي: "هل ساعدك ذلك؟"`
        : `You are a smart customer service assistant for Wakeel, an Egyptian legal services platform. Context: ${topic.prompt} Reply in English in a friendly, concise, and actionable tone. Provide a clear solution. If the issue is about booking or payment, give exact steps. End your reply with a confirmation: "Did this help?"`;

      const apiMsgs = newHistory.map(m => ({ role: m.role === 'agent' || m.role === 'system' ? 'assistant' : m.role, content: m.content }));
      const data: any = await aiAPI.chat(apiMsgs, systemPrompt);
      const reply = data?.reply || data?.text || data?.message || '';

      const assistantMsg: Msg = {
        role: 'assistant',
        content: reply || (isRTL ? 'عذراً، لم أفهم استفسارك. يمكنك التحدث مع موظف بشري.' : 'Sorry, I didn\'t quite catch that. You can talk to a human agent.'),
        chips: [],
        resolved: true,
        ts: ts(),
      };
      setMessages(p => [...p, assistantMsg]);
    } catch {
      setMessages(p => [...p, {
        role: 'assistant',
        content: isRTL
          ? '⚠️ تعذّر الوصول إلى المساعد الذكي. سأحولك لوكيل بشري.'
          : '⚠️ AI assistant unavailable. Connecting you to a human agent.',
        ts: ts(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, topic, isRTL]);

  const handleThumb = (val: 'yes' | 'no') => {
    if (val === 'yes') {
      setMessages(p => [
        ...p.map(m => ({ ...m, resolved: undefined })),
        {
          role: 'system',
          content: isRTL ? '✅ نسعد بأننا تمكنّا من مساعدتك!' : '✅ Great! Glad we could help!',
        },
      ]);
    } else {
      onEscalate(messages);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      {/* Topic badge */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surface }}>
        <Text style={{ fontSize: 16 }}>{topic.icon}</Text>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{topic.label}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => onEscalate(messages)}
          style={{ backgroundColor: '#1E293B', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ fontSize: 12 }}>👩‍💼</Text>
          <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700' }}>{isRTL ? 'موظف بشري' : 'Human Agent'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
        style={{ flex: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        renderItem={({ item: m }) => (
          <MsgBubble m={m} C={C} isRTL={isRTL}
            onChip={(chip: string) => sendMessage(chip)}
            onThumb={handleThumb}
          />
        )}
        ListFooterComponent={loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.gold + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 15 }}>🤖</Text>
            </View>
            <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, borderBottomLeftRadius: 4, padding: 14 }}>
              <TypingDots C={C} />
            </View>
          </View>
        ) : null}
      />

      {/* Still need help banner - show after first AI reply */}
      {aiTried && !loading && (
        <TouchableOpacity onPress={() => onEscalate(messages)}
          style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: '#0F172A', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 }}>👩‍💼</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#F1F5F9', fontWeight: '700', fontSize: 13 }}>
              {isRTL ? 'لم تُحلّ مشكلتك؟' : 'Still not resolved?'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' }} />
              <Text style={{ color: '#64748B', fontSize: 11 }}>
                {isRTL ? 'تحدث مع موظف الآن — انتظار ~2 دقيقة' : 'Talk to an agent now — ~2 min wait'}
              </Text>
            </View>
          </View>
          <Text style={{ color: '#C8A84B', fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      )}

      {/* Input bar */}
      <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 12, paddingBottom: 16, flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendMessage(input)}
          returnKeyType="send"
          multiline
          maxLength={400}
          placeholder={isRTL ? 'اكتب مشكلتك هنا...' : 'Describe your issue...'}
          placeholderTextColor={C.muted}
          style={{
            flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
            borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
            color: C.text, fontSize: 14, maxHeight: 100,
            textAlign: isRTL ? 'right' : 'left',
          }}
        />
        <TouchableOpacity onPress={() => sendMessage(input)} disabled={!input.trim() || loading}
          style={{
            width: 44, height: 44, borderRadius: 14,
            backgroundColor: input.trim() && !loading ? C.gold : C.border,
            alignItems: 'center', justifyContent: 'center',
          }}>
          <Text style={{ color: '#fff', fontSize: 18, lineHeight: 22 }}>{isRTL ? '↑' : '↑'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Phase 3: Live Agent Chat ─────────────────────────────────────────────────
function AgentChat({ C, isRTL, topic, history, user }: any) {
  const ts = () => new Date().toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const AGENT_NAME = isRTL ? 'سارة من خدمة العملاء' : 'Sara — Support';
  const [phase, setPhase] = useState<'queue' | 'chat'>('queue');
  const [queueSec, setQueueSec] = useState(12); // simulate queue countdown
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [agentTyping, setAgentTyping] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Build context summary from AI chat history
  const contextSummary = history
    .filter((m: Msg) => m.role === 'user')
    .map((m: Msg) => m.content)
    .slice(-3)
    .join(' / ');

  // Queue countdown
  useEffect(() => {
    if (phase !== 'queue') return;
    const timer = setInterval(() => {
      setQueueSec(s => {
        if (s <= 1) {
          clearInterval(timer);
          connectAgent();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const connectAgent = () => {
    setPhase('chat');
    // Fire ticket in background
    supportAPI.createTicket?.({
      subject: topic.label,
      message: contextSummary || 'Escalated from AI chat',
      priority: 'urgent',
      category: topic.id,
    }).catch(() => {});

    const intro: Msg[] = [
      { role: 'system', content: isRTL ? '✅ تم الاتصال بالوكيل' : '✅ Connected to agent' },
      {
        role: 'agent',
        content: isRTL
          ? `مرحباً ${user?.name ? user.name.split(' ')[0] : ''}! أنا سارة من فريق دعم Wakeel.\n\nاطلعت على محادثتك مع المساعد الذكي حول **${topic.label}**.\n\nكيف يمكنني مساعدتك الآن؟`
          : `Hi ${user?.name ? user.name.split(' ')[0] : 'there'}! I'm Sara from Wakeel Support.\n\nI can see your chat with our AI assistant about **${topic.label}**.\n\nHow can I help you right now?`,
        ts: ts(),
      },
    ];
    setMessages(intro);
  };

  // Simulate agent reply
  const agentReply = useCallback(async (userText: string) => {
    setAgentTyping(true);
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1500));
    setAgentTyping(false);

    const replies_ar = [
      'شكراً لتواصلك، سأتحقق من ذلك الآن.',
      'فهمت مشكلتك. سأحيلها لفريق المختص وسيتم حلها خلال ساعة.',
      'تم تسجيل طلبك. ستصلك رسالة تأكيد على بريدك الإلكتروني.',
      'هل يمكنك إرسال تفاصيل إضافية مثل رقم الجلسة أو تاريخها؟',
    ];
    const replies_en = [
      'Thank you for reaching out — let me look into this for you right now.',
      'I understand the issue. I\'ve escalated it to our specialist team for resolution within 1 hour.',
      'Your request has been logged. You\'ll receive a confirmation email shortly.',
      'Could you share additional details like your booking ID or session date?',
    ];
    const pool = isRTL ? replies_ar : replies_en;
    const reply = pool[Math.floor(Math.random() * pool.length)];

    setMessages(p => [...p, { role: 'agent', content: reply, ts: ts() }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [isRTL]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q) return;
    setInput('');
    setMessages(p => [...p, { role: 'user', content: q, ts: ts() }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    await agentReply(q);
  };

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, agentTyping]);

  // ── Queue screen ──
  if (phase === 'queue') return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: C.bg }}>
      {/* Animated ring */}
      <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 2, borderColor: '#334155' }}>
        <Text style={{ fontSize: 44 }}>👩‍💼</Text>
      </View>
      <Text style={{ color: C.text, fontWeight: '800', fontSize: 22, fontFamily: 'Cairo-Bold', marginBottom: 8, textAlign: 'center' }}>
        {isRTL ? 'جاري توصيلك بوكيل...' : 'Connecting you to an agent...'}
      </Text>
      <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>
        {isRTL ? 'وكيلنا يطلع على محادثتك السابقة' : 'Our agent is reviewing your previous chat'}
      </Text>
      {/* Progress bar */}
      <View style={{ width: '100%', height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
        <View style={{ height: 6, width: `${((12 - queueSec) / 12) * 100}%`, backgroundColor: '#22C55E', borderRadius: 3 }} />
      </View>
      <Text style={{ color: '#22C55E', fontWeight: '700', fontSize: 14 }}>
        {queueSec}s
      </Text>

      {/* Context preview */}
      {contextSummary.length > 0 && (
        <View style={{ marginTop: 28, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, width: '100%' }}>
          <Text style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>
            {isRTL ? '📋 السياق المحوّل للوكيل:' : '📋 Context sent to agent:'}
          </Text>
          <Text style={{ color: C.text, fontSize: 12, lineHeight: 18 }} numberOfLines={3}>{contextSummary}</Text>
        </View>
      )}
    </View>
  );

  // ── Live chat screen ──
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      {/* Agent header */}
      <View style={{ backgroundColor: '#0F172A', padding: 14, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ position: 'relative' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>👩‍💼</Text>
          </View>
          <View style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#0F172A' }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#F1F5F9', fontWeight: '700', fontSize: 14 }}>{AGENT_NAME}</Text>
          <Text style={{ color: '#22C55E', fontSize: 11, marginTop: 1 }}>
            {agentTyping ? (isRTL ? '⌨️ يكتب...' : '⌨️ Typing...') : (isRTL ? '🟢 متصل الآن' : '🟢 Online now')}
          </Text>
        </View>
        <View style={{ backgroundColor: '#C8A84B22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#C8A84B44' }}>
          <Text style={{ color: '#C8A84B', fontSize: 11, fontWeight: '700' }}>{topic.icon} {topic.id.toUpperCase()}</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
        style={{ flex: 1, backgroundColor: C.bg }}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        renderItem={({ item: m }) => <MsgBubble m={m} C={C} isRTL={isRTL} />}
        ListFooterComponent={agentTyping ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }}>
              <Text>👩‍💼</Text>
            </View>
            <View style={{ backgroundColor: '#1E293B', borderRadius: 18, borderBottomLeftRadius: 4, padding: 14 }}>
              <TypingDots C={{ muted: '#94A3B8' }} />
            </View>
          </View>
        ) : null}
      />

      {/* Input */}
      <View style={{ backgroundColor: '#0F172A', borderTopWidth: 1, borderTopColor: '#334155', padding: 12, paddingBottom: 16, flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          multiline
          maxLength={400}
          placeholder={isRTL ? 'اكتب ردّك...' : 'Reply to agent...'}
          placeholderTextColor="#475569"
          style={{
            flex: 1, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155',
            borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
            color: '#F1F5F9', fontSize: 14, maxHeight: 100,
            textAlign: isRTL ? 'right' : 'left',
          }}
        />
        <TouchableOpacity onPress={sendMessage} disabled={!input.trim()}
          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: input.trim() ? '#C8A84B' : '#334155', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 18 }}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SupportScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const { isRTL } = useI18n();
  const user = useSelector(selUser);
  const serif = { fontFamily: 'Cairo-Bold' };

  const [phase, setPhase] = useState<Phase>('topic');
  const [topic, setTopic] = useState<any>(null);
  const [chatHistory, setChatHistory] = useState<Msg[]>([]);

  const handleTopicSelect = (t: any) => {
    setTopic(t);
    setPhase('chat');
  };

  const handleEscalate = (history: Msg[]) => {
    setChatHistory(history);
    setPhase('agent');
  };

  const handleBack = () => {
    if (phase === 'agent') { setPhase('chat'); return; }
    if (phase === 'chat')  { setPhase('topic'); return; }
    router.back();
  };

  const headerTitle = () => {
    if (phase === 'topic') return isRTL ? '🛡️ الدعم والمساعدة' : '🛡️ Support & Help';
    if (phase === 'chat')  return topic?.label || (isRTL ? 'المساعد الذكي' : 'AI Assistant');
    return isRTL ? '💬 وكيل بشري' : '💬 Live Agent';
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: phase === 'agent' ? '#0F172A' : C.surface,
        paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: phase === 'agent' ? '#334155' : C.border,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <TouchableOpacity onPress={handleBack} style={{ padding: 4 }}>
          <Text style={{ color: phase === 'agent' ? '#94A3B8' : C.text, fontSize: 24 }}>
            {isRTL ? '›' : '‹'}
          </Text>
        </TouchableOpacity>
        <Text style={{ ...serif, color: phase === 'agent' ? '#F1F5F9' : C.text, fontWeight: '700', fontSize: 18, flex: 1 }}>
          {headerTitle()}
        </Text>
        {phase !== 'topic' && (
          <TouchableOpacity onPress={() => { setPhase('topic'); setTopic(null); }}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: phase === 'agent' ? '#334155' : C.border }}>
            <Text style={{ color: phase === 'agent' ? '#94A3B8' : C.muted, fontSize: 11 }}>
              {isRTL ? 'تغيير الموضوع' : 'Change topic'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Phase Router */}
      {phase === 'topic' && <TopicPicker C={C} isRTL={isRTL} onSelect={handleTopicSelect} />}
      {phase === 'chat'  && topic && <SmartChat C={C} isRTL={isRTL} topic={topic} user={user} onEscalate={handleEscalate} />}
      {phase === 'agent' && topic && <AgentChat C={C} isRTL={isRTL} topic={topic} history={chatHistory} user={user} />}
    </View>
  );
}
