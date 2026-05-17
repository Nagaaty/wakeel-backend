// ─── CachedImage — upgraded for Chunk 3a ─────────────────────────────────────
// Wraps expo-image for automatic disk + memory caching across the app.
// Avatar variant now also uses expo-image (was RNImage before — slower).
// Falls back to initials silhouette if URI is missing or load fails.
//
// Why expo-image over react-native-fast-image:
//   • Already in your dep tree (no new install needed)
//   • Disk + memory cache out of the box
//   • Off-thread decoding via libwebp / image-pipeline
//   • Blurhash placeholders supported natively
// PostCard separately tries `react-native-fast-image` if installed for the
// hottest path (avatars in feed) — see PostCard.tsx for the runtime fallback.
import React, { useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { resolveMediaUrl } from '../services/api';

// Blurhash placeholder — generic silhouette
const BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

interface Props {
  uri:           string | null | undefined;
  size:          number;
  initials?:     string;
  C:             any;
  borderRadius?: number;
}

// ─── CachedAvatar ─────────────────────────────────────────────────────────────
// Always renders the initials circle first (instant).
// If a valid URI exists, overlays the real photo on top when it loads.
// If the photo fails (404, timeout, etc), the initials remain visible.
// This means users ALWAYS see something immediately — no blank flash.
export function CachedAvatar({ uri, size, initials, C, borderRadius }: Props) {
  const [failed, setFailed] = useState(false);
  const br = borderRadius ?? size / 2;
  const resolvedUri = resolveMediaUrl(uri);
  const label = (initials || "?").slice(0, 2).toUpperCase();

  return (
    <View style={{ width: size, height: size }}>
      {/* Initials circle — always rendered instantly, sits underneath */}
      <View style={{
        position: "absolute",
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
          {label}
        </Text>
      </View>

      {/* Real photo — rendered on top, disappears when onError fires */}
      {resolvedUri && !failed && (
        <Image
          source={{ uri: resolvedUri }}
          style={{ width: size, height: size, borderRadius: br }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

export function CachedImage({ uri, width, height, borderRadius = 8, style }: any) {
  const resolvedUri = resolveMediaUrl(uri);
  return (
    <Image
      source={{ uri: resolvedUri }}
      style={[{ width, height, borderRadius }, style]}
      placeholder={BLURHASH}
      contentFit="cover"
      transition={150}
      cachePolicy="memory-disk"
    />
  );
}
