import React, { memo } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, DeviceEventEmitter } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { timeAgo } from '../../utils/date';
import { Video, ResizeMode } from 'expo-av';

function isVideoUrl(url: string) {
  if (!url) return false;
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm') || lower.endsWith('.m4v');
}

function UserAvatar({ name, uri, size = 44, gold }: { name?: string; uri?: string; size?: number; gold: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: gold + '20' }}
      />
    );
  }
  const ini = (name || '؟')
    .split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: gold + '25',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: gold, fontWeight: '800', fontSize: size * 0.38, fontFamily: 'Cairo-Bold' }}>{ini}</Text>
    </View>
  );
}

export function AutoSizingImage({ uri }: { uri: string }) {
  const [aspectRatio, setAspectRatio] = React.useState(1);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    Image.getSize(uri, (width, height) => {
      if (width && height) {
        // dynamically adjust the container to flawlessly match the full image
        // Cap extreme vertical heights at 4:5 (0.8) to prevent viewport hijacking, Facebook style
        setAspectRatio(Math.max(0.8, width / height));
      }
      setLoaded(true);
    }, () => setLoaded(true)); // fallback if error
  }, [uri]);

  return (
    <Image 
      source={{ uri }} 
      style={{ width: '100%', aspectRatio, backgroundColor: '#f3f4f6', opacity: loaded ? 1 : 0.5 }} 
      resizeMode="cover" 
    />
  );
}

function VideoInPost({ uri, postId, onVideoTap }: { uri: string, postId?: number, onVideoTap?: () => void }) {
  const [status, setStatus] = React.useState<any>(null);
  const [isMuted, setIsMuted] = React.useState(true);
  const videoRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (!postId) return;
    const sub = DeviceEventEmitter.addListener('visible_posts', (visibleIds: number[]) => {
      if (!visibleIds.includes(postId) && videoRef.current) {
        videoRef.current.pauseAsync();
      }
    });
    return () => sub.remove();
  }, [postId]);

  return (
    <View style={{ width: '100%', height: 320, backgroundColor: '#0a0a0a', position: 'relative' }}>
      {/* LinkedIn/FB pattern: Tapping video directly opens Immersive Viewer */}
      <TouchableOpacity activeOpacity={0.95} style={{ flex: 1 }} onPress={onVideoTap}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted={isMuted}
          shouldPlay
          onPlaybackStatusUpdate={s => setStatus(() => s)}
        />
        
        {status?.isLoaded && !status.isPlaying && (
          <View style={{
            position: 'absolute', top: '50%', left: '50%',
            marginTop: -25, marginLeft: -25,
            width: 50, height: 50, borderRadius: 25,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center', alignItems: 'center'
          }}>
            <Ionicons name="play" size={28} color="#FFF" style={{ marginLeft: 3 }} />
          </View>
        )}
      </TouchableOpacity>

      {/* Mute Toggle */}
      <TouchableOpacity 
        style={{
          position: 'absolute', bottom: 12, right: 12,
          backgroundColor: 'rgba(0,0,0,0.7)', padding: 6, borderRadius: 20
        }}
        onPress={() => setIsMuted(!isMuted)}
      >
        <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={18} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

function PostCardInner({
  p, C, user, isRTL,
  liked, disliked, saved,
  onLike, onDislike, onSave,
  onComment, onShare, onNativeShare,
  onMediaTap, onMenuTap, onReactorsTap, catStyle,
}: any) {
  const origData = p.original_post_data
    ? (typeof p.original_post_data === 'string'
        ? JSON.parse(p.original_post_data)
        : p.original_post_data)
    : null;
  const isRepost = !!origData;
  const netScore = (p.likes_count || 0) - (p.dislikes_count || 0);
  const scoreColor = liked ? '#FF4500' : disliked ? '#7193FF' : C.text;

  const navigateToProfile = () => {
    if (p.user_id === user?.id) {
      router.push(user?.role === 'lawyer' ? '/(lawyer-tabs)/profile' : '/(tabs)/profile' as any);
    } else if (p.user_role === 'lawyer') {
      router.push({ pathname: '/lawyer/[id]', params: { id: p.user_id } } as any);
    } else {
      router.push({ pathname: '/user/[id]', params: { id: p.user_id } } as any);
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>

        {/* Repost banner */}
        {isRepost && (
          <View style={[styles.repostBanner]}>
            <Ionicons name="repeat" size={13} color={C.muted} />
            <Text style={[styles.repostText, { color: C.muted }]}>{p.asked_by || 'مستخدم'} أعاد النشر</Text>
          </View>
        )}

        {/* ── Author row ── */}
        <View style={styles.authorRow}>
          <TouchableOpacity onPress={navigateToProfile}>
            <UserAvatar name={p.asked_by} uri={p.user_avatar_url || undefined} size={40} gold={C.gold} />
          </TouchableOpacity>

          <TouchableOpacity style={{ flex: 1, alignItems: 'flex-end' }} onPress={navigateToProfile}>
            <View style={styles.authorMeta}>
              <Text style={[styles.authorName, { color: C.text }]}>{p.asked_by || 'مستخدم'}</Text>
              {p.user_flair ? (
                <View style={[styles.badge, { backgroundColor: C.gold + '18', borderColor: C.gold + '30', borderWidth: 1 }]}>
                  <Text style={[styles.badgeText, { color: C.gold }]}>{p.user_flair}</Text>
                </View>
              ) : p.user_role === 'lawyer' && (
                <View style={[styles.badge, { backgroundColor: C.gold + '18', borderColor: C.gold + '30', borderWidth: 1 }]}>
                  <Text style={[styles.badgeText, { color: C.gold }]}>⚖️ محامٍ</Text>
                </View>
              )}
              {p.category && (
                <View style={[styles.badge, { backgroundColor: catStyle(p.category).bg }]}>
                  <Text style={[styles.badgeText, { color: catStyle(p.category).text }]}>{p.category}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.timestamp, { color: C.muted }]}>{timeAgo(p.created_at)}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onMenuTap(p)} style={styles.menuBtn} hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color={C.muted} />
          </TouchableOpacity>
        </View>

        {/* ── Post body ── */}
        <TouchableOpacity activeOpacity={0.95} onPress={() => onComment(p)} style={styles.body}>
          {isRepost ? (
            p.question && p.question !== 'مشاركة' ? (
              <Text style={[styles.bodyText, { color: C.text }]}>{p.question}</Text>
            ) : null
          ) : (
            <Text style={[styles.bodyTextLarge, { color: C.text }]}>{p.question}</Text>
          )}



          </TouchableOpacity>

          {/* Moved Image OUTSIDE body to make it edge-to-edge */}
          {!isRepost && p.image_url && (
            isVideoUrl(p.image_url) ? (
              <VideoInPost uri={p.image_url} postId={p.id} onVideoTap={() => onMediaTap(p)} />
            ) : (
              <TouchableOpacity onPress={() => onMediaTap(p)} activeOpacity={0.95} style={styles.imageTap}>
                <AutoSizingImage uri={p.image_url} />
              </TouchableOpacity>
            )
          )}

          <View style={styles.body}>
          {isRepost && (
            <View style={[styles.repostCard, { borderColor: C.border, backgroundColor: 'transparent' }]}>
              {/* Comment Navigation Trigger */}
              <TouchableOpacity activeOpacity={0.88} onPress={() => onComment(p)}>
                <View style={[styles.repostCardHeader, { paddingHorizontal: 12, paddingTop: 10, paddingBottom: origData.question ? 4 : 10 }]}>
                  <UserAvatar name={origData.authorName || 'م'} uri={origData.authorAvatar || origData.user_avatar_url || undefined} size={24} gold={C.gold} />
                  <View style={{ flex: 1, alignItems: 'flex-end', marginRight: 8 }}>
                    <Text style={[styles.repostAuthor, { color: C.text }]}>{origData.authorName || 'مستخدم'}</Text>
                    {origData.authorRole === 'lawyer' && (
                      <Text style={[styles.repostFlair, { color: C.gold }]}>⚖️ محامٍ</Text>
                    )}
                  </View>
                </View>
                {origData.question ? <Text style={[styles.repostBodyText, { color: C.text, paddingHorizontal: 12, paddingBottom: 10 }]} numberOfLines={4}>{origData.question}</Text> : null}
              </TouchableOpacity>
              
              {/* Media Isolation (Facebook edge-to-edge) */}
              {origData.image_url && (
                <View style={{ width: '100%', overflow: 'hidden', borderBottomLeftRadius: 11, borderBottomRightRadius: 11, borderTopWidth: 1, borderTopColor: C.border }}>
                  {isVideoUrl(origData.image_url) ? (
                    <VideoInPost uri={origData.image_url} postId={p.id} onVideoTap={() => onMediaTap({ ...p, image_url: origData.image_url })} />
                  ) : (
                    <TouchableOpacity onPress={() => onMediaTap({ ...p, image_url: origData.image_url })} activeOpacity={0.95}>
                      <AutoSizingImage uri={origData.image_url} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Stats bar ── */}
        {(p.likes_count > 0 || (p.shares_count || 0) > 0 || (p.answer_count || 0) > 0) && (
          <View style={[styles.statsBar, { borderTopColor: C.border }]}>
            {p.likes_count > 0 && (
              <View style={styles.statItem}>
                <Ionicons name="arrow-up-circle" size={14} color="#FF4500" />
                <Text style={[styles.statText, { color: C.muted }]}>{p.likes_count}</Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            {(p.answer_count || 0) > 0 && (
              <TouchableOpacity onPress={() => onComment(p)} style={styles.statItem}>
                <Text style={[styles.statText, { color: C.muted }]}>
                  {p.answer_count} {isRTL ? 'تعليق' : 'comments'}
                </Text>
              </TouchableOpacity>
            )}
            {(p.shares_count || 0) > 0 && (
              <TouchableOpacity onPress={() => onReactorsTap('reposts', p)} style={[styles.statItem, { marginLeft: 12 }]}>
                <Text style={[styles.statText, { color: C.muted }]}>{p.shares_count} مشاركة</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Action bar ── */}
        <View style={[styles.actionBar, { borderTopColor: C.border }]}>

          {/* Vote cluster */}
          <View style={[styles.voteCluster, { backgroundColor: liked ? '#FF450012' : disliked ? '#7193FF12' : C.card2, borderColor: liked ? '#FF450035' : disliked ? '#7193FF35' : C.border }]}>
            <TouchableOpacity
              onPress={() => onLike(p.id)}
              style={[styles.voteBtn, liked && { backgroundColor: '#FF450020' }]}
              hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
              <Ionicons name="arrow-up" size={22} color={liked ? '#FF4500' : C.muted} />
            </TouchableOpacity>
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {netScore > 0 ? `+${netScore}` : netScore}
            </Text>
            <TouchableOpacity
              onPress={() => onDislike(p.id)}
              style={[styles.voteBtn, disliked && { backgroundColor: '#7193FF20' }]}
              hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
              <Ionicons name="arrow-down" size={22} color={disliked ? '#7193FF' : C.muted} />
            </TouchableOpacity>
          </View>

          {/* Comment */}
          <TouchableOpacity onPress={() => onComment(p)} style={styles.actionBtn}
            hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
            <Ionicons name="chatbubble-outline" size={22} color={C.muted} />
            <Text style={[styles.actionLabel, { color: C.muted }]}>
              {(p.answer_count || 0) > 0 ? p.answer_count : 'تعليق'}
            </Text>
          </TouchableOpacity>

          {/* Repost */}
          <TouchableOpacity onPress={() => onShare(p)} style={styles.actionBtn}
            hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
            <Ionicons name="repeat" size={24} color={C.muted} />
            <Text style={[styles.actionLabel, { color: C.muted }]}>نشر</Text>
          </TouchableOpacity>



          {/* Save */}
          <TouchableOpacity onPress={() => onSave(p.id)} style={styles.actionBtn}
            hitSlop={{ top: 8, left: 8, bottom: 8, right: 8 }}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? C.gold : C.muted} />
          </TouchableOpacity>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  card: { borderTopWidth: 1, borderBottomWidth: 1 },
  repostBanner: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  repostText: { fontSize: 13, fontFamily: 'Cairo-Regular', fontWeight: '600' },
  authorRow: {
    flexDirection: 'row-reverse', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 10,
  },
  authorMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  authorName: { fontSize: 15, fontWeight: '800', fontFamily: 'Cairo-Bold' },
  badge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', fontFamily: 'Cairo-Bold' },
  timestamp: { fontSize: 12, marginTop: 2, fontFamily: 'Cairo-Regular' },
  menuBtn: { padding: 4, marginTop: 2 },
  body: { paddingHorizontal: 16, paddingBottom: 12 },
  bodyText: { fontSize: 14, lineHeight: 22, textAlign: 'right', fontFamily: 'Cairo-Regular', marginBottom: 6 },
  bodyTextLarge: { fontSize: 15, lineHeight: 24, textAlign: 'right', fontFamily: 'Cairo-Regular', fontWeight: '500', marginBottom: 8 },
  imageTap: { overflow: 'hidden', marginTop: 4, width: '100%' },
  postImage: { width: '100%', height: 350 },
  repostCard: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: 6 },
  repostCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', padding: 10 },
  repostAuthor: { fontSize: 13, fontWeight: '700', fontFamily: 'Cairo-Bold' },
  repostFlair: { fontSize: 10, fontFamily: 'Cairo-Regular' },
  repostBodyText: { fontSize: 14, lineHeight: 22, textAlign: 'right', paddingHorizontal: 10, paddingBottom: 10, fontFamily: 'Cairo-Regular' },
  repostImage: { width: '100%', height: 180 },
  statsBar: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1,
  },
  statItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, fontFamily: 'Cairo-Regular' },
  actionBar: {
    flexDirection: 'row-reverse', alignItems: 'center',
    borderTopWidth: 1, paddingHorizontal: 12, paddingVertical: 6,
    gap: 4,
  },
  voteCluster: {
    flexDirection: 'row-reverse', alignItems: 'center',
    borderRadius: 24, paddingHorizontal: 6, paddingVertical: 4,
    gap: 4, borderWidth: 1, marginLeft: 6,
  },
  voteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  scoreText: { fontSize: 13, fontWeight: '800', minWidth: 24, textAlign: 'center', fontFamily: 'Cairo-Bold' },
  actionBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, flex: 1, justifyContent: 'center',
  },
  actionLabel: { fontSize: 13, fontWeight: '700', fontFamily: 'Cairo-Regular' },
});

export const PostCard = memo(PostCardInner);
