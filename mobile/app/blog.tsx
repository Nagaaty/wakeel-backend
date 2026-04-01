import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, I18nManager } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

I18nManager.forceRTL(true);

const POSTS = [
  {
    id: 1, category: 'قانون العمل', readTime: '5 دقائق',
    title: 'حقوقك القانونية عند الفصل من العمل في مصر 2025',
    excerpt: 'يكفل قانون العمل المصري رقم 12 لسنة 2003 حماية واسعة للعمال. تعرف على كل حقوقك عند الفصل التعسفي أو انتهاء العقد.',
    author: 'د. أحمد حسن', date: '15 مارس 2025', likes: 342, views: 4820,
  },
  {
    id: 2, category: 'قانون الأسرة', readTime: '7 دقائق',
    title: 'دليل الطلاق في مصر: الإجراءات والمستندات والمدة الزمنية',
    excerpt: 'كل ما تحتاج معرفته عن إجراءات الطلاق في مصر، من تقديم الدعوى حتى الحكم النهائي، مع نصائح عملية من محامين متخصصين.',
    author: 'د. نادية المصري', date: '12 مارس 2025', likes: 287, views: 6103,
  },
  {
    id: 3, category: 'قانون الشركات', readTime: '6 دقائق',
    title: 'كيف تؤسس شركة في مصر 2025: الخطوات والتكاليف والوثائق',
    excerpt: 'دليل شامل لتأسيس الشركات في مصر، يغطي أنواع الشركات المختلفة وإجراءات التسجيل في هيئة الاستثمار والشهر العقاري.',
    author: 'أ. خالد منصور', date: '10 مارس 2025', likes: 198, views: 3241,
  },
  {
    id: 4, category: 'القانون العقاري', readTime: '4 دقائق',
    title: '10 أشياء يجب التحقق منها قبل شراء شقة في مصر',
    excerpt: 'قائمة مرجعية أعدها محامون متخصصون في القانون العقاري لحماية حقوقك عند شراء عقار في مصر وتجنب النصب والاحتيال.',
    author: 'أ. سارة فؤاد', date: '8 مارس 2025', likes: 521, views: 8902,
  },
  {
    id: 5, category: 'الملكية الفكرية', readTime: '5 دقائق',
    title: 'حماية علامتك التجارية في مصر: التسجيل والتكاليف والمدة',
    excerpt: 'كل ما تحتاج معرفته عن تسجيل العلامة التجارية في مكتب تسجيل العلامات التجارية المصري وحمايتها من التقليد.',
    author: 'د. عمر شفيق', date: '5 مارس 2025', likes: 156, views: 2134,
  },
];

const CATEGORIES = ['الكل', 'قانون العمل', 'قانون الأسرة', 'قانون الشركات', 'القانون العقاري', 'الملكية الفكرية'];

export default function BlogScreen() {
  const C = useTheme();
  const { t, isRTL, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [cat, setCat] = useState('الكل');
  const [selected, setSelected] = useState<any>(null);

  const filtered = cat === 'الكل' ? POSTS : POSTS.filter(p => p.category === cat);

  if (selected) return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => setSelected(null)}>
          <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: C.gold, fontSize: 12, fontWeight: '600', flex: 1 }}>{selected.category}</Text>
        <Text style={{ color: C.muted, fontSize: 11 }}>⏱ {selected.readTime}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '800', lineHeight: 32, marginBottom: 14 }}>{selected.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 12 }}>{selected.author[0]}</Text>
          </View>
          <View>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{selected.author}</Text>
            <Text style={{ color: C.muted, fontSize: 11 }}>{selected.date}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={{ color: C.muted, fontSize: 12 }}>👁 {selected.views.toLocaleString()}</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 14, lineHeight: 26, marginBottom: 20 }}>
          {selected.excerpt}
          {'\n\n'}
          في ظل التغييرات المتسارعة في التشريعات المصرية خلال السنوات الأخيرة، بات من الضروري الاستعانة بمحامٍ متخصص لفهم حقوقك الكاملة وضمان أفضل النتائج الممكنة في قضيتك.
          {'\n\n'}
          يوفر نظام Wakeel.eg منصة متخصصة تربطك بأفضل المحامين المتخصصين في هذا المجال، مع إمكانية الاطلاع على سجل قضاياهم ونسبة فوزهم الموثقة من المحاكم المصرية الرسمية.
        </Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/(tabs)/lawyers', params: { cat: selected.category } } as any)}
          style={{ backgroundColor: C.gold, borderRadius: 14, padding: 15, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>🔍 ابحث عن محامٍ في {selected.category}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
          </TouchableOpacity>
          <View>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 18 }}>المدونة القانونية</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>مقالات قانونية من محامين معتمدين</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIES.map(c => {
            const active = cat === c;
            return (
              <TouchableOpacity key={c} onPress={() => setCat(c)}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: active ? C.gold : C.border, backgroundColor: active ? C.gold : 'transparent' }}>
                <Text style={{ color: active ? '#fff' : C.text, fontSize: 12, fontWeight: active ? '700' : '400' }}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {filtered.map(post => (
          <TouchableOpacity key={post.id} onPress={() => setSelected(post)} activeOpacity={0.8}
            style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ backgroundColor: C.card2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>{post.category}</Text>
              </View>
              <Text style={{ color: C.muted, fontSize: 11 }}>⏱ {post.readTime}</Text>
            </View>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, lineHeight: 22, marginBottom: 8 }}>{post.title}</Text>
            <Text style={{ color: C.muted, fontSize: 12, lineHeight: 20, marginBottom: 12 }} numberOfLines={2}>{post.excerpt}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#000', fontWeight: '700', fontSize: 11 }}>{post.author[0]}</Text>
                </View>
                <Text style={{ color: C.muted, fontSize: 12 }}>{post.author}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Text style={{ color: C.muted, fontSize: 12 }}>❤️ {post.likes}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>👁 {post.views.toLocaleString()}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
