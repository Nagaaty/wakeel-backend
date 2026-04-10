import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useI18n } from '../../src/i18n';
import { lawyersAPI } from '../../src/services/api';

export default function ClientReviews() {
  const C = useTheme();
  const { isRTL } = useI18n();

  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    lawyersAPI.getMyReviews()
      .then((res: any) => setReviews(res.reviews || []))
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0 ? (reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / totalReviews).toFixed(1) : 0;
  const fiveStars = reviews.filter(r => Number(r.rating) === 5).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
           <TouchableOpacity onPress={() => router.back()}>
             <Text style={{ fontSize: 24, color: C.text }}>{isRTL ? '>' : '<'}</Text>
           </TouchableOpacity>
           <Text style={{ fontSize: 18, fontWeight: '700', color: C.text }}>{isRTL ? 'تقييمات العملاء' : 'Client Reviews'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Top Dark Banner */}
        <View style={{ backgroundColor: '#1A1829', borderRadius: 16, padding: 24, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#D97706', fontSize: 36, fontWeight: '700' }}>{avgRating}</Text>
                <Text style={{ color: '#A1A1AA', fontSize: 13, marginTop: 4 }}>{isRTL ? 'متوسط التقييم' : 'Avg Rating'}</Text>
            </View>
            <View style={{ width: 1, height: 40, backgroundColor: '#3F3F46' }} />
            <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#10B981', fontSize: 36, fontWeight: '700' }}>{fiveStars}</Text>
                <Text style={{ color: '#A1A1AA', fontSize: 13, marginTop: 4 }}>{isRTL ? '5 نجوم' : '5-Stars'}</Text>
            </View>
            <View style={{ width: 1, height: 40, backgroundColor: '#3F3F46' }} />
            <View style={{ alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 36, fontWeight: '700' }}>{totalReviews}</Text>
                <Text style={{ color: '#A1A1AA', fontSize: 13, marginTop: 4 }}>{isRTL ? 'التقييمات' : 'Total Reviews'}</Text>
            </View>
        </View>

        {loading ? (
            <ActivityIndicator color={C.gold} style={{ marginTop: 50 }} />
        ) : reviews.length === 0 ? (
            <Text style={{ textAlign: 'center', color: C.muted, marginTop: 40 }}>{isRTL ? 'لا توجد تقييمات بعد' : 'No reviews yet'}</Text>
        ) : (
            reviews.map((c, i) => (
                <View key={i} style={{ backgroundColor: '#EFECE5', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ color: C.text, fontWeight: '700', fontSize: 16 }}>{c.client_name || (isRTL ? 'عميل' : 'Client')}</Text>
                        <View style={{ flexDirection: 'row', gap: 2 }}>
                            {Array.from({ length: 5 }).map((_, idx) => (
                                <Text key={idx} style={{ color: idx < c.rating ? '#D97706' : '#D4D4D8', fontSize: 16 }}>★</Text>
                            ))}
                        </View>
                    </View>
                    <Text style={{ color: C.muted, fontSize: 12, textAlign: isRTL ? 'right' : 'left', marginBottom: 12 }}>
                        {new Date(c.created_at).toLocaleDateString()} • {c.service_type || (isRTL ? 'استشارة' : 'Consultation')}
                    </Text>
                    {c.comment ? (
                        <Text style={{ color: C.text, fontSize: 14, lineHeight: 22, textAlign: isRTL ? 'right' : 'left' }}>"{c.comment}"</Text>
                    ) : (
                        <Text style={{ color: C.muted, fontSize: 14, fontStyle: 'italic', textAlign: isRTL ? 'right' : 'left' }}>{isRTL ? 'لم يترك العميل تعليقاً.' : 'No written feedback provided.'}</Text>
                    )}
                </View>
            ))
        )}
      </ScrollView>
    </View>
  );
}
