# Wakeel — Chunk 4b (Own-Profile LinkedIn Redesign + Pin UI)

The second half of Chunk 4. Where 4a redesigned the **public** profiles
(`/lawyer/[id]` and `/user/[id]`), 4b polishes the user's **own** profile
screens and adds the missing UI to pin posts.

## What this delivers

1. **Lawyer's own profile** (`/(lawyer-tabs)/profile.tsx`) — full LinkedIn-grade rewrite using the shared `ProfileHeader` + `ActivityFeed` from 4a, with edit-pencils on every section
2. **Client's own profile** (`/(tabs)/profile.tsx`) — surgical update: the inline activity section is swapped for the unified `ActivityFeed` component so likes/comments/reposts now show up in addition to posts
3. **Pin/unpin UI** for lawyers — a "Manage pinned posts" panel on the lawyer's Posts tab that lists their own forum posts with a pin toggle on each. Backend cap of 2 enforced with a graceful error toast.

## What's in the zip

```
backendV3/                                       ← all from Chunk 4a, unchanged
├── migrations/005_profile_privacy_and_pins.sql
└── src/routes/{auth,forum,users}.js

mobileV3/
├── src/services/api.ts                         ← from Chunk 4a, unchanged
├── src/components/profile/                     ← all 3 from Chunk 4a, unchanged
│   ├── ProfileHeader.tsx
│   ├── ActivityFeed.tsx
│   └── PinnedPostCard.tsx
└── app/
    ├── account-settings.tsx                    ← from Chunk 4a, unchanged
    ├── user/[id].tsx                           ← from Chunk 4a, unchanged
    ├── lawyer/[id].tsx                         ← from Chunk 4a, unchanged
    ├── (tabs)/profile.tsx                      ← UPDATED (activity uses ActivityFeed)
    └── (lawyer-tabs)/profile.tsx               ← REWRITTEN (LinkedIn redesign + pin UI)
```

13 files total. 2 changed (this chunk's actual work), 11 carried forward
from 4a so this zip is a self-contained "deploy 4a + 4b together".

## Deploy steps

### 1 — drop files into Antigravity, commit, push backend

If you've already deployed 4a, the backend in this zip is identical and
nothing changes there. If you skipped 4a:

```bash
cd backendV3
git add migrations/005_profile_privacy_and_pins.sql
git add src/routes/auth.js src/routes/forum.js src/routes/users.js
git commit -m "feat(profile): activity + privacy + pins + own-profile redesign"
git push origin main
```

Render auto-deploys.

### 2 — run migration 005 (only if you haven't from 4a)

```bash
psql $DATABASE_URL -f migrations/005_profile_privacy_and_pins.sql
```

Idempotent. Safe to re-run if you already ran it for 4a.

### 3 — restart Metro

```bash
cd mobileV3
npx expo start -c
```

`-c` is critical. Without it, Metro will serve the old `(lawyer-tabs)/profile.tsx`.

## Test it

### A. Lawyer own profile redesign

1. Sign in as a lawyer.
2. Open the **Profile** tab (the rightmost tab).
3. You should see the new layout:
   - **Cover photo** at top (gold gradient if no cover)
   - **Avatar** overlapping the cover, white ring, online dot if online
   - **Name + verified checkmark** (gold) if verified
   - **Headline** = your specialization
   - **Subline** = city · "Member since YYYY"
   - **Action row**: ✏️ Edit Profile (gold) + ⚙️ Settings (ghost)
   - **Stats strip**: ⭐ rating · 💼 cases · ⚖️ years
   - **Tab strip**: About · Posts · Activity · Reviews
4. Tap **About** — three sections each with a small pencil icon (top-right of section header):
   - Bio → tap pencil → goes to /edit-profile
   - Service Prices → tap pencil → goes to /edit-profile
   - Availability → tap pencil → goes to /(lawyer-tabs)/schedule
5. Tap **Posts** — see the manage-pins panel (next test).
6. Tap **Activity** — unified feed of your forum activity (likes, comments, posts, reposts).
7. Tap **Reviews** — your client reviews.
8. **Sign out** button at the bottom (red).

### B. Pin/unpin posts (the long-awaited UI)

1. Stay signed in as a lawyer who has at least 2 forum posts.
2. Open Profile → **Posts** tab.
3. Initially you'll see no pinned posts (unless you pinned via API earlier in 4a).
4. Tap **"Manage pinned posts"** — the panel expands showing your latest 20 posts each with a "+ Pin" button.
5. Tap **+ Pin** on a post — button becomes "**Pinned ✓**" (gold), and the post appears at the top of the Posts tab as a gold "📌 Featured" card.
6. Pin a second post — same flow.
7. Try to pin a third — should show alert: "You can only pin up to 2 posts. Unpin one first." (Arabic equivalent in RTL mode.)
8. Tap the **✕** in the corner of a pinned card OR tap "Pinned ✓" again on a manage-row → unpins.
9. View the lawyer's PUBLIC profile (`/lawyer/<your-id>` from another account) → pinned posts visible there too in the Posts tab.

### C. Client own profile activity

1. Sign in as a CLIENT.
2. Open Profile tab.
3. Scroll down past the hero, identity card, stats bar, upcoming consultation.
4. The **Activity** section should now show:
   - Header "Activity" with subtitle "Your posts, likes, comments and reposts in the forum"
   - "Create a post" button (gold-bordered) on the right
   - Unified feed showing all 4 action types (not just posts)
5. Like a post in the forum, then come back to your profile → the like appears in Activity.
6. Comment on a post, then come back → the comment appears.
7. Tapping any activity row opens the target post.

### D. Verify nothing else regressed

The client profile changes are minimal — only the activity section was
swapped. Verify these still work:

1. Hero cover + avatar still display
2. Tap avatar → opens fullscreen avatar modal
3. Tap settings cog (top-right of cover) → opens settings modal
4. Stats bar shows posts/consults/saved counts
5. Upcoming consultation card renders if you have a booking
6. Three action pills work: Edit Profile, Share Profile, Saved Posts

## Troubleshooting

**Q: "Manage pinned posts" panel is empty even though I have posts.**
A: It loads from `forumAPI.getUserPosts(user.id)`. Verify by hitting
`/api/forum/questions?user_id=<your-uuid>` directly. If empty, your
posts may have been created with `is_visible=false` or there's an auth
mismatch.

**Q: The pin toggle returns 403.**
A: Backend rejects pinning posts you don't own. Make sure you're tapping
on your OWN posts. The "Manage pinned posts" panel only lists your
posts (filtered server-side via `forumAPI.getUserPosts(user.id)`), so
this shouldn't happen unless `user.id` resolves to a different user
than the post author.

**Q: Pin succeeds but the gold "Featured" card doesn't appear at top.**
A: The local state updates optimistically; if it doesn't reflect, pull-
to-refresh will reload from the backend. If still missing, the
`/forum/users/:userId/pinned` endpoint isn't returning the row — check
the backend logs.

**Q: Activity feed on my client profile shows "Activity is private".**
A: The `forum_activity_public` flag is FALSE by default for clients.
But on YOUR OWN profile, the backend bypasses the privacy check (you can
always see your own activity). If you're seeing the private-state on
your own profile, you might be hitting `/users/:id/activity` without
auth. Verify the `Authorization: Bearer <token>` header is being sent.

**Q: The lawyer profile redesign broke my schedule/dashboard.**
A: Only `(lawyer-tabs)/profile.tsx` was rewritten. Other files in the
lawyer-tabs group (schedule, dashboard, requests) are untouched. If
something looks off, the issue is unrelated to this chunk.

**Q: Section pencils don't open editors.**
A: Each pencil routes to a specific path:
- Bio → `/edit-profile`
- Service Prices → `/edit-profile` (same screen has all editors)
- Availability → `/(lawyer-tabs)/schedule`

If `/edit-profile` doesn't exist as a route, the previous chunks should
have created it. If it 404s, run a search for the file in `mobileV3/app/`.

## What this does NOT touch (intentionally)

- Client profile hero/cover/avatar layout — preserved as-is, only the
  activity section was modernized
- Demo data (DEMO_CASES, DEMO_MESSAGES, DOC_CHECKLISTS) at the top of
  client profile — still there for the in-progress consultation feature
- "All Activity" route (`/all-activity`) — referenced by the old activity
  block but not built; the new ActivityFeed has built-in pagination so
  the route is no longer necessary. If you want to remove the dead
  reference, search for `'all-activity'` and you'll find it cleanly.

## Status of the profile project

After 4b is deployed, the full profile redesign is done:

- ✅ **4a** — public profiles (lawyer/[id] + user/[id]) + activity backend + privacy toggle + pin endpoint
- ✅ **4b** — own-profile redesigns (lawyer-tabs + tabs) + pin UI

If the launch readiness review needs more polish later, candidates for a
"Chunk 4c" (not currently planned) would be:
- Cover photo cropper UI
- "Add experience" / "Add certification" cards for lawyers
- Client privacy granularity (separate toggles for posts vs likes vs comments)
- Real reviews data flow (current screen reads from `lawyer_profiles.reviews` JSONB but the write side may not exist yet)

Going live time. Good luck. 🚀
