import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  KeyboardAvoidingView, Platform, Image, TextInput, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { selUser, setUser } from '../src/store/slices/authSlice';
import { useTheme } from '../src/theme';
import { Btn, Inp, Avatar, Card } from '../src/components/ui';
import { authAPI, uploadAPI, lawyersAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

// ─── Service types ───────────────────────────────────────────────────────────
// Aligned with everywhere else: 4 types, no phone.
const SERVICE_TYPES = [
  { id: 'video',    icon: '📹', ar: 'استشارة فيديو', en: 'Video Consultation' },
  { id: 'text',     icon: '💬', ar: 'استشارة نصية',  en: 'Text Consultation'  },
  { id: 'inperson', icon: '🏛️', ar: 'لقاء شخصي',     en: 'In-Person Meeting'  },
  { id: 'document', icon: '📄', ar: 'مراجعة وثيقة', en: 'Document Review'    },
];

const DEFAULT_PRICES = { video: 600, text: 200, inperson: 800, document: 350 };

export default function EditProfileScreen() {
  const C = useTheme();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const user = useSelector(selUser);
  const { isRTL } = useI18n();

  const isLawyer = user?.role === 'lawyer';

  const [form, setForm] = useState({
    name:  user?.name  || '',
    phone: user?.phone || '',
    bio:   user?.bio   || '',
  });
  const [pw, setPw]                 = useState({ current: '', new: '', confirm: '' });
  const [saving, setSaving]         = useState(false);
  const [pwSaving, setPwSaving]     = useState(false);

  // Lawyer-only state
  const [prices, setPrices]         = useState<Record<string, number>>(DEFAULT_PRICES);
  const [office, setOffice]         = useState('');
  const [coords, setCoords]         = useState<{ lat: number; lng: number } | null>(null);
  const [lawyerLoading, setLawyerLoading]   = useState(isLawyer);
  const [lawyerSaving, setLawyerSaving]     = useState(false);
  const [geocoding, setGeocoding]   = useState(false);

  const initials = (user?.name || 'U').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  // ── Load lawyer profile data ────────────────────────────────────────────
  useEffect(() => {
    if (!isLawyer) return;
    lawyersAPI.getMyProfile()
      .then((d: any) => {
        // Service prices: drop legacy 'phone'/'voice' keys
        if (d?.service_prices) {
          let sp = typeof d.service_prices === 'string' ? JSON.parse(d.service_prices) : d.service_prices;
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
        if (d?.office) setOffice(d.office);
        if (d?.office_lat && d?.office_lng) {
          setCoords({ lat: Number(d.office_lat), lng: Number(d.office_lng) });
        }
      })
      .catch(() => {})
      .finally(() => setLawyerLoading(false));
  }, [isLawyer]);

  // ── Geocode address to lat/lng (Nominatim, free) ────────────────────────
  const geocodeAddress = async () => {
    const q = office.trim();
    if (!q) {
      Alert.alert('', isRTL ? 'أدخل عنوان المكتب أولاً' : 'Enter the office address first');
      return;
    }
    setGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q + ', Egypt')}&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Wakeel.eg/1.0' } });
      const data = await res.json();
      if (data?.[0]) {
        setCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } else {
        Alert.alert('', isRTL ? 'لم يتم العثور على العنوان. جرب صياغة أخرى.' : "Couldn't locate that address. Try a different wording.");
      }
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e.message);
    } finally {
      setGeocoding(false);
    }
  };

  // ── Use current location ────────────────────────────────────────────────
  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('', isRTL ? 'نحتاج إذن الموقع' : 'Location permission required');
        return;
      }
      setGeocoding(true);
      const loc = await Location.getCurrentPositionAsync({});
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      // Reverse-geocode to populate the address text field
      const rev = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude, longitude: loc.coords.longitude,
      });
      if (rev?.[0]) {
        const r = rev[0];
        const addr = [r.street, r.streetNumber, r.district, r.city].filter(Boolean).join(', ');
        if (addr) setOffice(addr);
      }
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e.message);
    } finally {
      setGeocoding(false);
    }
  };

  // ── Save handlers ───────────────────────────────────────────────────────
  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('', isRTL ? 'نحتاج إذن الوصول للصور' : 'Photo library access required');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (!result.canceled) {
        setSaving(true);
        const formData = new FormData();
        formData.append('file', { uri: result.assets[0].uri, name: 'avatar.jpg', type: result.assets[0].mimeType || 'image/jpeg' } as any);
        formData.append('folder', 'avatars');
        try {
          const uploadRes: any = await uploadAPI.upload(formData);
          if (uploadRes?.url) {
            const updated: any = await authAPI.update({ avatar_url: uploadRes.url });
            dispatch(setUser(updated));
            Alert.alert('✅', isRTL ? 'تم تحديث الصورة الشخصية!' : 'Profile photo updated!');
          }
        } catch (e: any) { Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || (isRTL ? 'فشل الرفع' : 'Upload failed')); }
        finally { setSaving(false); }
      }
    } catch (e: any) { Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message); }
  };

  const pickCover = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('', isRTL ? 'نحتاج إذن الوصول للصور' : 'Photo library access required');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [16, 9], quality: 0.8,
      });
      if (!result.canceled) {
        setSaving(true);
        const formData = new FormData();
        formData.append('file', { uri: result.assets[0].uri, name: 'cover.jpg', type: result.assets[0].mimeType || 'image/jpeg' } as any);
        formData.append('folder', 'covers');
        try {
          const uploadRes: any = await uploadAPI.upload(formData);
          if (uploadRes?.url) {
            const updated: any = await authAPI.update({ cover_url: uploadRes.url });
            dispatch(setUser(updated));
            Alert.alert('✅', isRTL ? 'تم تحديث صورة الغلاف!' : 'Cover photo updated!');
          }
        } catch (e: any) { Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || (isRTL ? 'فشل الرفع' : 'Upload failed')); }
        finally { setSaving(false); }
      }
    } catch (e: any) { Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated: any = await authAPI.update(form);
      dispatch(setUser({ ...user, ...updated }));
      Alert.alert('✅', isRTL ? 'تم حفظ التغييرات' : 'Changes saved');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message);
    } finally { setSaving(false); }
  };

  const saveLawyerInfo = async () => {
    // Validate prices
    for (const t of SERVICE_TYPES) {
      const v = prices[t.id];
      if (v === undefined || v === null || isNaN(v) || v < 50 || v > 5000) {
        Alert.alert(
          isRTL ? 'سعر غير صحيح' : 'Invalid price',
          isRTL
            ? `سعر ${t.ar} يجب أن يكون بين 50 و 5000 جنيه`
            : `${t.en} price must be between 50 and 5000 EGP`,
        );
        return;
      }
    }
    setLawyerSaving(true);
    try {
      await lawyersAPI.saveProfile({
        service_prices:   prices,
        // Keep consultation_fee in sync as the lowest price (used for legacy
        // "from X EGP" displays)
        consultation_fee: Math.min(...Object.values(prices).map(Number)),
        office:           office.trim() || null,
        office_lat:       coords?.lat ?? null,
        office_lng:       coords?.lng ?? null,
      });
      Alert.alert('✅', isRTL ? 'تم حفظ معلومات المحامي' : 'Lawyer info saved');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || (isRTL ? 'فشل الحفظ' : 'Save failed'));
    } finally {
      setLawyerSaving(false);
    }
  };

  const changePassword = async () => {
    if (pw.new !== pw.confirm) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    if (pw.new.length < 8) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? '8 أحرف على الأقل' : 'Minimum 8 characters');
      return;
    }
    setPwSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: pw.current, newPassword: pw.new });
      Alert.alert('✅', isRTL ? 'تم تغيير كلمة المرور' : 'Password changed successfully');
      setPw({ current: '', new: '', confirm: '' });
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message);
    } finally { setPwSaving(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: C.surface, paddingTop: insets.top + 12,
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
        flexDirection: 'row', alignItems: 'center', gap: 10,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 20 }}>
          ✏️ {isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Avatar + cover row */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center' }}>
            <Avatar C={C} initials={initials} size={72} url={user?.avatar_url || user?.avatar} />
            <TouchableOpacity onPress={pickAvatar}>
              <Text style={{ color: C.gold, fontSize: 12, marginTop: 8, fontWeight: '700' }}>
                {isRTL ? 'تغيير الصورة 📸' : 'Change Photo 📸'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 120, height: 72, backgroundColor: C.border, borderRadius: 12, overflow: 'hidden' }}>
              {user?.cover_url && <Image source={{ uri: user.cover_url }} style={{ width: '100%', height: '100%' }} />}
            </View>
            <TouchableOpacity onPress={pickCover}>
              <Text style={{ color: C.gold, fontSize: 12, marginTop: 8, fontWeight: '700' }}>
                {isRTL ? 'تغيير الغلاف 🖼️' : 'Change Cover 🖼️'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Personal info */}
        <Card C={C} style={{ marginBottom: 16 }}>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 14 }}>
            {isRTL ? 'المعلومات الشخصية' : 'Personal Info'}
          </Text>
          <Inp C={C} label={isRTL ? 'الاسم الكامل' : 'Full name'} value={form.name} onChangeText={(v: string) => setForm(f => ({ ...f, name: v }))} placeholder={isRTL ? 'اسمك الكامل' : 'Your full name'} autoCapitalize="words" />
          <Inp C={C} label={isRTL ? 'رقم الهاتف' : 'Phone'} value={form.phone} onChangeText={(v: string) => setForm(f => ({ ...f, phone: v }))} placeholder={isRTL ? '01xxxxxxxxx' : '+20 1xx xxx xxxx'} keyboardType="phone-pad" />
          <Inp C={C} label={isRTL ? 'نبذة عنك' : 'Bio'} value={form.bio} onChangeText={(v: string) => setForm(f => ({ ...f, bio: v }))} placeholder={isRTL ? 'اكتب نبذة...' : 'Write a short bio...'} multiline numberOfLines={3} />
          <Btn C={C} full disabled={saving} onPress={saveProfile}>
            {saving ? (isRTL ? '⏳ جاري الحفظ...' : '⏳ Saving...') : (isRTL ? '💾 حفظ' : '💾 Save')}
          </Btn>
        </Card>

        {/* ─── LAWYER-ONLY: Service prices ─────────────────────────────── */}
        {isLawyer && (
          <Card C={C} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>
                💲 {isRTL ? 'أسعار الخدمات' : 'Service Prices'}
              </Text>
            </View>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>
              {isRTL
                ? 'حدد سعر كل نوع استشارة. هذا ما يدفعه العميل قبل رسوم المنصة.'
                : 'Set the price for each consultation type. Clients see this before platform fees.'}
            </Text>

            {lawyerLoading ? (
              <ActivityIndicator color={C.gold} style={{ marginVertical: 16 }} />
            ) : (
              <>
                {SERVICE_TYPES.map(svc => {
                  const val = prices[svc.id] ?? 0;
                  const tooLow  = val > 0 && val < 50;
                  const tooHigh = val > 5000;
                  return (
                    <View key={svc.id} style={{
                      backgroundColor: C.bg,
                      borderWidth: 1, borderColor: tooLow || tooHigh ? C.red + '60' : C.border,
                      borderRadius: 12, padding: 12, marginBottom: 10,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontSize: 22 }}>{svc.icon}</Text>
                        <Text style={{ flex: 1, color: C.text, fontWeight: '600', fontSize: 13 }}>
                          {isRTL ? svc.ar : svc.en}
                        </Text>
                        <TextInput
                          value={String(val)}
                          onChangeText={v => setPrices(p => ({ ...p, [svc.id]: parseInt(v) || 0 }))}
                          keyboardType="numeric"
                          style={{
                            width: 80, backgroundColor: C.card,
                            borderWidth: 1, borderColor: tooLow || tooHigh ? C.red : C.border,
                            borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
                            color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'center',
                          }}
                        />
                        <Text style={{ color: C.muted, fontSize: 12 }}>{isRTL ? 'ج' : 'EGP'}</Text>
                      </View>
                      {(tooLow || tooHigh) && (
                        <Text style={{ color: C.red, fontSize: 11, marginTop: 6 }}>
                          {tooLow
                            ? (isRTL ? '⚠️ السعر أقل من 50 ج' : '⚠️ Below 50 EGP minimum')
                            : (isRTL ? '⚠️ السعر أعلى من 5000 ج' : '⚠️ Above 5000 EGP maximum')}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </Card>
        )}

        {/* ─── LAWYER-ONLY: Office address + map ─────────────────────────── */}
        {isLawyer && (
          <Card C={C} style={{ marginBottom: 16 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>
              🏛️ {isRTL ? 'عنوان المكتب' : 'Office Address'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>
              {isRTL
                ? 'يظهر للعميل في صفحة بحث المحامين وعند حجز جلسة حضورية.'
                : 'Visible on the find-lawyer page and when booking in-person meetings.'}
            </Text>

            <Inp
              C={C}
              label={isRTL ? 'العنوان' : 'Address'}
              value={office}
              onChangeText={setOffice}
              placeholder={isRTL ? 'مثال: 15 شارع التحرير، وسط البلد، القاهرة' : 'e.g. 15 El-Tahrir St, Downtown Cairo'}
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <Btn C={C} variant="ghost" size="sm" disabled={geocoding || !office.trim()} onPress={geocodeAddress} style={{ flex: 1 }}>
                {geocoding ? '⏳' : (isRTL ? '📍 حدد على الخريطة' : '📍 Locate on map')}
              </Btn>
              <Btn C={C} variant="ghost" size="sm" disabled={geocoding} onPress={useCurrentLocation} style={{ flex: 1 }}>
                {isRTL ? '🎯 موقعي الحالي' : '🎯 Use current location'}
              </Btn>
            </View>

            {/* Map preview */}
            {coords && (
              <View style={{
                marginTop: 14, height: 180, borderRadius: 12, overflow: 'hidden',
                borderWidth: 1, borderColor: C.border,
              }}>
                <MapView
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  style={{ flex: 1 }}
                  region={{
                    latitude:  coords.lat,
                    longitude: coords.lng,
                    latitudeDelta:  0.01,
                    longitudeDelta: 0.01,
                  }}
                  onPress={(e) => {
                    // Allow tapping the map to fine-tune the pin
                    setCoords({
                      lat: e.nativeEvent.coordinate.latitude,
                      lng: e.nativeEvent.coordinate.longitude,
                    });
                  }}
                >
                  <Marker
                    coordinate={{ latitude: coords.lat, longitude: coords.lng }}
                    draggable
                    onDragEnd={(e) => setCoords({
                      lat: e.nativeEvent.coordinate.latitude,
                      lng: e.nativeEvent.coordinate.longitude,
                    })}
                  />
                </MapView>
              </View>
            )}
            {coords && (
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>
                📌 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} — {isRTL ? 'اسحب الدبوس لتعديل الموقع' : 'drag the pin to adjust'}
              </Text>
            )}
          </Card>
        )}

        {/* ─── LAWYER-ONLY: Single save button for prices + office ─────── */}
        {isLawyer && (
          <Btn C={C} full size="lg" disabled={lawyerSaving || lawyerLoading} onPress={saveLawyerInfo} style={{ marginBottom: 24 }}>
            {lawyerSaving
              ? (isRTL ? '⏳ جاري الحفظ...' : '⏳ Saving...')
              : (isRTL ? '💾 حفظ معلومات المحامي' : '💾 Save lawyer info')}
          </Btn>
        )}

        {/* Change password */}
        <Card C={C}>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 14 }}>
            🔐 {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
          </Text>
          <Inp C={C} label={isRTL ? 'الحالية' : 'Current password'} value={pw.current} onChangeText={(v: string) => setPw(p => ({ ...p, current: v }))} placeholder="••••••••" secureTextEntry />
          <Inp C={C} label={isRTL ? 'الجديدة' : 'New password'} value={pw.new} onChangeText={(v: string) => setPw(p => ({ ...p, new: v }))} placeholder={isRTL ? '8 أحرف على الأقل' : 'At least 8 characters'} secureTextEntry />
          <Inp C={C} label={isRTL ? 'تأكيد الجديدة' : 'Confirm new password'} value={pw.confirm} onChangeText={(v: string) => setPw(p => ({ ...p, confirm: v }))} placeholder={isRTL ? 'أعد كتابة كلمة المرور' : 'Re-enter new password'} secureTextEntry />
          <Btn C={C} full variant="ghost" disabled={pwSaving} onPress={changePassword}>
            {pwSaving ? (isRTL ? '⏳ جاري التغيير...' : '⏳ Updating...') : (isRTL ? 'تغيير كلمة المرور' : 'Change Password')}
          </Btn>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
