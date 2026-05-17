import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  RefreshControl, Alert, ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { Badge, Spinner, Empty, Btn, Card } from '../../src/components/ui';
import { jobsAPI } from '../../src/services/api';
import { useAuth } from '../../src/hooks/useAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../../src/i18n';

const TYPE_COLORS: Record<string, string> = {
  'Full-time':  '#10B981',
  'Internship': '#3B82F6',
  'Freelance':  '#F59E0B',
  'Part-time':  '#8B5CF6',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function AvatarBadge({ name, size = 40, C }: any) {
  const initials = (name || 'C').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.gold + '30', borderWidth: 1, borderColor: C.gold + '60', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.gold, fontWeight: '800', fontSize: size * 0.35 }}>{initials}</Text>
    </View>
  );
}

function JobCard({ item, C, isRTL, onPress, onSave, onApply, saved, applied, applying }: any) {
  const reqs = typeof item.requirements === 'string' ? JSON.parse(item.requirements || '[]') : (item.requirements || []);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.92} style={{
      backgroundColor: C.card, borderWidth: 1,
      borderColor: item.urgent ? '#EF4444' + '50' : C.border,
      borderRadius: 16, marginBottom: 12, overflow: 'hidden',
    }}>
      {item.urgent && (
        <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 4 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>🔴 {isRTL ? 'وظيفة عاجلة' : 'Urgent Hiring'}</Text>
        </View>
      )}
      <View style={{ padding: 16 }}>
        {/* Top row */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <AvatarBadge name={item.company} size={46} C={C} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 2 }} numberOfLines={2}>{item.title}</Text>
            <Text style={{ color: C.gold, fontWeight: '600', fontSize: 13 }}>{item.company}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={{ color: C.muted, fontSize: 11 }}>📍 {item.location || 'Egypt'}</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>· {timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* Chips row */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          <View style={{ backgroundColor: (TYPE_COLORS[item.type] || C.gold) + '20', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: TYPE_COLORS[item.type] || C.gold, fontSize: 11, fontWeight: '700' }}>{item.type}</Text>
          </View>
          {item.salary_min > 0 && (
            <View style={{ backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.text, fontSize: 11, fontWeight: '600' }}>
                💰 {item.salary_min.toLocaleString()} – {item.salary_max.toLocaleString()} EGP
              </Text>
            </View>
          )}
        </View>

        {/* Requirements preview */}
        {reqs.slice(0, 2).map((r: string, i: number) => (
          <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 3 }}>
            <Text style={{ color: C.gold }}>✓</Text>
            <Text style={{ color: C.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>{r}</Text>
          </View>
        ))}

        {/* Footer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
          <Text style={{ color: C.muted, fontSize: 11 }}>
            👥 {item.applicant_count || 0} {isRTL ? 'متقدم' : 'applicants'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={onSave} style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
              borderWidth: 1, borderColor: saved ? C.gold : C.border,
              backgroundColor: saved ? C.gold + '15' : 'transparent',
            }}>
              <Text style={{ color: saved ? C.gold : C.muted, fontSize: 12, fontWeight: '600' }}>
                {saved ? '🔖 Saved' : '🔖 Save'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onApply} disabled={applied || applying} style={{
              paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
              backgroundColor: applied ? C.green + '20' : C.gold,
            }}>
              {applying ? <ActivityIndicator size={12} color="#fff" /> : (
                <Text style={{ color: applied ? C.green : '#fff', fontSize: 12, fontWeight: '700' }}>
                  {applied ? '✅ Applied' : isRTL ? 'تقدم الآن' : 'Easy Apply'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Cover Letter Modal ───────────────────────────────────────────────────────
function ApplyModal({ visible, job, C, isRTL, onClose, onSubmit, submitting }: any) {
  const [cover, setCover] = useState('');
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 18, marginBottom: 4 }}>
            {isRTL ? 'تقدم للوظيفة' : 'Apply for Job'}
          </Text>
          <Text style={{ color: C.gold, fontWeight: '600', marginBottom: 16 }}>{job?.title} · {job?.company}</Text>
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 6 }}>
            {isRTL ? 'رسالة التقديم (اختياري)' : 'Cover Letter (optional)'}
          </Text>
          <TextInput
            value={cover} onChangeText={setCover} multiline numberOfLines={5}
            placeholder={isRTL ? 'أخبرنا لماذا أنت الشخص المناسب...' : 'Tell them why you are the right fit...'}
            placeholderTextColor={C.muted}
            style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, color: C.text, fontSize: 13, textAlignVertical: 'top', minHeight: 100, marginBottom: 16 }}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: C.muted, fontWeight: '600' }}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={submitting} onPress={() => onSubmit(cover)} style={{ flex: 2, backgroundColor: C.gold, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{isRTL ? '📨 إرسال الطلب' : '📨 Submit Application'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Job Detail View ──────────────────────────────────────────────────────────
function JobDetail({ job, C, isRTL, insets, onBack, saved, applied, applying, onSave, onApply }: any) {
  const reqs = typeof job.requirements === 'string' ? JSON.parse(job.requirements || '[]') : (job.requirements || []);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TouchableOpacity onPress={onBack}><Text style={{ color: C.text, fontSize: 24 }}>‹</Text></TouchableOpacity>
        <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, flex: 1 }} numberOfLines={1}>{job.title}</Text>
        <TouchableOpacity onPress={onSave}>
          <Text style={{ fontSize: 20 }}>{saved ? '🔖' : '🔕'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        {/* Header card */}
        <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 20, marginBottom: 14, alignItems: 'center' }}>
          <AvatarBadge name={job.company} size={64} C={C} />
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 20, marginTop: 12, textAlign: 'center' }}>{job.title}</Text>
          <Text style={{ color: C.gold, fontWeight: '600', fontSize: 15, marginTop: 2 }}>{job.company}</Text>
          <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>📍 {job.location} · {timeAgo(job.created_at)}</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' }}>
            <View style={{ backgroundColor: (TYPE_COLORS[job.type] || C.gold) + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ color: TYPE_COLORS[job.type] || C.gold, fontWeight: '700', fontSize: 12 }}>{job.type}</Text>
            </View>
            {job.urgent && (
              <View style={{ backgroundColor: '#EF444420', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>🔴 Urgent</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 24, marginTop: 14 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: C.gold, fontWeight: '800', fontSize: 16 }}>{job.applicant_count || 0}</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>{isRTL ? 'متقدم' : 'Applicants'}</Text>
            </View>
            {job.salary_min > 0 && (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: C.gold, fontWeight: '800', fontSize: 14 }}>
                  {job.salary_min.toLocaleString()}–{job.salary_max.toLocaleString()}
                </Text>
                <Text style={{ color: C.muted, fontSize: 11 }}>EGP / month</Text>
              </View>
            )}
          </View>
        </View>

        {/* Posted by */}
        {job.poster_name && (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AvatarBadge name={job.poster_name} size={40} C={C} />
            <View>
              <Text style={{ color: C.muted, fontSize: 11 }}>{isRTL ? 'نشر بواسطة' : 'Posted by'}</Text>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 13 }}>{job.poster_name}</Text>
            </View>
          </View>
        )}

        {/* Description */}
        {job.description && (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>📝 {isRTL ? 'عن الوظيفة' : 'About the Role'}</Text>
            <Text style={{ color: C.muted, fontSize: 14, lineHeight: 24 }}>{job.description}</Text>
          </View>
        )}

        {/* Requirements */}
        {reqs.length > 0 && (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 16, marginBottom: 14 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 10 }}>✅ {isRTL ? 'المتطلبات' : 'Requirements'}</Text>
            {reqs.map((r: string, i: number) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6, borderBottomWidth: i < reqs.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                <Text style={{ color: C.gold, fontWeight: '700' }}>✓</Text>
                <Text style={{ color: C.muted, fontSize: 13, flex: 1 }}>{r}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: insets.bottom + 16 }}>
        {applied
          ? <View style={{ backgroundColor: C.green + '15', borderWidth: 1, borderColor: C.green, borderRadius: 14, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: C.green, fontWeight: '700', fontSize: 15 }}>✅ {isRTL ? 'تم إرسال طلبك بنجاح!' : 'Application Submitted!'}</Text>
            </View>
          : <TouchableOpacity disabled={applying} onPress={onApply} style={{ backgroundColor: C.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}>
              {applying ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                  📨 {isRTL ? 'تقدم للوظيفة الآن' : 'Easy Apply'}
                </Text>
              )}
            </TouchableOpacity>
        }
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
const JOB_TYPES = ['', 'Full-time', 'Part-time', 'Freelance', 'Internship'];

export default function JobsTab() {
  const C      = useTheme();
  const { isLoggedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { isRTL } = useI18n();

  const [jobs,       setJobs]      = useState<any[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [error,      setError]     = useState('');
  const [search,     setSearch]    = useState('');
  const [typeFilter, setType]      = useState('');
  const [tab,        setTab]       = useState<'all' | 'saved'>('all');
  const [selected,   setSelected]  = useState<any>(null);
  const [saved,      setSaved]     = useState<number[]>([]);
  const [applied,    setApplied]   = useState<number[]>([]);
  const [applying,   setApplying]  = useState<number | null>(null);
  const [applyJob,   setApplyJob]  = useState<any>(null);

  const tabRef = useRef(tab);
  tabRef.current = tab;

  const load = useCallback((params?: any, forceTab?: 'all' | 'saved') => {
    const activeTab = forceTab ?? tabRef.current;
    setLoading(true); setError('');
    const promise = activeTab === 'saved'
      ? jobsAPI.getSaved()
      : jobsAPI.list(params);
    (promise as any)
      .then((d: any) => {
        const list: any[] = d.jobs || [];
        setJobs(list);
        setSaved(list.filter((j: any) => j.is_saved).map((j: any) => j.id));
        setApplied(list.filter((j: any) => j.has_applied).map((j: any) => j.id));
      })
      .catch((e: any) => setError(e?.message || 'Failed to load jobs'))
      .finally(() => setLoading(false));
  }, []);

  // Reload when tab filter changes
  useEffect(() => { load(undefined, tab); }, [tab]);

  // Reload every time this screen comes into focus (e.g. after lawyer posts a job)
  useFocusEffect(useCallback(() => { load(undefined, tabRef.current); }, [load]));

  const handleSave = async (jobId: number) => {
    if (!isLoggedIn) { router.push('/(auth)/login'); return; }
    try {
      const d: any = await jobsAPI.toggleSave(jobId);
      setSaved(p => d.saved ? [...p, jobId] : p.filter(x => x !== jobId));
    } catch {}
  };

  const submitApply = async (coverId: number, coverLetter: string) => {
    setApplying(coverId);
    try {
      await jobsAPI.apply(coverId, { coverLetter });
      setApplied(p => [...p, coverId]);
      setApplyJob(null);
      Alert.alert('✅', isRTL ? 'تم إرسال طلبك بنجاح!' : 'Application submitted!');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || 'Failed');
    } finally { setApplying(null); }
  };

  const filtered = jobs.filter(j =>
    (!typeFilter || j.type === typeFilter) &&
    (!search || j.title.toLowerCase().includes(search.toLowerCase()) ||
               j.company.toLowerCase().includes(search.toLowerCase()))
  );

  if (selected) return (
    <>
      <JobDetail
        job={selected} C={C} isRTL={isRTL} insets={insets}
        onBack={() => setSelected(null)}
        saved={saved.includes(selected.id)}
        applied={applied.includes(selected.id)}
        applying={applying === selected.id}
        onSave={() => handleSave(selected.id)}
        onApply={() => {
          if (!isLoggedIn) { router.push('/(auth)/login'); return; }
          if (applied.includes(selected.id)) return;
          setApplyJob(selected);
        }}
      />
      <ApplyModal
        visible={!!applyJob} job={applyJob} C={C} isRTL={isRTL}
        onClose={() => setApplyJob(null)}
        submitting={!!applying}
        onSubmit={(cl: string) => applyJob && submitApply(applyJob.id, cl)}
      />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ color: C.text, fontWeight: '800', fontSize: 22, marginBottom: 12 }}>💼 {isRTL ? 'وظائف قانونية' : 'Legal Jobs'}</Text>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 3, marginBottom: 10, alignSelf: 'flex-start' }}>
          {[['all', isRTL ? 'كل الوظائف' : 'All Jobs'], ['saved', isRTL ? 'المحفوظة' : 'Saved']].map(([v, l]) => (
            <TouchableOpacity key={v} onPress={() => setTab(v as any)} style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
              backgroundColor: tab === v ? C.gold : 'transparent',
            }}>
              <Text style={{ color: tab === v ? '#fff' : C.muted, fontWeight: '700', fontSize: 13 }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Text>🔍</Text>
          <TextInput
            value={search} onChangeText={setSearch}
            onSubmitEditing={() => load({ search, type: typeFilter || undefined })}
            placeholder={isRTL ? 'ابحث بالمسمى أو الشركة...' : 'Search title or company...'}
            placeholderTextColor={C.muted}
            style={{ flex: 1, color: C.text, fontSize: 14 }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); load({ type: typeFilter || undefined }); }}>
              <Text style={{ color: C.muted, fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Type chips */}
        <FlatList
          horizontal data={JOB_TYPES} keyExtractor={i => i || 'all'}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setType(item)} style={{
              paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
              borderWidth: 1, borderColor: typeFilter === item ? C.gold : C.border,
              backgroundColor: typeFilter === item ? C.gold + '15' : 'transparent',
            }}>
              <Text style={{ color: typeFilter === item ? C.gold : C.text, fontSize: 12, fontWeight: typeFilter === item ? '700' : '400' }}>
                {item || (isRTL ? 'الكل' : 'All')}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {error && (
        <View style={{ backgroundColor: '#FEE2E2', padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ color: '#DC2626', flex: 1 }}>⚠️ {error}</Text>
          <TouchableOpacity onPress={() => load()}><Text style={{ color: '#DC2626', fontWeight: '700' }}>Retry</Text></TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading && !filtered.length} onRefresh={() => load()} tintColor={C.gold} />}
        ListHeaderComponent={filtered.length > 0 ? (
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>
            {filtered.length} {isRTL ? 'وظيفة متاحة' : 'jobs found'}
          </Text>
        ) : null}
        ListEmptyComponent={
          !loading
            ? <Empty C={C} icon="💼" title={isRTL ? 'لا توجد وظائف' : 'No jobs found'} subtitle={isRTL ? 'جرب كلمة بحث مختلفة' : 'Try a different search'} />
            : <View style={{ padding: 40, alignItems: 'center' }}><Spinner C={C} /></View>
        }
        renderItem={({ item }) => (
          <JobCard
            item={item} C={C} isRTL={isRTL}
            onPress={() => setSelected(item)}
            saved={saved.includes(item.id)}
            applied={applied.includes(item.id)}
            applying={applying === item.id}
            onSave={() => handleSave(item.id)}
            onApply={() => {
              if (!isLoggedIn) { router.push('/(auth)/login'); return; }
              if (applied.includes(item.id)) return;
              setApplyJob(item);
            }}
          />
        )}
      />

      <ApplyModal
        visible={!!applyJob && !selected} job={applyJob} C={C} isRTL={isRTL}
        onClose={() => setApplyJob(null)}
        submitting={!!applying}
        onSubmit={(cl: string) => applyJob && submitApply(applyJob.id, cl)}
      />
    </View>
  );
}
