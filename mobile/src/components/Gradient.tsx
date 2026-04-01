import React from 'react';
import { View, ViewStyle } from 'react-native';

// Try to import expo-linear-gradient, fall back to plain View with start color
let LinearGradient: any = null;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  LinearGradient = null;
}

interface GradientProps {
  colors: string[];           // e.g. ['#9A6F2A', '#7A5520']
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle;
  children?: React.ReactNode;
}

// Matches CSS linear-gradient(135deg, color1, color2)
// 135deg = start:{x:0,y:0} end:{x:1,y:1}
export function Gradient({ colors, start, end, style, children }: GradientProps) {
  if (LinearGradient) {
    return (
      <LinearGradient
        colors={colors}
        start={start || { x: 0, y: 0 }}
        end={end   || { x: 1, y: 1 }}
        style={style}
      >
        {children}
      </LinearGradient>
    );
  }
  // Fallback: use first color as background
  return (
    <View style={[{ backgroundColor: colors[0] }, style]}>
      {children}
    </View>
  );
}

// Pre-built gradient configs matching reference exactly
export const GRADIENTS = {
  gold:    ['#9A6F2A', '#7A5520'],    // C.gold → C.goldD  (light theme)
  goldDark:['#C8A84B', '#8B6914'],    // C.gold → C.goldD  (dark theme)
  accent:  ['#2563EB', '#1D4ED8'],
  dark:    ['#1a1a2e', '#2d2d44'],    // AI chat header
  news0:   ['#1a0a00', '#3d1f00'],
  news1:   ['#0a0a1a', '#1a1a3d'],
  news2:   ['#0a1a0a', '#1a3d1a'],
  news3:   ['#1a0a1a', '#3d1a3d'],
};
