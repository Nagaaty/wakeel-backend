// ─── Session Warning Banner — Sprint 5 ──────────────────────────────────────
// Shows at the top of the screen when session is about to expire.
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { useTheme } from "../src/theme";
import { useI18n } from "../src/i18n";
import { onSessionWarning, resetSessionTimer, stopSessionTimeout } from "../src/utils/sessionTimeout";
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { forceLogout } from "../src/store/slices/authSlice";
import { router } from "expo-router";

export function SessionWarningBanner() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const dispatch = useDispatch();
  const [visible,   setVisible]   = useState(false);
  const [countdown, setCountdown] = useState(120);
  const slideY = new Animated.Value(-80);

  useEffect(() => {
    onSessionWarning((seconds) => {
      setCountdown(seconds);
      setVisible(true);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 14 }).start();
      // Countdown
      const interval = setInterval(() => {
        setCountdown(s => {
          if (s <= 1) {
            clearInterval(interval);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    });
  }, []);

  const handleStay = () => {
    resetSessionTimer();
    Animated.timing(slideY, { toValue: -80, duration: 200, useNativeDriver: true }).start(() => setVisible(false));
  };

  const handleLogout = () => {
    stopSessionTimeout();
    dispatch(forceLogout() as any);
    router.replace("/(auth)/login" as any);
  };

  if (!visible) return null;

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <Animated.View style={{
      position: "absolute", top: 0, left: 0, right: 0, zIndex: 9998,
      backgroundColor: C.warn,
      transform: [{ translateY: slideY }],
      flexDirection: isRTL ? "row-reverse" : "row",
      alignItems: "center", gap: 10,
      paddingHorizontal: 16, paddingVertical: 12,
    }}>
      <Text style={{ fontSize: 18 }}>⏰</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#000", fontWeight: "700", fontSize: 13 }}>
          {isRTL ? `ستنتهي جلستك خلال ${timeStr}` : `Session expires in ${timeStr}`}
        </Text>
        <Text style={{ color: "#00000099", fontSize: 11 }}>
          {isRTL ? "انقر للبقاء متصلاً" : "Tap to stay logged in"}
        </Text>
      </View>
      <TouchableOpacity onPress={handleStay}
        style={{ backgroundColor: "#000", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
        <Text style={{ color: C.warn, fontWeight: "700", fontSize: 12 }}>
          {isRTL ? "تمديد" : "Stay"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleLogout} style={{ padding: 4 }}>
        <Text style={{ color: "#00000070", fontSize: 12 }}>
          {isRTL ? "خروج" : "Logout"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
