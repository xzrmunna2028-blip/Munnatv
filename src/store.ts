import { useState, useEffect } from 'react';

export interface StreamServer {
  id: string;
  name: string;
  url: string;
}

export interface Channel {
  id: string;
  name: string;
  logo: string;
  categoryId: string;
  active?: boolean;
  servers: StreamServer[];
  team1?: string;
  team2?: string;
  matchTime?: string;
  status?: 'live' | 'coming_soon' | 'inactive';
}

export interface Category {
  id: string;
  label: string;
  iconName?: string;
}

export interface AppState {
  noticeText: string;
  comingSoonUrl?: string;
  comingSoonType?: 'video' | 'image' | '';
  maintenanceMode?: boolean;
  categories: Category[];
  channels: Channel[];
}

const DEFAULT_STATE: AppState = {
  noticeText: "Loading...",
  comingSoonUrl: "",
  comingSoonType: "",
  maintenanceMode: false,
  categories: [],
  channels: [],
};

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.host;
  const isLocalOrRunApp = host.includes('localhost') || 
                          host.includes('127.0.0.1') || 
                          host.includes('.run.app') || 
                          host.includes('0.0.0.0');
  if (isLocalOrRunApp) {
    return '';
  }
  return 'https://nexarion-tv-438422593575.asia-southeast1.run.app';
}

export function getStreamUrl(url: string): string {
  if (!url) return '';
  const baseUrl = getApiBaseUrl();
  
  // If the stream URL is relative (starts with '/' like '/live/')
  if (url.startsWith('/')) {
    return `${baseUrl || window.location.origin}${url}`;
  }
  
  // If it's http and current protocol is https, we proxy it via stream-proxy
  if (url.startsWith('http://') && window.location.protocol === 'https:') {
    const proxyBase = baseUrl || '';
    return `${proxyBase}/api/stream-proxy?url=${encodeURIComponent(url)}`;
  }
  
  return url;
}

export function getWebSocketUrl(path: string): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.host;
  const isLocalOrRunApp = host.includes('localhost') || 
                          host.includes('127.0.0.1') || 
                          host.includes('.run.app') || 
                          host.includes('0.0.0.0');
  if (isLocalOrRunApp) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${host}${path}`;
  }
  return `wss://nexarion-tv-438422593575.asia-southeast1.run.app${path}`;
}

export async function fetchAppState(): Promise<AppState> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/state`);
  if (res.ok) {
    return await res.json();
  }
  return DEFAULT_STATE;
}

export async function saveAppStateToBackend(state: AppState) {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/state`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer MUNNA12061'
    },
    body: JSON.stringify(state)
  });
  if (!res.ok) throw new Error('Failed to save to backend');
}

export function useAppState(pollInterval: number = 0) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    
    const load = async () => {
      try {
        const data = await fetchAppState();
        if (mounted) {
          setState(prev => {
            // Only update if the stringified content has actually changed to prevent unnecessary re-renders
            if (JSON.stringify(prev) === JSON.stringify(data)) {
              return prev;
            }
            return data;
          });
          setLoading(false);
        }
      } catch (e) {
        console.error("Error fetching state:", e);
      }
    };

    load();
    
    if (pollInterval > 0) {
      interval = setInterval(load, pollInterval);
    }
    
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [pollInterval]);

  return { state, loading };
}
