// ─── Wakeel Messages Screen — Sprint 2: Full Real-time Socket.io ─────────────
import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, RefreshControl,
  Alert, Animated, Easing, Image, ActionSheetIOS, Modal, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchConvos, fetchThread, addMessage,
  selConvos, selThread, selMLoading,
} from '../../src/store/slices/messagesSlice';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuth } from '../../src/hooks/useAuth';
import { Spinner, Empty, ErrMsg } from '../../src/components/ui';
import { CachedAvatar } from '../../src/components/CachedImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getSocket, onSocketEvent, socketEmit, isSocketConnected,
} from '../../src/utils/socket';
import { messagesAPI } from '../../src/services/api';
import { useI18n } from '../../src/i18n';
import { ListSkeleton } from '../../src/components/Skeleton';
import { hapticLight, hapticMedium } from '../../src/utils/haptics';
import type { AppDispatch } from '../../src/store';
import type { Conversation, Message } from '../../src/types';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import api from '../../src/services/api';

const CONV_ROW_HEIGHT = 79; // avatar(50) + paddingV(28) + border(1)

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

// ── Connection status indicator ───────────────────────────────────────────────
function ConnectionBadge({ C }: { C: any }) {
  const [connected, setConnected] = useState(isSocketConnected());
  useEffect(() => {
    const check = setInterval(() => setConnected(isSocketConnected()), 2000);
    return () => clearInterval(check);
  }, []);
  if (connected) return null;
  return (
    <View style={{ backgroundColor: C.warn + '20', borderWidth: 1, borderColor: C.warn + '40',
                   borderRadius: 8, padding: 6, marginHorizontal: 16, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.warn }} />
      <Text style={{ color: C.warn, fontSize: 11, fontWeight: '600' }}>
        جاري إعادة الاتصال...
      </Text>
    </View>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MsgBubble({ msg, isMine, C }: { msg: Message; isMine: boolean; C: any }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(isMine ? 20 : -20)).current;
  const content = (msg as any).content || '';
  const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(content) || content.startsWith('__img__:');
  const imgUrl  = content.replace('__img__:', '');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: 0, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      flexDirection: 'row', justifyContent: isMine ? 'flex-end' : 'flex-start',
      opacity: fadeIn, transform: [{ translateX: slideX }],
    }}>
      <View style={{
        maxWidth: '78%',
        backgroundColor: isMine ? C.gold : C.card,
        borderRadius: 18,
        borderBottomRightRadius: isMine ? 4 : 18,
        borderBottomLeftRadius:  isMine ? 18 : 4,
        padding: isImage ? 4 : 12,
        borderWidth: isMine ? 0 : 1,
        borderColor: C.border,
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
      }}>
        {isImage ? (
          <Image source={{ uri: imgUrl }} style={{ width: 200, height: 160, borderRadius: 14 }} resizeMode="cover" />
        ) : (
          <Text style={{ color: isMine ? '#fff' : C.text, fontSize: 14, lineHeight: 20 }}>
            {content}
          </Text>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: isImage ? 8 : 0, paddingBottom: isImage ? 4 : 0 }}>
          <Text style={{ color: isMine ? '#ffffff80' : C.muted, fontSize: 10 }}>
            {fmt(msg.created_at)}
          </Text>
          {isMine && (
            <Text style={{ color: msg.read_at ? C.gold + 'CC' : '#ffffff60', fontSize: 11 }}>
              {msg.read_at ? '✓✓' : '✓'}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator({ C }: { C: any }) {
  const dots = [0, 1, 2].map(() => useRef(new Animated.Value(0)).current);
  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 200),
        Animated.timing(dot, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0,  duration: 300, useNativeDriver: true }),
        Animated.delay(400),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 }}>
      <View style={{ backgroundColor: C.card, borderRadius: 18, borderBottomLeftRadius: 4,
                     padding: 12, flexDirection: 'row', gap: 4, borderWidth: 1, borderColor: C.border }}>
        {dots.map((dot, i) => (
          <Animated.View key={i} style={{
            width: 7, height: 7, borderRadius: 4, backgroundColor: C.muted,
            transform: [{ translateY: dot }],
          }} />
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const C        = useTheme();
  const { t, isRTL } = useI18n();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useAuth();
  const params   = useLocalSearchParams<{ convId?: string }>();
  const convos   = useSelector(selConvos) as Conversation[];
  const thread   = useSelector(selThread) as Message[];
  const loading  = useSelector(selMLoading);
  const insets   = useSafeAreaInsets();

  const [active,      setActive]      = useState<Conversation | null>(null);
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const [joiningConv, setJoiningConv] = useState(false);

  const listRef   = useRef<FlatList>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef<Conversation | null>(null);
  activeRef.current = active;

  // ── Init socket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    getSocket()
      .then(() => setSocketReady(true))
      .catch(() => setSocketReady(false));
  }, []);

  // ── Load conversations ──────────────────────────────────────────────────────
  const loadConvos = useCallback(async () => {
    try { await dispatch(fetchConvos()).unwrap(); }
    catch (e: any) { setError(e?.message || 'تعذر تحميل المحادثات'); }
  }, [dispatch]);

  // ── Socket event listeners (survive reconnects) ───────────────────────────
  useEffect(() => {
    loadConvos();

    const offNew = onSocketEvent('message:new', (msg: Message & { conversation_id: number }) => {
      dispatch(addMessage(msg));
      // Auto-mark as read if this conversation is active
      if (activeRef.current?.id === msg.conversation_id) {
        socketEmit('messages:read', { conversationId: msg.conversation_id });
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    });

    const offTypingStart = onSocketEvent('typing:start', ({ userId }: any) => {
      if (userId !== user?.id) setOtherTyping(true);
    });

    const offTypingStop = onSocketEvent('typing:stop', ({ userId }: any) => {
      if (userId !== user?.id) setOtherTyping(false);
    });

    const offRead = onSocketEvent('messages:read', ({ conversationId }: any) => {
      // Could update read receipts in store — for now just forces re-render
    });

    return () => {
      offNew(); offTypingStart(); offTypingStop(); offRead();
    };
  }, [user?.id]);

  // ── Open conversation from deep link ────────────────────────────────────────
  useEffect(() => {
    if (params.convId && convos.length > 0) {
      const conv = convos.find(c => String(c.id) === String(params.convId));
      if (conv) openConversation(conv);
    }
  }, [params.convId, convos.length]);

  // ── Open a conversation ──────────────────────────────────────────────────────
  const openConversation = useCallback(async (conv: Conversation) => { hapticLight();
    setActive(conv);
    setError('');
    setJoiningConv(true);
    try {
      await dispatch(fetchThread(Number(conv.id))).unwrap();
      const s = await getSocket();
      s.emit('conversation:join', conv.id);
      s.emit('messages:read', { conversationId: conv.id });
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل الرسائل');
    } finally {
      setJoiningConv(false);
    }
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 250);
  }, [dispatch]);

  // ── Typing indicator emit ───────────────────────────────────────────────────
  const handleInputChange = useCallback(async (text: string) => {
    setInput(text);
    if (!activeRef.current) return;
    try {
      const s = await getSocket();
      s.emit('typing:start', { conversationId: activeRef.current.id });
      if (typingRef.current) clearTimeout(typingRef.current);
      typingRef.current = setTimeout(async () => {
        const s2 = await getSocket();
        s2.emit('typing:stop', { conversationId: activeRef.current!.id });
      }, 1500);
    } catch {}
  }, []);

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => { hapticMedium();
    if (!input.trim() || !activeRef.current || sending) return;
    const content = input.trim();
    const conv    = activeRef.current;
    setInput('');
    setSending(true);

    // Stop typing indicator
    if (typingRef.current) clearTimeout(typingRef.current);
    try {
      const s = await getSocket();
      s.emit('typing:stop', { conversationId: conv.id });
    } catch {}

    // Optimistic message
    const optimistic: any = {
      id:              `opt_${Date.now()}`,
      conversation_id: conv.id,
      sender_id:       user?.id,
      content,
      created_at:      new Date().toISOString(),
      read_at:         null,
    };
    dispatch(addMessage(optimistic));
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    try {
      // Send via socket (server saves to DB + broadcasts)
      const s = await getSocket();
      s.emit('message:send', { conversationId: conv.id, content });
    } catch {
      // Fallback: REST API
      try {
        await messagesAPI.sendMessage(Number(conv.id), content);
      } catch {
        Alert.alert('خطأ', 'تعذر إرسال الرسالة. تحقق من الاتصال.');
      }
    } finally {
      setSending(false);
    }
  }, [input, sending, user, dispatch]);

  // ── Upload attachment ─────────────────────────────────────────────────────
  const sendAttachment = useCallback(async (uri: string, mimeType: string, name: string) => {
    if (!activeRef.current) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri, type: mimeType, name } as any);
      formData.append('folder', 'chat');
      const res: any = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = res?.url || res?.file?.url;
      if (!url) throw new Error('No URL returned');
      const content = mimeType.startsWith('image/') ? `__img__:${url}` : `📎 ${name}\n${url}`;
      const conv = activeRef.current;
      const s = await getSocket();
      s.emit('message:send', { conversationId: conv.id, content });
    } catch (e: any) {
      Alert.alert('خطأ في الرفع', e?.message || 'تعذر رفع الملف');
    } finally {
      setUploading(false);
    }
  }, []);

  const pickAttachment = useCallback(() => {
    Alert.alert(
      isRTL ? 'إرفاق ملف' : 'Attach File',
      '',
      [
        {
          text: isRTL ? '📷 صورة من المعرض' : '📷 Photo from Gallery',
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { Alert.alert('مطلوب إذن الوصول للصور'); return; }
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
            if (!result.canceled && result.assets[0]) {
              const { uri, mimeType, fileName } = result.assets[0];
              await sendAttachment(uri, mimeType || 'image/jpeg', fileName || 'photo.jpg');
            }
          },
        },
        {
          text: isRTL ? '📎 مستند' : '📎 Document',
          onPress: async () => {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
            if (!result.canceled && result.assets?.[0]) {
              const { uri, mimeType, name } = result.assets[0];
              await sendAttachment(uri, mimeType || 'application/octet-stream', name);
            }
          },
        },
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
      ]
    );
  }, [isRTL, sendAttachment]);

  const serif = { fontFamily: 'Cairo-Bold' };

  // ── Conversation list view ────────────────────────────────────────────────
  if (!active) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 12,
                       paddingHorizontal: 16, paddingBottom: 14,
                       borderBottomWidth: 1, borderBottomColor: C.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ ...serif, color: C.text, fontWeight: '700', fontSize: 20 }}>
              💬 {t('msg.title')}
            </Text>
            {/* Socket status dot */}
            <View style={{ width: 8, height: 8, borderRadius: 4,
                           backgroundColor: socketReady ? C.green : C.warn,
                           marginLeft: 4 }} />
          </View>
        </View>

        <ConnectionBadge C={C} />
        {error ? <ErrMsg C={C} msg={error} /> : null}

        <FlatList
          data={convos}
          keyExtractor={item => String(item.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadConvos} tintColor={C.gold} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          getItemLayout={(_d, i) => ({ length: CONV_ROW_HEIGHT, offset: CONV_ROW_HEIGHT * i, index: i })}
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={8}
          ListEmptyComponent={
            !loading
              ? <Empty C={C} icon="💬" title={t('msg.noConvs')} subtitle={t('msg.startConv')}
                  action={{ label: t('lawyer.findLawyer'), onPress: () => router.push('/(tabs)/lawyers' as any) }} />
              : <ListSkeleton C={C} count={5} type="message" />
          }
          renderItem={({ item: conv }) => {
            const initials = (conv.other_name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            const unread   = parseInt(String((conv as any).unread_count || 0));
            return (
              <TouchableOpacity onPress={() => openConversation(conv)} activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
                         paddingHorizontal: 16, paddingVertical: 14,
                         borderBottomWidth: 1, borderBottomColor: C.border,
                         backgroundColor: unread > 0 ? C.gold + '06' : 'transparent' }}>
                <View style={{ position: 'relative' }}>
                  <CachedAvatar C={C} uri={(conv as any).other_photo} initials={initials} size={50} />
                  {(conv as any).other_online && (
                    <View style={{ position: 'absolute', bottom: 0, right: 0, width: 13, height: 13,
                                   borderRadius: 7, backgroundColor: C.green, borderWidth: 2, borderColor: C.bg }} />
                  )}
                  {unread > 0 && (
                    <View style={{ position: 'absolute', top: -3, left: -3, minWidth: 18, height: 18,
                                   borderRadius: 9, backgroundColor: C.red, alignItems: 'center',
                                   justifyContent: 'center', paddingHorizontal: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{unread}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: C.text, fontWeight: unread > 0 ? '700' : '500', fontSize: 15 }}>
                      {conv.other_name}
                    </Text>
                    {(conv as any).last_message_at && (
                      <Text style={{ color: C.muted, fontSize: 11 }}>{fmt((conv as any).last_message_at)}</Text>
                    )}
                  </View>
                  <Text style={{ color: unread > 0 ? C.text : C.muted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                    {(conv as any).last_message || t('msg.startConv')}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  }

  // ── Chat view ─────────────────────────────────────────────────────────────
  const convThread = thread.filter((m: Message) =>
    (m as any).conversation_id === active.id || !(m as any).conversation_id
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: C.bg }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ backgroundColor: C.surface, paddingTop: insets.top + 10,
                     paddingHorizontal: 16, paddingBottom: 12,
                     borderBottomWidth: 1, borderBottomColor: C.border,
                     flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => { setActive(null); setOtherTyping(false); setError(''); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <CachedAvatar C={C} uri={(active as any).other_photo}
          initials={(active.other_name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
          size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>{active.other_name}</Text>
          <Text style={{ fontSize: 12,
            color: otherTyping ? C.warn : (active as any).other_online ? C.green : C.muted }}>
            {otherTyping
              ? (isRTL ? 'يكتب...' : 'typing...')
              : (active as any).other_online
                ? '● ' + t('msg.online')
                : t('msg.offline')}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push(`/lawyer/${(active as any).lawyer_id}` as any)}
          style={{ padding: 6 }}>
          <Text style={{ fontSize: 20 }}>👤</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/video', params: { booking: (active as any).booking_id } } as any)}
          style={{ padding: 6 }}>
          <Text style={{ fontSize: 20 }}>📹</Text>
        </TouchableOpacity>
      </View>

      <ConnectionBadge C={C} />
      {error ? <ErrMsg C={C} msg={error} /> : null}

      {/* Messages */}
      {joiningConv ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner C={C} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={convThread}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 8 }}
          style={{ flex: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
              <Text style={{ color: C.muted, fontSize: 14, textAlign: 'center' }}>
                {isRTL ? 'لا توجد رسائل. ابدأ المحادثة!' : 'No messages yet. Say hello!'}
              </Text>
            </View>
          }
          renderItem={({ item: m }) => (
            <MsgBubble msg={m} isMine={m.sender_id === user?.id} C={C} />
          )}
        />
      )}

      {/* Typing indicator */}
      {otherTyping && <TypingIndicator C={C} />}

      {/* Input bar */}
      <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border,
                     paddingHorizontal: 12, paddingVertical: 10,
                     paddingBottom: insets.bottom + 10,
                     flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        {/* Attachment button */}
        <TouchableOpacity onPress={pickAttachment} disabled={uploading}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.card2,
                   borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
          {uploading
            ? <ActivityIndicator size="small" color={C.gold} />
            : <Text style={{ fontSize: 20 }}>📎</Text>}
        </TouchableOpacity>
        <TextInput
          value={input}
          onChangeText={handleInputChange}
          onSubmitEditing={handleSend}
          placeholder={t('msg.typeMessage')}
          placeholderTextColor={C.muted}
          multiline
          style={{ flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border,
                   borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
                   color: C.text, fontSize: 14, maxHeight: 120, textAlign: isRTL ? 'right' : 'left' }}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!input.trim() || sending}
          activeOpacity={0.8}
          style={{ width: 44, height: 44, borderRadius: 22,
                   backgroundColor: input.trim() && !sending ? C.gold : C.dim,
                   alignItems: 'center', justifyContent: 'center',
                   shadowColor: C.gold, shadowOffset: { width: 0, height: 4 },
                   shadowOpacity: input.trim() ? 0.4 : 0, shadowRadius: 8, elevation: 4 }}>
          <Text style={{ color: '#fff', fontSize: 18 }}>{isRTL ? '←' : '→'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
