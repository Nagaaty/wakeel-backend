# Wakeel — Chunk 1: Per-Day Per-Consultation-Type Availability

This bundle adds the feature you described:

> The lawyer can select which consultation types he's ready to do for a
> specific time slot. So for example: video conference ON for April 30,
> OFF for the next day. Same for the rest of the consultation types.

## What's in the bundle

```
backend/
├── migrations/
│   └── 003_service_type_availability.sql       ← NEW (run once)
└── src/routes/
    ├── lawyers.PATCH.js                        ← APPLY to lawyers.js
    └── bookings.PATCH.js                       ← APPLY to bookings.js

mobile/
├── src/services/
│   └── api.PATCH.ts                            ← APPLY to api.ts
└── app/
    ├── (lawyer-tabs)/schedule.tsx              ← REPLACE
    └── book.PATCH.tsx                          ← APPLY to book.tsx
```

The two `.tsx`/`.sql` files are full replacements. The four `.PATCH.*` files
are partial — each contains clearly-marked sections to integrate into your
existing files. I went this route because rewriting whole files (your
`bookings.js` is 256 lines, `lawyers.js` is 488, `book.tsx` is 609) would
make merge conflicts very likely if you've edited them since the V2 zip.

## How it works

There are now **two layers** of availability above the time-slot schedule:

1. **Weekly service-type defaults** — for each weekday, which consultation
   types the lawyer accepts. (e.g. "Mondays I do all 5 types; Sundays I do
   text and phone only.")
2. **Per-date service-type overrides** — for a specific date, override the
   weekly default. (e.g. "On April 30 specifically, no video calls.")

Both layers are evaluated by a Postgres function `resolve_lawyer_services()`
the migration installs:

- If a row exists in `lawyer_schedule_overrides` for that date with
  `service_types` not null → use that.
- Else if a row exists in `lawyer_service_defaults` for that weekday → use that.
- Else → all 5 types accepted (preserves pre-feature behavior for existing lawyers).

The booking endpoint validates that the requested type is in the resolved set
before creating the booking. Frontend filters/warns based on the
`enabled_services` array returned by the public availability endpoint.

## Apply order

### 1. Backend — database

```bash
cd backend
psql $DATABASE_URL < migrations/003_service_type_availability.sql
```

The migration is idempotent and includes a backfill: any lawyer who already
saved a weekly schedule will get all 5 service types enabled by default for
each weekday they work, so nothing breaks for existing users.

### 2. Backend — routes

Open `backend/src/routes/lawyers.js` and apply the three patches inside
`lawyers.PATCH.js`:
- **Patch 1** replaces the existing `GET /:id/availability` handler.
- **Patch 2** adds two new endpoints (`GET` and `POST`
  `/me/service-availability`).
- **Patch 3** adds one optional subquery to `GET /:id` (lawyer detail).

Open `backend/src/routes/bookings.js` and apply the patch inside
`bookings.PATCH.js`. It inserts a service-type validation block right after
the existing double-booking check, plus shows the small change to the
`dbType` mapping so the new `INPERSON` and `DOCUMENT` types persist correctly.

### 3. Mobile — api.ts

Open `mobile/src/services/api.ts` and add the two methods inside the
`lawyersAPI` object as shown in `api.PATCH.ts`. Optionally, paste the type
definitions from the same file to a types file for auto-complete.

### 4. Mobile — schedule screen

Replace `mobile/app/(lawyer-tabs)/schedule.tsx` with the file in this bundle.
This is a full file replacement.

### 5. Mobile — book screen

Open `mobile/app/book.tsx` and apply the three patches inside
`book.PATCH.tsx` (one new state field, one effect rewrite, one banner JSX
addition).

## Testing checklist

After deploying, walk through each of these:

**Lawyer side**

1. Open Schedule tab as a lawyer.
2. Tap a weekday — expand a day. Confirm you see 5 type chips
   (video / text / phone / in-person / document) all selected, plus the
   time-slot grid you had before.
3. Toggle off "video" for Monday. Save. Reload. Verify the toggle persisted.
4. Open the calendar at the bottom. Tap a future date.
5. Toggle off "video" just for that date in the override panel. Confirm
   the date gets a blue dot (= custom services) on the calendar. Save and
   reload to verify persistence.

**Client side**

1. Open a lawyer's profile and tap Book.
2. Pick "video consultation" in step 1.
3. Move to step 2 and pick the date you marked video-off.
4. The yellow warning banner should appear with a "Switch to text/phone/..."
   button. Try the switch button — chosen service should change.
5. Pick a date where video is enabled — banner should disappear.
6. Try to force-create a booking with video on the disabled date by
   tapping confirm anyway: you should get a 409 from the backend with
   message "This consultation type is not offered by the lawyer on this date"

## Troubleshooting

**Q: I get `function resolve_lawyer_services(uuid, date) does not exist`.**
A: The migration didn't run. Re-run it with `psql ... < migrations/003_service_type_availability.sql`.

**Q: Existing bookings break with "constraint bookings_type_check violated".**
A: Migration 003 widens the check constraint. If your DB rejected the
   migration mid-way, run just the `ALTER TABLE bookings DROP/ADD CONSTRAINT`
   lines from it.

**Q: The mobile schedule screen shows all 5 types as disabled by default.**
A: Either you have a brand new lawyer with no `lawyer_service_defaults`
   rows, or the GET endpoint isn't deployed. Check the Network tab —
   `getServiceAvailability` should return `defaults: { 0: [...], 1: [...], ... }`.
   If it returns `{ defaults: {}, overrides: [] }`, your lawyer hasn't saved
   yet — that's fine, the UI seeds with all 5 enabled.

**Q: Booking validation says "function resolve... does not exist" but the
function exists.**
A: The `pool.query` call in bookings.js falls through silently if the
   resolver fails — check server logs. Most likely the migration ran
   on a different database than the app connects to.

## What this does NOT do

- Doesn't change the *time slots* the lawyer offers (that already worked).
- Doesn't change pricing per service type (still client-side via SERVICE_TYPES.mul).
- Doesn't add a service-type filter on the lawyer search/discovery screen.
  We can add that as a 1-line `WHERE` clause when you want it.

## Next chunk

Forum production rewrite (Chunk 2). The forum integrates with profile +
notifications + find-lawyer naturally — that integration falls out of doing
the rewrite right.
