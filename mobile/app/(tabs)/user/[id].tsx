import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/i18n';
import { usersAPI } from '../../../src/services/api';
import { Avatar, ErrMsg } from '../../../src/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const C = useTheme();
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res: any = await usersAPI.get(id as string);
        setUser(res);
      } catch (err: any) {
        setError(err?.message || 'Could not load user profile');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchUser();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 20, paddingHorizontal: 20 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 24, color: C.text }}>‹ {isRTL ? 'عودة' : 'Back'}</Text>
        </TouchableOpacity>
        <ErrMsg C={C} msg={error || 'User not found'} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 10, paddingBottom: 16, borderBottomWidth: 1, borderColor: C.border }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', paddingHorizontal: 16 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ paddingRight: 16 }}>
            <Text style={{ fontSize: 28, color: C.text, fontWeight: '300' }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: C.text, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'الملف الشخصي' : 'Profile'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
        <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 30 }}>
          <Avatar 
            C={C} 
            url={user.avatar_url} 
            initials={(user.name || 'U').substring(0, 2).toUpperCase()} 
            size={100} 
          />
          <Text style={{ fontSize: 24, fontWeight: '800', color: C.text, marginTop: 16, textAlign: 'center' }}>
            {user.name}
          </Text>
          <Text style={{ color: C.gold, fontSize: 14, fontWeight: '600', marginTop: 4 }}>
            {isRTL ? 'عضو في مجتمع وكيل' : 'Wakeel Community Member'}
          </Text>
          <Text style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>
            {isRTL ? 'انضم في' : 'Joined'} {new Date(user.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long' })}
          </Text>
        </View>

        <View style={{ width: '100%', backgroundColor: C.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontSize: 15, textAlign: 'center', lineHeight: 24 }}>
            {isRTL 
              ? 'هذا الحساب هو حساب عميل خاص. لا يتم عرض أي تفاصيل أخرى لحماية الخصوصية.' 
              : 'This is a private client account. No further details are shown to protect privacy.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
