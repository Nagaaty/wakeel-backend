// ─── Wakeel — AskLawyerButton (Chunk 3c) ─────────────────────────────────────
// CTA to drop on a lawyer's profile. Tapping it opens the Forum tab with a
// query param that the forum reads on focus to auto-open compose with
// "@LawyerName " pre-filled. Lets clients ask a public legal question
// directed at a specific lawyer.
//
// Wiring:
//   - Drop <AskLawyerButton lawyerName={lawyer.name} /> anywhere on a
//     lawyer profile (typically next to the Book button).
//   - The forum tab handles the param via useLocalSearchParams (see
//     forum.tsx — the askLawyer effect).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';

interface Props {
  lawyerName: string;
  /** Optional override for the button label */
  label?: string;
  /** Style override for the wrapper */
  style?: any;
}

export function AskLawyerButton({ lawyerName, label, style }: Props) {
  const C = useTheme();
  const { isRTL } = useI18n();

  const onPress = () => {
    router.push({
      pathname: '/(tabs)/forum',
      params: { askLawyer: lawyerName },
    } as any);
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.btn,
        {
          backgroundColor: C.gold + '14',
          borderColor: C.gold + '55',
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 16 }}>📢</Text>
      <Text style={[styles.label, { color: C.gold }]}>
        {label || (isRTL ? `اطرح سؤالاً على ${lawyerName}` : `Ask ${lawyerName} publicly`)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
});
