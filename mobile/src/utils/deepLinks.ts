// ─── Deep Link Handler — Sprint 5 ────────────────────────────────────────────
// Handles incoming URLs from:
//   wakeel://lawyers/123          → lawyer profile
//   wakeel://book?lawyer=123      → booking screen
//   wakeel://messages             → messages list
//   wakeel://messages?convId=45   → specific conversation
//   wakeel://notifications        → notifications
//   wakeel://bookings             → my bookings
//   wakeel://payment-result?...   → payment result
//   https://wakeel.eg/lawyers/123 → same as above
import { Linking } from "react-native";
import { router } from "expo-router";

// Map URL path → Expo Router path
function resolveRoute(url: string): string | null {
  try {
    // Normalise: strip scheme, handle both wakeel:// and https://wakeel.eg/
    const cleaned = url
      .replace("https://wakeel.eg", "wakeel://")
      .replace("http://wakeel.eg",  "wakeel://");

    const urlObj = new URL(cleaned);
    const path   = urlObj.pathname.replace(/\/+/g, "/").replace(/^\/?/, "/");
    const params = Object.fromEntries(urlObj.searchParams.entries());

    // Route map
    if (path.match(/^\/lawyers?\/([\w-]+)$/)) {
      const id = path.split("/").pop();
      return `/lawyer/${id}`;
    }
    if (path === "/lawyers" || path === "/lawyers/") return "/(tabs)/lawyers";
    if (path === "/book")        return params.lawyer ? `/book?lawyer=${params.lawyer}` : "/book";
    if (path === "/messages")    return params.convId ? `/messages/index?convId=${params.convId}` : "/messages/index";
    if (path === "/bookings")    return "/bookings";
    if (path === "/notifications") return "/notifications";
    if (path === "/payment-result") {
      const qs = new URLSearchParams(params).toString();
      return `/payment-result?${qs}`;
    }
    if (path === "/profile")     return "/(tabs)/profile";
    if (path === "/referral")    return "/referral";
    if (path === "/support")     return "/support";
    if (path === "/" || path === "") return "/(tabs)";

    return null;
  } catch {
    return null;
  }
}

// Handle a URL — called from _layout.tsx
export function handleDeepLink(url: string): void {
  const route = resolveRoute(url);
  if (route) {
    // Small delay ensures navigator is mounted
    setTimeout(() => router.push(route as any), 300);
  }
}

// Init: handle URL that launched the app + subscribe to future URLs
export function initDeepLinks(): () => void {
  // URL that opened the app from cold start
  Linking.getInitialURL().then(url => {
    if (url) handleDeepLink(url);
  }).catch(() => {});

  // URLs while app is running
  const sub = Linking.addEventListener("url", ({ url }) => {
    handleDeepLink(url);
  });

  return () => sub.remove();
}
