import React from 'react';
import {
  TouchableOpacity, Text, View, ActivityIndicator,
  TextInput, Platform, ViewStyle,
} from 'react-native';
import { Theme, useTheme, LIGHT_C } from '../../theme';
import { Gradient, GRADIENTS } from '../Gradient';

// Safe theme fallback — prevents crashes when C prop is not passed
function safeC(C: any): Theme { return C || LIGHT_C; }

// ─── Btn — matches el-adl-app-43 exactly ─────────────────────────────────────
// Reference: gold text color is #000, not #fff
export function Btn({ C, children, onPress, variant = 'gold', size = 'md', disabled, full, style }: any) {
  const sz: any = {
    sm: { paddingHorizontal: 14, paddingVertical: 8,  fontSize: 13, borderRadius: 9  },
    md: { paddingHorizontal: 20, paddingVertical: 11, fontSize: 14, borderRadius: 10 },
    lg: { paddingHorizontal: 32, paddingVertical: 14, fontSize: 15, borderRadius: 12 },
  };
  const s = sz[size] || sz.md;
  type Variant = { bg: string; color: string; border?: string };
  const va: Record<string, Variant> = {
    gold:    { bg: disabled ? C.dim : C.gold,    color: disabled ? C.muted : '#000', border: 'transparent' },
    ghost:   { bg: 'transparent',                color: C.muted,                    border: C.border       },
    danger:  { bg: `${C.red}18`,                 color: C.red,                      border: `${C.red}33`   },
    accent:  { bg: C.accent,                     color: '#fff',                     border: 'transparent'  },
    success: { bg: `${C.green}18`,               color: C.green,                    border: `${C.green}33` },
    dark:    { bg: C.card2,                       color: C.text,                     border: C.border       },
  };
  const v = va[variant] || va.gold;
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.75}
      style={[{
        backgroundColor: v.bg,
        borderWidth: 1,
        borderColor: v.border || 'transparent',
        borderRadius: s.borderRadius,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        paddingHorizontal: s.paddingHorizontal,
        paddingVertical: s.paddingVertical,
        width: full ? '100%' : undefined,
      }, style]}
    >
      <Text style={{ color: v.color, fontWeight: '700', fontSize: s.fontSize }}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Tag — matches reference ─────────────────────────────────────────────────
export function Tag({ C, children, color, style }: any) {
  const c = color || C.gold;
  return (
    <View style={[{
      backgroundColor: `${c}18`, borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 2,
      borderWidth: 1, borderColor: `${c}30`,
      alignSelf: 'flex-start' as const,
    }, style]}>
      <Text style={{ color: c, fontSize: 11, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

// ─── Stars — matches reference ────────────────────────────────────────────────
export function Stars({ rating, C: Cprop, size = 13 }: any) {
  const C = safeC(Cprop);
  const r = parseFloat(rating) || 0;
  const full = Math.floor(r);
  const empty = 5 - full;
  return (
    <Text>
      <Text style={{ fontSize: size, color: C.gold }}>{'★'.repeat(full)}</Text>
      <Text style={{ fontSize: size, color: C.gold, opacity: 0.25 }}>{'★'.repeat(empty)}</Text>
      <Text style={{ fontSize: size - 1, color: C.muted }}> {r}</Text>
    </Text>
  );
}

// ─── WinBar — matches reference EXACTLY ──────────────────────────────────────
export function WinBar({ wins, losses, C }: any) {
  const w = parseInt(wins) || 0;
  const l = parseInt(losses) || 0;
  if (w + l === 0) return null;
  const pct = Math.round(w / (w + l) * 100);
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
        <Text style={{ color: C.green, fontSize: 12 }}>✓{w}W</Text>
        <Text style={{ color: C.red,   fontSize: 12 }}>✗{l}L</Text>
        <Text style={{ color: C.gold,  fontSize: 12, fontWeight: '700' }}>{pct}%</Text>
      </View>
      <View style={{ backgroundColor: C.border, borderRadius: 4, height: 5 }}>
        <View style={{
          backgroundColor: C.green,
          width: `${pct}%` as any,
          height: '100%', borderRadius: 4,
        }} />
      </View>
    </View>
  );
}

// ─── Avatar — serif initials, gold gradient, matches reference ────────────────
export function Avatar({ C: Cprop, initials, size = 48, color }: any) {
  const C = safeC(Cprop);
  if (!color) {
    return (
      <Gradient colors={[C.gold, C.goldD]} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Text style={{ fontFamily: 'CormorantGaramond-Bold', color: '#000', fontWeight: '700', fontSize: Math.round(size * 0.34) }}>
          {initials}
        </Text>
      </Gradient>
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Text style={{
        color: '#000', fontWeight: '700',
        fontSize: Math.round(size * 0.34),
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
      }}>{initials}</Text>
    </View>
  );
}

// ─── Inp ──────────────────────────────────────────────────────────────────────
export function Inp({ C, label, icon, value, onChangeText, placeholder, secureTextEntry, multiline, numberOfLines, keyboardType, autoCapitalize, style, editable = true }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label && (
        <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
          {icon ? `${icon} ${label}` : label}
        </Text>
      )}
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={C.muted} secureTextEntry={secureTextEntry}
        multiline={multiline} numberOfLines={numberOfLines}
        keyboardType={keyboardType} autoCapitalize={autoCapitalize || 'none'}
        editable={editable}
        style={[{
          backgroundColor: C.card2, borderWidth: 1, borderColor: C.border,
          borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
          color: C.text, fontSize: 14, textAlign: 'right' as const,
        }, style]}
      />
    </View>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
export function Section({ C, children, style }: any) {
  return (
    <View style={[{
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      borderRadius: 16, padding: 22,
    }, style]}>{children}</View>
  );
}

export function Card({ C, children, style }: any) {
  return (
    <View style={[{
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
      borderRadius: 16, padding: 16,
    }, style]}>{children}</View>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ C, color, children, style }: any) {
  const c = color || C.gold;
  return (
    <View style={[{
      backgroundColor: `${c}18`, borderRadius: 20,
      paddingHorizontal: 8, paddingVertical: 3,
      borderWidth: 1, borderColor: `${c}30`,
    }, style]}>
      <Text style={{ color: c, fontSize: 11, fontWeight: '700' }}>{children}</Text>
    </View>
  );
}

export function Spinner({ C, size = 'small' }: any) {
  return <ActivityIndicator color={C.gold} size={size} />;
}

export function Empty({ C, icon, title, subtitle, action }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <Text style={{ fontSize: 52, marginBottom: 16 }}>{icon || '📭'}</Text>
      <Text style={{ color: C.text, fontWeight: '700', fontSize: 17, marginBottom: 8, textAlign: 'center' }}>{title}</Text>
      {subtitle && <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 21 }}>{subtitle}</Text>}
      {action && (
        <TouchableOpacity onPress={action.onPress}
          style={{ marginTop: 20, backgroundColor: C.gold, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ErrMsg({ C, msg }: any) {
  if (!msg) return null;
  return (
    <View style={{ backgroundColor: `${C.red}12`, borderWidth: 1, borderColor: `${C.red}30`, borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <Text style={{ color: C.red, fontSize: 13 }}>⚠️ {msg}</Text>
    </View>
  );
}
