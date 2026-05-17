// ─── Wakeel — ForumSearchBar ──────────────────────────────────────────────────
// LinkedIn/Facebook-style people search:
//   • Tapping the bar expands it and shows a polished dropdown
//   • 200ms debounce — no API spam
//   • Lawyers ranked first, then verified, then everyone else
//   • Rich row: avatar + verified badge + role pill + specialization + city
//   • Tapping a result navigates to their profile
//   • Cancel / X clears and collapses
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, Keyboard, StyleSheet, Animated, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useI18n } from '../../i18n';
import { usersAPI } from '../../services/api';
import { CachedAvatar } from '../CachedImage';

interface SearchUser {
  id: string;
  name: string;
  avatar_url?: string;
  role: string;
  specialization?: string;
  city?: string;
  is_verified?: boolean;
}

export function ForumSearchBar() {
  const C = useTheme();
  const { isRTL } = useI18n();

  const [query, setQuery]     = useState('');
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const reqIdRef = useRef(0);

  // Animated dropdown opacity
  const dropAnim = useRef(new Animated.Value(0)).current;
  const showDropdown = focused && query.trim().length >= 2;

  useEffect(() => {
    Animated.timing(dropAnim, {
      toValue: showDropdown ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showDropdown]);

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res: any = await usersAPI.search(q);
        if (myReqId !== reqIdRef.current) return;
        setResults(Array.isArray(res?.users) ? res.users : []);
      } catch {
        if (myReqId !== reqIdRef.current) return;
        setResults([]);
      } finally {
        if (myReqId === reqIdRef.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  // ── Navigate to profile ───────────────────────────────────────────────────
  const openUser = useCallback((u: SearchUser) => {
    Keyboard.dismiss();
    setFocused(false);
    setQuery('');
    setResults([]);
    if (u.role === 'lawyer') {
      router.push({ pathname: '/lawyer/[id]', params: { id: u.id } } as any);
    } else {
      router.push({ pathname: '/user/[id]', params: { id: u.id } } as any);
    }
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  }, []);

  const cancel = useCallback(() => {
    Keyboard.dismiss();
    setFocused(false);
    setQuery('');
    setResults([]);
  }, []);

  // ── Result row ────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item: u, index }: { item: SearchUser; index: number }) => {
    const isLawyer = u.role === 'lawyer';
    const subtitle = isLawyer
      ? [u.specialization, u.city].filter(Boolean).join(' · ')
      : (isRTL ? 'عضو' : 'Member');

    return (
      <TouchableOpacity
        onPress={() => openUser(u)}
        activeOpacity={0.7}
        style={[
          styles.row,
          { flexDirection: 'row', borderBottomColor: C.border },
          index === 0 && { borderTopWidth: 0 },
        ]}
      >
        {/* Avatar with online-style ring for lawyers */}
        <View style={styles.avatarWrap}>
          <CachedAvatar
            uri={u.avatar_url}
            size={46}
            initials={(u.name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            C={C}
          />
          {isLawyer && (
            <View style={[styles.lawyerDot, { backgroundColor: C.gold }]}>
              <Text style={styles.lawyerDotIcon}>⚖</Text>
            </View>
          )}
        </View>

        {/* Name + subtitle */}
        <View style={[styles.textCol, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={[styles.name, { color: C.text }]} numberOfLines={1}>{u.name}</Text>
            {u.is_verified && (
              <Ionicons name="checkmark-circle" size={14} color={C.gold} />
            )}
          </View>

          {/* Role pill + subtitle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            {isLawyer && (
              <View style={[styles.lawyerPill, { backgroundColor: `${C.gold}20`, borderColor: `${C.gold}40` }]}>
                <Text style={[styles.lawyerPillText, { color: C.gold }]}>
                  {isRTL ? 'محامٍ' : 'Lawyer'}
                </Text>
              </View>
            )}
            {subtitle ? (
              <Text style={[styles.subtitle, { color: C.muted }]} numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>
        </View>

        {/* Chevron */}
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={16}
          color={C.muted}
          style={{ opacity: 0.5 }}
        />
      </TouchableOpacity>
    );
  }, [isRTL, C, openUser]);

  return (
    <View style={[styles.container, { zIndex: 200 }]}>
      {/* ── Search bar row ── */}
      <View style={[styles.barRow, { flexDirection: 'row' }]}>
        <View style={[
          styles.bar,
          {
            backgroundColor: C.card2 || C.bg,
            borderColor: focused ? C.gold : C.border,
            flexDirection: 'row',
            flex: 1,
          },
        ]}>
          <Ionicons name="search" size={17} color={focused ? C.gold : C.muted} style={{ marginHorizontal: 2 }} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={isRTL ? 'ابحث عن محامٍ أو مستخدم…' : 'Search for a lawyer or user…'}
            placeholderTextColor={C.muted}
            style={[styles.input, { color: C.text, textAlign: isRTL ? 'right' : 'left' }]}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clear} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Cancel button — appears when focused */}
        {focused && (
          <TouchableOpacity onPress={cancel} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: C.gold }]}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Dropdown ── */}
      {showDropdown && (
        <Animated.View
          style={[
            styles.dropdown,
            { backgroundColor: C.surface, borderColor: C.border, opacity: dropAnim },
          ]}
        >
          {/* Header */}
          <View style={[styles.dropHeader, { borderBottomColor: C.border, flexDirection: 'row' }]}>
            <Ionicons name="people" size={14} color={C.muted} />
            <Text style={[styles.dropHeaderText, { color: C.muted }]}>
              {isRTL ? 'نتائج البحث' : 'Search results'}
            </Text>
          </View>

          {loading ? (
            <View style={styles.centerPad}>
              <ActivityIndicator color={C.gold} size="small" />
              <Text style={[styles.loadingText, { color: C.muted }]}>
                {isRTL ? 'جارٍ البحث…' : 'Searching…'}
              </Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.centerPad}>
              <Ionicons name="search-outline" size={28} color={C.muted} style={{ opacity: 0.4 }} />
              <Text style={[styles.emptyText, { color: C.muted }]}>
                {isRTL ? 'لا توجد نتائج' : 'No results found'}
              </Text>
              <Text style={[styles.emptySubText, { color: C.muted }]}>
                {isRTL ? `لا يوجد مستخدم باسم "${query}"` : `No user named "${query}"`}
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={u => u.id}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={results.length > 5}
              renderItem={renderItem}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  barRow: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  bar: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    borderRadius: 26,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
    padding: 0,
  },
  cancelBtn: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 12,
    right: 12,
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: 380,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    marginTop: -2,
  },
  dropHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 6,
  },
  dropHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Cairo-SemiBold',
  },
  row: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  lawyerDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  lawyerDotIcon: {
    fontSize: 9,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
    flexShrink: 1,
  },
  lawyerPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  lawyerPillText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Cairo-Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    flexShrink: 1,
  },
  centerPad: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Cairo-SemiBold',
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    opacity: 0.7,
  },
});

