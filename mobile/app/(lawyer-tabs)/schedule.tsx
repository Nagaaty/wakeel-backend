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
    '1': { active: false, slots: [] }, // Monday
    '2': { active: false, slots: [] }, // Tuesday
    '3': { active: false, slots: [] }, // Wednesday
    '4': { active: false, slots: [] }, // Thursday
    '5': { active: false, slots: [] }, // Friday
    '6': { active: false, slots: [] }, // Saturday
  });

  const availableSlots = Array.from({ length: 36 }, (_, i) => {
    const h = (Math.floor(i / 2) + 6).toString().padStart(2, '0');
    const m = (i % 2 === 0) ? '00' : '30';
    return `${h}:${m}`;
  });

  // Date Overrides
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [overrides, setOverrides] = useState<Record<string, { is_off: boolean, slots: string[] }>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const getDays = (y: number, m: number) => {
     const d = new Date(y, m, 1);
     const days = [];
     for(let i=0; i<d.getDay(); i++) days.push(null);
     while(d.getMonth() === m) {
       days.push(new Date(d));
       d.setDate(d.getDate() + 1);
     }
     return days;
  };
  const cDays = getDays(viewYear, viewMonth);
  const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

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
    Promise.all([
      lawyersAPI.getRawAvailability(),
      lawyersAPI.getOverrides()
    ]).then(([res, ovRes]: any) => {
        if (res.schedule && Object.keys(res.schedule).length > 0) {
            setSchedule(prev => {
                const nw = { ...prev };
                for (const [day, slots] of Object.entries(res.schedule) as [string, string[]][]) {
                    nw[day] = { active: slots.length > 0, slots };
                }
                return nw;
            });
        }
        const ovMap: any = {};
        (ovRes || []).forEach((o: any) => {
           ovMap[o.override_date.split('T')[0]] = { is_off: o.is_off, slots: o.slots || [] };
        });
        setOverrides(ovMap);
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

  const toggleOverrideSlot = (date: string, s: string) => {
    setOverrides(p => {
       const curr = p[date] ? p[date].slots : [];
       const a = [...curr];
       const i = a.indexOf(s);
       if (i>=0) a.splice(i,1); else a.push(s);
       return {...p, [date]: { is_off: false, slots: a }};
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

        // Save overrides
        const ovList = Object.entries(overrides).map(([date, data]) => ({
           override_date: date,
           is_off: data.slots.length === 0,
           slots: data.slots
        }));
        await lawyersAPI.saveOverrides({ overrides: ovList });

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
                    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                        {availableSlots.map(slot => {
                            const isSelected = data.slots.includes(slot);
                            return (
                                <TouchableOpacity 
                                    key={slot}
                                    onPress={() => handleToggleSlot(day, slot)}
                                    style={{ 
                                        minWidth: 44, 
                                        paddingVertical: 6, 
                                        paddingHorizontal: 8,
                                        borderRadius: 6, 
                                        borderWidth: 1, 
                                        borderColor: isSelected ? '#A16A2F' : '#D4D4D8',
                                        backgroundColor: isSelected ? '#A16A2F' : 'transparent',
                                        alignItems: 'center'
                                    }}>
                                    <Text style={{ color: isSelected ? '#FFF' : C.text, fontSize: 11, fontWeight: isSelected?'bold':'normal' }}>{slot}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                )}
            </View>
        ))}

        {/* --- Date Overrides Calendar --- */}
        <View style={{ marginTop: 20, marginBottom: 16 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 4 }}>استثناءات التواريخ</Text>
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 12 }}>أضف إجازة أو أوقات مخصصة لتاريخ معين</Text>
          <View style={{ backgroundColor: '#EFECE5', borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 }}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <TouchableOpacity onPress={()=>{ if(viewMonth===11){setViewYear(y=>y+1);setViewMonth(0);}else setViewMonth(m=>m+1); }}><Text style={{fontSize:20,color:'#A16A2F',padding:8}}>›</Text></TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{AR_MONTHS[viewMonth]} {viewYear}</Text>
              <TouchableOpacity onPress={()=>{ if(viewMonth===0){setViewYear(y=>y-1);setViewMonth(11);}else setViewMonth(m=>m-1); }}><Text style={{fontSize:20,color:'#A16A2F',padding:8}}>‹</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap' }}>
              {cDays.map((dt, i) => {
                if(!dt) return <View key={`e-${i}`} style={{ width:'14.28%', aspectRatio:1 }} />;
                const isod = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
                const isSel = selectedDate === isod;
                const ov = overrides[isod];
                const isPast = dt < new Date(new Date().setHours(0,0,0,0));
                
                return (
                  <TouchableOpacity key={isod} onPress={() => !isPast && setSelectedDate(isSel ? null : isod)} disabled={isPast}
                    style={{ width:'14.28%', aspectRatio:1, alignItems:'center', justifyContent:'center' }}>
                    <View style={{ width:32, height:32, borderRadius:16, backgroundColor: isSel ? '#A16A2F' : (ov?.is_off ? '#DC262620' : ov ? '#A16A2F20' : 'transparent'), borderWidth: isSel?0:1, borderColor: ov?.is_off ? '#DC2626': (ov ? '#A16A2F' : 'transparent'), alignItems:'center', justifyContent:'center' }}>
                      <Text style={{ color: isSel ? '#FFF' : (isPast ? '#9CA3AF' : C.text), fontSize: 13, fontWeight: isSel||ov ? '700' : '400' }}>{dt.getDate()}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {selectedDate && (
           <View style={{ backgroundColor: C.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginBottom: 20 }}>
             <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>تعديل: {selectedDate}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>أزل جميع الأوقات لجعل اليوم إجازة</Text>
             </View>
             
             <View style={{ flexDirection:'row-reverse', flexWrap:'wrap', gap:4, justifyContent: 'center' }}>
                {availableSlots.map(slot => { 
                  const active = overrides[selectedDate]?.slots?.includes(slot); 
                  return (
                    <TouchableOpacity key={slot} onPress={()=> toggleOverrideSlot(selectedDate, slot) }
                      style={{ paddingHorizontal:6, paddingVertical:4, borderRadius:6, borderWidth:1, borderColor:active?'#A16A2F':C.border, backgroundColor:active?'#A16A2F':'transparent', minWidth:42, alignItems:'center' }}>
                      <Text style={{ color:active?'#FFF':C.text, fontSize:11, fontWeight:active?'bold':'normal' }}>{slot}</Text>
                    </TouchableOpacity>
                  ); 
                })}
             </View>
           </View>
        )}
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
