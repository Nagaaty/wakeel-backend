// ─── Wakeel — NewPostsPill (Chunk 3c) ────────────────────────────────────────
// Floating pill that appears at the top of the forum feed when new posts
// arrive via socket while the user is scrolling/reading. Does NOT auto-
// inject the new posts — the user has to tap the pill, which then injects
// them and scrolls to top.
//
// Modeled on Twitter's "X new tweets" indicator. The Facebook/LinkedIn
// equivalent is similar but appears slightly differently.
//
// Animation: fades + slides down on appear, fades up on dismiss. Uses
// React Native's Animated API (no extra deps).
//
// Props:
//   • count: how many new posts are pending (0 → hidden)
//   • onPress: callback when user taps to inject + scroll to top
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, Text, StyleSheet, Easing } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';

interface Props {
  count: number;
  onPress: () => void;
}

export function NewPostsPill({ count, onPress }: Props) {
  const C = useTheme();
  const { isRTL } = useI18n();
  const translateY = useRef(new Animated.Value(-40)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (count > 0) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0, duration: 240, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1, duration: 200, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -40, duration: 180, useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0, duration: 160, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [count, translateY, opacity]);

  if (count === 0) return null;

  const label = isRTL
    ? `↑ ${count} ${count === 1 ? 'منشور جديد' : 'منشورات جديدة'}`
    : `↑ ${count} new ${count === 1 ? 'post' : 'posts'}`;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { transform: [{ translateY }], opacity },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[
          styles.pill,
          { backgroundColor: C.gold, shadowColor: C.gold },
        ]}
      >
        <Text style={styles.label}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 8,
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  label: {
    color: '#1C1611',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Cairo-Bold',
    letterSpacing: 0.3,
  },
});
