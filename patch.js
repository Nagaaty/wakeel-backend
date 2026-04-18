const fs = require('fs');

let code = fs.readFileSync('mobile/app/(tabs)/forum.tsx', 'utf8');

// 1. Imports
code = code.replace(
  "import * as DocumentPicker from 'expo-document-picker';",
  "import * as DocumentPicker from 'expo-document-picker';\nimport HashtagText from '../../src/components/HashtagText';\nimport { useForumSocket } from '../../src/hooks/useForumSocket';"
);

// 2. States
code = code.replace(
  "const [replyingTo, setReplyingTo]     = useState<{ name: string; answerId: number } | null>(null);",
  `const [replyingTo, setReplyingTo]     = useState<{ name: string; answerId: number } | null>(null);
  // Nested comments state
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());
  const [replies, setReplies] = useState<Record<number, any[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Set<number>>(new Set());`
);

// 3. Socket replacing polling
code = code.replace(
  /useEffect\(\(\) => \{\n\s*loadPosts\(\);\n\s*\/\/ ── Polling: silently refresh counts every 30 seconds[\s\S]*?return \(\) => clearInterval\(poll\);\n\s*\}, \[\]\);/,
  `useForumSocket({
    onLike: ({ postId, likes_count }) => {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count } : p));
    },
    onComment: ({ postId, answer }) => {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, answer_count: (p.answer_count || 0) + 1 } : p));
      if (commentPost?.id === postId) {
        if (!answer.parent_answer_id) {
          setAnswers(prev => [answer, ...prev]);
        } else {
          setReplies(prev => ({ ...prev, [answer.parent_answer_id]: [...(prev[answer.parent_answer_id] || []), answer] }));
        }
      }
    },
    onNewPost: ({ post }) => {
      setPosts(prev => {
        if (prev.some(p => p.id === post.id)) return prev;
        return [post, ...prev];
      });
    },
    onShare: ({ postId, shares_count }) => {
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, shares_count } : p));
    }
  });

  useEffect(() => {
    loadPosts();
  }, []);`
);

// 4. openComments
code = code.replace(
  /const openComments = async \(post: any\) => \{[\s\S]*?finally \{ setAnswersLoading\(false\); \}\n\s*\};/,
  `const openComments = async (post: any) => {
    setCommentPost(post);
    setAnswers([]);
    setAnswerText('');
    setReplyingTo(null);
    setExpandedReplies(new Set());
    setReplies({});
    setAnswersLoading(true);
    try {
      const res: any = await forumAPI.getAnswers(post.id);
      setAnswers(res.answers || []);
    } catch {} finally { setAnswersLoading(false); }
  };
  
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
  };`
);

// 5. submitAnswer
code = code.replace(
  /await forumAPI\.createAnswer\(commentPost\.id, text\);/,
  `await forumAPI.createAnswer(commentPost.id, text, replyingTo?.answerId);\n      if (replyingTo) { toggleReplies(replyingTo.answerId); }`
);

// 6. Post Text -> HashtagText inside map (p.question)
code = code.replace(
  /<Text style=\{\{\n\s*paddingHorizontal: 16, paddingBottom: isRepost \? 10 : \(p\.image_url \? 10 : 14\),\n\s*fontSize: 15, lineHeight: 24, color: '#1A1A1A',\n\s*textAlign: 'right',\n\s*\}\}>\n\s*\{p\.question\}\n\s*<\/Text>/,
  `<HashtagText
                      text={p.question}
                      goldColor="#0A66C2"
                      style={{
                        paddingHorizontal: 16, paddingBottom: isRepost ? 10 : (p.image_url ? 10 : 14),
                        fontSize: 15, lineHeight: 24, color: '#1A1A1A',
                        textAlign: 'right',
                      }}
                    />`
);

// 7. Original Post Quoted text
code = code.replace(
  /<Text style=\{\{\n\s*padding: 10, paddingTop: 8,\n\s*fontSize: 14, lineHeight: 22, color: '#1A1A1A', textAlign: 'right',\n\s*\}\} numberOfLines=\{5\}>\n\s*\{cleanText\}\n\s*<\/Text>/,
  `<HashtagText
                          text={cleanText}
                          numberOfLines={5}
                          goldColor="#0A66C2"
                          style={{
                            padding: 10, paddingTop: 8,
                            fontSize: 14, lineHeight: 22, color: '#1A1A1A', textAlign: 'right',
                          }}
                        />`
);

// 8. Nested replies render inside Comment modal FlatList
const replyComponent = `<View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 14, marginTop: 4, paddingHorizontal: 4 }}>
                      <Text style={{ color: C.muted, fontSize: 11 }}>{timeAgo(a.created_at)}</Text>
                      <TouchableOpacity onPress={() => handleLikeAnswer(a.id)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 14, color: likedAnswers.has(a.id) ? '#0A66C2' : '#888' }}>{likedAnswers.has(a.id) ? '👍' : '🤍'}</Text>
                        {(a.likes_count || 0) > 0 && <Text style={{ fontSize: 11, color: likedAnswers.has(a.id) ? '#0A66C2' : '#888', fontWeight: '600' }}>{a.likes_count}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setReplyingTo({ name: a.lawyer_name || 'محامٍ', answerId: a.id })} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 13, color: '#888' }}>↩️</Text>
                        <Text style={{ fontSize: 12, color: '#888', fontWeight: '600' }}>رد</Text>
                      </TouchableOpacity>
                    </View>
                    {(a.reply_count > 0 || expandedReplies.has(a.id)) && (
                      <View style={{ marginTop: 8 }}>
                        {a.reply_count > 0 && !expandedReplies.has(a.id) && (
                           <TouchableOpacity onPress={() => toggleReplies(a.id)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                             <Text style={{ color: C.gold, fontSize: 13, fontWeight: '700' }}>⤿ عرض {a.reply_count} ردود</Text>
                           </TouchableOpacity>
                        )}
                        {expandedReplies.has(a.id) && (
                          loadingReplies.has(a.id) ? <ActivityIndicator size="small" color={C.gold} /> :
                          <View style={{ gap: 12, paddingRight: 10, borderRightWidth: 2, borderColor: C.border, marginTop: 4 }}>
                            {(replies[a.id] || []).map((rep: any) => (
                              <View key={rep.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: C.muted }}>{(rep.lawyer_name || 'م').substring(0, 2).toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <View style={{ backgroundColor: '#F0F2F5', borderRadius: 14, borderTopLeftRadius: 4, padding: 10 }}>
                                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 12, marginBottom: 4 }}>{rep.lawyer_name}</Text>
                                    <Text style={{ color: C.text, fontSize: 13, textAlign: 'right' }}>{rep.answer}</Text>
                                  </View>
                                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 4 }}>
                                    <Text style={{ color: C.muted, fontSize: 10 }}>{timeAgo(rep.created_at)}</Text>
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

fs.writeFileSync('mobile/app/(tabs)/forum.tsx', code);
console.log('Applied script replacements');
