// ─── UpdateBanner — Sprint 6 ─────────────────────────────────────────────────
// Subtle top banner shown when an OTA update is available/downloading.
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { useTheme } from "../src/theme";
import { useI18n } from "../src/i18n";
import { onUpdateStatus, type UpdateStatus } from "../src/utils/otaUpdate";
import * as Updates from "expo-updates";

export function UpdateBanner() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const slideY = new Animated.Value(-60);

  useEffect(() => {
    return onUpdateStatus(s => {
      setStatus(s);
      if (s === "available" || s === "downloading") {
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 14 }).start();
      }
    });
  }, []);

  if (status !== "available" && status !== "downloading") return null;

  const isDownloading = status === "downloading";

  return (
    <Animated.View style={{
      position: "absolute", top: 0, left: 0, right: 0, zIndex: 9997,
      backgroundColor: C.accent,
      transform: [{ translateY: slideY }],
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center", gap: 10,
      paddingHorizontal: 16, paddingVertical: 11,
    }}>
      <Text style={{ fontSize: 16 }}>{isDownloading ? "⬇️" : "🎉"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
          {isRTL
            ? (isDownloading ? "جاري تحميل التحديث..." : "تحديث جديد متاح")
            : (isDownloading ? "Downloading update..." : "New update available")}
        </Text>
        {!isDownloading && (
          <Text style={{ color: "#ffffff99", fontSize: 11 }}>
            {isRTL ? "سيتم التحديث تلقائياً" : "Will apply on next restart"}
          </Text>
        )}
      </View>
      {!isDownloading && (
        <TouchableOpacity
          onPress={async () => { await Updates.reloadAsync().catch(() => {}); }}
          style={{ backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
        >
          <Text style={{ color: C.accent, fontWeight: "700", fontSize: 12 }}>
            {isRTL ? "إعادة التشغيل" : "Restart"}
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
