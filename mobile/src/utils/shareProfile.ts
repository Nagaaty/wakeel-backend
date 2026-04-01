// ─── Lawyer Profile Share Utility ────────────────────────────────────────────
// Builds rich share content per platform and triggers the native share sheet.
import { Share, Platform, Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";

interface LawyerShareData {
  id:                string | number;
  name:              string;
  specialization?:   string;
  city?:             string;
  avg_rating?:       string | number;
  total_reviews?:    number;
  consultation_fee?: string | number;
  experience_years?: number;
  is_verified?:      boolean;
  wins?:             number;
  losses?:           number;
}

// ── Build the share text ──────────────────────────────────────────────────────
function buildShareText(lawyer: LawyerShareData, isRTL: boolean): string {
  const verified  = lawyer.is_verified ? (isRTL ? "✅ محامٍ موثق" : "✅ Verified Lawyer") : "";
  const rating    = lawyer.avg_rating   ? `⭐ ${Number(lawyer.avg_rating).toFixed(1)}` : "";
  const reviews   = lawyer.total_reviews ? `(${lawyer.total_reviews} ${isRTL ? "تقييم" : "reviews"})` : "";
  const price     = lawyer.consultation_fee ? `💰 ${isRTL ? "من" : "From"} ${lawyer.consultation_fee} ${isRTL ? "ج.م" : "EGP"}` : "";
  const exp       = lawyer.experience_years ? `🏆 ${lawyer.experience_years} ${isRTL ? "سنة خبرة" : "yrs experience"}` : "";
  const wins      = (lawyer.wins || lawyer.losses)
    ? `⚖️ ${lawyer.wins || 0}W / ${lawyer.losses || 0}L` : "";

  const url = `https://wakeel.eg/lawyers/${lawyer.id}`;

  if (isRTL) {
    return [
      `👤 ${lawyer.name}`,
      lawyer.specialization ? `⚖️ ${lawyer.specialization}` : "",
      lawyer.city ? `📍 ${lawyer.city}` : "",
      verified,
      [rating, reviews].filter(Boolean).join(" "),
      exp,
      price,
      wins,
      "",
      `احجز استشارة قانونية الآن على وكيل:`,
      url,
      "",
      "🔗 حمّل التطبيق: https://wakeel.eg/download",
    ].filter(Boolean).join("\n");
  }

  return [
    `👤 ${lawyer.name}`,
    lawyer.specialization ? `⚖️ ${lawyer.specialization}` : "",
    lawyer.city ? `📍 ${lawyer.city}` : "",
    verified,
    [rating, reviews].filter(Boolean).join(" "),
    exp,
    price,
    wins,
    "",
    `Book a legal consultation on Wakeel:`,
    url,
    "",
    "🔗 Download the app: https://wakeel.eg/download",
  ].filter(Boolean).join("\n");
}

// ── Main share function ───────────────────────────────────────────────────────
export async function shareLawyerProfile(
  lawyer: LawyerShareData,
  isRTL:  boolean = true
): Promise<void> {
  const url  = `https://wakeel.eg/lawyers/${lawyer.id}`;
  const text = buildShareText(lawyer, isRTL);
  const title = isRTL
    ? `${lawyer.name} — محامٍ على وكيل`
    : `${lawyer.name} — Lawyer on Wakeel`;

  try {
    const result = await Share.share(
      {
        title,
        message: Platform.OS === "android" ? `${text}` : text,
        url:     Platform.OS === "ios" ? url : undefined,
      },
      {
        dialogTitle: isRTL ? "مشاركة ملف المحامي" : "Share Lawyer Profile",
        subject:     title,
      }
    );

    if (result.action === Share.sharedAction) {
      console.log("[Share] Shared via:", result.activityType || "unknown");
    }
  } catch (err: any) {
    // Fallback: copy link to clipboard
    if (!err.message?.includes("cancel")) {
      await Clipboard.setStringAsync(url);
      Alert.alert(
        isRTL ? "تم النسخ" : "Copied",
        isRTL ? "تم نسخ رابط الملف إلى الحافظة" : "Profile link copied to clipboard"
      );
    }
  }
}

// ── Copy profile link only ────────────────────────────────────────────────────
export async function copyProfileLink(
  lawyerId: string | number,
  isRTL:    boolean = true
): Promise<void> {
  const url = `https://wakeel.eg/lawyers/${lawyerId}`;
  await Clipboard.setStringAsync(url);
  Alert.alert(
    isRTL ? "تم النسخ ✓" : "Copied ✓",
    isRTL ? "تم نسخ رابط الملف" : "Profile link copied"
  );
}

// ── Open specific platform ────────────────────────────────────────────────────
export async function shareToWhatsApp(lawyer: LawyerShareData, isRTL: boolean = true): Promise<void> {
  const text = encodeURIComponent(buildShareText(lawyer, isRTL));
  const url  = `whatsapp://send?text=${text}`;
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    // WhatsApp not installed — fallback to web
    await Linking.openURL(`https://wa.me/?text=${text}`);
  }
}
