// ─── Wakeel — Client Public Profile (Chunk 4a — LinkedIn redesign) ───────────
// Replaces the Chunk 3c version with a polished LinkedIn-style layout.
//
// Layout:
//   1. ProfileHeader (cover + avatar + name + role)
//   2. Tab strip: About | Activity
//   3. Tab body — Posts tab is INTENTIONALLY ABSENT for clients by default.
//      Activity respects the user's `forum_activity_public` toggle (set
//      in account settings). When private → empty state with lock icon.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useI18n } from '../../src/i18n';
import { usersAPI } from '../../src/services/api';

import { ProfileHeader } from '../../src/components/profile/ProfileHeader';
import { ActivityFeed }  from '../../src/components/profile/ActivityFeed';

type Tab = 'about' | 'activity';

export default function ClientPublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const C = useTheme();
  const { isRTL } = useI18n();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('about');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res: any = await usersAPI.getProfileSummary(id);
      setUser(res);
    } catch {
      // Fall back to the simpler /:id endpoint
      try {
        const res: any = await usersAPI.get(id);
        setUser(res?.user || res);
      } catch {
        setUser(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🤷</Text>
        <Text style={{ color: C.muted }}>{isRTL ? 'لم يتم العثور على المستخدم' : 'User not found'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: C.gold }}>
          <Text style={{ color: C.gold, fontWeight: '700' }}>{isRTL ? 'عودة' : 'Back'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Lawyers landing on this route should be redirected to the lawyer view —
  // we don't want a 'lawyer' showing up with a stripped client header.
  // This keeps the routing tolerant: anyone with role==='lawyer' redirects.
  useEffect(() => {
    if (user?.role === 'lawyer') {
      router.replace({ pathname: '/lawyer/[id]', params: { id: user.id } } as any);
    }
  }, [user?.role, user?.id]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.gold}
          />
        }
      >
        {/* Header */}
        <ProfileHeader user={user} />

        {/* Tab strip */}
        <View style={[styles.tabStrip, { backgroundColor: C.surface, borderBottomColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {(['about', 'activity'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={[
                styles.tabBtn,
                { flex: 1, borderBottomColor: tab === t ? C.gold : 'transparent' },
              ]}
            >
              <Text style={{
                color: tab === t ? C.gold : C.muted,
                fontWeight: tab === t ? '800' : '500',
                fontSize: 13,
                fontFamily: 'Cairo-Regular',
              }}>
                {t === 'about'
                  ? (isRTL ? '📋 نبذة' : '📋 About')
                  : (isRTL ? '✨ النشاط' : '✨ Activity')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Body */}
        <View style={{ paddingTop: 8, minHeight: 320 }}>
          {tab === 'about' && (
            <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
              <Text style={[styles.sectionTitle, { color: C.text, textAlign: isRTL ? 'right' : 'left' }]}>
                {isRTL ? '👤 نبذة' : '👤 About'}
              </Text>
              <Text style={[styles.bodyText, { color: C.text, textAlign: isRTL ? 'right' : 'left' }]}>
                {user.bio || (isRTL
                  ? 'لم يضف هذا المستخدم نبذة بعد.'
                  : 'No bio yet.')}
              </Text>
            </View>
          )}

          {tab === 'activity' && (
            <ActivityFeed userId={user.id} scrollEnabled={false} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabStrip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 3,
    alignItems: 'center',
  },
  section: {
    marginHorizontal: 12, marginVertical: 6,
    padding: 14, borderRadius: 14,
    borderWidth: 1,
  },
  sectionTitle: { fontWeight: '800', fontSize: 14, marginBottom: 10, fontFamily: 'Cairo-Bold' },
  bodyText: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo-Regular' },
});
