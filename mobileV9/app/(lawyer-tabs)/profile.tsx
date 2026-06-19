// ─── Wakeel — Lawyer Own Profile (Chunk 4b — LinkedIn redesign) ──────────────
// The lawyer's view of their OWN profile inside (lawyer-tabs).
//
// Key differences vs. the public view in /lawyer/[id].tsx:
//   • Edit pencils on every section (tap → /edit-profile or specific editor)
//   • "Manage pinned posts" panel: list of own posts with pin toggle
//   • Settings cog top-right
//   • Logout button at bottom
//   • Activity tab uses ActivityFeed component scoped to own user_id
//
// Layout (top → bottom):
//   1. ProfileHeader (cover + avatar + name + edit cover) with cog button
//   2. Stats strip: ⭐ rating · 💼 cases · ⚖️ years
//   3. Tab strip: About · Posts · Activity · Reviews
//   4. Each tab body has section cards with pencil icons
//   5. Logout row at bottom
//
// Pin/unpin pipeline:
//   • Posts tab shows pinned posts at top (PinnedPostCard, with X to unpin)
//   • Below: "Manage pinned posts" expandable section listing own posts
//     with a pin-toggle on each. Backend caps at 2 — UI shows error if over.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Share, RefreshControl, Alert, StyleSheet,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useI18n } from '../../src/i18n';
import { useAuth } from '../../src/hooks/useAuth';
import { lawyersAPI, forumAPI } from '../../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ProfileHeader }  from '../../src/components/profile/ProfileHeader';
import { ActivityFeed }   from '../../src/components/profile/ActivityFeed';
import { PinnedPostCard } from '../../src/components/profile/PinnedPostCard';
import HashtagText        from '../../src/components/HashtagText';

const SERVICE_LABELS = {
  video:    { ar: 'فيديو',  en: 'Video',     icon: '📹' },
  text:     { ar: 'نصي',    en: 'Text',      icon: '💬' },
  inperson: { ar: 'حضوري',  en: 'In-Person', icon: '🏛️' },
  document: { ar: 'مراجعة', en: 'Review',    icon: '📄' },
};

type Tab = 'about' | 'reviews';

export default function LawyerOwnProfile() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { isRTL } = useI18n();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('about');

  const [pinned, setPinned] = useState<any[]>([]);
  const [pinnedLoaded, setPinnedLoaded] = useState(false);

  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myPostsLoaded, setMyPostsLoaded] = useState(false);

  const [pinning, setPinning] = useState<number | null>(null); // post id currently mutating
  const [showManagePins, setShowManagePins] = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    try {
      const p: any = await lawyersAPI.getMyProfile();
      setProfile(p?.profile || p);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadPinned = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res: any = await forumAPI.getPinnedPosts(user.id);
      setPinned(res?.pinned || []);
    } catch {
      setPinned([]);
    } finally {
      setPinnedLoaded(true);
    }
  }, [user?.id]);

  const loadMyPosts = useCallback(async () => {
    if (!user?.id || myPostsLoaded) return;
    try {
      const res: any = await forumAPI.getUserPosts(user.id);
      setMyPosts(res?.questions || []);
    } catch {
      setMyPosts([]);
    } finally {
      setMyPostsLoaded(true);
    }
  }, [user?.id, myPostsLoaded]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );
  useEffect(() => {
    // Only load these if somehow still needed, but tabs are gone
  }, [tab, loadPinned, loadMyPosts]);

  // ── Pin/unpin handler ────────────────────────────────────────────────────
  const togglePin = async (post: any) => {
    if (pinning) return; // ignore double-tap
    setPinning(post.id);
    try {
      const res: any = await forumAPI.pinPost(post.id);
      const isNowPinned = !!res?.pinned;

      // Optimistically update local state
      if (isNowPinned) {
        setPinned(prev => {
          if (prev.some(p => p.id === post.id)) return prev;
          return [post, ...prev].slice(0, 2);
        });
      } else {
        setPinned(prev => prev.filter(p => p.id !== post.id));
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message_ar || e?.response?.data?.message
        || (isRTL ? 'تعذّر تثبيت المنشور' : 'Could not pin post');
      Alert.alert(isRTL ? 'تنبيه' : 'Notice', msg);
    } finally {
      setPinning(null);
    }
  };

  // ── Misc handlers ────────────────────────────────────────────────────────
  const handleShare = () => Share.share({
    title: `${user?.name} | Wakeel`,
    message: `⚖️ ${user?.name || 'Verified Lawyer'} on Wakeel\nhttps://wakeel.eg/lawyers/${user?.id}`,
  });

  const handleLogout = () => {
    Alert.alert(
      isRTL ? 'تسجيل الخروج' : 'Sign out',
      isRTL ? 'هل أنت متأكد؟' : 'Are you sure?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isRTL ? 'تأكيد' : 'Sign out', style: 'destructive', onPress: () => logout() },
      ],
    );
  };

  // ── Build a unified user-shape for ProfileHeader ─────────────────────────
  const headerUser = useMemo(() => {
    if (!user) return null;
    return {
      ...user,
      ...(profile || {}),
      role: 'lawyer' as const,
      // prefer lawyer_profiles fields when present
      specialization: profile?.specialization || user?.specialization,
      city:           profile?.city           || user?.city,
      is_verified:    profile?.is_verified    ?? user?.is_verified,
    };
  }, [user, profile]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadProfile(); }}
            tintColor={C.gold}
          />
        }
      >
        {/* ── Header ── */}
        <ProfileHeader
          user={headerUser}
          hideBackButton={true}
          onSettings={() => router.push('/account-settings' as any)}
          primaryAction={{
            label: isRTL ? '✏️ تعديل الملف' : '✏️ Edit Profile',
            onPress: () => router.push('/edit-profile' as any),
          }}
          secondaryActions={[
            {
              label: isRTL ? 'مشاركة الملف' : 'Share Profile',
              icon: 'share-outline',
              onPress: handleShare,
              variant: 'ghost',
            },
          ]}
        />

        {/* ── Stats strip ── */}
        <View style={[styles.statsStrip, { backgroundColor: C.surface, borderTopColor: C.border, borderBottomColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Stat
            icon="⭐"
            value={profile?.avg_rating ? Number(profile.avg_rating).toFixed(1) : '—'}
            label={isRTL ? 'التقييم' : 'Rating'}
            sub={profile?.total_reviews ? `${profile.total_reviews} ${isRTL ? 'تقييم' : 'reviews'}` : ''}
            C={C}
          />
          <Stat
            icon="💼"
            value={String((profile?.wins || 0) + (profile?.losses || 0))}
            label={isRTL ? 'القضايا' : 'Cases'}
            sub={profile?.wins ? `${profile.wins} ${isRTL ? 'فوز' : 'wins'}` : ''}
            C={C}
          />
          <Stat
            icon="⚖️"
            value={String(profile?.experience_years || 0)}
            label={isRTL ? 'سنوات' : 'Years'}
            sub={profile?.bar_number ? `#${profile.bar_number}` : ''}
            C={C}
          />
        </View>

        {/* ── Tab strip ── */}
        <View style={[styles.tabStrip, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
            {(['about', 'reviews'] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tabBtn, { borderBottomColor: tab === t ? C.gold : 'transparent' }]}
              >
                <Text style={{
                  color: tab === t ? C.gold : C.muted,
                  fontWeight: tab === t ? '800' : '500',
                  fontSize: 13,
                  fontFamily: 'Cairo-Regular',
                }}>
                  {t === 'about' ? (isRTL ? 'نبذة' : 'About') : (isRTL ? 'تقييمات' : 'Reviews')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Tab body ── */}
        <View style={{ paddingTop: 4, minHeight: 320 }}>

          {tab === 'about' && (
            <View>
              {/* Bio */}
              <SectionCard
                title={isRTL ? '👤 نبذة' : '👤 About'}
                C={C} isRTL={isRTL}
                onEdit={() => router.push('/edit-profile' as any)}
              >
                <Text style={[styles.body, { color: C.text, textAlign: isRTL ? 'right' : 'left' }]}>
                  {profile?.bio || user?.bio || (isRTL ? 'أضف نبذة عن خبرتك المهنية ليراها العملاء.' : 'Add a bio to tell clients about your expertise.')}
                </Text>
              </SectionCard>

              {/* Service prices */}
              <SectionCard
                title={isRTL ? '💰 أسعار الخدمات' : '💰 Service Prices'}
                C={C} isRTL={isRTL}
                onEdit={() => router.push('/edit-profile' as any)}
              >
                {(() => {
                  let sp: any = profile?.service_prices;
                  if (typeof sp === 'string') { try { sp = JSON.parse(sp); } catch { sp = {}; } }
                  if (!sp || typeof sp !== 'object') sp = {};
                  const base = Number(profile?.consultation_fee) || 400;
                  const FALLBACK_MUL: Record<string, number> = { video: 1.5, text: 0.5, inperson: 2, document: 0.8 };
                  const types: Array<keyof typeof SERVICE_LABELS> = ['video', 'text', 'inperson', 'document'];
                  return types.map((t, i) => {
                    const lbl = SERVICE_LABELS[t];
                    const price = Number(sp[t]) || Math.round(base * (FALLBACK_MUL[t] || 1));
                    return (
                      <View
                        key={t}
                        style={{
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          justifyContent: 'space-between',
                          paddingVertical: 9,
                          borderBottomWidth: i < types.length - 1 ? StyleSheet.hairlineWidth : 0,
                          borderBottomColor: C.border,
                        }}
                      >
                        <Text style={{ color: C.text, fontSize: 13 }}>{lbl.icon} {isRTL ? lbl.ar : lbl.en}</Text>
                        <Text style={{ color: C.gold, fontWeight: '800', fontSize: 14 }}>{price} {isRTL ? 'ج' : 'EGP'}</Text>
                      </View>
                    );
                  });
                })()}
              </SectionCard>

              {/* Schedule shortcut */}
              <SectionCard
                title={isRTL ? '📅 المواعيد' : '📅 Availability'}
                C={C} isRTL={isRTL}
                onEdit={() => router.push('/(lawyer-tabs)/schedule' as any)}
              >
                <Text style={[styles.body, { color: C.muted, textAlign: isRTL ? 'right' : 'left' }]}>
                  {isRTL
                    ? 'اضبط جدول مواعيدك وأنواع الاستشارات لكل يوم.'
                    : 'Set your weekly schedule and per-day service types.'}
                </Text>
              </SectionCard>
            </View>
          )}

          {tab === 'posts' && (
            <View>
              {/* Currently pinned */}
              {pinnedLoaded && pinned.length > 0 && (
                <View style={{ paddingTop: 8 }}>
                  {pinned.map(p => (
                    <PinnedPostCard
                      key={p.id}
                      post={p}
                      canEdit
                      onUnpin={() => togglePin(p)}
                    />
                  ))}
                </View>
              )}

              {/* Manage pinned posts panel */}
              <View style={[styles.manageCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <TouchableOpacity
                  onPress={() => setShowManagePins(s => !s)}
                  activeOpacity={0.7}
                  style={[styles.manageHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  <Ionicons name="bookmark-outline" size={16} color={C.gold} />
                  <Text style={{ color: C.text, fontSize: 14, fontWeight: '700', flex: 1, marginHorizontal: 8, textAlign: isRTL ? 'right' : 'left' }}>
                    {isRTL ? 'إدارة المنشورات المثبتة' : 'Manage pinned posts'}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 11 }}>{pinned.length}/2</Text>
                  <Ionicons
                    name={showManagePins ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={C.muted}
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>

                {showManagePins && (
                  <View style={{ paddingTop: 4 }}>
                    {!myPostsLoaded ? (
                      <View style={{ padding: 16, alignItems: 'center' }}>
                        <ActivityIndicator color={C.gold} />
                      </View>
                    ) : myPosts.length === 0 ? (
                      <Text style={{ color: C.muted, fontSize: 12, padding: 14, textAlign: 'center' }}>
                        {isRTL ? 'لم تنشر شيئاً بعد' : 'You have no posts yet'}
                      </Text>
                    ) : (
                      myPosts.slice(0, 20).map(p => {
                        const isPinned = pinned.some(pp => pp.id === p.id);
                        const isBusy = pinning === p.id;
                        return (
                          <View
                            key={p.id}
                            style={[styles.managePostRow, { borderTopColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                          >
                            <View style={{ flex: 1, marginHorizontal: 10 }}>
                              <HashtagText
                                text={p.question || ''}
                                style={{ color: C.text, fontSize: 13, lineHeight: 19, fontFamily: 'Cairo-Regular', textAlign: isRTL ? 'right' : 'left' }}
                                goldColor={C.gold}
                                numberOfLines={2}
                              />
                              <Text style={{ color: C.muted, fontSize: 10, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
                                ↑ {p.likes_count || 0} · 💬 {p.answer_count || 0}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => togglePin(p)}
                              disabled={isBusy}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                borderRadius: 16,
                                backgroundColor: isPinned ? C.gold : 'transparent',
                                borderWidth: 1.5,
                                borderColor: C.gold,
                                alignSelf: 'center',
                                opacity: isBusy ? 0.5 : 1,
                              }}
                            >
                              {isBusy ? (
                                <ActivityIndicator size="small" color={isPinned ? '#1C1611' : C.gold} />
                              ) : (
                                <Text style={{ color: isPinned ? '#1C1611' : C.gold, fontSize: 11, fontWeight: '800' }}>
                                  {isPinned
                                    ? (isRTL ? 'مثبّت ✓' : 'Pinned ✓')
                                    : (isRTL ? '+ تثبيت' : '+ Pin')}
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>

              {/* Helpful hint */}
              {pinned.length === 0 && (
                <View style={{ padding: 14 }}>
                  <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                    {isRTL
                      ? '💡 ثبّت أفضل إجاباتك القانونية أعلى ملفك الشخصي ليراها العملاء أولاً.'
                      : '💡 Pin your best legal answers to the top of your profile so clients see them first.'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {tab === 'activity' && user?.id && (
            <ActivityFeed userId={user.id} scrollEnabled={false} />
          )}

          {tab === 'reviews' && (
            <View style={{ padding: 14 }}>
              {profile?.reviews && Array.isArray(profile.reviews) && profile.reviews.length > 0 ? (
                profile.reviews.map((r: any, i: number) => (
                  <View key={r.id || i} style={[styles.reviewCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Text style={{ color: C.gold, fontSize: 14 }}>{'⭐'.repeat(Number(r.rating) || 0)}</Text>
                    {r.comment && (
                      <Text style={{ color: C.text, fontSize: 13, lineHeight: 20, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
                        {r.comment}
                      </Text>
                    )}
                  </View>
                ))
              ) : (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>⭐</Text>
                  <Text style={{ color: C.muted, fontSize: 13 }}>
                    {isRTL ? 'لا توجد تقييمات بعد' : 'No reviews yet'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity
          onPress={handleLogout}
          style={[styles.logoutRow, { backgroundColor: C.surface, borderColor: C.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="log-out-outline" size={18} color="#E11D48" />
          <Text style={{ color: '#E11D48', fontWeight: '700', fontSize: 14, marginHorizontal: 8 }}>
            {isRTL ? 'تسجيل الخروج' : 'Sign out'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─── Tiny components ────────────────────────────────────────────────────────
function Stat({ icon, value, label, sub, C }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginTop: 2 }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 10, marginTop: 1 }}>{label}</Text>
      {sub ? <Text style={{ color: C.muted, fontSize: 9, marginTop: 1 }}>{sub}</Text> : null}
    </View>
  );
}

function SectionCard({ title, onEdit, C, isRTL, children }: any) {
  return (
    <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
      <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Text style={[styles.sectionTitle, { color: C.text, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
            <Ionicons name="create-outline" size={18} color={C.gold} />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  statsStrip: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 20,
    paddingVertical: 16,
    borderWidth: 0,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  tabStrip: { 
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  tabBtn:   { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 3 },
  section: {
    marginHorizontal: 16, marginVertical: 8,
    padding: 16, borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionHeader: { alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontWeight: '800', fontSize: 14, fontFamily: 'Cairo-Bold' },
  body:          { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo-Regular' },
  manageCard:    {
    marginHorizontal: 12, marginVertical: 6,
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
  },
  manageHeader:  { alignItems: 'center', padding: 14 },
  managePostRow: {
    paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reviewCard: {
    marginVertical: 6, padding: 14,
    borderRadius: 12, borderWidth: 1,
  },
  logoutRow: {
    marginHorizontal: 12, marginTop: 10,
    paddingVertical: 13, paddingHorizontal: 16,
    borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
});
