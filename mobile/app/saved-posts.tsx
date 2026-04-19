import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  ActivityIndicator, RefreshControl, StatusBar, I18nManager,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/hooks/useTheme';
import { forumAPI } from '../src/services/api';
import HashtagText from '../src/components/HashtagText';

I18nManager.forceRTL(true);

const GOLD = '#C8A84B';

function timeAgo(iso: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

export default function SavedPosts() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unsavingIds, setUnsavingIds] = useState<Set<number>>(new Set());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res: any = await forumAPI.getSavedPosts();
      setPosts(res?.questions || []);
    } catch {
      // Graceful fail — show empty state
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUnsave = async (id: number) => {
    setUnsavingIds(prev => new Set(prev).add(id));
    // Optimistic removal with slight delay for UX clarity
    setTimeout(() => {
      setPosts(prev => prev.filter(p => p.id !== id));
      setUnsavingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }, 400);
    try { await forumAPI.savePost(id); } catch {}
  };

  const renderItem = ({ item: p, index }: { item: any; index: number }) => {
    const isLawyer = p.user_role === 'lawyer';
    const flair = p.user_flair;
    const isBusy = unsavingIds.has(p.id);

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } } as any)}
        style={{
          backgroundColor: C.surface,
          borderRadius: 16,
          marginHorizontal: 14,
          marginTop: index === 0 ? 14 : 8,
          marginBottom: 4,
          borderWidth: 1,
          borderColor: C.border,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
          opacity: isBusy ? 0.5 : 1,
        }}
      >
        {/* Gold accent bar on right side */}
        <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, backgroundColor: isLawyer ? GOLD : C.border }} />

        <View style={{ padding: 14 }}>
          {/* Author row */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            {/* Avatar circle */}
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: GOLD + '25',
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1.5, borderColor: isLawyer ? GOLD : C.border,
            }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: GOLD }}>
                {(p.asked_by || 'م').charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
                  {p.asked_by || 'مستخدم'}
                </Text>
                {flair ? (
                  <View style={{
                    backgroundColor: GOLD + '20', borderRadius: 6,
                    paddingHorizontal: 7, paddingVertical: 2,
                    borderWidth: 1, borderColor: GOLD + '40',
                  }}>
                    <Text style={{ color: GOLD, fontSize: 10, fontWeight: '700' }}>{flair}</Text>
                  </View>
                ) : isLawyer && (
                  <View style={{
                    backgroundColor: GOLD + '20', borderRadius: 6,
                    paddingHorizontal: 7, paddingVertical: 2,
                    borderWidth: 1, borderColor: GOLD + '40',
                  }}>
                    <Text style={{ color: GOLD, fontSize: 10, fontWeight: '700' }}>⚖️ محامٍ</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <Text style={{ fontSize: 11, color: C.muted }}>🌐 · {timeAgo(p.created_at)}</Text>
                {p.category && (
                  <>
                    <Text style={{ fontSize: 11, color: C.muted }}>·</Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>{p.category}</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Post text */}
          {p.question && p.question !== 'مشاركة' && (
            <HashtagText
              text={p.question}
              goldColor="#0A66C2"
              numberOfLines={4}
              style={{
                fontSize: 14, lineHeight: 22,
                color: C.text, textAlign: 'right',
                marginBottom: p.image_url ? 10 : 12,
              }}
            />
          )}

          {/* Post image */}
          {p.image_url && (
            <Image
              source={{ uri: p.image_url }}
              style={{ width: '100%', height: 180, borderRadius: 10, marginBottom: 12 }}
              resizeMode="cover"
            />
          )}

          {/* Stats row */}
          {((p.likes_count || 0) > 0 || (p.answer_count || 0) > 0) && (
            <View style={{ flexDirection: 'row-reverse', gap: 14, marginBottom: 10 }}>
              {(p.likes_count || 0) > 0 && (
                <Text style={{ fontSize: 12, color: C.muted }}>👍 {p.likes_count}</Text>
              )}
              {(p.answer_count || 0) > 0 && (
                <Text style={{ fontSize: 12, color: C.muted }}>💬 {p.answer_count} تعليق</Text>
              )}
            </View>
          )}

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: C.border, marginBottom: 10 }} />

          {/* Unsave button */}
          <TouchableOpacity
            onPress={() => handleUnsave(p.id)}
            disabled={isBusy}
            style={{
              flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
              gap: 8, paddingVertical: 6,
              backgroundColor: GOLD + '12', borderRadius: 10,
              borderWidth: 1, borderColor: GOLD + '30',
            }}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color={GOLD} />
            ) : (
              <>
                <Text style={{ fontSize: 16, color: GOLD }}>🔖</Text>
                <Text style={{ fontSize: 13, color: GOLD, fontWeight: '700' }}>إزالة من المحفوظات</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingBottom: 14,
        paddingHorizontal: 16,
        backgroundColor: C.surface,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        flexDirection: 'row-reverse',
        alignItems: 'center',
        gap: 12,
      }}>
        {/* Gold accent line */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: GOLD + '40' }} />

        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, fontFamily: 'CormorantGaramond-Bold' }}>
            المنشورات المحفوظة
          </Text>
          {posts.length > 0 && (
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {posts.length} منشور محفوظ
            </Text>
          )}
        </View>

        {/* Bookmark icon */}
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: GOLD + '15',
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: GOLD + '30',
        }}>
          <Text style={{ fontSize: 20 }}>🔖</Text>
        </View>

        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: C.card,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: C.border,
          }}
        >
          <Text style={{ fontSize: 20, color: C.text, lineHeight: 24 }}>‹</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={GOLD} size="large" />
          <Text style={{ color: C.muted, fontSize: 14 }}>جاري التحميل…</Text>
        </View>
      ) : posts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 }}>
          <View style={{
            width: 90, height: 90, borderRadius: 45,
            backgroundColor: GOLD + '15', alignItems: 'center', justifyContent: 'center',
            borderWidth: 2, borderColor: GOLD + '30',
          }}>
            <Text style={{ fontSize: 44 }}>🔖</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center' }}>
            لا توجد منشورات محفوظة
          </Text>
          <Text style={{ fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 22 }}>
            احفظ المنشورات المفيدة من منتدى وكيل للرجوع إليها لاحقاً
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              marginTop: 8, backgroundColor: GOLD, borderRadius: 12,
              paddingHorizontal: 28, paddingVertical: 13,
            }}
          >
            <Text style={{ color: '#000', fontWeight: '800', fontSize: 15 }}>تصفح المنتدى</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => p.id.toString()}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={GOLD} colors={[GOLD]} />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <Text style={{ textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 16, marginBottom: 4 }}>
              — نهاية المحفوظات —
            </Text>
          }
        />
      )}
    </View>
  );
}
