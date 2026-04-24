// ─── Wakeel — In-App Paymob WebView ──────────────────────────────────────────
// Route: /payment-webview?url=...&bookingId=...&amount=...
// Replaces expo-web-browser with an in-app WebView so users never leave the app.
// Handles: success redirect, failure redirect, back button, loading state.
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/hooks/useTheme';
import { useI18n } from '../src/i18n';
import { paymentsAPI } from '../src/services/api';

// Paymob redirects to these URLs after payment
const SUCCESS_PATTERNS = ['success=true', 'payment_status=success', 'txn_response_code=APPROVED', 'wakeel://payment-success'];
const FAILURE_PATTERNS = ['success=false', 'payment_status=fail', 'txn_response_code=DECLINED', 'wakeel://payment-fail'];

export default function PaymentWebViewScreen() {
  const C       = useTheme();
  const { t, isRTL } = useI18n();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{
    url?:       string;
    bookingId?: string;
    amount?:    string;
    method?:    string;
  }>();

  const webRef = useRef<WebView>(null);
  const [loading,    setLoading]    = useState(true);
  const [canGoBack,  setCanGoBack]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [confirmed,  setConfirmed]  = useState(false);
  const [error,      setError]      = useState('');

  const url = params.url || '';

  if (!url) {
    router.back();
    return null;
  }

  // ── Handle URL changes to detect success/failure ─────────────────────────
  const handleNavChange = async (nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    const navUrl = nav.url.toLowerCase();

    const isSuccess = SUCCESS_PATTERNS.some(p => navUrl.includes(p));
    const isFailure = FAILURE_PATTERNS.some(p => navUrl.includes(p));

    if (isSuccess && !confirmed) {
      setConfirmed(true);
      // Confirm payment with backend
      try {
        await paymentsAPI.confirm({
          bookingId: params.bookingId,
          success:   true,
          amount:    params.amount,
          method:    params.method,
        });
      } catch {}
      // Navigate to success screen
      router.replace({
        pathname: '/payment-result',
        params: { success: 'true', booking_id: params.bookingId },
      } as any);
    }

    if (isFailure && !confirmed) {
      setConfirmed(true);
      router.replace({
        pathname: '/payment-result',
        params: { success: 'false', booking_id: params.bookingId },
      } as any);
    }
  };

  const handleError = () => {
    setError(isRTL ? 'تعذر تحميل صفحة الدفع' : 'Could not load payment page');
  };

  const handleBack = () => {
    Alert.alert(
      isRTL ? 'إلغاء الدفع؟' : 'Cancel payment?',
      isRTL ? 'هل تريد العودة؟ لن يتم خصم أي مبلغ.' : 'Go back? No amount will be charged.',
      [
        { text: isRTL ? 'تابع الدفع' : 'Continue', style: 'cancel' },
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  const serif = { fontFamily: 'Cairo-Bold' };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 10,
                     paddingHorizontal: 16, paddingBottom: 12,
                     borderBottomWidth: 1, borderBottomColor: C.border,
                     flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: C.text, fontSize: 22 }}>×</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ ...serif, color: C.text, fontWeight: '700', fontSize: 17 }}>
            {isRTL ? '🔒 الدفع الآمن' : '🔒 Secure Payment'}
          </Text>
          {params.amount ? (
            <Text style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>
              {params.amount} {t('app.egp')} · Paymob
            </Text>
          ) : null}
        </View>
        {/* Navigation buttons */}
        {canGoBack && (
          <TouchableOpacity onPress={() => webRef.current?.goBack()}
            style={{ backgroundColor: C.card, borderRadius: 8, padding: 7, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 14 }}>‹</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      {loading && (
        <View style={{ height: 3, backgroundColor: C.border }}>
          <View style={{ height: '100%', width: `${progress * 100}%`,
                         backgroundColor: C.gold, borderRadius: 2 }} />
        </View>
      )}

      {/* Error state */}
      {error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>⚠️</Text>
          <Text style={{ ...serif, color: C.text, fontSize: 22, fontWeight: '700', marginBottom: 8 }}>
            {isRTL ? 'تعذر التحميل' : 'Loading Failed'}
          </Text>
          <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => { setError(''); webRef.current?.reload(); }}
            style={{ backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('app.retry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
            <Text style={{ color: C.muted, fontSize: 13 }}>{t('app.back')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: url }}
          style={{ flex: 1, backgroundColor: C.bg }}
          onNavigationStateChange={handleNavChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
          onError={handleError}
          onHttpError={({ nativeEvent }) => {
            if (nativeEvent.statusCode >= 500) handleError();
          }}
          // Allow Paymob's payment form scripts
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          // Handle deep-link scheme
          originWhitelist={['https://*', 'http://*', 'wakeel://*']}
          // Show loading spinner inside WebView
          renderLoading={() => (
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
              <ActivityIndicator color={C.gold} size="large" />
              <Text style={{ color: C.muted, marginTop: 14, fontSize: 14 }}>
                {isRTL ? 'جاري تحميل صفحة الدفع...' : 'Loading payment page...'}
              </Text>
            </View>
          )}
          startInLoadingState
          // Security
          mixedContentMode="compatibility"
          userAgent="Wakeel-Mobile/1.0"
        />
      )}

      {/* Security badge */}
      <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
                     paddingHorizontal: 16, paddingVertical: 8, paddingBottom: insets.bottom + 8,
                     flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Text style={{ fontSize: 14 }}>🔒</Text>
        <Text style={{ color: C.muted, fontSize: 11 }}>
          {isRTL ? 'محمي بواسطة Paymob — تشفير SSL 256 بت' : 'Secured by Paymob — 256-bit SSL encryption'}
        </Text>
      </View>
    </View>
  );
}
