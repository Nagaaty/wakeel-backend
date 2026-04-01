// ─── Socket.io Client — Production-ready with auto-reconnect ─────────────────
import { io, Socket } from 'socket.io-client';
import { storage } from './storage';

const API_URL = 'https://wakeel-api.onrender.com';

let socket: Socket | null = null;
let isConnecting = false;
let pendingResolvers: Array<(s: Socket) => void> = [];
let pendingRejectors: Array<(e: Error) => void> = [];

// ── Reconnection state ───────────────────────────────────────────────────────
let reconnectAttempts = 0;
const MAX_RECONNECT = 5;

// ── Global event listeners (survive reconnects) ──────────────────────────────
type SocketEvent = 'message:new' | 'typing:start' | 'typing:stop' |
                   'user:online' | 'user:offline' | 'messages:read' |
                   'booking:updated' | 'notification:new';

const globalListeners = new Map<SocketEvent, Set<Function>>();

export function onSocketEvent(event: SocketEvent, fn: Function): () => void {
  if (!globalListeners.has(event)) globalListeners.set(event, new Set());
  globalListeners.get(event)!.add(fn);
  // Also attach to current socket if connected
  if (socket?.connected) socket.on(event, fn as any);
  return () => {
    globalListeners.get(event)?.delete(fn);
    socket?.off(event, fn as any);
  };
}

function attachGlobalListeners(s: Socket) {
  globalListeners.forEach((fns, event) => {
    s.off(event); // remove duplicates
    fns.forEach(fn => s.on(event, fn as any));
  });
}

// ── Main connection function ─────────────────────────────────────────────────
export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  // Queue if already connecting
  if (isConnecting) {
    return new Promise((resolve, reject) => {
      pendingResolvers.push(resolve);
      pendingRejectors.push(reject);
    });
  }

  isConnecting = true;
  const token = await storage.get('wakeel_token');

  socket = io(API_URL, {
    auth:       { token },
    transports: ['websocket', 'polling'], // fallback to polling
    reconnection:        true,
    reconnectionDelay:   1000,
    reconnectionDelayMax:5000,
    reconnectionAttempts: MAX_RECONNECT,
    timeout:    12000,
    forceNew:   false,
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      isConnecting = false;
      pendingRejectors.forEach(r => r(new Error('Socket connection timeout')));
      pendingRejectors = [];
      reject(new Error('Connection timeout'));
    }, 12000);

    socket!.once('connect', () => {
      clearTimeout(timeout);
      isConnecting = false;
      reconnectAttempts = 0;
      attachGlobalListeners(socket!);
      pendingResolvers.forEach(r => r(socket!));
      pendingResolvers = [];
      resolve(socket!);
    });

    socket!.once('connect_error', (err) => {
      clearTimeout(timeout);
      isConnecting = false;
      pendingRejectors.forEach(r => r(err));
      pendingRejectors = [];
      reject(err);
    });

    // Re-attach listeners on reconnect
    socket!.on('reconnect', () => {
      reconnectAttempts = 0;
      attachGlobalListeners(socket!);
    });

    socket!.on('reconnect_attempt', (attempt) => {
      reconnectAttempts = attempt;
    });

    socket!.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // Server disconnected us — reconnect manually
        socket?.connect();
      }
    });
  });
}

// ── Emit with ack and timeout ────────────────────────────────────────────────
export async function socketEmit<T = any>(
  event: string,
  data: any,
  timeoutMs = 5000
): Promise<T | null> {
  try {
    const s = await getSocket();
    return new Promise<T | null>((resolve) => {
      const t = setTimeout(() => resolve(null), timeoutMs);
      s.emit(event, data, (response: T) => {
        clearTimeout(t);
        resolve(response);
      });
    });
  } catch {
    return null;
  }
}

// ── Disconnect ───────────────────────────────────────────────────────────────
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    isConnecting = false;
    pendingResolvers = [];
    pendingRejectors = [];
    globalListeners.clear();
  }
}

export function getSocketInstance(): Socket | null { return socket; }
export function isSocketConnected(): boolean { return socket?.connected ?? false; }
