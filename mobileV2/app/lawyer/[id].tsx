import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, Animated, TextInput, Image } from 'react-native';
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

// ── Calendar helpers ──────────────────────────────────────────────────────────
function getDatesForMonth(year: number, month: number) {
  const today = new Date(); today.setHours(0,0,0,0);
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const days: Array<{ date: Date; disabled: boolean }> = [];
  for (let i = 0; i < first.getDay(); i++) days.push({ date: new Date(0), disabled: true });
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d);
    days.push({ date, disabled: date < today });
  }
  return days;
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const AR_DAYS   = ['أح','إث','ث','أر','خ','ج','س'];
const EN_DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function CalendarPicker({ C, selectedDate, onSelect, isRTL }: any) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const days = getDatesForMonth(viewYear, viewMonth);
  const selISO = selectedDate;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };
  const canGoPrev = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <TouchableOpacity onPress={prevMonth} disabled={!canGoPrev} style={{ padding: 8, opacity: canGoPrev ? 1 : 0.3 }}>
          <Text style={{ color: C.gold, fontSize: 20, fontWeight: '700' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, fontFamily: 'Cairo-Bold' }}>
          {isRTL ? AR_MONTHS[viewMonth] : EN_MONTHS[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
          <Text style={{ color: C.gold, fontSize: 20, fontWeight: '700' }}>›</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {(isRTL ? AR_DAYS : EN_DAYS).map(d => (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: C.muted, fontSize: 11, fontWeight: '600' }}>{d}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((item, i) => {
          if (item.disabled && item.date.getTime() === 0) {
            return <View key={`empty-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />;
          }
          const iso = toISO(item.date);
          const isSel = iso === selISO;
          const isToday = iso === toISO(new Date());
          return (
            <TouchableOpacity key={iso} disabled={item.disabled} onPress={() => onSelect(iso)}
              style={{ width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{
                width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSel ? C.gold : isToday ? C.gold + '20' : 'transparent',
                borderWidth: isToday && !isSel ? 1 : 0, borderColor: C.gold,
              }}>
                <Text style={{ fontSize: 13, fontWeight: isSel || isToday ? '700' : '400', color: isSel ? '#fff' : item.disabled ? C.dim : C.text }}>
                  {item.date.getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}


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

  const [selectedDate, setSelectedDate] = useState(toISO(new Date()));
  const [slots, setSlots] = useState<{time: string; available: boolean}[]>([]);
  const [slotsLoad, setSlotsLoad] = useState(false);

  useEffect(() => {
    if (!selectedDate || !id) return;
    setSlotsLoad(true);
    lawyersAPI.getAvailability(id, selectedDate)
      .then((d: any) => setSlots(d.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoad(false));
  }, [selectedDate, id]);

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
      await lawyersAPI.review(id, { rating: reviewRating, comment: reviewComment });
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

        {/* Premium Header */}
        <View style={{ backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 24 }}>
          {/* Cover Photo / Gradient Area */}
          <View style={{ width: '100%', height: 140, backgroundColor: C.gold + '20', position: 'relative' }}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=1000' }} style={{ width: '100%', height: '100%', opacity: 0.2 }} resizeMode="cover" />
            
            {/* Nav Row overlay */}
            <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
              <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }}>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>‹</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={handleShare} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }}>
                  <Text style={{ fontSize: 16 }}>📤</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={toggleSave} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }}>
                  <Text style={{ fontSize: 16 }}>{saved ? '❤️' : '🤍'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Profile info (Absolute positioned avatar overlapping the cover) */}
          <View style={{ paddingHorizontal: 20, marginTop: -50, alignItems: 'center' }}>
            <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: C.surface, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 }}>
              <CachedAvatar C={C} uri={lawyer.avatar_url} initials={initials} size={96} />
            </View>
            <Text style={{ color: C.text, fontWeight: '800', fontSize: 26, fontFamily: 'Cairo-Bold', marginTop: 12, textAlign: 'center' }}>{lawyer.name}</Text>
            <Text style={{ color: C.gold, fontSize: 15, fontWeight: '600', marginTop: 4, textAlign: 'center' }}>{lawyer.specialization}</Text>
            
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
              {lawyer.is_verified && <Badge C={C} color={C.green}>✅ موثق</Badge>}
              <Badge C={C} color={C.text}>📍 {lawyer.city}</Badge>
              <Badge C={C} color={C.text}>🏆 {lawyer.experience_years} سنة خبرة</Badge>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
              <Stars rating={parseFloat(lawyer.avg_rating) || 0} C={C} />
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>{Number(lawyer.avg_rating || 0).toFixed(1)}</Text>
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
            <View>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 12 }}>📅 مواعيد المحامي المتاحة</Text>
              
              <CalendarPicker C={C} selectedDate={selectedDate} onSelect={setSelectedDate} isRTL={isRTL} />

              <View style={{ backgroundColor: C.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 16 }}>
                  {isRTL ? 'الأوقات المتاحة ليوم' : 'Available times for'} {selectedDate}
                </Text>

                {slotsLoad ? (
                  <View style={{ padding: 20, alignItems: 'center' }}><Spinner C={C} /></View>
                ) : slots.length === 0 ? (
                  <Empty C={C} icon="🏖️" title={isRTL ? 'لا توجد مواعيد' : 'No available slots'} subtitle={isRTL ? 'المحامي غير متاح في هذا التاريخ. جرب يوماً آخر.' : 'Try selecting another day.'} />
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {slots.map(s => {
                      const [h, m] = s.time.split(':');
                      const ampm = +h >= 12 ? 'PM' : 'AM';
                      const hh = +h % 12 || 12;
                      const timeStr = `${hh}:${m} ${ampm}`;
                      return (
                        <TouchableOpacity key={s.time} disabled={!s.available} onPress={() => router.push({ pathname: '/book', params: { lawyer: id, preDate: selectedDate, preTime: s.time } })}
                          style={{
                            width: '30%', paddingVertical: 12, alignItems: 'center', borderRadius: 10,
                            backgroundColor: s.available ? C.gold + '15' : C.bg,
                            borderWidth: 1, borderColor: s.available ? C.gold + '50' : C.border,
                            opacity: s.available ? 1 : 0.4
                          }}>
                          <Text style={{ color: s.available ? C.gold : C.muted, fontWeight: '700', fontSize: 14 }}>{timeStr}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
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
