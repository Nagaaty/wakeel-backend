import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { selUser, setUser } from '../src/store/slices/authSlice';
import { useTheme } from '../src/theme';
import { Btn, Inp, Avatar, Card } from '../src/components/ui';
import { authAPI, uploadAPI } from '../src/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

export default function EditProfileScreen() {
  const C = useTheme(); const dispatch = useDispatch(); const insets = useSafeAreaInsets();
  const user = useSelector(selUser);
  const { isRTL } = useI18n();
  const [form, setForm] = useState({ name:user?.name||'', phone:user?.phone||'', bio:user?.bio||'' });
  const [pw, setPw] = useState({ current:'', new:'', confirm:'' });
  const [saving, setSaving] = useState(false); const [pwSaving, setPwSaving] = useState(false);
  const initials = (user?.name||'U').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase();

  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('', isRTL ? 'نحتاج إذن الوصول للصور' : 'Photo library access required');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1,1], quality: 0.8,
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
            dispatch(setUser({ ...user, ...updated }));
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
        allowsEditing: true, aspect: [16,9], quality: 0.8,
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
            dispatch(setUser({ ...user, ...updated }));
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
    } catch (e:any) { Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message); }
    finally { setSaving(false); }
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
      await authAPI.changePassword({ currentPassword:pw.current, newPassword:pw.new });
      Alert.alert('✅', isRTL ? 'تم تغيير كلمة المرور' : 'Password changed successfully');
      setPw({ current:'', new:'', confirm:'' });
    } catch (e:any) { Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message); }
    finally { setPwSaving(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:10 }}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:20 }}>✏️ {isRTL ? 'تعديل الملف الشخصي' : 'Edit Profile'}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24, justifyContent: 'center' }}>
          <View style={{ alignItems:'center' }}>
            <Avatar C={C} initials={initials} size={72} url={user?.avatar_url || user?.avatar} />
            <TouchableOpacity onPress={pickAvatar}>
              <Text style={{ color:C.gold, fontSize:12, marginTop:8, fontWeight: '700' }}>
                {isRTL ? 'تغيير الصورة 📸' : 'Change Photo 📸'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ alignItems:'center' }}>
            <View style={{ width:120, height:72, backgroundColor: C.border, borderRadius: 12, overflow: 'hidden' }}>
              {user?.cover_url && <Image source={{ uri: user.cover_url }} style={{ width: '100%', height: '100%' }} />}
            </View>
            <TouchableOpacity onPress={pickCover}>
              <Text style={{ color:C.gold, fontSize:12, marginTop:8, fontWeight: '700' }}>
                {isRTL ? 'تغيير الغلاف 🖼️' : 'Change Cover 🖼️'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Card C={C} style={{ marginBottom:16 }}>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:14 }}>
            {isRTL ? 'المعلومات الشخصية' : 'Personal Info'}
          </Text>
          <Inp C={C} label={isRTL ? 'الاسم الكامل' : 'Full name'} value={form.name} onChangeText={(v: string)=>setForm(f=>({...f,name:v}))} placeholder={isRTL ? 'اسمك الكامل' : 'Your full name'} autoCapitalize="words" />
          <Inp C={C} label={isRTL ? 'رقم الهاتف' : 'Phone'} value={form.phone} onChangeText={(v: string)=>setForm(f=>({...f,phone:v}))} placeholder={isRTL ? '01xxxxxxxxx' : '+20 1xx xxx xxxx'} keyboardType="phone-pad" />
          <Inp C={C} label={isRTL ? 'نبذة عنك' : 'Bio'} value={form.bio} onChangeText={(v: string)=>setForm(f=>({...f,bio:v}))} placeholder={isRTL ? 'اكتب نبذة...' : 'Write a short bio...'} multiline numberOfLines={3} />
          <Btn C={C} full disabled={saving} onPress={saveProfile}>
            {saving ? (isRTL ? '⏳ جاري الحفظ...' : '⏳ Saving...') : (isRTL ? '💾 حفظ' : '💾 Save')}
          </Btn>
        </Card>

        <Card C={C}>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:14 }}>
            🔐 {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
          </Text>
          <Inp C={C} label={isRTL ? 'الحالية' : 'Current password'} value={pw.current} onChangeText={(v: string)=>setPw(p=>({...p,current:v}))} placeholder="••••••••" secureTextEntry />
          <Inp C={C} label={isRTL ? 'الجديدة' : 'New password'} value={pw.new} onChangeText={(v: string)=>setPw(p=>({...p,new:v}))} placeholder={isRTL ? '8 أحرف على الأقل' : 'At least 8 characters'} secureTextEntry />
          <Inp C={C} label={isRTL ? 'تأكيد الجديدة' : 'Confirm new password'} value={pw.confirm} onChangeText={(v: string)=>setPw(p=>({...p,confirm:v}))} placeholder={isRTL ? 'أعد كتابة كلمة المرور' : 'Re-enter new password'} secureTextEntry />
          <Btn C={C} full variant="ghost" disabled={pwSaving} onPress={changePassword}>
            {pwSaving ? (isRTL ? '⏳ جاري التغيير...' : '⏳ Updating...') : (isRTL ? 'تغيير كلمة المرور' : 'Change Password')}
          </Btn>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}