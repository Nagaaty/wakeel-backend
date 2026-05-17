// ─── Haptics Utility — Sprint 5 ─────────────────────────────────────────────
// Centralised wrapper so every interaction uses the right haptic pattern.
// Falls back silently on simulators / devices without haptics hardware.
import * as Haptics from "expo-haptics";

// Light tap — toggle, select, navigate
export async function hapticLight(): Promise<void> {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }
  catch {}
}

// Medium impact — confirm, submit, send message
export async function hapticMedium(): Promise<void> {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }
  catch {}
}

// Heavy — destructive action, error
export async function hapticHeavy(): Promise<void> {
  try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); }
  catch {}
}

// Success double-tap — booking confirmed, payment done, review submitted
export async function hapticSuccess(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

// Error — failed payment, wrong password, network error
export async function hapticError(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {}
}

// Warning — form validation, low balance
export async function hapticWarning(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {}
}

// Selection changed — tab switch, filter change, date pick
export async function hapticSelect(): Promise<void> {
  try { await Haptics.selectionAsync(); }
  catch {}
}
