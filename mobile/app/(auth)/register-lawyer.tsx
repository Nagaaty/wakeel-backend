import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, TextInput, Alert, Modal } from 'react-native';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import { register } from '../../src/store/slices/authSlice';
import { lawyersAPI, authAPI } from '../../src/services/api';
import { useTheme } from '../../src/theme';
import { Btn, Inp } from '../../src/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';

const COURT_DEGREES_AR = ['محكمة الجزئية','محكمة الابتدائية','محكمة الاستئناف','محكمة النقض','جميع المحاكم'];
const COURT_DEGREES_EN = ['Summary Court','Court of First Instance','Court of Appeal','Court of Cassation','All Courts'];

const SPECIALIZATIONS_AR = ['الأحوال الشخصية','قانون الشركات والتجارة','قانون العقارات','القانون الجنائي','قانون العمل','الملكية الفكرية','قانون الهجرة والسفر','القانون المصرفي والمالي','القانون الطبي','قانون التكنولوجيا والجرائم الإلكترونية','القانون الإداري','صياغة العقود'];
const SPECIALIZATIONS_EN = ['Personal Status Law','Corporate & Commercial Law','Real Estate Law','Criminal Law','Labour Law','Intellectual Property','Immigration & Travel','Banking & Finance','Medical Law','Cybercrime & IT Law','Administrative Law','Contract Drafting'];

export default function RegisterLawyerScreen() {
  const C = useTheme();
  const dispatch = useDispatch<any>();
  const insets = useSafeAreaInsets();
  const { isRTL } = useI18n();
  const [step, setStep] = useState(2);
  const [loading, setLoading] = useState(false);
  const [courtModal, setCourtModal] = useState(false);
  const [specModal, setSpecModal] = useState(false);
  const otpInputs = React.useRef<(TextInput | null)[]>([]);

  const COURT_DEGREES = isRTL ? COURT_DEGREES_AR : COURT_DEGREES_EN;
  const SPECIALIZATIONS = isRTL ? SPECIALIZATIONS_AR : SPECIALIZATIONS_EN;

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...form.otp];
    next[i] = val;
    updateForm('otp', next);
    if (val && i < 5) { setTimeout(() => otpInputs.current[i + 1]?.focus(), 10); }
  };

  const handleOtpKeyDown = (i: number, key: string) => {
    if (key === 'Backspace' && !form.otp[i] && i > 0) {
      setTimeout(() => otpInputs.current[i - 1]?.focus(), 10);
    }
  };

  const [form, setForm] = useState({
    name: '', email: '', phone: '', nationalIq: '', password: '',
    otp: ['', '', '', '', '', ''],
    syndicateId: '', officeName: '', courtDegree: '',
    specialization: '', city: 'Cairo', experience: '', fee: '',
  });

  const updateForm = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSendUnauthOtp = async () => {
    setLoading(true);
    try {
      const res: any = await authAPI.sendOtpPublic({ phone: form.phone, email: form.email, purpose: 'verify' });
      setStep(3);
      // Dev mode: if email not configured, show OTP in alert
      if (res?.devOtp) {
        Alert.alert('🔐 Dev OTP', `Email not configured on server.\nYour code is: ${res.devOtp}`, [{ text: 'OK' }]);
      }
    } catch(e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || (isRTL ? 'تعذر إرسال الرمز' : 'Could not send OTP'));
    } finally { setLoading(false); }
  };

  const handleVerifyUnauthOtp = async () => {
    setLoading(true);
    try {
      await authAPI.verifyOtpPublic({ phone: form.phone, email: form.email, code: form.otp.join(''), purpose: 'verify' });
      setStep(4);
    } catch(e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || (isRTL ? 'الرمز غير صحيح' : 'Invalid OTP code'));
    } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Translate back to Arabic for backend
      const specIdx = SPECIALIZATIONS.indexOf(form.specialization);
      const specAr = specIdx >= 0 ? SPECIALIZATIONS_AR[specIdx] : form.specialization;
      const courtIdx = COURT_DEGREES.indexOf(form.courtDegree);
      const courtAr = courtIdx >= 0 ? COURT_DEGREES_AR[courtIdx] : form.courtDegree;

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
              specialization: specAr,
              consultation_fee: Number(form.fee) || 0,
              office_name: form.officeName,
              court_degree: courtAr,
              bar_number: form.syndicateId,
            });
          } catch (e) {}
        }
        router.replace('/(lawyer-tabs)/' as any);
      } else {
        Alert.alert(isRTL ? 'خطأ' : 'Error', res.payload as string || (isRTL ? 'حدث خطأ أثناء التسجيل' : 'Registration failed'));
      }
    } finally { setLoading(false); }
  };

  const TITLES: Record<number, string> = isRTL
    ? { 2: 'المعلومات الأساسية', 3: 'تحقق الهاتف', 4: 'البيانات المهنية', 5: 'التحقق والإرسال' }
    : { 2: 'Basic Information', 3: 'Phone Verification', 4: 'Professional Details', 5: 'Review & Submit' };

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
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, fontFamily: 'CormorantGaramond-Bold', marginBottom: 8 }}>
            {isRTL ? 'انضم إلى وكيل' : 'Join Wakeel'}
          </Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>
            {isRTL ? `الخطوة ${step} من 5 — ${TITLES[step]}` : `Step ${step} of 5 — ${TITLES[step]}`}
          </Text>
        </View>

        {/* Progress */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 32 }}>
          {[1, 2, 3, 4, 5].map(s => (
            <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= step ? C.gold : C.border }} />
          ))}
        </View>

        {/* STEP 2: Basic Info */}
        {step === 2 && (
          <View style={{ flex: 1 }}>
            <Inp C={C} label={isRTL ? 'الاسم الكامل 👤' : 'Full Name 👤'} value={form.name} onChangeText={(v: string) => updateForm('name', v)} placeholder={isRTL ? 'مثال: أحمد محمد حسن' : 'e.g. Ahmed Mohamed Hassan'} />
            <Inp C={C} label={isRTL ? 'البريد الإلكتروني ✉️' : 'Email Address ✉️'} value={form.email} onChangeText={(v: string) => updateForm('email', v)} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Inp C={C} label={isRTL ? 'رقم الهاتف 📱' : 'Phone Number 📱'} value={form.phone} onChangeText={(v: string) => updateForm('phone', v)} placeholder="01XXXXXXXXXX" keyboardType="phone-pad" />
            <Inp C={C} label={isRTL ? 'رقم الهوية الوطنية (14 رقم) 🪪' : 'National ID Number (14 digits) 🪪'} value={form.nationalIq} onChangeText={(v: string) => updateForm('nationalIq', v)} placeholder={isRTL ? 'أدخل رقم هويتك' : 'Enter your National ID'} keyboardType="number-pad" maxLength={14} />
            <Inp C={C} label={isRTL ? 'كلمة المرور 🔒' : 'Password 🔒'} value={form.password} onChangeText={(v: string) => updateForm('password', v)} placeholder={isRTL ? '8 أحرف على الأقل' : 'At least 8 characters'} secureTextEntry />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 14, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 24 }}>
              <Text style={{ fontSize: 16 }}>🔒</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>
                {isRTL ? 'رقم الهوية مشفر ولا يُشارك مع أي طرف ثالث.' : 'Your ID is encrypted and never shared with third parties.'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 'auto' }}>
              <Btn C={C} variant="ghost" onPress={() => router.back()} style={{ flex: 1, borderWidth: 1, borderColor: C.border }}>
                {isRTL ? '← رجوع' : '← Back'}
              </Btn>
              <Btn C={C} onPress={handleSendUnauthOtp} style={{ flex: 2 }}
                disabled={!form.name || !form.email || !form.phone || !form.password || form.nationalIq.length < 14 || loading}>
                {loading ? (isRTL ? '⏳ جاري الإرسال...' : '⏳ Sending...') : (isRTL ? 'متابعة ←' : 'Continue →')}
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
            <Text style={{ color: C.text, fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
              {isRTL ? 'تحقق من رقم هاتفك' : 'Verify Your Phone'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 14, marginBottom: 32, textAlign: 'center' }}>
              {isRTL ? `أرسلنا رمز تحقق مكوّن من 6 أرقام إلى` : 'We sent a 6-digit code to'}{'\n'}
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
                  style={{ width: 45, height: 55, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 8, textAlign: 'center', fontSize: 22, color: C.text, fontWeight: '700' }}
                />
              ))}
            </View>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 32 }}>
              {isRTL ? 'تم إرسال رسالة نصية وبريد إلكتروني' : 'Sent via SMS and Email'}
            </Text>

            <Btn C={C} onPress={handleVerifyUnauthOtp} full size="lg" disabled={form.otp.some(x => !x) || loading} style={{ marginBottom: 24 }}>
              {loading ? (isRTL ? '⏳ جاري التحقق...' : '⏳ Verifying...') : (isRTL ? 'تحقق وتابع ✓' : 'Verify & Continue ✓')}
            </Btn>
            <TouchableOpacity onPress={() => setStep(2)}>
              <Text style={{ color: C.muted, fontSize: 13 }}>
                {isRTL ? '← تغيير رقم الهاتف' : '← Change Phone Number'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: Professional Details */}
        {step === 4 && (
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <Text style={{ fontSize: 28 }}>⚖️</Text>
              <View>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>
                  {isRTL ? 'بياناتك المهنية' : 'Your Professional Details'}
                </Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                  {isRTL ? 'تُستخدم للتحقق من هويتك القانونية' : 'Used to verify your legal identity'}
                </Text>
              </View>
            </View>

            <Inp C={C} label={isRTL ? 'رقم القيد بنقابة المحامين * 🏛️' : 'Bar Association ID * 🏛️'} value={form.syndicateId} onChangeText={(v: string) => updateForm('syndicateId', v)} placeholder={isRTL ? 'مثال: 123456' : 'e.g. 123456'} keyboardType="number-pad" />
            <Inp C={C} label={isRTL ? 'اسم المكتب / الشركة (اختياري) 🏢' : 'Law Firm / Office Name (Optional) 🏢'} value={form.officeName} onChangeText={(v: string) => updateForm('officeName', v)} placeholder={isRTL ? 'مثال: مكتب حسن وشركاه للمحاماة' : 'e.g. Hassan & Associates Law Firm'} />

            <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
              {isRTL ? 'درجة المحكمة' : 'Court Level'}
            </Text>
            <TouchableOpacity onPress={() => setCourtModal(true)} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: form.courtDegree ? C.text : C.muted }}>
                {form.courtDegree || (isRTL ? 'اختر درجة المحكمة...' : 'Select court level...')}
              </Text>
              <Text style={{ color: C.muted }}>▾</Text>
            </TouchableOpacity>

            <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
              {isRTL ? 'التخصص الرئيسي' : 'Primary Specialization'}
            </Text>
            <TouchableOpacity onPress={() => setSpecModal(true)} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: form.specialization ? C.text : C.muted }}>
                {form.specialization || (isRTL ? 'اختر تخصصك...' : 'Select your specialization...')}
              </Text>
              <Text style={{ color: C.muted }}>▾</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Inp C={C} label={isRTL ? 'سنوات الخبرة' : 'Years of Experience'} value={form.experience} onChangeText={(v: string) => updateForm('experience', v)} placeholder={isRTL ? 'مثال: 10' : 'e.g. 10'} keyboardType="number-pad" />
              </View>
            </View>

            <Inp C={C} label={isRTL ? 'رسوم الاستشارة (جنيه) 💰' : 'Consultation Fee (EGP) 💰'} value={form.fee} onChangeText={(v: string) => updateForm('fee', v)} placeholder={isRTL ? 'مثال: 500' : 'e.g. 500'} keyboardType="number-pad" />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <Btn C={C} variant="ghost" onPress={() => setStep(3)} style={{ flex: 1, borderWidth: 1, borderColor: C.border }}>
                {isRTL ? '← رجوع' : '← Back'}
              </Btn>
              <Btn C={C} onPress={() => setStep(5)} style={{ flex: 2 }} disabled={!form.syndicateId || !form.fee || !form.experience}>
                {isRTL ? 'متابعة ←' : 'Continue →'}
              </Btn>
            </View>
          </View>
        )}

        {/* STEP 5: Review & Submit */}
        {step === 5 && (
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20, marginBottom: 24 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 16 }}>
                📋 {isRTL ? 'ملخص التسجيل' : 'Registration Summary'}
              </Text>
              {[
                [isRTL ? 'الاسم' : 'Name', form.name],
                [isRTL ? 'نقابة' : 'Bar ID', '🏛️ ' + form.syndicateId],
                [isRTL ? 'التخصص' : 'Specialization', '⚖️ ' + form.specialization],
                [isRTL ? 'المدينة' : 'City', '🏙️ ' + form.city],
                [isRTL ? 'الرسوم' : 'Fee', '💰 ' + form.fee + (isRTL ? ' جنيه' : ' EGP')],
              ].map(([lbl, val], i) => (
                <View key={lbl} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: i < 4 ? 1 : 0, borderBottomColor: C.border }}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{lbl}</Text>
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{val}</Text>
                </View>
              ))}
              <View style={{ backgroundColor: C.green + '15', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 12 }}>
                <Text style={{ color: C.green, fontWeight: '700', fontSize: 12 }}>
                  ✓ {isRTL ? 'تم التحقق من رقم الهاتف' : 'Phone number verified'}
                </Text>
              </View>
            </View>

            <View style={{ backgroundColor: '#DBEAFE', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <Text style={{ fontSize: 24, color: '#1D4ED8' }}>ℹ️</Text>
              <Text style={{ flex: 1, color: '#1E40AF', fontSize: 13, lineHeight: 20, fontWeight: '600' }}>
                {isRTL
                  ? 'يمكنك الاستمرار والبدء في استخدام وكيل فوراً! يرجى استكمال المستندات في الإعدادات لاحقاً للحصول على شارة التوثيق.'
                  : 'You can start using Wakeel immediately! Complete your verification documents in Settings later to get your verified badge.'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 'auto' }}>
              <Btn C={C} variant="ghost" onPress={() => setStep(4)} style={{ flex: 1, borderWidth: 1, borderColor: C.border }} disabled={loading}>
                {isRTL ? '← رجوع' : '← Back'}
              </Btn>
              <Btn C={C} onPress={handleSubmit} style={{ flex: 2 }} disabled={loading}>
                {loading ? (isRTL ? '⏳ جاري الإرسال...' : '⏳ Submitting...') : (isRTL ? 'إرسال الطلب ✓' : 'Submit Application ✓')}
              </Btn>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Court Degree Modal */}
      <Modal visible={courtModal} transparent animationType="slide" onRequestClose={() => setCourtModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setCourtModal(false)}>
          <View style={{ backgroundColor: '#232733', paddingBottom: insets.bottom + 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <View style={{ width: 40, height: 4, backgroundColor: 'gray', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 }} />
            <Text style={{ color: '#aaa', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
              {isRTL ? 'اختر درجة المحكمة' : 'Select Court Level'}
            </Text>
            {COURT_DEGREES.map((opt, i) => {
              const selected = form.courtDegree === opt;
              return (
                <TouchableOpacity key={i} onPress={() => { updateForm('courtDegree', opt); setCourtModal(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#2C3140' }}>
                  <Text style={{ color: '#EEE9DF', fontSize: 16 }}>{opt}</Text>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? '#C8A84B' : '#6B7280', alignItems: 'center', justifyContent: 'center' }}>
                    {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#C8A84B' }} />}
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
            <Text style={{ color: '#aaa', fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
              {isRTL ? 'اختر تخصصك' : 'Select Specialization'}
            </Text>
            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {SPECIALIZATIONS.map((opt, i) => {
                const selected = form.specialization === opt;
                return (
                  <TouchableOpacity key={i} onPress={() => { updateForm('specialization', opt); setSpecModal(false); }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#2C3140' }}>
                    <Text style={{ color: '#EEE9DF', fontSize: 16 }}>{opt}</Text>
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? '#C8A84B' : '#6B7280', alignItems: 'center', justifyContent: 'center' }}>
                      {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#C8A84B' }} />}
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
