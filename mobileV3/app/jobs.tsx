import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  RefreshControl, Alert, ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../src/theme';
import { Badge, Spinner, Empty, Btn, Card } from '../src/components/ui';
import { jobsAPI, uploadAPI } from '../src/services/api';
import { useSelector } from 'react-redux';
import { selLoggedIn } from '../src/store/slices/authSlice';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../src/i18n';

const TYPE_COLORS: Record<string, string> = {
  'Full-time': '#10B981', 'Internship': '#3B82F6',
  'Freelance': '#F59E0B', 'Part-time': '#8B5CF6',
};
const JOB_TYPES = ['', 'Full-time', 'Part-time', 'Freelance', 'Internship'];

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d < 7 ? `${d}d ago` : `${Math.floor(d / 7)}w ago`;
  } catch { return ''; }
}

function CompanyAvatar({ name, size = 44, C }: any) {
  const initials = (name || 'C').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.gold + '25', borderWidth: 1.5, borderColor: C.gold + '50', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.gold, fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  );
}

export default function JobsScreen() {
  const C = useTheme();
  const insets = useSafeAreaInsets();
  const isLoggedIn = useSelector(selLoggedIn);
  const { isRTL } = useI18n();

  const [jobs,     setJobs]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [typeFilter, setType]   = useState('');
  const [tab,      setTab]      = useState<'all' | 'saved'>('all');
  const [selected, setSelected] = useState<any>(null);
  const [saved,    setSaved]    = useState<number[]>([]);
  const [applied,  setApplied]  = useState<number[]>([]);
  const [applying, setApplying] = useState<number | null>(null);
  const [applyJob, setApplyJob] = useState<any>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [cvFile, setCvFile] = useState<{ name: string; uri: string } | null>(null);

  const pickCV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: false,
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        setCvFile({ name: asset.name, uri: asset.uri });
      }
    } catch { Alert.alert('Error', 'Could not open document picker'); }
  };

  const load = useCallback((currentTab?: 'all' | 'saved') => {
    const activeTab = currentTab ?? tab;
    setLoading(true); setError('');
    const p = activeTab === 'saved' ? jobsAPI.getSaved() : jobsAPI.list();
    (p as any)
      .then((d: any) => {
        const list: any[] = d.jobs || [];
        setJobs(list);
        setSaved(list.filter((j: any) => j.is_saved).map((j: any) => Number(j.id)));
        setApplied(list.filter((j: any) => j.has_applied).map((j: any) => Number(j.id)));
      })
      .catch((e: any) => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [tab]);

  // Load fresh every time screen mounts (stack navigation means it remounts on push)
  useEffect(() => { load(); }, []);
  useEffect(() => { load(tab); }, [tab]);

  const handleSave = async (jobId: number) => {
    if (!isLoggedIn) { router.push('/(auth)/login'); return; }
    try {
      const d: any = await jobsAPI.toggleSave(jobId);
      setSaved(p => d.saved ? [...p, jobId] : p.filter(x => x !== jobId));
    } catch {}
  };

  const submitApply = async (jobId: number) => {
    if (!isLoggedIn) { router.push('/(auth)/login'); return; }
    if (!cvFile) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'يرجى إرفاق السيرة الذاتية' : 'Please upload your CV');
      return;
    }
    setApplying(jobId);
    try {
      let cv_url = '';
      if (cvFile) {
        const data = new FormData();
        data.append('file', { uri: cvFile.uri, name: cvFile.name, type: 'application/pdf' } as any);
        data.append('folder', 'resumes');
        const up: any = await uploadAPI.upload(data);
        cv_url = up.url || up.file?.url;
      }
      await jobsAPI.apply(jobId, { coverLetter, cv_url });
      setApplied(p => [...p, jobId]);
      setApplyJob(null); setCoverLetter(''); setCvFile(null);
      Alert.alert('✅', isRTL ? 'تم إرسال طلبك بنجاح!' : 'Application submitted!');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message || 'Failed');
    } finally { setApplying(null); }
  };

  const filtered = jobs.filter(j =>
    (!typeFilter || j.type === typeFilter) &&
    (!search || j.title?.toLowerCase().includes(search.toLowerCase()) ||
               j.company?.toLowerCase().includes(search.toLowerCase()))
  );

  // ── Job Detail ──────────────────────────────────────────────────────────────
  if (selected) {
    const reqs = typeof selected.requirements === 'string'
      ? JSON.parse(selected.requirements || '[]')
      : (selected.requirements || []);
    const isSaved   = saved.includes(Number(selected.id));
    const isApplied = applied.includes(Number(selected.id));
    const typeColor = TYPE_COLORS[selected.type] || C.gold;
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Nav */}
        <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => setSelected(null)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.text, fontSize: 20, lineHeight: 22 }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, flex: 1 }} numberOfLines={1}>{selected.title}</Text>
          <TouchableOpacity onPress={() => handleSave(Number(selected.id))} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isSaved ? C.gold + '20' : C.card, borderWidth: 1, borderColor: isSaved ? C.gold : C.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 17 }}>{isSaved ? '🔖' : '🏷️'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Hero */}
          <View style={{ backgroundColor: C.surface, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
              <CompanyAvatar name={selected.company} size={58} C={C} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 18, lineHeight: 23, marginBottom: 3 }}>{selected.title}</Text>
                <Text style={{ color: C.gold, fontWeight: '600', fontSize: 14 }}>{selected.company}</Text>
                <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>📍 {selected.location}  ·  {timeAgo(selected.created_at)}</Text>
              </View>
            </View>

            {/* Badges */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              <View style={{ backgroundColor: typeColor + '18', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: typeColor + '40' }}>
                <Text style={{ color: typeColor, fontWeight: '700', fontSize: 12 }}>{selected.type}</Text>
              </View>
              {selected.urgent && (
                <View style={{ backgroundColor: '#EF444415', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#EF444440' }}>
                  <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>🔴 Urgent</Text>
                </View>
              )}
              {(selected.salary_min || 0) > 0 && (
                <View style={{ backgroundColor: C.gold + '15', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.gold + '40' }}>
                  <Text style={{ color: C.gold, fontWeight: '700', fontSize: 12 }}>💰 {Number(selected.salary_min).toLocaleString()}–{Number(selected.salary_max).toLocaleString()} EGP</Text>
                </View>
              )}
            </View>

            {/* Stats strip */}
            <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
              {[
                { icon: '👥', val: String(selected.applicant_count || 0), lbl: 'Applicants' },
                { icon: '🏢', val: selected.company?.split(' ')[0] || '—', lbl: 'Company' },
                { icon: '📍', val: (selected.location || '—').split(',')[0], lbl: 'Location' },
              ].map((s, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRightWidth: i < 2 ? 1 : 0, borderRightColor: C.border }}>
                  <Text style={{ fontSize: 17, marginBottom: 2 }}>{s.icon}</Text>
                  <Text style={{ color: C.text, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>{s.val}</Text>
                  <Text style={{ color: C.muted, fontSize: 10 }}>{s.lbl}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Recruiter */}
          {!!selected.poster_name && (
            <View style={{ margin: 16, marginBottom: 0, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <CompanyAvatar name={selected.poster_name} size={44} C={C} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.muted, fontSize: 11 }}>Recruiter</Text>
                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{selected.poster_name}</Text>
                <Text style={{ color: C.muted, fontSize: 12 }}>{selected.company}</Text>
              </View>
              <View style={{ backgroundColor: '#10B98115', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#10B98140' }}>
                <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '700' }}>✓ Hiring</Text>
              </View>
            </View>
          )}

          {/* Description */}
          {!!selected.description && (
            <View style={{ margin: 16, marginBottom: 0, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 18 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 15, marginBottom: 10 }}>About the Role</Text>
              <Text style={{ color: C.muted, fontSize: 14, lineHeight: 22 }}>{selected.description}</Text>
            </View>
          )}

          {/* Requirements as chips */}
          {reqs.length > 0 && (
            <View style={{ margin: 16, marginBottom: 0, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 18 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 15, marginBottom: 14 }}>Requirements</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {reqs.map((r: string, i: number) => (
                  <View key={i} style={{ backgroundColor: C.gold + '12', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: C.gold + '30', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: C.gold, fontSize: 11, fontWeight: '800' }}>✓</Text>
                    <Text style={{ color: C.text, fontSize: 12, fontWeight: '600' }}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {isApplied && (
            <View style={{ margin: 16, backgroundColor: '#10B98112', borderRadius: 14, borderWidth: 1, borderColor: '#10B981', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 22 }}>✅</Text>
              <View>
                <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 14 }}>Application Sent</Text>
                <Text style={{ color: '#10B981', fontSize: 12, opacity: 0.8 }}>You've applied to this position</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom CTA */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 16, paddingVertical: 12, paddingBottom: insets.bottom + 12 }}>
          {isApplied ? (
            <View style={{ backgroundColor: '#10B98112', borderRadius: 14, borderWidth: 1, borderColor: '#10B981', paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 15 }}>✅ Application Submitted</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => handleSave(Number(selected.id))} style={{ width: 50, height: 50, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>{isSaved ? '🔖' : '🏷️'}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={!!applying} onPress={() => setApplyJob(selected)} style={{ flex: 1, backgroundColor: C.gold, borderRadius: 14, height: 50, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                {applying ? <ActivityIndicator color="#fff" /> : (
                  <><Text style={{ fontSize: 16 }}>⚡</Text><Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Easy Apply</Text></>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Premium Apply Modal ── */}
        <Modal visible={!!applyJob} animationType="slide" transparent onRequestClose={() => { setApplyJob(null); setCoverLetter(''); setCvFile(null); }}>
          <View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 20 }}>
              <View style={{ alignItems: 'center', paddingTop: 12, marginBottom: 4 }}>
                <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
              </View>
              <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ color: C.text, fontWeight: '800', fontSize: 20, marginBottom: 2 }}>Apply Now ⚡</Text>
                <Text style={{ color: C.muted, fontSize: 13 }}>{applyJob?.title} at {applyJob?.company}</Text>
              </View>

              <ScrollView style={{ paddingHorizontal: 24 }} contentContainerStyle={{ paddingTop: 18, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 18 }}>
                  <CompanyAvatar name={applyJob?.company || ''} size={44} C={C} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>{applyJob?.title}</Text>
                    <Text style={{ color: C.gold, fontSize: 13 }}>{applyJob?.company}</Text>
                    <Text style={{ color: C.muted, fontSize: 11 }}>📍 {applyJob?.location}</Text>
                  </View>
                </View>

                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 8 }}>
                  CV / Resume <Text style={{ color: '#EF4444', fontWeight: '800' }}>*</Text>
                </Text>
                <TouchableOpacity onPress={pickCV} style={{ backgroundColor: cvFile ? C.gold + '15' : C.card, borderWidth: 1.5, borderColor: cvFile ? C.gold : C.border, borderStyle: cvFile ? 'solid' : 'dashed', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 18, flexDirection: 'row', gap: 12, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>{cvFile ? '📄' : '📎'}</Text>
                  <View style={{ flex: 1 }}>
                    {cvFile ? (
                      <>
                        <Text style={{ color: C.gold, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{cvFile.name}</Text>
                        <Text style={{ color: C.muted, fontSize: 11 }}>Tap to change</Text>
                      </>
                    ) : (
                      <>
                        <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }}>Upload your CV</Text>
                        <Text style={{ color: C.muted, fontSize: 11 }}>PDF, DOC, DOCX</Text>
                      </>
                    )}
                  </View>
                  {cvFile && <TouchableOpacity onPress={() => setCvFile(null)} style={{ padding: 4 }}><Text style={{ color: '#EF4444', fontWeight: '700' }}>✕</Text></TouchableOpacity>}
                </TouchableOpacity>

                <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 6 }}>
                  Cover Letter <Text style={{ color: C.muted, fontWeight: '400', fontSize: 12 }}>(optional)</Text>
                </Text>
                <TextInput
                  value={coverLetter}
                  onChangeText={t => setCoverLetter(t.slice(0, 500))}
                  multiline
                  placeholder="Tell the recruiter why you're a great fit for this role..."
                  placeholderTextColor={C.muted}
                  style={{ backgroundColor: C.surface, borderWidth: 1.5, borderColor: coverLetter.length > 0 ? C.gold : C.border, borderRadius: 14, padding: 14, color: C.text, textAlignVertical: 'top', minHeight: 110, fontSize: 14, lineHeight: 21, marginBottom: 6 }}
                />
                <Text style={{ color: C.muted, fontSize: 11, marginBottom: 16, textAlign: 'right' }}>{coverLetter.length}/500</Text>

                <View style={{ backgroundColor: C.gold + '0F', borderRadius: 12, borderWidth: 1, borderColor: C.gold + '30', padding: 12, marginBottom: 20, flexDirection: 'row', gap: 10 }}>
                  <Text style={{ fontSize: 15 }}>💡</Text>
                  <Text style={{ color: C.muted, fontSize: 12, flex: 1, lineHeight: 18 }}>Applications with a cover letter get 3x more responses. Keep it short and highlight your most relevant experience.</Text>
                </View>
              </ScrollView>

              <View style={{ paddingHorizontal: 24, gap: 10 }}>
                <TouchableOpacity disabled={!!applying} onPress={() => applyJob && submitApply(Number(applyJob.id))}
                  style={{ backgroundColor: C.gold, borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                  {applying ? <ActivityIndicator color="#fff" /> : (
                    <><Text style={{ fontSize: 18 }}>⚡</Text><Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Submit Application</Text></>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setApplyJob(null); setCoverLetter(''); setCvFile(null); }} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: C.muted, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ── Jobs List ───────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 10, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: C.text, fontWeight: '800', fontSize: 22, flex: 1 }}>💼 {isRTL ? 'وظائف قانونية' : 'Legal Jobs'}</Text>
        </View>

        {/* Tabs: All / Saved */}
        <View style={{ flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 3, marginBottom: 10, alignSelf: 'flex-start' }}>
          {[['all', isRTL ? 'كل الوظائف' : 'All Jobs'], ['saved', isRTL ? 'المحفوظة' : 'Saved']] .map(([v, l]) => (
            <TouchableOpacity key={v} onPress={() => setTab(v as any)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: tab === v ? C.gold : 'transparent' }}>
              <Text style={{ color: tab === v ? '#fff' : C.muted, fontWeight: '700', fontSize: 13 }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <View style={{ flexDirection: 'row', backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Text>🔍</Text>
          <TextInput value={search} onChangeText={setSearch}
            placeholder={isRTL ? 'ابحث...' : 'Search title or company...'}
            placeholderTextColor={C.muted} style={{ flex: 1, color: C.text, fontSize: 14 }}
          />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Text style={{ color: C.muted, fontSize: 18 }}>×</Text></TouchableOpacity>}
        </View>

        {/* Type chips */}
        <FlatList horizontal data={JOB_TYPES} keyExtractor={i => i || 'all'} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setType(item)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: typeFilter === item ? C.gold : C.border, backgroundColor: typeFilter === item ? C.gold + '15' : 'transparent' }}>
              <Text style={{ color: typeFilter === item ? C.gold : C.text, fontSize: 12, fontWeight: typeFilter === item ? '700' : '400' }}>{item || (isRTL ? 'الكل' : 'All')}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {error ? (
        <View style={{ backgroundColor: '#FEE2E2', padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ color: '#DC2626', flex: 1 }}>⚠️ {error}</Text>
          <TouchableOpacity onPress={() => load()}><Text style={{ color: '#DC2626', fontWeight: '700' }}>Retry</Text></TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading && !filtered.length} onRefresh={() => load()} tintColor={C.gold} />}
        ListHeaderComponent={filtered.length > 0 ? (
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>{filtered.length} {isRTL ? 'وظيفة' : 'jobs found'}</Text>
        ) : null}
        ListEmptyComponent={
          !loading
            ? <Empty C={C} icon="💼" title={isRTL ? 'لا توجد وظائف' : 'No jobs found'} subtitle={isRTL ? 'اسحب للأسفل للتحديث' : 'Pull down to refresh'} />
            : <View style={{ padding: 40, alignItems: 'center' }}><Spinner C={C} /></View>
        }
        renderItem={({ item }) => {
          const isSaved = saved.includes(Number(item.id));
          const isApplied = applied.includes(Number(item.id));
          const reqs = typeof item.requirements === 'string' ? JSON.parse(item.requirements || '[]') : (item.requirements || []);
          return (
            <TouchableOpacity onPress={() => setSelected(item)} activeOpacity={0.92} style={{
              backgroundColor: C.card, borderWidth: 1,
              borderColor: item.urgent ? '#EF4444' + '50' : C.border,
              borderRadius: 16, marginBottom: 12, overflow: 'hidden',
            }}>
              {item.urgent && (
                <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 3 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>🔴 {isRTL ? 'توظيف عاجل' : 'Urgent Hiring'}</Text>
                </View>
              )}
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                  <CompanyAvatar name={item.company} size={46} C={C} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 2 }} numberOfLines={2}>{item.title}</Text>
                    <Text style={{ color: C.gold, fontWeight: '600', fontSize: 13 }}>{item.company}</Text>
                    <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>📍 {item.location} · {timeAgo(item.created_at)}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  <View style={{ backgroundColor: (TYPE_COLORS[item.type] || C.gold) + '20', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ color: TYPE_COLORS[item.type] || C.gold, fontSize: 11, fontWeight: '700' }}>{item.type}</Text>
                  </View>
                  {(item.salary_min || 0) > 0 && (
                    <View style={{ backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.border }}>
                      <Text style={{ color: C.text, fontSize: 11 }}>💰 {Number(item.salary_min).toLocaleString()}–{Number(item.salary_max).toLocaleString()} EGP</Text>
                    </View>
                  )}
                </View>

                {reqs.slice(0, 2).map((r: string, i: number) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                    <Text style={{ color: C.gold, fontSize: 11 }}>✓</Text>
                    <Text style={{ color: C.muted, fontSize: 11, flex: 1 }} numberOfLines={1}>{r}</Text>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border }}>
                  <Text style={{ color: C.muted, fontSize: 11 }}>👥 {item.applicant_count || 0} {isRTL ? 'متقدم' : 'applicants'}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); handleSave(Number(item.id)); }} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: isSaved ? C.gold : C.border, backgroundColor: isSaved ? C.gold + '15' : 'transparent' }}>
                      <Text style={{ color: isSaved ? C.gold : C.muted, fontSize: 12, fontWeight: '600' }}>{isSaved ? '🔖' : '🔕'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); setSelected(item); }} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: isApplied ? '#10B98120' : C.gold }}>
                      <Text style={{ color: isApplied ? '#10B981' : '#fff', fontSize: 12, fontWeight: '700' }}>
                        {isApplied ? '✅' : (isRTL ? 'تقدم' : 'Apply')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* No list-level modal — Apply on card now navigates to detail page */}
    </View>
  );
}