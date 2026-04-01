// ─── Wakeel — Offline Screen ─────────────────────────────────────────────────
// Shown as an overlay whenever connectivity drops to "offline"
// Supports: retry button, cached data notice, last-online timestamp
import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Animated, Easing } from "react-native";
import { useTheme } from "../src/hooks/useTheme";
import { useI18n } from "../src/i18n";
import { getConnectivityStatus } from "../src/utils/network";

interface Props {
  onRetry?: () => void;
  hasCache?: boolean;
  cachedAt?: string | null;
}

export default function OfflineScreen({ onRetry, hasCache, cachedAt }: Props) {
  const C = useTheme();
  const { isRTL } = useI18n();
  const serif = { fontFamily: "CormorantGaramond-Bold" };

  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<"" | "still_offline" | "back_online">("");

  const bounce = useRef(new Animated.Value(0)).current;
  const fade   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -12, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(bounce, { toValue: 0,   duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    setRetryResult("");
    await new Promise(r => setTimeout(r, 1000));
    const status = await getConnectivityStatus();
    setRetrying(false);
    if (status === "online") {
      setRetryResult("back_online");
      setTimeout(() => { onRetry?.(); }, 600);
    } else {
      setRetryResult("still_offline");
      setTimeout(() => setRetryResult(""), 2500);
    }
  };

  return (
    <Animated.View style={{
      position: "absolute", inset: 0,
      backgroundColor: C.bg,
      alignItems: "center", justifyContent: "center",
      padding: 32, opacity: fade, zIndex: 9000,
    }}>
      {/* Animated wifi icon */}
      <Animated.View style={{ marginBottom: 28, transform: [{ translateY: bounce }] }}>
        <View style={{
          width: 110, height: 110, borderRadius: 55,
          backgroundColor: C.card,
          borderWidth: 2, borderColor: C.border,
          alignItems: "center", justifyContent: "center",
          shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.1, shadowRadius: 16, elevation: 4,
        }}>
          <Text style={{ fontSize: 52 }}>📡</Text>
        </View>
      </Animated.View>

      <Text style={{ ...serif, color: C.text, fontSize: 28, fontWeight: "700", marginBottom: 10, textAlign: "center" }}>
        {isRTL ? "لا يوجد اتصال" : "No Internet Connection"}
      </Text>
      <Text style={{ color: C.muted, fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 32 }}>
        {isRTL
          ? "تحقق من اتصالك بالإنترنت أو شبكة Wi-Fi وحاول مجدداً."
          : "Check your internet or Wi-Fi connection and try again."}
      </Text>

      {/* Cached data notice */}
      {hasCache && (
        <View style={{
          backgroundColor: C.gold + "12", borderWidth: 1, borderColor: C.gold + "30",
          borderRadius: 12, padding: 14, marginBottom: 24, width: "100%",
          flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 10,
        }}>
          <Text style={{ fontSize: 20 }}>💾</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.gold, fontWeight: "700", fontSize: 13, textAlign: isRTL ? "right" : "left" }}>
              {isRTL ? "بيانات محفوظة متاحة" : "Cached data available"}
            </Text>
            {cachedAt && (
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 2, textAlign: isRTL ? "right" : "left" }}>
                {isRTL ? `آخر تحديث: ${cachedAt}` : `Last updated: ${cachedAt}`}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Retry result feedback */}
      {retryResult === "still_offline" && (
        <View style={{
          backgroundColor: C.red + "12", borderWidth: 1, borderColor: C.red + "30",
          borderRadius: 10, padding: 10, marginBottom: 16, width: "100%",
        }}>
          <Text style={{ color: C.red, fontSize: 13, textAlign: "center", fontWeight: "600" }}>
            {isRTL ? "لا يزال غير متصل. تحقق من الاتصال." : "Still offline. Check your connection."}
          </Text>
        </View>
      )}
      {retryResult === "back_online" && (
        <View style={{
          backgroundColor: C.green + "12", borderWidth: 1, borderColor: C.green + "30",
          borderRadius: 10, padding: 10, marginBottom: 16, width: "100%",
        }}>
          <Text style={{ color: C.green, fontSize: 13, textAlign: "center", fontWeight: "700" }}>
            {isRTL ? "✅ تم الاتصال! جاري التحميل..." : "✅ Back online! Loading..."}
          </Text>
        </View>
      )}

      {/* Retry button */}
      <TouchableOpacity
        onPress={handleRetry}
        disabled={retrying}
        style={{
          backgroundColor: retrying ? C.dim : C.gold,
          borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36,
          flexDirection: "row", alignItems: "center", gap: 8,
          shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: retrying ? 0 : 0.35, shadowRadius: 10, elevation: 4,
        }}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 18 }}>{retrying ? "⌛" : "🔄"}</Text>
        <Text style={{ color: "#000", fontWeight: "700", fontSize: 15 }}>
          {retrying
            ? (isRTL ? "جاري التحقق..." : "Checking...")
            : (isRTL ? "إعادة المحاولة" : "Try Again")}
        </Text>
      </TouchableOpacity>

      {/* Tips */}
      <View style={{ marginTop: 36, gap: 8, width: "100%" }}>
        {(isRTL
          ? ["تحقق من تفعيل Wi-Fi أو البيانات", "تأكد من عدم وجود وضع الطائرة", "أعد تشغيل جهازك إذا استمرت المشكلة"]
          : ["Check if Wi-Fi or mobile data is on", "Make sure Airplane mode is off", "Restart your device if the issue persists"]
        ).map((tip, i) => (
          <View key={i} style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted, flexShrink: 0 }} />
            <Text style={{ color: C.muted, fontSize: 13, textAlign: isRTL ? "right" : "left" }}>{tip}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}
