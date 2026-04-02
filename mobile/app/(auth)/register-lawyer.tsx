import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, TextInput, Alert, Modal } from 'react-native';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import { register } from '../../src/store/slices/authSlice';
import { lawyersAPI, authAPI } from '../../src/services/api';
import { useTheme } from '../../src/theme';
import { Btn, Inp } from '../../src/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RegisterLawyerScreen() {
  const C = useTheme();
  const dispatch = useDispatch<any>();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(2);
  const [loading, setLoading] = useState(false);
  const [courtModal, setCourtModal] = useState(false);
  const [specModal, setSpecModal] = useState(false);
  const otpInputs = React.useRef<(TextInput | null)[]>([]);

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...form.otp];
    next[i] = val;
    updateForm('otp', next);
    if (val && i < 5) {
      setTimeout(() => otpInputs.current[i + 1]?.focus(), 10);
    }
  };

  const handleOtpKeyDown = (i: number, key: string) => {
    if (key === 'Backspace' && !form.otp[i] && i > 0) {
      setTimeout(() => otpInputs.current[i - 1]?.focus(), 10);
    }
  };

  // Form State
  const [form, setForm] = useState({
    name: '', email: '', phone: '', nationalIq: '', password: '',
    otp: ['', '', '', '', '', ''],
    syndicateId: '', officeName: '', courtDegree: '',
    specialization: '', city: 'Cairo', experience: '', fee: '',
    nidFile: null, syndicateFile: null
  });

  const updateForm = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSendUnauthOtp = async () => {
    setLoading(true);
    try {
      await authAPI.sendOtpPublic({ phone: form.phone, email: form.email, purpose: 'verify' });
      setStep(3);
    } catch(e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر إرسال الرمز');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUnauthOtp = async () => {
    setLoading(true);
    try {
      await authAPI.verifyOtpPublic({ phone: form.phone, email: form.email, code: form.otp.join(''), purpose: 'verify' });
      setStep(4);
    } catch(e: any) {
      Alert.alert('خطأ', e?.message || 'الرمز غير صحيح');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await dispatch(register({
        name: form.name.trim(),
        email: form.email.toLowerCase().trim(),
        phone: form.phone,
        password: form.password,
        role: 'lawyer',
      }));
      if (res.meta.requestStatus === 'fulfilled') {
        const d = res.payload as any;
        if (d.token) {
          try {
            await lawyersAPI.saveProfile({
              city: form.city,
              experience_years: Number(form.experience) || 0,
              specialization: form.specialization,
              consultation_fee: Number(form.fee) || 0,
              office_name: form.officeName,
              court_degree: form.courtDegree,
              bar_number: form.syndicateId
            });
          } catch (e) {}
        }
        router.replace('/(lawyer-tabs)/' as any);
      } else {
        Alert.alert('خطأ', res.payload as string || 'حدث خطأ أثناء التسجيل');
      }
    } finally {
      setLoading(false);
    }
  };

  const TITLES: Record<number, string> = {
    2: 'المعلومات الأساسية',
    3: 'تحقق الهاتف',
    4: 'البيانات المهنية',
    5: 'التحقق والإرسال'
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 24 }} />
            <Text style={{ fontSize: 36 }}>⚖️</Text>
            <TouchableOpacity onPress={() => router.back()} style={{ width: 24, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 24, color: C.text }}>×</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, fontFamily: 'CormorantGaramond-Bold', marginBottom: 8 }}>انضم إلى وكيل</Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>الخطوة {step} من 5 — {TITLES[step]}</Text>
        </View>

        {/* Progress Bar */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 32 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= step ? C.gold : C.border }} />
          ))}
        </View>

        {/* STEP 2: Basic Info */}
        {step === 2 && (
          <View style={{ flex: 1 }}>
            <Inp C={C} label="الاسم الكامل 👤" value={form.name} onChangeText={(v: string) => updateForm('name', v)} placeholder="مثال: أحمد محمد حسن" />
            <Inp C={C} label="البريد الإلكتروني ✉️" value={form.email} onChangeText={(v: string) => updateForm('email', v)} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Inp C={C} label="رقم الهاتف 📱" value={form.phone} onChangeText={(v: string) => updateForm('phone', v)} placeholder="01XXXXXXXXXX" keyboardType="phone-pad" />
            <Inp C={C} label="رقم الهوية الوطنية (14 رقم) 🪪" value={form.nationalIq} onChangeText={(v: string) => updateForm('nationalIq', v)} placeholder="أدخل رقم هويتك" keyboardType="number-pad" maxLength={14} />
            <Inp C={C} label="كلمة المرور 🔒" value={form.password} onChangeText={(v: string) => updateForm('password', v)} placeholder="8 أحرف على الأقل" secureTextEntry />
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 14, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 24 }}>
              <Text style={{ fontSize: 16 }}>🔒</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>رقم الهوية مشفر ولا يُشارك مع أي طرف ثالث.</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 'auto' }}>
              <Btn C={C} variant="ghost" onPress={() => router.back()} style={{ flex: 1, borderWidth: 1, borderColor: C.border }}>← رجوع</Btn>
              <Btn C={C} onPress={handleSendUnauthOtp} style={{ flex: 2 }} disabled={!form.name || !form.email || !form.phone || !form.password || form.nationalIq.length < 14 || loading}>
                {loading ? '⏳ جاري الإرسال...' : 'متابعة ←'}
              </Btn>
            </View>
          </View>
        )}

        {/* STEP 3: Phone Verification */}
        {step === 3 && (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: 80, height: 80, backgroundColor: C.gold, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 36 }}>📱</Text>
            </View>
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', marginBottom: 8 }}>تحقق من رقم هاتفك</Text>
            <Text style={{ color: C.muted, fontSize: 14, marginBottom: 32, textAlign: 'center' }}>
              أرسلنا رمز تحقق مكوّن من 6 أرقام إلى{'\n'}
              <Text style={{ color: C.gold, fontWeight: '700' }}>{form.phone || '01XXXXXXXXXX'}</Text>
            </Text>

            <View style={{ flexDirection: 'row', direction: 'ltr', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
              {form.otp.map((d, i) => (
                <TextInput
                  key={i}
                  ref={el => { otpInputs.current[i] = el; }}
                  value={d}
                  onChangeText={v => handleOtpChange(i, v)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyDown(i, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  style={{ width: 45, height: 55, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 8, textAlign: 'center', fontSize: 22, color: C.text, fontWeight: '700' }}
                />
              ))}
            </View>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 32 }}>تم إرسال رسالة نصية و بريد إلكتروني</Text>

            <Btn C={C} onPress={handleVerifyUnauthOtp} full size="lg" disabled={form.otp.some(x => !x) || loading} style={{ marginBottom: 24 }}>
              {loading ? '⏳ جاري التحقق...' : 'تحقق وتابع ✓'}
            </Btn>

            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
              إعادة الإرسال خلال <Text style={{ color: C.gold, fontWeight: '700' }}>28 ثانية</Text>
            </Text>
            <TouchableOpacity onPress={() => setStep(2)}>
              <Text style={{ color: C.muted, fontSize: 13 }}>← تغيير رقم الهاتف</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: Professional Details */}
        {step === 4 && (
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <Text style={{ fontSize: 28 }}>⚖️</Text>
              <View>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>بياناتك المهنية</Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>تُستخدم للتحقق من هويتك القانونية</Text>
              </View>
            </View>

            <Inp C={C} label="رقم القيد بنقابة المحامين * 🏛️" value={form.syndicateId} onChangeText={(v: string) => updateForm('syndicateId', v)} placeholder="مثال: 123456" keyboardType="number-pad" />
            <Inp C={C} label="اسم المكتب / الشركة (اختياري) 🏢" value={form.officeName} onChangeText={(v: string) => updateForm('officeName', v)} placeholder="مثال: مكتب حسن وشركاه للمحاماة" />
            
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>درجة المحكمة</Text>
            <TouchableOpacity onPress={() => setCourtModal(true)} style={{ backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: form.courtDegree ? C.text : C.muted }}>{form.courtDegree || 'اختر درجة المحكمة...'}</Text>
              <Text style={{ color: C.muted }}>v</Text>
            </TouchableOpacity>

            <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>التخصص الرئيسي</Text>
            <TouchableOpacity onPress={() => setSpecModal(true)} style={{ backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: form.specialization ? C.text : C.muted }}>{form.specialization || 'اختر تخصصك...'}</Text>
              <Text style={{ color: C.muted }}>v</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Inp C={C} label="سنوات الخبرة" value={form.experience} onChangeText={(v: string) => updateForm('experience', v)} placeholder="مثال: 10" keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>المدينة</Text>
                <View style={{ backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14 }}>
                  <Text style={{ color: C.text }}>{form.city}</Text>
                </View>
              </View>
            </View>

            <Inp C={C} label="رسوم الاستشارة (جنيه) 💰" value={form.fee} onChangeText={(v: string) => updateForm('fee', v)} placeholder="مثال: 500" keyboardType="number-pad" />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <Btn C={C} variant="ghost" onPress={() => setStep(3)} style={{ flex: 1, borderWidth: 1, borderColor: C.border }}>← رجوع</Btn>
              <Btn C={C} onPress={() => setStep(5)} style={{ flex: 2 }} disabled={!form.syndicateId || !form.fee || !form.experience}>متابعة ←</Btn>
            </View>
          </View>
        )}

        {/* STEP 5: Verification & Submit */}
        {step === 5 && (
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20, marginBottom: 24 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 16 }}>📋 ملخص التسجيل</Text>
              {[['الاسم', form.name], ['نقابة', '🏛️ ' + form.syndicateId], ['التخصص', '⚖️ قانون العمل'], ['المدينة', '🏙️ ' + form.city], ['الرسوم', '💰 ' + form.fee + ' جنيه']].map(([lbl, val], i) => (
                <View key={lbl} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: C.border }}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{lbl}</Text>
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{val}</Text>
                </View>
              ))}
              <View style={{ backgroundColor: C.green + '15', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 12 }}>
                <Text style={{ color: C.green, fontWeight: '700', fontSize: 12 }}>✓ تم التحقق من رقم الهاتف</Text>
              </View>
            </View>

            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 12 }}>📎 المستندات المطلوبة</Text>
            <TouchableOpacity style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, backgroundColor: C.surface, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20 }}>🪪</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>صورة بطاقة الرقم القومي (مطلوب)</Text>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>PDF أو صورة — حجم أقصى 5 MB</Text>
              </View>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>رفع ↑</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <View style={{ width: 40, height: 40, backgroundColor: C.surface, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20 }}>🏛️</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>كارنيه نقابة المحامين (مطلوب)</Text>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>PDF أو صورة — حجم أقصى 5 MB</Text>
              </View>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>رفع ↑</Text>
            </TouchableOpacity>

            <TouchableOpacity style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <View style={{ width: 40, height: 40, backgroundColor: C.surface, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20 }}>📄</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>إقرار ضريبي (اختياري)</Text>
                <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>يساعد في رفع تقييمك وموثوقيتك على المنصة</Text>
              </View>
              <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }}>رفع ↑</Text>
            </TouchableOpacity>

            <View style={{ backgroundColor: '#DBEAFE', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <Text style={{ fontSize: 24, color: '#1D4ED8' }}>ℹ️</Text>
              <Text style={{ flex: 1, color: '#1E40AF', fontSize: 13, lineHeight: 20, fontWeight: '600' }}>
                يمكنك الاستمرار والبدء في استخدام وكيل فوراً! يرجى استكمال المستندات في الإعدادات لاحقاً للحصول على شارة التوثيق.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 'auto' }}>
              <Btn C={C} variant="ghost" onPress={() => setStep(4)} style={{ flex: 1, borderWidth: 1, borderColor: C.border }} disabled={loading}>← رجوع</Btn>
              <Btn C={C} onPress={handleSubmit} style={{ flex: 2 }} disabled={loading}>{loading ? '⏳ جاري الإرسال...' : 'إرسال الطلب ✓'}</Btn>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Court Degree Modal */}
      <Modal visible={courtModal} transparent animationType="slide" onRequestClose={() => setCourtModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setCourtModal(false)}>
          <View style={{ backgroundColor: '#232733', paddingBottom: insets.bottom + 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <View style={{ width: 40, height: 4, backgroundColor: 'gray', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 }} />
            {['اختر درجة المحكمة...', 'محكمة الجزئية', 'محكمة الابتدائية', 'محكمة الاستئناف', 'محكمة النقض', 'جميع المحاكم'].map((opt, i) => {
              const selected = form.courtDegree === opt || (opt === 'اختر درجة المحكمة...' && !form.courtDegree);
              return (
                <TouchableOpacity key={i} onPress={() => { updateForm('courtDegree', opt === 'اختر درجة المحكمة...' ? '' : opt); setCourtModal(false); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#2C3140' }}>
                  <Text style={{ color: '#EEE9DF', fontSize: 18 }}>{opt}</Text>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? '#3B82F6' : '#6B7280', alignItems: 'center', justifyContent: 'center' }}>
                    {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' }} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Specialization Modal */}
      <Modal visible={specModal} transparent animationType="slide" onRequestClose={() => setSpecModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setSpecModal(false)}>
          <View style={{ backgroundColor: '#232733', height: '80%', paddingBottom: insets.bottom + 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <View style={{ width: 40, height: 4, backgroundColor: 'gray', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 }} />
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {['اختر تخصصك...', 'الأحوال الشخصية', 'قانون الشركات والتجارة', 'قانون العقارات', 'القانون الجنائي', 'قانون العمل', 'الملكية الفكرية', 'قانون الهجرة والسفر', 'القانون المصرفي والمالي', 'القانون الطبي', 'قانون التكنولوجيا والجرائم الإلكترونية', 'القانون الإداري', 'صياغة العقود'].map((opt, i) => {
                const selected = form.specialization === opt || (opt === 'اختر تخصصك...' && !form.specialization);
                return (
                  <TouchableOpacity key={i} onPress={() => { updateForm('specialization', opt === 'اختر تخصصك...' ? '' : opt); setSpecModal(false); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#2C3140' }}>
                    <Text style={{ color: '#EEE9DF', fontSize: 18 }}>{opt}</Text>
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? '#3B82F6' : '#6B7280', alignItems: 'center', justifyContent: 'center' }}>
                      {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6' }} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

    </KeyboardAvoidingView>
  );
}
