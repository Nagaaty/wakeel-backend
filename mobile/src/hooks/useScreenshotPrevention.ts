// ─── useScreenshotPrevention — Sprint 6 ──────────────────────────────────────
// Prevents screenshots on sensitive screens (payments, doc vault).
// Automatically re-enables when the component unmounts.
import { useEffect } from "react";
import * as ScreenCapture from "expo-screen-capture";

export function useScreenshotPrevention(enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, [enabled]);
}

// Allow temporarily for sharing a receipt etc.
export async function allowScreenshot(): Promise<void> {
  await ScreenCapture.allowScreenCaptureAsync().catch(() => {});
}

export async function preventScreenshot(): Promise<void> {
  await ScreenCapture.preventScreenCaptureAsync().catch(() => {});
}
