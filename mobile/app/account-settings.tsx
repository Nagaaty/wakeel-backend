// ─── Wakeel — Account Settings ─────────────────────────────────────────────
// Route: /account-settings
// WhatsApp-style list of account security & identity options
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, TextInput, Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/hooks/useTheme';
import { useI18n } from '../src/i18n';
import { hapticLight } from '../src/utils/haptics';
import { authAPI } from '../src/services/api';
import { useAuth } from '../src/hooks/useAuth';

// ── Reusable row component ────────────────────────────────────────────────────
function SettingRow({
  icon, title, subtitle, onPress, danger = false, C, isRTL,
}: {
  icon: string; title: string; subtitle?: string;
  onPress: () => void; danger?: boolean; C: any; isRTL: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={() => { hapticLight(); onPress(); }}
      activeOpacity={0.7}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
      }}
    >
      {/* Icon badge */}
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: danger ? '#FF384410' : C.gold + '15',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text style={{
          color: danger ? '#FF3844' : C.text,
          fontSize: 15,
          fontWeight: '600',
          textAlign: isRTL ? 'right' : 'left',
        }}>
          {title}
        </Text>
        {subtitle && (
          <Text style={{
            color: C.muted, fontSize: 12, marginTop: 2,
            textAlign: isRTL ? 'right' : 'left',
          }}>
            {subtitle}
          </Text>
        )}
      </View>

      {/* Arrow */}
      {!danger && (
        <Text style={{ color: C.muted, fontSize: 18 }}>
          {isRTL ? '‹' : '›'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, C, isRTL }: { label: string; C: any; isRTL: boolean }) {
  return (
    <Text style={{
      color: C.gold,
      fontSize: 12, fontWeight: '700',
      paddingHorizontal: 20, paddingTop: 24, paddingBottom: 6,
      textAlign: isRTL ? 'right' : 'left',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    }}>
      {label}
    </Text>
  );
}

// ── Inline input modal ────────────────────────────────────────────────────────
function InputModal({
  visible, title, placeholder, secureText = false,
  onCancel, onConfirm, loading, C, isRTL,
}: {
  visible: boolean; title: string; placeholder: string;
  secureText?: boolean; onCancel: () => void;
  onConfirm: (val: string) => void; loading: boolean;
  C: any; isRTL: boolean;
}) {
  const [val, setVal] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: '#00000080', justifyContent: 'center', padding: 24 }}
      >
        <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 24 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 16, fontFamily: 'Cairo-Bold' }}>
            {title}
          </Text>
          <TextInput
            value={val}
            onChangeText={setVal}
            placeholder={placeholder}
            placeholderTextColor={C.muted}
            secureTextEntry={secureText}
            autoFocus
            style={{
              backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
              borderRadius: 12, padding: 12, color: C.text, fontSize: 15,
              marginBottom: 20, textAlign: isRTL ? 'right' : 'left',
            }}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: C.muted, fontWeight: '600' }}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { onConfirm(val); setVal(''); }}
              disabled={!val.trim() || loading}
              style={{ flex: 1, borderRadius: 12, backgroundColor: val.trim() && !loading ? C.gold : C.dim, paddingVertical: 12, alignItems: 'center' }}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700' }}>{isRTL ? 'تأكيد' : 'Confirm'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AccountSettingsScreen() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const serif = { fontFamily: 'Cairo-Bold' };

  const [modal, setModal] = useState<null | 'email' | 'password' | 'phone' | 'twofa'>(null);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (field: string, value: string) => {
    if (!value.trim()) return;
    setLoading(true);
    try {
      if (field === 'password') {
        await authAPI.changePassword({ newPassword: value });
      } else {
        await authAPI.update({ [field]: value });
      }
      setModal(null);
      Alert.alert(
        isRTL ? '✅ تم التحديث' : '✅ Updated',
        isRTL ? 'تم تحديث بياناتك بنجاح' : 'Your information was updated successfully.',
      );
    } catch (e: any) {
      Alert.alert(
        isRTL ? '❌ خطأ' : '❌ Error',
        e?.response?.data?.message || (isRTL ? 'فشل التحديث. حاول مجدداً.' : 'Update failed. Please try again.'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      isRTL ? 'حذف الحساب' : 'Delete Account',
      isRTL ? 'هل أنت متأكد؟ سيتم حذف حسابك نهائياً ولا يمكن التراجع عن ذلك.' : 'Are you sure? This will permanently delete your account and cannot be undone.',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف نهائي' : 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await authAPI.deleteAccount();
              Alert.alert(isRTL ? 'تم حذف الحساب' : 'Account Deleted');
              router.replace('/(auth)/login' as any);
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={{
        backgroundColor: C.surface,
        paddingTop: insets.top + 12,
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
        flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Text style={{ color: C.text, fontSize: 24 }}>{isRTL ? '›' : '‹'}</Text>
        </TouchableOpacity>
        <Text style={{ ...serif, color: C.text, fontSize: 22, fontWeight: '700' }}>
          {isRTL ? 'إعدادات الحساب' : 'Account'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── Identity ───────────────────────────────────────────────── */}
        <SectionHeader label={isRTL ? 'الهوية' : 'Identity'} C={C} isRTL={isRTL} />
        <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border }}>
          <SettingRow
            icon="📧" C={C} isRTL={isRTL}
            title={isRTL ? 'البريد الإلكتروني' : 'Email address'}
            subtitle={user?.email || '—'}
            onPress={() => setModal('email')}
          />
          <SettingRow
            icon="📱" C={C} isRTL={isRTL}
            title={isRTL ? 'رقم الهاتف' : 'Phone number'}
            subtitle={user?.phone || '—'}
            onPress={() => setModal('phone')}
          />
        </View>

        {/* ── Security ───────────────────────────────────────────────── */}
        <SectionHeader label={isRTL ? 'الأمان' : 'Security'} C={C} isRTL={isRTL} />
        <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border }}>
          <SettingRow
            icon="🔑" C={C} isRTL={isRTL}
            title={isRTL ? 'تغيير كلمة المرور' : 'Change password'}
            subtitle={isRTL ? 'ضع كلمة مرور قوية ومميزة' : 'Use a strong, unique password'}
            onPress={() => setModal('password')}
          />
          <SettingRow
            icon="🔐" C={C} isRTL={isRTL}
            title={isRTL ? 'التحقق بخطوتين' : 'Two-step verification'}
            subtitle={isRTL ? 'أضف طبقة حماية إضافية' : 'Add an extra layer of protection'}
            onPress={() => setModal('twofa')}
          />
          <SettingRow
            icon="🔔" C={C} isRTL={isRTL}
            title={isRTL ? 'إشعارات الأمان' : 'Security notifications'}
            subtitle={isRTL ? 'تنبيهات تسجيل الدخول وتغيير البيانات' : 'Alerts for sign-ins and account changes'}
            onPress={() => router.push('/notification-settings' as any)}
          />
        </View>

        {/* ── Data & Privacy ─────────────────────────────────────────── */}
        <SectionHeader label={isRTL ? 'البيانات والخصوصية' : 'Data & Privacy'} C={C} isRTL={isRTL} />
        <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border }}>
          <SettingRow
            icon="📋" C={C} isRTL={isRTL}
            title={isRTL ? 'سياسة الخصوصية' : 'Privacy policy'}
            subtitle={isRTL ? 'كيف نحمي بياناتك' : 'How we protect your data'}
            onPress={() => router.push('/about' as any)}
          />
          <SettingRow
            icon="📄" C={C} isRTL={isRTL}
            title={isRTL ? 'الشروط والأحكام' : 'Terms of service'}
            onPress={() => router.push('/about' as any)}
          />
          <SettingRow
            icon="🗑️" C={C} isRTL={isRTL} danger
            title={isRTL ? 'حذف الحساب' : 'Delete Account'}
            subtitle={isRTL ? 'تحذير: هذا الإجراء لا يمكن التراجع عنه' : 'Warning: This action cannot be undone'}
            onPress={handleDeleteAccount}
          />
        </View>

      </ScrollView>

      {/* ── Email modal ────────────────────────────────────────────────── */}
      <InputModal
        visible={modal === 'email'}
        title={isRTL ? 'تغيير البريد الإلكتروني' : 'Change Email'}
        placeholder={isRTL ? 'البريد الإلكتروني الجديد' : 'New email address'}
        onCancel={() => setModal(null)}
        onConfirm={v => handleUpdate('email', v)}
        loading={loading}
        C={C} isRTL={isRTL}
      />

      {/* ── Phone modal ────────────────────────────────────────────────── */}
      <InputModal
        visible={modal === 'phone'}
        title={isRTL ? 'تغيير رقم الهاتف' : 'Change Phone Number'}
        placeholder={isRTL ? 'رقم الهاتف الجديد' : 'New phone number'}
        onCancel={() => setModal(null)}
        onConfirm={v => handleUpdate('phone', v)}
        loading={loading}
        C={C} isRTL={isRTL}
      />

      {/* ── Password modal ─────────────────────────────────────────────── */}
      <InputModal
        visible={modal === 'password'}
        title={isRTL ? 'كلمة مرور جديدة' : 'New Password'}
        placeholder={isRTL ? 'أدخل كلمة مرور قوية' : 'Enter a strong password'}
        secureText
        onCancel={() => setModal(null)}
        onConfirm={v => handleUpdate('password', v)}
        loading={loading}
        C={C} isRTL={isRTL}
      />

      {/* ── 2FA placeholder modal ──────────────────────────────────────── */}
      <Modal visible={modal === 'twofa'} transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={{ flex: 1, backgroundColor: '#00000080', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 28, alignItems: 'center', gap: 14 }}>
            <Text style={{ fontSize: 48 }}>🔐</Text>
            <Text style={{ ...serif, color: C.text, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>
              {isRTL ? 'التحقق بخطوتين' : 'Two-Step Verification'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
              {isRTL
                ? 'هذه الميزة قيد التطوير. ستُفعَّل قريباً لتأمين حسابك بشكل أفضل.'
                : 'This feature is coming soon. It will add an extra PIN code required when registering on a new device.'}
            </Text>
            <TouchableOpacity
              onPress={() => setModal(null)}
              style={{ backgroundColor: C.gold, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12, marginTop: 4 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {isRTL ? 'حسناً' : 'Got it'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}
