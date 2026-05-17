// ─── Wakeel — ProfileHeader (Chunk 4a) ───────────────────────────────────────
// LinkedIn-grade profile header used by both lawyer/[id] and user/[id].
//
// Layout (top → bottom):
//   1. Cover photo (16:9, gold gradient fallback when missing)
//   2. Back button + share button overlay
//   3. Avatar — overlapping the cover bottom edge, white ring
//   4. Name + verified checkmark (lawyers)
//   5. Headline (specialization for lawyers, bio for clients) — single line, italic
//   6. Location + member-since — small muted line
//   7. Action button row — primary CTA + secondary actions
//
// Props:
//   • user            — { id, name, avatar_url, cover_url, role, bio, ... }
//   • headline?       — override the auto-derived headline
//   • subline?        — override the auto-derived subline
//   • primaryAction?  — { label, icon, onPress, variant? }
//   • secondaryActions? — Array<{ label, icon, onPress }>
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, TouchableOpacity, ImageBackground, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { CachedAvatar } from '../CachedImage';

interface Action {
  label: string;
  icon?: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
}

interface Props {
  user: any;
  headline?: string;
  subline?: string;
  primaryAction?: Action;
  secondaryActions?: Action[];
  onShare?: () => void;
}

export function ProfileHeader({
  user, headline, subline,
  primaryAction, secondaryActions, onShare,
}: Props) {
  const C = useTheme();
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();

  const isLawyer = user?.role === 'lawyer';
  const initials = (user?.name || '').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  const computedHeadline = headline ??
    (isLawyer
      ? (user?.specialization || (isRTL ? 'محامٍ' : 'Lawyer'))
      : (user?.bio || (isRTL ? 'عضو' : 'Member')));

  const computedSubline = subline ?? (() => {
    const parts: string[] = [];
    if (user?.city) parts.push(user.city);
    if (user?.created_at) {
      const since = new Date(user.created_at).getFullYear();
      parts.push(isRTL ? `عضو منذ ${since}` : `Member since ${since}`);
    }
    return parts.join(' · ');
  })();

  return (
    <View style={{ backgroundColor: C.surface, direction: 'ltr' } as any}>
      {/* ── Cover ── */}
      <ImageBackground
        source={user?.cover_url ? { uri: user.cover_url } : undefined}
        style={[styles.cover, { backgroundColor: C.gold + '22' }]}
        imageStyle={{ opacity: 0.85 }}
      >
        {/* Gradient overlay for legibility of icons */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.10)' }]} />
        {/* Top bar — back / share */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.92)' }]}
          >
            <Ionicons
              name={isRTL ? 'chevron-forward' : 'chevron-back'}
              size={20}
              color={C.text}
            />
          </TouchableOpacity>
          {onShare && (
            <TouchableOpacity
              onPress={onShare}
              style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.92)' }]}
            >
              <Ionicons name="share-outline" size={18} color={C.text} />
            </TouchableOpacity>
          )}
        </View>
      </ImageBackground>

      {/* ── Avatar (overlapping cover) — direction:ltr forces physical-left on RTL Android ── */}
      <View style={[styles.avatarWrap, { left: 16, direction: 'ltr' } as any]}>
        <View style={[styles.avatarRing, { backgroundColor: C.surface }]}>
          <CachedAvatar
            uri={user?.avatar_url}
            size={104}
            initials={initials}
            C={C}
          />
        </View>
        {user?.is_online && <View style={[styles.onlineDot, { borderColor: C.surface }]} />}
      </View>

      {/* ── Name + meta — always LEFT, Facebook style ── */}
      <View style={[styles.metaWrap, { alignItems: 'flex-start', direction: 'ltr' } as any]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={[styles.name, { color: C.text, textAlign: 'left' }]}>
            {user?.name || ''}
          </Text>
          {isLawyer && user?.is_verified && (
            <View style={[styles.verifiedPill, { backgroundColor: C.gold + '18', borderColor: C.gold + '40' }]}>
              <Ionicons name="checkmark-circle" size={13} color={C.gold} />
              <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700', marginLeft: 3 }}>
                {isRTL ? 'محامٍ موثوق' : 'Verified'}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.headline, { color: C.text, textAlign: 'left' }]} numberOfLines={2}>
          {computedHeadline}
        </Text>

        {computedSubline ? (
          <Text style={[styles.subline, { color: C.muted, textAlign: 'left' }]} numberOfLines={1}>
            {computedSubline}
          </Text>
        ) : null}
      </View>

      {/* ── Actions ── */}
      {(primaryAction || (secondaryActions && secondaryActions.length > 0)) && (
        <View style={[styles.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {primaryAction && <ActionButton action={primaryAction} variant="primary" C={C} isRTL={isRTL} />}
          {(secondaryActions || []).map((a, i) => (
            <ActionButton key={i} action={a} variant="ghost" C={C} isRTL={isRTL} />
          ))}
        </View>
      )}
    </View>
  );
}

function ActionButton({ action, variant, C, isRTL }: any) {
  const v = action.variant || variant;
  const isPrimary = v === 'primary';
  return (
    <TouchableOpacity
      onPress={action.onPress}
      activeOpacity={0.85}
      disabled={action.loading}
      style={{
        flex: isPrimary ? 1.2 : 1,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 24,
        borderWidth: isPrimary ? 0 : 1.5,
        borderColor: C.gold,
        backgroundColor: isPrimary ? C.gold : 'transparent',
        opacity: action.loading ? 0.6 : 1,
      }}
    >
      {action.loading ? (
        <ActivityIndicator color={isPrimary ? '#1C1611' : C.gold} size="small" />
      ) : (
        <>
          {action.icon && (
            <Ionicons
              name={action.icon as any}
              size={16}
              color={isPrimary ? '#1C1611' : C.gold}
            />
          )}
          <Text style={{
            color: isPrimary ? '#1C1611' : C.gold,
            fontWeight: '700',
            fontSize: 13,
            fontFamily: 'Cairo-Bold',
          }} numberOfLines={1}>
            {action.label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 140 },
  topBar: {
    position: 'absolute', left: 12, right: 12, top: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  avatarWrap: {
    position: 'absolute',
    top: 90, // overlaps cover by ~50px
  },
  avatarRing: {
    padding: 4, borderRadius: 56,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#22c55e',
    borderWidth: 3,
  },
  metaWrap: {
    paddingHorizontal: 16,
    paddingTop: 60, // makes room for the overlapping avatar
    paddingBottom: 4,
  },
  name: { fontSize: 22, fontWeight: '800', fontFamily: 'Cairo-Bold' },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  headline: { fontSize: 14, marginTop: 6, lineHeight: 20, fontFamily: 'Cairo-Regular' },
  subline:  { fontSize: 12, marginTop: 4, fontFamily: 'Cairo-Regular' },
  actionsRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 8,
  },
});
