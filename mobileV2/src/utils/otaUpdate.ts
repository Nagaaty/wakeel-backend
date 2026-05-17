// ─── OTA Update Checker — Sprint 6 ──────────────────────────────────────────
// Silently checks for updates on app launch.
// If update available: shows a non-blocking banner with "Update & Restart".
// In production: expo-updates pulls the new JS bundle over the air.
import * as Updates from "expo-updates";
import { Alert } from "react-native";

export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "up-to-date" | "error";

let _statusListeners: Array<(s: UpdateStatus) => void> = [];
let _currentStatus: UpdateStatus = "idle";

function _notify(s: UpdateStatus) {
  _currentStatus = s;
  _statusListeners.forEach(fn => fn(s));
}

export function onUpdateStatus(fn: (s: UpdateStatus) => void): () => void {
  _statusListeners.push(fn);
  fn(_currentStatus);
  return () => { _statusListeners = _statusListeners.filter(l => l !== fn); };
}

// Call once on app launch from _layout.tsx
export async function checkForUpdate(): Promise<void> {
  // In dev / Expo Go there are no updates to check
  if (__DEV__ || !Updates.isEnabled) {
    console.log("[OTA] Skipped — running in dev mode");
    return;
  }

  try {
    _notify("checking");
    const result = await Updates.checkForUpdateAsync();

    if (!result.isAvailable) {
      _notify("up-to-date");
      return;
    }

    _notify("available");
    // Download in background
    _notify("downloading");
    await Updates.fetchUpdateAsync();

    // Prompt user to restart
    Alert.alert(
      "Update Ready 🎉",
      "A new version of Wakeel has been downloaded. Restart now to apply it.",
      [
        { text: "Later",   style: "cancel", onPress: () => _notify("idle") },
        { text: "Restart", style: "default", onPress: async () => {
          await Updates.reloadAsync();
        }},
      ]
    );
  } catch (err) {
    _notify("error");
    console.warn("[OTA] Update check failed:", err);
  }
}

export function getCurrentUpdateStatus(): UpdateStatus {
  return _currentStatus;
}
