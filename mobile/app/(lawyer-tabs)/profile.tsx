// ─── Wakeel Lawyer — LinkedIn-style Public Profile Tab ─────────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  Share, Animated, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/hooks/useAuth';
import { useI18n } from '../../src/i18n';
import { lawyersAPI } from '../../src/services/api';

const GOLD = '#C8A84B';

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, onAction, actionLabel, C }: any) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, fontFamily: 'CormorantGaramond-Bold' }}>{title}</Text>
      {onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ color: GOLD, fontSize: 13, fontWeight: '700' }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Star rating display ───────────────────────────────────────────────────────
function Stars({ rating = 0, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <Text key={s} style={{ fontSize: size, color: s <= Math.round(rating) ? '#F59E0B' : '#D1D5DB' }}>★</Text>
      ))}
    </View>
  );
}

// ── Service type card ─────────────────────────────────────────────────────────
function ServiceCard({ icon, label, price, C }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, alignItems: 'center', gap: 6, minWidth: 90 }}>
      <Text style={{ fontSize: 26 }}>{icon}</Text>
      <Text style={{ color: C.text, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
      <Text style={{ color: GOLD, fontSize: 13, fontWeight: '800' }}>{price}</Text>
    </View>
  );
}

// ── Review card ───────────────────────────────────────────────────────────────
function ReviewCard({ name, rating, text, date, C }: any) {
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: GOLD + '25', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: GOLD, fontWeight: '800', fontSize: 14 }}>{initials}</Text>
        </View>
        <View>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{name}</Text>
          <Stars rating={rating} />
        </View>
        <Text style={{ color: C.muted, fontSize: 11, marginLeft: 'auto' }}>{date}</Text>
      </View>
      <Text style={{ color: C.text, fontSize: 13, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

export default function LawyerPublicProfile() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { isRTL } = useI18n();
  const [profile, setProfile] = useState<any>(null);
  const [online, setOnline] = useState(true);
  const pulsAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    lawyersAPI.getMyProfile()
      .then((p: any) => setProfile(p?.profile || p))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!online) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulsAnim, { toValue: 1.5, duration: 900, useNativeDriver: true }),
      Animated.timing(pulsAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [online]);

  const handleShare = () => Share.share({
    title: `${user?.name} | Wakeel`,
    message: `⚖️ ${user?.name || 'Verified Lawyer'} on Wakeel — ${profile?.specialization || 'Legal Expert'}\nBook a consultation: https://wakeel-api.onrender.com`,
  });

  const REVIEWS = [
    { name: isRTL ? 'محمد أحمد' : 'Mohammed Ahmed', rating: 5, text: isRTL ? 'محامٍ محترف واعي بكل تفاصيل القضية، تواصله ممتاز.' : 'Professional, detail-oriented and extremely communicative.', date: '3 Mar 2025' },
    { name: isRTL ? 'رنا حسن' : 'Rana Hassan', rating: 5, text: isRTL ? 'انتهت قضيتي بنتيجة ممتازة، شكراً جزيلاً.' : 'My case ended with an excellent outcome. Highly recommend!', date: '18 Feb 2025' },
    { name: isRTL ? 'كريم نور' : 'Karim Nour', rating: 4, text: isRTL ? 'خبير وسريع الاستجابة، استشارة قيّمة جداً.' : 'Very knowledgeable, quick to respond. Great value.', date: '5 Jan 2025' },
  ];

  const initials = (user?.name || 'LA').split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
  const avgRating = profile?.avg_rating || 4.8;
  const totalReviews = profile?.total_reviews || 47;
  const wins = profile?.wins || 0;
  const experience = profile?.experience_years || 0;
  const specialization = profile?.specialization || (isRTL ? 'قانون جنائي وتجاري' : 'Criminal & Commercial Law');
  const city = profile?.city || (isRTL ? 'القاهرة' : 'Cairo');
  const bio = profile?.bio || (isRTL
    ? 'محامٍ معتمد متخصص في قضايا الجنايات والتجارة الدولية، خبرة واسعة أمام محاكم الاستئناف والنقض.'
    : 'Certified lawyer specializing in criminal and international commercial law, with extensive experience before Courts of Appeal and Cassation.');
  const fee = profile?.consultation_fee || 400;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* ── COVER ──────────────────────────────────────────────────────── */}
        <View style={{ height: 170, backgroundColor: '#0F172A', overflow: 'hidden' }}>
          {user?.cover_url
            ? <Image source={{ uri: user.cover_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            : (
              <>
                <View style={{ position:'absolute', left:-60,top:-60, width:220,height:220, borderRadius:110, borderWidth:1, borderColor:'rgba(200,168,75,0.18)' }} />
                <View style={{ position:'absolute', right:-30,bottom:-40, width:190,height:190, borderRadius:95, borderWidth:1, borderColor:'rgba(255,255,255,0.05)' }} />
                <View style={{ position:'absolute', right:30,top:24, width:60,height:60, borderRadius:30, backgroundColor:'rgba(200,168,75,0.08)' }} />
                <Text style={{ position:'absolute', bottom:18, right:20, color:'rgba(200,168,75,0.35)', fontSize:48 }}>⚖️</Text>
              </>
            )
          }
          {/* Top right actions */}
          <View style={{ position:'absolute', top: insets.top + 10, right: 14, flexDirection:'row', gap:8 }}>
            <TouchableOpacity onPress={handleShare}
              style={{ backgroundColor:'rgba(0,0,0,0.4)', borderRadius:18, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:'rgba(200,168,75,0.4)' }}>
              <Text style={{ color: GOLD, fontSize:12, fontWeight:'700' }}>📤 {isRTL ? 'مشاركة' : 'Share'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/edit-profile' as any)}
              style={{ backgroundColor:'rgba(0,0,0,0.4)', borderRadius:18, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:'rgba(200,168,75,0.4)' }}>
              <Text style={{ color: GOLD, fontSize:12, fontWeight:'700' }}>✏️ {isRTL ? 'تعديل' : 'Edit'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── AVATAR + NAME row ───────────────────────────────────────────── */}
        <View style={{ backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 18 }}>
          {/* Avatar — overlaps cover */}
          <View style={{ marginTop: -48, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: GOLD, backgroundColor: '#1a2035', alignItems:'center', justifyContent:'center', shadowColor: GOLD, shadowOffset:{width:0,height:4}, shadowOpacity:0.4, shadowRadius:10, elevation:8 }}>
              {user?.avatar_url
                ? <Image source={{ uri: user.avatar_url }} style={{ width:90,height:90,borderRadius:45 }} />
                : <Text style={{ fontSize:32, fontWeight:'800', color: GOLD, fontFamily:'CormorantGaramond-Bold' }}>{initials}</Text>
              }
              {/* Verified badge */}
              <View style={{ position:'absolute', bottom:0,right:0, backgroundColor: GOLD, borderRadius:10, width:22,height:22, alignItems:'center',justifyContent:'center', borderWidth:2, borderColor: C.bg }}>
                <Text style={{ color:'#fff', fontSize:11, fontWeight:'900' }}>✓</Text>
              </View>
            </View>

            {/* Online toggle */}
            <TouchableOpacity onPress={() => setOnline(o => !o)}
              style={{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:14, paddingVertical:8, borderRadius:20, backgroundColor: online ? '#22C55E15' : C.card, borderWidth:1, borderColor: online ? '#22C55E50' : C.border }}>
              <View style={{ position:'relative', width:10, height:10 }}>
                <View style={{ width:10, height:10, borderRadius:5, backgroundColor: online ? '#22C55E' : C.muted }} />
                {online && <Animated.View style={{ position:'absolute', width:10,height:10, borderRadius:5, backgroundColor:'#22C55E40', transform:[{scale: pulsAnim}] }} />}
              </View>
              <Text style={{ color: online ? '#22C55E' : C.muted, fontSize:12, fontWeight:'700' }}>
                {online ? (isRTL ? 'متاح' : 'Online') : (isRTL ? 'غير متاح' : 'Offline')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: 18 }}>
            {/* Name + Verified badge */}
            <View style={{ flexDirection:'row', alignItems:'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize:22, fontWeight:'900', color: C.text, fontFamily:'CormorantGaramond-Bold' }}>{user?.name || 'Dr. Lawyer'}</Text>
              <View style={{ backgroundColor: GOLD+'20', borderRadius:6, paddingHorizontal:7, paddingVertical:2, borderWidth:1, borderColor: GOLD+'50' }}>
                <Text style={{ color: GOLD, fontSize:10, fontWeight:'800' }}>⚖️ {isRTL ? 'محامٍ معتمد' : 'Verified'}</Text>
              </View>
            </View>

            {/* Specialization */}
            <Text style={{ color: C.text, fontSize:15, fontWeight:'600', marginBottom:4 }}>{specialization}</Text>

            {/* Location + experience */}
            <Text style={{ color: C.muted, fontSize:13, marginBottom:12 }}>
              📍 {city} · {experience > 0 ? `${experience} ${isRTL ? 'سنة خبرة' : 'yrs exp'}` : (isRTL ? 'محامٍ معتمد' : 'Certified Lawyer')}
            </Text>

            {/* ── Connection-style stats row (LinkedIn style) ── */}
            <View style={{ flexDirection:'row', gap:24, marginBottom:16 }}>
              {[
                { val: `${totalReviews}`, lbl: isRTL ? 'تقييم' : 'Reviews' },
                { val: `${avgRating}⭐`, lbl: isRTL ? 'تقييم متوسط' : 'Rating' },
                { val: `${wins}`, lbl: isRTL ? 'قضية فاز' : 'Cases Won' },
              ].map((s, i) => (
                <TouchableOpacity key={i} style={{ alignItems:'center' }}>
                  <Text style={{ color: GOLD, fontWeight:'900', fontSize:16, fontFamily:'CormorantGaramond-Bold' }}>{s.val}</Text>
                  <Text style={{ color: C.muted, fontSize:11 }}>{s.lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── CTA Buttons (LinkedIn style) ── */}
            <View style={{ flexDirection:'row', gap:10 }}>
              <TouchableOpacity onPress={() => router.push('/lawyer-setup' as any)}
                style={{ flex:1, backgroundColor: GOLD, borderRadius:20, paddingVertical:10, alignItems:'center' }}>
                <Text style={{ color:'#000', fontWeight:'800', fontSize:14 }}>
                  {isRTL ? '✏️ تعديل الملف' : '✏️ Edit Profile'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShare}
                style={{ flex:1, borderWidth:1.5, borderColor: GOLD, borderRadius:20, paddingVertical:10, alignItems:'center' }}>
                <Text style={{ color: GOLD, fontWeight:'800', fontSize:14 }}>
                  {isRTL ? '📤 مشاركة' : '📤 Share Profile'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── ABOUT ──────────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: C.surface, marginTop: 8, padding: 18, borderBottomWidth:1, borderBottomColor: C.border }}>
          <SectionHeader title={isRTL ? 'نبذة عني' : 'About'} C={C} onAction={() => router.push('/edit-profile' as any)} actionLabel={isRTL ? 'تعديل' : 'Edit'} />
          <Text style={{ color: C.text, fontSize: 14, lineHeight: 24, textAlign: isRTL ? 'right' : 'left' }}>{bio}</Text>
        </View>

        {/* ── FEATURED SERVICES ──────────────────────────────────────────── */}
        <View style={{ backgroundColor: C.surface, marginTop: 8, padding: 18, borderBottomWidth:1, borderBottomColor: C.border }}>
          <SectionHeader title={isRTL ? 'خدماتي' : 'Services'} C={C} onAction={() => router.push('/service-pricing' as any)} actionLabel={isRTL ? 'إدارة' : 'Manage'} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            <ServiceCard icon="💬" label={isRTL ? 'نصي' : 'Text'}    price={`${fee} EGP`}        C={C} />
            <ServiceCard icon="📞" label={isRTL ? 'صوتي' : 'Voice'}   price={`${fee * 2} EGP`}    C={C} />
            <ServiceCard icon="📹" label={isRTL ? 'فيديو' : 'Video'}  price={`${fee * 3} EGP`}    C={C} />
            <ServiceCard icon="🏛️" label={isRTL ? 'حضوري' : 'In-Person'} price={`${fee * 4} EGP`} C={C} />
            <ServiceCard icon="📄" label={isRTL ? 'مستند' : 'Review'} price={`${fee * 2} EGP`}    C={C} />
          </ScrollView>
        </View>

        {/* ── SKILLS / SPECIALIZATIONS ───────────────────────────────────── */}
        <View style={{ backgroundColor: C.surface, marginTop: 8, padding: 18, borderBottomWidth:1, borderBottomColor: C.border }}>
          <SectionHeader title={isRTL ? 'التخصصات والمهارات' : 'Skills & Specializations'} C={C} />
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8 }}>
            {(isRTL
              ? ['القانون الجنائي','قانون الشركات','قانون العمل','صياغة العقود','قانون الأسرة','التحكيم والوساطة']
              : ['Criminal Law','Corporate Law','Labour Law','Contract Drafting','Family Law','Arbitration & ADR']
            ).map((skill, i) => (
              <View key={i} style={{ backgroundColor: GOLD+'15', borderWidth:1, borderColor: GOLD+'40', borderRadius:20, paddingHorizontal:12, paddingVertical:6 }}>
                <Text style={{ color: GOLD, fontSize:12, fontWeight:'700' }}>{skill}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── REVIEWS ────────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: C.surface, marginTop: 8, padding: 18 }}>
          <SectionHeader title={isRTL ? `تقييمات العملاء (${totalReviews})` : `Client Reviews (${totalReviews})`} C={C} />
          {/* Rating summary */}
          <View style={{ flexDirection:'row', alignItems:'center', gap:14, backgroundColor: C.card, borderRadius:14, padding:14, marginBottom:16, borderWidth:1, borderColor: C.border }}>
            <Text style={{ fontSize:46, fontWeight:'900', color: GOLD, fontFamily:'CormorantGaramond-Bold' }}>{avgRating.toFixed(1)}</Text>
            <View>
              <Stars rating={avgRating} size={18} />
              <Text style={{ color: C.muted, fontSize:12, marginTop:4 }}>{isRTL ? `من ${totalReviews} تقييم` : `From ${totalReviews} reviews`}</Text>
            </View>
          </View>
          {REVIEWS.map((r, i) => <ReviewCard key={i} {...r} C={C} />)}
        </View>

        {/* ── SETTINGS + LOGOUT (bottom) ──────────────────────────────────── */}
        <View style={{ backgroundColor: C.surface, marginTop:8, borderTopWidth:1, borderTopColor: C.border }}>
          <TouchableOpacity onPress={() => router.push('/account-settings' as any)}
            style={{ flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:20, paddingVertical:18, borderBottomWidth:1, borderBottomColor: C.border }}>
            <Text style={{ fontSize:22 }}>⚙️</Text>
            <Text style={{ color: C.text, fontSize:15, fontWeight:'600', flex:1 }}>
              {isRTL ? 'إعدادات الحساب' : 'Account Settings'}
            </Text>
            <Text style={{ color: C.muted, fontSize:18 }}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert(
            isRTL ? 'تسجيل الخروج' : 'Sign Out',
            isRTL ? 'هل أنت متأكد؟' : 'Are you sure?',
            [{ text: isRTL ? 'إلغاء' : 'Cancel', style:'cancel' }, { text: isRTL ? 'خروج' : 'Sign Out', style:'destructive', onPress: logout }]
          )}
            style={{ flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:20, paddingVertical:18 }}>
            <Text style={{ fontSize:22 }}>🚪</Text>
            <Text style={{ color:'#EF4444', fontSize:15, fontWeight:'700' }}>
              {isRTL ? 'تسجيل الخروج' : 'Sign Out'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}
