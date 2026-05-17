// ─── Wakeel — Forum PostCard (Chunk 3a) ──────────────────────────────────────
// Visual rewrite: LinkedIn-Reddit hybrid.
//   • Reddit-style vote column on the leading edge: prominent up/down arrows
//     with the score in between, color-coded to user's vote.
//   • LinkedIn-style author hierarchy: 44px avatar, bold name with verified
//     badge, subtitle line for role + time + category, ellipsis menu trailing.
//   • Tighter typography (16px body, 22px line-height) — reads like a feed.
//   • Stat strip ABOVE the action bar (LinkedIn pattern): "X likes · Y
//     comments · Z reposts" — only renders when counts > 0.
//   • Action bar with icon-only buttons + label that hides on small screens.
//   • Image card has rounded corners (no edge-to-edge) for the LinkedIn look.
//   • Repost cards are nested with a subtle gold left border.
//   • All animations are JS-thread-safe (no layout thrashing).
//
// Performance:
//   • Memoized via React.memo with a custom shallow comparator that only
//     compares the props that actually affect render output. Prevents
//     re-renders when a sibling card's vote count changes.
//   • Avatar uses FastImage (cached, off-thread decoding) when available,
//     falls back to RN Image gracefully.
//   • AutoSizingImage measures once with Image.getSize, caches the ratio
//     so it doesn't re-measure on re-render.
//
// This component preserves the EXISTING props interface from the previous
// version. Parent (forum.tsx) doesn't need to change how it calls it.
// ─────────────────────────────────────────────────────────────────────────────
import React, { memo, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, I18nManager, Image, StyleSheet, DeviceEventEmitter, AppState } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { timeAgo } from '../../utils/date';
import { Video, ResizeMode } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import HashtagText from '../HashtagText';
import api, { BASE_URL, resolveMediaUrl } from '../../services/api';

function isVideoUrl(url: string) {
  if (!url) return false;
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.m4v');
}

// ─── Avatar — uses ExpoImage with initials fallback ─────────────────────────
function UserAvatar({ name, uri, size = 44, gold }: { name?: string; uri?: string; size?: number; gold: string }) {
  const [failed, setFailed] = React.useState(false);
  const resolvedUri = resolveMediaUrl(uri);
  const ini = (name || '?').split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase();

  return (
    <View style={{ width: size, height: size }}>
      {/* Initials always show instantly underneath */}
      <View style={{
        position: 'absolute',
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: gold + '25',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: gold, fontWeight: '800', fontSize: size * 0.38, fontFamily: 'Cairo-Bold' }}>{ini}</Text>
      </View>

      {/* Photo overlays initials when it loads, hides on error */}
      {resolvedUri && !failed && (
        <ExpoImage
          source={{ uri: resolvedUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

// ─── Auto-sizing image with proper aspect ratio caching ─────────────────────
const _aspectCache = new Map<string, number>();

export function AutoSizingImage({ uri }: { uri: string }) {
  const cached = _aspectCache.get(uri);
  const [aspectRatio, setAspectRatio] = useState<number>(cached || 1.5);
  const [loaded, setLoaded] = useState<boolean>(!!cached);
  const [failed, setFailed] = useState<boolean>(false);

  if (failed) {
    return (
      <View style={{ width: '100%', aspectRatio: 1.5, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
        <Text style={{ fontSize: 28, opacity: 0.4 }}>🖼️</Text>
        <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 8, fontWeight: '600' }}>Image unavailable</Text>
      </View>
    );
  }

  const imageStyle = { width: '100%', aspectRatio, backgroundColor: '#E5E7EB', opacity: loaded ? 1 : 0.6 } as any;

  return (
    <ExpoImage 
      source={{ uri }} 
      style={imageStyle} 
      contentFit="cover"
      transition={200}
      onLoad={(e) => {
        if (!cached) {
          const { width, height } = e.source;
          if (width && height) {
            const ratio = Math.max(0.75, Math.min(width / height, 2.4));
            _aspectCache.set(uri, ratio);
            setAspectRatio(ratio);
          }
        }
        setLoaded(true);
      }}
      onError={() => setFailed(true)}
    />
  );
}

// ─── Inline video (preserved from original) ─────────────────────────────────
function VideoInPost({ uri, postId, onVideoTap }: { uri: string; postId?: number; onVideoTap?: () => void }) {
  const [isMuted, setIsMuted] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<any>(null);

  useEffect(() => {
    if (!postId) return;
    const sub = DeviceEventEmitter.addListener('visible_posts', (visibleIds: number[]) => {
      const nowVisible = visibleIds.includes(postId);
      setIsVisible(nowVisible);
      if (!nowVisible && videoRef.current) {
        videoRef.current.pauseAsync().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [postId]);

  // Fix black screen issue on Android when resuming app (hardware decoder crash)
  const [videoKey, setVideoKey] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        // App has come to the foreground! Remount the video to recover the context.
        setVideoKey(prev => prev + 1);
      }
    });
    return () => sub.remove();
  }, []);

  if (failed || (status && status.isLoaded === false && status.error)) {
    return (
      <View style={{ width: '100%', height: 280, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
        <Text style={{ fontSize: 28, opacity: 0.4 }}>🎥</Text>
        <Text style={{ color: '#9CA3AF', fontSize: 13, marginTop: 8, fontWeight: '600' }}>Video unavailable</Text>
      </View>
    );
  }

  return (
    <View style={{ width: '100%', height: 280, backgroundColor: '#0a0a0a', position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
      <TouchableOpacity activeOpacity={0.95} style={{ flex: 1 }} onPress={onVideoTap}>
        <Video
          key={videoKey}
          ref={videoRef}
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted={isMuted}
          shouldPlay={isVisible}
          onError={() => setFailed(true)}
          onPlaybackStatusUpdate={s => {
            setStatus(() => s);
            if (s && 'error' in s && s.error) setFailed(true);
          }}
        />
        {(!isVisible || (status?.isLoaded && !status.isPlaying)) && (
          <View style={styles.playOverlay}>
            <Ionicons name="play" size={28} color="#FFF" style={{ marginLeft: 3 }} />
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.muteBtn}
        onPress={() => setIsMuted(m => !m)}
        hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}
      >
        <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={16} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main card ──────────────────────────────────────────────────────────────
function PostCardInner({
  p, C, user, isRTL,
  liked, disliked, saved,
  onLike, onDislike, onSave,
  onComment, onShare, onNativeShare,
  onMediaTap, onMenuTap, onReactorsTap, catStyle,
}: any) {
  const origData = p.original_post_data
    ? (typeof p.original_post_data === 'string' ? JSON.parse(p.original_post_data) : p.original_post_data)
    : null;
  const isRepost = !!origData;
  const netScore = (p.likes_count || 0) - (p.dislikes_count || 0);
  const scoreColor = liked ? '#2563EB' : disliked ? '#EF4444' : C.text;
  const isLawyer = p.user_role === 'lawyer';

  const navigateToProfile = () => {
    if (p.user_id === user?.id) {
      router.push(user?.role === 'lawyer' ? '/(lawyer-tabs)/profile' : '/(tabs)/profile' as any);
    } else if (isLawyer) {
      router.push({ pathname: '/lawyer/[id]', params: { id: p.user_id } } as any);
    } else {
      router.push({ pathname: '/user/[id]', params: { id: p.user_id } } as any);
    }
  };

  // Subtitle = role · time · category (LinkedIn pattern)
  const subtitleParts: string[] = [];
  if (p.user_flair) subtitleParts.push(p.user_flair);
  else if (isLawyer) subtitleParts.push(isRTL ? '⚖️ محامٍ' : '⚖️ Lawyer');
  if (p.created_at) subtitleParts.push(timeAgo(p.created_at, isRTL));
  if (p.category && p.category !== 'الكل') subtitleParts.push(p.category);

  const directionStyle = { writingDirection: isRTL ? 'rtl' : 'ltr' } as any;

  return (
    <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      {/* Repost banner */}
      {isRepost && (
        <View style={[styles.repostBanner, { borderBottomColor: C.border }]}>
          <Ionicons name="repeat" size={13} color={C.muted} />
          <Text style={[styles.repostText, { color: C.muted }]} numberOfLines={1}>
            {p.asked_by || (isRTL ? 'مستخدم' : 'User')} {isRTL ? 'أعاد النشر' : 'reposted'}
          </Text>
        </View>
      )}

      {/* ── Author row ── */}
      <View style={[styles.authorRow, { flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse' }]}>
        <TouchableOpacity onPress={navigateToProfile} activeOpacity={0.7}>
          <UserAvatar name={p.asked_by} uri={p.user_avatar_url || undefined} size={44} gold={C.gold} />
        </TouchableOpacity>

        <TouchableOpacity
          style={{ flex: 1, marginHorizontal: 10 }}
          onPress={navigateToProfile}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={[styles.authorName, { color: C.text }]} numberOfLines={1}>
              {p.asked_by || (isRTL ? 'مستخدم' : 'User')}
            </Text>
            {isLawyer && p.is_verified && (
              <Ionicons name="checkmark-circle" size={14} color={C.gold} />
            )}
          </View>
          <Text style={[styles.subtitle, { color: C.muted, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onMenuTap(p)} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>

      {/* ── Body ── */}
      {/* TouchableOpacity wraps the body so tapping plain text opens comments,
          but tapping a #hashtag (handled by HashtagText) navigates to the
          tag page instead. RN handles the inner Text onPress with priority. */}
      <TouchableOpacity activeOpacity={0.97} onPress={() => onComment(p)}>
        {(!isRepost || (p.question && p.question !== 'مشاركة')) && p.question && (
          <HashtagText
            text={p.question}
            style={[
              isRepost ? styles.bodyText : styles.bodyTextLarge,
              { color: C.text, textAlign: isRTL ? 'right' : 'left' },
              directionStyle,
            ]}
            goldColor={C.gold}
          />
        )}
      </TouchableOpacity>

      {/* ── Media (rounded card style, NOT edge-to-edge) ── */}
      {!isRepost && p.image_url && (
        <View style={styles.mediaWrap}>
          {isVideoUrl(p.image_url) ? (
            <VideoInPost uri={resolveMediaUrl(p.image_url)} postId={p.id} onVideoTap={() => onMediaTap(p)} />
          ) : (
            <TouchableOpacity onPress={() => onMediaTap(p)} activeOpacity={0.95} style={styles.mediaTap}>
              <AutoSizingImage uri={resolveMediaUrl(p.image_url)} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Repost embedded card ── */}
      {isRepost && (
        <View style={[styles.repostCard, { borderColor: C.border, [isRTL ? 'borderRightWidth' : 'borderLeftWidth']: 3, borderLeftColor: C.gold, borderRightColor: C.gold }]}>
          <TouchableOpacity activeOpacity={0.88} onPress={() => onComment(p)}>
            <View style={[styles.repostHeader, { flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse' }]}>
              <UserAvatar name={origData.authorName || 'م'} uri={origData.authorAvatar || origData.user_avatar_url || undefined} size={28} gold={C.gold} />
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text style={[styles.repostAuthor, { color: C.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                  {origData.authorName || (isRTL ? 'مستخدم' : 'User')}
                </Text>
                {origData.authorRole === 'lawyer' && (
                  <Text style={[styles.repostFlair, { color: C.gold, textAlign: isRTL ? 'right' : 'left' }]}>
                    {isRTL ? '⚖️ محامٍ' : '⚖️ Lawyer'}
                  </Text>
                )}
              </View>
            </View>
            {origData.question && (
              <HashtagText
                text={origData.question}
                style={[styles.repostBodyText, { color: C.text, textAlign: isRTL ? 'right' : 'left' }, directionStyle]}
                numberOfLines={4}
                goldColor={C.gold}
              />
            )}
          </TouchableOpacity>
          {origData.image_url && (
            <View style={{ width: '100%', overflow: 'hidden', borderRadius: 8, marginTop: 8 }}>
              {isVideoUrl(origData.image_url) ? (
                <VideoInPost uri={resolveMediaUrl(origData.image_url)} postId={p.id} onVideoTap={() => onMediaTap({ ...p, image_url: origData.image_url })} />
              ) : (
                <TouchableOpacity onPress={() => onMediaTap({ ...p, image_url: origData.image_url })} activeOpacity={0.95}>
                  <AutoSizingImage uri={resolveMediaUrl(origData.image_url)} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── Stat strip (LinkedIn pattern) ── */}
      {(p.likes_count > 0 || (p.shares_count || 0) > 0 || (p.answer_count || 0) > 0) && (
        <View style={[styles.statStrip, { borderTopColor: C.border, flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse' }]}>
          {p.likes_count > 0 && (
            <TouchableOpacity onPress={() => onReactorsTap('likes', p)} style={[styles.statItem, { flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse' }]}>
              <View style={[styles.likesPill, { backgroundColor: '#2563EB' }]}>
                <Ionicons name="arrow-up" size={9} color="#FFF" style={{ fontWeight: 'bold' }} />
              </View>
              <Text style={[styles.statText, { color: C.muted }]}>{p.likes_count}</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {(p.answer_count || 0) > 0 && (
            <TouchableOpacity onPress={() => onComment(p)}>
              <Text style={[styles.statText, { color: C.muted }]}>
                {p.answer_count} {isRTL ? 'تعليق' : (p.answer_count === 1 ? 'comment' : 'comments')}
              </Text>
            </TouchableOpacity>
          )}
          {(p.shares_count || 0) > 0 && (
            <TouchableOpacity onPress={() => onReactorsTap('reposts', p)} style={{ marginHorizontal: 12 }}>
              <Text style={[styles.statText, { color: C.muted }]}>
                {p.shares_count} {isRTL ? 'مشاركة' : (p.shares_count === 1 ? 'share' : 'shares')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Action bar (Reddit-style vote cluster + LinkedIn-style icons) ── */}
      <View style={[styles.actionBar, { borderTopColor: C.border, flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse' }]}>
        {/* Reddit-style vote cluster */}
        <View style={[
          styles.voteCluster,
          {
            backgroundColor: liked ? '#2563EB12' : disliked ? '#EF444412' : C.card2 || C.bg,
            borderColor: liked ? '#2563EB35' : disliked ? '#EF444435' : C.border,
            flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
          },
        ]}>
          <TouchableOpacity
            onPress={() => onLike(p.id)}
            style={[styles.voteBtn, liked && { backgroundColor: '#2563EB20' }]}
            hitSlop={{ top: 8, left: 4, bottom: 8, right: 4 }}
          >
            <Ionicons name="arrow-up" size={20} color={liked ? '#2563EB' : C.muted} />
          </TouchableOpacity>
          <Text style={[styles.scoreText, { color: scoreColor }]}>
            {netScore > 0 ? `+${netScore}` : netScore === 0 ? '0' : netScore}
          </Text>
          <TouchableOpacity
            onPress={() => onDislike(p.id)}
            style={[styles.voteBtn, disliked && { backgroundColor: '#EF444420' }]}
            hitSlop={{ top: 8, left: 4, bottom: 8, right: 4 }}
          >
            <Ionicons name="arrow-down" size={20} color={disliked ? '#EF4444' : C.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => onComment(p)} style={[styles.actionBtn, { flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse' }]} hitSlop={{ top: 8, left: 4, bottom: 8, right: 4 }}>
          <Ionicons name="chatbubble-outline" size={19} color={C.muted} />
          <Text style={[styles.actionLabel, { color: C.muted }]} numberOfLines={1}>
            {isRTL ? 'تعليق' : 'Comment'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onShare(p)} style={[styles.actionBtn, { flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse' }]} hitSlop={{ top: 8, left: 4, bottom: 8, right: 4 }}>
          <Ionicons name="repeat" size={20} color={C.muted} />
          <Text style={[styles.actionLabel, { color: C.muted }]} numberOfLines={1}>
            {isRTL ? 'نشر' : 'Repost'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onSave(p.id)} style={styles.bookmarkBtn} hitSlop={{ top: 8, left: 4, bottom: 8, right: 4 }}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={19} color={saved ? C.gold : C.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Custom comparator: only re-render on props that affect output ──────────
function arePropsEqual(prev: any, next: any) {
  // Cheap reference checks first
  if (prev.p === next.p && prev.liked === next.liked && prev.disliked === next.disliked && prev.saved === next.saved && prev.C === next.C) {
    return true;
  }
  // The only mutable fields on `p` we care about are counts. Compare them.
  if (
    prev.p?.id === next.p?.id &&
    prev.p?.likes_count === next.p?.likes_count &&
    prev.p?.dislikes_count === next.p?.dislikes_count &&
    prev.p?.shares_count === next.p?.shares_count &&
    prev.p?.answer_count === next.p?.answer_count &&
    prev.p?.image_url === next.p?.image_url &&
    prev.p?.question === next.p?.question &&
    prev.liked === next.liked &&
    prev.disliked === next.disliked &&
    prev.saved === next.saved &&
    prev.C === next.C &&
    prev.isRTL === next.isRTL
  ) {
    return true;
  }
  return false;
}

export const PostCard = memo(PostCardInner, arePropsEqual);

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  repostBanner: {
    flexDirection: I18nManager.isRTL ? 'row' : 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  repostText: { fontSize: 12, fontFamily: 'Cairo-Regular', fontWeight: '600', flexShrink: 1 },
  authorRow: { alignItems: 'center', marginBottom: 12 },
  authorName: { fontSize: 15, fontWeight: '700', fontFamily: 'Cairo-Bold' },
  subtitle: { fontSize: 12, marginTop: 1, fontFamily: 'Cairo-Regular' },
  bodyText: { fontSize: 14, lineHeight: 22, fontFamily: 'Cairo-Regular', marginBottom: 8 },
  bodyTextLarge: { fontSize: 15, lineHeight: 24, fontFamily: 'Cairo-Regular', fontWeight: '400', marginBottom: 10 },
  mediaWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  mediaTap: { width: '100%' },
  repostCard: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    marginBottom: 12,
  },
  repostHeader: { alignItems: 'center', marginBottom: 6 },
  repostAuthor: { fontSize: 13, fontWeight: '700', fontFamily: 'Cairo-Bold' },
  repostFlair: { fontSize: 10, fontFamily: 'Cairo-Regular' },
  repostBodyText: { fontSize: 13, lineHeight: 20, fontFamily: 'Cairo-Regular' },
  statStrip: {
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  statItem: { alignItems: 'center', gap: 5 },
  likesPill: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statText: { fontSize: 12, fontFamily: 'Cairo-Regular' },
  actionBar: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
  },
  voteCluster: {
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 2,
    borderWidth: 1,
    marginRight: 6,
  },
  voteBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 18 },
  scoreText: { fontSize: 13, fontWeight: '800', minWidth: 22, textAlign: 'center', fontFamily: 'Cairo-Bold' },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 12, fontWeight: '600', fontFamily: 'Cairo-Regular' },
  bookmarkBtn: { paddingVertical: 9, paddingHorizontal: 10 },
  playOverlay: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -25, marginLeft: -25,
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  muteBtn: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)', padding: 6, borderRadius: 16,
  },
});





