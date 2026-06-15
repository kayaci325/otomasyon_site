"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Channel, ChannelsMap } from "@/lib/types";
import { apiFetch } from "@/components/ui";

interface ChannelCtx {
  channels: ChannelsMap;
  activeId: string;
  active: Channel | null;
  setActiveId: (id: string) => void;
  reload: () => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<ChannelCtx>({
  channels: {},
  activeId: "",
  active: null,
  setActiveId: () => {},
  reload: async () => {},
  loading: true,
});

export function useChannel() {
  return useContext(Ctx);
}

const STORAGE_KEY = "mp_active_channel";

export function ChannelProvider({ children }: { children: React.ReactNode }) {
  const [channels, setChannels] = useState<ChannelsMap>({});
  const [activeId, setActiveIdRaw] = useState("");
  const [loading, setLoading] = useState(true);

  const setActiveId = useCallback((id: string) => {
    setActiveIdRaw(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }, []);

  const reload = useCallback(async () => {
    try {
      const raw = await apiFetch<{ content: string }>("/api/github?path=config/channels.json");
      const map: ChannelsMap = JSON.parse(raw.content);
      setChannels(map);
      const keys = Object.keys(map);
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored && map[stored]) {
        setActiveIdRaw(stored);
      } else if (keys.length > 0) {
        const first = keys.find(k => map[k].active) || keys[0];
        setActiveIdRaw(first);
        try { localStorage.setItem(STORAGE_KEY, first); } catch {}
      }
    } catch {
      // On first load if channels.json doesn't exist, use empty
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const active = channels[activeId] || null;

  return (
    <Ctx.Provider value={{ channels, activeId, active, setActiveId, reload, loading }}>
      {children}
    </Ctx.Provider>
  );
}
