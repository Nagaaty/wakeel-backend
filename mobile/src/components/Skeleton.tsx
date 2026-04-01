// ─── Skeleton Loading Components — Sprint 5 ──────────────────────────────────
// Shimmer skeleton placeholders for lawyers list, lawyer card, messages, bookings
import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";

const { width: W } = Dimensions.get("window");

// ── Base shimmer animation ────────────────────────────────────────────────────
function ShimmerBox({ width, height, borderRadius = 8, style, C }: any) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <Animated.View style={[{
      width, height, borderRadius,
      backgroundColor: C.border,
      opacity,
    }, style]} />
  );
}

// ── Lawyer card skeleton ──────────────────────────────────────────────────────
export function LawyerCardSkeleton({ C }: { C: any }) {
  return (
    <View style={{
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      borderRadius: 16, padding: 20, marginBottom: 14,
    }}>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
        <ShimmerBox C={C} width={54} height={54} borderRadius={27} />
        <View style={{ flex: 1, gap: 8, justifyContent: "center" }}>
          <ShimmerBox C={C} width="70%" height={14} />
          <ShimmerBox C={C} width="50%" height={11} />
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <ShimmerBox C={C} width={50} height={18} />
          <ShimmerBox C={C} width={40} height={10} />
        </View>
      </View>
      <ShimmerBox C={C} width="100%" height={8} borderRadius={4} style={{ marginBottom: 8 }} />
      <ShimmerBox C={C} width="85%" height={11} style={{ marginBottom: 6 }} />
      <ShimmerBox C={C} width="65%" height={11} style={{ marginBottom: 14 }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <ShimmerBox C={C} width="32%" height={34} borderRadius={9} />
        <ShimmerBox C={C} width="32%" height={34} borderRadius={9} />
        <ShimmerBox C={C} width="32%" height={34} borderRadius={9} />
      </View>
    </View>
  );
}

// ── Message list skeleton ─────────────────────────────────────────────────────
export function MessageRowSkeleton({ C }: { C: any }) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: C.border,
    }}>
      <ShimmerBox C={C} width={50} height={50} borderRadius={25} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <ShimmerBox C={C} width="45%" height={13} />
          <ShimmerBox C={C} width="20%" height={11} />
        </View>
        <ShimmerBox C={C} width="70%" height={11} />
      </View>
    </View>
  );
}

// ── Booking card skeleton ─────────────────────────────────────────────────────
export function BookingCardSkeleton({ C }: { C: any }) {
  return (
    <View style={{
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      borderRadius: 16, padding: 16, marginBottom: 12,
    }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ gap: 6, flex: 1 }}>
          <ShimmerBox C={C} width="60%" height={14} />
          <ShimmerBox C={C} width="80%" height={11} />
        </View>
        <ShimmerBox C={C} width={70} height={24} borderRadius={12} />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
        <ShimmerBox C={C} width={60} height={18} />
        <ShimmerBox C={C} width={80} height={18} borderRadius={12} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <ShimmerBox C={C} width={90} height={32} borderRadius={9} />
        <ShimmerBox C={C} width={90} height={32} borderRadius={9} />
      </View>
    </View>
  );
}

// ── Notification skeleton ─────────────────────────────────────────────────────
export function NotificationSkeleton({ C }: { C: any }) {
  return (
    <View style={{
      flexDirection: "row", gap: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: C.border,
    }}>
      <ShimmerBox C={C} width={44} height={44} borderRadius={12} />
      <View style={{ flex: 1, gap: 7 }}>
        <ShimmerBox C={C} width="55%" height={13} />
        <ShimmerBox C={C} width="85%" height={11} />
        <ShimmerBox C={C} width="30%" height={10} />
      </View>
    </View>
  );
}

// ── Profile header skeleton ───────────────────────────────────────────────────
export function ProfileHeaderSkeleton({ C }: { C: any }) {
  return (
    <View style={{ alignItems: "center", padding: 28, gap: 10 }}>
      <ShimmerBox C={C} width={86} height={86} borderRadius={43} />
      <ShimmerBox C={C} width={160} height={18} />
      <ShimmerBox C={C} width={100} height={13} />
    </View>
  );
}

// ── Generic list skeleton — n rows ────────────────────────────────────────────
export function ListSkeleton({ C, count = 5, type = "lawyer" }: {
  C: any; count?: number; type?: "lawyer" | "message" | "booking" | "notification";
}) {
  const components: Record<string, React.FC<{ C: any }>> = {
    lawyer:       LawyerCardSkeleton,
    message:      MessageRowSkeleton,
    booking:      BookingCardSkeleton,
    notification: NotificationSkeleton,
  };
  const Comp = components[type] || LawyerCardSkeleton;
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => <Comp key={i} C={C} />)}
    </View>
  );
}
