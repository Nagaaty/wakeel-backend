// ─── Wakeel — Lawyer Schedule (with Service-Type Matrix) ─────────────────────
// Replaces mobile/app/(lawyer-tabs)/schedule.tsx
//
// What's new vs. the previous version:
//   • A "Service Types" section per weekday — toggle which consultation types
//     (video / text / phone / in-person / document) the lawyer accepts.
//   • A per-date service-type override on the calendar — tap a date to toggle
//     types just for that day (e.g. video off on April 30 only).
//   • Saves both the weekly schedule (existing) AND the new service matrix
//     in one Save action.
//
// What's preserved:
//   • Weekly time-slot picker (per weekday)
//   • Per-date override calendar (off-day or custom slots)
//   • Bilingual AR/EN, RTL-aware
//
// Backend dependencies (must be deployed):
//   • Migration 003_service_type_availability.sql
//   • lawyersAPI.getServiceAvailability + saveServiceAvailability
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';
import { useI18n } from '../../src/i18n';
import { lawyersAPI } from '../../src/services/api';

// ─── Types ───────────────────────────────────────────────────────────────────
type ConsultType = 'video' | 'text' | 'phone' | 'inperson' | 'document';
const ALL_TYPES: ConsultType[] = ['video', 'text', 'phone', 'inperson', 'document'];

interface DaySchedule { active: boolean; slots: string[]; }
interface DayOverride { is_off: boolean; slots: string[]; service_types?: ConsultType[] | null; }

const TYPE_META: Record<ConsultType, { icon: string; ar: string; en: string }> = {
  video:    { icon: 'video',          ar: 'فيديو',       en: 'Video'     },
  text:     { icon: 'message-text',   ar: 'نص',          en: 'Text'      },
  phone:    { icon: 'phone',          ar: 'هاتف',         en: 'Phone'     },
  inperson: { icon: 'home',           ar: 'حضور شخصي',    en: 'In-person' },
  document: { icon: 'file-document',  ar: 'مراجعة وثيقة', en: 'Document'  },
};

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function ScheduleScreen() {
  const C = useTheme();
  const { isRTL } = useI18n();

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  // Existing weekly time-slot schedule
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>({
    '0': { active: false, slots: [] }, '1': { active: false, slots: [] },
    '2': { active: false, slots: [] }, '3': { active: false, slots: [] },
    '4': { active: false, slots: [] }, '5': { active: false, slots: [] },
    '6': { active: false, slots: [] },
  });

  // NEW: weekly service-type defaults (per weekday)
  const [serviceDefaults, setServiceDefaults] = useState<Record<string, ConsultType[]>>({
    '0': [...ALL_TYPES], '1': [...ALL_TYPES], '2': [...ALL_TYPES],
    '3': [...ALL_TYPES], '4': [...ALL_TYPES], '5': [...ALL_TYPES], '6': [...ALL_TYPES],
  });

  // Existing per-date overrides — extended with service_types
  const [overrides, setOverrides] = useState<Record<string, DayOverride>>({});

  // UI state for date picker / collapsed sections
  const [viewYear, setViewYear]   = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Which day is expanded — limits visible content to one weekday at a time
  // so the screen doesn't become a wall of toggles.
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const availableSlots = useMemo(() => Array.from({ length: 36 }, (_, i) => {
    const h = (Math.floor(i / 2) + 6).toString().padStart(2, '0');
    const m = (i % 2 === 0) ? '00' : '30';
    return `${h}:${m}`;
  }), []);

  const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayName = (idx: string) => {
    const ar = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const en = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    return isRTL ? ar[parseInt(idx, 10)] : en[parseInt(idx, 10)];
  };

  const calendarDays = useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1);
    const days: Array<Date | null> = [];
    for (let i = 0; i < d.getDay(); i++) days.push(null);
    while (d.getMonth() === viewMonth) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
    return days;
  }, [viewYear, viewMonth]);

  // ─── Load everything in parallel ───────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      lawyersAPI.getRawAvailability(),
      lawyersAPI.getOverrides(),
      // The new endpoint — wrapped in catch in case backend isn't migrated yet
      (lawyersAPI as any).getServiceAvailability?.().catch(() => ({ defaults: {}, overrides: [] })),
    ])
      .then(([avRes, ovRes, svcRes]: any) => {
        // 1) Existing weekly schedule
        if (avRes?.schedule && Object.keys(avRes.schedule).length > 0) {
          setSchedule(prev => {
            const next = { ...prev };
            for (const [day, slots] of Object.entries(avRes.schedule) as [string, string[]][]) {
              next[day] = { active: slots.length > 0, slots };
            }
            return next;
          });
        }

        // 2) Existing date overrides + new service_types if present
        const ovMap: Record<string, DayOverride> = {};
        (ovRes || []).forEach((o: any) => {
          const date = (o.override_date || '').toString().split('T')[0];
          if (!date) return;
          ovMap[date] = {
            is_off:        !!o.is_off,
            slots:         o.slots || [],
            service_types: null, // filled in next step
          };
        });

        // 3) NEW: service-availability merge
        if (svcRes?.defaults) {
          setServiceDefaults(prev => {
            const next = { ...prev };
            for (const [day, types] of Object.entries(svcRes.defaults) as [string, ConsultType[]][]) {
              next[day] = types;
            }
            return next;
          });
        }
        (svcRes?.overrides || []).forEach((o: any) => {
          const date = (o.override_date || '').toString().split('T')[0];
          if (!date) return;
          if (!ovMap[date]) ovMap[date] = { is_off: false, slots: [], service_types: null };
          ovMap[date].service_types = o.service_types ?? null;
        });

        setOverrides(ovMap);
      })
      .catch(err => console.warn('[schedule] load failed', err))
      .finally(() => setLoading(false));
  }, []);

  // ─── Mutators ──────────────────────────────────────────────────────────────
  const toggleDay = (day: string) =>
    setSchedule(p => ({ ...p, [day]: { ...p[day], active: !p[day].active } }));

  const toggleSlot = (day: string, slot: string) =>
    setSchedule(p => {
      const has = p[day].slots.includes(slot);
      return {
        ...p,
        [day]: {
          ...p[day],
          slots: has ? p[day].slots.filter(s => s !== slot) : [...p[day].slots, slot],
        },
      };
    });

  const toggleDefaultService = (day: string, t: ConsultType) =>
    setServiceDefaults(p => {
      const list = p[day] || [];
      const has = list.includes(t);
      return { ...p, [day]: has ? list.filter(x => x !== t) : [...list, t] };
    });

  const toggleOverrideSlot = (date: string, slot: string) =>
    setOverrides(p => {
      const curr = p[date] || { is_off: false, slots: [], service_types: null };
      const has = curr.slots.includes(slot);
      return {
        ...p,
        [date]: {
          ...curr,
          is_off: false,
          slots: has ? curr.slots.filter(s => s !== slot) : [...curr.slots, slot],
        },
      };
    });

  const toggleOverrideService = (date: string, t: ConsultType) =>
    setOverrides(p => {
      const curr = p[date] || { is_off: false, slots: [], service_types: null };
      // First time toggling? Initialize from the weekday default.
      const dow = String(new Date(date + 'T00:00:00').getDay());
      const baseList = curr.service_types ?? serviceDefaults[dow] ?? [...ALL_TYPES];
      const has = baseList.includes(t);
      const next = has ? baseList.filter(x => x !== t) : [...baseList, t];
      return { ...p, [date]: { ...curr, service_types: next } };
    });

  const clearOverrideService = (date: string) =>
    setOverrides(p => {
      const curr = p[date];
      if (!curr) return p;
      return { ...p, [date]: { ...curr, service_types: null } };
    });

  // ─── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      // 1) Save weekly time slots (existing API, unchanged)
      const schedulePayload: any = {};
      for (const [day, data] of Object.entries(schedule)) {
        schedulePayload[day] = data.active ? data.slots : [];
      }
      await lawyersAPI.saveAvailability(schedulePayload);

      // 2) Save date overrides (existing API, unchanged)
      const ovList = Object.entries(overrides).map(([date, data]) => ({
        override_date: date,
        is_off: data.slots.length === 0 && !data.service_types,
        slots:  data.slots,
      }));
      await lawyersAPI.saveOverrides({ overrides: ovList });

      // 3) Save service-type matrix (new API). Wrapped in try to keep
      //    backwards compatibility when the backend hasn't been deployed yet.
      try {
        const overrideList = Object.entries(overrides)
          .filter(([_, data]) => data.service_types !== null && data.service_types !== undefined)
          .map(([date, data]) => ({
            override_date: date,
            service_types: data.service_types,
          }));
        await (lawyersAPI as any).saveServiceAvailability?.({
          defaults:  serviceDefaults,
          overrides: overrideList,
        });
      } catch (e) {
        console.warn('[schedule] service-availability save failed (backend may not be migrated)', e);
      }

      Alert.alert(
        isRTL ? 'تم الحفظ' : 'Saved',
        isRTL ? 'تم حفظ الجدول والإعدادات بنجاح' : 'Schedule and preferences saved'
      );
    } catch (e: any) {
      Alert.alert(
        isRTL ? 'فشل الحفظ' : 'Save failed',
        e?.message || (isRTL ? 'حاول مجدداً' : 'Please try again')
      );
    } finally {
      setSaving(false);
    }
  };

  // ─── Render helpers ────────────────────────────────────────────────────────
  const renderTypeChip = (
    t: ConsultType,
    enabled: boolean,
    onPress: () => void,
  ) => {
    const meta = TYPE_META[t];
    return (
      <TouchableOpacity
        key={t}
        onPress={onPress}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: enabled ? C.gold : C.border,
          backgroundColor: enabled ? C.gold + '18' : 'transparent',
        }}
      >
        <MaterialCommunityIcons
          name={meta.icon as any}
          size={16}
          color={enabled ? C.gold : C.muted}
        />
        <Text style={{
          color: enabled ? C.gold : C.muted,
          fontSize: 12,
          fontWeight: '700',
        }}>
          {isRTL ? meta.ar : meta.en}
        </Text>
      </TouchableOpacity>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        paddingTop: 50,
        backgroundColor: C.surface,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
      }}>
        <TouchableOpacity
          onPress={() => router.push('/(lawyer-tabs)')}
          style={{ padding: 8, backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border }}
        >
          <MaterialCommunityIcons
            name={isRTL ? 'arrow-right' : 'arrow-left'}
            size={22}
            color={C.text}
          />
        </TouchableOpacity>
        <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start', flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: C.text }}>
            {isRTL ? 'جدول العمل والخدمات' : 'Schedule & Services'}
          </Text>
          <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {isRTL ? 'حدد الأوقات وأنواع الاستشارات لكل يوم' : 'Set hours and consultation types per day'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 50 }} />
        ) : (
          <>
            {/* ───────── WEEKLY SCHEDULE ─────────────────────────────────── */}
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
              {isRTL ? 'الجدول الأسبوعي' : 'Weekly Schedule'}
            </Text>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>
              {isRTL
                ? 'اضغط على اليوم لتعديل الأوقات وأنواع الاستشارات'
                : 'Tap a day to edit hours and consultation types'}
            </Text>

            {Object.entries(schedule).map(([day, data]) => {
              const isExpanded = expandedDay === day;
              const enabledTypes = serviceDefaults[day] || [];
              return (
                <View
                  key={day}
                  style={{
                    backgroundColor: C.card,
                    borderRadius: 16,
                    padding: 14,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: isExpanded ? C.gold + '60' : C.border,
                  }}
                >
                  {/* Day header — name + active toggle + expand */}
                  <View style={{
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <TouchableOpacity
                      onPress={() => setExpandedDay(isExpanded ? null : day)}
                      style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, flex: 1 }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{dayName(day)}</Text>
                      {!data.active ? (
                        <Text style={{ color: C.muted, fontSize: 12 }}>
                          {isRTL ? 'إجازة' : 'Off'}
                        </Text>
                      ) : (
                        <Text style={{ color: C.muted, fontSize: 12 }}>
                          {data.slots.length} {isRTL ? 'وقت' : 'slots'} · {enabledTypes.length} {isRTL ? 'نوع' : 'types'}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Active toggle */}
                    <TouchableOpacity onPress={() => toggleDay(day)}>
                      <View style={{
                        width: 44, height: 26, borderRadius: 13,
                        backgroundColor: data.active ? C.gold : C.dim,
                        justifyContent: 'center',
                        alignItems: data.active ? 'flex-end' : 'flex-start',
                        padding: 2,
                      }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF' }} />
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Expanded content */}
                  {isExpanded && data.active && (
                    <View style={{ marginTop: 16 }}>
                      {/* Service types section */}
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
                        {isRTL ? 'أنواع الاستشارات المقبولة' : 'Accepted consultation types'}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                        {ALL_TYPES.map(t =>
                          renderTypeChip(
                            t,
                            enabledTypes.includes(t),
                            () => toggleDefaultService(day, t),
                          ),
                        )}
                      </View>

                      {/* Time slots */}
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
                        {isRTL ? 'الأوقات المتاحة' : 'Available time slots'}
                      </Text>
                      <View style={{
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        flexWrap: 'wrap',
                        gap: 6,
                      }}>
                        {availableSlots.map(slot => {
                          const sel = data.slots.includes(slot);
                          return (
                            <TouchableOpacity
                              key={slot}
                              onPress={() => toggleSlot(day, slot)}
                              style={{
                                minWidth: 56,
                                paddingVertical: 6,
                                paddingHorizontal: 8,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: sel ? C.gold : C.border,
                                backgroundColor: sel ? C.gold : 'transparent',
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{
                                color: sel ? '#FFF' : C.text,
                                fontSize: 11,
                                fontWeight: sel ? '700' : '400',
                              }}>
                                {slot}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* ───────── DATE OVERRIDES ──────────────────────────────────── */}
            <View style={{ marginTop: 24, marginBottom: 12 }}>
              <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 4 }}>
                {isRTL ? 'استثناءات التواريخ' : 'Date Exceptions'}
              </Text>
              <Text style={{ color: C.muted, fontSize: 12, marginBottom: 12 }}>
                {isRTL
                  ? 'عدّل الأوقات أو أنواع الاستشارات لتاريخ محدد'
                  : 'Edit slots or consultation types for a specific date'}
              </Text>

              <View style={{
                backgroundColor: C.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: C.border,
                padding: 14,
              }}>
                {/* Month header */}
                <View style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <TouchableOpacity onPress={() => {
                    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
                    else setViewMonth(m => m - 1);
                  }}>
                    <MaterialCommunityIcons name="chevron-left" size={24} color={C.gold} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
                    {(isRTL ? AR_MONTHS : EN_MONTHS)[viewMonth]} {viewYear}
                  </Text>
                  <TouchableOpacity onPress={() => {
                    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
                    else setViewMonth(m => m + 1);
                  }}>
                    <MaterialCommunityIcons name="chevron-right" size={24} color={C.gold} />
                  </TouchableOpacity>
                </View>

                {/* Day grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {calendarDays.map((dt, i) => {
                    if (!dt) return <View key={`e-${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />;
                    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                    const isPast = dt < new Date(new Date().setHours(0, 0, 0, 0));
                    const isSel = selectedDate === iso;
                    const ov = overrides[iso];
                    const hasServiceOv = !!ov?.service_types;
                    const isOff = ov?.is_off;

                    return (
                      <TouchableOpacity
                        key={iso}
                        disabled={isPast}
                        onPress={() => setSelectedDate(isSel ? null : iso)}
                        style={{ width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <View style={{
                          width: 34, height: 34, borderRadius: 17,
                          backgroundColor:
                            isSel        ? C.gold :
                            isOff        ? C.danger + '20' :
                            hasServiceOv ? C.accent + '20' :
                            ov           ? C.gold + '20' :
                            'transparent',
                          borderWidth: isSel ? 0 : 1,
                          borderColor:
                            isOff        ? C.danger :
                            hasServiceOv ? C.accent :
                            ov           ? C.gold :
                            'transparent',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Text style={{
                            color: isSel ? '#FFF' : isPast ? C.dim : C.text,
                            fontSize: 13,
                            fontWeight: isSel || ov ? '700' : '400',
                          }}>
                            {dt.getDate()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Legend */}
                <View style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap', gap: 12, marginTop: 12,
                  paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border,
                }}>
                  <LegendDot color={C.gold}    label={isRTL ? 'موعد مخصص' : 'Custom slots'} />
                  <LegendDot color={C.accent}  label={isRTL ? 'خدمات مخصصة' : 'Custom services'} />
                  <LegendDot color={C.danger}  label={isRTL ? 'إجازة' : 'Off'} />
                </View>
              </View>
            </View>

            {/* ───────── SELECTED DATE EDITOR ────────────────────────────── */}
            {selectedDate && (
              <View style={{
                backgroundColor: C.surface,
                padding: 16, borderRadius: 16,
                borderWidth: 1, borderColor: C.gold + '40',
                marginBottom: 20,
              }}>
                <View style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 12,
                }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
                    {isRTL ? 'تعديل: ' : 'Editing: '}{selectedDate}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedDate(null)}>
                    <MaterialCommunityIcons name="close" size={20} color={C.muted} />
                  </TouchableOpacity>
                </View>

                {/* Service types for this date */}
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
                  {isRTL ? 'أنواع الاستشارات لهذا اليوم' : 'Consultation types for this date'}
                </Text>
                {(() => {
                  const ov = overrides[selectedDate];
                  const dow = String(new Date(selectedDate + 'T00:00:00').getDay());
                  const effective = ov?.service_types ?? serviceDefaults[dow] ?? [];
                  const usingDefault = !ov?.service_types;
                  return (
                    <>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        {ALL_TYPES.map(t =>
                          renderTypeChip(
                            t,
                            effective.includes(t),
                            () => toggleOverrideService(selectedDate, t),
                          ),
                        )}
                      </View>
                      {usingDefault ? (
                        <Text style={{ color: C.muted, fontSize: 11, marginBottom: 16 }}>
                          {isRTL ? '(يطبّق الافتراضي الأسبوعي)' : '(Using weekly default)'}
                        </Text>
                      ) : (
                        <TouchableOpacity onPress={() => clearOverrideService(selectedDate)}>
                          <Text style={{ color: C.gold, fontSize: 12, marginBottom: 16 }}>
                            {isRTL ? '↻ إعادة للافتراضي الأسبوعي' : '↻ Reset to weekly default'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  );
                })()}

                {/* Time slots for this date */}
                <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
                  {isRTL ? 'الأوقات المتاحة' : 'Available time slots'}
                </Text>
                <Text style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>
                  {isRTL ? 'أزل جميع الأوقات لجعل اليوم إجازة' : 'Remove all slots to mark as off'}
                </Text>
                <View style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  flexWrap: 'wrap', gap: 4,
                }}>
                  {availableSlots.map(slot => {
                    const active = overrides[selectedDate]?.slots?.includes(slot);
                    return (
                      <TouchableOpacity
                        key={slot}
                        onPress={() => toggleOverrideSlot(selectedDate, slot)}
                        style={{
                          paddingHorizontal: 8, paddingVertical: 5,
                          borderRadius: 8, borderWidth: 1,
                          borderColor: active ? C.gold : C.border,
                          backgroundColor: active ? C.gold : 'transparent',
                          minWidth: 50, alignItems: 'center',
                        }}
                      >
                        <Text style={{
                          color: active ? '#FFF' : C.text,
                          fontSize: 11,
                          fontWeight: active ? '700' : '400',
                        }}>
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Sticky save */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 16, backgroundColor: C.bg,
        borderTopWidth: 1, borderTopColor: C.border,
      }}>
        <TouchableOpacity
          onPress={save}
          disabled={saving || loading}
          activeOpacity={0.85}
          style={{
            backgroundColor: (saving || loading) ? C.dim : C.gold,
            borderRadius: 12, paddingVertical: 16,
            alignItems: 'center', flexDirection: 'row',
            justifyContent: 'center', gap: 8,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save" size={20} color="#1C1611" />
              <Text style={{ color: '#1C1611', fontSize: 16, fontWeight: '700' }}>
                {isRTL ? 'حفظ الكل' : 'Save all'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Tiny component ──────────────────────────────────────────────────────────
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: '#6B5E4E' }}>{label}</Text>
    </View>
  );
}
