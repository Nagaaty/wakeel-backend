import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, LayoutAnimation, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

const FAQS = {
  ar: [
    { q:'كيف تتم عملية توثيق المحامين؟', a:'نراجع بعناية: 🪪 رقم القيد بنقابة المحامين، 📋 والسجل المهني، 📊 والدرجة القضائية. تستغرق العملية 24-48 ساعة للحفاظ على جودة وأمان المنصة.' },
    { q:'ما هي أسعار الاستشارات؟', a:'تبدأ الاستشارات النصية من 250 جنيه، والمكالمات (15 دقيقة) من 400 جنيه. أتعاب القضايا وتوكيل المحامي يتم تحديدها بالاتفاق المباشر بعد الاستشارة الأولى.' },
    { q:'هل يمكنني استرداد أموالي؟', a:'نعم! يمكنك استرداد المبلغ بالكامل إذا قمت بإلغاء الحجز قبل 12 ساعة من موعده، ويتم رد المبلغ لبطاقتك خلال 3-5 أيام عمل.' },
    { q:'ما هي طرق الدفع المتاحة؟', a:'نقبل: 💳 البطاقات البنكية (Visa, Mastercard, Meeza)، 📱 فودافون كاش، 🏪 فوري، ⚡ وانستا باي. مع إمكانية التقسيط على 3 أشهر.' },
    { q:'هل بياناتي واستشاراتي سرية؟', a:'بالتأكيد. جميع الاستشارات والمستندات مشفرة بالكامل (End-to-End Encryption) ولا يستطيع أحد الاطلاع عليها سوى أنت ومحاميك فقط.' },
    { q:'كيف أحجز استشارة فيديو؟', a:"اختر المحامي المناسب → اضغط 'حجز' → تفاصيل الموعد → اختر 'فيديو' الدفع. سيصلك رابط الجلسة قبل موعدها بـ 15 دقيقة." },
    { q:'كيف يعمل المنتدى القانوني؟', a:'يمكنك نشر أي استفسار بشكل عام وتلقي الردود من المحامين الموثقين أو المجتمع. وتذكر أنه لا يغني عن الاستشارة الخاصة.' },
    { q:'هل يمكن للمحامين رؤية رقم هاتفي؟', a:"لا. رقم هاتفك وبياناتك الشخصية لا تظهر للمحامي إلا إذا قمت بفتح قناة تواصل مباشرة معه بعد إتمام الحجز للخصوصية التامة." },
  ],
  en: [
    { q:'How does verification work?',        a:'Every lawyer is verified through: 🪪 National ID, 📋 Bar Association membership, and 📊 Authenticated Egyptian courts case history. This process takes 24-48 hours.' },
    { q:'What are consultation prices?',      a:'Text consultations start from 250 EGP, calls (15 min) from 400 EGP. Full representation fees are discussed directly with your lawyer.' },
    { q:'Can I get a refund?',                a:'Yes! Full refund if you cancel at least 12 hours before your scheduled session. Processed within 3-5 business days.' },
    { q:'What payment methods are accepted?', a:'We accept: 💳 Credit/Debit Cards, 📱 Vodafone Cash, 🏪 Fawry, and ⚡ InstaPay. With 3-month installment options.' },
    { q:'Is my consultation confidential?',   a:'Completely. All consultation details, documents and chat history are end-to-end encrypted.' },
    { q:'How do I book a video consultation?',a:"Select a lawyer → tap 'Book' → choose 'Video' → pick a date and pay securely. You'll receive a link 15 minutes prior." },
    { q:'What is the Legal Forum?',           a:'Post any legal question publicly and receive answers from verified lawyers or the community. Note: Not a substitute for a private consultation.' },
    { q:'Can lawyers see my phone number?',   a:"No. Your contact info is never shared without your explicit consent unless you open direct communication post-booking." },
  ]
};

export default function FAQScreen() {
  const C = useTheme();
  const { t, isRTL, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<number | null>(null);
  const serif = { fontFamily: 'CormorantGaramond-Bold' };

  const toggle = (i: number) => {
    if (Platform.OS === 'ios') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(o => o === i ? null : i);
  };

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+10, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:isRTL ? 'row-reverse' : 'row', alignItems:'center', gap:12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color:C.text, fontSize:22 }}>{isRTL ? '›' : '‹'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: isRTL ? 'flex-start' : 'flex-start' }}>
          <Text style={{ ...serif, color:C.text, fontWeight:'700', fontSize:18, textAlign: isRTL ? 'right' : 'left' }}>
            ❓ {locale === 'en' ? 'Frequently Asked Questions' : 'الأسئلة الشائعة'}
          </Text>
          <Text style={{ color:C.muted, fontSize:12, marginTop:2, textAlign: isRTL ? 'right' : 'left' }}>
            {locale === 'en' ? 'Tap a question to expand the answer' : 'اضغط على السؤال لقراءة الإجابة التفصيلية'}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        {(FAQS[locale as 'ar'|'en'] || FAQS.ar).map((item, i) => {
          const isOpen = open === i;
          return (
            <View key={i} style={{ backgroundColor:C.card, borderWidth:1, borderColor:isOpen ? C.gold : C.border, borderRadius:14, marginBottom:10, overflow:'hidden' }}>
              {/* Question row — tap to toggle */}
              <TouchableOpacity onPress={() => toggle(i)}
                style={{ flexDirection:'row', alignItems:'center', padding:16, gap:12 }}>
                <View style={{ width:28, height:28, borderRadius:14, backgroundColor:`${C.gold}15`, borderWidth:1, borderColor:`${C.gold}30`, alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Text style={{ color:C.gold, fontWeight:'700', fontSize:13 }}>{i+1}</Text>
                </View>
                <Text style={{ flex:1, color:C.text, fontWeight:'600', fontSize:14, lineHeight:20, textAlign: isRTL ? 'right' : 'left' }}>{item.q}</Text>
                <Text style={{ color:isOpen ? C.gold : C.muted, fontSize:18, fontWeight:'700' }}>
                  {isOpen ? '▲' : '▾'}
                </Text>
              </TouchableOpacity>
              {/* Answer — shown only when open */}
              {isOpen && (
                <View style={{ paddingHorizontal:16, paddingBottom:16, borderTopWidth:1, borderTopColor:C.border }}>
                  <Text style={{ color:C.muted, fontSize:13, lineHeight:22, marginTop:12, textAlign: isRTL ? 'right' : 'left' }}>{item.a}</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Contact support CTA */}
        <View style={{ backgroundColor:`${C.gold}08`, borderWidth:1, borderColor:`${C.gold}25`, borderRadius:14, padding:18, marginTop:8, alignItems:'center' }}>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:15, marginBottom:6 }}>
            {locale === 'en' ? 'Still have questions?' : 'لم تجد إجابة لسؤالك؟'}
          </Text>
          <Text style={{ color:C.muted, fontSize:13, textAlign:'center', marginBottom:14 }}>
            {locale === 'en' ? 'Our support team is available 7 days a week.' : 'فريق خدمة العملاء متواجد للمساعدة طوال أيام الأسبوع.'}
          </Text>
          <TouchableOpacity onPress={() => router.push('/support' as any)}
            style={{ backgroundColor:C.gold, borderRadius:10, paddingHorizontal:24, paddingVertical:11 }}>
            <Text style={{ color:'#000', fontWeight:'700', fontSize:14 }}>
              💬 {locale === 'en' ? 'Contact Support' : 'تواصل مع الدعم'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
