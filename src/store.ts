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

export async function fetchAppState(): Promise<AppState> {
  const res = await fetch('/api/state');
  if (res.ok) {
    return await res.json();
  }
  return DEFAULT_STATE;
}

export async function saveAppStateToBackend(state: AppState) {
  const res = await fetch('/api/state', {
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
