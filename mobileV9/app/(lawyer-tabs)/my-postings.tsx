import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Modal, ScrollView, Linking, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { jobsAPI } from '../../src/services/api';
import { useI18n } from '../../src/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Spinner, Empty } from '../../src/components/ui';

export default function MyPostingsScreen() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [postJobVisible, setPostJobVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'menu' | 'list'>('menu');
  const [jobForm, setJobForm] = useState({ title: '', company: '', location: '', type: 'Full-time', salary_min: '', salary_max: '', description: '', urgent: false, post_to_forum: true });
  const [postingJob, setPostingJob] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d: any = await jobsAPI.myJobs();
      setJobs(d.jobs || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fetchApplicants = async (job: any) => {
    setSelectedJob(job);
    setLoadingApplicants(true);
    try {
      const d: any = await jobsAPI.getApplicants(job.id);
      setApplicants(d.applicants || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingApplicants(false);
    }
  };

  const submitJob = async () => {
    if (!jobForm.title || !jobForm.company) {
      alert(isRTL ? 'المسمى الوظيفي والشركة مطلوبان' : 'Title and company are required');
      return;
    }
    setPostingJob(true);
    try {
      await jobsAPI.post({
        ...jobForm,
        salary_min: parseInt(jobForm.salary_min) || 0,
        salary_max: parseInt(jobForm.salary_max) || 0,
      });
      alert(isRTL ? 'تم نشر الوظيفة بنجاح!' : 'Job posted successfully!');
      setPostJobVisible(false);
      setJobForm({ title: '', company: '', location: '', type: 'Full-time', salary_min: '', salary_max: '', description: '', urgent: false, post_to_forum: true });
      load(); // refresh the list
    } catch (e: any) {
      alert(e?.message || 'Failed');
    } finally { setPostingJob(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => viewMode === 'list' ? setViewMode('menu') : router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 20, color: C.text }}>{isRTL ? '→' : '←'}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, flex: 1 }}>
          {viewMode === 'menu' ? (isRTL ? 'التوظيف' : 'Recruit') : (isRTL ? 'إعلاناتي والمتقدمين' : 'My Postings')}
        </Text>
      </View>

      {viewMode === 'menu' ? (
        <View style={{ padding: 20, gap: 16 }}>
          {/* Post a Job Button */}
          <TouchableOpacity
            onPress={() => setPostJobVisible(true)}
            style={{
              width: '100%', backgroundColor: C.gold + '15',
              borderWidth: 2, borderColor: C.gold, borderRadius: 16,
              padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16,
            }}>
            <Text style={{ fontSize: 32 }}>💼</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.gold, fontWeight: '800', fontSize: 18 }}>{isRTL ? 'نشر وظيفة' : 'Post a Job'}</Text>
              <Text style={{ color: C.text, fontSize: 13, marginTop: 4 }}>{isRTL ? 'ابحث عن كفاءات قانونية' : 'Find legal talent on Wakeel'}</Text>
            </View>
            <Text style={{ color: C.gold, fontSize: 24 }}>+</Text>
          </TouchableOpacity>

          {/* My Postings & Applicants Button */}
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            style={{
              width: '100%', backgroundColor: C.surface,
              borderWidth: 1, borderColor: C.border, borderRadius: 16,
              padding: 24, flexDirection: 'row', alignItems: 'center', gap: 16,
            }}>
            <Text style={{ fontSize: 32 }}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18 }}>{isRTL ? 'إعلاناتي والمتقدمين' : 'My Postings & Applicants'}</Text>
              <Text style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{isRTL ? 'تتبع طلبات التوظيف' : 'Track job applications and review CVs'}</Text>
            </View>
            <Text style={{ color: C.muted, fontSize: 24 }}>→</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
        data={jobs}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.gold} />}
        ListEmptyComponent={
          !loading ? <Empty C={C} icon="💼" title={isRTL ? 'لا توجد وظائف' : 'No posted jobs'} subtitle={isRTL ? 'لم تقم بنشر أي وظائف بعد' : 'You have not posted any jobs yet'} /> : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => fetchApplicants(item)} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 16, flex: 1 }} numberOfLines={2}>{item.title}</Text>
              <View style={{ backgroundColor: C.gold + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, height: 26 }}>
                <Text style={{ color: C.gold, fontSize: 12, fontWeight: '700' }}>{item.applicant_count || 0} {isRTL ? 'متقدمين' : 'Applicants'}</Text>
              </View>
            </View>
            <Text style={{ color: C.muted, fontSize: 13, marginBottom: 4 }}>{item.company} • {item.location}</Text>
            <Text style={{ color: C.muted, fontSize: 11 }}>{new Date(item.created_at).toLocaleDateString()}</Text>
          </TouchableOpacity>
        )}
      />
      )}

      <Modal visible={!!selectedJob} animationType="slide" onRequestClose={() => setSelectedJob(null)}>
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <TouchableOpacity onPress={() => setSelectedJob(null)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border }}>
              <Text style={{ fontSize: 20, color: C.text }}>{isRTL ? '→' : '←'}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }} numberOfLines={1}>{selectedJob?.title}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>{selectedJob?.applicant_count || 0} {isRTL ? 'متقدمين' : 'Applicants'}</Text>
            </View>
          </View>

          {loadingApplicants ? (
            <View style={{ padding: 40, alignItems: 'center' }}><Spinner C={C} /></View>
          ) : (
            <FlatList
              data={applicants}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
              ListEmptyComponent={<Empty C={C} icon="👥" title={isRTL ? 'لا يوجد متقدمين' : 'No applicants yet'} subtitle={isRTL ? 'لم يتقدم أحد لهذه الوظيفة' : 'No one has applied to this job yet'} />}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <Avatar url={item.avatar_url} name={item.name} size={48} C={C} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{item.name}</Text>
                      <Text style={{ color: C.muted, fontSize: 13 }}>{item.email}</Text>
                      <Text style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{new Date(item.created_at).toLocaleDateString()}</Text>
                    </View>
                  </View>
                  
                  {item.cover_letter ? (
                    <View style={{ backgroundColor: C.surface, padding: 12, borderRadius: 12, marginBottom: 12 }}>
                      <Text style={{ color: C.text, fontSize: 13, lineHeight: 20 }}>{item.cover_letter}</Text>
                    </View>
                  ) : null}

                  {item.cv_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(item.cv_url)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.gold, paddingVertical: 12, borderRadius: 12 }}>
                      <Text style={{ fontSize: 16 }}>📄</Text>
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{isRTL ? 'عرض السيرة الذاتية' : 'View CV'}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center', fontStyle: 'italic' }}>{isRTL ? 'لم يتم إرفاق سيرة ذاتية' : 'No CV uploaded'}</Text>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </Modal>

      {/* ── Post a Job Modal ─────────────────────────────────────────────── */}
      <Modal visible={postJobVisible} animationType="slide" transparent onRequestClose={() => setPostJobVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border }}>
              <Text style={{ color: C.text, fontWeight: '800', fontSize: 18, flex: 1 }}>💼 {isRTL ? 'نشر وظيفة جديدة' : 'Post a New Job'}</Text>
              <TouchableOpacity onPress={() => setPostJobVisible(false)}>
                <Text style={{ color: C.muted, fontSize: 26 }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <Text style={{ color: C.muted, fontSize: 12, marginBottom: 5 }}>{isRTL ? 'المسمى الوظيفي *' : 'Job Title *'}</Text>
              <TextInput
                value={jobForm.title}
                onChangeText={v => setJobForm(f => ({ ...f, title: v }))}
                placeholder={isRTL ? 'مثال: مستشار قانوني' : 'e.g. Legal Counsel'}
                placeholderTextColor={C.muted}
                style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, color: C.text, fontSize: 14, marginBottom: 14 }}
              />

              {/* Company */}
              <Text style={{ color: C.muted, fontSize: 12, marginBottom: 5 }}>{isRTL ? 'اسم الشركة / الجهة *' : 'Company / Firm *'}</Text>
              <TextInput
                value={jobForm.company}
                onChangeText={v => setJobForm(f => ({ ...f, company: v }))}
                placeholder={isRTL ? 'اسم المكتب أو الشركة' : 'Your firm or company name'}
                placeholderTextColor={C.muted}
                style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, color: C.text, fontSize: 14, marginBottom: 14 }}
              />

              {/* Location */}
              <Text style={{ color: C.muted, fontSize: 12, marginBottom: 5 }}>{isRTL ? 'الموقع' : 'Location'}</Text>
              <TextInput
                value={jobForm.location}
                onChangeText={v => setJobForm(f => ({ ...f, location: v }))}
                placeholder={isRTL ? 'مثال: القاهرة، وسط البلد' : 'e.g. Cairo, Downtown'}
                placeholderTextColor={C.muted}
                style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, color: C.text, fontSize: 14, marginBottom: 14 }}
              />

              {/* Type chips */}
              <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>{isRTL ? 'نوع العقد' : 'Contract Type'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {['Full-time', 'Part-time', 'Freelance', 'Internship'].map(t => (
                  <TouchableOpacity key={t} onPress={() => setJobForm(f => ({ ...f, type: t }))} style={{
                    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                    borderWidth: 1.5, borderColor: jobForm.type === t ? C.gold : C.border,
                    backgroundColor: jobForm.type === t ? C.gold + '15' : 'transparent',
                  }}>
                    <Text style={{ color: jobForm.type === t ? C.gold : C.text, fontWeight: jobForm.type === t ? '700' : '400', fontSize: 13 }}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Salary */}
              <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>{isRTL ? 'نطاق الراتب (جنيه/شهر)' : 'Salary Range (EGP/month)'}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <TextInput
                  value={jobForm.salary_min}
                  onChangeText={v => setJobForm(f => ({ ...f, salary_min: v }))}
                  placeholder={isRTL ? 'من' : 'Min'}
                  keyboardType="numeric" placeholderTextColor={C.muted}
                  style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, color: C.text, fontSize: 14 }}
                />
                <TextInput
                  value={jobForm.salary_max}
                  onChangeText={v => setJobForm(f => ({ ...f, salary_max: v }))}
                  placeholder={isRTL ? 'إلى' : 'Max'}
                  keyboardType="numeric" placeholderTextColor={C.muted}
                  style={{ flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, color: C.text, fontSize: 14 }}
                />
              </View>

              {/* Description */}
              <Text style={{ color: C.muted, fontSize: 12, marginBottom: 5 }}>{isRTL ? 'وصف الوظيفة' : 'Job Description'}</Text>
              <TextInput
                value={jobForm.description}
                onChangeText={v => setJobForm(f => ({ ...f, description: v }))}
                multiline numberOfLines={5}
                placeholder={isRTL ? 'اكتب وصفاً تفصيلياً للوظيفة...' : 'Describe the role, responsibilities, and team...'}
                placeholderTextColor={C.muted}
                style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, color: C.text, fontSize: 14, textAlignVertical: 'top', minHeight: 100, marginBottom: 14 }}
              />

              {/* Urgent toggle */}
              <TouchableOpacity onPress={() => setJobForm(f => ({ ...f, urgent: !f.urgent }))} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                backgroundColor: jobForm.urgent ? '#EF444415' : C.card,
                borderWidth: 1, borderColor: jobForm.urgent ? '#EF4444' : C.border,
                borderRadius: 12, marginBottom: 20,
              }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: jobForm.urgent ? '#EF4444' : C.border, backgroundColor: jobForm.urgent ? '#EF4444' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {jobForm.urgent && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                </View>
                <View>
                  <Text style={{ color: jobForm.urgent ? '#EF4444' : C.text, fontWeight: '700', fontSize: 14 }}>🔴 {isRTL ? 'توظيف عاجل' : 'Urgent Hiring'}</Text>
                  <Text style={{ color: C.muted, fontSize: 11 }}>{isRTL ? 'تظهر بشارة حمراء في الأعلى' : 'Shown with a red urgent badge'}</Text>
                </View>
              </TouchableOpacity>

              {/* Forum auto-post toggle */}
              <TouchableOpacity onPress={() => setJobForm(f => ({ ...f, post_to_forum: !f.post_to_forum }))} style={{
                flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
                backgroundColor: jobForm.post_to_forum ? C.gold + '15' : C.card,
                borderWidth: 1, borderColor: jobForm.post_to_forum ? C.gold : C.border,
                borderRadius: 12, marginBottom: 20,
              }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: jobForm.post_to_forum ? C.gold : C.border, backgroundColor: jobForm.post_to_forum ? C.gold : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {jobForm.post_to_forum && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                </View>
                <View>
                  <Text style={{ color: jobForm.post_to_forum ? C.gold : C.text, fontWeight: '700', fontSize: 14 }}>📢 {isRTL ? 'نشر في المنتدى' : 'Share to Community Forum'}</Text>
                  <Text style={{ color: C.muted, fontSize: 11 }}>{isRTL ? 'إعلان الوظيفة لجميع المحامين في المنتدى' : 'Announce this job to all lawyers in the forum'}</Text>
                </View>
              </TouchableOpacity>

              {/* Submit */}
              <TouchableOpacity disabled={postingJob} onPress={submitJob} style={{ backgroundColor: C.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}>
                {postingJob
                  ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>...</Text>
                  : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>🚀 {isRTL ? 'نشر الوظيفة' : 'Publish Job'}</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
