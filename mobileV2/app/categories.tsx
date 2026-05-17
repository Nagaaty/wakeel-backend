import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, I18nManager } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

I18nManager.forceRTL(true);

const CATS = [
  { id: 1,  icon: '⚖️',  name: 'القانون الجنائي',    sub: 'دفاع جنائي، جنح، جنايات، نقض' },
  { id: 2,  icon: '👨‍👩‍👧', name: 'قانون الأسرة',       sub: 'طلاق، حضانة، نفقة، ميراث' },
  { id: 3,  icon: '🏢',  name: 'قانون الشركات',      sub: 'تأسيس، عقود، نزاعات تجارية' },
  { id: 4,  icon: '🏠',  name: 'القانون العقاري',     sub: 'بيع، إيجار، نزاعات عقارية' },
  { id: 5,  icon: '💼',  name: 'قانون العمل',         sub: 'فصل، عقود، تعويضات' },
  { id: 6,  icon: '💡',  name: 'الملكية الفكرية',    sub: 'براءات، علامات تجارية، حقوق' },
  { id: 7,  icon: '🌍',  name: 'قانون الهجرة',        sub: 'تأشيرات، إقامة، جنسية' },
  { id: 8,  icon: '📜',  name: 'القانون المدني',      sub: 'عقود، مسؤولية مدنية، تعويض' },
  { id: 9,  icon: '🏦',  name: 'القانون البنكي',      sub: 'قروض، ديون، تسهيلات' },
  { id: 10, icon: '🌐',  name: 'قانون الإنترنت',      sub: 'جرائم إلكترونية، بيانات شخصية' },
  { id: 11, icon: '🏛️',  name: 'القانون الإداري',     sub: 'طعون، لوائح، حكومة' },
  { id: 12, icon: '📊',  name: 'قانون الأوراق المالية', sub: 'بورصة، استثمار، مساهمون' },
  { id: 13, icon: '🚗',  name: 'قانون المرور',         sub: 'حوادث، تعويضات، مخالفات' },
  { id: 14, icon: '🏥',  name: 'الأخطاء الطبية',       sub: 'إهمال، تعويض، مساءلة' },
  { id: 15, icon: '🌱',  name: 'القانون البيئي',        sub: 'ملوثات، غرامات، تراخيص' },
  { id: 16, icon: '⚓',  name: 'القانون البحري',        sub: 'شحن، موانئ، تأمين بحري' },
];

export default function CategoriesScreen() {
  const C = useTheme();
  const { t, isRTL, locale } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 18 }}>التخصصات القانونية</Text>
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>16 تخصص · ابحث عن المحامي المناسب</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {CATS.map(cat => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => router.push({ pathname: '/(tabs)/lawyers', params: { cat: cat.name } } as any)}
              activeOpacity={0.75}
              style={{
                width: '47%',
                backgroundColor: C.card,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: 16,
                padding: 16,
              }}
            >
              <Text style={{ fontSize: 32, marginBottom: 10 }}>{cat.icon}</Text>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>{cat.name}</Text>
              <Text style={{ color: C.muted, fontSize: 11, lineHeight: 16 }}>{cat.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
