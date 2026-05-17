// ─── Wakeel — useUnreadNotifs (Chunk 3c) ─────────────────────────────────────
// Provides a live unread-notification count for any consumer (typically the
// tab bar bell). Strategy:
//
//   1. On mount, fetch /notifications/unread-count once (sets the baseline)
//   2. Listen to a global socket event `notification:new` (emitted by backend
//      whenever it INSERTs into notifications). Increment on each.
//   3. Re-fetch when app regains focus (covers events missed while offline).
//   4. Expose decrement / refresh helpers so the notifications page can
//      sync the badge after marking-as-read locally.
//
// We intentionally do NOT poll on a timer — that would burn battery on
// idle. Sockets + focus refetch covers the realistic update paths.
//
// Backend contract: see backendV3/src/utils/socket.js — should emit
// `notification:new` to room `user:<id>` whenever a row is inserted into
// the `notifications` table.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import io from 'socket.io-client';
import { useAuth } from './useAuth';
import { notificationsAPI } from '../services/api';

const WS_URL = 'https://wakeel-api.onrender.com';

// Module-level singleton — same socket reused across all consumers
let notifSocket: any = null;

export function useUnreadNotifs() {
  const { token, user } = useAuth();
  const [count, setCount]     = useState(0);
  const [loaded, setLoaded]   = useState(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res: any = await notificationsAPI.unreadCount();
      if (mountedRef.current) setCount(res?.count || 0);
    } catch {
      // Swallow errors — badge degrading to 0 is better than crashing
    } finally {
      if (mountedRef.current) setLoaded(true);
    }
  }, []);

  // Decrement when caller marks N notifications as read locally.
  // Caller still hits the API; this just keeps the badge in sync immediately.
  const decrement = useCallback((n = 1) => {
    setCount(c => Math.max(0, c - n));
  }, []);

  const reset = useCallback(() => setCount(0), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Initial fetch + AppState refetch
  useEffect(() => {
    if (!token || !user?.id) return;
    refresh();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [token, user?.id, refresh]);

  // Socket listener — increment on `notification:new`
  useEffect(() => {
    if (!token || !user?.id) return;
    if (!notifSocket) {
      notifSocket = io(WS_URL, {
        auth: { token },
        transports: ['websocket'],
      });
    }
    const handler = () => {
      if (!mountedRef.current) return;
      setCount(c => c + 1);
    };
    notifSocket.on('notification:new', handler);
    return () => { notifSocket?.off('notification:new', handler); };
  }, [token, user?.id]);

  return { count, loaded, refresh, decrement, reset };
}
