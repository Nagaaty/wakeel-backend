import * as DocumentPicker from 'expo-document-picker';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, TextInput, Alert, Modal, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import { register } from '../../src/features/auth/authSlice';
import { lawyersAPI, authAPI, uploadAPI, firmsAPI } from '../../src/services/api';
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
  const [matchError, setMatchError] = useState('');
  const otpInputs = React.useRef<(TextInput | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', nationalIq: '', password: '',
    otp: ['', '', '', '', '', ''],
    syndicateId: '', officeName: '', courtDegree: '',
    specialization: '', city: 'Cairo', experience: '', fee: '',
    idPhotoUri: '', idBackUri: '', selfieUri: '',
    practitioner_type: 'independent', firm_id: null as string | null,
    invite_code: ''
  });
  const updateForm = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  // Firms list state
  const [firmsList, setFirmsList] = useState<any[]>([]);
  const [showFirmDropdown, setShowFirmDropdown] = useState(false);
  const [firmSearch, setFirmSearch] = useState('');
  const [creatingFirm, setCreatingFirm] = useState(false);

  // New secure firm selection states
  const [firmMode, setFirmMode] = useState<'join' | 'create'>('join');
  const [inviteCode, setInviteCode] = useState('');
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [inviteCodeValid, setInviteCodeValid] = useState<boolean | null>(null);
  const [requestPendingJoin, setRequestPendingJoin] = useState(false);
  const [newFirmName, setNewFirmName] = useState('');
  const [newFirmWebsite, setNewFirmWebsite] = useState('');
  const [newFirmPhone, setNewFirmPhone] = useState('');

  // New firm B2B verification states
  const [newFirmBarReg, setNewFirmBarReg] = useState('');
  const [newFirmDocUrl, setNewFirmDocUrl] = useState('');
  const [uploadingFirmDoc, setUploadingFirmDoc] = useState(false);
  const [uploadedDocName, setUploadedDocName] = useState('');

  React.useEffect(() => {
    if (form.firm_id) {
      setInviteCodeValid(null);
      setInviteCode('');
      setRequestPendingJoin(false);
    }
  }, [form.firm_id]);

  const pickFirmDoc = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true
      });
      if (res.canceled) return;
      const file = res.assets[0];
      setUploadingFirmDoc(true);
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream'
      } as any);
      formData.append('folder', 'firm_verification');
      formData.append('doc_type', 'firm_license');
      
      const uploadRes: any = await uploadAPI.upload(formData);
      setNewFirmDocUrl(uploadRes.url || uploadRes.file?.url);
      setUploadedDocName(file.name);
      Alert.alert('✅', isRTL ? 'تم رفع المستند بنجاح!' : 'Document uploaded successfully!');
    } catch (e: any) {
      if (!e?.message?.includes('cancel')) {
        Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || (isRTL ? 'تعذر رفع الملف' : 'Upload failed'));
      }
    } finally {
      setUploadingFirmDoc(false);
    }
  };

  const handleVerifyInviteCode = async (code: string) => {
    const trimmedCode = code.trim().toUpperCase();
    setInviteCode(trimmedCode);
    if (trimmedCode.length === 6) {
      setVerifyingCode(true);
      setInviteCodeValid(null);
      try {
        const res: any = await firmsAPI.verifyCode(trimmedCode);
        if (res.firm) {
          setInviteCodeValid(true);
          updateForm('firm_id', res.firm.id);
          updateForm('invite_code', trimmedCode);
          setShowFirmDropdown(false);
        } else {
          setInviteCodeValid(false);
          updateForm('invite_code', '');
        }
      } catch (e) {
        setInviteCodeValid(false);
        updateForm('invite_code', '');
      } finally {
        setVerifyingCode(false);
      }
    } else {
      setInviteCodeValid(null);
      updateForm('invite_code', '');
    }
  };

  React.useEffect(() => {
    // Fetch firms list to let users choose during signup
    firmsAPI.list({ limit: 100 }).then((res: any) => {
      setFirmsList(res.firms || []);
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (step === 3 && timeLeft > 0) {
      const timerId = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(timerId);
    }
  }, [step, timeLeft]);

  const COURT_DEGREES = isRTL ? COURT_DEGREES_AR : COURT_DEGREES_EN;
  const SPECIALIZATIONS = isRTL ? SPECIALIZATIONS_AR : SPECIALIZATIONS_EN;
  const filteredFirms = firmsList.filter(f => f.name.toLowerCase().includes(firmSearch.toLowerCase()));

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

  const [verifying, setVerifying] = useState(false);
  const [verifiedAi, setVerifiedAi] = useState(false);
  const [aiText, setAiText] = useState('');

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

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      await authAPI.sendOtpPublic({ phone: form.phone, email: form.email, purpose: 'verify' });
      setTimeLeft(60); // Reset timer
      Alert.alert(isRTL ? 'نجاح' : 'Success', isRTL ? 'تم إعادة إرسال الرمز بنجاح' : 'OTP resent successfully');
    } catch(e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || (isRTL ? 'تعذر إعادة الإرسال' : 'Could not resend OTP'));
    } finally {
      setLoading(false);
    }
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
            const selectedFirm = firmsList.find(f => f.id === form.firm_id);
            await lawyersAPI.saveProfile({
              city: form.city,
              experience_years: Number(form.experience) || 0,
              specialization: specAr,
              consultation_fee: Number(form.fee) || 0,
              office_name: selectedFirm ? selectedFirm.name : form.officeName,
              court_degree: courtAr,
              bar_number: form.syndicateId,
              practitioner_type: form.practitioner_type,
              firm_id: form.firm_id,
              invite_code: form.invite_code,
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
    ? { 2: 'المعلومات الأساسية', 3: 'تحقق الهاتف', 4: 'البيانات المهنية', 5: 'التحقق من الهوية', 6: 'التحقق والإرسال' }
    : { 2: 'Basic Information', 3: 'Phone Verification', 4: 'Professional Details', 5: 'Identity Verification', 6: 'Review & Submit' };

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
          <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, fontFamily: 'Cairo-Bold', marginBottom: 8 }}>
            {isRTL ? 'انضم إلى وكيل' : 'Join Wakeel'}
          </Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>
            {isRTL ? `الخطوة ${step} من 5 — ${TITLES[step]}` : `Step ${step} of 5 — ${TITLES[step]}`}
          </Text>
        </View>

        {/* Progress */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 32 }}>
          {[1, 2, 3, 4, 5, 6].map(s => (
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

            {/* Resend OTP Button */}
            <TouchableOpacity 
              onPress={handleResendOtp} 
              disabled={timeLeft > 0 || loading}
              style={{ marginBottom: 24, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ 
                color: timeLeft > 0 ? C.muted : C.gold, 
                fontSize: 14, 
                fontWeight: timeLeft > 0 ? '400' : '700' 
              }}>
                {timeLeft > 0 
                  ? (isRTL ? `إعادة الإرسال بعد ${timeLeft} ثانية` : `Resend in ${timeLeft}s`)
                  : (isRTL ? 'أعد إرسال الرمز' : 'Resend OTP')
                }
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(2)}>
              <Text style={{ color: C.muted, fontSize: 13 }}>
                {isRTL ? '← تغيير الهاتف / البريد الإلكتروني' : '← Change email or phone'}
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

            {/* Practitioner Type Selection Cards */}
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
              {isRTL ? 'نوع الممارسة *' : 'Practitioner Type *'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <TouchableOpacity
                onPress={() => {
                  updateForm('practitioner_type', 'independent');
                  updateForm('firm_id', null);
                  updateForm('invite_code', '');
                }}
                style={{
                  flex: 1, backgroundColor: form.practitioner_type === 'independent' ? `${C.gold}15` : C.card,
                  borderWidth: 1, borderColor: form.practitioner_type === 'independent' ? C.gold : C.border,
                  borderRadius: 12, padding: 12, alignItems: 'center'
                }}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>👤</Text>
                <Text style={{ color: form.practitioner_type === 'independent' ? C.gold : C.text, fontSize: 13, fontWeight: 'bold', fontFamily: 'Cairo-Bold' }}>
                  {isRTL ? 'مكتب خاص / مستقل' : 'Solo Practice / Independent'}
                </Text>
                <Text style={{ color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 2 }}>
                  {isRTL ? 'ممارس مستقل أو صاحب مكتب خاص' : 'Solo practitioner or private office owner'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => updateForm('practitioner_type', 'firm_member')}
                style={{
                  flex: 1, backgroundColor: form.practitioner_type === 'firm_member' ? `${C.gold}15` : C.card,
                  borderWidth: 1, borderColor: form.practitioner_type === 'firm_member' ? C.gold : C.border,
                  borderRadius: 12, padding: 12, alignItems: 'center'
                }}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>🏢</Text>
                <Text style={{ color: form.practitioner_type === 'firm_member' ? C.gold : C.text, fontSize: 13, fontWeight: 'bold', fontFamily: 'Cairo-Bold' }}>
                  {isRTL ? 'شركة محاماة' : 'Law Firm'}
                </Text>
                <Text style={{ color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 2 }}>
                  {isRTL ? 'تعمل مع مؤسسة قانونية' : 'Work under a firm'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Firm Association / Creation flow */}
            {form.practitioner_type === 'firm_member' && (
              <View style={{ marginBottom: 14 }}>
                {/* Mode toggle (Join vs Create) */}
                <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 3, marginBottom: 14 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setFirmMode('join');
                      updateForm('firm_id', null);
                      updateForm('invite_code', '');
                      setInviteCode('');
                      setInviteCodeValid(null);
                    }}
                    style={{
                      flex: 1, paddingVertical: 8, alignItems: 'center',
                      backgroundColor: firmMode === 'join' ? C.card : 'transparent',
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ color: firmMode === 'join' ? C.gold : C.muted, fontSize: 12, fontWeight: 'bold', fontFamily: 'Cairo-Bold' }}>
                      {isRTL ? 'انضمام لشركة مسجلة' : 'Join Existing Firm'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setFirmMode('create');
                      updateForm('firm_id', null);
                      updateForm('invite_code', '');
                      setInviteCode('');
                      setInviteCodeValid(null);
                    }}
                    style={{
                      flex: 1, paddingVertical: 8, alignItems: 'center',
                      backgroundColor: firmMode === 'create' ? C.card : 'transparent',
                      borderRadius: 6
                    }}
                  >
                    <Text style={{ color: firmMode === 'create' ? C.gold : C.muted, fontSize: 12, fontWeight: 'bold', fontFamily: 'Cairo-Bold' }}>
                      {isRTL ? 'تسجيل شركة جديدة' : 'Create New Firm'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {firmMode === 'join' ? (
                  <>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                      {isRTL ? 'اختر شركة المحاماة التي تنتمي إليها *' : 'Select your Law Firm *'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowFirmDropdown(!showFirmDropdown)}
                      style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                        borderRadius: 10, padding: 14, marginBottom: 12
                      }}
                    >
                      <Text style={{ color: form.firm_id ? C.text : C.muted, fontSize: 14 }}>
                        {form.firm_id 
                          ? (firmsList.find(f => f.id === form.firm_id)?.name || (isRTL ? 'تم الاختيار' : 'Selected'))
                          : (isRTL ? 'اختر الشركة...' : 'Choose a firm...')}
                      </Text>
                      <Text style={{ color: C.muted, fontSize: 12 }}>{showFirmDropdown ? '▲' : '▼'}</Text>
                    </TouchableOpacity>

                    {showFirmDropdown && (
                      <View style={{
                        maxHeight: 220, backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                        borderRadius: 10, marginTop: -8, marginBottom: 14, overflow: 'hidden'
                      }}>
                        {/* Search bar inside dropdown */}
                        <View style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
                          <TextInput
                            value={firmSearch}
                            onChangeText={setFirmSearch}
                            placeholder={isRTL ? '🔍 ابحث عن الشركة...' : '🔍 Search for firm...'}
                            placeholderTextColor={C.muted}
                            style={{
                              color: C.text, fontSize: 13, backgroundColor: C.bg,
                              borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
                              borderWidth: 1, borderColor: C.border, textAlign: isRTL ? 'right' : 'left'
                            }}
                          />
                        </View>

                        <ScrollView nestedScrollEnabled={true} style={{ maxHeight: 150 }}>
                          {filteredFirms.map((firm: any) => (
                            <TouchableOpacity
                              key={firm.id}
                              onPress={() => {
                                updateForm('firm_id', firm.id);
                                setShowFirmDropdown(false);
                                setFirmSearch('');
                                // Reset invite code verification when selecting manually
                                setInviteCode('');
                                setInviteCodeValid(null);
                              }}
                              style={{
                                paddingVertical: 10, paddingHorizontal: 12,
                                borderBottomWidth: 1, borderBottomColor: C.border,
                                backgroundColor: form.firm_id === firm.id ? `${C.gold}15` : 'transparent'
                              }}
                            >
                              <Text style={{ color: form.firm_id === firm.id ? C.gold : C.text, fontSize: 13, fontWeight: form.firm_id === firm.id ? 'bold' : 'normal' }}>
                                {firm.name}
                              </Text>
                            </TouchableOpacity>
                          ))}

                          {filteredFirms.length === 0 && (
                            <View style={{ padding: 12, alignItems: 'center' }}>
                              <Text style={{ color: C.muted, fontSize: 12 }}>
                                {isRTL ? 'لا توجد شركات مطابقة' : 'No matching firms found'}
                              </Text>
                            </View>
                          )}
                        </ScrollView>
                      </View>
                    )}

                    {(() => {
                      const selectedFirm = firmsList.find(f => f.id === form.firm_id);
                      const hasWebsite = !!selectedFirm?.website;
                      return (
                        <>
                          {/* Verification Method Selection */}
                          {/* Invite Code verification input */}
                          <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 8, opacity: requestPendingJoin ? 0.5 : 1 }}>
                            {isRTL ? 'كود دعوة الشركة (مطلوب للانضمام) 🔑' : 'Firm Invite Code (Required to Join) 🔑'}
                          </Text>
                          <TextInput
                            value={inviteCode}
                            onChangeText={handleVerifyInviteCode}
                            placeholder={isRTL ? 'مثال: WAK78A (6 رموز)' : 'e.g. WAK78A (6 chars)'}
                            maxLength={6}
                            autoCapitalize="characters"
                            editable={!requestPendingJoin}
                            style={{
                              backgroundColor: C.card, color: requestPendingJoin ? C.muted : C.text, borderWidth: 1,
                              borderColor: inviteCodeValid === true ? C.green : (inviteCodeValid === false ? C.red : C.border),
                              borderRadius: 10, padding: 12, fontSize: 14, textTransform: 'uppercase',
                              opacity: requestPendingJoin ? 0.6 : 1
                            }}
                          />
                          <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {verifyingCode && <Text style={{ color: C.gold, fontSize: 11 }}>{isRTL ? '⏳ جاري التحقق من الكود...' : '⏳ Verifying code...'}</Text>}
                            {!verifyingCode && inviteCodeValid === true && (
                              <Text style={{ color: C.green, fontSize: 11, fontWeight: '600' }}>
                                {isRTL ? '✓ تم التحقق بنجاح!' : '✓ Verification successful!'}
                              </Text>
                            )}
                            {!verifyingCode && inviteCodeValid === false && (
                              <Text style={{ color: C.red, fontSize: 11, fontWeight: '600' }}>
                                {isRTL ? '❌ كود غير صحيح. يرجى إدخال الكود الصحيح للمتابعة.' : '❌ Invalid code. Please enter the correct code to proceed.'}
                              </Text>
                            )}
                            {!verifyingCode && inviteCodeValid === null && inviteCode.length > 0 && inviteCode.length < 6 && (
                              <Text style={{ color: C.muted, fontSize: 11 }}>
                                {isRTL ? 'أدخل كود الدعوة المكون من 6 رموز للتنشيط الفوري' : 'Enter 6-char code for instant activation'}
                              </Text>
                            )}
                          </View>

                          <TouchableOpacity
                            onPress={() => {
                              const nextVal = !requestPendingJoin;
                              setRequestPendingJoin(nextVal);
                              if (nextVal) {
                                setInviteCode('');
                                setInviteCodeValid(null);
                                updateForm('invite_code', '');
                              }
                            }}
                            style={{
                              flexDirection: isRTL ? 'row-reverse' : 'row',
                              alignItems: 'center',
                              gap: 8,
                              marginTop: 10,
                              padding: 10,
                              borderRadius: 8,
                              backgroundColor: requestPendingJoin ? C.gold + '10' : 'transparent',
                              borderWidth: 1,
                              borderColor: requestPendingJoin ? C.gold + '30' : 'transparent',
                            }}
                          >
                            <View style={{
                              width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
                              borderColor: requestPendingJoin ? C.gold : C.muted,
                              alignItems: 'center', justifyContent: 'center',
                              backgroundColor: requestPendingJoin ? C.gold : 'transparent'
                            }}>
                              {requestPendingJoin && <Ionicons name="checkmark" size={12} color={C.bg} />}
                            </View>
                            <Text style={{ color: C.text, fontSize: 12, fontFamily: 'Cairo-Regular', flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                              {isRTL 
                                ? 'لا أملك كود الدعوة؟ أرسل طلب انضمام للشركة (يتطلب موافقة الإدارة)' 
                                : "Don't have the invite code? Request to Join (requires admin approval)"}
                            </Text>
                          </TouchableOpacity>
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <Inp C={C} label={isRTL ? 'اسم الشركة * 🏛️' : 'Firm Name * 🏛️'} value={newFirmName} onChangeText={setNewFirmName} placeholder={isRTL ? 'مثال: شركة النصر للاستشارات القانونية' : 'e.g. El-Nasr Law Firm'} />
                    
                    <Inp C={C} label={isRTL ? 'رقم قيد النقابة للشركة * 🏛️' : 'Bar Association Firm Registration Number * 🏛️'} value={newFirmBarReg} onChangeText={setNewFirmBarReg} placeholder={isRTL ? 'رقم قيد الشركة بالنقابة' : 'Firm Registration No.'} keyboardType="number-pad" />
                    
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                      {isRTL ? 'صورة ترخيص الشركة / عقد التأسيس (اختياري) 📄' : 'Firm License Copy / Association Contract (Optional) 📄'}
                    </Text>
                    <TouchableOpacity
                      onPress={pickFirmDoc}
                      disabled={uploadingFirmDoc}
                      style={{
                        backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                        borderRadius: 10, padding: 14, marginBottom: 16, alignItems: 'center',
                        flexDirection: 'row', justifyContent: 'center', gap: 8
                      }}
                    >
                      <Ionicons name="cloud-upload-outline" size={20} color={C.gold} />
                      <Text style={{ color: C.gold, fontFamily: 'Cairo-Bold', fontWeight: 'bold' }}>
                        {uploadingFirmDoc 
                          ? (isRTL ? '⏳ جاري الرفع...' : '⏳ Uploading...') 
                          : (uploadedDocName ? `${uploadedDocName} (✓)` : (isRTL ? 'اختر مستند...' : 'Choose document...'))}
                      </Text>
                    </TouchableOpacity>

                    <Inp C={C} label={isRTL ? 'موقع الشركة الإلكتروني (اختياري) 🌐' : 'Firm Website (Optional) 🌐'} value={newFirmWebsite} onChangeText={setNewFirmWebsite} placeholder="https://example.com" keyboardType="url" autoCapitalize="none" />
                    <Inp C={C} label={isRTL ? 'هاتف الشركة (اختياري) 📞' : 'Firm Phone (Optional) 📞'} value={newFirmPhone} onChangeText={setNewFirmPhone} placeholder="02XXXXXXXX" keyboardType="phone-pad" />
                    
                    <View style={{
                      backgroundColor: `${C.gold}10`, borderWidth: 1, borderColor: `${C.gold}30`,
                      borderRadius: 10, padding: 12, marginTop: 4, flexDirection: 'row', gap: 10, alignItems: 'center'
                    }}>
                      <Text style={{ fontSize: 16 }}>ℹ️</Text>
                      <Text style={{ flex: 1, color: C.muted, fontSize: 11, lineHeight: 16 }}>
                        {isRTL 
                          ? 'تنبيه: سيتم تسجيل الشركة كـ "غير موثقة" في النظام بانتظار مراجعة الإدارة ومستندات الترخيص. بعد إنشائها ستحصل على كود دعوة لمشاركته مع زملائك.'
                          : 'Note: The firm will be created as "Unverified" pending admin review of the registration documents. You will receive a join code to share with your colleagues.'}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {form.practitioner_type === 'independent' && (
              <Inp C={C} label={isRTL ? 'اسم المكتب (اختياري) 🏢' : 'Office Name (Optional) 🏢'} value={form.officeName} onChangeText={(v: string) => updateForm('officeName', v)} placeholder={isRTL ? 'مثال: مكتب حسن وشركاه للمحاماة' : 'e.g. Hassan & Associates Law Firm'} />
            )}

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

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <Btn C={C} variant="ghost" onPress={() => setStep(3)} style={{ flex: 1, borderWidth: 1, borderColor: C.border }}>
                {isRTL ? '← رجوع' : '← Back'}
              </Btn>
              <Btn C={C} onPress={async () => {
                // If they are firm member & creating a new firm:
                if (form.practitioner_type === 'firm_member' && firmMode === 'create') {
                  if (!newFirmName.trim()) {
                    Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'يرجى إدخال اسم الشركة' : 'Please enter the firm name');
                    return;
                  }
                  if (!newFirmBarReg.trim()) {
                    Alert.alert(isRTL ? 'تنبيه' : 'Alert', isRTL ? 'يرجى إدخال رقم قيد الشركة بالنقابة' : 'Please enter the firm Bar registration number');
                    return;
                  }
                  setLoading(true);
                  try {
                    const res: any = await firmsAPI.create({
                      name: newFirmName.trim(),
                      city: form.city || 'Cairo',
                      website: newFirmWebsite.trim() || undefined,
                      phone: newFirmPhone.trim() || undefined,
                      bar_registration_number: newFirmBarReg.trim(),
                      document_url: newFirmDocUrl || undefined
                    });
                    const newFirm = res.firm;
                    if (newFirm) {
                      setFirmsList(prev => [newFirm, ...prev]);
                      updateForm('firm_id', newFirm.id);
                      updateForm('invite_code', newFirm.invite_code);
                      setStep(5);
                    } else {
                      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل إنشاء الشركة' : 'Failed to create firm');
                    }
                  } catch (e: any) {
                    const errorMsg = isRTL ? (e?.message || e?.message_ar) : (e?.message_en || e?.message);
                    Alert.alert(isRTL ? 'خطأ' : 'Error', errorMsg || (isRTL ? 'تعذر إنشاء الشركة' : 'Could not create firm'));
                  } finally {
                    setLoading(false);
                  }
                } else {
                  setStep(5);
                }
              }} style={{ flex: 2 }} disabled={!form.syndicateId || !form.experience || (form.practitioner_type === 'firm_member' && firmMode === 'join' && !form.firm_id) || (form.practitioner_type === 'firm_member' && firmMode === 'join' && !requestPendingJoin && inviteCodeValid !== true) || (form.practitioner_type === 'firm_member' && firmMode === 'create' && (!newFirmName.trim() || !newFirmBarReg.trim())) || loading}>
                {loading ? (isRTL ? '⏳ جاري المعالجة...' : '⏳ Processing...') : (isRTL ? 'متابعة ←' : 'Continue →')}
              </Btn>
            </View>
          </View>
        )}

        {/* STEP 5: Identity Verification via Face Match */}
        {step === 5 && (
          <View style={{ flex: 1 }}>
            <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <Text style={{ fontSize: 28 }}>🤖</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>
                  {isRTL ? 'التحقق البيومتري من الهوية' : 'Biometric ID Verification'}
                </Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                  {isRTL ? 'تطابق صورتك مع صورتك في البطاقة المهنية أو الهوية' : 'Match your selfie to your ID or Bar Association License'}
                </Text>
              </View>
            </View>

            <View style={{ gap: 16, marginBottom: 24 }}>
              <TouchableOpacity disabled={verifying} onPress={async () => {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if(status !== 'granted') return Alert.alert('Error','Camera access needed');
                const res = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: true, aspect: [16, 9] });
                if(!res.canceled) {
                  updateForm('idPhotoUri', res.assets[0].uri);
                  setVerifiedAi(false);
                  setMatchError('');
                }
              }} style={{ height: 120, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: form.idPhotoUri ? C.green : C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {form.idPhotoUri ? (
                  <Image source={{ uri: form.idPhotoUri }} style={{ width: '100%', height: '100%', opacity: 0.8, resizeMode: 'contain' }} />
                ) : (
                  <>
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>🪪</Text>
                    <Text style={{ color: C.text, fontWeight: '600' }}>{isRTL ? 'صورة البطاقة (الوجه الأمامي)' : 'ID Front Photo'}</Text>
                  </>
                )}
                {form.idPhotoUri && <View style={{ position: 'absolute', backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 8 }}><Text style={{ color: '#fff', fontSize: 12 }}>✓ {isRTL ? 'مرفق الوجه الأمامي' : 'Front Attached'}</Text></View>}
              </TouchableOpacity>

              <TouchableOpacity disabled={verifying} onPress={async () => {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if(status !== 'granted') return Alert.alert('Error','Camera access needed');
                const res = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: true, aspect: [16, 9] });
                if(!res.canceled) {
                  updateForm('idBackUri', res.assets[0].uri);
                  setVerifiedAi(false);
                  setMatchError('');
                }
              }} style={{ height: 120, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: form.idBackUri ? C.green : C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {form.idBackUri ? (
                  <Image source={{ uri: form.idBackUri }} style={{ width: '100%', height: '100%', opacity: 0.8, resizeMode: 'contain' }} />
                ) : (
                  <>
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>🪪</Text>
                    <Text style={{ color: C.text, fontWeight: '600' }}>{isRTL ? 'صورة البطاقة (الوجه الخلفي)' : 'ID Back Photo'}</Text>
                  </>
                )}
                {form.idBackUri && <View style={{ position: 'absolute', backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 8 }}><Text style={{ color: '#fff', fontSize: 12 }}>✓ {isRTL ? 'مرفق الوجه الخلفي' : 'Back Attached'}</Text></View>}
              </TouchableOpacity>

              <TouchableOpacity disabled={verifying} onPress={async () => {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if(status !== 'granted') return;
                const res = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.5 });
                if(!res.canceled) {
                  updateForm('selfieUri', res.assets[0].uri);
                  setVerifiedAi(false);
                  setMatchError('');
                }
              }} style={{ height: 120, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: form.selfieUri ? C.green : C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {form.selfieUri ? (
                  <Image source={{ uri: form.selfieUri }} style={{ width: '100%', height: '100%', opacity: 0.8, resizeMode: 'cover' }} />
                ) : (
                  <>
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>🤳</Text>
                    <Text style={{ color: C.text, fontWeight: '600' }}>{isRTL ? 'التقط صورة سيلفي مباشر' : 'Take a Live Selfie'}</Text>
                  </>
                )}
                {form.selfieUri && <View style={{ position: 'absolute', backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 8 }}><Text style={{ color: '#fff', fontSize: 12 }}>✓ {isRTL ? 'مرفق السيلفي' : 'Selfie Attached'}</Text></View>}
              </TouchableOpacity>
            </View>

            {verifying && (
              <View style={{ alignItems: 'center', marginVertical: 20 }}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>{aiText.includes('✓') ? '✅' : '⏳'}</Text>
                <Text style={{ color: C.gold, fontSize: 15, fontWeight: '700' }}>{aiText}</Text>
              </View>
            )}

            {!verifying && verifiedAi && (
              <View style={{ backgroundColor: C.green + '15', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 24 }}>
                <Text style={{ color: C.green, fontWeight: '700', fontSize: 14 }}>✅ {isRTL ? 'تمت المطابقة البيومترية بنجاح!' : 'Biometric Match Successful!'}</Text>
              </View>
            )}

            {matchError ? (
              <View style={{ backgroundColor: C.red + '15', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: C.red + '40' }}>
                <Text style={{ color: C.red, fontWeight: '700', fontSize: 14, textAlign: 'center', marginBottom: 6 }}>❌ {isRTL ? 'فشل المطابقة' : 'Match Failed'}</Text>
                <Text style={{ color: C.red, fontSize: 13, textAlign: 'center' }}>{matchError}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 'auto' }}>
              <Btn C={C} variant="ghost" onPress={() => setStep(4)} style={{ flex: 1, borderWidth: 1, borderColor: C.border }} disabled={verifying}>
                {isRTL ? '← رجوع' : '← Back'}
              </Btn>
              
              {!verifiedAi ? (
                <Btn C={C} onPress={async () => {
                  setVerifying(true);
                  setMatchError(''); // clear previous error
                  setAiText(isRTL ? '🔍 جاري رفع ومطابقة الصور...' : '🔍 Uploading & matching faces...');
                  
                  try {
                    const fd = new FormData();
                    fd.append('idPhoto', { uri: form.idPhotoUri, name: 'id.jpg', type: 'image/jpeg' } as any);
                    fd.append('idBackPhoto', { uri: form.idBackUri, name: 'id_back.jpg', type: 'image/jpeg' } as any);
                    fd.append('selfie', { uri: form.selfieUri, name: 'selfie.jpg', type: 'image/jpeg' } as any);
                    
                    const { verificationAPI } = require('../../src/services/api');
                    const res = await verificationAPI.faceMatch(fd);
                    
                    if (res.match) {
                      setAiText(isRTL ? '✓ تم التحقق بنجاح!' : '✓ Verification Successful!');
                      setVerifiedAi(true);
                    }
                  } catch (e: any) {
                    setMatchError(e?.message || (isRTL ? 'حدث خطأ أثناء المطابقة.' : 'An error occurred during matching.'));
                  } finally {
                    setVerifying(false);
                  }
                }} style={{ flex: 2 }} disabled={!form.idPhotoUri || !form.idBackUri || !form.selfieUri || verifying}>
                  {isRTL ? (verifying ? 'جاري الفحص...' : 'بدء فحص التطابق 🤖') : (verifying ? 'Scanning...' : 'Start AI Match 🤖')}
                </Btn>
              ) : (
                <Btn C={C} onPress={() => setStep(6)} style={{ flex: 2, backgroundColor: C.green }}>
                  {isRTL ? 'متابعة ←' : 'Continue →'}
                </Btn>
              )}
            </View>
          </View>
        )}

        {/* STEP 6: Review & Submit */}
        {step === 6 && (
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
              ].map(([lbl, val], i) => (
                <View key={lbl} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: C.border }}>
                  <Text style={{ color: C.muted, fontSize: 13 }}>{lbl}</Text>
                  <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>{val}</Text>
                </View>
              ))}
              <View style={{ backgroundColor: C.green + '15', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 12, gap: 4 }}>
                <Text style={{ color: C.green, fontWeight: '700', fontSize: 12 }}>
                  ✓ {isRTL ? 'تم التحقق من رقم الهاتف' : 'Phone number verified'}
                </Text>
                <Text style={{ color: C.green, fontWeight: '700', fontSize: 12 }}>
                  🤖 {isRTL ? 'تمت مطابقة الهوية والوجه' : 'ID & Face securely matched'}
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
              <Btn C={C} variant="ghost" onPress={() => setStep(5)} style={{ flex: 1, borderWidth: 1, borderColor: C.border }} disabled={loading}>
                {isRTL ? '← رجوع' : '← Back'}
              </Btn>
              <Btn C={C} onPress={async () => {
                if(form.idPhotoUri && form.selfieUri){
                  try {
                    // Upload asynchronously, we don't wait for it to strictly complete just upload it
                    const d1 = new FormData(); d1.append('file', {uri:form.idPhotoUri, name:'id.jpg', type:'image/jpeg'} as any); d1.append('folder', 'verification_docs');
                    const d2 = new FormData(); d2.append('file', {uri:form.selfieUri, name:'selfie.jpg', type:'image/jpeg'} as any); d2.append('folder', 'verification_docs');
                    uploadAPI.upload(d1).catch(()=>{});
                    uploadAPI.upload(d2).catch(()=>{});
                  }catch(e){}
                }
                handleSubmit();
              }} style={{ flex: 2 }} disabled={loading}>
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
