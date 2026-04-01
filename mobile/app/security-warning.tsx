// ─── Security Warning Screen — Sprint 6 ─────────────────────────────────────
// Shown as a blocking overlay when jailbreak/root is detected.
// User can still dismiss (legal requirement) — we just warn, not block.
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Animated, Easing } from "react-native";
import { LIGHT_C } from "../src/theme";
import { runSecurityCheck, type SecurityRisk } from "../src/utils/jailbreakDetect";

interface Props {
  onDismiss: () => void;
}

export function SecurityWarningScreen({ onDismiss }: Props) {
  const C     = LIGHT_C;
  const fadeA = new Animated.Value(0);
  const serif = { fontFamily: "CormorantGaramond-Bold" };

  useEffect(() => {
    Animated.timing(fadeA, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={{
      position: "absolute", inset: 0 as any,
      backgroundColor: C.bg,
      alignItems: "center", justifyContent: "center",
      padding: 32, opacity: fadeA, zIndex: 10000,
    }}>
      <View style={{
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: C.warn + "15",
        borderWidth: 2, borderColor: C.warn + "40",
        alignItems: "center", justifyContent: "center",
        marginBottom: 24,
      }}>
        <Text style={{ fontSize: 52 }}>🛡️</Text>
      </View>

      <Text style={{ ...serif, color: C.text, fontSize: 26, fontWeight: "700",
                     textAlign: "center", marginBottom: 12 }}>
        Security Risk Detected
      </Text>
      <Text style={{ color: C.muted, fontSize: 15, textAlign: "center",
                     lineHeight: 22, marginBottom: 10 }}>
        This device appears to be jailbroken or rooted.
      </Text>
      <Text style={{ color: C.muted, fontSize: 13, textAlign: "center",
                     lineHeight: 20, marginBottom: 32 }}>
        Running Wakeel on a compromised device may expose your legal documents, payment details, and personal data to security risks.
      </Text>

      <View style={{ backgroundColor: C.warn + "10", borderWidth: 1,
                     borderColor: C.warn + "30", borderRadius: 12,
                     padding: 14, marginBottom: 28, width: "100%" }}>
        <Text style={{ color: C.warn, fontWeight: "700", fontSize: 13,
                       marginBottom: 6 }}>⚠️ We recommend:</Text>
        {[
          "Use an official, unmodified device",
          "Do not store sensitive legal documents here",
          "Contact support if you believe this is an error",
        ].map((tip, i) => (
          <Text key={i} style={{ color: C.muted, fontSize: 12,
                                  lineHeight: 18, marginBottom: 3 }}>
            • {tip}
          </Text>
        ))}
      </View>

      <TouchableOpacity
        onPress={onDismiss}
        style={{ backgroundColor: C.warn, borderRadius: 14,
                 paddingVertical: 14, paddingHorizontal: 36,
                 width: "100%", alignItems: "center", marginBottom: 12 }}
        activeOpacity={0.85}
      >
        <Text style={{ color: "#000", fontWeight: "700", fontSize: 15 }}>
          I Understand — Continue Anyway
        </Text>
      </TouchableOpacity>
      <Text style={{ color: C.dim, fontSize: 11, textAlign: "center" }}>
        Wakeel cannot guarantee security on this device.
      </Text>
    </Animated.View>
  );
}

// ── Hook to use in _layout.tsx ────────────────────────────────────────────────
export function useSecurityCheck() {
  const [risk,      setRisk]      = useState<SecurityRisk>("none");
  const [dismissed, setDismissed] = useState(false);
  const [checked,   setChecked]   = useState(false);

  useEffect(() => {
    runSecurityCheck().then(result => {
      setRisk(result.risk);
      setChecked(true);
    });
  }, []);

  const showWarning = checked && risk !== "none" && risk !== "emulator" && !dismissed;

  return {
    showWarning,
    risk,
    dismiss: () => setDismissed(true),
  };
}
