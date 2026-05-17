const fs = require('fs');

const file = 'app/book.tsx';
let content = fs.readFileSync(file, 'utf8');

// Patch 1: State
const stateTarget = `  const [slots,      setSlots]      = useState<Array<{ time: string; available: boolean }>>([]);`;
const stateReplacement = `  const [slots,      setSlots]      = useState<Array<{ time: string; available: boolean }>>([]);
  const [enabledServices, setEnabledServices] = useState<string[]>(['video', 'text', 'phone', 'inperson', 'document']);`;

content = content.replace(stateTarget, stateReplacement);

// Patch 2: useEffect
const effectTarget = `  // ── Load slots when date changes ─────────────────────────────────────────
  useEffect(() => {
    if (!form.date || !lawyerId) return;
    setSlotsLoad(true);
    lawyersAPI.getAvailability(lawyerId as string, form.date)
      .then((d: any) => setSlots(d.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoad(false));
  }, [form.date, lawyerId]);`;

const effectReplacement = `  // ── Load slots when date changes ─────────────────────────────────────────
  useEffect(() => {
    if (!form.date || !lawyerId) return;
    setSlotsLoad(true);
    lawyersAPI.getAvailability(lawyerId as string, form.date)
      .then((d: any) => {
        setSlots(d.slots || []);
        if (Array.isArray(d.enabled_services)) setEnabledServices(d.enabled_services);
      })
      .catch(() => {
        setSlots([]);
        setEnabledServices(['video', 'text', 'phone', 'inperson', 'document']);
      })
      .finally(() => setSlotsLoad(false));
  }, [form.date, lawyerId]);`;

content = content.replace(effectTarget, effectReplacement);

// Patch 3: Banner
const bannerTarget = `            {/* Time slots */}`;
const bannerReplacement = `            {form.date && form.serviceType &&
             !enabledServices.includes(
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
                      ? \`المتاح: \${enabledServices.map(s => {
                          const o = SERVICE_TYPES.find(x => x.id === s);
                          return o ? o.label : s;
                        }).join('، ')}\`
                      : \`Available: \${enabledServices.map(s => {
                          const o = SERVICE_TYPES.find(x => x.id === s);
                          return o ? o.labelEn : s;
                        }).join(', ')}\`}
                  </Text>
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

            {/* Time slots */}`;

content = content.replace(bannerTarget, bannerReplacement);

fs.writeFileSync(file, content);
console.log('Book patches applied');
