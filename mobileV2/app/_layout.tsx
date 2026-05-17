// ─── Wakeel Root Layout — with I18nProvider ───────────────────────────────────
// Changes vs original:
//   1. Wraps everything in <I18nProvider> for Arabic/English + RTL
//   2. Syncs global locale to tGlobal() helper
//   3. Splash text uses t() — shows Arabic by default
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, Animated, Easing, LogBox } from 'react-native';

// Mute the Expo Go notification warning that blocks the bottom tabs
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);
import * as ExpoFont from 'expo-font';
import { store } from '../src/store';
import { fetchMe, forceLogout } from '../src/store/slices/authSlice';
import { storage } from '../src/utils/storage';
import { registerForPushNotifications, addResponseListener } from '../src/utils/notifications';
import { router } from 'expo-router';
import { initTheme, LIGHT_C, useTheme } from '../src/theme';
import { hasOnboarded } from './onboarding';
import { ErrorBoundary } from './error-boundary';
import { initDeepLinks } from '../src/utils/deepLinks';
import { initSessionTimeout, resetSessionTimer } from '../src/utils/sessionTimeout';
import { checkForUpdate } from '../src/utils/otaUpdate';
import { wakeServer } from '../src/services/api';
import { UpdateBanner } from './update-banner';
import { SecurityWarningScreen, useSecurityCheck } from './security-warning';
import { SessionWarningBanner } from './session-warning';
import { Gradient, GRADIENTS } from '../src/components/Gradient';
import { I18nProvider, useI18n, setGlobalLocale } from '../src/i18n';
import { useNetworkStatus } from '../src/hooks/useNetworkStatus';
import OfflineScreen from './offline';

// ─── Splash ───────────────────────────────────────────────────────────────────
function SplashScreen({ onDone }: { onDone: () => void }) {
  const C = LIGHT_C;
  const prog   = new Animated.Value(0);
  const opac   = new Animated.Value(1);
  const floatY = new Animated.Value(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -7, duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(floatY, { toValue: 0,  duration: 1600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    Animated.timing(prog, { toValue: 1, duration: 2200, useNativeDriver: false }).start(() => {
      Animated.timing(opac, { toValue: 0, duration: 500, useNativeDriver: true }).start(onDone);
    });
  }, []);

  return (
    <Animated.View 
      pointerEvents="none"
      style={{
      position: 'absolute', inset: 0 as any,
      backgroundColor: C.bg,
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, opacity: opac,
    }}>
      <Animated.View style={{ transform: [{ translateY: floatY }], marginBottom: 18 }}>
        <Gradient
          colors={GRADIENTS.gold}
          style={{
            width: 88, height: 88, borderRadius: 22,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: C.gold, shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.45, shadowRadius: 28,
          }}
        >
          <Text style={{ fontSize: 48 }}>⚖️</Text>
        </Gradient>
      </Animated.View>
      <Text style={{
        fontFamily: 'Cairo-Bold', fontSize: 36,
        color: C.text, letterSpacing: -0.7, marginBottom: 5,
      }}>
        وكيل
      </Text>
      <Text style={{
        fontSize: 10, color: C.muted, letterSpacing: 3.5,
        fontWeight: '700', textTransform: 'uppercase', marginBottom: 44,
        fontFamily: 'DMSans-Regular',
      }}>
        Egypt Legal Marketplace
      </Text>
      <View style={{ width: 160, height: 2, backgroundColor: `${C.border}40`, borderRadius: 1, overflow: 'hidden' }}>
        <Animated.View style={{
          height: '100%',
          width: prog.interpolate({ inputRange: [0, 1], outputRange: [0, 160] }),
          backgroundColor: C.gold, borderRadius: 1,
        }} />
      </View>
    </Animated.View>
  );
}

// ─── Nav — syncs global locale when I18n context changes ─────────────────────
function RootLayoutNav() {
  const [splash, setSplash] = useState(true);
  const { showWarning, dismiss } = useSecurityCheck();
  const C      = useTheme();
  const { locale } = useI18n();

  // Keep tGlobal() in sync
  useEffect(() => { setGlobalLocale(locale); }, [locale]);

  useEffect(() => {
    initTheme();
    // Wake the Render server immediately so it's warm by the time user hits login
    wakeServer();
    // Check onboarding first — before auth
    hasOnboarded().then(done => {
      if (!done) {
        setTimeout(() => router.replace('/onboarding' as any), 100);
      } else {
        storage.get('wakeel_token').then(token => {
          if (token) store.dispatch(fetchMe()).unwrap().catch(() => store.dispatch(forceLogout()));
        });
      }
    });
    registerForPushNotifications().catch(() => {});
    checkForUpdate(); // Silent OTA check
    const unsubDeepLinks = initDeepLinks();
    // Init session timeout for logged-in users
    const unsubSession = initSessionTimeout();
    const unsub = addResponseListener(res => {
      const link = res.notification.request.content.data?.link as string;
      if (link) setTimeout(() => router.push(link as any), 500);
    });
    return () => { unsub(); unsubDeepLinks(); unsubSession(); };
  }, []);

  return (
    <>
      <StatusBar style={C.bg === '#F5F2EC' ? 'dark' : 'light'} backgroundColor={C.bg} />
      <Stack screenOptions={{
        headerShown:  false,
        animation:    'slide_from_right',
        contentStyle: { backgroundColor: C.bg },
      }}>
        <Stack.Screen name="(auth)"   options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)"   options={{ animation: 'fade' }} />
      </Stack>
      {splash && <SplashScreen onDone={() => setSplash(false)} />}
      {showWarning && <SecurityWarningScreen onDismiss={dismiss} />}
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
// ─── Mobile Engineer Agent: Sentry Initialization ───────────────────────────────
import * as Sentry from '@sentry/react-native';

if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    debug: false, 
  });
}

// ─── Root ─────────────────────────────────────────────────────────────────────
function RootLayout() {
  const [fontsLoaded] = ExpoFont.useFonts({
    'Cairo-Bold':                 'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvalIvTr0kTg.ttf',
    'Cairo-SemiBold':             'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvalIvTqEmTg.ttf',
    'Cairo-Regular':              'https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvalIvTp0mTg.ttf',
    'DMSans-Regular':             'https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZa4ET-DNl0.ttf',
    'DMSans-Medium':              'https://fonts.gstatic.com/s/dmsans/v15/rP2Cp2ywxg089UriASitCBimCw.ttf',
    'DMSans-Bold':                'https://fonts.gstatic.com/s/dmsans/v15/rP2Cp2ywxg089UriAWCrCBimCw.ttf',
    'PlayfairDisplay-Bold':       'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFiD-vYSZviVYUb_rj3ij__anPXDTzoY6HNmw.ttf',
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          {/* I18nProvider must be inside Provider so Redux user prefs can drive locale later */}
          <I18nProvider>
            <UpdateBanner />
            <SessionWarningBanner />
            <ErrorBoundary>
              <RootLayoutNav />
            </ErrorBoundary>
          </I18nProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
