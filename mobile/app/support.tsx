import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { Btn, Card, Spinner } from '../src/components/ui';
import { aiAPI, supportAPI, contentAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

function FAQItem({ q, a, C }: { q: string; a: string; C: any }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity onPress={() => setOpen(!open)} activeOpacity={0.8}
      style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 }}>
        <Text style={{ color: C.text, fontWeight: '600', fontSize: 14, flex: 1, lineHeight: 20 }}>{q}</Text>
        <Text style={{ color: C.gold, fontSize: 16, marginLeft: 8 }}>{open ? '▲' : '▾'}</Text>
      </View>
      {open && (
        <View style={{ padding: 14, paddingTop: 0, borderTopWidth: 1, borderTopColor: C.border }}>
          <Text style={{ color: C.muted, fontSize: 13, lineHeight: 22 }}>{a}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const FAQS = [
  ['كيف أحجز استشارة؟', 'اختر محامياً من صفحة البحث، اضغط "احجز الآن"، اختر الوقت وادفع بأمان.'],
  ['هل يمكنني استرداد أموالي؟', 'نعم، يمكن الاسترداد الكامل حتى 24 ساعة قبل موعد الجلسة.'],
  ['كيف يتم التحقق من المحامين؟', 'نتحقق من بطاقة نقابة المحامين والسجل المهني لكل محامٍ.'],
  ['ما طرق الدفع المتاحة؟', 'Fawry، بطاقة بنكية، فودافون كاش، أورنج موني.'],
  ['كيف أتواصل مع المحامي؟', 'عبر المحادثة الفورية داخل التطبيق أو بالفيديو خلال موعد الجلسة.'],
  ['ما هي مدة الاستشارة النصية؟', 'يرد المحامي خلال 4 ساعات كحد أقصى. معظم الردود في أقل من ساعة.'],
];

export default function SupportScreen() {
  const C = useTheme(); const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'ai' | 'ticket' | 'faq'>('ai');
  const [messages, setMessages] = useState<{role: 'assistant' | 'user', content: string}[]>([{
    role: 'assistant',
    content: 'مرحباً! أنا مساعد خدمة عملاء Wakeel.\n\nيمكنني مساعدتك في:\n- مشاكل الحجز والدفع\n- التحقق من المحامين\n- استرداد الأموال\n- الإبلاغ عن مشكلة',
  }]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [ticket,    setTicket]    = useState({ subject: '', message: '', priority: 'normal', category: 'general' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, loading]);

  const sendChat = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    const newMsgs = [...messages, { role: 'user' as const, content: q }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const apiMsgs = newMsgs.map(m => ({ role: m.role, content: m.content }));
      const data: any = await aiAPI.chat(apiMsgs, 'أنت مساعد خدمة عملاء لمنصة Wakeel للخدمات القانونية. أجب بالعربية بشكل ودود ومختصر.');
      setMessages(p => [...p, { role: 'assistant', content: data.reply || data.text || 'سأحوّلك لموظف دعم بشري.' }]);
    } catch {
      setMessages(p => [...p, { role: 'assistant', content: '⚠️ تعذر الاتصال. سيتواصل معك فريق الدعم خلال دقائق.' }]);
    } finally { setLoading(false); }
  };

  const submitTicket = async () => {
    if (!ticket.subject.trim() || !ticket.message.trim()) return;
    setSubmitting(true);
    try {
      await supportAPI.createTicket({
        subject: ticket.subject,
        message: ticket.message,
        priority: ticket.priority,
        category: ticket.category,
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true); // optimistic
    } finally { setSubmitting(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 20, fontFamily: 'CormorantGaramond-Bold' }}>الدعم والمساعدة</Text>
        </View>
        {/* Tab switcher */}
        <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border }}>
          {([['ai', '💬 دردشة'], ['ticket', '🎫 تذكرة'], ['faq', '❓ أسئلة']] as [string, string][]).map(([t, lb]) => (
            <TouchableOpacity key={t} onPress={() => setTab(t as any)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 9, backgroundColor: tab === t ? C.gold : 'transparent', alignItems: 'center' }}>
              <Text style={{ color: tab === t ? '#fff' : C.muted, fontSize: 12, fontWeight: tab === t ? '700' : '400' }}>{lb}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* AI Chat */}
      {tab === 'ai' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            style={{ flex: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd()}
            renderItem={({ item: m }) => (
              <View style={{ flexDirection: 'row', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <View style={{
                  maxWidth: '82%', backgroundColor: m.role === 'user' ? C.gold : C.card,
                  padding: 12, borderRadius: 18, borderBottomRightRadius: m.role === 'user' ? 4 : 18,
                  borderBottomLeftRadius: m.role === 'user' ? 18 : 4,
                  borderWidth: m.role === 'user' ? 0 : 1, borderColor: C.border,
                }}>
                  <Text style={{ color: m.role === 'user' ? '#fff' : C.text, fontSize: 13, lineHeight: 22 }}>{m.content}</Text>
                </View>
              </View>
            )}
            ListFooterComponent={loading ? (
              <View style={{ flexDirection: 'row', marginTop: 4 }}>
                <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 12, borderBottomLeftRadius: 4 }}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>⏳ يكتب...</Text>
                </View>
              </View>
            ) : null}
          />
          <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 12, paddingBottom: insets.bottom + 12, flexDirection: 'row', gap: 8 }}>
            <TextInput value={input} onChangeText={setInput} onSubmitEditing={sendChat}
              placeholder="اكتب سؤالك..." placeholderTextColor={C.muted}
              style={{ flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10, color: C.text, fontSize: 14 }} />
            <TouchableOpacity onPress={sendChat} disabled={!input.trim() || loading}
              style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: input.trim() && !loading ? C.gold : C.dim, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 18 }}>→</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Ticket */}
      {tab === 'ticket' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {submitted ? (
            <View style={{ alignItems: 'center', padding: 40 }}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>✅</Text>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 18, marginBottom: 8 }}>تم استلام تذكرتك!</Text>
              <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>سيتواصل معك فريق الدعم خلال 24 ساعة.</Text>
              <Btn C={C} onPress={() => { setSubmitted(false); setTicket({ subject: '', message: '', priority: 'normal', category: 'general' }); }} style={{ marginTop: 20 }}>
                تذكرة جديدة
              </Btn>
            </View>
          ) : (
            <Card C={C}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 16 }}>أرسل تذكرة دعم</Text>

              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>الأولوية</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {([['low', '🟢 عادي'], ['normal', '🟡 متوسط'], ['urgent', '🔴 عاجل']] as [string, string][]).map(([v, lb]) => (
                  <TouchableOpacity key={v} onPress={() => setTicket(p => ({ ...p, priority: v }))}
                    style={{ flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: ticket.priority === v ? C.gold : C.border, backgroundColor: ticket.priority === v ? C.gold + '20' : 'transparent', alignItems: 'center' }}>
                    <Text style={{ color: ticket.priority === v ? C.gold : C.muted, fontSize: 12 }}>{lb}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>موضوع المشكلة *</Text>
              <TextInput value={ticket.subject} onChangeText={v => setTicket(p => ({ ...p, subject: v }))}
                placeholder="مثال: مشكلة في الدفع" placeholderTextColor={C.muted}
                style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 11, color: C.text, fontSize: 14, marginBottom: 14 }} />

              <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>تفاصيل المشكلة *</Text>
              <TextInput value={ticket.message} onChangeText={v => setTicket(p => ({ ...p, message: v }))}
                placeholder="اشرح مشكلتك بالتفصيل..." placeholderTextColor={C.muted}
                multiline numberOfLines={5}
                style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 11, color: C.text, fontSize: 14, textAlignVertical: 'top', minHeight: 110, marginBottom: 16 }} />

              <Btn C={C} full disabled={!ticket.subject.trim() || !ticket.message.trim() || submitting} onPress={submitTicket}>
                {submitting ? '⏳ جاري الإرسال...' : '📨 إرسال التذكرة'}
              </Btn>
            </Card>
          )}
        </ScrollView>
      )}

      {/* FAQ */}
      {tab === 'faq' && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {FAQS.map(([q, a]) => (
            <FAQItem key={q} q={q} a={a} C={C} />
          ))}
          <View style={{ backgroundColor: C.gold + '15', borderWidth: 1, borderColor: C.gold + '40', borderRadius: 14, padding: 16, marginTop: 8 }}>
            <Text style={{ color: C.gold, fontWeight: '700', fontSize: 14, marginBottom: 8 }}>لم تجد إجابتك؟</Text>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>تواصل مع فريق الدعم مباشرة عبر الدردشة أو أرسل تذكرة.</Text>
            <Btn C={C} onPress={() => setTab('ai')}>💬 تحدث مع الدعم</Btn>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
