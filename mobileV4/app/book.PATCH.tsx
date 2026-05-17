// ─── Wakeel — Mobile Patch: Booking Screen Service-Type Awareness ────────────
// File: mobile/app/book.tsx
//
// Three small additions. The existing flow is:
//   Step 1 — pick service type + urgency
//   Step 2 — pick date + time
//
// We don't reorder. Instead, when the user picks a date, we surface which
// service types the lawyer accepts that day. If the user's chosen type isn't
// in the list, we show a warning + a one-tap "switch to" suggestion.
//
// Apply these three patches in order.
// ─────────────────────────────────────────────────────────────────────────────


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ PATCH 1 — Add a state for enabled services                                ║
// ║ Find the other useState() declarations near the top of the component      ║
// ║ (around line 100-150 — wherever `slots` and `slotsLoad` are declared).    ║
// ║ Add this line right next to them:                                         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

const [enabledServices, setEnabledServices] = useState<string[]>(
  ['video', 'text', 'phone', 'inperson', 'document'] // optimistic — assume all
);


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ PATCH 2 — Update the availability fetch effect                            ║
// ║ Find the useEffect that calls lawyersAPI.getAvailability (around line     ║
// ║ 210-217 in the original) and REPLACE it with this version.                ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

useEffect(() => {
  if (!form.date || !lawyerId) return;
  setSlotsLoad(true);
  lawyersAPI.getAvailability(lawyerId as string, form.date)
    .then((d: any) => {
      setSlots(d.slots || []);
      // NEW: also pick up enabled service types for this date
      if (Array.isArray(d.enabled_services)) {
        setEnabledServices(d.enabled_services);
      }
    })
    .catch(() => {
      setSlots([]);
      // On error, fall back to "all enabled" so we don't block the user
      setEnabledServices(['video', 'text', 'phone', 'inperson', 'document']);
    })
    .finally(() => setSlotsLoad(false));
}, [form.date, lawyerId]);


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ PATCH 3 — Render a warning banner when chosen service isn't enabled       ║
// ║ Find the date-picker section in step 2 (search for `selectedDate` and     ║
// ║ the `CalendarPicker` JSX). Right BEFORE the time-slot grid, insert this   ║
// ║ banner. It only appears when the user has picked a date AND their chosen  ║
// ║ service type is not in `enabledServices`.                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

{form.date && form.serviceType &&
 !enabledServices.includes(
   // 'text' is the API term; SERVICE_TYPES uses 'text' too, so this works as-is
   form.serviceType === 'chat' ? 'text' : form.serviceType
 ) && (
  <View style={{
    backgroundColor: C.warn + '15',
    borderWidth: 1,
    borderColor: C.warn + '40',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  }}>
    <Text style={{ fontSize: 18 }}>⚠️</Text>
    <View style={{ flex: 1 }}>
      <Text style={{ color: C.warn, fontWeight: '700', fontSize: 13, marginBottom: 4 }}>
        {isRTL
          ? 'هذا النوع من الاستشارات غير متاح في هذا التاريخ'
          : 'This consultation type is not available on this date'}
      </Text>
      <Text style={{ color: C.text, fontSize: 12, marginBottom: 8 }}>
        {isRTL
          ? `المتاح: ${enabledServices.map(s => {
              const o = SERVICE_TYPES.find(x => x.id === s);
              return o ? o.label : s;
            }).join('، ')}`
          : `Available: ${enabledServices.map(s => {
              const o = SERVICE_TYPES.find(x => x.id === s);
              return o ? o.labelEn : s;
            }).join(', ')}`}
      </Text>
      {/* One-tap switch to the first enabled service */}
      {enabledServices.length > 0 && (
        <TouchableOpacity
          onPress={() => setForm(f => ({ ...f, serviceType: enabledServices[0] }))}
          style={{
            backgroundColor: C.gold,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
            alignSelf: 'flex-start',
          }}
        >
          <Text style={{ color: '#1C1611', fontSize: 12, fontWeight: '700' }}>
            {isRTL ? 'بدّل إلى ' : 'Switch to '}
            {(() => {
              const o = SERVICE_TYPES.find(x => x.id === enabledServices[0]);
              return o ? (isRTL ? o.label : o.labelEn) : enabledServices[0];
            })()}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  </View>
)}
