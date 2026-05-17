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
import { videoAPI, messagesAPI, bookingsAPI } from '../src/services/api';
import { getSocket } from '../src/utils/socket';
import { useI18n } from '../src/i18n';

const pad = (n: number) => String(n).padStart(2,'0');
const fmt = (s: number) => `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`;

// ─── Jitsi Embedded HTML ───────────────────────────────────────────────────────
// Uses the official Jitsi IFrame API, loaded entirely inside the WebView.
// This prevents any "open in app" redirects and gives a fully embedded experience.
function buildJitsiHtml(roomName: string, displayName: string, avatarUrl?: string) {
  const safeName = roomName.replace(/[^a-zA-Z0-9-]/g, '-');
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no"/>
  <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#0a0a0a; overflow:hidden; }
    #jitsi-container { width:100%; height:100%; }
    #loading {
      position:fixed; inset:0; display:flex; flex-direction:column;
      align-items:center; justify-content:center; background:#0a0a0a; z-index:999;
    }
    #loading .spinner {
      width:48px; height:48px; border:4px solid #333;
      border-top-color:#C8A84B; border-radius:50%;
      animation: spin 0.9s linear infinite; margin-bottom:16px;
    }
    #loading p { color:#aaa; font-family:sans-serif; font-size:14px; }
    @keyframes spin { to { transform:rotate(360deg); } }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    <p>جاري الاتصال... Connecting...</p>
  </div>
  <div id="jitsi-container"></div>

  <script src="https://8x8.vc/vpaas-magic-cookie-free/external_api.js"></script>
  <script>
    // Try 8x8 (Jitsi as a Service - free tier) first, fall back to meet.jit.si
    function initJitsi(domain, roomPrefix) {
      const options = {
        roomName: roomPrefix + '${safeName}',
        parentNode: document.getElementById('jitsi-container'),
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableClosePage: false,
          disableDeepLinking: true,
          prejoinPageEnabled: false,
          disableInviteFunctions: true,
          toolbarButtons: [
            'microphone', 'camera', 'hangup',
            'chat', 'tileview', 'toggle-camera',
            'fullscreen',
          ],
          resolution: 720,
          constraints: {
            video: { height: { ideal: 720, max: 720, min: 180 } }
          },
          // Prevent "open in app" dialogs
          noBrowserShortcuts: true,
          disableThirdPartyRequests: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          BRAND_WATERMARK_LINK: '',
          DEFAULT_BACKGROUND: '#0a0a0a',
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
          MOBILE_APP_PROMO: false,           // ← hides "Download the app" banner
          APP_NAME: 'وكيل — Wakeel',
          NATIVE_APP_NAME: '',
          HIDE_INVITE_MORE_HEADER: true,
          TOOLBAR_ALWAYS_VISIBLE: false,
          GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
        },
        userInfo: {
          displayName: '${displayName.replace(/'/g, "\\'")}',
          ${avatarUrl ? `avatarUrl: '${avatarUrl}',` : ''}
        },
        lang: 'ar',
      };

      try {
        const api = new JitsiMeetExternalAPI(domain, options);

        api.addEventListener('videoConferenceJoined', () => {
          document.getElementById('loading').style.display = 'none';
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'joined' }));
        });

        api.addEventListener('readyToClose', () => {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'hangup' }));
        });

        api.addEventListener('participantJoined', (p) => {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'participantJoined', id: p.id }));
        });

        api.addEventListener('participantLeft', (p) => {
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'participantLeft', id: p.id }));
        });

        return api;
      } catch(e) {
        return null;
      }
    }

    // Load script and init
    window.onload = function() {
      // Try meet.jit.si (most reliable free option)
      if (typeof JitsiMeetExternalAPI === 'undefined') {
        // Load from CDN
        var s = document.createElement('script');
        s.src = 'https://meet.jit.si/external_api.js';
        s.onload = function() {
          initJitsi('meet.jit.si', 'wakeel-legal-');
        };
        s.onerror = function() {
          document.getElementById('loading').innerHTML = '<p style="color:#ef4444;font-family:sans-serif;padding:20px;text-align:center">⚠️ تعذر الاتصال بخادم الفيديو. تأكد من اتصالك بالإنترنت وأعد المحاولة.</p>';
        };
        document.head.appendChild(s);
      } else {
        initJitsi('8x8.vc', 'vpaas-magic-cookie-free/');
      }
    };
  </script>
</body>
</html>`;
}

export default function VideoScreen() {
  const C          = useTheme();
  const { user }   = useAuth();
  const { isRTL }  = useI18n();
  const { booking: bookingId } = useLocalSearchParams<{ booking?: string }>();

  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [duration,  setDuration]  = useState(0);
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  const [showChat,  setShowChat]  = useState(false);
  const [convId,    setConvId]    = useState<number|null>(null);
  const [messages,  setMessages]  = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [callJoined, setCallJoined] = useState(false);
  const callStart   = useRef(Date.now());
  const listRef     = useRef<FlatList>(null);
  const webviewRef  = useRef<WebView>(null);

  // Room name derived from booking ID — no API call needed for Jitsi
  const roomName = bookingId ? `consultation-${bookingId}` : 'wakeel-general';
  const displayName = user?.name || (isRTL ? 'مستخدم وكيل' : 'Wakeel User');
  const jitsiHtml = buildJitsiHtml(roomName, displayName, user?.avatar_url);

  // Request native permissions
  useEffect(() => {
    (async () => {
      const cam = await Camera.requestCameraPermissionsAsync();
      const mic = await Audio.requestPermissionsAsync();
      setHasPermissions(cam.status === 'granted' && mic.status === 'granted');
      setLoading(false);
    })();
  }, []);

  // Load conversation for in-call chat
  useEffect(() => {
    if (!bookingId) return;
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

  // Handle messages from the embedded Jitsi WebView
  const onWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'joined') {
        setCallJoined(true);
      } else if (msg.type === 'hangup') {
        // User pressed hang up inside Jitsi UI
        endCall(true);
      }
    } catch {}
  }, [duration, bookingId]);

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

  const endCall = useCallback((fromJitsi = false) => {
    const doEnd = async () => {
      if (bookingId) await videoAPI.endRoom(parseInt(bookingId, 10), Math.floor(duration/60)).catch(() => {});
      router.replace('/bookings' as any);
    };

    if (fromJitsi) {
      doEnd();
      return;
    }

    Alert.alert(isRTL ? 'إنهاء المكالمة' : 'End Call', isRTL ? 'هل تريد إنهاء الجلسة؟' : 'End this session?', [
      { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
      { text: isRTL ? 'إنهاء' : 'End', style: 'destructive', onPress: doEnd },
    ]);
  }, [duration, bookingId, isRTL]);

  const markNoShow = () => {
    Alert.alert(
      isRTL ? 'تغيب العميل' : 'Client No-Show',
      isRTL ? 'العميل لم يحضر. تأكيد؟' : 'The client has not joined. Mark as no-show?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        { text: isRTL ? 'تأكيد' : 'Confirm', style: 'destructive', onPress: async () => {
          if (bookingId) {
            try {
              await bookingsAPI.markNoShow(parseInt(bookingId, 10));
              await videoAPI.endRoom(parseInt(bookingId, 10), Math.floor(duration/60)).catch(() => {});
              Alert.alert('✅', isRTL ? 'تم تسجيل تغيب العميل.' : 'Client marked as no-show.');
              router.replace('/bookings' as any);
            } catch (e: any) {
              Alert.alert('خطأ', e?.message || 'تعذر تسجيل التغيب');
            }
          }
        }},
      ]
    );
  };

  // ── Loading ──
  if (loading || hasPermissions === null) return (
    <View style={{ flex:1, backgroundColor:'#0a0a0a', justifyContent:'center', alignItems:'center', gap:16 }}>
      <Spinner C={{ gold:'#C8A84B' } as any} />
      <Text style={{ color:'#aaa', fontSize:14 }}>
        {isRTL ? 'جاري طلب صلاحيات الكاميرا والميكروفون...' : 'Requesting camera & microphone permissions...'}
      </Text>
    </View>
  );

  // ── No permissions ──
  if (hasPermissions === false) return (
    <View style={{ flex:1, backgroundColor:'#0a0a0a', justifyContent:'center', alignItems:'center', padding:24, gap:14 }}>
      <Text style={{ fontSize:48 }}>🔒</Text>
      <Text style={{ color:'#fff', fontWeight:'700', fontSize:16 }}>
        {isRTL ? 'صلاحيات مفقودة' : 'Permissions Required'}
      </Text>
      <Text style={{ color:'#999', textAlign:'center', fontSize:13 }}>
        {isRTL
          ? 'يرجى السماح للتطبيق باستخدام الكاميرا والميكروفون.'
          : 'Please allow camera and microphone access in your device settings.'}
      </Text>
      <TouchableOpacity onPress={() => router.back()}
        style={{ backgroundColor:'#C8A84B', borderRadius:10, paddingHorizontal:20, paddingVertical:10 }}>
        <Text style={{ color:'#fff', fontWeight:'700' }}>← {isRTL ? 'عودة' : 'Go Back'}</Text>
      </TouchableOpacity>
    </View>
  );

  if (error) return (
    <View style={{ flex:1, backgroundColor:'#0a0a0a', justifyContent:'center', alignItems:'center', padding:24, gap:14 }}>
      <Text style={{ fontSize:48 }}>⚠️</Text>
      <Text style={{ color:'#fff', fontWeight:'700', fontSize:16 }}>{isRTL ? 'تعذر الاتصال' : 'Connection Failed'}</Text>
      <Text style={{ color:'#999', textAlign:'center', fontSize:13 }}>{error}</Text>
      <TouchableOpacity onPress={() => router.back()}
        style={{ backgroundColor:'#C8A84B', borderRadius:10, paddingHorizontal:20, paddingVertical:10 }}>
        <Text style={{ color:'#fff', fontWeight:'700' }}>← {isRTL ? 'عودة' : 'Go Back'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex:1, backgroundColor:'#0a0a0a' }}>
      <Stack.Screen options={{ headerShown:false }} />

      {/* Top bar */}
      <View style={{ backgroundColor:'#111', paddingHorizontal:16, paddingVertical:10, flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderBottomWidth:1, borderBottomColor:'#222' }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
          <Text style={{ color:'#fff', fontFamily:'Cairo-Bold', fontSize:15, fontWeight:'700' }}>⚖️ {isRTL ? 'استشارة قانونية' : 'Legal Consultation'}</Text>
          {callJoined && (
            <View style={{ backgroundColor:'#22C55E22', borderRadius:6, paddingHorizontal:6, paddingVertical:2 }}>
              <Text style={{ color:'#22C55E', fontSize:10, fontWeight:'700' }}>● {isRTL ? 'متصل' : 'LIVE'}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
          <Text style={{ color:'#22C55E', fontSize:12, fontWeight:'700' }}>⏱ {fmt(duration)}</Text>
          <TouchableOpacity onPress={() => setShowChat(!showChat)}
            style={{ backgroundColor:showChat?'#C8A84B':'#333', borderRadius:8, paddingHorizontal:12, paddingVertical:5 }}>
            <Text style={{ color:'#fff', fontSize:12, fontWeight:'700' }}>
              {showChat ? '✕' : '💬'} {isRTL ? 'محادثة' : 'Chat'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      <View style={{ flex:1, flexDirection:'row' }}>

        {/* ── Embedded Jitsi Meet ── */}
        <View style={{ flex:1 }}>
          <WebView
            ref={webviewRef}
            originWhitelist={['*']}
            source={{ html: jitsiHtml, baseUrl: 'https://meet.jit.si' }}
            style={{ flex:1, backgroundColor:'#0a0a0a' }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            mediaCapturePermissionGrantType="grant"
            allowsFullscreenVideo
            // Allow camera/mic inside the WebView
            geolocationEnabled={false}
            onMessage={onWebViewMessage}
            onError={() => setError(isRTL ? 'تعذر تحميل غرفة الفيديو' : 'Failed to load video room')}
            renderLoading={() => (
              <View style={{ position:'absolute', inset:0, backgroundColor:'#0a0a0a', justifyContent:'center', alignItems:'center' } as any}>
                <Spinner C={{ gold:'#C8A84B' } as any} />
                <Text style={{ color:'#aaa', marginTop:12, fontSize:13 }}>
                  {isRTL ? 'جاري تهيئة غرفة الفيديو...' : 'Setting up video room...'}
                </Text>
              </View>
            )}
          />
        </View>

        {/* In-call chat panel */}
        {showChat && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width:260, backgroundColor:'#111', borderLeftWidth:1, borderLeftColor:'#222' }}
          >
            <View style={{ padding:12, borderBottomWidth:1, borderBottomColor:'#222' }}>
              <Text style={{ color:'#fff', fontWeight:'700', fontSize:13 }}>💬 {isRTL ? 'المحادثة' : 'Chat'}</Text>
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
                  {isRTL ? 'ابدأ المحادثة' : 'Start chatting'}
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
                placeholder={isRTL ? 'رسالة...' : 'Message...'}
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
      <View style={{ backgroundColor:'#111', paddingVertical:14, paddingHorizontal:20, flexDirection:'row', justifyContent:'center', borderTopWidth:1, borderTopColor:'#222', gap:24 }}>
        <View style={{ alignItems:'center', gap:6 }}>
          <TouchableOpacity onPress={() => endCall(false)}
            style={{ width:56, height:56, borderRadius:28, backgroundColor:'#EF4444', alignItems:'center', justifyContent:'center' }}>
            <Text style={{ fontSize:24 }}>📵</Text>
          </TouchableOpacity>
          <Text style={{ color:'#555', fontSize:11 }}>{isRTL ? 'إنهاء' : 'End Call'}</Text>
        </View>

        {user?.role === 'lawyer' && duration > 300 && (
          <View style={{ alignItems:'center', gap:6 }}>
            <TouchableOpacity onPress={markNoShow}
              style={{ width:56, height:56, borderRadius:28, backgroundColor:'#C8A84B', alignItems:'center', justifyContent:'center' }}>
              <Text style={{ fontSize:24 }}>🚫</Text>
            </TouchableOpacity>
            <Text style={{ color:'#C8A84B', fontSize:11, fontWeight:'800' }}>{isRTL ? 'تغيب' : 'No Show'}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
