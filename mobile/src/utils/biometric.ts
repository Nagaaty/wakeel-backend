// ─── Biometric Authentication Utility — Sprint 3 ─────────────────────────────
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { storage } from './storage';

export type BiometricType = 'fingerprint' | 'faceid' | 'iris' | 'none';

export interface BiometricCapability {
  isAvailable:    boolean;
  isEnrolled:     boolean;
  supportedTypes: BiometricType[];
  primaryType:    BiometricType;
}

// ── Check device capability ───────────────────────────────────────────────────
export async function getBiometricCapability(): Promise<BiometricCapability> {
  try {
    const isAvailable = await LocalAuthentication.hasHardwareAsync();
    if (!isAvailable) return { isAvailable: false, isEnrolled: false, supportedTypes: [], primaryType: 'none' };

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types      = await LocalAuthentication.supportedAuthenticationTypesAsync();

    const supportedTypes: BiometricType[] = types.map(t => {
      if (t === LocalAuthentication.AuthenticationType.FINGERPRINT) return 'fingerprint';
      if (t === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) return 'faceid';
      if (t === LocalAuthentication.AuthenticationType.IRIS) return 'iris';
      return 'none';
    }).filter(t => t !== 'none') as BiometricType[];

    // iOS prefers Face ID, Android fingerprint
    const primaryType: BiometricType =
      Platform.OS === 'ios' && supportedTypes.includes('faceid') ? 'faceid' :
      supportedTypes.includes('fingerprint') ? 'fingerprint' :
      supportedTypes[0] || 'none';

    return { isAvailable, isEnrolled, supportedTypes, primaryType };
  } catch {
    return { isAvailable: false, isEnrolled: false, supportedTypes: [], primaryType: 'none' };
  }
}

// ── Authenticate ──────────────────────────────────────────────────────────────
export async function authenticateWithBiometrics(
  promptMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { isAvailable, isEnrolled } = await getBiometricCapability();
    if (!isAvailable || !isEnrolled) {
      return { success: false, error: 'biometric_unavailable' };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage:  promptMessage || 'Verify your identity',
      cancelLabel:    'Use Password',
      fallbackLabel:  'Use Password',
      disableDeviceFallback: false,
    });

    if (result.success) return { success: true };
    return { success: false, error: result.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Biometric enabled preference ─────────────────────────────────────────────
export async function isBiometricEnabled(): Promise<boolean> {
  const val = await storage.get('wakeel_biometric_enabled');
  return val === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await storage.set('wakeel_biometric_enabled', enabled ? 'true' : 'false');
}

// ── Labels per type ───────────────────────────────────────────────────────────
export function getBiometricLabel(type: BiometricType, isRTL: boolean): string {
  const labels: Record<BiometricType, { ar: string; en: string }> = {
    faceid:      { ar: 'Face ID',     en: 'Face ID'        },
    fingerprint: { ar: 'بصمة الإصبع', en: 'Fingerprint'   },
    iris:        { ar: 'مسح القزحية', en: 'Iris Scan'      },
    none:        { ar: 'بيومتري',     en: 'Biometrics'     },
  };
  return isRTL ? labels[type].ar : labels[type].en;
}

export function getBiometricIcon(type: BiometricType): string {
  const icons: Record<BiometricType, string> = {
    faceid: '🫣', fingerprint: '👆', iris: '👁️', none: '🔐',
  };
  return icons[type];
}
