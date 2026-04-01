import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, Animated, TextInput } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useTheme } from '../../src/theme';
import { LawyerMap } from '../../src/components/LawyerMap';
import { Badge, Stars, Spinner, Btn, Empty } from '../../src/components/ui';
import { CachedAvatar } from '../../src/components/CachedImage';
import { lawyersAPI, favoritesAPI } from '../../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { selLoggedIn } from '../../src/store/slices/authSlice';
import { useI18n } from '../../src/i18n';
import { shareLawyerProfile, copyProfileLink, shareToWhatsApp } from '../../src/utils/shareProfile';
import { hapticLight, hapticMedium } from '../../src/utils/haptics';


const EXPERIENCES = [
  { title:'محامٍ أول', firm:'مكتب الشرقاوي للمحاماة', period:'2019 — الآن', years:'5 سنوات', desc:'تخصص في القضايا التجارية والعقود الدولية.', logo:'🏢' },
  { title:'محامٍ', firm:'شركة النيل للاستشارات', period:'2015 — 2019', years:'4 سنوات', desc:'تمثيل العملاء في المحاكم الابتدائية والاستئنافية.', logo:'⚖️' },
  { title:'متدرب قانوني', firm:'نقابة المحامين', period:'2012 — 2015', years:'3 سنوات', desc:'التدريب على صياغة العقود والمرافعات.', logo:'📋' },
];
const EDUCATION = [
  { degree:'ليسانس الحقوق', school:'جامعة القاهرة', year:'2012' },
  { degree:'ماجستير القانون التجاري', school:'جامعة عين شمس', year:'2015' },
];
const SKILLS = ['القانون الجنائي','قانون الشركات','القانون المدني','التحكيم','قانون العمل','صياغة العقود','التقاضي','الاستشارات'];

export default function LawyerProfileScreen() {
  const C        = useTheme();
  const { isRTL } = useI18n();
  const { id }   = useLocalSearchParams<{ id: string }>();
  const isLoggedIn = useSelector(selLoggedIn);
  const insets   = useSafeAreaInsets();

  const [lawyer,  setLawyer]  = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [saved,   setSaved]   = useState(false);
  const [tab,          setTab]          = useState<'about' | 'experience' | 'reviews' | 'cv' | 'availability'>('about');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment,setReviewComment]= useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  useEffect(() => {
    if (!id) return;
    lawyersAPI.get(id)
      .then((d: any) => { setLawyer(d); setReviews(d.reviews || []); })
      .catch(e => setError(e?.message || 'تعذر تحميل الملف الشخصي'))
      .finally(() => setLoading(false));

    if (isLoggedIn) {
      favoritesAPI.check(id)
        .then((d: any) => setSaved(d.saved))
        .catch(() => {});
    }
  }, [id]);

  const toggleSave = async () => {
    if (!isLoggedIn) { router.push('/(auth)/login'); return; }
    try {
      const d: any = await favoritesAPI.toggle(id);
      setSaved(d.saved);
    } catch {}
  };

  const handleShare = () => {
    hapticLight();
    setShowShareSheet(true);
  };

  const doShare = async () => {
    setShowShareSheet(false);
    hapticMedium();
    await shareLawyerProfile(lawyer, isRTL);
  };

  const doCopyLink = async () => {
    setShowShareSheet(false);
    await copyProfileLink(id, isRTL);
  };

  const doWhatsApp = async () => {
    setShowShareSheet(false);
    await shareToWhatsApp(lawyer, isRTL);
  };

  const submitReview = async () => {
    if (!reviewRating) return;
    setSubmittingReview(true);
    try {
      await lawyersAPI.review(Number(id), { rating: reviewRating, comment: reviewComment });
      setReviews((prev: any[]) => [{
        id: Date.now(),
        client_name: 'أنت',
        rating: reviewRating,
        comment: reviewComment,
        created_at: new Date().toISOString(),
      }, ...prev]);
      setReviewRating(0);
      setReviewComment('');
      Alert.alert('✅', 'تم إرسال تقييمك بنجاح!');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر إرسال التقييم');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}><Spinner C={C} /></View>;
  if (error)   return <View style={{ flex: 1, backgroundColor: C.bg }}><Empty C={C} icon="⚠️" title="تعذر التحميل" subtitle={error} action={{ label: 'رجوع', onPress: () => router.back() }} /></View>;
  if (!lawyer) return null;

  const initials = (lawyer.name || '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const lawyerReviews = lawyer.reviews || [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header */}
        <View style={{ backgroundColor: C.surface, paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.text, fontSize: 18 }}>‹</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={handleShare} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>📤</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleSave} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{saved ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile info */}
          <View style={{ padding: 20, alignItems: 'center', gap: 10 }}>
            <CachedAvatar C={C} uri={lawyer.photo_url} initials={initials} size={80} />
            <Text style={{ color: C.text, fontWeight: '800', fontSize: 20, fontFamily: 'CormorantGaramond-Bold' }}>{lawyer.name}</Text>
            <Text style={{ color: C.muted, fontSize: 14 }}>{lawyer.specialization}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {lawyer.is_verified && <Badge C={C} color={C.green}>✅ محامٍ موثق</Badge>}
              <Badge C={C} color={C.muted}>📍 {lawyer.city}</Badge>
              <Badge C={C} color={C.muted}>🏆 {lawyer.experience_years} سنة</Badge>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Stars rating={parseFloat(lawyer.avg_rating) || 0} C={C} />
              <Text style={{ color: C.muted, fontSize: 13 }}>({lawyer.total_reviews || 0} تقييم)</Text>
            </View>
          </View>

          {/* Stats row - wins / losses / rating / fee */}
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border }}>
            {([
              [lawyer.wins || 0,                    'فوز',    '#22C55E'],
              [lawyer.losses || 0,                  'خسارة',  '#EF4444'],
              [Number(lawyer.avg_rating||0).toFixed(1), 'تقييم', C.gold],
              [`${lawyer.consultation_fee||0}ج`,   'الجلسة', C.text],
            ] as [string|number, string, string][]).map(([val, label, color]) => (
              <View key={label} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRightWidth: 1, borderRightColor: C.border }}>
                <Text style={{ color, fontWeight: '800', fontSize: 16 }}>{String(val)}</Text>
                <Text style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: C.card, margin: 16, borderRadius: 12, padding: 4 }}>
          {(['about', 'experience', 'reviews', 'cv', 'availability'] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: tab === t ? C.surface : 'transparent', alignItems: 'center' }}>
              <Text style={{ color: tab === t ? C.text : C.muted, fontSize: 13, fontWeight: tab === t ? '700' : '400' }}>
                {t === 'about' ? 'نبذة' : t === 'experience' ? 'الخبرة' : t === 'reviews' ? 'تقييمات' : t === 'cv' ? 'السيرة' : 'المواعيد'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {tab === 'about' && (
            <>
              {lawyer.bio && (
                <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 12 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 8 }}>👤 نبذة</Text>
                  <Text style={{ color: C.muted, fontSize: 14, lineHeight: 22 }}>{lawyer.bio}</Text>
                </View>
              )}
              <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>💰 أسعار الخدمات</Text>
                {[
                  ['💬', 'استشارة نصية',   lawyer.consultation_fee],
                  ['📞', 'مكالمة صوتية',   Math.round(lawyer.consultation_fee * 1.2)],
                  ['📹', 'استشارة فيديو',  Math.round(lawyer.consultation_fee * 1.5)],
                  ['📄', 'مراجعة مستند',   Math.round(lawyer.consultation_fee * 2)],
                ].map(([icon, label, price]) => (
                  <View key={label as string} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <Text style={{ color: C.text, fontSize: 13 }}>{icon as string} {label as string}</Text>
                    <Text style={{ color: C.gold, fontWeight: '700', fontSize: 14 }}>{price as number} ج</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {tab === 'reviews' && (
            <>
              {(reviews || []).length === 0
                ? <Empty C={C} icon="⭐" title="لا توجد تقييمات بعد" />
                : reviews.map((r: any) => (
                  <View key={r.id} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{r.client_name || 'عميل'}</Text>
                      <Stars rating={r.rating} C={C} />
                    </View>
                    {r.comment && <Text style={{ color: C.muted, fontSize: 13, lineHeight: 20 }}>{r.comment}</Text>}
                  </View>
                ))
              }
              {/* Add review form */}
              {isLoggedIn && (
                <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.gold + '60', borderRadius: 14, padding: 14, marginTop: 8 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>أضف تقييمك</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    {[1,2,3,4,5].map(star => (
                      <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                        <Text style={{ fontSize: 28, color: star <= reviewRating ? '#F59E0B' : C.border }}>★</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    placeholder="شارك تجربتك مع هذا المحامي..."
                    placeholderTextColor={C.muted}
                    multiline
                    numberOfLines={3}
                    style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, color: C.text, fontSize: 13, textAlignVertical: 'top', minHeight: 70, marginBottom: 10 }}
                  />
                  <Btn C={C} full disabled={reviewRating === 0 || submittingReview} onPress={submitReview}>
                    {submittingReview ? '⏳ جاري الإرسال...' : '⭐ إرسال التقييم'}
                  </Btn>
                </View>
              )}
            </>
          )}

          {tab === 'experience' && (
            <View>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>💼 الخبرة المهنية</Text>
              {EXPERIENCES.map((exp, i) => (
                <View key={i} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20 }}>{exp.logo}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{exp.title}</Text>
                    <Text style={{ color: C.gold, fontSize: 12, fontWeight: '600', marginTop: 1 }}>{exp.firm}</Text>
                    <Text style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>{exp.period} · {exp.years}</Text>
                    <Text style={{ color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 6 }}>{exp.desc}</Text>
                  </View>
                </View>
              ))}
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10, marginTop: 8 }}>🎓 التعليم</Text>
              {EDUCATION.map((edu, i) => (
                <View key={i} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20 }}>🎓</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{edu.degree}</Text>
                    <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{edu.school}</Text>
                    <Text style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>{edu.year}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {tab === 'cv' && (
            <View>
              <View style={{ backgroundColor: '#1a1a2e', borderRadius: 14, padding: 20, marginBottom: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 44, marginBottom: 8 }}>📄</Text>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 4 }}>{lawyer.name}</Text>
                <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 14 }}>{lawyer.specialization} · {lawyer.experience_years} سنة خبرة</Text>
                <Btn C={C} onPress={() => Alert.alert('📄', 'ستُنزَّل السيرة الذاتية قريباً!')}>⬇️ تحميل PDF</Btn>
              </View>
              {[
                { icon:'👤', title:'المعلومات', items:[lawyer.name, `محامٍ · ${lawyer.city}`] },
                { icon:'💼', title:'الخبرة', items:EXPERIENCES.map(e=>`${e.title} — ${e.firm}`) },
                { icon:'🎓', title:'التعليم', items:EDUCATION.map(e=>`${e.degree} — ${e.school}`) },
                { icon:'🎯', title:'التخصصات', items:[SKILLS.slice(0,4).join('، '), SKILLS.slice(4).join('، ')] },
              ].map(sec => (
                <View key={sec.title} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 8 }}>{sec.icon} {sec.title}</Text>
                  {sec.items.filter(Boolean).map((item, i) => (
                    <View key={i} style={{ paddingVertical: 4, borderBottomWidth: i < sec.items.length-1 ? 1 : 0, borderBottomColor: C.border }}>
                      <Text style={{ color: C.muted, fontSize: 13 }}>• {item}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

                    {tab === 'availability' && (
            <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>📅 للحجز اضغط الزر أدناه</Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>يمكنك اختيار الوقت المناسب عند الحجز</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Book CTA */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 16, paddingVertical: 12, paddingBottom: insets.bottom + 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ color: C.muted, fontSize: 12 }}>رسوم الاستشارة</Text>
            <Text style={{ color: C.gold, fontWeight: '800', fontSize: 22 }}>{lawyer.consultation_fee} جنيه</Text>
          </View>
          <Btn C={C} size="lg" onPress={() => router.push({ pathname: '/book', params: { lawyer: id } })}>
            📅 احجز الآن
          </Btn>
        </View>
      </View>
    </View>
  );
}
