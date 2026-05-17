import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useTheme } from '../../src/theme';
import { CachedAvatar } from '../../src/components/CachedImage';
import { usersAPI } from '../../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const res: any = await usersAPI.get(id as string);
        if (res?.user) setUserProfile(res.user);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  if (!userProfile) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: C.muted }}>لم يتم العثور على المستخدم</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, padding: 12, backgroundColor: C.card, borderRadius: 8 }}>
          <Text style={{ color: C.text }}>عودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = (userProfile.name || '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Premium Header */}
        <View style={{ backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 24 }}>
          {/* Cover Photo / Gradient Area */}
          <View style={{ width: '100%', height: 140, backgroundColor: C.gold + '20', position: 'relative' }}>
            <Image 
              source={{ uri: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=1000' }} 
              style={{ width: '100%', height: '100%', opacity: 0.15 }} 
              resizeMode="cover" 
            />
            
            {/* Nav Row overlay */}
            <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
              <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 }}>
                <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>‹</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Profile info (Absolute positioned avatar overlapping the cover) */}
          <View style={{ paddingHorizontal: 20, marginTop: -50, alignItems: 'center' }}>
            <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: C.surface, padding: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 }}>
              <CachedAvatar C={C} uri={userProfile.avatar_url} initials={initials} size={96} />
            </View>
            <Text style={{ color: C.text, fontWeight: '800', fontSize: 26, fontFamily: 'Cairo-Bold', marginTop: 12, textAlign: 'center' }}>{userProfile.name}</Text>
            
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
              <View style={{ backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.gold, fontSize: 13, fontWeight: '700' }}>
                  {userProfile.role === 'lawyer' ? '⚖️ محامٍ' : '👤 عضو عميل'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ padding: 20 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 16 }}>نشاط العضو</Text>
          <View style={{ backgroundColor: C.card, borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🌱</Text>
            <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
              يمكنك متابعة نشاط هذا الحساب قريباً في تحديثات وكيل القادمة.
            </Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}
