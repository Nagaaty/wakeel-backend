import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { forumAPI } from '../../../src/services/api';
import { timeAgo } from '../../../src/utils/date';
import { useI18n } from '../../i18n';
import { InitialsAvatar, Btn } from '../ui';

export function CommentModal({
  post,
  onClose,
  C,
  user,
  onAnswerAdded
}: any) {
  const insets = useSafeAreaInsets();
  const { isRTL } = useI18n();
  
  const [answers, setAnswers] = useState<any[]>([]);
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [postingAnswer, setPostingAnswer] = useState(false);
  
  const [replyingTo, setReplyingTo] = useState<{ name: string; answerId: number } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [replies, setReplies] = useState<Record<number, any[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Set<number>>(new Set());
  const [likedAnswers, setLikedAnswers] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (post) {
      setAnswers([]);
      setReplyingTo(null);
      setAnswersLoading(true);
      forumAPI.getAnswers(post.id)
        .then((res: any) => setAnswers(res.answers || []))
        .catch(() => {})
        .finally(() => setAnswersLoading(false));
    }
  }, [post]);

  const toggleReplies = useCallback(async (answerId: number) => {
    if (expandedReplies.has(answerId)) {
      setExpandedReplies(prev => { const n = new Set(prev); n.delete(answerId); return n; });
    } else {
      setExpandedReplies(prev => new Set(prev).add(answerId));
      if (!replies[answerId]) {
        setLoadingReplies(prev => new Set(prev).add(answerId));
        try {
          const res: any = await forumAPI.getReplies(answerId);
          setReplies(prev => ({ ...prev, [answerId]: res.replies || [] }));
        } catch {} finally {
          setLoadingReplies(prev => { const n = new Set(prev); n.delete(answerId); return n; });
        }
      }
    }
  }, [expandedReplies, replies]);

  const submitAnswer = useCallback(async () => {
    if (!answerText.trim() || !post) return;
    const targetReplyId = replyingTo?.answerId ?? null;
    setPostingAnswer(true);
    try {
      const text = replyingTo ? `@${replyingTo.name.replace(/\s+/g, '_')} ${answerText.trim()}` : answerText.trim();
      await forumAPI.createAnswer(post.id, text, targetReplyId ?? undefined);
      setAnswerText('');
      setReplyingTo(null);

      // Reload top-level answers fresh
      const res: any = await forumAPI.getAnswers(post.id);
      setAnswers(res.answers || []);

      // If it was a reply, clear the stale cache and auto-expand so user sees their reply
      if (targetReplyId !== null) {
        setReplies(prev => { const next = { ...prev }; delete next[targetReplyId]; return next; });
        setExpandedReplies(prev => new Set(prev).add(targetReplyId));
        try {
          const repRes: any = await forumAPI.getReplies(targetReplyId);
          setReplies(prev => ({ ...prev, [targetReplyId]: repRes.replies || [] }));
        } catch {}
      }

      onAnswerAdded && onAnswerAdded(post.id);
    } catch {} finally {
      setPostingAnswer(false);
    }
  }, [answerText, post, replyingTo, onAnswerAdded]);

  const handleLikeAnswer = useCallback(async (answerId: number) => {
    const isLiked = likedAnswers.has(answerId);
    if (isLiked) {
      setLikedAnswers(prev => { const n = new Set(prev); n.delete(answerId); return n; });
      setAnswers(prev => prev.map(a => a.id === answerId ? { ...a, likes_count: Math.max(0, (a.likes_count||1)-1) } : a));
    } else {
      setLikedAnswers(prev => new Set(prev).add(answerId));
      setAnswers(prev => prev.map(a => a.id === answerId ? { ...a, likes_count: (a.likes_count||0)+1 } : a));
    }
    try { await forumAPI.likeAnswer(answerId); }
    catch {
      if (isLiked) setLikedAnswers(prev => new Set(prev).add(answerId));
      else setLikedAnswers(prev => { const n = new Set(prev); n.delete(answerId); return n; });
    }
  }, [likedAnswers]);

  return (
    <Modal visible={!!post} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: insets.top + (Platform.OS === 'android' ? 16 : 12), paddingBottom: 12, paddingHorizontal: 16,
          backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#1A1A1A' }}>
            {isRTL ? 'التعليقات' : 'Comments'} ({post?.answer_count || 0})
          </Text>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Text style={{ color: C.text, fontSize: 32, lineHeight: 32 }}>×</Text>
          </TouchableOpacity>
        </View>

        {/* Comments List */}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {answersLoading ? (
            <ActivityIndicator size="large" color={C.gold} style={{ marginTop: 40 }} />
          ) : answers.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: C.muted, fontSize: 15 }}>{isRTL ? 'لا توجد تعليقات بعد' : 'No comments yet'}</Text>
              <Text style={{ color: C.dim, fontSize: 13, marginTop: 4 }}>{isRTL ? 'كن أول من يعلق!' : 'Be the first to comment!'}</Text>
            </View>
          ) : (
            answers.map(a => {
              const isOwn = a.user_id === user?.id || a.lawyer_id === user?.id;
              return (
                <View key={a.id} style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                  {/* Avatar */}
                  <InitialsAvatar name={a.lawyer_name || a.user_name} uri={a.lawyer_avatar || undefined} size={36} gold={a.is_accepted ? C.gold : C.card2} />

                  {/* Bubble */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>{a.lawyer_name || a.user_name || 'مستخدم'}</Text>
                      {a.is_accepted && (
                        <View style={{ backgroundColor: C.gold + '20', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
                          <Text style={{ color: C.gold, fontSize: 10, fontWeight: '800' }}>✔️ مقبول</Text>
                        </View>
                      )}
                    </View>

                    <View style={{
                      backgroundColor: isOwn ? C.gold + '18' : '#F0F2F5',
                      borderRadius: 16, borderTopRightRadius: 4, padding: 12,
                      borderWidth: 1, borderColor: a.is_accepted ? C.gold + '50' : 'transparent',
                    }}>
                      <Text style={{ color: C.text, fontSize: 14, lineHeight: 22, textAlign: 'right' }}>{a.answer}</Text>
                    </View>

                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 16, marginTop: 4, paddingHorizontal: 4 }}>
                      <Text style={{ color: C.muted, fontSize: 10 }}>{timeAgo(a.created_at)}</Text>
                      <TouchableOpacity onPress={() => handleLikeAnswer(a.id)}
                        style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }}>
                        <Text style={{ fontSize: 13, color: likedAnswers.has(a.id) ? '#FF4500' : '#888' }}>
                          {likedAnswers.has(a.id) ? '❤️' : '♡'}
                        </Text>
                        {(a.likes_count || 0) > 0 && <Text style={{ fontSize: 11, color: likedAnswers.has(a.id) ? '#FF4500' : '#888', fontWeight: '700' }}>{a.likes_count}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setReplyingTo({ name: a.lawyer_name || a.user_name || 'مستخدم', answerId: a.id })}
                        style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }}>
                        <Text style={{ fontSize: 12, color: '#0A66C2', fontWeight: '700' }}>رد</Text>
                        <Text style={{ fontSize: 13, color: '#0A66C2' }}>↩️</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Replies */}
                    {(a.reply_count > 0 || expandedReplies.has(a.id)) && (
                      <View style={{ marginTop: 8 }}>
                        {a.reply_count > 0 && !expandedReplies.has(a.id) && (
                          <TouchableOpacity onPress={() => toggleReplies(a.id)}
                            style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 4 }}>
                            <Text style={{ color: '#0A66C2', fontSize: 12, fontWeight: '700' }}>↳ عرض {a.reply_count} رد</Text>
                          </TouchableOpacity>
                        )}
                        {expandedReplies.has(a.id) && (
                          loadingReplies.has(a.id) ? <ActivityIndicator size="small" color={C.gold} /> : (
                            <View style={{ paddingRight: 12, borderRightWidth: 2, borderRightColor: '#0A66C240', marginTop: 4, gap: 10 }}>
                              {(replies[a.id] || []).map((rep: any) => (
                                <View key={rep.id} style={{ flexDirection: 'row-reverse', gap: 8, alignItems: 'flex-start' }}>
                                  <InitialsAvatar name={rep.lawyer_name || rep.user_name} uri={rep.lawyer_avatar || undefined} size={28} gold={C.card2} />
                                  <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                                      <Text style={{ fontSize: 12, fontWeight: '800', color: C.text }}>{rep.lawyer_name || rep.user_name}</Text>
                                      <Text style={{ fontSize: 10, color: '#0A66C2', fontWeight: '700' }}>@{a.lawyer_name || a.user_name}</Text>
                                    </View>
                                    <View style={{ backgroundColor: '#F0F2F5', borderRadius: 12, borderTopRightRadius: 3, padding: 9 }}>
                                      <Text style={{ color: C.text, fontSize: 13, textAlign: 'right', lineHeight: 20 }}>{rep.answer}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 3 }}>
                                      <Text style={{ color: C.muted, fontSize: 10 }}>{timeAgo(rep.created_at)}</Text>
                                      <TouchableOpacity onPress={() => handleLikeAnswer(rep.id)}
                                        style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }}>
                                        <Text style={{ fontSize: 12, color: likedAnswers.has(rep.id) ? '#FF4500' : '#888' }}>
                                          {likedAnswers.has(rep.id) ? '❤️' : '♡'}
                                        </Text>
                                        {(rep.likes_count || 0) > 0 && <Text style={{ fontSize: 10, color: likedAnswers.has(rep.id) ? '#FF4500' : '#888' }}>{rep.likes_count}</Text>}
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Input Bar */}
        <View style={{
          backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F0F0F0',
          paddingHorizontal: 16, paddingVertical: 10, paddingBottom: insets.bottom + 10,
        }}>
          {replyingTo && (
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0F2F5', padding: 8, borderRadius: 8, marginBottom: 8 }}>
              <Text style={{ color: C.text, fontSize: 12, fontWeight: '600' }}>
                {isRTL ? `ترد على: ${replyingTo.name}` : `Replying to: ${replyingTo.name}`}
              </Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}><Text style={{ color: C.muted, fontSize: 16, fontWeight: '700' }}>×</Text></TouchableOpacity>
            </View>
          )}
          <View style={{ flexDirection: 'row-reverse', gap: 8, alignItems: 'center' }}>
            <TextInput
              value={answerText} onChangeText={setAnswerText}
              placeholder={isRTL ? "اكتب تعليقك..." : "Write a comment..."} placeholderTextColor={C.muted}
              multiline style={{
                flex: 1, backgroundColor: '#F5F6F8', borderRadius: 20, paddingHorizontal: 16,
                paddingVertical: 10, maxHeight: 100, fontSize: 15, color: '#1A1A1A', textAlign: 'right'
              }}
            />
            <TouchableOpacity onPress={submitAnswer} disabled={!answerText.trim() || postingAnswer}
              style={{
                width: 44, height: 44, borderRadius: 22, backgroundColor: answerText.trim() ? '#0A66C2' : '#E0E0E0',
                alignItems: 'center', justifyContent: 'center'
              }}>
              {postingAnswer ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ fontSize: 18, transform: [{ rotateY: '180deg' }] }}>🚀</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
