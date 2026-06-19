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
import { LinearGradient } from 'expo-linear-gradient';
import { resolveMediaUrl } from '../../services/api';

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
  onSettings?: () => void;
  onBack?: () => void;
  hideBackButton?: boolean;
}

export function ProfileHeader({
  user, headline, subline,
  primaryAction, secondaryActions, onSettings, onBack, hideBackButton
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
    <View style={{ backgroundColor: C.bg }}>
      {/* ── Premium Cover ── */}
      <ImageBackground
        source={user?.cover_url ? { uri: resolveMediaUrl(user.cover_url) } : undefined}
        style={[styles.cover, { backgroundColor: C.gold + '22' }]}
        imageStyle={{ borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.1)']}
          style={[StyleSheet.absoluteFill, { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }]}
        />
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {!hideBackButton ? (
            <TouchableOpacity
              onPress={onBack || (() => router.back())}
              style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.95)' }]}
            >
              <Ionicons
                name={isRTL ? 'chevron-forward' : 'chevron-back'}
                size={22}
                color="#1A1A1A"
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} /> // Invisible spacer to keep settings button on the right
          )}
          
          {onSettings && (
            <TouchableOpacity
              onPress={onSettings}
              style={[styles.iconBtn, { backgroundColor: 'rgba(255,255,255,0.95)' }]}
            >
              <Ionicons name="settings-outline" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          )}
        </View>
      </ImageBackground>

      <View style={[styles.cardContainer, { backgroundColor: C.surface, shadowColor: C.gold }]}>
        {/* ── Centered Avatar ── */}
        <View style={styles.avatarWrap}>
          <View style={[styles.avatarRing, { backgroundColor: C.surface }]}>
            <CachedAvatar
              uri={user?.avatar_url}
              size={110}
              initials={initials}
              C={C}
            />
            {user?.is_online && <View style={[styles.onlineDot, { borderColor: C.surface }]} />}
          </View>
        </View>

        {/* ── Name & Meta ── */}
        <View style={styles.metaWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Text style={[styles.name, { color: C.text }]}>
              {user?.name || ''}
            </Text>
            {isLawyer && user?.is_verified && (
              <View style={[styles.verifiedPill, { backgroundColor: C.gold + '15' }]}>
                <Ionicons name="checkmark-circle" size={14} color={C.gold} />
              </View>
            )}
          </View>

          <Text style={[styles.headline, { color: C.text }]} numberOfLines={2}>
            {computedHeadline}
          </Text>

          {computedSubline ? (
            <Text style={[styles.subline, { color: C.muted }]} numberOfLines={1}>
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
        flex: 1,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 28,
        borderWidth: isPrimary ? 0 : 1.5,
        borderColor: C.gold,
        backgroundColor: isPrimary ? C.gold : 'transparent',
        opacity: action.loading ? 0.7 : 1,
      }}
    >
      {action.loading ? (
        <ActivityIndicator color={isPrimary ? '#1A1A1A' : C.gold} size="small" />
      ) : (
        <>
          {action.icon && (
            <Ionicons
              name={action.icon as any}
              size={18}
              color={isPrimary ? '#1A1A1A' : C.gold}
            />
          )}
          <Text style={{
            color: isPrimary ? '#1A1A1A' : C.gold,
            fontWeight: '800',
            fontSize: 14,
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
  cover: { width: '100%', height: 180 },
  topBar: {
    position: 'absolute', left: 16, right: 16, top: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cardContainer: {
    marginHorizontal: 16,
    marginTop: -40,
    borderRadius: 24,
    paddingBottom: 20,
    shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    alignItems: 'center',
  },
  avatarWrap: {
    marginTop: -55,
    alignItems: 'center',
  },
  avatarRing: {
    padding: 5, borderRadius: 60,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#10B981',
    borderWidth: 3,
  },
  metaWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: 'center',
  },
  name: { fontSize: 24, fontWeight: '800', fontFamily: 'Cairo-Bold' },
  verifiedPill: {
    paddingHorizontal: 6, paddingVertical: 4,
    borderRadius: 12,
  },
  headline: { fontSize: 15, marginTop: 8, lineHeight: 22, fontFamily: 'Cairo-SemiBold', textAlign: 'center' },
  subline:  { fontSize: 13, marginTop: 6, fontFamily: 'Cairo-Regular', textAlign: 'center' },
  actionsRow: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 12,
  },
});
