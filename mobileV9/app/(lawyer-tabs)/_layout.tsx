import React from 'react';
import { Tabs, Redirect, router } from 'expo-router';
import { useSelector } from 'react-redux';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { selLoggedIn } from '../../src/features/auth/authSlice';
import { useI18n } from '../../src/i18n';
import { TopNav } from '../../src/components/TopNav';

function TabIcon({ icon, label, focused, C }: any) {
  return (
    <View style={{ alignItems: 'center', gap: 1, paddingTop: 2, width: 64 }}>
      <Text style={{ fontSize: focused ? 22 : 20, lineHeight: 24, color: focused ? C.gold : '#888' }}>
        {icon}
      </Text>
      <Text numberOfLines={1} style={{
        fontSize: 10, color: focused ? C.gold : '#888',
        fontWeight: focused ? '700' : '400', textAlign: 'center',
      }}>
        {label}
      </Text>
    </View>
  );
}

// Fully removes screen from tab bar — no visual slot, no layout space
const HIDDEN_TAB = {
  href: undefined as any,
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' as const },
};

export default function LawyerTabsLayout() {
  const C = useTheme();
  const { t } = useI18n();
  const isLoggedIn = useSelector(selLoggedIn);
  const insets = useSafeAreaInsets();

  if (!isLoggedIn) return <Redirect href="/(auth)/login" />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopNav />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: C.surface,
            borderTopColor: C.border,
            borderTopWidth: 1,
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom,
            elevation: 0,
            shadowColor: 'transparent',
            direction: 'ltr',
          },
          tabBarContentContainerStyle: {
            flexDirection: 'row',
            justifyContent: 'space-evenly',
            alignItems: 'center',
            flex: 1,
            direction: 'ltr',
          },
          tabBarShowLabel: false,
          tabBarActiveTintColor: C.gold,
          tabBarInactiveTintColor: '#888',
        }}
      >
        {/* ── 5 VISIBLE TABS ──────────────────────────────────── */}
        <Tabs.Screen name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => (
              <TabIcon icon="🏠" label={t('nav.home')} focused={focused} C={C} />
            ),
          }}
        />
        <Tabs.Screen name="my-requests"
          options={{
            title: 'Consults',
            tabBarIcon: ({ focused }) => (
              <TabIcon icon="📋" label={t('nav.requests')} focused={focused} C={C} />
            ),
          }}
        />
        <Tabs.Screen name="support_tab"
          options={{
            title: 'Support',
            tabBarIcon: ({ focused }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: -8 }}>
                <View style={{
                  width: 48, height: 48, borderRadius: 14,
                  backgroundColor: focused ? C.gold : '#6B4A18',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#9A6F2A', shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
                }}>
                  <Text style={{ fontSize: 22, color: '#F5F2EC' }}>⚖️</Text>
                </View>
              </View>
            ),
          }}
          listeners={{ tabPress: () => router.push('/support') }}
        />
        <Tabs.Screen name="notifications"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ focused }) => (
              <TabIcon icon="🔔" label={t('nav.notifications')} focused={focused} C={C} />
            ),
          }}
        />
        <Tabs.Screen name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => (
              <TabIcon icon="👤" label={t('nav.profile')} focused={focused} C={C} />
            ),
          }}
        />
        {/* ── HIDDEN (not in tab bar) ──────────────────────────── */}
        <Tabs.Screen name="crm"         options={HIDDEN_TAB} />
        <Tabs.Screen name="schedule"    options={HIDDEN_TAB} />
        <Tabs.Screen name="jobs"        options={HIDDEN_TAB} />
        <Tabs.Screen name="reviews"     options={HIDDEN_TAB} />
        <Tabs.Screen name="my-postings" options={HIDDEN_TAB} />
        <Tabs.Screen name="forum"       options={HIDDEN_TAB} />
      </Tabs>
    </View>
  );
}
