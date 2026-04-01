import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../src/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/hooks/useAuth';
import { useI18n } from '../src/i18n';

// ─── Sub-Component: Lawyer Hub ────────────────────────────────────────────────
function LawyerHub({ C, insets, t, isRTL, user }: any) {
  const serif = { fontFamily: 'CormorantGaramond-Bold' };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 20, paddingBottom: 16, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 24, color: C.text }}>{isRTL ? '›' : '‹'}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>مركز المحامين</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Hero Greeting */}
        <View style={{ backgroundColor: C.gold, borderRadius: 20, padding: 24, marginBottom: 20, shadowColor: C.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>مرحباً بك في وكيل،</Text>
          <Text style={{ ...serif, color: '#FFF', fontSize: 28 }}>{user?.name || 'أستاذ المحاماة'}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 12, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>
            أنت الآن جزء من أكبر شبكة قانونية رقمية في مصر. إدارة أعمالك، جذب الموكلين، وتقديم استشاراتك أصبح أسهل من أي وقت مضى.
          </Text>
        </View>

        {/* Live Platform Stats */}
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>إحصائيات المنصة (مباشر) 📊</Text>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, marginBottom: 24 }}>
          <View style={{ flex: 1, backgroundColor: C.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
            <Text style={{ fontSize: 24, color: C.text, fontWeight: '800' }}>3,420+</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>عميل نشط اليوم</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: C.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
            <Text style={{ fontSize: 24, color: C.gold, fontWeight: '800' }}>150+</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>قضية مطروحة للجدولة</Text>
          </View>
        </View>

        {/* Success Academy */}
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>أكاديمية وكيل للنجاح 🎓</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }} contentContainerStyle={{ paddingHorizontal: 4, gap: 16, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {[
            { title: 'كيف تتصدر نتائج بحث العملاء؟', icon: '⭐', color: '#FEFAED', borderColor: '#FBE8A6' },
            { title: 'دليلك الشامل لتقديم استشارة فيديو', icon: '📹', color: '#F3F4F6', borderColor: '#E5E7EB' },
            { title: 'نصائح لزيادة تقييماتك على المنصة', icon: '📈', color: '#F0FDFF', borderColor: '#BAE6FD' },
          ].map((card, i) => (
            <TouchableOpacity key={i} style={{ width: 160, backgroundColor: card.color, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: card.borderColor }}>
              <Text style={{ fontSize: 28, marginBottom: 12 }}>{card.icon}</Text>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, lineHeight: 22, textAlign: isRTL ? 'right' : 'left' }}>{card.title}</Text>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 8, fontWeight: '600', textAlign: isRTL ? 'right' : 'left' }}>اقرأ المقال ›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Quick Actions */}
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>روابط سريعة ⚡</Text>
        <View style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
          <TouchableOpacity style={{ padding: 16, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 20 }}>🔗</Text>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>مشاركة رابط الحساب الشخصي</Text>
            </View>
            <Text style={{ color: C.muted }}>{isRTL ? '›' : '‹'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/support' as any)} style={{ padding: 16, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 20 }}>💬</Text>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>الدعم الفني المخصص للمحامين</Text>
            </View>
            <Text style={{ color: C.muted }}>{isRTL ? '›' : '‹'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ padding: 16, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 20 }}>📜</Text>
              <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>ميثاق الشرف والأحكام</Text>
            </View>
            <Text style={{ color: C.muted }}>{isRTL ? '›' : '‹'}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Sub-Component: Client About (Legacy) ─────────────────────────────────────
function ClientAbout({ C, insets, isRTL }: any) {
  const serif = { fontFamily: 'CormorantGaramond-Bold' };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: insets.top + 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 24, color: C.text }}>{isRTL ? '›' : '‹'}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>عن المنصة</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100, alignItems: 'center' }}>
        <View style={{ backgroundColor: C.gold, width: 80, height: 80, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Text style={{ ...serif, color: '#fff', fontSize: 44 }}>W</Text>
        </View>
        <Text style={{ ...serif, fontSize: 32, color: C.text, marginBottom: 8 }}>Wakeel</Text>
        <Text style={{ fontSize: 14, color: C.muted, fontWeight: '600', marginBottom: 40 }}>الإصدار 1.0.0</Text>

        <View style={{ width: '100%', backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 20 }}>
          <Text style={{ fontSize: 16, color: C.text, fontWeight: '700', marginBottom: 12, textAlign: isRTL ? 'right' : 'left' }}>رؤيتنا 🌟</Text>
          <Text style={{ fontSize: 14, color: C.muted, lineHeight: 24, textAlign: isRTL ? 'right' : 'left' }}>
            نسعى في وكيل لرقمنة السوق القانوني المصري، وتسهيل عملية وصول الموكلين إلى أفضل المحامين المتخصصين بشفافية وسهولة تامة.
          </Text>
        </View>

        <View style={{ width: '100%', backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 16, color: C.text, fontWeight: '700', marginBottom: 12, textAlign: isRTL ? 'right' : 'left' }}>روابط هامة 🔗</Text>
          {['الشروط والأحكام', 'سياسة الخصوصية', 'فريق العمل', 'تواصل معنا'].map((link, i) => (
            <TouchableOpacity key={i} style={{ paddingVertical: 14, borderBottomWidth: i===3?0:1, borderBottomColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, color: C.text, fontWeight: '600' }}>{link}</Text>
              <Text style={{ color: C.muted }}>{isRTL ? '›' : '‹'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function AboutScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const { isRTL, t } = useI18n();
  const { user } = useAuth();

  if (user?.role === 'lawyer') {
    return <LawyerHub C={C} insets={insets} t={t} isRTL={isRTL} user={user} />;
  }

  return <ClientAbout C={C} insets={insets} isRTL={isRTL} />;
}
