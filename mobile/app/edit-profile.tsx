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
  const [form, setForm] = useState({ name:user?.name||'', phone:user?.phone||'', bio:user?.bio||'' });
  const [pw, setPw] = useState({ current:'', new:'', confirm:'' });
  const [saving, setSaving] = useState(false); const [pwSaving, setPwSaving] = useState(false);
  const initials = (user?.name||'U').split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase();

  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('','نحتاج إذن الوصول للصور'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1,1], quality: 0.8,
      });
      if (!result.canceled) {
        setSaving(true);
        const formData = new FormData();
        formData.append('file', {
          uri: result.assets[0].uri,
          name: 'avatar.jpg',
          type: result.assets[0].mimeType || 'image/jpeg',
        } as any);
        formData.append('folder', 'avatars');
        try {
          const uploadRes: any = await uploadAPI.upload(formData);
          if (uploadRes?.url) {
            const updated: any = await authAPI.update({ avatar_url: uploadRes.url });
            dispatch(setUser({ ...user, ...updated }));
            Alert.alert('✅', 'تم تحديث الصورة الشخصية!');
          }
        } catch (e: any) { Alert.alert('خطأ', e?.message || 'فشل الرفع'); }
        finally { setSaving(false); }
      }
    } catch (e: any) { Alert.alert('خطأ', e?.message); }
  };

  const pickCover = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('','نحتاج إذن الوصول للصور'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [16,9], quality: 0.8,
      });
      if (!result.canceled) {
        setSaving(true);
        const formData = new FormData();
        formData.append('file', {
          uri: result.assets[0].uri,
          name: 'cover.jpg',
          type: result.assets[0].mimeType || 'image/jpeg',
        } as any);
        formData.append('folder', 'covers');
        try {
          const uploadRes: any = await uploadAPI.upload(formData);
          if (uploadRes?.url) {
            const updated: any = await authAPI.update({ cover_url: uploadRes.url });
            dispatch(setUser({ ...user, ...updated }));
            Alert.alert('✅', 'تم تحديث صورة الغلاف!');
          }
        } catch (e: any) { Alert.alert('خطأ', e?.message || 'فشل الرفع'); }
        finally { setSaving(false); }
      }
    } catch (e: any) { Alert.alert('خطأ', e?.message); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated: any = await authAPI.update(form);
      dispatch(setUser({ ...user, ...updated }));
      Alert.alert('✅', 'تم حفظ التغييرات');
    } catch (e:any) { Alert.alert('خطأ', e?.message); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (pw.new !== pw.confirm) { Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين'); return; }
    if (pw.new.length < 8) { Alert.alert('خطأ', '8 أحرف على الأقل'); return; }
    setPwSaving(true);
    try {
      await authAPI.changePassword({ currentPassword:pw.current, newPassword:pw.new });
      Alert.alert('✅', 'تم تغيير كلمة المرور');
      setPw({ current:'', new:'', confirm:'' });
    } catch (e:any) { Alert.alert('خطأ', e?.message); }
    finally { setPwSaving(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex:1, backgroundColor:C.bg }}>
      <View style={{ backgroundColor:C.surface, paddingTop:insets.top+12, paddingHorizontal:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', alignItems:'center', gap:10 }}>
        <TouchableOpacity onPress={() => router.back()}><Text style={{ color:C.text, fontSize:22 }}>‹</Text></TouchableOpacity>
        <Text style={{ color:C.text, fontWeight:'700', fontSize:20 }}>✏️ تعديل الملف الشخصي</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24, justifyContent: 'center' }}>
          <View style={{ alignItems:'center' }}>
            <Avatar C={C} initials={initials} size={72} url={user?.avatar_url || user?.avatar} />
            <TouchableOpacity onPress={pickAvatar}>
              <Text style={{ color:C.gold, fontSize:12, marginTop:8, fontWeight: '700' }}>تغيير الصورة 📸</Text>
            </TouchableOpacity>
          </View>
          <View style={{ alignItems:'center' }}>
            <View style={{ width:120, height:72, backgroundColor: C.border, borderRadius: 12, overflow: 'hidden' }}>
              {user?.cover_url && <Image source={{ uri: user.cover_url }} style={{ width: '100%', height: '100%' }} />} 
            </View>
            <TouchableOpacity onPress={pickCover}>
              <Text style={{ color:C.gold, fontSize:12, marginTop:8, fontWeight: '700' }}>تغيير الغلاف 🖼️</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Card C={C} style={{ marginBottom:16 }}>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:14 }}>المعلومات الشخصية</Text>
          <Inp C={C} label="الاسم الكامل" value={form.name} onChangeText={(v: string)=>setForm(f=>({...f,name:v}))} placeholder="اسمك الكامل" autoCapitalize="words" />
          <Inp C={C} label="رقم الهاتف" value={form.phone} onChangeText={(v: string)=>setForm(f=>({...f,phone:v}))} placeholder="01xxxxxxxxx" keyboardType="phone-pad" />
          <Inp C={C} label="نبذة عنك" value={form.bio} onChangeText={(v: string)=>setForm(f=>({...f,bio:v}))} placeholder="اكتب نبذة..." multiline numberOfLines={3} />
          <Btn C={C} full disabled={saving} onPress={saveProfile}>{saving?'⏳ جاري الحفظ...':'💾 حفظ'}</Btn>
        </Card>
        <Card C={C}>
          <Text style={{ color:C.text, fontWeight:'700', fontSize:14, marginBottom:14 }}>🔐 تغيير كلمة المرور</Text>
          <Inp C={C} label="الحالية" value={pw.current} onChangeText={(v: string)=>setPw(p=>({...p,current:v}))} placeholder="••••••••" secureTextEntry />
          <Inp C={C} label="الجديدة" value={pw.new} onChangeText={(v: string)=>setPw(p=>({...p,new:v}))} placeholder="8 أحرف على الأقل" secureTextEntry />
          <Inp C={C} label="تأكيد الجديدة" value={pw.confirm} onChangeText={(v: string)=>setPw(p=>({...p,confirm:v}))} placeholder="أعد كتابة كلمة المرور" secureTextEntry />
          <Btn C={C} full variant="ghost" disabled={pwSaving} onPress={changePassword}>{pwSaving?'⏳ جاري التغيير...':'تغيير كلمة المرور'}</Btn>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}