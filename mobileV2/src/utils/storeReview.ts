// ─── App Store Review Prompt Utility — Sprint 4 ─────────────────────────────
// Shows native review dialog after a user completes their first consultation.
// Throttled: only shows once per 30 days max, and only after >= 1 completed booking.
import * as StoreReview from "expo-store-review";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_REVIEW_KEY  = "wakeel_last_review_prompt";
const REVIEW_COUNT_KEY = "wakeel_completed_consultations";
const MIN_DAYS_BETWEEN = 30;
const MIN_COMPLETIONS  = 1;

// Call this after a booking is marked "completed"
export async function recordCompletedConsultation(): Promise<void> {
  try {
    const raw   = await AsyncStorage.getItem(REVIEW_COUNT_KEY);
    const count = parseInt(raw || "0") + 1;
    await AsyncStorage.setItem(REVIEW_COUNT_KEY, String(count));
    await maybeRequestReview(count);
  } catch {}
}

async function maybeRequestReview(completedCount: number): Promise<void> {
  try {
    // Need at least MIN_COMPLETIONS
    if (completedCount < MIN_COMPLETIONS) return;

    // Check if enough days have passed since last prompt
    const lastRaw = await AsyncStorage.getItem(LAST_REVIEW_KEY);
    if (lastRaw) {
      const daysSince = (Date.now() - parseInt(lastRaw)) / (1000 * 60 * 60 * 24);
      if (daysSince < MIN_DAYS_BETWEEN) return;
    }

    // Check platform support
    const isAvailable = await StoreReview.isAvailableAsync();
    if (!isAvailable) return;

    // Record this prompt time BEFORE showing (prevents race conditions)
    await AsyncStorage.setItem(LAST_REVIEW_KEY, String(Date.now()));

    // Show native review dialog
    await StoreReview.requestReview();
  } catch {}
}

// Manual trigger — e.g. from a "Rate the app" button in settings
export async function requestReviewManually(): Promise<void> {
  try {
    const isAvailable = await StoreReview.isAvailableAsync();
    if (isAvailable) {
      await StoreReview.requestReview();
    }
  } catch {}
}

// Reset for testing
export async function resetReviewState(): Promise<void> {
  await AsyncStorage.multiRemove([LAST_REVIEW_KEY, REVIEW_COUNT_KEY]);
}
