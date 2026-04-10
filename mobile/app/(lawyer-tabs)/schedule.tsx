import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useI18n } from '../../src/i18n';
import { lawyersAPI } from '../../src/services/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface DaySchedule { active: boolean; slots: string[]; }

export default function Schedule() {
  const C = useTheme();
  const { isRTL } = useI18n();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>({
    '0': { active: false, slots: [] }, // Sunday
    '1': { active: true, slots: ['09:00', '10:00', '11:00', '12:00'] }, // Monday
    '2': { active: true, slots: ['09:00', '10:00', '11:00', '12:00'] }, // Tuesday
    '3': { active: true, slots: ['09:00', '10:00', '11:00', '12:00'] }, // Wednesday
    '4': { active: true, slots: ['09:00', '10:00', '11:00', '14:00', '15:00'] }, // Thursday
    '5': { active: false, slots: [] }, // Friday
    '6': { active: false, slots: [] }, // Saturday
  });

  const availableSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
  ];

  const mapDayName = (idx: string) => {
      const map: any = {
          '0': isRTL ? 'الأحد' : 'Sunday',
          '1': isRTL ? 'الإثنين' : 'Monday',
          '2': isRTL ? 'الثلاثاء' : 'Tuesday',
          '3': isRTL ? 'الأربعاء' : 'Wednesday',
          '4': isRTL ? 'الخميس' : 'Thursday',
          '5': isRTL ? 'الجمعة' : 'Friday',
          '6': isRTL ? 'السبت' : 'Saturday'
      };
      return map[idx];
  };

  useEffect(() => {
    lawyersAPI.getRawAvailability()
      .then((res: any) => {
        if (res.schedule && Object.keys(res.schedule).length > 0) {
            setSchedule(prev => {
                const nw = { ...prev };
                for (const [day, slots] of Object.entries(res.schedule) as [string, string[]][]) {
                    nw[day] = { active: slots.length > 0, slots };
                }
                return nw;
            });
        }
      })
      .catch(console.warn)
      .finally(() => setLoading(false));
  }, []);

  const handleToggleDay = (day: string) => {
    setSchedule(prev => ({
        ...prev,
        [day]: { ...prev[day], active: !prev[day].active }
    }));
  };

  const handleToggleSlot = (day: string, slot: string) => {
    setSchedule(prev => {
        const current = prev[day].slots;
        const slots = current.includes(slot) ? current.filter(s => s !== slot) : [...current, slot];
        return { ...prev, [day]: { ...prev[day], slots } };
    });
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
        const payload: any = {};
        for (const [day, data] of Object.entries(schedule)) {
            payload[day] = data.active ? data.slots : [];
        }
        await lawyersAPI.saveAvailability(payload);
        Alert.alert(isRTL ? 'نجاح' : 'Success', isRTL ? 'تم حفظ جدول العمل بنجاح' : 'Schedule saved successfully');
    } catch (e: any) {
        Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || 'Failed to save schedule');
    } finally {
        setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 50, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
           <TouchableOpacity 
             onPress={() => router.push('/(lawyer-tabs)')}
             style={{ padding: 8, backgroundColor: '#EFECE5', borderRadius: 12, borderWidth: 1, borderColor: C.border }}>
             <MaterialCommunityIcons name={isRTL ? "arrow-right" : "arrow-left"} size={22} color={C.text} />
           </TouchableOpacity>
           <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: C.text }}>{isRTL ? 'تقويم التوفر' : 'Availability Calendar'}</Text>
              <Text style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{isRTL ? 'حدد أوقات عملك الأسبوعية' : 'Select your weekly working hours'}</Text>
           </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {loading ? (
             <ActivityIndicator color={C.gold} style={{ marginTop: 50 }} />
        ) : Object.entries(schedule).map(([day, data], i) => (
            <View key={i} style={{ backgroundColor: '#EFECE5', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
                {/* Day Header */}
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: data.active ? 16 : 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{mapDayName(day)}</Text>
                    <TouchableOpacity 
                        onPress={() => handleToggleDay(day)}
                        style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: data.active ? '#A16A2F' : '#D4D4D8', justifyContent: 'center', alignItems: data.active ? 'flex-end' : 'flex-start', padding: 2 }}>
                            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF' }} />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Day Content */}
                {!data.active ? (
                    <Text style={{ color: C.muted, textAlign: 'right', marginTop: -20, marginRight: 60 }}>{isRTL ? 'إجازة' : 'Off'}</Text>
                ) : (
                    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>
                        {availableSlots.map(slot => {
                            const isSelected = data.slots.includes(slot);
                            return (
                                <TouchableOpacity 
                                    key={slot}
                                    onPress={() => handleToggleSlot(day, slot)}
                                    style={{ 
                                        width: '22%', 
                                        paddingVertical: 12, 
                                        borderRadius: 8, 
                                        borderWidth: 1, 
                                        borderColor: isSelected ? '#A16A2F' : '#D4D4D8',
                                        backgroundColor: isSelected ? '#A16A2F' : 'transparent',
                                        alignItems: 'center'
                                    }}>
                                    <Text style={{ color: isSelected ? '#FFF' : C.text, fontSize: 13 }}>{slot}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                )}
            </View>
        ))}
      </ScrollView>

      {/* Sticky Save Button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border }}>
          <TouchableOpacity 
            onPress={saveAvailability}
            disabled={saving || loading}
            style={{ backgroundColor: (saving || loading) ? '#A1A1AA' : '#A16A2F', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}>
              {saving ? (
                  <ActivityIndicator color="#FFF" />
              ) : (
                  <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>{isRTL ? 'حفظ جدول العمل 💾' : 'Save Schedule 💾'}</Text>
              )}
          </TouchableOpacity>
      </View>
    </View>
  );
}
