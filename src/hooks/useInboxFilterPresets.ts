import { useEffect, useState } from "react";

export interface InboxFilterPreset {
  id: string;
  nome: string;
  marca: string;
  status: string; // StatusBucket
  oc: string;
  fornecedor: string;
  period_from: string | null; // ISO date
  period_to: string | null;
  search: string;
  created_at: string;
}

const KEY = "compras-inbox-filter-presets-v1";

function read(): InboxFilterPreset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as InboxFilterPreset[];
  } catch {
    return [];
  }
}

function write(list: InboxFilterPreset[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("inbox-presets-changed"));
}

export function useInboxFilterPresets() {
  const [presets, setPresets] = useState<InboxFilterPreset[]>(read);

  useEffect(() => {
    const onChange = () => setPresets(read());
    window.addEventListener("inbox-presets-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("inbox-presets-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const save = (preset: Omit<InboxFilterPreset, "id" | "created_at">) => {
    const novo: InboxFilterPreset = {
      ...preset,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    const next = [novo, ...presets].slice(0, 20);
    write(next);
    return novo;
  };

  const remove = (id: string) => {
    write(presets.filter((p) => p.id !== id));
  };

  const rename = (id: string, nome: string) => {
    write(presets.map((p) => (p.id === id ? { ...p, nome } : p)));
  };

  return { presets, save, remove, rename };
}
