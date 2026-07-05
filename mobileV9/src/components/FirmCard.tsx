import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Stars, Btn } from './ui';
import { useI18n } from '../i18n';

interface FirmCardProps {
  firm: {
    id: string;
    name: string;
    bio: string;
    logo_url: string;
    city: string;
    rating: string | number;
    review_count: number;
    office_hours: string;
    phone: string;
  };
  C: any;
  onPress: () => void;
  isGrid?: boolean;
}

export const FirmCard = memo(function FirmCard({ firm, C, onPress, isGrid = true }: FirmCardProps) {
  const { isRTL } = useI18n();
  const ratingVal = parseFloat(String(firm.rating)) || 4.5;

  if (isGrid) {
    return (
      <View style={{
        flex: 1, backgroundColor: C.card,
        borderWidth: 1, borderColor: C.border,
        borderRadius: 16, padding: 12,
        marginHorizontal: 6, marginBottom: 12, overflow: 'hidden', alignItems: 'center'
      }}>
        <View style={{ position:'absolute', top:0, left:0, right:0, height:60, backgroundColor: C.gold, opacity:0.03 }} pointerEvents="none" />

        {/* Logo */}
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ marginBottom: 10, marginTop: 8 }}>
          <Image
            source={{ uri: firm.logo_url || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop' }}
            style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: C.card2 }}
          />
        </TouchableOpacity>

        {/* Firm Info */}
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, textAlign: 'center', marginBottom: 2, fontFamily: 'Cairo-Bold' }} numberOfLines={1}>
          {firm.name}
        </Text>
        <Text style={{ color: C.muted, fontSize: 11, textAlign: 'center', marginBottom: 6 }}>
          📍 {isRTL ? firm.city : firm.city}
        </Text>

        <View style={{ marginBottom: 8 }}>
          <Stars rating={ratingVal} C={C} size={12} />
        </View>

        <Text style={{ color: C.text, fontSize: 11, textAlign: 'center', marginBottom: 12, height: 32 }} numberOfLines={2}>
          {firm.bio}
        </Text>

        {/* Action Button */}
        <View style={{ width: '100%' }}>
          <Btn C={C} onPress={onPress} size="sm">
            {isRTL ? '🏢 عرض التفاصيل' : '🏢 View Details'}
          </Btn>
        </View>
      </View>
    );
  }

  // List layout
  return (
    <View style={{
      backgroundColor: C.card,
      borderWidth: 1, borderColor: C.border,
      borderRadius: 16, padding: 12,
      marginBottom: 12, overflow: 'hidden',
      flexDirection: 'row', alignItems: 'center', gap: 12
    }}>
      <Image
        source={{ uri: firm.logo_url || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=150&h=150&fit=crop' }}
        style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: C.card2 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, fontFamily: 'Cairo-Bold' }} numberOfLines={1}>
          {firm.name}
        </Text>
        <Text style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>
          📍 {firm.city} • {firm.office_hours}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Stars rating={ratingVal} C={C} size={11} />
          <Text style={{ color: C.muted, fontSize: 10 }}>({firm.review_count} reviews)</Text>
        </View>
        <Text style={{ color: C.text, fontSize: 11 }} numberOfLines={2}>
          {firm.bio}
        </Text>
      </View>
      <TouchableOpacity onPress={onPress} style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.card2, borderRadius: 8, borderWidth: 1, borderColor: C.border }}>
        <Text style={{ color: C.gold, fontSize: 12, fontWeight: 'bold' }}>➔</Text>
      </TouchableOpacity>
    </View>
  );
});
