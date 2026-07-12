import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { setUser, selUser } from '../src/features/auth/authSlice';
import { useTheme } from '../src/hooks/useTheme';
import { Btn, Inp } from '../src/components/ui';
import { lawyersAPI, authAPI, uploadAPI, firmsAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import type { AppDispatch } from '../src/store';
import { useI18n } from '../src/i18n';

const SPECIALIZATIONS_AR = [
  'قانون الأسرة والأحوال الشخصية','القانون الجنائي والدفاع',
  'قانون الشركات والتجارة','قانون العقارات والإيجارات',
  'قانون العمل والتوظيف','القانون المدني','القانون الإداري',
  'قانون الملكية الفكرية','قانون الهجرة','قانون الضرائب',
  'قانون البنوك والتمويل','قانون الطب الشرعي',
];
const SPECIALIZATIONS_EN = [
  'Family & Personal Law','Criminal Defense',
  'Corporate & Commercial Law','Real Estate & Rental Law',
  'Labour & Employment Law','Civil Law','Administrative Law',
  'Intellectual Property Law','Immigration Law','Tax Law',
  'Banking & Finance Law','Forensic Law',
];

const CITIES_AR  = ['القاهرة','الجيزة','الإسكندرية','المنصورة','طنطا','أسيوط','الأقصر','أسوان','الإسماعيلية','بورسعيد'];
const CITIES_EN  = ['Cairo','Giza','Alexandria','Mansoura','Tanta','Asyut','Luxor','Aswan','Ismailia','Port Said'];

const DAYS_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const DAYS_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SLOTS   = ['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];

export default function LawyerSetupScreen() {
  const C        = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const user     = useSelector(selUser);
  const insets   = useSafeAreaInsets();
  const { isRTL } = useI18n();

  // Bilingual derived data
  const SPECIALIZATIONS = isRTL ? SPECIALIZATIONS_AR : SPECIALIZATIONS_EN;
  const CITIES  = isRTL ? CITIES_AR : CITIES_EN;
  const DAYS    = isRTL ? DAYS_AR : DAYS_EN;
  const STEPS   = isRTL
    ? ['معلوماتك المهنية','جدول العمل','الأسعار','المستندات']
    : ['Professional Info','Schedule','Pricing','Documents'];

  const [step,     setStep]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    specialization: '', city: '', experience_years: '', bar_number: '',
    bio: '', consultation_fee: 400, office: '',
    practitioner_type: 'independent', firm_id: null as string | null,
    invite_code: '',
  });

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
          updP('firm_id', res.firm.id);
          updP('invite_code', trimmedCode);
          setShowFirmDropdown(false);
        } else {
          setInviteCodeValid(false);
          updP('invite_code', '');
        }
      } catch (e) {
        setInviteCodeValid(false);
        updP('invite_code', '');
      } finally {
        setVerifyingCode(false);
      }
    } else {
      setInviteCodeValid(null);
      updP('invite_code', '');
    }
  };

  useEffect(() => {
    // Fetch firms list to let users choose during setup
    firmsAPI.list({ limit: 100 }).then((res: any) => {
      setFirmsList(res.firms || []);
    }).catch(() => {});
  }, []);

  const filteredFirms = firmsList.filter(f => f.name.toLowerCase().includes(firmSearch.toLowerCase()));

  const [schedule, setSchedule] = useState<Record<number, string[]>>({
    0: [], 1: ['9:00','10:00','11:00','14:00','15:00'],
    2: ['9:00','10:00','11:00','14:00','15:00'], 3: ['9:00','10:00','11:00'],
    4: ['9:00','10:00','11:00','14:00','15:00'], 5: [], 6: [],
  });
  const [prices, setPrices] = useState({
    text: 200, voice: 400, video: 600, inperson: 800, document: 350,
  });
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [zoomLink, setZoomLink] = useState('');

  const updP = (k: string, v: any) => setProfile(p => ({ ...p, [k]: v }));
  const toggleSlot = (d: number, s: string) => setSchedule(p => {
    const a = [...(p[d] || [])];
    const i = a.indexOf(s);
    if (i >= 0) a.splice(i, 1); else a.push(s);
    return { ...p, [d]: a };
  });

  const saveStep1 = async () => {
    if (!profile.specialization || !profile.city || !profile.experience_years || !profile.bar_number) {
      Alert.alert('', isRTL ? 'يرجى ملء جميع الحقول الإلزامية' : 'Please fill all required fields');
      return;
    }
    if (profile.practitioner_type === 'firm_member') {
      if (firmMode === 'join') {
        if (!profile.firm_id) {
          Alert.alert('', isRTL ? 'يرجى اختيار شركة المحاماة التي تنتمي إليها' : 'Please select the Law Firm you belong to');
          return;
        }
        if (!requestPendingJoin && inviteCodeValid !== true) {
          Alert.alert('', isRTL ? 'يرجى إدخال كود الدعوة الصحيح للانضمام للشركة أو تفعيل خيار طلب الانضمام' : 'Please enter the correct invite code to join this firm or check the Request to Join option');
          return;
        }
      }
      if (firmMode === 'create' && !newFirmName.trim()) {
        Alert.alert('', isRTL ? 'يرجى إدخال اسم الشركة' : 'Please enter the firm name');
        return;
      }
    }
    setLoading(true);
    try {
      let finalFirmId = profile.firm_id;
      let finalInviteCode = profile.invite_code;

      if (profile.practitioner_type === 'firm_member' && firmMode === 'create') {
        const res: any = await firmsAPI.create({
          name: newFirmName.trim(),
          city: profile.city || 'Cairo',
          website: newFirmWebsite.trim() || undefined,
          phone: newFirmPhone.trim() || undefined
        });
        const newFirm = res.firm;
        if (newFirm) {
          finalFirmId = newFirm.id;
          finalInviteCode = newFirm.invite_code;
          updP('firm_id', newFirm.id);
          updP('invite_code', newFirm.invite_code);
          // Show the generated invite code to the creator
          Alert.alert(
            isRTL ? 'تم إنشاء الشركة' : 'Firm Created',
            isRTL 
              ? `تم إنشاء شركة "${newFirmName}" بنجاح! كود الدعوة الخاص بك هو: ${newFirm.invite_code}`
              : `Firm "${newFirmName}" created successfully! Your shareable invite code is: ${newFirm.invite_code}`
          );
        } else {
          Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل إنشاء الشركة' : 'Failed to create firm');
          setLoading(false);
          return;
        }
      }

      // Always store the Arabic value for the backend
      const specIndexEn = SPECIALIZATIONS_EN.indexOf(profile.specialization);
      const specIndexAr = SPECIALIZATIONS_AR.indexOf(profile.specialization);
      const specAr = specIndexEn >= 0 ? SPECIALIZATIONS_AR[specIndexEn] : (specIndexAr >= 0 ? profile.specialization : profile.specialization);

      const cityIndexEn = CITIES_EN.indexOf(profile.city);
      const cityIndexAr = CITIES_AR.indexOf(profile.city);
      const cityAr = cityIndexEn >= 0 ? CITIES_AR[cityIndexEn] : (cityIndexAr >= 0 ? profile.city : profile.city);

      await lawyersAPI.saveProfile({
        ...profile,
        firm_id: finalFirmId,
        invite_code: finalInviteCode,
        specialization: specAr,
        city: cityAr
      });
      setStep(2);
    } catch (e: any) {
      const errorMsg = isRTL ? (e?.message || e?.message_ar) : (e?.message_en || e?.message);
      Alert.alert(isRTL ? 'خطأ' : 'Error', errorMsg || (isRTL ? 'تعذر حفظ البيانات' : 'Could not save profile'));
    } finally {
      setLoading(false);
    }
  };

  const saveStep2 = async () => {
    setLoading(true);
    try { await lawyersAPI.saveAvailability(schedule); } catch {}
    setLoading(false); setStep(3);
  };

  const saveStep3 = async () => {
    if (zoomLink.trim() && !zoomLink.trim().startsWith('http://') && !zoomLink.trim().startsWith('https://')) {
      Alert.alert(
        isRTL ? 'رابط غير صالح' : 'Invalid Link',
        isRTL
          ? 'يجب أن يبدأ رابط زووم بـ http:// أو https://'
          : 'Zoom link must start with http:// or https://',
      );
      return;
    }
    setLoading(true);
    try {
      await lawyersAPI.saveProfile({
        consultation_fee: prices.voice,
        service_prices: prices,
        zoom_link: zoomLink.trim() || null,
      });
    } catch {}
    setLoading(false); setStep(4);
  };

  const pickAndUpload = async (key: string, label: string) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
      if (res.canceled) return;
      const file = res.assets[0];
      setUploading(key);
      const formData = new FormData();
      formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
      formData.append('folder', 'lawyer_verification');
      formData.append('doc_type', key);
      await uploadAPI.upload(formData);
      setDocs(prev => ({ ...prev, [key]: file.name }));
      Alert.alert('✅', isRTL ? `تم رفع ${label} بنجاح!` : `${label} uploaded successfully!`);
    } catch (e: any) {
      if (!e?.message?.includes('cancel'))
        Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || (isRTL ? 'تعذر رفع الملف' : 'Upload failed'));
    } finally { setUploading(null); }
  };

  const finish = async () => {
    setLoading(true);
    try {
      const updated: any = await authAPI.updateProfile({ name: user?.name });
      if (updated) dispatch(setUser({ ...user, ...updated }));
    } catch {}
    setLoading(false);
    Alert.alert(
      isRTL ? 'تم بنجاح! 🎉' : 'Success! 🎉',
      isRTL ? 'تم إرسال ملفك للمراجعة. سيتم الرد خلال 24 ساعة.' : 'Your profile has been submitted for review. We\'ll verify it within 24 hours.',
      [{ text: isRTL ? 'متابعة' : 'Continue', onPress: () => router.replace('/(lawyer-tabs)/' as any) }],
    );
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
          <Text style={{ color: C.gold, fontFamily: 'Cairo-Bold', fontSize: 20, fontWeight: '700' }}>
            ⚖️ {isRTL ? 'إعداد ملفك المهني' : 'Set Up Your Profile'}
          </Text>
        </View>
        <Text style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>
          {isRTL ? `الخطوة ${step} من 4: ${STEPS[step - 1]}` : `Step ${step} of 4: ${STEPS[step - 1]}`}
        </Text>
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
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 16 }}>
              {isRTL ? 'معلوماتك المهنية' : 'Professional Information'}
            </Text>

            {/* Practitioner Type Selection Cards */}
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>
              {isRTL ? 'نوع الممارسة *' : 'Practitioner Type *'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              <TouchableOpacity
                onPress={() => {
                  updP('practitioner_type', 'independent');
                  updP('firm_id', null);
                  updP('invite_code', '');
                }}
                style={{
                  flex: 1, backgroundColor: profile.practitioner_type === 'independent' ? `${C.gold}15` : C.card,
                  borderWidth: 1, borderColor: profile.practitioner_type === 'independent' ? C.gold : C.border,
                  borderRadius: 12, padding: 12, alignItems: 'center'
                }}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>👤</Text>
                <Text style={{ color: profile.practitioner_type === 'independent' ? C.gold : C.text, fontSize: 13, fontWeight: 'bold', fontFamily: 'Cairo-Bold' }}>
                  {isRTL ? 'مكتب خاص / مستقل' : 'Solo Practice / Independent'}
                </Text>
                <Text style={{ color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 2 }}>
                  {isRTL ? 'ممارس مستقل أو صاحب مكتب خاص' : 'Solo practitioner or private office owner'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => updP('practitioner_type', 'firm_member')}
                style={{
                  flex: 1, backgroundColor: profile.practitioner_type === 'firm_member' ? `${C.gold}15` : C.card,
                  borderWidth: 1, borderColor: profile.practitioner_type === 'firm_member' ? C.gold : C.border,
                  borderRadius: 12, padding: 12, alignItems: 'center'
                }}
              >
                <Text style={{ fontSize: 20, marginBottom: 4 }}>🏢</Text>
                <Text style={{ color: profile.practitioner_type === 'firm_member' ? C.gold : C.text, fontSize: 13, fontWeight: 'bold', fontFamily: 'Cairo-Bold' }}>
                  {isRTL ? 'شركة محاماة' : 'Law Firm'}
                </Text>
                <Text style={{ color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 2 }}>
                  {isRTL ? 'تعمل مع مؤسسة قانونية' : 'Work under a firm'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Firm Association / Creation flow */}
            {profile.practitioner_type === 'firm_member' && (
              <View style={{ marginBottom: 14 }}>
                {/* Mode toggle (Join vs Create) */}
                <View style={{ flexDirection: 'row', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 3, marginBottom: 14 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setFirmMode('join');
                      updP('firm_id', null);
                      updP('invite_code', '');
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
                      updP('firm_id', null);
                      updP('invite_code', '');
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
                    <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>
                      {isRTL ? 'اختر شركة المحاماة التي تنتمي إليها *' : 'Select your Law Firm *'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setShowFirmDropdown(!showFirmDropdown)}
                      style={{
                        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                        borderRadius: 10, padding: 12, marginBottom: 12
                      }}
                    >
                      <Text style={{ color: profile.firm_id ? C.text : C.muted, fontSize: 14 }}>
                        {profile.firm_id 
                          ? (firmsList.find(f => f.id === profile.firm_id)?.name || (isRTL ? 'تم الاختيار' : 'Selected'))
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
                                updP('firm_id', firm.id);
                                setShowFirmDropdown(false);
                                setFirmSearch('');
                                // Reset invite code verification when selecting manually
                                setInviteCode('');
                                setInviteCodeValid(null);
                              }}
                              style={{
                                paddingVertical: 10, paddingHorizontal: 12,
                                borderBottomWidth: 1, borderBottomColor: C.border,
                                backgroundColor: profile.firm_id === firm.id ? `${C.gold}15` : 'transparent'
                              }}
                            >
                              <Text style={{ color: profile.firm_id === firm.id ? C.gold : C.text, fontSize: 13, fontWeight: profile.firm_id === firm.id ? 'bold' : 'normal' }}>
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
                      const selectedFirm = firmsList.find(f => f.id === profile.firm_id);
                      const hasWebsite = !!selectedFirm?.website;
                      return (
                        <>
                          {/* Verification Method Selection */}
                          {hasWebsite && (
                            <View style={{
                              flexDirection: 'row', backgroundColor: C.bg, padding: 3, borderRadius: 8,
                              marginBottom: 16, borderWidth: 1, borderColor: C.border
                            }}>
                              <TouchableOpacity
                                onPress={() => setVerificationMethod('email')}
                                style={{
                                  flex: 1, paddingVertical: 8, alignItems: 'center',
                                  backgroundColor: verificationMethod === 'email' ? C.card : 'transparent',
                                  borderRadius: 6
                                }}
                              >
                                <Text style={{ color: verificationMethod === 'email' ? C.gold : C.muted, fontSize: 11, fontFamily: 'Cairo-Bold', fontWeight: 'bold' }}>
                                  {isRTL ? 'إيميل الشركة المهني 📧' : 'Work Email 📧'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => setVerificationMethod('code')}
                                style={{
                                  flex: 1, paddingVertical: 8, alignItems: 'center',
                                  backgroundColor: verificationMethod === 'code' ? C.card : 'transparent',
                                  borderRadius: 6
                                }}
                              >
                                <Text style={{ color: verificationMethod === 'code' ? C.gold : C.muted, fontSize: 11, fontFamily: 'Cairo-Bold', fontWeight: 'bold' }}>
                                  {isRTL ? 'كود الدعوة 🔑' : 'Invite Code 🔑'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}

                          {verificationMethod === 'email' && hasWebsite ? (
                            <View style={{ marginBottom: 14 }}>
                              <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                                {isRTL ? 'البريد الإلكتروني المهني للشركة * 📧' : 'Professional Firm Email * 📧'}
                              </Text>
                              
                              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                                <TextInput
                                  value={professionalEmail}
                                  onChangeText={setProfessionalEmail}
                                  placeholder={isRTL ? 'مثال: omar@elnasr-law.com' : 'e.g. omar@elnasr-law.com'}
                                  keyboardType="email-address"
                                  autoCapitalize="none"
                                  editable={!emailOtpVerified}
                                  style={{
                                    flex: 1, backgroundColor: C.card, color: emailOtpVerified ? C.muted : C.text,
                                    borderWidth: 1, borderColor: emailOtpVerified ? C.green : C.border,
                                    borderRadius: 10, padding: 12, fontSize: 14, textAlign: isRTL ? 'right' : 'left'
                                  }}
                                />
                                {!emailOtpVerified && (
                                  <TouchableOpacity
                                    onPress={handleSendEmailOtp}
                                    disabled={sendingEmailOtp || !professionalEmail.trim()}
                                    style={{
                                      backgroundColor: C.gold, paddingHorizontal: 16, justifyContent: 'center',
                                      borderRadius: 10, opacity: (!professionalEmail.trim() || sendingEmailOtp) ? 0.6 : 1
                                    }}
                                  >
                                    <Text style={{ color: C.bg, fontSize: 13, fontWeight: '700', fontFamily: 'Cairo-Bold' }}>
                                      {sendingEmailOtp ? (isRTL ? '⏳ جاري...' : '⏳ Sending...') : (isRTL ? 'إرسال الرمز' : 'Send Code')}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>

                              {selectedFirm?.website && (
                                <Text style={{ color: C.muted, fontSize: 11, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
                                  {isRTL 
                                    ? `💡 يجب أن ينتهي بريدك بـ @${selectedFirm.website.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]}`
                                    : `💡 Email must end with @${selectedFirm.website.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]}`}
                                </Text>
                              )}

                              {emailOtpSent && !emailOtpVerified && (
                                <View style={{ marginTop: 12 }}>
                                  <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                                    {isRTL ? 'كود التحقق (6 أرقام) * 🔢' : 'Verification Code (6-Digits) * 🔢'}
                                  </Text>
                                  <TextInput
                                    value={emailCode}
                                    onChangeText={handleVerifyEmailOtp}
                                    placeholder="123456"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    style={{
                                      backgroundColor: C.card, color: C.text, borderWidth: 1, borderColor: C.border,
                                      borderRadius: 10, padding: 12, fontSize: 16, textAlign: 'center', letterSpacing: 4
                                    }}
                                  />
                                  {verifyingEmailOtp && (
                                    <Text style={{ color: C.gold, fontSize: 11, marginTop: 6 }}>
                                      {isRTL ? '⏳ جاري التحقق...' : '⏳ Verifying...'}
                                    </Text>
                                  )}
                                </View>
                              )}

                              {emailOtpVerified && (
                                <View style={{
                                  marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: C.green + '15',
                                  borderWidth: 1, borderColor: C.green + '30', flexDirection: isRTL ? 'row-reverse' : 'row',
                                  alignItems: 'center', gap: 6
                                }}>
                                  <Ionicons name="checkmark-circle" size={16} color={C.green} />
                                  <Text style={{ color: C.green, fontSize: 12, fontWeight: '600', fontFamily: 'Cairo-Bold', flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                                    {isRTL ? '✓ تم التحقق من الإيميل المهني بنجاح! سيتم ربطك بالشركة وتوثيقك تلقائياً.' : '✓ Email verified! You will be linked and approved.'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          ) : (
                            <>
                              {/* Invite Code verification input */}
                              <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6, opacity: requestPendingJoin ? 0.5 : 1 }}>
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
                                  borderRadius: 10, padding: 12, fontSize: 14, textTransform: 'uppercase', marginBottom: 12,
                                  opacity: requestPendingJoin ? 0.6 : 1
                                }}
                              />
                              <View style={{ marginTop: -6, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                              </View>

                              <TouchableOpacity
                                onPress={() => {
                                  const nextVal = !requestPendingJoin;
                                  setRequestPendingJoin(nextVal);
                                  if (nextVal) {
                                    setInviteCode('');
                                    setInviteCodeValid(null);
                                    updP('invite_code', '');
                                  }
                                }}
                                style={{
                                  flexDirection: isRTL ? 'row-reverse' : 'row',
                                  alignItems: 'center',
                                  gap: 8,
                                  marginBottom: 16,
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
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>
                        {isRTL ? 'اسم الشركة * 🏛️' : 'Firm Name * 🏛️'}
                      </Text>
                      <TextInput value={newFirmName} onChangeText={setNewFirmName} placeholder={isRTL ? 'مثال: شركة النصر للاستشارات القانونية' : 'e.g. El-Nasr Law Firm'} placeholderTextColor={C.muted} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 11, color: C.text, fontSize: 14 }} />
                    </View>
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>
                        {isRTL ? 'موقع الشركة الإلكتروني (اختياري) 🌐' : 'Firm Website (Optional) 🌐'}
                      </Text>
                      <TextInput value={newFirmWebsite} onChangeText={setNewFirmWebsite} placeholder="https://example.com" placeholderTextColor={C.muted} keyboardType="url" autoCapitalize="none" style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 11, color: C.text, fontSize: 14 }} />
                    </View>
                    <View style={{ marginBottom: 12 }}>
                      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>
                        {isRTL ? 'هاتف الشركة (اختياري) 📞' : 'Firm Phone (Optional) 📞'}
                      </Text>
                      <TextInput value={newFirmPhone} onChangeText={setNewFirmPhone} placeholder="02XXXXXXXX" placeholderTextColor={C.muted} keyboardType="phone-pad" style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 11, color: C.text, fontSize: 14 }} />
                    </View>
                    
                    <View style={{
                      backgroundColor: `${C.gold}10`, borderWidth: 1, borderColor: `${C.gold}30`,
                      borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 12, flexDirection: 'row', gap: 10, alignItems: 'center'
                    }}>
                      <Text style={{ fontSize: 16 }}>ℹ️</Text>
                      <Text style={{ flex: 1, color: C.muted, fontSize: 11, lineHeight: 16 }}>
                        {isRTL 
                          ? 'تنبيه: سيتم تسجيل الشركة كـ "غير موثقة" في النظام بانتظار مراجعة الإدارة. بعد حفظ البيانات ستحصل على كود دعوة لمشاركته مع زملائك.'
                          : 'Note: The firm will be created as "Unverified" pending admin review. You will receive a join code to share with your colleagues.'}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}

            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>
              {isRTL ? 'التخصص القانوني *' : 'Legal Specialization *'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {SPECIALIZATIONS.map((s, idx) => (
                <TouchableOpacity key={s} onPress={() => updP('specialization', s)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: profile.specialization === s ? C.gold : C.border, backgroundColor: profile.specialization === s ? C.gold + '20' : 'transparent' }}>
                  <Text style={{ color: profile.specialization === s ? C.gold : C.muted, fontSize: 12 }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>
              {isRTL ? 'المدينة *' : 'City *'}
            </Text>
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
                <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>
                  {isRTL ? 'سنوات الخبرة *' : 'Years of Experience *'}
                </Text>
                <TextInput value={profile.experience_years} onChangeText={v => updP('experience_years', v)}
                  placeholder={isRTL ? 'مثال: 8' : 'e.g. 8'} placeholderTextColor={C.muted} keyboardType="number-pad"
                  style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 11, color: C.text, fontSize: 14 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>
                  {isRTL ? 'رقم نقابة المحامين *' : 'Bar Association No. *'}
                </Text>
                <TextInput value={profile.bar_number} onChangeText={v => updP('bar_number', v)}
                  placeholder={isRTL ? 'مثال: 12345/2010' : 'e.g. 12345/2010'} placeholderTextColor={C.muted}
                  style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 11, color: C.text, fontSize: 14 }} />
              </View>
            </View>

            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6, marginTop: 12 }}>
              📝 {isRTL ? 'نبذة مهنية' : 'Professional Bio'}
            </Text>
            <TextInput value={profile.bio} onChangeText={v => updP('bio', v)} multiline numberOfLines={4}
              placeholder={isRTL ? 'اكتب عن تخصصك وخبراتك وما يميزك...' : 'Tell clients about your background, expertise and what sets you apart...'}
              placeholderTextColor={C.muted}
              style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, color: C.text, fontSize: 13, textAlignVertical: 'top', minHeight: 90, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }} />

            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 6 }}>
              📍 {isRTL ? 'عنوان المكتب (اختياري)' : 'Office Address (Optional)'}
            </Text>
            <TextInput value={profile.office} onChangeText={v => updP('office', v)}
              placeholder={isRTL ? 'أدخل عنوان مكتبك بالتفصيل لسهولة وصول العملاء' : 'Enter your detailed office address'}
              placeholderTextColor={C.muted}
              style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 11, color: C.text, fontSize: 14, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }} />

            <Btn C={C} full size="lg"
              disabled={loading || !profile.specialization || !profile.city || !profile.experience_years || !profile.bar_number}
              onPress={saveStep1}>
              {loading ? (isRTL ? '⏳ جاري الحفظ...' : '⏳ Saving...') : (isRTL ? 'التالي: جدول عملك ←' : 'Next: Your Schedule →')}
            </Btn>
          </>
        )}

        {/* Step 2 — Schedule */}
        {step === 2 && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
              {isRTL ? 'جدول أوقات عملك' : 'Your Availability Schedule'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
              {isRTL ? 'حدد الأيام والأوقات التي تكون فيها متاحاً' : 'Select the days and times you are available'}
            </Text>
            {DAYS.map((day, d) => {
              const daySlots = schedule[d] || [];
              const isOff    = daySlots.length === 0;
              return (
                <View key={d} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: isOff ? 0 : 12 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{day}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {isOff && <Text style={{ color: C.muted, fontSize: 12 }}>{isRTL ? 'إجازة' : 'Off'}</Text>}
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
              {loading ? '⏳' : (isRTL ? 'التالي: الأسعار ←' : 'Next: Pricing →')}
            </Btn>
          </>
        )}

        {/* Step 3 — Pricing */}
        {step === 3 && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
              {isRTL ? 'أسعار خدماتك' : 'Your Service Pricing'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
              {isRTL ? 'حدد سعراً تنافسياً. المتوسط في المنصة 400–600 جنيه للمكالمة الصوتية.' : 'Set competitive pricing. Platform average is 400–600 EGP for voice calls.'}
            </Text>
            {(([
              ['text','💬', isRTL ? 'استشارة نصية' : 'Text Consultation'],
              ['voice','📞', isRTL ? 'مكالمة صوتية' : 'Voice Call'],
              ['video','📹', isRTL ? 'استشارة فيديو' : 'Video Consultation'],
              ['inperson','🏛️', isRTL ? 'حضور شخصي' : 'In-Person Meeting'],
              ['document','📄', isRTL ? 'مراجعة مستند' : 'Document Review'],
            ]) as [keyof typeof prices, string, string][]).map(([k, icon, lb]) => (
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
                  <Text style={{ color: C.muted, fontSize: 12 }}>{isRTL ? 'ج' : 'EGP'}</Text>
                </View>
              </View>
            ))}

            <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>
                {isRTL ? 'رابط زووم للاستشارات (اختياري حالياً)' : 'Zoom Consultation Link (Optional for now)'}
              </Text>
              <TextInput
                value={zoomLink}
                onChangeText={setZoomLink}
                placeholder="https://zoom.us/j/..."
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                keyboardType="url"
                style={{ backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, color: C.text, fontSize: 14, textAlign: 'left' }}
              />
            </View>

            <Btn C={C} full disabled={loading} onPress={saveStep3}>
              {loading ? '⏳' : (isRTL ? 'التالي: المستندات ←' : 'Next: Documents →')}
            </Btn>
          </>
        )}

        {/* Step 4 — Documents */}
        {step === 4 && (
          <>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, marginBottom: 4 }}>
              {isRTL ? 'مستندات التوثيق' : 'Verification Documents'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
              {isRTL ? 'ارفع مستنداتك لإتمام التحقق من هويتك. سيراجعها فريقنا خلال 24 ساعة.' : 'Upload your documents to complete verification. Our team will review them within 24 hours.'}
            </Text>

            {([
              ['national_id','🪪', isRTL ? 'بطاقة الرقم القومي (مطلوب)' : 'National ID Card (Required)', isRTL ? 'صورة واضحة من الوجهتين' : 'Clear scan of both sides'],
              ['bar_card','⚖️',   isRTL ? 'كارنيه نقابة المحامين (مطلوب)' : 'Bar Association Card (Required)', isRTL ? 'بطاقة سارية المفعول' : 'Must be valid and current'],
              ['photo','📸',      isRTL ? 'صورة شخصية مهنية' : 'Professional Headshot', isRTL ? 'خلفية بيضاء أو محايدة' : 'Plain or neutral background'],
              ['tax_return','📄', isRTL ? 'إقرار ضريبي (اختياري)' : 'Tax Return (Optional)', isRTL ? 'يساعد في رفع تقييمك وموثوقيتك' : 'Boosts your trust score on the platform'],
            ] as [string, string, string, string][]).map(([key, icon, label, hint]) => {
              const isUploaded  = !!docs[key];
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
                          <Text style={{ color: C.gold, fontSize: 12, fontWeight: '700' }}>
                            {isRTL ? 'رفع' : 'Upload'}
                          </Text>
                        </TouchableOpacity>
                      )
                    }
                  </View>
                </View>
              );
            })}

            <View style={{ backgroundColor: C.gold + '12', borderWidth: 1, borderColor: C.gold + '25', borderRadius: 12, padding: 14, marginBottom: 20 }}>
              <Text style={{ color: C.muted, fontSize: 12 }}>
                🔒 {isRTL ? 'مستنداتك محمية ومشفرة. لن تُشارك مع أي طرف ثالث.' : 'Your documents are encrypted and will never be shared with third parties.'}
              </Text>
            </View>

            <Btn C={C} full disabled={loading} onPress={finish}>
              {loading ? (isRTL ? '⏳ جاري الإرسال...' : '⏳ Submitting...') : (isRTL ? '✅ إرسال الملف للمراجعة' : '✅ Submit for Review')}
            </Btn>
            <TouchableOpacity onPress={finish} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: C.muted, fontSize: 12 }}>
                {isRTL ? 'أكمل المستندات لاحقاً' : 'I\'ll finish documents later'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
