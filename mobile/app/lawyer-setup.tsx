import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { setUser, selUser } from '../src/store/slices/authSlice';
import { useTheme } from '../src/hooks/useTheme';
import { Btn, Inp } from '../src/components/ui';
import { lawyersAPI, authAPI, vaultAPI, uploadAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import type { AppDispatch } from '../src/store';
import { useI18n } from '../src/i18n';

const SPECIALIZATIONS = [
  'قانون الأسرة والأحوال الشخصية','القانون الجنائي والدفاع',
  'قانون الشركات والتجارة','قانون العقارات والإيجارات',
  'قانون العمل والتوظيف','القانون المدني','القانون الإداري',
  'قانون الملكية الفكرية','قانون الهجرة','قانون الضرائب',
  'قانون البنوك والتمويل','قانون الطب الشرعي',
];
const CITIES  = ['القاهرة','الجيزة','الإسكندرية','المنصورة','طنطا','أسيوط','الأقصر','أسوان','الإسماعيلية','بورسعيد'];
const STEPS   = ['معلوماتك المهنية','جدول العمل','الأسعار','المستندات'];
const DAYS    = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const SLOTS   = ['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];

export default function LawyerSetupScreen() {
  const C        = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const user     = useSelector(selUser);
  const insets   = useSafeAreaInsets();
  const { t } = useI18n();

  const [step,     setStep]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    specialization: '', city: '', experience_years: '', bar_number: '',
    bio: '', consultation_fee: 400,
  });
  const [schedule, setSchedule] = useState<Record<number, string[]>>({
    0: [], 1: ['9:00','10:00','11:00','14:00','15:00'],
    2: ['9:00','10:00','11:00','14:00','15:00'], 3: ['9:00','10:00','11:00'],
    4: ['9:00','10:00','11:00','14:00','15:00'], 5: [], 6: [],
  });
  const [prices, setPrices] = useState({
    text: 200, voice: 400, video: 600, inperson: 800, document: 350,
  });
  const [docs, setDocs] = useState<Record<string, string>>({});

  const updP = (k: string, v: any) => setProfile(p => ({ ...p, [k]: v }));
  const toggleSlot = (d: number, s: string) => setSchedule(p => {
    const a = [...(p[d] || [])];
    const i = a.indexOf(s);
    if (i >= 0) a.splice(i, 1); else a.push(s);
    return { ...p, [d]: a };
  });

  const saveStep1 = async () => {
    if (!profile.specialization || !profile.city || !profile.experience_years || !profile.bar_number) {
      Alert.alert('', 'يرجى ملء جميع الحقول الإلزامية'); return;
    }
    setLoading(true);
    try { await lawyersAPI.saveProfile(profile); }
    catch { /* continue anyway */ }
    finally { setLoading(false); setStep(2); }
  };

  const saveStep2 = async () => {
    setLoading(true);
    try { await lawyersAPI.saveAvailability(schedule); } catch {}
    setLoading(false); setStep(3);
  };

  const saveStep3 = async () => {
    setLoading(true);
    try {
      await lawyersAPI.saveProfile({ consultation_fee: prices.voice, service_prices: prices });
    } catch {}
    setLoading(false); setStep(4);
  };

  const pickAndUpload = async (key: string, label: string) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'], copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const file = res.assets[0];
      setUploading(key);
      const formData = new FormData();
      formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
      formData.append('folder', 'lawyer_verification');
      formData.append('doc_type', key);
      await uploadAPI.upload(formData);
      setDocs(prev => ({ ...prev, [key]: file.name }));
      Alert.alert('✅', `تم رفع ${label} بنجاح!`);
    } catch (e: any) {
      if (!e?.message?.includes('cancel')) Alert.alert('خطأ', e?.message || 'تعذر رفع الملف');
    } finally { setUploading(null); }
  };

  const finish = async () => {
    setLoading(true);
    try {
      const updated: any = await authAPI.updateProfile({ name: user?.name });
      if (updated) dispatch(setUser({ ...user, ...updated }));
    } catch {}
    setLoading(false);
    Alert.alert(t('app.success' as any), t('lawyer.setup.success' as any), [
      { text: t('app.continue' as any), onPress: () => router.replace('/(lawyer-tabs)/' as any) },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: '#1a1a2e', paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          {step > 1 && (
            <TouchableOpacity onPress={() => setStep(s => s - 1)}>
              <Text style={{ color: C.gold, fontSize: 22 }}>‹</Text>
            </TouchableOpacity>
          )}
          <Text style={{ color: C.gold, fontFamily: 'CormorantGaramond-Bold', fontSize: 20, fontWeight: '700' }}>⚖️ إعداد ملفك المهني</Text>
        </View>
        <Text style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>الخطوة {step} من 4: {STEPS[step - 1]}</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {[1,2,3,4].map(s => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: step >= s ? C.gold : '#333' }} />
          ))}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>

        {/* Step 1 — Professional info */}
        {step === 1 && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 16 }}>معلوماتك المهنية</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>التخصص القانوني *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {SPECIALIZATIONS.map(s => (
                <TouchableOpacity key={s} onPress={() => updP('specialization', s)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: profile.specialization === s ? C.gold : C.border, backgroundColor: profile.specialization === s ? C.gold + '20' : 'transparent' }}>
                  <Text style={{ color: profile.specialization === s ? C.gold : C.muted, fontSize: 12 }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>المدينة *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {CITIES.map(c => (
                <TouchableOpacity key={c} onPress={() => updP('city', c)}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: profile.city === c ? C.gold : C.border, backgroundColor: profile.city === c ? C.gold + '20' : 'transparent' }}>
                  <Text style={{ color: profile.city === c ? C.gold : C.muted, fontSize: 12 }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>سنوات الخبرة *</Text>
                <TextInput value={profile.experience_years} onChangeText={v => updP('experience_years', v)}
                  placeholder="مثال: 8" placeholderTextColor={C.muted} keyboardType="number-pad"
                  style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 11, color: C.text, fontSize: 14 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>رقم نقابة المحامين *</Text>
                <TextInput value={profile.bar_number} onChangeText={v => updP('bar_number', v)}
                  placeholder="مثال: 12345/2010" placeholderTextColor={C.muted}
                  style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 11, color: C.text, fontSize: 14 }} />
              </View>
            </View>

            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>📝 نبذة مهنية</Text>
            <TextInput value={profile.bio} onChangeText={v => updP('bio', v)} multiline numberOfLines={4}
              placeholder="اكتب عن تخصصك وخبراتك وما يميزك..."
              placeholderTextColor={C.muted}
              style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, color: C.text, fontSize: 13, textAlignVertical: 'top', minHeight: 90, marginBottom: 16 }} />

            <Btn C={C} full size="lg" disabled={loading || !profile.specialization || !profile.city || !profile.experience_years || !profile.bar_number} onPress={saveStep1}>
              {loading ? '⏳ جاري الحفظ...' : 'التالي: جدول عملك ←'}
            </Btn>
          </>
        )}

        {/* Step 2 — Schedule */}
        {step === 2 && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>جدول أوقات عملك</Text>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>حدد الأيام والأوقات التي تكون فيها متاحاً</Text>
            {DAYS.map((day, d) => {
              const daySlots = schedule[d] || [];
              const isOff    = daySlots.length === 0;
              return (
                <View key={d} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isOff ? 0 : 12 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{day}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {isOff && <Text style={{ color: C.muted, fontSize: 12 }}>إجازة</Text>}
                      <TouchableOpacity
                        onPress={() => setSchedule(p => ({ ...p, [d]: p[d]?.length ? [] : ['9:00','10:00','11:00','14:00','15:00'] }))}
                        style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: isOff ? C.border : C.gold, justifyContent: 'center', alignItems: isOff ? 'flex-start' : 'flex-end', paddingHorizontal: 3 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {!isOff && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {SLOTS.map(slot => {
                        const active = daySlots.includes(slot);
                        return (
                          <TouchableOpacity key={slot} onPress={() => toggleSlot(d, slot)}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: active ? C.gold : C.border, backgroundColor: active ? C.gold : 'transparent' }}>
                            <Text style={{ color: active ? '#fff' : C.text, fontSize: 11 }}>{slot}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
            <Btn C={C} full disabled={loading} onPress={saveStep2}>
              {loading ? '⏳' : 'التالي: الأسعار ←'}
            </Btn>
          </>
        )}

        {/* Step 3 — Pricing */}
        {step === 3 && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>أسعار خدماتك</Text>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>حدد سعراً تنافسياً. المتوسط في المنصة 400–600 جنيه للمكالمة الصوتية.</Text>
            {([['text','💬','استشارة نصية'],['voice','📞','مكالمة صوتية'],['video','📹','استشارة فيديو'],['inperson','🏛️','حضور شخصي'],['document','📄','مراجعة مستند']] as [keyof typeof prices, string, string][]).map(([k, icon, lb]) => (
              <View key={k} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 24 }}>{icon}</Text>
                <Text style={{ flex: 1, color: C.text, fontWeight: '600', fontSize: 14 }}>{lb}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput
                    value={String(prices[k])}
                    onChangeText={v => setPrices(p => ({ ...p, [k]: parseInt(v) || 0 }))}
                    keyboardType="number-pad"
                    style={{ width: 80, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 8, color: C.text, fontSize: 16, fontWeight: '700', textAlign: 'center' }}
                  />
                  <Text style={{ color: C.muted, fontSize: 12 }}>ج</Text>
                </View>
              </View>
            ))}
            <Btn C={C} full disabled={loading} onPress={saveStep3}>
              {loading ? '⏳' : 'التالي: المستندات ←'}
            </Btn>
          </>
        )}

        {/* Step 4 — Documents */}
        {step === 4 && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>مستندات التوثيق</Text>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>ارفع مستنداتك لإتمام التحقق من هويتك. سيراجعها فريقنا خلال 24 ساعة.</Text>

            {([
              ['national_id','🪪','بطاقة الرقم القومي (مطلوب)','صورة واضحة من الوجهتين'],
              ['bar_card','⚖️','كارنيه نقابة المحامين (مطلوب)','بطاقة سارية المفعول'],
              ['photo','📸','صورة شخصية مهنية','خلفية بيضاء أو محايدة'],
              ['tax_return','📄','إقرار ضريبي (اختياري)','يساعد في رفع تقييمك وموثوقيتك']
            ] as [string,string,string,string][]).map(([key, icon, label, hint]) => {
              const isUploaded = !!docs[key];
              const isUploading = uploading === key;
              return (
                <View key={key} style={{ backgroundColor: C.card, borderWidth: 2, borderColor: isUploaded ? C.green : C.border, borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 28 }}>{icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{label}</Text>
                      <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{hint}</Text>
                      {isUploaded && <Text style={{ color: C.green, fontSize: 11, marginTop: 3 }} numberOfLines={1}>✓ {docs[key]}</Text>}
                    </View>
                    {isUploading
                      ? <ActivityIndicator color={C.gold} />
                      : isUploaded
                      ? <Text style={{ fontSize: 22 }}>✅</Text>
                      : (
                        <TouchableOpacity onPress={() => pickAndUpload(key, label)}
                          style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: C.gold, backgroundColor: C.gold + '15' }}>
                          <Text style={{ color: C.gold, fontSize: 12, fontWeight: '700' }}>رفع</Text>
                        </TouchableOpacity>
                      )
                    }
                  </View>
                </View>
              );
            })}

            <View style={{ backgroundColor: C.gold + '12', borderWidth: 1, borderColor: C.gold + '25', borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <Text style={{ color: C.muted, fontSize: 12 }}>🔒 مستنداتك محمية ومشفرة. لن تُشارك مع أي طرف ثالث.</Text>
            </View>

            <Btn C={C} full disabled={loading} onPress={finish}>
              {loading ? '⏳ جاري الإرسال...' : '✅ إرسال الملف للمراجعة'}
            </Btn>
            <TouchableOpacity onPress={finish} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: C.muted, fontSize: 12 }}>أكمل المستندات لاحقاً</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
