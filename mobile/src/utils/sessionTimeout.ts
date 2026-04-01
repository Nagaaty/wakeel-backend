// ─── Session Timeout — Sprint 5 ─────────────────────────────────────────────
// Auto-logs out user after TIMEOUT_MS of inactivity.
// Resets on any touch, navigation, or API call.
// Shows a warning 2 minutes before expiry.
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { store } from "../store";
import { forceLogout } from "../store/slices/authSlice";
import { router } from "expo-router";

const TIMEOUT_MS    = 30 * 60 * 1000;  // 30 minutes inactivity
const WARNING_MS    = 28 * 60 * 1000;  // warn 2 min before
const LAST_ACTIVE_KEY = "wakeel_last_active";

let timeoutTimer:  ReturnType<typeof setTimeout> | null = null;
let warningTimer:  ReturnType<typeof setTimeout> | null = null;
let warningCb:     ((remaining: number) => void) | null = null;
let appStateUnsub: (() => void) | null = null;

// ── Register a callback to show warning UI ───────────────────────────────────
export function onSessionWarning(cb: (secondsLeft: number) => void): void {
  warningCb = cb;
}

// ── Reset on any user interaction ────────────────────────────────────────────
export function resetSessionTimer(): void {
  const now = Date.now();
  AsyncStorage.setItem(LAST_ACTIVE_KEY, String(now)).catch(() => {});
  _scheduleTimeout();
}

function _clearTimers() {
  if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
  if (warningTimer) { clearTimeout(warningTimer); warningTimer = null; }
}

function _scheduleTimeout() {
  _clearTimers();

  warningTimer = setTimeout(() => {
    const remaining = Math.round((TIMEOUT_MS - WARNING_MS) / 1000);
    warningCb?.(remaining);
  }, WARNING_MS);

  timeoutTimer = setTimeout(async () => {
    _clearTimers();
    // Log out
    store.dispatch(forceLogout());
    await AsyncStorage.multiRemove([LAST_ACTIVE_KEY, "wakeel_token", "wakeel_user"]);
    router.replace("/(auth)/login" as any);
  }, TIMEOUT_MS);
}

// ── Init — call once in _layout.tsx when user is logged in ───────────────────
export function initSessionTimeout(): () => void {
  resetSessionTimer();

  // Pause/resume on app backgrounding
  const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") {
      // Check if timed out while in background
      AsyncStorage.getItem(LAST_ACTIVE_KEY).then(raw => {
        if (!raw) return;
        const elapsed = Date.now() - parseInt(raw);
        if (elapsed >= TIMEOUT_MS) {
          store.dispatch(forceLogout());
          AsyncStorage.multiRemove([LAST_ACTIVE_KEY, "wakeel_token", "wakeel_user"]).catch(() => {});
          router.replace("/(auth)/login" as any);
        } else {
          _scheduleTimeout();
        }
      }).catch(() => {});
    } else if (state === "background") {
      // Record last active time when going to background
      AsyncStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())).catch(() => {});
    }
  });

  appStateUnsub = () => sub.remove();
  return () => {
    _clearTimers();
    appStateUnsub?.();
  };
}

export function stopSessionTimeout(): void {
  _clearTimers();
  appStateUnsub?.();
}
