// ─── Wakeel — HashtagSuggestions (Chunk 3b) ─────────────────────────────────
// Floating overlay that appears above the compose input when the user types
// a `#` to start a hashtag. Shows up to 6 trending tags, plus a "create new"
// row when the user's draft tag doesn't match any existing one.
//
// Behavior (LinkedIn / Facebook compose pattern):
//   • Parent (compose modal) detects a `#word` in the text and passes the
//     current draft tag as `query` (without the leading `#`)
//   • If query is empty → show top 6 trending tags
//   • If query has chars → filter trending tags client-side first; if no
//     match, show the literal "use #query as new tag" row
//   • Tap a row → parent's `onPick` is called with the tag (no `#` prefix);
//     parent replaces the in-progress `#word` with `#picked ` (trailing space)
//
// Performance:
//   • Trending tags fetched ONCE on mount, cached in component state.
//     The filter is client-side so it's instant and doesn't hit the API
//     on every keystroke.
//   • If the trending fetch fails, the component still works for the
//     "create new tag" case — degrades gracefully.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';
import { forumAPI } from '../../services/api';

interface Trending { tag: string; count: number; }

interface Props {
  /** Current in-progress hashtag word (without the leading `#`). Empty
   *  string while no `#` is being typed → component returns null. */
  query: string;
  /** Called when the user taps a suggestion. Passes the tag WITHOUT `#`. */
  onPick: (tag: string) => void;
  /** Optional: hide the panel without picking. */
  onDismiss?: () => void;
}

export function HashtagSuggestions({ query, onPick, onDismiss }: Props) {
  const C = useTheme();
  const { isRTL } = useI18n();
  const [trending, setTrending] = useState<Trending[]>([]);
  const [loaded, setLoaded] = useState(false);

  // ── Fetch trending tags once ─────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    forumAPI.getTrending?.()
      .then((res: any) => {
        if (!alive) return;
        const tags = Array.isArray(res?.tags) ? res.tags : Array.isArray(res) ? res : [];
        setTrending(tags.slice(0, 30));
      })
      .catch(() => { if (alive) setTrending([]); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  // ── Decide what to show ──────────────────────────────────────────────────
  // We always strip a leading '#' just in case the parent forgot.
  const cleanQuery = (query || '').replace(/^#/, '').toLowerCase();

  // If `query` is null/empty the parent should hide us — we render nothing.
  // (Component does nothing when not active, no overhead for the parent.)
  if (query == null) return null;

  const matches = useMemo(() => {
    if (!cleanQuery) return trending.slice(0, 6);
    const filtered = trending.filter(t =>
      (t.tag || '').toLowerCase().includes(cleanQuery)
    );
    return filtered.slice(0, 6);
  }, [trending, cleanQuery]);

  // Allow creating a new tag if user's draft doesn't exactly match any trend
  const showCreateNew =
    cleanQuery.length >= 2 &&
    !matches.some(m => (m.tag || '').toLowerCase() === cleanQuery);

  if (!loaded && !cleanQuery) {
    return (
      <View style={[styles.panel, { backgroundColor: C.surface, borderColor: C.border }]}>
        <View style={{ paddingVertical: 16, alignItems: 'center' }}>
          <ActivityIndicator color={C.gold} size="small" />
        </View>
      </View>
    );
  }

  if (matches.length === 0 && !showCreateNew) {
    return null;
  }

  return (
    <View style={[styles.panel, { backgroundColor: C.surface, borderColor: C.border }]}>
      {!cleanQuery && (
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
            {isRTL ? '🔥 الأكثر تداولاً' : '🔥 TRENDING'}
          </Text>
        </View>
      )}
      <FlatList
        data={matches}
        keyExtractor={t => t.tag}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: t }) => (
          <TouchableOpacity
            onPress={() => onPick(t.tag)}
            activeOpacity={0.7}
            style={[
              styles.row,
              { borderBottomColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <View style={[styles.iconBubble, { backgroundColor: C.gold + '22' }]}>
              <Text style={{ color: C.gold, fontWeight: '800', fontSize: 14 }}>#</Text>
            </View>
            <View style={{ flex: 1, marginHorizontal: 10 }}>
              <Text style={[styles.tag, { color: C.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                {t.tag}
              </Text>
              <Text style={[styles.count, { color: C.muted, textAlign: isRTL ? 'right' : 'left' }]}>
                {t.count} {isRTL ? (Number(t.count) === 1 ? 'منشور' : 'منشورات') : (Number(t.count) === 1 ? 'post' : 'posts')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          showCreateNew ? (
            <TouchableOpacity
              onPress={() => onPick(cleanQuery)}
              activeOpacity={0.7}
              style={[
                styles.row,
                { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomWidth: 0 },
              ]}
            >
              <View style={[styles.iconBubble, { backgroundColor: C.green + '22' }]}>
                <Ionicons name="add" size={16} color={C.green} />
              </View>
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text style={[styles.tag, { color: C.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                  #{cleanQuery}
                </Text>
                <Text style={[styles.count, { color: C.green, textAlign: isRTL ? 'right' : 'left' }]}>
                  {isRTL ? 'استخدم وسماً جديداً' : 'Use as new tag'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginHorizontal: 12,
    marginBottom: 8,
    maxHeight: 260,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBubble: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  tag: { fontSize: 14, fontWeight: '700', fontFamily: 'Cairo-Bold' },
  count: { fontSize: 11, marginTop: 1, fontFamily: 'Cairo-Regular' },
});
