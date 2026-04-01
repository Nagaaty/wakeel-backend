// ─── Jailbreak / Root Detection — Sprint 6 ───────────────────────────────────
// Detects if the device is jailbroken (iOS) or rooted (Android).
// On detection: shows a blocking warning screen. Does not crash the app —
// users can still dismiss and continue (legal apps must allow this).
import * as Device from "expo-device";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

export type SecurityRisk = "none" | "jailbreak" | "root" | "emulator";

export interface SecurityCheckResult {
  risk:     SecurityRisk;
  details:  string[];
}

// ── iOS jailbreak indicators ──────────────────────────────────────────────────
const IOS_JAILBREAK_PATHS = [
  "/Applications/Cydia.app",
  "/Library/MobileSubstrate/MobileSubstrate.dylib",
  "/bin/bash",
  "/usr/sbin/sshd",
  "/etc/apt",
  "/private/var/lib/apt",
];

// ── Android root indicators ───────────────────────────────────────────────────
const ANDROID_ROOT_PATHS = [
  "/system/app/Superuser.apk",
  "/sbin/su",
  "/system/bin/su",
  "/system/xbin/su",
  "/data/local/xbin/su",
  "/data/local/bin/su",
  "/system/sd/xbin/su",
  "/system/bin/failsafe/su",
  "/data/local/su",
];

async function checkPathExists(path: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch {
    return false;
  }
}

export async function runSecurityCheck(): Promise<SecurityCheckResult> {
  const details: string[] = [];

  // Emulator detection
  if (!Device.isDevice) {
    return { risk: "emulator", details: ["Running on emulator or simulator"] };
  }

  if (Platform.OS === "ios") {
    // Check for jailbreak paths
    const results = await Promise.all(IOS_JAILBREAK_PATHS.map(p => checkPathExists(p)));
    const found   = IOS_JAILBREAK_PATHS.filter((_, i) => results[i]);
    if (found.length > 0) {
      details.push(...found.map(p => `Found: ${p}`));
      return { risk: "jailbreak", details };
    }
  }

  if (Platform.OS === "android") {
    const results = await Promise.all(ANDROID_ROOT_PATHS.map(p => checkPathExists(p)));
    const found   = ANDROID_ROOT_PATHS.filter((_, i) => results[i]);
    if (found.length > 0) {
      details.push(...found.map(p => `Found: ${p}`));
      return { risk: "root", details };
    }
  }

  return { risk: "none", details: [] };
}
