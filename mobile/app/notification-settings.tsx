// ─── Wakeel — Notification Settings Screen ───────────────────────────────────
// Route: /notification-settings
// Shows: permission status banner, per-type toggles, open device settings button
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Switch, Animated, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/hooks/useTheme';
import { useI18n } from '../src/i18n';
import { hapticLight } from '../src/utils/haptics';
import {
  getNotificationPermissionStatus,
  registerForPushNotifications,
  openNotificationSettings,
  getNotifPreferences,
  saveNotifPreferences,
  type NotifPreferences,
  type PermissionStatus,
} from '../src/utils/notifications';

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({ icon, title, subtitle, value, onChange, disabled, C, isRTL }: any) {
  return (
    <View style={{
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 14,
      paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
      opacity: disabled ? 0.45 : 1,
    }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: C.card2,
                     alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '600', fontSize: 14,
                       textAlign: isRTL ? 'right' : 'left' }}>{title}</Text>
        <Text style={{ color: C.muted, fontSize: 12, marginTop: 2,
                       textAlign: isRTL ? 'right' : 'left' }}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: C.border, true: C.gold + '80' }}
        thumbColor={value ? C.gold : C.dim}
        ios_backgroundColor={C.border}
      />
    </View>
  );
}

// ── Permission banner ─────────────────────────────────────────────────────────
function PermissionBanner({ status, onEnable, onOpenSettings, C, isRTL }: any) {
  const slideY = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 180 }).start();
  }, []);

  if (status === 'granted') {
    return (
      <Animated.View style={{ transform: [{ translateY: slideY }],
        backgroundColor: C.green + '12', borderWidth: 1, borderColor: C.green + '30',
        borderRadius: 14, padding: 14, marginBottom: 20,
        flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 22 }}>✅</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.green, fontWeight: '700', fontSize: 14,
                         textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'الإشعارات مفعلة' : 'Notifications Enabled'}
          </Text>
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 2,
                         textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'ستتلقى إشعارات لحجوزاتك ورسائلك' : "You'll receive alerts for bookings and messages"}
          </Text>
        </View>
      </Animated.View>
    );
  }

  if (status === 'denied') {
    return (
      <Animated.View style={{ transform: [{ translateY: slideY }],
        backgroundColor: C.red + '10', borderWidth: 1, borderColor: C.red + '30',
        borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Text style={{ fontSize: 22 }}>🔕</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.red, fontWeight: '700', fontSize: 14,
                           textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? 'الإشعارات معطلة' : 'Notifications Blocked'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 12, marginTop: 2,
                           textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL
                ? 'فعّل الإشعارات من إعدادات الجهاز لتلقي تنبيهات الحجوزات'
                : 'Enable in device settings to receive booking and message alerts'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onOpenSettings}
          style={{ backgroundColor: C.red, borderRadius: 10, paddingVertical: 11,
                   alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
            {isRTL ? '⚙️ فتح إعدادات الجهاز' : '⚙️ Open Device Settings'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // undetermined — show enable button
  return (
    <Animated.View style={{ transform: [{ translateY: slideY }],
      backgroundColor: C.gold + '10', borderWidth: 1, borderColor: C.gold + '30',
      borderRadius: 14, padding: 16, marginBottom: 20 }}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Text style={{ fontSize: 22 }}>🔔</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.gold, fontWeight: '700', fontSize: 14,
                         textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'فعّل الإشعارات' : 'Enable Notifications'}
          </Text>
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 2,
                         textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL
              ? 'لا تفوت أي موعد أو رسالة من محاميك'
              : "Don't miss a booking reminder or message from your lawyer"}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onEnable}
        style={{ backgroundColor: C.gold, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}>
        <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>
          {isRTL ? '🔔 تفعيل الإشعارات' : '🔔 Enable Notifications'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NotificationSettingsScreen() {
  const C      = useTheme();
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const serif  = { fontFamily: 'CormorantGaramond-Bold' };

  const [permStatus, setPermStatus] = useState<PermissionStatus>('undetermined');
  const [prefs,      setPrefs]      = useState<NotifPreferences>({
    messages: true, bookings: true, payments: true,
    reminders: true, broadcasts: true, marketing: false,
  });
  const [loading,  setLoading]  = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [saved,    setSaved]    = useState(false);

  useEffect(() => {
    Promise.all([
      getNotificationPermissionStatus(),
      getNotifPreferences(),
    ]).then(([status, savedPrefs]) => {
      setPermStatus(status);
      setPrefs(savedPrefs);
    }).finally(() => setLoading(false));
  }, []);

  const handleEnable = async () => {
    setEnabling(true);
    const { status } = await registerForPushNotifications();
    setPermStatus(status);
    setEnabling(false);
  };

  const togglePref = async (key: keyof NotifPreferences) => { hapticLight();
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await saveNotifPreferences(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const NOTIF_ROWS: Array<{
    key: keyof NotifPreferences;
    icon: string;
    title: string;
    titleAr: string;
    sub: string;
    subAr: string;
  }> = [
    { key: 'messages',   icon: '💬', title: 'Messages',          titleAr: 'الرسائل',        sub: 'New messages from your lawyer',         subAr: 'رسائل جديدة من محاميك'         },
    { key: 'bookings',   icon: '📅', title: 'Bookings',           titleAr: 'الحجوزات',       sub: 'Booking confirmations and updates',     subAr: 'تأكيد الحجوزات والتحديثات'    },
    { key: 'reminders',  icon: '⏰', title: 'Session Reminders',  titleAr: 'تذكيرات الجلسات', sub: '30 minutes before your consultation',  subAr: 'قبل 30 دقيقة من موعدك'        },
    { key: 'payments',   icon: '💰', title: 'Payments',           titleAr: 'المدفوعات',      sub: 'Payment confirmations and receipts',    subAr: 'تأكيد الدفع والإيصالات'       },
    { key: 'broadcasts', icon: '📣', title: 'Bid Notifications',  titleAr: 'العروض الجديدة', sub: 'New bids on your broadcast requests',   subAr: 'عروض جديدة على طلباتك'        },
    { key: 'marketing',  icon: '🎁', title: 'Offers & Promotions',titleAr: 'العروض والخصومات', sub: 'Promo codes and special deals',       subAr: 'أكواد خصم وعروض خاصة'         },
  ];

  const isDisabled = permStatus !== 'granted';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.gold} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 12,
                     paddingHorizontal: 16, paddingBottom: 14,
                     borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: C.text, fontSize: 22 }}>{isRTL ? '›' : '‹'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ ...serif, color: C.text, fontWeight: '700', fontSize: 20,
                           textAlign: isRTL ? 'right' : 'left' }}>
              {isRTL ? '🔔 إعدادات الإشعارات' : '🔔 Notification Settings'}
            </Text>
          </View>
          {saved && (
            <Text style={{ color: C.green, fontSize: 12, fontWeight: '700' }}>
              {isRTL ? 'تم الحفظ ✓' : 'Saved ✓'}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Permission banner */}
        <PermissionBanner
          status={enabling ? 'undetermined' : permStatus}
          onEnable={handleEnable}
          onOpenSettings={openNotificationSettings}
          C={C} isRTL={isRTL}
        />

        {enabling && (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <ActivityIndicator color={C.gold} />
            <Text style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>
              {isRTL ? 'جاري طلب الإذن...' : 'Requesting permission...'}
            </Text>
          </View>
        )}

        {/* Notification type toggles */}
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16,
                       borderWidth: 1, borderColor: C.border, marginBottom: 20 }}>
          <Text style={{ ...serif, color: C.text, fontWeight: '700', fontSize: 17,
                         marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'أنواع الإشعارات' : 'Notification Types'}
          </Text>
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 14,
                         textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL ? 'اختر الإشعارات التي تريد تلقيها' : 'Choose which notifications to receive'}
          </Text>
          {NOTIF_ROWS.map(row => (
            <ToggleRow
              key={row.key}
              icon={row.icon}
              title={isRTL ? row.titleAr : row.title}
              subtitle={isRTL ? row.subAr : row.sub}
              value={prefs[row.key]}
              onChange={() => togglePref(row.key)}
              disabled={isDisabled}
              C={C} isRTL={isRTL}
            />
          ))}
        </View>

        {/* Info box */}
        <View style={{ backgroundColor: C.card2, borderRadius: 12, padding: 14,
                       borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.muted, fontSize: 12, lineHeight: 18,
                         textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL
              ? '💡 إشعارات الرسائل والحجوزات مهمة لتجربة سلسة. يمكنك دائماً تعديل هذه الإعدادات لاحقاً من ملفك الشخصي.'
              : '💡 Message and booking notifications are important for a smooth experience. You can always change these settings later from your profile.'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
