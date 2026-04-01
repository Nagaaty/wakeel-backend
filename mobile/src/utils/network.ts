// ─── Network / Offline Utility — Sprint 3 ────────────────────────────────────
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ConnectivityStatus = "online" | "offline" | "weak";

let _listeners: Array<(s: ConnectivityStatus) => void> = [];
let _current: ConnectivityStatus = "online";

function _toStatus(state: NetInfoState): ConnectivityStatus {
  if (!state.isConnected) return "offline";
  if (state.type === "cellular" && state.details?.cellularGeneration === "2g") return "weak";
  return "online";
}

// Subscribe to network changes
export function subscribeToNetwork(fn: (s: ConnectivityStatus) => void): () => void {
  _listeners.push(fn);
  fn(_current); // emit current immediately
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

// Init once in _layout.tsx
export function initNetworkListener() {
  return NetInfo.addEventListener(state => {
    const next = _toStatus(state);
    if (next !== _current) {
      _current = next;
      _listeners.forEach(fn => fn(next));
    }
  });
}

export async function getConnectivityStatus(): Promise<ConnectivityStatus> {
  const state = await NetInfo.fetch();
  _current = _toStatus(state);
  return _current;
}

// ── Cache helpers ─────────────────────────────────────────────────────────────
const CACHE_PREFIX = "wakeel_cache_";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> { data: T; ts: number; }

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {}
}

export async function cacheGet<T>(key: string, maxAgeMs = CACHE_TTL_MS): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > maxAgeMs) return null;
    return entry.data;
  } catch { return null; }
}

// Fetch with offline fallback
export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  maxAgeMs = CACHE_TTL_MS,
): Promise<{ data: T; fromCache: boolean }> {
  const status = await getConnectivityStatus();
  if (status === "offline") {
    const cached = await cacheGet<T>(key, Infinity); // any age ok when offline
    if (cached) return { data: cached, fromCache: true };
    throw new Error("offline");
  }
  try {
    const data = await fetcher();
    await cacheSet(key, data);
    return { data, fromCache: false };
  } catch (err: any) {
    if (err.message === "Network Error" || err.code === "ERR_NETWORK") {
      const cached = await cacheGet<T>(key, Infinity);
      if (cached) return { data: cached, fromCache: true };
    }
    throw err;
  }
}
