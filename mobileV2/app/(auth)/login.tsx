// ─── Wakeel Login Screen — Sprint 3: Biometric Login ─────────────────────────
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Animated, Easing,
} from "react-native";
import { Link, router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { login, fetchMe, selLoading, selError, clearError } from "../../src/store/slices/authSlice";
import { useTheme } from "../../src/theme";
import { Btn, Inp } from "../../src/components/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n, LangToggle } from "../../src/i18n";
import {
  getBiometricCapability, authenticateWithBiometrics,
  isBiometricEnabled, setBiometricEnabled,
  getBiometricLabel, getBiometricIcon,
} from "../../src/utils/biometric";
import { storage } from "../../src/utils/storage";
import type { BiometricType } from "../../src/utils/biometric";


// ── Animated biometric button ──────────────────────────────────────────────
function BiometricButton({ type, onPress, busy, C, isRTL }: {
  type: BiometricType; onPress: () => void; busy: boolean; C: any; isRTL: boolean;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1,    duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    return () => pulse.stopAnimation();
  }, []);

  return (
    <TouchableOpacity onPress={onPress} disabled={busy} activeOpacity={0.75} style={{ alignItems: "center", gap: 8, paddingVertical: 6 }}>
      <Animated.View style={{
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: C.gold + "15",
        borderWidth: 2, borderColor: C.gold + "60",
        alignItems: "center", justifyContent: "center",
        transform: [{ scale: busy ? 1 : pulse }],
        shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
      }}>
        <Text style={{ fontSize: 34 }}>{busy ? "⌛" : getBiometricIcon(type)}</Text>
      </Animated.View>
      <Text style={{ color: C.gold, fontSize: 13, fontWeight: "600" }}>
        {busy
          ? (isRTL ? "جاري التحقق..." : "Verifying...")
          : (isRTL ? `تسجيل بـ ${getBiometricLabel(type, true)}` : `Sign in with ${getBiometricLabel(type, false)}`)}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const C        = useTheme();
  const { t, isRTL } = useI18n();
  const dispatch = useDispatch<any>();
  const loading  = useSelector(selLoading);
  const error    = useSelector(selError);
  const insets   = useSafeAreaInsets();
  const serif    = { fontFamily: "Cairo-Bold" };

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState<"client" | "lawyer">("client");

  // Biometric state
  const [bioType,    setBioType]    = useState<BiometricType>("none");
  const [bioEnabled, setBioEn]      = useState(false);
  const [bioHW,      setBioHW]      = useState(false);
  const [bioBusy,    setBioBusy]    = useState(false);
  const [bioMsg,     setBioMsg]     = useState("");

  // Rate limiting state
  const [attempts,    setAttempts]    = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockCountdown, setLockCountdown] = useState(0);

  // Countdown timer when locked out
  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockCountdown(remaining);
      if (remaining === 0) {
        setLockedUntil(null);
        setAttempts(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  useEffect(() => {
    Promise.all([getBiometricCapability(), isBiometricEnabled()]).then(([cap, enabled]) => {
      const hw = cap.isAvailable && cap.isEnrolled;
      setBioHW(hw);
      setBioType(cap.primaryType);
      setBioEn(enabled);
      // Removed the auto-trigger here which was causing an infinite loop / stuck state on Android.
      // User must explicitly tap the biometric button.
    });
  }, []);

  const triggerBio = async () => {
    setBioMsg("");
    setBioBusy(true);
    const result = await authenticateWithBiometrics(isRTL ? "تسجيل الدخول إلى وكيل" : "Sign in to Wakeel");
    setBioBusy(false);
    if (result.success) {
      const token = await storage.get("wakeel_token");
      if (token) {
        const uRes = await dispatch(fetchMe()).unwrap().catch(() => {});
        const uRole = uRes?.user?.role || uRes?.role;
        
        if (uRole === 'lawyer') {
            router.replace("/lawyer/dashboard" as any);
        } else if (uRole === 'admin') {
            router.replace("/admin/index" as any);
        } else {
            router.replace("/(tabs)");
        }
        return;
      }
      const cached = await storage.get("wakeel_last_email");
      if (cached) setEmail(cached);
      setBioMsg(isRTL ? "أدخل كلمة المرور مرة واحدة لتجديد الجلسة" : "Enter password once to refresh session");
    } else if (result.error !== "user_cancel" && result.error !== "system_cancel") {
      setBioMsg(isRTL ? "فشل التحقق. استخدم كلمة المرور." : "Biometric failed. Use your password.");
    }
  };

  const enableBio = async () => {
    const result = await authenticateWithBiometrics(isRTL ? "تفعيل تسجيل البيومتري" : "Enable biometric login");
    if (result.success) { await setBiometricEnabled(true); setBioEn(true); }
  };

  const handleLogin = async () => {
    if (!email || !password || isLocked) return;
    dispatch(clearError());
    const res = await dispatch(login({ email: email.toLowerCase().trim(), password }));
    if (res.meta.requestStatus === "fulfilled") {
      const u = (res.payload as any)?.user;
      await storage.set("wakeel_last_email", email.toLowerCase().trim());
      setAttempts(0);
      
      if (u?.role === 'lawyer') {
        router.replace("/(lawyer-tabs)/" as any);
      } else if (u?.role === 'admin') {
        router.replace("/admin/index" as any);
      } else {
        router.replace("/(tabs)");
      }
    } else {
      // Handle rate limiting
      const payload = res.payload as any;
      if (typeof payload === "string" && payload.includes("Too many")) {
        // Extract retry time from error if present
        setLockedUntil(Date.now() + 15 * 60 * 1000);
        setLockCountdown(15 * 60);
      } else if (payload?.attemptsRemaining !== undefined) {
        const remaining = Number(payload.attemptsRemaining);
        setAttempts(5 - remaining);
        if (remaining <= 0) {
          setLockedUntil(Date.now() + 15 * 60 * 1000);
          setLockCountdown(15 * 60);
        }
      } else {
        setAttempts(a => Math.min(a + 1, 5));
      }
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Language Picker ── */}
        <View style={{ alignItems: "flex-end", marginBottom: 8 }}>
          <LangToggle C={C} />
        </View>

        {/* Logo */}
        <View style={{ alignItems: "center", marginBottom: 36 }}>
          <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: C.gold, alignItems: "center", justifyContent: "center", marginBottom: 16, shadowColor: C.gold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 8 }}>
            <Text style={{ fontSize: 38 }}>⚖️</Text>
          </View>
          <Text style={{ ...serif, fontSize: 34, fontWeight: "700", color: C.gold, marginBottom: 4 }}>Wakeel</Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>{t("app.tagline")}</Text>
        </View>

        {/* Biometric button — only when available + enabled */}
        {bioHW && bioEnabled && (
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <BiometricButton type={bioType} onPress={triggerBio} busy={bioBusy} C={C} isRTL={isRTL} />
            {bioMsg ? <Text style={{ color: C.warn, fontSize: 12, marginTop: 6, textAlign: "center" }}>{bioMsg}</Text> : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, width: "100%" }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
              <Text style={{ color: C.muted, fontSize: 12 }}>{isRTL ? "أو" : "or"}</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
            </View>
          </View>
        )}

        {/* Role selector */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
          {(["client", "lawyer"] as const).map(r => (
            <TouchableOpacity key={r} onPress={() => setRole(r)}
              style={{ flex: 1, padding: 11, borderWidth: 1, borderColor: role === r ? C.gold : C.border, borderRadius: 10, backgroundColor: role === r ? C.gold + "18" : "transparent", alignItems: "center" }}>
              <Text style={{ color: role === r ? C.gold : C.muted, fontSize: 13, fontWeight: "600" }}>
                {r === "client" ? t("auth.asClient") : t("auth.asLawyer")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form card */}
        <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 22, marginBottom: 14 }}>
          <Text style={{ ...serif, color: C.text, fontSize: 22, fontWeight: "700", marginBottom: 20, textAlign: isRTL ? "right" : "left" }}>
            {t("auth.welcomeBack")}
          </Text>

          {error ? (
            <View style={{ backgroundColor: C.red + "12", borderWidth: 1, borderColor: C.red + "30", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <Text style={{ color: C.red, fontSize: 13 }}>⚠️ {error}</Text>
            </View>
          ) : null}

          <Inp C={C} label={t("auth.email")} value={email} onChangeText={setEmail}
            placeholder="your@email.com" keyboardType="email-address" />
          <Inp C={C} label={t("auth.password")} value={password} onChangeText={setPassword}
            placeholder="••••••••" secureTextEntry />

          <TouchableOpacity onPress={() => router.push("/(auth)/reset-password")}
            style={{ alignSelf: isRTL ? "flex-start" : "flex-end", marginBottom: 20, marginTop: -4 }}>
            <Text style={{ color: C.gold, fontSize: 13 }}>{t("auth.forgotPassword")}</Text>
          </TouchableOpacity>

          {/* Lockout banner */}
          {isLocked && (
            <View style={{ backgroundColor: C.red + "12", borderWidth: 1, borderColor: C.red + "30", borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <Text style={{ color: C.red, fontWeight: "700", fontSize: 14, textAlign: "center", marginBottom: 4 }}>
                🔒 {isRTL ? "تم حظر تسجيل الدخول مؤقتاً" : "Account temporarily locked"}
              </Text>
              <Text style={{ color: C.muted, fontSize: 13, textAlign: "center" }}>
                {isRTL
                  ? `يمكنك المحاولة مجدداً بعد ${Math.floor(lockCountdown / 60)}:${String(lockCountdown % 60).padStart(2, "0")}`
                  : `Try again in ${Math.floor(lockCountdown / 60)}:${String(lockCountdown % 60).padStart(2, "0")}`}
              </Text>
            </View>
          )}

          {/* Attempts warning */}
          {!isLocked && attempts >= 2 && attempts < 5 && (
            <View style={{ backgroundColor: C.warn + "12", borderWidth: 1, borderColor: C.warn + "30", borderRadius: 10, padding: 10, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 16 }}>⚠️</Text>
              <Text style={{ color: C.warn, fontSize: 12, flex: 1 }}>
                {isRTL
                  ? `تحذير: ${5 - attempts} محاولة متبقية قبل القفل المؤقت`
                  : `Warning: ${5 - attempts} attempt${5 - attempts === 1 ? "" : "s"} remaining before lockout`}
              </Text>
            </View>
          )}

          <Btn C={C} onPress={handleLogin} disabled={loading || !email || !password || isLocked} full size="lg">
            {loading ? (isRTL ? "جاري الدخول..." : "Signing in...") : isLocked ? "🔒" : (isRTL ? "دخول ←" : "Sign In →")}
          </Btn>

          {/* Enable biometric — shown when available but not yet turned on */}
          {bioHW && !bioEnabled && (
            <TouchableOpacity onPress={enableBio}
              style={{ marginTop: 14, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: C.gold + "40", backgroundColor: C.gold + "08", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Text style={{ fontSize: 18 }}>{getBiometricIcon(bioType)}</Text>
              <Text style={{ color: C.gold, fontSize: 13, fontWeight: "600" }}>
                {isRTL ? `تفعيل ${getBiometricLabel(bioType, true)} للدخول` : `Enable ${getBiometricLabel(bioType, false)} login`}
              </Text>
            </TouchableOpacity>
          )}
        </View>


        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
          <Text style={{ color: C.muted, fontSize: 14 }}>{t("auth.noAccount")}</Text>
          <Link href="/(auth)/register">
            <Text style={{ color: C.gold, fontSize: 14, fontWeight: "700" }}>
              {isRTL ? "سجل مجاناً" : "Sign Up Free"}
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
