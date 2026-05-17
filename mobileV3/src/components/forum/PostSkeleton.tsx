// ─── Wakeel — Forum Post Skeleton ────────────────────────────────────────────
// Shimmer-pulse placeholder shown while posts are loading. Used instead of
// a centered ActivityIndicator because a skeleton previewing the upcoming
// layout feels much faster (the "perceived performance" trick used by
// LinkedIn / Facebook / Twitter).
//
// Renders 3 fake card outlines by default; pass `count` to change.
// Auto-themes via useTheme. Uses an Animated value to fade between two
// shades of the muted color, no extra deps.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface Props { count?: number; }

export function PostSkeleton({ count = 3 }: Props) {
  const C = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const Block = ({ w, h, mb = 8, br = 6 }: { w: number | string; h: number; mb?: number; br?: number }) => (
    <Animated.View style={{
      width: w as any,
      height: h,
      marginBottom: mb,
      backgroundColor: C.border,
      borderRadius: br,
      opacity,
    }} />
  );

  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.card,
            { backgroundColor: C.surface, borderColor: C.border, marginBottom: i === count - 1 ? 0 : 10 },
          ]}
        >
          {/* Author row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Animated.View style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: C.border, opacity,
            }} />
            <View style={{ flex: 1 }}>
              <Block w={120} h={11} mb={6} />
              <Block w={70}  h={9}  mb={0} />
            </View>
          </View>
          {/* Body lines */}
          <Block w="92%" h={12} />
          <Block w="100%" h={12} />
          <Block w="65%" h={12} mb={14} />
          {/* Image placeholder (some posts have images) */}
          {i % 2 === 0 && <Block w="100%" h={140} mb={14} br={10} />}
          {/* Action bar */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between',
            paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
          }}>
            <Block w={50} h={20} mb={0} />
            <Block w={50} h={20} mb={0} />
            <Block w={50} h={20} mb={0} />
            <Block w={50} h={20} mb={0} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
