// ─── Wakeel — Lawyer Public Profile (Chunk 4a — LinkedIn redesign) ───────────
// Replaces the previous /lawyer/[id].tsx with a LinkedIn-grade layout.
//
// Layout (top → bottom):
//   1. ProfileHeader (cover + avatar + name + role + actions)
//   2. Stats row: ⭐ rating · 💼 cases · ⚖️ years exp.
//   3. Tab strip: About | Posts | Activity | Reviews | Availability
//   4. Tab body
//   5. Sticky bottom CTA: "Consultations from X EGP" + Book button
//
// Tab contents:
//   • About:      bio, certifications, languages, office map (with address)
//   • Posts:      pinned posts (top 2 gold cards) + LawyerPostsTab list
//   • Activity:   ActivityFeed component
//   • Reviews:    star breakdown + recent reviews
//   • Availability: calendar + slot picker (preserved from previous version)
//
// Backend dependencies:
//   • GET /api/lawyers/:id                      (existing)
//   • GET /api/lawyers/:id/availability         (existing)
//   • GET /api/forum/users/:id/pinned           (Chunk 4a — new)
//   • Plus the activity endpoint via ActivityFeed component
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Share, RefreshControl, StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useI18n } from '../../src/i18n';
import { useAuth } from '../../src/hooks/useAuth';
import { lawyersAPI, forumAPI } from '../../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ProfileHeader }   from '../../src/components/profile/ProfileHeader';
import { ActivityFeed }    from '../../src/components/profile/ActivityFeed';
import { PinnedPostCard }  from '../../src/components/profile/PinnedPostCard';
import { LawyerPostsTab }  from '../../src/components/forum/LawyerPostsTab';
import { LawyerMap }       from '../../src/components/LawyerMap';

const SERVICE_LABELS = {
  video:    { ar: 'فيديو',     en: 'Video',     icon: '📹' },
  text:     { ar: 'نصي',       en: 'Text',      icon: '💬' },
  inperson: { ar: 'حضوري',     en: 'In-Person', icon: '🏛️' },
  document: { ar: 'مراجعة',    en: 'Review',    icon: '📄' },
};

type Tab = 'about' | 'reviews' | 'availability';

export default function LawyerPublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const C = useTheme();
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuth();

  const [lawyer, setLawyer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('about');
  const [pinned, setPinned] = useState<any[]>([]);
  const [pinnedLoaded, setPinnedLoaded] = useState(false);

  // ── Load lawyer ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res: any = await lawyersAPI.get(id);
      setLawyer(res);
    } catch {
      setLawyer(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  // ── Load pinned posts (lazy, when Posts tab opens) ───────────────────────
  const loadPinned = useCallback(async () => {
    if (!id || pinnedLoaded) return;
    try {
      const res: any = await forumAPI.getPinnedPosts(id);
      setPinned(res?.pinned || []);
    } catch {
      setPinned([]);
    } finally {
      setPinnedLoaded(true);
    }
  }, [id, pinnedLoaded]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'posts') loadPinned();
  }, [tab, loadPinned]);

  // ── Compute starting price (lowest of 4 service types) ──────────────────
  const startingPrice = useMemo(() => {
    if (!lawyer) return 0;
    let sp: any = lawyer.service_prices;
    if (typeof sp === 'string') { try { sp = JSON.parse(sp); } catch { sp = {}; } }
    if (!sp || typeof sp !== 'object') sp = {};
    const prices = Object.values(sp).map(Number).filter(n => n > 0);
    if (prices.length > 0) return Math.min(...prices);
    return Number(lawyer.consultation_fee) || 0;
  }, [lawyer]);

  // ── Share ────────────────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!lawyer) return;
    try {
      await Share.share({
        message: isRTL
          ? `${lawyer.name} - محامٍ على Wakeel\nhttps://wakeel.eg/lawyers/${lawyer.id}`
          : `${lawyer.name} - Lawyer on Wakeel\nhttps://wakeel.eg/lawyers/${lawyer.id}`,
      });
    } catch { /* user cancelled */ }
  }, [lawyer, isRTL]);

  const handleBook = useCallback(() => {
    if (!isLoggedIn) {
      router.push('/(auth)/login' as any);
      return;
    }
    router.push({ pathname: '/book', params: { lawyer: id } } as any);
  }, [isLoggedIn, id]);


  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  if (!lawyer) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🤷</Text>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>
          {isRTL ? 'لم يتم العثور على المحامي' : 'Lawyer not found'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: C.gold }}>
          <Text style={{ color: C.gold, fontWeight: '700' }}>{isRTL ? 'عودة' : 'Back'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.gold}
          />
        }
      >
        {/* ── Header ── */}
        <ProfileHeader
          user={lawyer}
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
            label={isRTL ? 'التقييم' : 'Rating'}
            value={lawyer.avg_rating ? Number(lawyer.avg_rating).toFixed(1) : '—'}
            sub={lawyer.total_reviews ? `${lawyer.total_reviews} ${isRTL ? 'تقييم' : 'reviews'}` : ''}
            C={C}
          />
          <Stat
            icon="💼"
            label={isRTL ? 'القضايا' : 'Cases'}
            value={String((lawyer.wins || 0) + (lawyer.losses || 0))}
            sub={lawyer.wins ? `${lawyer.wins} ${isRTL ? 'فوز' : 'wins'}` : ''}
            C={C}
          />
          <Stat
            icon="⚖️"
            label={isRTL ? 'سنوات الخبرة' : 'Years exp.'}
            value={String(lawyer.experience_years || 0)}
            sub={lawyer.bar_number ? `#${lawyer.bar_number}` : ''}
            C={C}
          />
        </View>

        {/* ── Tab strip ── */}
        <View style={[styles.tabStrip, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12 }}
          >
            {(['about', 'reviews', 'availability'] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                style={[
                  styles.tabBtn,
                  { borderBottomColor: tab === t ? C.gold : 'transparent' },
                ]}
              >
                <Text style={{
                  color: tab === t ? C.gold : C.muted,
                  fontWeight: tab === t ? '800' : '500',
                  fontSize: 13,
                  fontFamily: 'Cairo-Regular',
                }}>
                  {t === 'about'        ? (isRTL ? 'نبذة'      : 'About')
                  : t === 'reviews'     ? (isRTL ? 'تقييمات'    : 'Reviews')
                  : (isRTL ? 'مواعيد' : 'Availability')}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Tab body ── */}
        <View style={{ paddingTop: 4, minHeight: 400 }}>

          {/* ABOUT */}
          {tab === 'about' && (
            <View>
              <Section title={isRTL ? '👤 نبذة' : '👤 About'} C={C} isRTL={isRTL}>
                <Text style={[styles.bodyText, { color: C.text, textAlign: isRTL ? 'right' : 'left' }]}>
                  {lawyer.bio || (isRTL ? 'لم يضف هذا المحامي نبذة بعد.' : 'No bio yet.')}
                </Text>
              </Section>

              {/* Service prices */}
              <Section title={isRTL ? '💰 أسعار الخدمات' : '💰 Service Prices'} C={C} isRTL={isRTL}>
                {(() => {
                  let sp: any = lawyer.service_prices;
                  if (typeof sp === 'string') { try { sp = JSON.parse(sp); } catch { sp = {}; } }
                  if (!sp || typeof sp !== 'object') sp = {};
                  const base = Number(lawyer.consultation_fee) || 400;
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
                        <Text style={{ color: C.text, fontSize: 13 }}>
                          {lbl.icon} {isRTL ? lbl.ar : lbl.en}
                        </Text>
                        <Text style={{ color: C.gold, fontWeight: '800', fontSize: 14 }}>
                          {price} {isRTL ? 'ج' : 'EGP'}
                        </Text>
                      </View>
                    );
                  });
                })()}
              </Section>

              {/* Office map */}
              {(lawyer.office || (lawyer.office_lat && lawyer.office_lng)) && (
                <Section title={isRTL ? '🏛️ موقع المكتب' : '🏛️ Office Location'} C={C} isRTL={isRTL}>
                  {lawyer.office && (
                    <Text style={{ color: C.muted, fontSize: 13, marginBottom: 10, textAlign: isRTL ? 'right' : 'left', lineHeight: 20 }}>
                      {lawyer.office}
                    </Text>
                  )}
                  <LawyerMap
                    lawyerName={lawyer.name}
                    officeAddress={lawyer.office || ''}
                    latitude={lawyer.office_lat ? Number(lawyer.office_lat) : undefined}
                    longitude={lawyer.office_lng ? Number(lawyer.office_lng) : undefined}
                    height={180}
                  />
                </Section>
              )}
            </View>
          )}



          {/* REVIEWS */}
          {tab === 'reviews' && (
            <View>
              {Array.isArray(lawyer.reviews) && lawyer.reviews.length > 0 ? (
                lawyer.reviews.map((r: any, i: number) => (
                  <View key={r.id || i} style={[styles.reviewCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: C.gold, fontSize: 14 }}>{'⭐'.repeat(Number(r.rating) || 0)}</Text>
                      <Text style={{ color: C.muted, fontSize: 11 }}>{r.created_at ? String(r.created_at).slice(0, 10) : ''}</Text>
                    </View>
                    {r.comment && (
                      <Text style={{ color: C.text, fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>
                        {r.comment}
                      </Text>
                    )}
                  </View>
                ))
              ) : (
                <View style={{ paddingVertical: 50, alignItems: 'center' }}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>⭐</Text>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{isRTL ? 'لا توجد تقييمات بعد' : 'No reviews yet'}</Text>
                </View>
              )}
            </View>
          )}

          {/* AVAILABILITY (placeholder — full calendar lives on Book screen) */}
          {tab === 'availability' && (
            <Section title={isRTL ? '📅 المواعيد المتاحة' : '📅 Availability'} C={C} isRTL={isRTL}>
              <Text style={{ color: C.muted, fontSize: 13, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL
                  ? 'اضغط على "احجز الآن" أدناه لرؤية المواعيد المتاحة وحجز جلسة.'
                  : 'Tap "Book now" below to see available time slots and schedule a session.'}
              </Text>
              <TouchableOpacity
                onPress={handleBook}
                style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: C.gold, alignSelf: isRTL ? 'flex-end' : 'flex-start' }}
              >
                <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>
                  {isRTL ? '📅 افتح التقويم' : '📅 Open calendar'}
                </Text>
              </TouchableOpacity>
            </Section>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky bottom CTA ── */}
      <View style={[styles.bottomCta, {
        backgroundColor: C.surface, borderTopColor: C.border,
        paddingBottom: insets.bottom + 12,
        flexDirection: isRTL ? 'row-reverse' : 'row',
      }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.muted, fontSize: 11 }}>
            {isRTL ? 'استشارات تبدأ من' : 'Consultations from'}
          </Text>
          <Text style={{ color: C.gold, fontWeight: '900', fontSize: 22 }}>
            {startingPrice} {isRTL ? 'جنيه' : 'EGP'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleBook}
          activeOpacity={0.85}
          style={{
            backgroundColor: C.gold,
            paddingHorizontal: 22, paddingVertical: 12,
            borderRadius: 24,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center', gap: 8,
          }}
        >
          <Ionicons name="calendar" size={16} color="#1C1611" />
          <Text style={{ color: '#1C1611', fontWeight: '800', fontSize: 14 }}>
            {isRTL ? 'احجز الآن' : 'Book now'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Tiny components ────────────────────────────────────────────────────────
function Section({ title, C, isRTL, children }: any) {
  return (
    <View style={[styles.section, { backgroundColor: C.surface, borderColor: C.border }]}>
      <Text style={[styles.sectionTitle, { color: C.text, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
      {children}
    </View>
  );
}

function Stat({ icon, label, value, sub, C }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginTop: 2 }}>{value}</Text>
      <Text style={{ color: C.muted, fontSize: 10, marginTop: 1 }}>{label}</Text>
      {sub ? <Text style={{ color: C.muted, fontSize: 9, marginTop: 1 }}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statsStrip: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabStrip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 3,
  },
  section: {
    marginHorizontal: 12, marginVertical: 6,
    padding: 14, borderRadius: 14,
    borderWidth: 1,
  },
  sectionTitle: { fontWeight: '800', fontSize: 14, marginBottom: 10, fontFamily: 'Cairo-Bold' },
  bodyText: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo-Regular' },
  reviewCard: {
    marginHorizontal: 12, marginVertical: 6,
    padding: 14, borderRadius: 12,
    borderWidth: 1,
  },
  bottomCta: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1,
    alignItems: 'center', gap: 12,
  },
});
