import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Linking, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../../src/theme';
import { useI18n } from '../../src/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppDispatch } from '../../src/store';
import {
  fetchFirmById, fetchFirmLawyers, clearCurrentFirm,
  selCurrentFirm, selCurrentFirmLawyers, selFirmsLoading
} from '../../src/features/lawyers/lawyersSlice';
import { Stars, Btn } from '../../src/components/ui';

export default function FirmDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const C = useTheme();
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch<AppDispatch>();

  const firm = useSelector(selCurrentFirm);
  const lawyers = useSelector(selCurrentFirmLawyers);
  const loading = useSelector(selFirmsLoading);

  useEffect(() => {
    if (id) {
      dispatch(fetchFirmById(id));
      dispatch(fetchFirmLawyers(id));
    }
    return () => {
      dispatch(clearCurrentFirm());
    };
  }, [dispatch, id]);

  const handleCall = () => {
    if (firm?.phone) {
      Linking.openURL(`tel:${firm.phone}`);
    }
  };

  const handleWebsite = () => {
    if (firm?.website) {
      Linking.openURL(firm.website);
    }
  };

  if (loading && !firm) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  if (!firm) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🤷</Text>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>
          {isRTL ? 'لم يتم العثور على الشركة' : 'Law firm not found'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: C.gold }}>
          <Text style={{ color: C.gold, fontWeight: '700' }}>{isRTL ? 'عودة' : 'Back'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Bar */}
      <View style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: C.card,
        borderBottomWidth: 1,
        borderBottomColor: C.border
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={{
          flex: 1,
          textAlign: 'center',
          color: C.text,
          fontSize: 16,
          fontWeight: '700',
          fontFamily: 'Cairo-Bold',
          marginHorizontal: 12
        }} numberOfLines={1}>
          {firm.name}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Cover Section */}
        <View style={{ position: 'relative', height: 120, backgroundColor: C.border }}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=200&fit=crop' }}
            style={{ width: '100%', height: '100%' }}
          />
          <View style={{
            position: 'absolute', bottom: -40, left: 16,
            borderWidth: 3, borderColor: C.bg, borderRadius: 16, overflow: 'hidden'
          }}>
            <Image
              source={{ uri: firm.logo_url || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop' }}
              style={{ width: 80, height: 80, backgroundColor: C.card }}
            />
          </View>
        </View>

        {/* Firm Title & Contacts */}
        <View style={{ marginTop: 50, paddingHorizontal: 16 }}>
          <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', fontFamily: 'Cairo-Bold', marginBottom: 4 }}>
            {firm.name}
          </Text>
          
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 8 }}>
            📍 {firm.city} • {firm.office_hours}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Stars rating={parseFloat(firm.rating) || 4.5} C={C} size={14} />
            <Text style={{ color: C.text, fontSize: 12, fontWeight: '600' }}>
              {firm.rating} ({firm.review_count} {isRTL ? 'تقييم' : 'reviews'})
            </Text>
          </View>

          {/* Quick Contact Buttons */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {firm.phone && (
              <TouchableOpacity
                onPress={handleCall}
                style={{
                  flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 10
                }}
              >
                <Ionicons name="call" size={16} color={C.gold} />
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>
                  {isRTL ? 'اتصال' : 'Call'}
                </Text>
              </TouchableOpacity>
            )}
            {firm.website && (
              <TouchableOpacity
                onPress={handleWebsite}
                style={{
                  flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 10
                }}
              >
                <Ionicons name="globe" size={16} color={C.gold} />
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '600' }}>
                  {isRTL ? 'الموقع الإلكتروني' : 'Website'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bio Section */}
          <View style={{
            backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 20
          }}>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', fontFamily: 'Cairo-Bold', marginBottom: 8 }}>
              {isRTL ? '🏢 عن الشركة' : '🏢 About the Firm'}
            </Text>
            <Text style={{ color: C.text, fontSize: 13, lineHeight: 22 }}>
              {firm.bio}
            </Text>
          </View>

          {/* Firm lawyers list */}
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', fontFamily: 'Cairo-Bold', marginBottom: 12 }}>
            {isRTL ? '⚖️ محامو الشركة' : '⚖️ Our Attorneys'}
          </Text>

          {lawyers.length > 0 ? (
            <View style={{ gap: 10 }}>
              {lawyers.map((lawyer: any) => (
                <TouchableOpacity
                  key={lawyer.id}
                  onPress={() => router.push(`/lawyer/${lawyer.id}`)}
                  activeOpacity={0.9}
                  style={{
                    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12,
                    flexDirection: 'row', alignItems: 'center', gap: 12
                  }}
                >
                  <Image
                    source={{ uri: lawyer.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' }}
                    style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: C.card2 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                      {lawyer.name}
                    </Text>
                    <Text style={{ color: C.muted, fontSize: 11 }} numberOfLines={1}>
                      {lawyer.specialization} • {lawyer.experience} {isRTL ? 'سنوات خبرة' : 'yrs exp.'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Stars rating={parseFloat(lawyer.rating) || 4.5} C={C} size={10} />
                      <Text style={{ color: C.text, fontSize: 10 }}>({lawyer.review_count})</Text>
                    </View>
                  </View>
                  <Btn C={C} onPress={() => router.push({ pathname: '/book', params: { lawyer: lawyer.id } })} size="sm">
                    {isRTL ? 'حجز' : 'Book'}
                  </Btn>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={{ paddingVertical: 30, alignItems: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16 }}>
              <Text style={{ fontSize: 24, marginBottom: 6 }}>⚖️</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>
                {isRTL ? 'لا توجد محامين مسجلين حالياً' : 'No attorneys listed yet'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
