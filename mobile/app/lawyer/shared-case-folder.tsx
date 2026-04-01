// ─── Wakeel — Shared Case Folder ─────────────────────────────────────────────
// Route: /lawyer/shared-case-folder?caseId=X
// Shared encrypted document folder visible to lawyer + client only
// Matches SharedCaseFolderPage from wakeel-v2-preview-10.html
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { Gradient, GRADIENTS } from '../../src/components/Gradient';

interface CaseFile {
  id:         number;
  name:       string;
  type:       'pdf' | 'img' | 'doc' | 'other';
  uploadedBy: 'lawyer' | 'client';
  date:       string;
  size:       string;
}

const DEMO_FILES: CaseFile[] = [
  { id:1, name:'عقد الإيجار الأصلي.pdf',            type:'pdf', uploadedBy:'client', date:'2025-03-01', size:'2.4 MB' },
  { id:2, name:'إشعار الإخلاء.jpg',                 type:'img', uploadedBy:'client', date:'2025-03-02', size:'890 KB' },
  { id:3, name:'ملاحظات المحامي - جلسة 1.docx',    type:'doc', uploadedBy:'lawyer', date:'2025-03-05', size:'45 KB'  },
  { id:4, name:'حكم المحكمة الابتدائية.pdf',        type:'pdf', uploadedBy:'lawyer', date:'2025-03-08', size:'1.1 MB' },
];

const TYPE_ICON: Record<string, string> = { pdf: '📄', img: '🖼️', doc: '📝', other: '📎' };
const TYPE_COLOR: Record<string, string> = { pdf: '#EF4444', img: '#8B5CF6', doc: '#2563EB', other: '#6B7280' };

export default function SharedCaseFolderScreen() {
  const C      = useTheme();
  const insets = useSafeAreaInsets();
  const serif  = { fontFamily: 'CormorantGaramond-Bold' };

  const [files,     setFiles]     = useState<CaseFile[]>(DEMO_FILES);
  const [uploading, setUploading] = useState(false);
  const [filter,    setFilter]    = useState<'all' | 'lawyer' | 'client'>('all');

  const displayed = filter === 'all' ? files : files.filter(f => f.uploadedBy === filter);
  const totalSize = '4.4 MB';

  const simulateUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setFiles(prev => [{
        id:         Date.now(),
        name:       'مستند جديد.pdf',
        type:       'pdf',
        uploadedBy: 'lawyer',
        date:       new Date().toISOString().slice(0, 10),
        size:       '1.2 MB',
      }, ...prev]);
      setUploading(false);
    }, 1500);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={{
        backgroundColor: C.surface, paddingTop: insets.top + 10,
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.muted, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ ...serif, color: C.text, fontWeight: '700', fontSize: 18 }}>📁 مجلد القضية المشترك</Text>
          <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>مرئي للعميل والمحامي فقط · مشفر 🔐</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Upload drop zone — matches reference dashed border */}
        <TouchableOpacity onPress={simulateUpload}
          style={{
            borderWidth: 2, borderColor: C.gold, borderStyle: 'dashed',
            borderRadius: 14, padding: 24, alignItems: 'center', marginBottom: 16,
            backgroundColor: `${C.gold}08`,
          }}>
          {uploading ? (
            <View style={{ alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={C.gold} size="small" />
              <Text style={{ color: C.gold, fontSize: 13, fontWeight: '600' }}>⏳ جاري الرفع...</Text>
            </View>
          ) : (
            <>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>☁️</Text>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>ارفع مستنداً</Text>
              <Text style={{ color: C.muted, fontSize: 12 }}>PDF، صور، مستندات Word</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Filter + count row */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {(['all', 'lawyer', 'client'] as const).map(f => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 10,
                backgroundColor: filter === f ? C.gold : 'transparent',
                borderWidth: 1, borderColor: filter === f ? 'transparent' : C.border,
                alignItems: 'center',
              }}>
              <Text style={{ color: filter === f ? '#000' : C.muted, fontSize: 12, fontWeight: filter === f ? '700' : '400' }}>
                {f === 'all' ? 'الكل' : f === 'lawyer' ? 'المحامي' : 'العميل'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: C.muted, fontSize: 12 }}>{displayed.length} ملف</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>الكل مشفر 🔐 · {totalSize}</Text>
        </View>

        {/* File list */}
        {displayed.map(f => (
          <View key={f.id} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* File type icon with colored bg */}
            <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: `${TYPE_COLOR[f.type]}15`, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Text style={{ fontSize: 24 }}>{TYPE_ICON[f.type] || '📎'}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: C.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{f.name}</Text>
              <Text style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>
                {f.uploadedBy === 'lawyer' ? '⚖️ المحامي' : '👤 أنت'} · {f.date} · {f.size}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => Alert.alert('عرض', f.name)}
                style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: C.text, fontSize: 11 }}>عرض</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => Alert.alert('تنزيل', `جاري تنزيل ${f.name}`)}
                style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: C.text, fontSize: 11 }}>⬇️</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Security footer */}
        <View style={{ backgroundColor: `${C.gold}08`, borderWidth: 1, borderColor: `${C.gold}30`, borderRadius: 12, padding: 14, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 24 }}>🔐</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 3 }}>تشفير نهاية لنهاية</Text>
            <Text style={{ color: C.muted, fontSize: 12, lineHeight: 19 }}>مستنداتك مشفرة ولا يمكن الوصول إليها إلا للأطراف المعنية بالقضية.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
