// ─── useOfflineAware — Sprint 3 ──────────────────────────────────────────────
// Usage: const { isOffline, isWeak, fromCache, cachedAt } = useOfflineAware();
import { useEffect, useState } from "react";
import { subscribeToNetwork, cacheGet, cacheSet, type ConnectivityStatus } from "../utils/network";

interface OfflineState {
  status:    ConnectivityStatus;
  isOffline: boolean;
  isWeak:    boolean;
}

export function useNetworkStatus(): OfflineState {
  const [status, setStatus] = useState<ConnectivityStatus>("online");

  useEffect(() => {
    const unsub = subscribeToNetwork(setStatus);
    return unsub;
  }, []);

  return {
    status,
    isOffline: status === "offline",
    isWeak:    status === "weak",
  };
}

// Hook that manages a data fetch with offline fallback + cache
export function useDataWithCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  deps: any[] = []
): { data: T | null; loading: boolean; error: string; fromCache: boolean; reload: () => void } {
  const { isOffline } = useNetworkStatus();
  const [data,      setData]      = useState<T | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [fromCache, setFromCache] = useState(false);
  const [tick,      setTick]      = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true); setError(""); setFromCache(false);

    const run = async () => {
      if (isOffline) {
        const cached = await cacheGet<T>(cacheKey, Infinity);
        if (mounted) {
          if (cached) { setData(cached); setFromCache(true); }
          else setError("offline");
          setLoading(false);
        }
        return;
      }
      try {
        const result = await fetcher();
        if (mounted) {
          setData(result);
          setFromCache(false);
          await cacheSet(cacheKey, result);
        }
      } catch (err: any) {
        if (err.isOffline || err.message === "offline") {
          const cached = await cacheGet<T>(cacheKey, Infinity);
          if (mounted) {
            if (cached) { setData(cached); setFromCache(true); }
            else setError("No internet connection");
          }
        } else {
          if (mounted) setError(err.message || "Error loading data");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => { mounted = false; };
  }, [isOffline, tick, ...deps]);

  return { data, loading, error, fromCache, reload: () => setTick(t => t + 1) };
}
