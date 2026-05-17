import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../src/theme';
import { Btn } from '../src/components/ui';
import { lawyersAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

// Aligned with everywhere else: 4 types only (no phone — removed in chunk 2.1).
const SERVICES = [
  { id:'video',    icon:'📹', label:'استشارة فيديو', labelEn:'Video consultation' },
  { id:'text',     icon:'💬', label:'استشارة نصية',  labelEn:'Text consultation'  },
  { id:'inperson', icon:'🏛️', label:'حضور شخصي',     labelEn:'In-person'          },
  { id:'document', icon:'📄', label:'مراجعة مستند',  labelEn:'Document review'    },
];

// Sensible starting prices in EGP. Lawyer can edit before saving.
const DEFAULT_PRICES = { video: 600, text: 200, inperson: 800, document: 350 };

export default function ServicePricingScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const { isRTL, t } = useI18n();

  const [prices, setPrices] = useState<Record<string, number>>(DEFAULT_PRICES);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    lawyersAPI.getMyProfile().then((d: any) => {
      if (d?.service_prices) {
        const sp = typeof d.service_prices === 'string' ? JSON.parse(d.service_prices) : d.service_prices;
        // Drop legacy phone/voice keys (no longer supported as of chunk 2.1)
        delete sp.phone; delete sp.voice;
        setPrices(p => ({ ...p, ...sp }));
      } else if (d?.consultation_fee) {
        const base = Number(d.consultation_fee) || 400;
        setPrices({
          video:    Math.round(base * 1.5),
          text:     Math.round(base * 0.5),
          inperson: Math.round(base * 2),
          document: Math.round(base * 0.8),
        });
      }
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      // Save: keep consultation_fee in sync with the lowest price for back-compat
      // with any code still reading consultation_fee directly.
      const lowest = Math.min(...Object.values(prices).map(Number).filter(n => n > 0));
      await lawyersAPI.saveProfile({
        consultation_fee: lowest || prices.video,
        service_prices:   prices,
      });
      Alert.alert(
        isRTL ? '✅ تم الحفظ' : '✅ Saved',
        isRTL ? 'تم حفظ الأسعار بنجاح' : 'Prices saved successfully',
      );
    } catch (e: any) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        e?.message || (isRTL ? 'فشل الحفظ' : 'Save failed'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: C.surface,
        paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
        flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.text, fontSize: 22 }}>{isRTL ? '›' : '‹'}</Text>
        </TouchableOpacity>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 20 }}>
          {isRTL ? '💲 أسعار خدماتي' : '💲 My service prices'}
        </Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Helpful banner */}
        <View style={{
          backgroundColor: C.accent + '15',
          borderWidth: 1, borderColor: C.accent + '30',
          borderRadius: 12, padding: 12, marginBottom: 20,
        }}>
          <Text style={{ color: C.accent, fontWeight: '600', fontSize: 13, textAlign: isRTL ? 'right' : 'left' }}>
            {isRTL
              ? '💡 المتوسط في المنصة: 400-600 جنيه للاستشارة الفيديو'
              : '💡 Platform average: 400–600 EGP for a video consultation'}
          </Text>
        </View>

        {SERVICES.map(svc => {
          const val = prices[svc.id] || 0;
          const tooLow  = val > 0 && val < 50;
          const tooHigh = val > 5000;
          return (
            <View key={svc.id} style={{
              backgroundColor: C.card,
              borderWidth: 1, borderColor: tooLow || tooHigh ? C.red + '60' : C.border,
              borderRadius: 14, padding: 14, marginBottom: 10,
            }}>
              <View style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center', gap: 12, marginBottom: 8,
              }}>
                <Text style={{ fontSize: 26 }}>{svc.icon}</Text>
                <Text style={{ flex: 1, color: C.text, fontWeight: '600', fontSize: 14, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL ? svc.label : svc.labelEn}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput
                    value={String(val)}
                    onChangeText={v => setPrices(p => ({ ...p, [svc.id]: parseInt(v) || 0 }))}
                    keyboardType="numeric"
                    style={{
                      width: 80,
                      backgroundColor: C.bg,
                      borderWidth: 1, borderColor: tooLow || tooHigh ? C.red : C.border,
                      borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
                      color: C.text, fontSize: 16, fontWeight: '700', textAlign: 'center',
                    }}
                  />
                  <Text style={{ color: C.muted, fontSize: 12 }}>{isRTL ? 'ج' : 'EGP'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: tooLow ? C.red : C.muted, fontSize: 11 }}>
                  {isRTL ? 'الحد الأدنى: 50 ج' : 'Min: 50 EGP'}
                </Text>
                <Text style={{ color: tooHigh ? C.red : C.muted, fontSize: 11 }}>
                  {isRTL ? 'الحد الأقصى: 5,000 ج' : 'Max: 5,000 EGP'}
                </Text>
              </View>
              {(tooLow || tooHigh) && (
                <Text style={{ color: C.red, fontSize: 11, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
                  {tooLow
                    ? (isRTL ? '⚠️ السعر أقل من الحد الأدنى المسموح' : '⚠️ Below minimum allowed')
                    : (isRTL ? '⚠️ السعر أعلى من الحد الأقصى المسموح' : '⚠️ Above maximum allowed')}
                </Text>
              )}
            </View>
          );
        })}

        <Btn C={C} full size="lg" disabled={saving} onPress={save} style={{ marginTop: 8 }}>
          {saving ? t('app.loading') : (isRTL ? '💾 حفظ الأسعار' : '💾 Save prices')}
        </Btn>
      </ScrollView>
    </View>
  );
}
