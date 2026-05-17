# Wakeel — Chunk 2.1 (Corrective Patch)

This bundle fixes the issues you reported after Chunk 2 went live:

1. **Booking calendar showed every future day as available** — even days the
   lawyer doesn't work. Fixed: non-working days are now greyed out and not
   tappable.
2. **Lawyer-side per-type prices weren't actually entered anywhere visible.**
   Fixed: the 4 price inputs now live directly in the lawyer's edit-profile
   screen, no menu-diving.
3. **Tapping a lawyer's avatar in the find-lawyer list did nothing.** Fixed:
   avatar now opens the lawyer's full profile.
4. **No way to enter office address.** Fixed: address field with a map picker
   (search by address, drop a pin, or use current location) on the lawyer's
   edit-profile screen. Map preview shows on the lawyer's public profile.
5. **`phone` consultation type removed entirely** — 4 types only: video,
   text, in-person, document.
6. **Lawyer schedule disappeared after sign-out + sign-in.** Fixed: schedule
   load is now defensive against API-shape variations and explicitly rebuilds
   all 7 days from the response. Also adds a `__DEV__` log line so we can
   diagnose if it ever happens again.

## What's in the zip

```
backendV3/
├── migrations/
│   ├── 003_service_type_availability.sql        ← from Chunk 1, unchanged
│   └── 004_four_types_and_office_coords.sql     ← NEW
└── src/routes/
    ├── lawyers.js                                ← UPDATED (no phone, office save, ping v3)
    └── bookings.js                                ← from Chunk 2, unchanged

mobileV3/
├── src/services/
│   └── api.ts                                   ← from Chunk 1, unchanged
└── app/
    ├── book.tsx                                 ← UPDATED (calendar gating, no phone)
    ├── edit-profile.tsx                         ← REWRITTEN (lawyer-aware, prices + map)
    ├── service-pricing.tsx                      ← UPDATED (4 types only)
    ├── lawyer/[id].tsx                          ← UPDATED (real prices, office map)
    └── (lawyer-tabs)/
        ├── profile.tsx                          ← UPDATED (no phone in service row)
        └── schedule.tsx                         ← UPDATED (no phone, robust reload)
└── app/(tabs)/
    └── lawyers.tsx                              ← UPDATED (avatar tap → profile)
```

11 files. 8 changed since Chunk 2, 3 carried forward unchanged.

## Deploy steps

### 1 — drop files into Antigravity

Overwrite the matching files in your `mobileV3/` and `backendV3/` folders.
Then commit + push the backend:

```bash
cd backendV3
git add migrations/004_four_types_and_office_coords.sql
git add src/routes/lawyers.js src/routes/bookings.js
git commit -m "fix: 4-type service model, office coords, schedule reload"
git push origin main
```

Render auto-deploys. Confirm by hitting the ping endpoint:

```
https://wakeel-api.onrender.com/api/lawyers/ping-deploy
```

Should return: `{"deploy_version":"four-types-office-coords-v3"}`

### 2 — run the new migration

In Render Shell:

```bash
psql $DATABASE_URL -f migrations/004_four_types_and_office_coords.sql
```

This is idempotent (safe to re-run) and:
- Removes `phone` from existing weekly defaults and date overrides
- Updates the `resolve_lawyer_services()` function to default to 4 types
- Adds `office_lat` and `office_lng` columns (NULL-able)
- Does NOT touch existing bookings — the `bookings.type` CHECK still allows
  `PHONE` so legacy data isn't violated.

### 3 — restart mobile

```bash
cd mobileV3
npx expo start -c
```

The `-c` is critical. Without it, Metro will serve old `book.tsx` /
`edit-profile.tsx` and you'll see no change.

## Test it

### A. Lawyer signs in for the first time

1. Sign in as a lawyer who has no schedule yet.
2. Go to **Profile → Edit Profile**.
3. Scroll down. You should see TWO new sections **embedded right in the page**:
   - 💲 **Service Prices** — 4 number inputs (Video / Text / In-Person /
     Document) with EGP labels. Each shows red border if outside 50–5000.
   - 🏛️ **Office Address** — text field, "Locate on map" button, "Use current
     location" button.
4. Type 4 prices. Type an address. Tap "Locate on map" — a map preview
   appears with a draggable pin. Drag the pin to fine-tune.
5. Tap **Save lawyer info**. Confirmation alert.
6. Sign out. Sign back in. Re-open Edit Profile. **All prices and the address
   should still be there**, pin in the right spot.

### B. Lawyer schedule reload bug

1. Open the **Schedule** tab.
2. Toggle Mon/Tue/Wed ON. Tap a few time slots in each.
3. Tap **Save all**. Get the success alert.
4. Sign out. Sign back in. Open Schedule.
5. **Mon/Tue/Wed should still show as ON** with the same time slots. The
   service-type chips you selected should also still be lit up.
6. If anything is wrong, open the dev console — you should see a log:
   `[schedule] loaded from API: 0:off 1:N 2:N 3:N 4:off 5:off 6:off`
   where N is the number of slots. If you see `0:off 1:off 2:off ...` for
   days you saved with slots, the problem is in the API response, not the
   UI — share that log with me.

### C. Client booking calendar gates non-working days

1. Sign in as a client.
2. Open a lawyer who has a partial schedule (e.g. Mon-Wed only).
3. Tap **Book now**.
4. Step 1 — calendar appears. **Thu/Fri/Sat/Sun should be greyed out and
   strikethrough**, can't be tapped. Mon/Tue/Wed are normal and tappable.
5. Tap a Monday. Continue.
6. Step 2 should show only the consultation types the lawyer enabled, with
   the lawyer's actual prices.

### D. Avatar tap on find-lawyer list

1. Open the **Lawyers** tab.
2. Tap a lawyer's **avatar** (not the name, the avatar circle).
3. Lawyer's full profile opens. Same as tapping the "View" button.

### E. Office shown to client on lawyer profile

1. From Lawyers tab, tap any lawyer who has set an office address.
2. On the **About** tab of their profile, scroll down — you should see
   "🏛️ Office Location" with the address text and a small map preview.
3. Tap the map — it opens in the device's Maps app for directions.

If all 5 sections (A–E) work, Chunk 2.1 is fully deployed.

## Troubleshooting

**Q: Still seeing 5 service types or "phone" anywhere.**
A: Either Metro cache (`expo start -c`) OR the backend deploy didn't take.
Check the ping endpoint above.

**Q: Map preview is blank / grey.**
A: You need a Google Maps API key configured for Android. Check
`mobileV3/app.json` for `googleMaps.apiKey` under `android.config`. iOS
uses Apple Maps and works without a key.

**Q: "Locate on map" returns nothing.**
A: Nominatim geocoding is rate-limited. Wait a few seconds and try again
with a more specific address (street + city + Cairo).

**Q: Schedule still shows all-off after sign-in.**
A: This is exactly what we fixed. Open the JS console — look for
`[schedule] loaded from API:` log. If days you saved show `:off`, the
API isn't returning your data. Run this in Render Shell:
```bash
psql $DATABASE_URL -c "SELECT day_of_week, start_time FROM lawyer_availability WHERE lawyer_id='<your-lawyer-uuid>' ORDER BY day_of_week, start_time;"
```
If rows are present but the API returns empty, send me the output — there's
a deeper issue. If rows are missing, the save itself failed.

**Q: Lawyer can save schedule but client booking calendar still greys out
the day.**
A: Make sure both backend (lawyers.js) and mobile (book.tsx) are deployed.
The calendar uses `lawyer.availability_map` from the public lawyer detail
endpoint — if your backend hasn't redeployed, that field is empty.

## What this does NOT do (Chunk 3)

- Forum production rewrite — still pending
- Profile redesign for client side — still pending
- Notifications integration — still pending

Once you've confirmed all 5 test sections work end-to-end, ping me with
"continue chunk 3" and we tackle the forum.
