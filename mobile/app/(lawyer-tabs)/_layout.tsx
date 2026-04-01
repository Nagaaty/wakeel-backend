import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useSelector } from 'react-redux';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/theme';
import { selLoggedIn } from '../../src/store/slices/authSlice';
import { useI18n } from '../../src/i18n';
import { TopNav } from '../../src/components/TopNav';

function TabIcon({ icon, label, focused, C }: any) {
  return (
    <View style={{ alignItems:'center', gap:2, paddingTop:3, maxWidth: 65 }}>
      <Text style={{ fontSize:focused?22:20, lineHeight:24, color:focused?C.gold:'#888' }}>{icon}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 10, color:focused?C.gold:'#888', fontWeight:focused?'700':'400' }}>
        {label}
      </Text>
    </View>
  );
}

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
            height: 58 + insets.bottom,
            paddingBottom: insets.bottom,
            elevation: 0,
            shadowColor: 'transparent',
          },
          tabBarShowLabel: false,
          tabBarActiveTintColor: C.gold,
          tabBarInactiveTintColor: '#888',
        }}
      >
        <Tabs.Screen name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => <TabIcon icon="👤" label={t('nav.profile')} focused={focused} C={C} />,
          }}
        />
        <Tabs.Screen name="jobs"
          options={{
            title: 'Jobs',
            tabBarIcon: ({ focused }) => <TabIcon icon="💼" label={t('jobs.title')} focused={focused} C={C} />,
          }}
        />
        <Tabs.Screen name="forum"
          options={{
            title: 'Forum',
            tabBarIcon: ({ focused }) => (
              <View style={{ alignItems:'center', justifyContent:'center', marginTop:-6 }}>
                <View style={{
                  width:44, height:44, borderRadius:14,
                  backgroundColor: focused ? C.gold : '#6B4A18',
                  alignItems:'center', justifyContent:'center',
                  shadowColor:'#9A6F2A', shadowOffset:{width:0,height:4},
                  shadowOpacity:0.5, shadowRadius:8, elevation:8,
                }}>
                  <Text style={{ fontSize:20, color:'#F5F2EC' }}>⚖️</Text>
                </View>
              </View>
            ),
          }}
        />
        <Tabs.Screen name="notifications"
          options={{
            title: 'Notifications',
            tabBarIcon: ({ focused }) => <TabIcon icon="🔔" label={t('nav.notifications')} focused={focused} C={C} />,
          }}
        />
        <Tabs.Screen name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label={t('nav.home')} focused={focused} C={C} />,
          }}
        />
      </Tabs>
    </View>
  );
}
