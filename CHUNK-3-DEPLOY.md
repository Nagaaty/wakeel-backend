# Wakeel — Chunk 3c (Forum: Realtime + Cross-Feature Integration)

This is the third and final forum sub-chunk. After 3a (perf + visual) and
3b (search + hashtags), **3c makes the forum feel alive** and ties it into
the rest of the app.

## What this delivers

1. **"X new posts" pill** at the top of the feed (Twitter-style). When
   someone else posts while you're scrolling, the feed doesn't shift — a
   gold pill drops down saying "↑ 3 new posts". Tap it to inject and
   scroll to top.
2. **Live socket updates everywhere** — likes, comments, reposts, new
   posts all stream in via WebSocket. Already worked from earlier chunks;
   3c changes the *new post* behavior from "auto-inject" to "buffer + pill".
3. **Live notification bell badge** — the 🔔 tab gets a red badge that
   updates without refresh whenever you receive a forum notification.
4. **User profile "Posts" tab** — `/user/[id]` now has About + Posts tabs.
   Posts tab shows their forum activity.
5. **"Ask this lawyer" CTA** — a drop-in `AskLawyerButton` component for
   lawyer profiles. Tap → opens the forum compose modal with
   `@LawyerName ` pre-filled.
6. **Notification deep-links scroll to comment** — when a notification is
   tagged with `commentId`, tapping it now scrolls the post detail page
   to that exact comment and briefly highlights it gold.

## What's in the zip

```
backendV3/src/routes/
├── forum.js                                     ← UPDATED (emit notification:new + commentId in links)
└── users.js                                     ← from Chunk 3b, unchanged

mobileV3/src/services/
└── api.ts                                       ← from Chunk 3b, unchanged

mobileV3/src/hooks/
└── useUnreadNotifs.ts                           ← NEW

mobileV3/src/components/
├── CachedImage.tsx                              ← from Chunk 3a, unchanged
└── forum/
    ├── PostCard.tsx                             ← from Chunk 3b, unchanged
    ├── PostSkeleton.tsx                         ← from Chunk 3a, unchanged
    ├── ForumSearchBar.tsx                       ← from Chunk 3b, unchanged
    ├── HashtagSuggestions.tsx                   ← from Chunk 3b, unchanged
    ├── NewPostsPill.tsx                         ← NEW
    ├── AskLawyerButton.tsx                      ← NEW (drop-in for lawyer/[id])
    └── LawyerPostsTab.tsx                       ← NEW (drop-in for lawyer/[id])

mobileV3/app/
├── (tabs)/
│   ├── _layout.tsx                              ← UPDATED (bell badge)
│   └── forum.tsx                                ← UPDATED (pill, askLawyer deep-link)
├── user/[id].tsx                                ← REWRITTEN (About / Posts tabs)
└── post/[id].tsx                                ← UPDATED (commentId scroll-to)
```

15 files total. 4 changed, 3 new, 8 carried forward unchanged from 3a/3b.

## ⚠️ Manual integration step required

I deliberately did NOT overwrite `mobileV3/app/lawyer/[id].tsx` because
your Chunk 2.1 deploy added the office map preview, real per-type pricing,
and other lawyer-profile customizations to that file, and I don't have the
post-2.1 version in my workspace. **Touching it would risk regressing
those features.**

Instead, I shipped two drop-in components — `LawyerPostsTab` and
`AskLawyerButton` — and you wire them into the file yourself.

### How to wire them (5 minutes)

Open `mobileV3/app/lawyer/[id].tsx` and make these three small changes:

**1. Add imports at the top:**
```tsx
import { LawyerPostsTab }   from '../../src/components/forum/LawyerPostsTab';
import { AskLawyerButton }  from '../../src/components/forum/AskLawyerButton';
```

**2. Add `'posts'` to the tab list (around line 129 / 286):**
```tsx
// CHANGE this useState type
const [tab, setTab] = useState<'about' | 'experience' | 'reviews' | 'cv' | 'availability' | 'posts'>('about');

// CHANGE the tabs map array
{(['about', 'experience', 'reviews', 'cv', 'availability', 'posts'] as const).map(t => (
  <TouchableOpacity key={t} onPress={() => setTab(t)}
    style={{ flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: tab === t ? C.surface : 'transparent', alignItems: 'center' }}>
    <Text style={{ color: tab === t ? C.text : C.muted, fontSize: 13, fontWeight: tab === t ? '700' : '400' }}>
      {t === 'about'        ? 'نبذة'
       : t === 'experience' ? 'الخبرة'
       : t === 'reviews'    ? 'تقييمات'
       : t === 'cv'         ? 'السيرة'
       : t === 'availability' ? 'المواعيد'
       : 'منشورات'}
    </Text>
  </TouchableOpacity>
))}
```

**3. Add the new tab content body anywhere alongside the other `tab === '...'` blocks:**
```tsx
{tab === 'posts' && (
  <LawyerPostsTab userId={lawyer.id} />
)}
```

**4. Add the "Ask this lawyer" CTA** — anywhere on the profile, but a
common spot is right next to the existing "Book Now" bottom CTA:
```tsx
<AskLawyerButton lawyerName={lawyer.name} style={{ marginTop: 8 }} />
```

That's it. No other lawyer-profile code needs to change.

## Deploy steps

### 1 — drop files into Antigravity, commit, push

```bash
cd backendV3
git add src/routes/forum.js src/routes/users.js
git commit -m "feat: emit notification:new sockets + commentId in deep-links"
git push origin main
```

Render auto-deploys. **No migration needed for Chunk 3c.**

### 2 — manually wire LawyerPostsTab + AskLawyerButton in lawyer/[id].tsx

Per the instructions above. Roughly 5 minutes.

### 3 — restart Metro

```bash
cd mobileV3
npx expo start -c
```

The `-c` clears Metro cache. Without it, Metro will serve old `_layout.tsx`
and `forum.tsx` and you'll see no badge or pill.

## Test it

### A. New posts pill (Twitter-style)

You need two devices/accounts for this — one publisher, one observer.

1. On device A, open the **Forum** tab. Scroll a bit so you're not at the
   very top.
2. On device B, sign in as a different user, post a new question.
3. Within ~1 second, on device A, a gold pill should drop down at the top
   of the feed: **"↑ 1 new post"**.
4. Tap the pill. The new post is injected, the feed scrolls to top, and
   the pill disappears.
5. Repeat with device B posting 2 more times — pill should now say
   "↑ 2 new posts".
6. **Importantly**: when YOU post (on device A), the pill should NOT
   appear — your own posts are filtered out (you already see them
   optimistically when you submit).

### B. Live notification bell badge

1. Sign in on device A.
2. On device B (a different account), like or comment on one of device A's
   posts.
3. On device A, **without refreshing**, the 🔔 tab in the bottom bar
   should now show a small red badge with the count.
4. Tap the bell → notifications page opens. The badge stays until the
   notifications page resets it (via the existing read-all flow).
5. Background the app and bring it back — badge re-fetches via
   AppState focus.

### C. User profile Posts tab

1. From the forum, tap any non-lawyer user's avatar in a post.
2. Their profile opens with two tabs at the top: **About** | **Posts**.
3. Tap "Posts". You should see their forum activity (or "No posts yet"
   if they haven't posted).
4. Tap any post → opens the post detail.
5. Pull-to-refresh on the Posts tab works.

### D. "Ask this lawyer" CTA

(After you've wired the button per the manual integration step above.)

1. Open any lawyer's profile.
2. Tap the **"📢 Ask {LawyerName} publicly"** button.
3. The Forum tab opens. The compose modal is already open and the input
   contains `@LawyerName ` (with trailing space, ready for you to type
   your question).

### E. Notification deep-link scroll to comment

1. Sign in on device A.
2. Have device B comment on device A's post.
3. On device A, go to **Notifications**. Tap the comment notification.
4. The post detail opens. After a moment, the page **scrolls down to that
   exact comment**, and the comment briefly glows gold for ~2 seconds.
5. If the comment was a deeply-nested reply, the scroll might land near
   the top-level parent — that's a known limitation since replies
   collapse by default.

## Troubleshooting

**Q: Pill never appears even though my other device is posting.**
A: Likely the socket isn't connecting. Check the console:
- "🟢 Forum WebSocket Connected" → socket is fine, the bug is elsewhere
- "🔴 Forum WebSocket Disconnected" or no connect log → check that
  `WS_URL` in `useForumSocket.ts` matches your Render URL, and that the
  user is logged in (token present)

**Q: Badge shows but never decrements.**
A: The `useUnreadNotifs` hook has a `decrement` and `reset` helper, but
the existing notifications page might not call them. After you tap the
bell and view notifications, force a reload of the forum tab — the badge
should re-fetch via AppState focus.

**Q: "X new posts" appears but the count is wrong.**
A: The buffer is per-session — if you switch sort tabs (Hot ↔ New), the
buffer clears (the underlying feed reloads). If you got 3 pending posts,
switch to Hot, and back to New, you'll see 0 pending until new ones
arrive. This is intentional.

**Q: Post detail page doesn't scroll to the comment.**
A: The scroll-to-comment depends on the comment's `<View>` having fired
its `onLayout` callback before our retry timer expires. We retry up to
4 times at 250ms intervals (1 second total). If the post has hundreds of
comments, the layout pass can take longer — open it once, and the next
notification tap will work because the layouts will be cached.

**Q: After "Ask this lawyer", the @ mention doesn't show in compose.**
A: Make sure your wiring uses the exact path `/(tabs)/forum` (not
`/(tabs)/forum/`). The forum tab reads `params.askLawyer` via
`useLocalSearchParams` and pre-fills text. Watch for typos in the lawyer
name — Arabic names with diacritics may need URL-encoding, which expo-
router handles automatically.

**Q: Bell badge shows when I'm signed out.**
A: `useUnreadNotifs` early-returns when `!token`, so this shouldn't
happen. If it does, the auth slice may not be clearing properly on
logout — that's a separate auth bug, not a 3c issue.

## What's NOT in this chunk

- No "ask this lawyer" message routing (creating a forum question
  with a real backend `mentioned_user_id` link). The button just opens
  compose with the @-mention text. The user still has to tap "post".
- Bookings/payments notifications still don't emit `notification:new`
  via socket — only forum notifications do. To make those bell-badge-
  live too, replicate the `emitToUser(uid, 'notification:new', {...})`
  pattern in `bookings.js` and `payments.js` after every
  `INSERT INTO notifications`. Estimated 6 lines per file, low risk.
- Forum activity preview on lawyer search cards (e.g. "Last posted 3h
  ago"). Defer to a later polish chunk if useful.

## Status of the forum project

After 3c is deployed, the full forum redesign trilogy is done:

- ✅ **3a** — performance (cursor pagination, memo fixes, FastImage)
- ✅ **3b** — features (people search, hashtag autocomplete, tappable hashtags, edit re-extracts tags)
- ✅ **3c** — realtime + integration (pill, live badge, profile posts tab, ask-this-lawyer, deep-link scroll)

The forum is now substantially comparable to LinkedIn/Reddit on perf and
UX. Future polish chunks could tackle: image carousel in posts, video
auto-play with sound on tap, comment threading depth indicators, and
the bookings/payments badge fix mentioned above.
