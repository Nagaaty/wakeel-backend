# Wakeel — Chunk 2 (Booking Flow + Per-Type Pricing)

This bundle delivers what you asked for after Chunk 1 went live:

1. **Per-consultation-type pricing** — lawyers set 5 separate prices (one per
   service type) instead of relying on hidden multipliers.
2. **Booking flow restructure** — Step 1 = pick a date, Step 2 = pick service
   type + time, Step 3 = confirm/pay. The "tap Book → straight to step 1
   nonsense" bug is fixed.
3. **Calendar inline on lawyer profile** — already existed, now wired so
   tapping a date passes it through to the booking screen.
4. **Urgency tier removed** entirely. No more Urgent / This Week / Flexible.
5. **Service ID alignment** — old code used `voice`, new code uses `phone`
   everywhere. Old lawyer prices migrate automatically.

This bundle **includes** all Chunk 1 files (so you can do a single deploy
if Chunk 1 also somehow regressed). The Chunk 1 files are byte-identical.

## What's in the zip

```
backendV3/
├── migrations/
│   └── 003_service_type_availability.sql       ← from Chunk 1, unchanged
└── src/routes/
    ├── lawyers.js                              ← UPDATED for Chunk 2
    └── bookings.js                             ← from Chunk 1, unchanged

mobileV3/
├── src/services/
│   └── api.ts                                  ← from Chunk 1, unchanged
└── app/
    ├── book.tsx                                ← REWRITTEN (new flow)
    ├── service-pricing.tsx                     ← UPDATED (voice → phone)
    ├── lawyer/[id].tsx                         ← UPDATED (preDate, prices)
    └── (lawyer-tabs)/
        ├── profile.tsx                         ← UPDATED (real prices)
        └── schedule.tsx                        ← from Chunk 1, unchanged
```

9 files total. 5 changed since Chunk 1, 4 unchanged from Chunk 1.

## Deploy steps

### 1 — drop files into Antigravity

Overwrite the matching files. Then commit + push to `Nagaaty/wakeel-backend`:

```bash
cd backendV3
git add migrations/003_service_type_availability.sql
git add src/routes/lawyers.js src/routes/bookings.js
git commit -m "feat: per-type pricing, restructured booking flow"
git push origin main
```

Render auto-deploys. Confirm by hitting the ping endpoint:

```
https://wakeel-api.onrender.com/api/lawyers/ping-deploy
```

Should return: `{"deploy_version":"service-pricing-flow-v2"}`

### 2 — run the migration (once, if not done already from Chunk 1)

In Render Shell:

```bash
psql $DATABASE_URL -f migrations/003_service_type_availability.sql
```

If you already ran this for Chunk 1, you can skip — the migration is
idempotent. Re-running is safe and a no-op.

### 3 — restart mobile

```bash
cd mobileV3
npx expo start -c
```

The `-c` is critical. Without it Metro will serve the cached old `book.tsx`
and you'll see no change.

## Test it

### Lawyer side

1. **Set per-type prices**
   - Log in as lawyer. Profile tab → Services section → tap "Manage" → goes
     to `/service-pricing`.
   - Set 5 different prices: Text=100, Phone=200, Video=300, In-Person=400,
     Document=150.
   - Save. Reload. Prices should persist.
2. **Profile shows correct prices**
   - Go back to Profile tab. The horizontal "Services" row should now show
     **100 / 200 / 300 / 400 / 150 EGP** — matching what you set, not the
     old `fee × 2`, `fee × 3` multipliers.
3. **Schedule still works (from Chunk 1)**
   - Schedule tab → tap a weekday → toggle off Video → save.

### Client side

1. **Open a lawyer profile**
   - Search → tap a lawyer.
   - Bottom CTA should now say **"Consultations from X EGP"** where X is
     the lowest of the lawyer's 5 prices, not their old single fee.
2. **Tap a date in the inline calendar (Availability tab)**
   - Tap a future date. The time-slot grid below populates.
   - Tap a time slot. Goes to booking screen — should land on **Step 2**
     (skipping date because it's pre-filled).
3. **Tap the Book button without picking a date**
   - From any tab on the profile, tap the bottom **"📅 Book now"** button.
   - Goes to booking screen, lands on **Step 1** (pick a date).
4. **Step 1 — pick a date** in the calendar.
5. **Step 2 — see filtered service types**
   - Pick the date you marked Video-off as the lawyer.
   - Should see ONLY 4 service types (Text / Phone / In-Person / Document).
   - Each one shows the lawyer's actual price, not a multiplier.
   - **No urgency section anywhere** (Urgent / This Week / Flexible removed).
   - Pick a service type. Time slots appear below. Pick one.
   - Notes + documents fields appear. Add notes if you want.
   - Tap Continue.
6. **Step 3 — confirm + pay**
   - Booking summary shows: Lawyer / Service / Date / Time. **No urgency
     row.**
   - Price breakdown shows: Base price + Platform fee. **No urgency fee.**
   - Pick payment method, tap Pay. Booking creates successfully.

If all of those work, Chunk 2 is fully deployed.

## Troubleshooting

**Q: Prices on the lawyer profile are still hardcoded multiples.**
A: You're looking at cached data, OR the lawyer hasn't saved on
`/service-pricing` yet, OR the lawyer-tabs/profile.tsx didn't get
overwritten. Verify with:
```bash
curl https://wakeel-api.onrender.com/api/lawyers/<lawyer-uuid>
```
Look for `service_prices` in the JSON. If it's null, the lawyer never saved
custom prices — go to `/service-pricing` and save once.

**Q: I tap a time slot in the inline calendar and the booking screen still
opens at step 1.**
A: The new `book.tsx` reads `preDate` and `preTime` query params and
auto-jumps. If it's not jumping, the mobile cache wasn't cleared — re-run
`npx expo start -c`.

**Q: I see ONLY hardcoded prices in `service-pricing` even after edits.**
A: Lawyers who configured prices BEFORE this deploy may have stored
`voice` instead of `phone`. The new code auto-migrates this on read. If
prices look wrong, save once on `/service-pricing` to normalize.

**Q: The booking screen shows the urgency tier still.**
A: Old `book.tsx` got served from Metro cache. Force-quit Expo Go, restart
with `-c` flag, scan QR again.

**Q: Server returns `service_prices: null` for a lawyer.**
A: That lawyer never saved per-type prices. The booking screen still works
because it falls back to `consultation_fee` × multipliers when prices are
null. Tell the lawyer to open `/service-pricing` and save once.

## Known things this does NOT do

- Doesn't show the calendar inline on the *lawyer's own* profile preview
  (it's in their schedule tab instead, which is correct).
- Doesn't change how messages / video / promos work — those are untouched.
- Doesn't change anything about the forum, notifications, or find-lawyer.
  Those are Chunk 3.

## Next chunk

**Chunk 3 — Forum production rewrite + integration.** Forum becomes a real
LinkedIn-style social feed (virtualized, optimistic, real-time, deep-linked
to profiles + notifications + lawyer search). Estimated 2 sessions.

Once you've confirmed all 6 client-side test steps work and the lawyer
sees their real prices on their profile, ping me and we move to Chunk 3.
