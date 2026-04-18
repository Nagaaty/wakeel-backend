const fs = require('fs');

let code = fs.readFileSync('mobile/app/post/[id].tsx', 'utf8');

// 1. Imports
code = code.replace(
  "import { forumAPI } from '../../src/services/api';",
  "import { forumAPI } from '../../src/services/api';\nimport HashtagText from '../../src/components/HashtagText';\nimport { useForumSocket } from '../../src/hooks/useForumSocket';"
);

// 2. States
code = code.replace(
  "const [replyingTo, setReplyingTo] = useState<{ name: string; answerId: number } | null>(null);",
  `const [replyingTo, setReplyingTo] = useState<{ name: string; answerId: number } | null>(null);
  // Nested comments state
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [replies, setReplies] = useState<Record<number, any[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Set<number>>(new Set());`
);

// 3. Socket replacing polling (if any). If not, just append the socket hook before loadPost
// Let's just prepend it to `const loadPost = ...`
code = code.replace(
  /const loadPost = useCallback\(async \(\) => \{/,
  `// ── Real-time Socket Events
  useForumSocket({
    onLike: ({ postId, likes_count }) => {
      if (post?.id === postId) {
        setPost((prev: any) => ({ ...prev, likes_count }));
        setLikeCount(likes_count);
      }
    },
    onComment: ({ postId, answer }) => {
      if (post?.id === postId) {
        setPost((prev: any) => ({ ...prev, answer_count: (prev.answer_count || 0) + 1 }));
        if (!answer.parent_answer_id) {
          setAnswers((prev: any) => [answer, ...prev]);
        } else {
          setReplies((prev: any) => ({ ...prev, [answer.parent_answer_id]: [...(prev[answer.parent_answer_id] || []), answer] }));
        }
      }
    },
    onShare: ({ postId, shares_count }) => {
      if (post?.id === postId) {
        setPost((prev: any) => ({ ...prev, shares_count }));
      }
    }
  });

  const toggleReplies = async (answerId: number) => {
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
  };

  const loadPost = useCallback(async () => {`
);

// 4. submitAnswer uses replyingTo
code = code.replace(
  /await forumAPI\.createAnswer\(id, answerText\.trim\(\)\);/,
  `await forumAPI.createAnswer(id, answerText.trim(), replyingTo?.answerId);
      if (replyingTo) { toggleReplies(replyingTo.answerId); }`
);

// 5. Post Text -> HashtagText
code = code.replace(
  /<Text\n\s*style=\{\{\n\s*marginTop: 14,\n\s*fontSize: 16, lineHeight: 26, color: '#1A1A1A', textAlign: 'right',\n\s*\}\}\n\s*>\n\s*\{post\.question\}\n\s*<\/Text>/,
  `<HashtagText
                    text={post.question}
                    goldColor="#0A66C2"
                    style={{
                      marginTop: 14,
                      fontSize: 16, lineHeight: 26, color: '#1A1A1A', textAlign: 'right',
                    }}
                  />`
);

// 6. Original Quoted Text
code = code.replace(
  /<Text style=\{\{\n\s*padding: 12, paddingTop: 8,\n\s*fontSize: 14, lineHeight: 22, color: '#1A1A1A', textAlign: 'right',\n\s*\}\} numberOfLines=\{6\}>\n\s*\{cleanText\}\n\s*<\/Text>/,
  `<HashtagText
                            text={cleanText}
                            numberOfLines={6}
                            goldColor="#0A66C2"
                            style={{
                              padding: 12, paddingTop: 8,
                              fontSize: 14, lineHeight: 22, color: '#1A1A1A', textAlign: 'right',
                            }}
                          />`
);

// 7. Nested replies render
const replyComponent = `<View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, marginTop: 4, paddingHorizontal: 4 }}>
                      <Text style={{ color: '#888', fontSize: 11 }}>{timeAgo(ans.created_at)}</Text>
                      <TouchableOpacity onPress={() => handleLikeAnswer(ans.id)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 14, color: likedAnswers.has(ans.id) ? '#0A66C2' : '#888' }}>{likedAnswers.has(ans.id) ? '👍' : '🤍'}</Text>
                        {(ans.likes_count || 0) > 0 && <Text style={{ fontSize: 11, color: likedAnswers.has(ans.id) ? '#0A66C2' : '#888', fontWeight: '600' }}>{ans.likes_count}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setReplyingTo({ name: ans.lawyer_name || 'محامٍ', answerId: ans.id })} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 13, color: '#888' }}>↩️</Text>
                        <Text style={{ fontSize: 12, color: '#888', fontWeight: '600' }}>رد</Text>
                      </TouchableOpacity>
                    </View>
                    {(ans.reply_count > 0 || expandedReplies.has(ans.id)) && (
                      <View style={{ marginTop: 8 }}>
                        {ans.reply_count > 0 && !expandedReplies.has(ans.id) && (
                           <TouchableOpacity onPress={() => toggleReplies(ans.id)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                             <Text style={{ color: C.gold, fontSize: 13, fontWeight: '700' }}>⤿ عرض {ans.reply_count} ردود</Text>
                           </TouchableOpacity>
                        )}
                        {expandedReplies.has(ans.id) && (
                          loadingReplies.has(ans.id) ? <ActivityIndicator size="small" color={C.gold} /> :
                          <View style={{ gap: 12, paddingRight: 10, borderRightWidth: 2, borderColor: C.border, marginTop: 4 }}>
                            {(replies[ans.id] || []).map((rep: any) => (
                              <View key={rep.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: C.muted }}>{(rep.lawyer_name || 'م').substring(0, 2).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View style={{ backgroundColor: '#F0F2F5', borderRadius: 14, borderTopLeftRadius: 4, padding: 10 }}>
                                    <Text style={{ color: '#1A1A1A', fontWeight: '700', fontSize: 12, marginBottom: 4 }}>{rep.lawyer_name}</Text>
                                    <Text style={{ color: '#1A1A1A', fontSize: 13, textAlign: 'right' }}>{rep.answer}</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 4 }}>
                                    <Text style={{ color: '#888', fontSize: 10 }}>{timeAgo(rep.created_at)}</Text>
                                    <TouchableOpacity onPress={() => handleLikeAnswer(rep.id)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                                      <Text style={{ fontSize: 12, color: likedAnswers.has(rep.id) ? '#0A66C2' : '#888' }}>{likedAnswers.has(rep.id) ? '👍' : '🤍'}</Text>
                                      {(rep.likes_count || 0) > 0 && <Text style={{ fontSize: 10, color: likedAnswers.has(rep.id) ? '#0A66C2' : '#888' }}>{rep.likes_count}</Text>}
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}`;
code = code.replace(
  /<View style=\{\{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, marginTop: 4, paddingHorizontal: 4 \}\}>[\s\S]*?<\/View>\n\s*<\/View>/,
  replyComponent + '\n                  </View>'
);

fs.writeFileSync('mobile/app/post/[id].tsx', code);
console.log('Applied script replacements on post/[id]');
