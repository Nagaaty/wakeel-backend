// ─── Push Notifications Utility — Sprint 3 ───────────────────────────────────
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { pushAPI } from '../services/api';
import { storage } from './storage';

// How notifications look when app is in foreground
try {
  if (Constants.appOwnership !== 'expo') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (e) {
  // Ignored in Expo Go SDK 53 where this feature was removed
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

// ── Check current permission status without requesting ───────────────────────
export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  if (!Device.isDevice) return 'unavailable';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as PermissionStatus;
  } catch {
    return 'unavailable';
  }
}

// ── Request permissions + register token ─────────────────────────────────────
export async function registerForPushNotifications(): Promise<{
  status: PermissionStatus;
  token: string | null;
}> {
  if (!Device.isDevice) {
    return { status: 'unavailable', token: null };
  }

  // SDK 53+ removed push notification support from Expo Go. Returning early to prevent errors.
  if (Constants.appOwnership === 'expo') {
    return { status: 'unavailable', token: null };
  }

  // Android channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('wakeel-default', {
      name:             'Wakeel Notifications',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       '#C8A84B',
      sound:            'notification.wav',
    });
    await Notifications.setNotificationChannelAsync('wakeel-messages', {
      name:       'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound:      'notification.wav',
    });
    await Notifications.setNotificationChannelAsync('wakeel-bookings', {
      name:       'Bookings & Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') {
    return { status: 'granted', token: await _getAndRegisterToken() };
  }

  if (existingStatus === 'denied') {
    // Already denied — can't ask again, must go to settings
    return { status: 'denied', token: null };
  }

  // Request permission
  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  if (status !== 'granted') {
    return { status: status as PermissionStatus, token: null };
  }

  return { status: 'granted', token: await _getAndRegisterToken() };
}

async function _getAndRegisterToken(): Promise<string | null> {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    const token = tokenData.data;
    await pushAPI.register(token, Platform.OS).catch(() => {});
    await storage.set('wakeel_push_token', token);
    return token;
  } catch (err) {
    console.warn('[Push] Failed to get token:', err);
    return null;
  }
}

// ── Open device notification settings ────────────────────────────────────────
export async function openNotificationSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL('app-settings:');
  } else {
    await Linking.openSettings();
  }
}

// ── Notification preferences (stored locally) ────────────────────────────────
export interface NotifPreferences {
  messages:    boolean;
  bookings:    boolean;
  payments:    boolean;
  reminders:   boolean;
  broadcasts:  boolean;
  marketing:   boolean;
}

const DEFAULT_PREFS: NotifPreferences = {
  messages:   true,
  bookings:   true,
  payments:   true,
  reminders:  true,
  broadcasts: true,
  marketing:  false,
};

export async function getNotifPreferences(): Promise<NotifPreferences> {
  try {
    const raw = await storage.get('wakeel_notif_prefs');
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotifPreferences(prefs: NotifPreferences): Promise<void> {
  await storage.set('wakeel_notif_prefs', JSON.stringify(prefs));
}

// ── Event listeners ───────────────────────────────────────────────────────────
export function addNotificationListener(
  handler: (n: Notifications.Notification) => void
): () => void {
  const sub = Notifications.addNotificationReceivedListener(handler);
  return () => sub.remove();
}

export function addResponseListener(
  handler: (r: Notifications.NotificationResponse) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  return () => sub.remove();
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count).catch(() => {});
}

export async function clearAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync().catch(() => {});
  await setBadgeCount(0);
}
