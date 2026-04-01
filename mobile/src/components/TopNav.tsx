import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n, LangToggle } from '../i18n';
import { useAuth } from '../hooks/useAuth';

export function TopNav() {
  const C = useTheme();
  const { isRTL, t } = useI18n();
  const { user, logout } = useAuth();
  const isLawyer = user?.role === 'lawyer';
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <View style={{ flexDirection: 'row', direction: 'ltr', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20, paddingTop: insets.top + 16 }}>
        <TouchableOpacity onPress={() => router.push(isLawyer ? '/about' as any : '/(tabs)/' as any)} style={{ flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: 'PlayfairDisplay-Bold', fontSize: 26, color: '#1C1611' }}>Wakeel</Text>
          <View style={{ backgroundColor: C.gold, width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'PlayfairDisplay-Bold', color: '#fff', fontSize: 16 }}>W</Text>
          </View>
        </TouchableOpacity>

        {/* Right side: Avatar + Hamburger */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Avatar button → Profile */}
          <TouchableOpacity
            onPress={() => router.push(isLawyer ? '/(lawyer-tabs)/' as any : '/(tabs)/profile' as any)}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: C.gold + '20',
              borderWidth: 2, borderColor: C.gold,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 13, color: C.gold }}>
              {(user?.name || 'U').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </TouchableOpacity>

          {/* Hamburger */}
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={{ paddingVertical: 2, paddingHorizontal: 10, borderWidth: 1, borderColor: '#E5DFD3', borderRadius: 8 }}>
            <Text style={{ fontSize: 26, color: '#1C1611', fontWeight: '300' }}>≡</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={menuOpen} animationType="fade" transparent={true} onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', direction: 'ltr', flexDirection: 'row', justifyContent: 'flex-end' }} onPress={() => setMenuOpen(false)} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={{ width: '75%', height: '100%', backgroundColor: '#FDFBF7', paddingTop: insets.top + 20, paddingHorizontal: 20, borderLeftWidth: 1, borderColor: '#EADDCB' }}>
            <View style={{ flexDirection: 'row', direction: 'ltr', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
              <TouchableOpacity onPress={() => { setMenuOpen(false); router.push(isLawyer ? '/about' as any : '/(tabs)/' as any); }} style={{ flexDirection: 'row', direction: 'ltr', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: 'PlayfairDisplay-Bold', fontSize: 26, color: '#1C1611' }}>Wakeel</Text>
                <View style={{ backgroundColor: C.gold, width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: 'PlayfairDisplay-Bold', color: '#fff', fontSize: 16 }}>W</Text></View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMenuOpen(false)} style={{ paddingVertical: 2, paddingHorizontal: 10, borderWidth: 1, borderColor: '#E5DFD3', borderRadius: 8 }}><Text style={{ fontSize: 24, color: '#1C1611', fontWeight: '300' }}>✖</Text></TouchableOpacity>
            </View>

            <View style={{ gap: 24 }}>
              {[
                { label: t('nav.home'), icon: '🏠', action: () => { setMenuOpen(false); router.push(isLawyer ? '/(lawyer-tabs)/' as any : '/(tabs)/' as any); } },
                !isLawyer && { label: t('app.search'), icon: '🔍', action: () => { setMenuOpen(false); router.push('/lawyers' as any); } },
                { label: t('nav.forum'), icon: '⚖️', action: () => { setMenuOpen(false); router.push(isLawyer ? '/(lawyer-tabs)/forum' as any : '/forum' as any); }, highlight: true },
                { label: t('nav.faq'), icon: '❓', action: () => { setMenuOpen(false); router.push('/faq' as any); } },
                { label: t('support.title'), icon: '💬', action: () => { setMenuOpen(false); router.push('/support' as any); } },
                !isLawyer && { label: t('lawyer.saved'), icon: '♡', action: () => { setMenuOpen(false); router.push('/favorites' as any); } },
                { label: t('profile.referral'), icon: '🎁', action: () => { setMenuOpen(false); router.push('/referral' as any); } },
              ].filter(Boolean).map((item: any, i) => (
                <TouchableOpacity key={i} onPress={item.action} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: isRTL ? 'flex-end' : 'flex-start', gap: 16, paddingVertical: item.highlight ? 10 : 0, borderRightWidth: item.highlight && isRTL ? 4 : 0, borderLeftWidth: item.highlight && !isRTL ? 4 : 0, borderColor: C.gold, paddingHorizontal: item.highlight ? 12 : 0 }}>
                  {!isRTL && <Text style={{ fontSize: 24, color: item.highlight ? C.gold : '#1C1611' }}>{item.icon}</Text>}
                  <Text style={{ fontSize: 18, fontWeight: '700', color: item.highlight ? C.gold : '#1C1611' }}>{item.label}</Text>
                  {isRTL && <Text style={{ fontSize: 24, color: item.highlight ? C.gold : '#1C1611' }}>{item.icon}</Text>}
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginTop: 'auto', marginBottom: insets.bottom + 20, borderTopWidth: 1, borderColor: '#EADDCB', paddingTop: 24, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <LangToggle C={C} />
                <TouchableOpacity onPress={() => { setMenuOpen(false); logout(); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: C.red, borderRadius: 12 }}>
                  {!isRTL && <Text style={{ color: C.red, fontWeight: '700', fontSize: 16 }}>{t('auth.logout')}</Text>}
                  <Text style={{ fontSize: 18 }}>🚪</Text>
                  {isRTL && <Text style={{ color: C.red, fontWeight: '700', fontSize: 16 }}>{t('auth.logout')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
