const fs = require('fs');
let code = fs.readFileSync('mobile/app/(tabs)/forum.tsx', 'utf8');

const stateRemovalRegex = /\\s*\\/\\/ Comment modal state[\\s\\S]*?\\/\\/ Share modal state/m;
code = code.replace(stateRemovalRegex, \`
  // Comment modal state
  const [commentPost, setCommentPost]   = useState<any | null>(null);
  
  // Share modal state\`);

const tStart = '  const toggleReplies = useCallback(async (answerId: number) => {';
const submitEnd = '      setPosts(prev => prev.map(p => p.id === commentPost.id ? { ...p, answer_count: (p.answer_count || 0) + 1 } : p));\\n    } catch {} finally { setPostingAnswer(false); }\\n  }, [answerText, commentPost, replyingTo]);';

const tIdx = code.indexOf(tStart);
if (tIdx !== -1) {
   let sIdx = code.indexOf(submitEnd, tIdx);
   if (sIdx !== -1) {
       code = code.substring(0, tIdx) + code.substring(sIdx + submitEnd.length);
   }
}

const lStart = '  const handleLikeAnswer = useCallback(async (answerId: number) => {';
const lEndStr = '    }\\n  }, [likedAnswers]);';
const lIdx = code.indexOf(lStart);
if (lIdx !== -1) {
    let slIdx = code.indexOf(lEndStr, lIdx);
    if (slIdx !== -1) {
        code = code.substring(0, lIdx) + code.substring(slIdx + lEndStr.length);
    }
}

const openCStart = '  const openComments = useCallback(async (post: any) => {';
const openCEnd = '  }, []);';
const openCReplace = \`  const openComments = useCallback((post: any) => {
    setCommentPost(post);
  }, []);\`;
const oIdx = code.indexOf(openCStart);
if (oIdx !== -1) {
    let oeIdx = code.indexOf(openCEnd, oIdx);
    if (oeIdx !== -1) {
        code = code.substring(0, oIdx) + openCReplace + code.substring(oeIdx + openCEnd.length);
    }
}

const mStart = '      {/* ─── Comments Modal (Redesigned) ───────────────────────────── */}';
const mIdx = code.indexOf(mStart);
if (mIdx !== -1) {
    const mIdxBody = code.indexOf('<Modal visible={!!commentPost}', mIdx);
    if (mIdxBody !== -1) {
       let endMIdx = code.indexOf('</Modal>', mIdxBody);
       if (endMIdx !== -1) {
           code = code.substring(0, mIdx) + 
\`      {/* ─── Comments Modal (Redesigned Component) ─────────────────── */}
      <CommentModal
        post={commentPost}
        onClose={() => setCommentPost(null)}
        C={C}
        user={user}
        onAnswerAdded={(postId) => {
          setPosts(prev => prev.map(p => p.id === postId ? { ...p, answer_count: (p.answer_count || 0) + 1 } : p));
        }}
      />\\n\` + code.substring(endMIdx + '</Modal>'.length);
       }
    }
}

code = code.replace(
  "import { PostCard } from '../../src/components/forum/PostCard';",
  "import { PostCard } from '../../src/components/forum/PostCard';\\nimport { CommentModal } from '../../src/components/forum/CommentModal';"
);

fs.writeFileSync('mobile/app/(tabs)/forum.tsx', code);
console.log('Script removed states successfully.');
