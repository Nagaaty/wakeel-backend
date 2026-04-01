import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Alert, TextInput,
  FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { useTheme } from '../src/hooks/useTheme';
import { useAuth } from '../src/hooks/useAuth';
import { Spinner } from '../src/components/ui';
import { videoAPI, messagesAPI } from '../src/services/api';
import { getSocket } from '../src/utils/socket';
import { useI18n } from '../src/i18n';

const pad = (n: number) => String(n).padStart(2,'0');
const fmt = (s: number) => `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`;

export default function VideoScreen() {
  const C          = useTheme();
  const { user }   = useAuth();
  const { isRTL }  = useI18n();
  const { booking: bookingId } = useLocalSearchParams<{ booking?: string }>();

  const [roomUrl,   setRoomUrl]   = useState<string|null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [duration,  setDuration]  = useState(0);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [showChat,  setShowChat]  = useState(false);
  const [convId,    setConvId]    = useState<number|null>(null);
  const [messages,  setMessages]  = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const callStart   = useRef(Date.now());
  const listRef     = useRef<FlatList>(null);

  // Load room
  useEffect(() => {
    if (!bookingId) { setError('لا يوجد رقم حجز'); setLoading(false); return; }
    videoAPI.createRoom(bookingId)
      .then((d: any) => setRoomUrl(d.roomUrl))
      .catch((e: any) => setError(e?.message || 'تعذر إنشاء غرفة الفيديو'))
      .finally(() => setLoading(false));

    // Load conversation for in-call chat
    messagesAPI.getConversations()
      .then((d: any) => {
        const convs = d.conversations || [];
        if (convs.length > 0) {
          setConvId(convs[0].id);
          messagesAPI.getMessages(convs[0].id)
            .then((md: any) => setMessages(md.messages || []))
            .catch(() => {});
        }
      }).catch(() => {});

    // Duration timer
    const t = setInterval(() => setDuration(Math.floor((Date.now()-callStart.current)/1000)), 1000);
    return () => clearInterval(t);
  }, [bookingId]);

  // Request native permissions before injecting WebView WebRTC
  useEffect(() => {
    (async () => {
      const cam = await Camera.requestCameraPermissionsAsync();
      const mic = await Audio.requestPermissionsAsync();
      setHasPermissions(cam.status === 'granted' && mic.status === 'granted');
    })();
  }, []);

  // Socket for live chat
  useEffect(() => {
    if (!convId) return;
    let mounted = true;
    getSocket().then(s => {
      if (!mounted) return;
      s.emit('conversation:join', convId);
      s.on('message:new', (msg: any) => {
        setMessages(p => p.find(m => m.id === msg.id) ? p : [...p, msg]);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      });
    }).catch(() => {});
    return () => {
      mounted = false;
      getSocket().then(s => s.off('message:new')).catch(() => {});
    };
  }, [convId]);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || !convId) return;
    const content = chatInput.trim();
    setChatInput('');
    setMessages(p => [...p, { id: Date.now(), content, sender_id: user?.id, created_at: new Date().toISOString() }]);
    try {
      const s = await getSocket();
      s.emit('message:send', { conversationId: convId, content });
    } catch {}
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatInput, convId, user]);

  const endCall = () => {
    Alert.alert(isRTL ? 'إنهاء المكالمة' : 'End Call', 'هل تريد إنهاء الجلسة؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: isRTL ? 'إنهاء' : 'End', style: 'destructive', onPress: async () => {
        if (bookingId) await videoAPI.endRoom(parseInt(bookingId, 10), Math.floor(duration/60)).catch(() => {});
        router.replace('/bookings' as any);
      }},
    ]);
  };

  if (loading || hasPermissions === null) return (
    <View style={{ flex:1, backgroundColor:'#0a0a0a', justifyContent:'center', alignItems:'center', gap:16 }}>
      <Spinner C={{ gold:'#C8A84B' } as any} />
      <Text style={{ color:'#aaa', fontSize:14 }}>{hasPermissions === null ? 'جاري طلب صلاحيات الكاميرا والميكروفون...' : 'جاري إنشاء غرفة الفيديو...'}</Text>
    </View>
  );

  if (hasPermissions === false) return (
    <View style={{ flex:1, backgroundColor:'#0a0a0a', justifyContent:'center', alignItems:'center', padding:24, gap:14 }}>
      <Text style={{ fontSize:48 }}>🔒</Text>
      <Text style={{ color:'#fff', fontWeight:'700', fontSize:16 }}>صلاحيات مفقودة</Text>
      <Text style={{ color:'#999', textAlign:'center', fontSize:13 }}>يرجى السماح للتطبيق باستخدام الكاميرا والميكروفون للتمكن من إجراء المكالمة.</Text>
      <TouchableOpacity onPress={() => router.back()}
        style={{ backgroundColor:'#C8A84B', borderRadius:10, paddingHorizontal:20, paddingVertical:10 }}>
        <Text style={{ color:'#fff', fontWeight:'700' }}>← عودة</Text>
      </TouchableOpacity>
    </View>
  );

  if (error) return (
    <View style={{ flex:1, backgroundColor:'#0a0a0a', justifyContent:'center', alignItems:'center', padding:24, gap:14 }}>
      <Text style={{ fontSize:48 }}>⚠️</Text>
      <Text style={{ color:'#fff', fontWeight:'700', fontSize:16 }}>تعذر إنشاء الغرفة</Text>
      <Text style={{ color:'#999', textAlign:'center', fontSize:13 }}>{error}</Text>
      <TouchableOpacity onPress={() => router.back()}
        style={{ backgroundColor:'#C8A84B', borderRadius:10, paddingHorizontal:20, paddingVertical:10 }}>
        <Text style={{ color:'#fff', fontWeight:'700' }}>← عودة</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:'#0a0a0a' }}>
      <Stack.Screen options={{ headerShown:false }} />

      {/* Top bar */}
      <View style={{ backgroundColor:'#111', padding:'10px 16px' as any, paddingHorizontal:16, paddingVertical:10, flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:1, borderBottomColor:'#222' }}>
        <Text style={{ color:'#fff', fontFamily:'CormorantGaramond-Bold', fontSize:15, fontWeight:'700' }}>⚖️ استشارة قانونية</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
          <Text style={{ color:'#22C55E', fontSize:12, fontWeight:'700' }}>● {fmt(duration)}</Text>
          <TouchableOpacity onPress={() => setShowChat(!showChat)}
            style={{ backgroundColor:showChat?'#C8A84B':'#333', borderRadius:8, paddingHorizontal:12, paddingVertical:5 }}>
            <Text style={{ color:'#fff', fontSize:12, fontWeight:'700' }}>
              {showChat ? '✕ أغلق' : '💬 محادثة'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      <View style={{ flex:1, flexDirection:'row' }}>
        {/* Video */}
        <View style={{ flex:1 }}>
          {roomUrl ? (
            <WebView
              source={{ uri: roomUrl }}
              style={{ flex:1 }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              mediaCapturePermissionGrantType="grant"
              onError={() => setError('حدث خطأ في الاتصال بالغرفة')}
            />
          ) : (
            <View style={{ flex:1, justifyContent:'center', alignItems:'center', gap:12 }}>
              <Text style={{ fontSize:60 }}>📹</Text>
              <Text style={{ color:'#fff', fontWeight:'700', fontSize:16 }}>الغرفة جاهزة</Text>
              <Text style={{ color:'#999', fontSize:13 }}>انتظر انضمام الطرف الآخر...</Text>
            </View>
          )}
        </View>

        {/* In-call chat panel */}
        {showChat && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width:260, backgroundColor:'#111', borderLeftWidth:1, borderLeftColor:'#222' }}
          >
            <View style={{ padding:12, borderBottomWidth:1, borderBottomColor:'#222' }}>
              <Text style={{ color:'#fff', fontWeight:'700', fontSize:13 }}>💬 المحادثة</Text>
            </View>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={item => String(item.id)}
              style={{ flex:1 }}
              contentContainerStyle={{ padding:10, gap:8 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd()}
              ListEmptyComponent={
                <Text style={{ color:'#666', fontSize:12, textAlign:'center', padding:20 }}>
                  ابدأ المحادثة
                </Text>
              }
              renderItem={({ item: m }) => {
                const isMine = m.sender_id === user?.id;
                return (
                  <View style={{ flexDirection:'row', justifyContent:isMine?'flex-end':'flex-start' }}>
                    <View style={{ maxWidth:'88%', backgroundColor:isMine?'#C8A84B':'#222', borderRadius:12, borderBottomRightRadius:isMine?3:12, borderBottomLeftRadius:isMine?12:3, padding:8 }}>
                      <Text style={{ color:isMine?'#000':'#fff', fontSize:12, lineHeight:18 }}>{m.content}</Text>
                    </View>
                  </View>
                );
              }}
            />
            <View style={{ flexDirection:'row', gap:6, padding:10, borderTopWidth:1, borderTopColor:'#222' }}>
              <TextInput
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={sendChat}
                placeholder="رسالة..."
                placeholderTextColor="#555"
                style={{ flex:1, backgroundColor:'#222', borderRadius:10, paddingHorizontal:10, paddingVertical:7, color:'#fff', fontSize:12 }}
              />
              <TouchableOpacity onPress={sendChat} disabled={!chatInput.trim()}
                style={{ width:32, height:32, borderRadius:16, backgroundColor:chatInput.trim()?'#C8A84B':'#333', alignItems:'center', justifyContent:'center' }}>
                <Text style={{ color:'#fff', fontSize:14 }}>→</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Controls */}
      <View style={{ backgroundColor:'#111', paddingVertical:14, paddingHorizontal:20, flexDirection:'row', justifyContent:'center', borderTopWidth:1, borderTopColor:'#222' }}>
        <View style={{ alignItems:'center', gap:6 }}>
          <TouchableOpacity onPress={endCall}
            style={{ width:52, height:52, borderRadius:26, backgroundColor:'#EF4444', alignItems:'center', justifyContent:'center' }}>
            <Text style={{ fontSize:22 }}>📵</Text>
          </TouchableOpacity>
          <Text style={{ color:'#555', fontSize:11 }}>{isRTL ? 'إنهاء المكالمة' : 'End Call'}</Text>
        </View>
      </View>
    </View>
  );
}
