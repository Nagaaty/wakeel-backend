// ─── Wakeel — Client Public Profile (viewed by others) ───────────────────────
// Clean LinkedIn-style: ProfileHeader (cover+avatar) + Activity only.
// No About tab, no joined date, no role subtitle.
// Activity cards match profile.tsx exactly.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl, Image,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTheme } from '../../../src/hooks/useTheme';
import { useI18n } from '../../../src/i18n';
import { usersAPI, forumAPI } from '../../../src/services/api';
import { ProfileHeader } from '../../../src/components/profile/ProfileHeader';

// ── Same post-text extractor as profile.tsx ───────────────────────────────────
function extractText(p: any): string | null {
  let origData: any = null;
  try {
    origData = p.original_post_data
      ? (typeof p.original_post_data === 'string' ? JSON.parse(p.original_post_data) : p.original_post_data)
      : null;
  } catch { origData = null; }
  const clean = (s: string) => (s || '').replace(/\[إعادة نشر من.*?\]:\s*/g, '').trim();
  const caption = clean(p.question || '');
  const userCaption = (caption && caption !== '.' && caption !== 'مشاركة') ? caption : null;
  const originalText = origData?.question ? clean(origData.question) : null;
  return userCaption || originalText;
}

function timeAgo(iso: string, isRTL: boolean) {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2)  return isRTL ? 'الآن' : 'now';
  if (m < 60) return `${m}${isRTL ? 'د' : 'm'}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${isRTL ? 'س' : 'h'}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}${isRTL ? 'ي' : 'd'}`;
  return `${Math.floor(d / 30)}${isRTL ? 'ش' : 'mo'}`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const C = useTheme();
  const { isRTL } = useI18n();

  const [user, setUser]               = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [posts, setPosts]             = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showAll, setShowAll]         = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const res: any = await usersAPI.getProfileSummary(id as string).catch(() => null)
        || await usersAPI.get(id as string).then((r: any) => r?.user || r);
      setUser(res || null);
    } catch { setUser(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setPostsLoading(true);
    try {
      const res: any = await forumAPI.getUserPosts(id as string);
      const raw: any[] = res?.questions || res || [];
      setPosts(
        raw
          .map((p: any) => ({ ...p, _text: extractText(p), _isRepost: !!p.original_post_data || p.question === 'مشاركة' }))
          .filter((p: any) => p._text && p._text.trim().length > 0)
      );
    } catch { setPosts([]); }
    finally { setPostsLoading(false); }
  }, [id]);

  useEffect(() => { if (id) { fetchUser(); fetchPosts(); } }, [id]);

  useEffect(() => {
    if (user?.role === 'lawyer') {
      router.replace({ pathname: '/lawyer/[id]', params: { id: user.id } } as any);
    }
  }, [user?.role]);

  const onRefresh = () => { setRefreshing(true); fetchUser(); fetchPosts(); };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={C.gold} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🤷</Text>
        <Text style={{ color: C.muted, fontSize: 15, marginBottom: 24 }}>
          {isRTL ? 'لم يتم العثور على المستخدم' : 'User not found'}
        </Text>
        <TouchableOpacity onPress={() => router.back()}
          style={{ paddingHorizontal: 28, paddingVertical: 11, borderRadius: 24, borderWidth: 1.5, borderColor: C.gold }}>
          <Text style={{ color: C.gold, fontWeight: '700' }}>{isRTL ? '← عودة' : '← Back'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Privacy gate ───────────────────────────────────────────────────────────
  const isPublic = user?.forum_activity_public === true;

  // ── PRIVATE ────────────────────────────────────────────────────────────────
  if (!isPublic) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        {/* ProfileHeader with no subtitle for private */}
        <ProfileHeader user={user} headline="" subline="" />
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        >
          <View style={{
            backgroundColor: C.surface, borderRadius: 20, borderWidth: 1,
            borderColor: C.border, padding: 28, alignItems: 'center', gap: 14, marginTop: 8,
          }}>
            <Text style={{ fontSize: 40 }}>🔒</Text>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: '800', textAlign: 'center', fontFamily: 'Cairo-Bold' }}>
              {isRTL ? 'هذا الملف الشخصي خاص' : 'This profile is private'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              {isRTL
                ? 'اختار هذا المستخدم إخفاء تفاصيل ملفه الشخصي.'
                : 'This user has chosen to keep their profile details private.'}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── PUBLIC ─────────────────────────────────────────────────────────────────
  const visiblePosts = showAll ? posts : posts.slice(0, 3);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} />}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        {/* ── ProfileHeader: cover + left avatar + name only (no subtitle) ── */}
        <ProfileHeader user={user} headline="" subline="" />

        {/* ── Activity section — identical card style to profile.tsx ── */}
        <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border, marginTop: 8 }}>

          {/* Section header — same as profile.tsx */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', fontFamily: 'Cairo-Bold' }}>
                {isRTL ? 'النشاط' : 'Activity'}
              </Text>
              <Text style={{ color: C.muted, fontSize: 13 }}>
                {isRTL ? `${posts.length} منشور` : `${posts.length} posts`}
              </Text>
            </View>
          </View>

          {postsLoading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={C.gold} size="large" />
            </View>
          ) : posts.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 36 }}>✨</Text>
              <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center' }}>
                {isRTL ? 'لا يوجد نشاط بعد' : 'No activity yet'}
              </Text>
            </View>
          ) : (
            <>
              {visiblePosts.map((p: any, idx: number) => {
                const ago = timeAgo(p.created_at, isRTL);
                const actionText = p._isRepost
                  ? (isRTL ? 'أعاد نشر هذا' : 'reposted this')
                  : (isRTL ? 'نشر هذا'      : 'posted this');

                return (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } } as any)}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 12,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: C.border,
                    }}
                  >
                    {/* Name + action + time — exactly like profile.tsx */}
                    <View style={{ flexDirection: 'row-reverse', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                      <Text style={{ color: C.text, fontSize: 14, fontWeight: '700' }}>
                        {user?.name || ''}{' '}
                        <Text style={{ color: C.muted, fontWeight: 'normal', fontSize: 13 }}>
                          {actionText} · {ago}
                        </Text>
                      </Text>
                    </View>

                    {/* Post text */}
                    <Text
                      style={{ color: C.text, fontSize: 15, lineHeight: 22, textAlign: 'right', fontFamily: 'Cairo-Regular' }}
                      numberOfLines={3}
                    >
                      {p._text}
                    </Text>

                    {/* Image preview */}
                    {!!p.image_url && (
                      <Image
                        source={{ uri: p.image_url }}
                        style={{ width: '100%', height: 180, borderRadius: 12, marginTop: 10 }}
                        resizeMode="cover"
                      />
                    )}

                    {/* Likes + comments stats */}
                    {((p.likes_count || 0) > 0 || (p.answer_count || 0) > 0) && (
                      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                        {(p.likes_count || 0) > 0 && (
                          <Text style={{ color: C.muted, fontSize: 12 }}>👍 {p.likes_count}</Text>
                        )}
                        {(p.answer_count || 0) > 0 && (
                          <Text style={{ color: C.muted, fontSize: 12 }}>💬 {p.answer_count}</Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Show all / Show less — LinkedIn style */}
              {posts.length > 3 && (
                <TouchableOpacity
                  onPress={() => setShowAll(v => !v)}
                  style={{ borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: C.text, fontSize: 15, fontWeight: '700' }}>
                    {showAll
                      ? (isRTL ? 'عرض أقل ↓' : 'Show less ↑')
                      : (isRTL ? `عرض الكل (${posts.length}) ↑` : `Show all (${posts.length}) →`)}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
