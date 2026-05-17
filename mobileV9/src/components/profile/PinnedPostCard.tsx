// ─── Wakeel — PinnedPostCard (Chunk 4a) ──────────────────────────────────────
// LinkedIn "Featured" style card showing a lawyer's pinned forum post.
// Pinned posts surface above the activity tab on the lawyer's public profile.
//
// Visual: gold-tinted card with a 📌 icon header, post snippet, and engagement
// counts. Tap → opens the full post.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import HashtagText from '../HashtagText';

interface Props {
  post: any;
  /** Show pin/unpin button (only for own profile) */
  canEdit?: boolean;
  onUnpin?: (postId: number) => void;
}

export function PinnedPostCard({ post, canEdit, onUnpin }: Props) {
  const C = useTheme();
  const { isRTL } = useI18n();

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } } as any)}
      style={[
        styles.card,
        { backgroundColor: C.gold + '08', borderColor: C.gold + '40' },
      ]}
    >
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="bookmark" size={14} color={C.gold} />
        <Text style={[styles.headerLabel, { color: C.gold }]}>
          {isRTL ? '📌 منشور مثبّت' : '📌 Featured'}
        </Text>
        <View style={{ flex: 1 }} />
        {canEdit && onUnpin && (
          <TouchableOpacity onPress={(e) => { e.stopPropagation(); onUnpin(post.id); }} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
            <Ionicons name="close" size={16} color={C.muted} />
          </TouchableOpacity>
        )}
      </View>

      <HashtagText
        text={post.question || ''}
        style={[
          styles.body,
          { color: C.text, textAlign: isRTL ? 'right' : 'left' },
        ]}
        numberOfLines={4}
        goldColor={C.gold}
      />

      <View style={[styles.statsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {(post.likes_count || 0) > 0 && (
          <Text style={[styles.stat, { color: C.muted }]}>↑ {post.likes_count}</Text>
        )}
        {(post.answer_count || 0) > 0 && (
          <Text style={[styles.stat, { color: C.muted }]}>💬 {post.answer_count}</Text>
        )}
        {post.category && post.category !== 'الكل' && (
          <Text style={[styles.stat, { color: C.muted }]}>· {post.category}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12, marginBottom: 8,
    padding: 14, borderRadius: 14,
    borderWidth: 1,
  },
  header: { alignItems: 'center', gap: 6, marginBottom: 8 },
  headerLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, fontFamily: 'Cairo-Bold' },
  body: { fontSize: 14, lineHeight: 21, fontFamily: 'Cairo-Regular' },
  statsRow: { gap: 14, marginTop: 10 },
  stat: { fontSize: 11 },
});
