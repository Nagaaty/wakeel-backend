import { Tabs, Redirect, router } from 'expo-router';
import { useSelector } from 'react-redux';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { selLoggedIn } from '../../src/features/auth/authSlice';
import { useI18n } from '../../src/i18n';
import { TopNav } from '../../src/components/TopNav';
import { useUnreadNotifs } from '../../src/hooks/useUnreadNotifs';

function TabIcon({ icon, label, focused, C, badge }: any) {
  return (
    <View style={{ alignItems: 'center', gap: 1, paddingTop: 2, width: 64 }}>
      <View style={{ position: 'relative' }}>
        <Text style={{ fontSize: focused ? 22 : 20, lineHeight: 24, color: focused ? C.gold : '#888' }}>
          {icon}
        </Text>
        {badge > 0 && (
          <View style={{
            position: 'absolute', top: -4, right: -8,
            minWidth: 18, height: 18, borderRadius: 9,
            backgroundColor: '#E11D48', borderWidth: 1.5, borderColor: C.surface,
            paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={{
        fontSize: 10, color: focused ? C.gold : '#888',
        fontWeight: focused ? '700' : '400', textAlign: 'center',
      }}>
        {label}
      </Text>
    </View>
  );
}

// Shared options for screens that should NOT appear in the tab bar
const HIDDEN_TAB = {
  href: undefined as any,
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' as const },
};

export default function TabsLayout() {
  const C = useTheme();
  const { t, isRTL } = useI18n();
  const isLoggedIn = useSelector(selLoggedIn);
  const insets = useSafeAreaInsets();
  const { count: unreadCount } = useUnreadNotifs();

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
            flexDirection: isRTL ? 'row-reverse' : 'row',
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
            title: 'Requests',
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
              <TabIcon icon="🔔" label={t('nav.notifications')} focused={focused} C={C} badge={unreadCount} />
            ),
          }}
        />
        <Tabs.Screen name="lawyers"
          options={{
            title: 'Find Lawyers',
            tabBarIcon: ({ focused }) => (
              <TabIcon icon="🔍" label={t('nav.lawyers')} focused={focused} C={C} />
            ),
          }}
        />
        {/* ── HIDDEN (not in tab bar) ──────────────────────────── */}
        <Tabs.Screen name="forum"     options={HIDDEN_TAB} />
        <Tabs.Screen name="profile"   options={HIDDEN_TAB} />
        <Tabs.Screen name="jobs"      options={HIDDEN_TAB} />
        <Tabs.Screen name="ai"        options={HIDDEN_TAB} />
        <Tabs.Screen name="user/[id]" options={HIDDEN_TAB} />
      </Tabs>
    </View>
  );
}
