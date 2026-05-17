// ─── CachedImage — Sprint 7 ──────────────────────────────────────────────────
// Wraps expo-image for automatic disk + memory caching.
// Falls back to initials avatar if image fails to load.
import React, { useState } from "react";
import { View, Text, Image as RNImage } from "react-native";
import { Image } from "expo-image";

// Blurhash placeholder — generic silhouette
const BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

interface Props {
  uri:         string | null | undefined;
  size:        number;
  initials?:   string;
  C:           any;
  borderRadius?: number;
}

export function CachedAvatar({ uri, size, initials, C, borderRadius }: Props) {
  const [failed, setFailed] = useState(false);
  const br = borderRadius ?? size / 2;

  // Show initials if no URI or load failed
  if (!uri || failed) {
    return (
      <View style={{
        width: size, height: size, borderRadius: br,
        backgroundColor: C.gold + "22",
        borderWidth: 1.5, borderColor: C.gold + "44",
        alignItems: "center", justifyContent: "center",
      }}>
        <Text style={{
          color: C.gold, fontWeight: "700",
          fontSize: size * 0.33,
          fontFamily: "Cairo-Bold",
        }}>
          {(initials || "?").slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <RNImage
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: br }}
      onError={() => setFailed(true)}
    />
  );
}

// Simple cached image — not an avatar, just a photo
export function CachedImage({ uri, width, height, borderRadius = 8, style }: any) {
  return (
    <Image
      source={{ uri }}
      style={[{ width, height, borderRadius }, style]}
      placeholder={BLURHASH}
      contentFit="cover"
      transition={150}
      cachePolicy="disk"
    />
  );
}
