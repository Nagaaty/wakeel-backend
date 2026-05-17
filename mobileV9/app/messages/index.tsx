// ─── Wakeel Messages Screen — Sprint 2: Full Real-time Socket.io ─────────────
import React, { useEffect, useState, useRef, useCallback, memo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, RefreshControl,
  Alert, Animated, Easing, Image, ActionSheetIOS, Modal, ActivityIndicator, Keyboard,
} from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchConvos, fetchThread, addMessage,
  selConvos, selThread, selMLoading,
} from '../../src/features/messages/messagesSlice';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuth } from '../../src/hooks/useAuth';
import { Empty } from '../../src/components/ui';
import { CachedAvatar } from '../../src/components/CachedImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getSocket, onSocketEvent, socketEmit, isSocketConnected,
} from '../../src/utils/socket';
import { messagesAPI } from '../../src/services/api';
import { useUnreadNotifs } from '../../src/hooks/useUnreadNotifs';
import { useI18n } from '../../src/i18n';
import { ListSkeleton } from '../../src/components/Skeleton';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight, hapticMedium } from '../../src/utils/haptics';
import type { AppDispatch } from '../../src/store';
import type { Conversation, Message } from '../../src/types';
import * as ImagePicker from 'expo-image-picker';
import api from '../../src/services/api';

const CONV_ROW_HEIGHT = 79; // avatar(50) + paddingV(28) + border(1)

const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

// ── Slim connection banner (like WhatsApp) ────────────────────────────
function ConnectionBadge({ C }: { C: any }) {
  const [connected, setConnected] = useState(isSocketConnected());
  useEffect(() => {
    const check = setInterval(() => setConnected(isSocketConnected()), 3000);
    return () => clearInterval(check);
  }, []);
  if (connected) return null;
  return (
    <View style={{
      backgroundColor: '#F0A500',
      height: 3,
      width: '100%',
    }} />
  );
}

// ── Message bubble — WhatsApp-style ─────────────────────────────────────────
function MsgBubble({ msg, isMine, C }: { msg: Message; isMine: boolean; C: any }) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(isMine ? 20 : -20)).current;
  // DB stores as 'text', REST fallback aliases to 'content'
  const content = (msg as any).text || (msg as any).content || '';
  const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(content) || content.startsWith('__img__:');
  const imgUrl  = content.replace('__img__:', '');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: 0, duration: 180, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      flexDirection: 'row',
      justifyContent: isMine ? 'flex-end' : 'flex-start',
      paddingHorizontal: 8,
      opacity: fadeIn, transform: [{ translateX: slideX }],
    }}>
      <View style={{
        maxWidth: '80%',
        backgroundColor: isMine ? '#8B6914' : C.surface,
        borderRadius: 20,
        borderBottomRightRadius: isMine ? 4 : 20,
        borderBottomLeftRadius:  isMine ? 20 : 4,
        padding: isImage ? 4 : 10,
        paddingHorizontal: isImage ? 4 : 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 2,
        overflow: 'hidden',
      }}>
        {isImage ? (
          <Image source={{ uri: imgUrl }} style={{ width: 200, height: 160, borderRadius: 16 }} resizeMode="cover" />
        ) : (
          <Text style={{ color: isMine ? '#fff' : C.text, fontSize: 15, lineHeight: 22 }}>
            {content}
          </Text>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 3, paddingHorizontal: isImage ? 8 : 0, paddingBottom: isImage ? 4 : 0 }}>
          <Text style={{ color: isMine ? 'rgba(255,255,255,0.6)' : C.muted, fontSize: 10 }}>
            {fmt(msg.created_at)}
          </Text>
          {isMine && (
            <Text style={{ color: (msg as any).is_read ? '#90EE90' : 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 1 }}>
              {(msg as any).is_read ? '✓✓' : '✓'}
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
  const { refresh: refreshBadge } = useUnreadNotifs();

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
      await dispatch(fetchThread(conv.id as unknown as string)).unwrap();
      const s = await getSocket();
      s.emit('conversation:join', conv.id);
      s.emit('messages:read', { conversationId: conv.id });
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل الرسائل');
    } finally {
      setJoiningConv(false);
    }
    // Refresh badge immediately after reading messages
    setTimeout(() => refreshBadge(), 500);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 250);
  }, [dispatch, refreshBadge]);

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

    // 1. Optimistic — appears instantly, both text + content for compatibility
    const optimistic: any = {
      id:              `opt_${Date.now()}`,
      conversation_id: conv.id,
      sender_id:       user?.id,
      text:            content,
      content,
      created_at:      new Date().toISOString(),
      is_read:         false,
    };
    dispatch(addMessage(optimistic));
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

    // 2. Socket (only if already connected — no hanging await)
    if (isSocketConnected()) {
      try {
        const s = await getSocket();
        s.emit('typing:stop', { conversationId: conv.id });
        s.emit('message:send', { conversationId: conv.id, content });
        return; // socket handled it
      } catch {}
    }

    // 3. REST fallback
    setSending(true);
    try {
      await messagesAPI.sendMessage(conv.id as any, content);
    } catch {
      Alert.alert('خطأ', 'تعذر إرسال الرسالة. تحقق من الاتصال.');
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

  const takePhoto = useCallback(async () => {
    Keyboard.dismiss();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('مطلوب إذن الوصول للكاميرا'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const { uri, mimeType, fileName } = result.assets[0];
      await sendAttachment(uri, mimeType || 'image/jpeg', fileName || 'photo.jpg');
    }
  }, [sendAttachment]);

  const pickGallery = useCallback(async () => {
    Keyboard.dismiss();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('مطلوب إذن الوصول للصور'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      const { uri, mimeType, fileName } = result.assets[0];
      await sendAttachment(uri, mimeType || 'image/jpeg', fileName || 'photo.jpg');
    }
  }, [sendAttachment]);

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
  const initials = (active.other_name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#F5F0E8' }}
      keyboardVerticalOffset={0}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header — deep gold, professional */}
      <View style={{
        backgroundColor: C.gold,
        paddingTop: insets.top + 8,
        paddingHorizontal: 12,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      }}>
        <TouchableOpacity
          onPress={() => { setActive(null); setOtherTyping(false); setError(''); }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 4 }}>
          <Text style={{ color: '#fff', fontSize: 26, lineHeight: 28 }}>‹</Text>
        </TouchableOpacity>

        <CachedAvatar C={C} uri={(active as any).other_photo}
          initials={initials} size={42} />

        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {active.other_name}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
            {otherTyping
              ? 'يكتب...'
              : (active as any).other_online ? 'متصل الآن' : 'غير متصل'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push(`/lawyer/${(active as any).other_id || (active as any).lawyer_id}` as any)}
          style={{ padding: 6 }}>
          <Text style={{ fontSize: 20 }}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* Slim offline indicator */}
      <ConnectionBadge C={C} />

      {/* Messages area with chat wallpaper feel */}
      {joiningConv ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F0E8' }}>
          <ActivityIndicator size="large" color={C.gold} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={convThread}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{
            paddingVertical: 12,
            paddingHorizontal: 4,
            gap: 6,
            paddingBottom: 16,
            flexGrow: 1,
          }}
          style={{ flex: 1, backgroundColor: '#F5F0E8' }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <View style={{
                backgroundColor: 'rgba(139,105,20,0.1)',
                borderRadius: 16, padding: 24,
                alignItems: 'center', gap: 8,
              }}>
                <Text style={{ fontSize: 40 }}>💬</Text>
                <Text style={{ color: '#8B6914', fontWeight: '600', fontSize: 15 }}>
                  ابدأ المحادثة
                </Text>
                <Text style={{ color: '#8B691499', fontSize: 13, textAlign: 'center' }}>
                  رسائلك آمنة وخاصة
                </Text>
              </View>
            </View>
          }
          renderItem={({ item: m }) => (
            <MsgBubble msg={m} isMine={m.sender_id === user?.id} C={C} />
          )}
        />
      )}

      {/* Typing indicator */}
      {otherTyping && <TypingIndicator C={C} />}

      {/* ── Elegant Input Bar (Wakeel Theme) ── */}
      <View style={{
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: insets.bottom + 8,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        backgroundColor: '#F5F0E8', // Match the chat background perfectly
      }}>
        {/* SEND button — RIGHT in RTL */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={!input.trim() || sending}
          activeOpacity={0.85}
          style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: input.trim() && !sending ? C.gold : '#D4C9B0',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: C.gold,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: input.trim() ? 0.3 : 0,
            shadowRadius: 6, elevation: 4,
            marginBottom: 2,
          }}>
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 3 }} />}
        </TouchableOpacity>

        {/* INPUT PILL */}
        <View style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'flex-end',
          backgroundColor: '#FFFFFF',
          borderRadius: 24,
          paddingLeft: 4,
          paddingRight: 16,
          minHeight: 48,
          borderWidth: 1,
          borderColor: '#E8E1D5',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2, elevation: 1,
          marginBottom: 2,
        }}>
          {/* CAMERA Button */}
          <TouchableOpacity
            onPress={takePhoto}
            disabled={uploading}
            style={{ padding: 10, paddingBottom: 11, opacity: uploading ? 0.5 : 1 }}>
            {uploading ? <ActivityIndicator size="small" color={C.gold} /> : <Ionicons name="camera-outline" size={26} color="#8A7D60" />}
          </TouchableOpacity>

          {/* GALLERY Button */}
          <TouchableOpacity
            onPress={pickGallery}
            disabled={uploading}
            style={{ padding: 6, paddingBottom: 12, opacity: uploading ? 0.5 : 1 }}>
            <Ionicons name="image-outline" size={24} color="#8A7D60" />
          </TouchableOpacity>

          {/* TEXT INPUT */}
          <TextInput
            value={input}
            onChangeText={handleInputChange}
            onSubmitEditing={handleSend}
            placeholder='اكتب رسالة...'
            placeholderTextColor='#A09070'
            multiline
            textAlign='right'
            style={{
              flex: 1,
              color: '#1A1A1A',
              fontSize: 16,
              maxHeight: 120,
              paddingVertical: 12,
              paddingTop: 14,
            }}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
