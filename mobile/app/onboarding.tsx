// ─── Wakeel — Onboarding Flow — Sprint 4 ────────────────────────────────────
// Shows once on first launch. Saved to AsyncStorage so it never shows again.
// Route: /onboarding  (redirected from _layout on first open)
import React, { useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, Dimensions,
  Animated, FlatList, StatusBar,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme, LIGHT_C } from "../src/theme";
import { useI18n } from "../src/i18n";
import { Gradient, GRADIENTS } from "../src/components/Gradient";

const { width: W, height: H } = Dimensions.get("window");
const ONBOARDED_KEY = "wakeel_onboarded";

interface Step {
  icon:   string;
  titleAr: string;
  titleEn: string;
  bodyAr:  string;
  bodyEn:  string;
  ctaAr:   string;
  ctaEn:   string;
  bg:      string;
}

const CLIENT_STEPS: Step[] = [
  {
    icon: "⚖️",
    titleAr: "مرحباً بك في وكيل",   titleEn: "Welcome to Wakeel",
    bodyAr:  "منصة مصر الأولى للخدمات القانونية. ابحث عن محاميك، تحقق من توثيقه، واحجز استشارتك في دقائق.",
    bodyEn:  "Egypt's most trusted legal marketplace. Find, verify, and book consultations with top lawyers in minutes.",
    ctaAr:   "هيا نبدأ ←",         ctaEn:   "Let's Start →",
    bg:      "#9A6F2A",
  },
  {
    icon: "🔍",
    titleAr: "ابحث عن محاميك",       titleEn: "Find Your Lawyer",
    bodyAr:  "تصفح 14 تخصصاً قانونياً. فلتر حسب المدينة والسعر والتقييم. كل محامٍ موثق بالبطاقة الوطنية.",
    bodyEn:  "Browse 14 law categories. Filter by city, price, and rating. Every lawyer is National ID verified.",
    ctaAr:   "فهمت ←",              ctaEn:   "Got it →",
    bg:      "#2563EB",
  },
  {
    icon: "📅",
    titleAr: "احجز استشارة",          titleEn: "Book a Consultation",
    bodyAr:  "اختر موعداً يناسبك من 450 جنيه. ادفع بأمان بالبطاقة أو فوري أو فودافون كاش أو إنستاباي.",
    bodyEn:  "Choose a slot from 450 EGP. Pay securely via card, Fawry, Vodafone Cash, or InstaPay.",
    ctaAr:   "رائع ←",              ctaEn:   "Sounds good →",
    bg:      "#059669",
  },
  {
    icon: "💬",
    titleAr: "راسل وتابع قضيتك",     titleEn: "Chat & Track Your Case",
    bodyAr:  "راسل محاميك مباشرةً، تابع الجدول الزمني لقضيتك، ارفع المستندات، وانضم لجلسات الفيديو.",
    bodyEn:  "Message your lawyer directly, track your case timeline, upload documents, and join video calls.",
    ctaAr:   "انطلق! ←",            ctaEn:   "Let's go! →",
    bg:      "#7C3AED",
  },
];

const LAWYER_STEPS: Step[] = [
  {
    icon: "⚖️",
    titleAr: "أهلاً بك أيها المستشار!", titleEn: "Welcome, Counselor!",
    bodyAr:  "وكيل يربطك بآلاف العملاء الموثقين. ملفك الشخصي، جدولك، وأسعارك.",
    bodyEn:  "Wakeel connects you with thousands of verified clients. Your profile, your schedule, your rates.",
    ctaAr:   "هيا نبدأ ←",            ctaEn:   "Let's Start →",
    bg:      "#9A6F2A",
  },
  {
    icon: "✅",
    titleAr: "ملفك قيد المراجعة",      titleEn: "Profile Under Review",
    bodyAr:  "سيتحقق فريقنا من بطاقتك الوطنية ونقابة المحامين وسجلك القضائي خلال 24 ساعة.",
    bodyEn:  "Our team will verify your National ID, Bar Association ID, and case history within 24 hours.",
    ctaAr:   "فهمت ←",                ctaEn:   "Got it →",
    bg:      "#2563EB",
  },
  {
    icon: "💼",
    titleAr: "أعدّ مكتبك",             titleEn: "Set Up Your Practice",
    bodyAr:  "حدد سعر الاستشارة، اضبط مواعيد العمل، اكتب نبذتك، وأدرج تخصصاتك.",
    bodyEn:  "Set your consultation price, schedule available slots, write your bio and list your specializations.",
    ctaAr:   "يبدو جيداً ←",           ctaEn:   "Sounds good →",
    bg:      "#059669",
  },
  {
    icon: "📊",
    titleAr: "تابع ونمّ مكتبك",        titleEn: "Track & Grow",
    bodyAr:  "راقب الحجوزات والأرباح والمشاهدات وتقييمات العملاء من لوحة التحليلات.",
    bodyEn:  "Monitor bookings, earnings, profile views, and client ratings from your analytics dashboard.",
    ctaAr:   "ابدأ الكسب ←",          ctaEn:   "Start earning →",
    bg:      "#7C3AED",
  },
];

async function markOnboarded() {
  await AsyncStorage.setItem(ONBOARDED_KEY, "true");
}

export async function hasOnboarded(): Promise<boolean> {
  const val = await AsyncStorage.getItem(ONBOARDED_KEY);
  return val === "true";
}

export default function OnboardingScreen() {
  const C      = LIGHT_C; // always light for onboarding
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();

  // Detect role from route params (default client)
  const role: 'client' | 'lawyer' = "client"; // Will be set based on register choice
  const STEPS  = (role as string) === "lawyer" ? LAWYER_STEPS : CLIENT_STEPS;

  const [current, setCurrent] = useState(0);
  const flatRef  = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goTo = (idx: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setCurrent(idx);
    flatRef.current?.scrollToIndex({ index: idx, animated: true });
  };

  const finish = async () => {
    await markOnboarded();
    router.replace("/(auth)/login");
  };

  const next = () => {
    if (current < STEPS.length - 1) goTo(current + 1);
    else finish();
  };

  const step = STEPS[current];

  return (
    <View style={{ flex: 1, backgroundColor: step.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={step.bg} />

      {/* Skip button */}
      <View style={{ position: "absolute", top: insets.top + 16, right: isRTL ? undefined : 20, left: isRTL ? 20 : undefined, zIndex: 10 }}>
        <TouchableOpacity onPress={finish}
          style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 }}>
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
            {isRTL ? "تخطي" : "Skip"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main content */}
      <Animated.View style={{ flex: 1, alignItems: "center", justifyContent: "center",
                              paddingHorizontal: 32, opacity: fadeAnim }}>
        {/* Icon circle */}
        <View style={{
          width: 130, height: 130, borderRadius: 65,
          backgroundColor: "rgba(255,255,255,0.2)",
          alignItems: "center", justifyContent: "center",
          marginBottom: 36,
          shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.25, shadowRadius: 24, elevation: 10,
        }}>
          <Text style={{ fontSize: 64 }}>{step.icon}</Text>
        </View>

        <Text style={{
          fontFamily: "CormorantGaramond-Bold",
          fontSize: 34, fontWeight: "700",
          color: "#fff", textAlign: "center",
          marginBottom: 16, lineHeight: 40,
        }}>
          {isRTL ? step.titleAr : step.titleEn}
        </Text>

        <Text style={{
          color: "rgba(255,255,255,0.85)",
          fontSize: 16, lineHeight: 26,
          textAlign: "center", marginBottom: 52,
        }}>
          {isRTL ? step.bodyAr : step.bodyEn}
        </Text>
      </Animated.View>

      {/* Bottom section */}
      <View style={{ paddingHorizontal: 28, paddingBottom: insets.bottom + 24 }}>
        {/* Progress dots */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goTo(i)}>
              <Animated.View style={{
                width: i === current ? 28 : 8, height: 8,
                borderRadius: 4,
                backgroundColor: i === current ? "#fff" : "rgba(255,255,255,0.35)",
              }} />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity onPress={next} activeOpacity={0.85}
          style={{
            backgroundColor: "#fff",
            borderRadius: 16, paddingVertical: 16,
            alignItems: "center",
            shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
            marginBottom: 12,
          }}>
          <Text style={{ color: step.bg, fontWeight: "800", fontSize: 16 }}>
            {current < STEPS.length - 1
              ? (isRTL ? step.ctaAr : step.ctaEn)
              : (isRTL ? "ابدأ الآن 🚀" : "Get Started 🚀")}
          </Text>
        </TouchableOpacity>

        {/* Back button */}
        {current > 0 && (
          <TouchableOpacity onPress={() => goTo(current - 1)}
            style={{ alignItems: "center", paddingVertical: 8 }}>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 14 }}>
              {isRTL ? "← رجوع" : "← Back"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
