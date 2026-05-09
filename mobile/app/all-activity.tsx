import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/hooks/useAuth';
import { useI18n } from '../src/i18n';
import { forumAPI } from '../src/services/api';
import { PostCard } from '../src/components/forum/PostCard';

export default function AllActivityScreen() {
  const C = useTheme();
  const { isRTL } = useI18n();
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Posts');

  useEffect(() => {
    if (user?.id) {
      forumAPI.getUserPosts(user.id).then((res: any) => {
        const cleaned = (res?.questions || []).map((p: any) => ({
          ...p,
          question: p.question ? p.question.replace(/\[إعادة نشر من.*?\]:\s*/g, '').trim() : ''
        }));
        setPosts(cleaned);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const tabs = ['Posts', 'Comments', 'Reactions'];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ 
        title: isRTL ? 'كل النشاط' : 'All activity',
        headerStyle: { backgroundColor: C.surface },
        headerTintColor: C.text,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: isRTL ? 0 : -8, marginRight: isRTL ? -8 : 0 }}>
            <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color={C.text} />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView>
        {/* Followers header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 4 }}>{isRTL ? 'خاص بك' : 'Private to you'}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{isRTL ? 'المتابعون' : 'Followers'} ({(user as any)?.followers_count || 0})</Text>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color={C.muted} />
          </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 }}>
          {tabs.map(tab => (
            <TouchableOpacity 
              key={tab} 
              onPress={() => setActiveTab(tab)}
              style={{ 
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                borderColor: activeTab === tab ? C.gold : C.border,
                backgroundColor: activeTab === tab ? C.gold : 'transparent'
              }}>
              <Text style={{ 
                color: activeTab === tab ? '#000' : C.text, 
                fontWeight: '700', fontSize: 14 
              }}>
                {isRTL ? (tab === 'Posts' ? 'منشورات' : tab === 'Comments' ? 'تعليقات' : 'تفاعلات') : tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {loading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={C.gold} size="large" />
          </View>
        ) : (
          <View style={{ marginTop: 8 }}>
            {posts.map(p => (
              <View key={p.id} style={{ marginBottom: 8, backgroundColor: C.surface }}>
                {/* LinkedIn style activity header above the post card */}
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.border, overflow: 'hidden' }}>
                    {user?.avatar_url || user?.avatar ? (
                      <View style={{ flex: 1, backgroundColor: '#ccc' }} />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.gold + '25' }}>
                        <Text style={{ color: C.gold, fontSize: 12, fontWeight: '800' }}>{(user?.name || 'U').charAt(0)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: C.text, fontSize: 14, flex: 1, textAlign: 'right' }}>
                    <Text style={{ fontWeight: '700' }}>{user?.name}</Text>
                    <Text style={{ color: C.muted }}> {p.question === 'مشاركة' || p.original_post_id ? (isRTL ? 'أعاد نشر هذا' : 'reposted this') : (isRTL ? 'نشر سؤالاً' : 'posted this')}</Text>
                  </Text>
                  <Ionicons name="ellipsis-vertical" size={20} color={C.muted} />
                </View>
                
                <PostCard 
                  p={p} 
                  C={C} 
                  user={user} 
                  isRTL={isRTL}
                  catStyle={(cat: string) => ({ bg: C.gold + '18', text: C.gold })}
                  onComment={() => router.push({ pathname: '/post/[id]', params: { id: p.id } } as any)}
                  onLike={() => {}}
                  onDislike={() => {}}
                  onSave={() => {}}
                  onShare={() => {}}
                  onMediaTap={() => {}}
                  onMenuTap={() => {}}
                  onReactorsTap={() => {}}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
