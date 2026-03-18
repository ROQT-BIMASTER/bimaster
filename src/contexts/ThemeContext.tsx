import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ThemeKey = "navy-blue" | "midnight-dark" | "slate-professional" | "sage-green" | "bordeaux" | "rose-gold" | "white-clean" | "light-gray" | "warm-light";

export interface ThemeDefinition {
  key: ThemeKey;
  label: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryBadgeBorder: string;
  sidebarBg: string;
  sidebarHover: string;
  sidebarActiveBg: string;
  sidebarText: string;
  sidebarTextActive: string;
  sidebarTextHover: string;
  sidebarTextMuted: string;
  sidebarBorder: string;
  sidebarItemHover: string;
  sidebarMode: "dark" | "light";
}

export const themes: ThemeDefinition[] = [
  {
    key: "navy-blue",
    label: "Navy Blue",
    primary: "#3872e0",
    primaryDark: "#2459c0",
    primaryLight: "#eef3fd",
    primaryBadgeBorder: "#c3d6fa",
    sidebarBg: "#0f1623",
    sidebarHover: "#1c2638",
    sidebarActiveBg: "rgba(56,114,224,0.15)",
    sidebarText: "#8896ab",
    sidebarTextActive: "#ffffff",
    sidebarTextHover: "#c8d3e0",
    sidebarTextMuted: "#4a5a70",
    sidebarBorder: "rgba(255,255,255,0.05)",
    sidebarItemHover: "rgba(255,255,255,0.05)",
    sidebarMode: "dark",
  },
  {
    key: "midnight-dark",
    label: "Midnight Dark",
    primary: "#6366f1",
    primaryDark: "#4f46e5",
    primaryLight: "#eef2ff",
    primaryBadgeBorder: "#c7d2fe",
    sidebarBg: "#09090b",
    sidebarHover: "#18181b",
    sidebarActiveBg: "rgba(99,102,241,0.15)",
    sidebarText: "#8896ab",
    sidebarTextActive: "#ffffff",
    sidebarTextHover: "#c8d3e0",
    sidebarTextMuted: "#4a5a70",
    sidebarBorder: "rgba(255,255,255,0.05)",
    sidebarItemHover: "rgba(255,255,255,0.05)",
    sidebarMode: "dark",
  },
  {
    key: "slate-professional",
    label: "Slate Professional",
    primary: "#475569",
    primaryDark: "#334155",
    primaryLight: "#f1f5f9",
    primaryBadgeBorder: "#cbd5e1",
    sidebarBg: "#1e293b",
    sidebarHover: "#273548",
    sidebarActiveBg: "rgba(71,85,105,0.2)",
    sidebarText: "#8896ab",
    sidebarTextActive: "#ffffff",
    sidebarTextHover: "#c8d3e0",
    sidebarTextMuted: "#4a5a70",
    sidebarBorder: "rgba(255,255,255,0.05)",
    sidebarItemHover: "rgba(255,255,255,0.05)",
    sidebarMode: "dark",
  },
  {
    key: "sage-green",
    label: "Sage Green",
    primary: "#2d7d52",
    primaryDark: "#1f5c3b",
    primaryLight: "#ecfdf5",
    primaryBadgeBorder: "#6ee7b7",
    sidebarBg: "#0d1f16",
    sidebarHover: "#162d22",
    sidebarActiveBg: "rgba(45,125,82,0.15)",
    sidebarText: "#8896ab",
    sidebarTextActive: "#ffffff",
    sidebarTextHover: "#c8d3e0",
    sidebarTextMuted: "#4a5a70",
    sidebarBorder: "rgba(255,255,255,0.05)",
    sidebarItemHover: "rgba(255,255,255,0.05)",
    sidebarMode: "dark",
  },
  {
    key: "bordeaux",
    label: "Bordeaux",
    primary: "#9b1c3a",
    primaryDark: "#7a1430",
    primaryLight: "#fff1f3",
    primaryBadgeBorder: "#fecdd3",
    sidebarBg: "#1a0a0e",
    sidebarHover: "#2c1018",
    sidebarActiveBg: "rgba(155,28,58,0.15)",
    sidebarText: "#8896ab",
    sidebarTextActive: "#ffffff",
    sidebarTextHover: "#c8d3e0",
    sidebarTextMuted: "#4a5a70",
    sidebarBorder: "rgba(255,255,255,0.05)",
    sidebarItemHover: "rgba(255,255,255,0.05)",
    sidebarMode: "dark",
  },
  {
    key: "rose-gold",
    label: "Rose Gold",
    primary: "#b76e79",
    primaryDark: "#9a5460",
    primaryLight: "#fff5f6",
    primaryBadgeBorder: "#f5c2c7",
    sidebarBg: "#1f1316",
    sidebarHover: "#2e1c20",
    sidebarActiveBg: "rgba(183,110,121,0.15)",
    sidebarText: "#8896ab",
    sidebarTextActive: "#ffffff",
    sidebarTextHover: "#c8d3e0",
    sidebarTextMuted: "#4a5a70",
    sidebarBorder: "rgba(255,255,255,0.05)",
    sidebarItemHover: "rgba(255,255,255,0.05)",
    sidebarMode: "dark",
  },
  {
    key: "white-clean",
    label: "White Clean",
    primary: "#3872e0",
    primaryDark: "#2459c0",
    primaryLight: "#eef3fd",
    primaryBadgeBorder: "#c3d6fa",
    sidebarBg: "#ffffff",
    sidebarHover: "#f1f5f9",
    sidebarActiveBg: "rgba(56,114,224,0.08)",
    sidebarText: "#64748b",
    sidebarTextActive: "#0f172a",
    sidebarTextHover: "#334155",
    sidebarTextMuted: "#94a3b8",
    sidebarBorder: "rgba(0,0,0,0.08)",
    sidebarItemHover: "rgba(0,0,0,0.04)",
    sidebarMode: "light",
  },
  {
    key: "light-gray",
    label: "Light Gray",
    primary: "#475569",
    primaryDark: "#334155",
    primaryLight: "#f1f5f9",
    primaryBadgeBorder: "#cbd5e1",
    sidebarBg: "#f1f3f8",
    sidebarHover: "#e2e8f0",
    sidebarActiveBg: "rgba(71,85,105,0.1)",
    sidebarText: "#64748b",
    sidebarTextActive: "#0f172a",
    sidebarTextHover: "#334155",
    sidebarTextMuted: "#94a3b8",
    sidebarBorder: "rgba(0,0,0,0.08)",
    sidebarItemHover: "rgba(0,0,0,0.04)",
    sidebarMode: "light",
  },
  {
    key: "warm-light",
    label: "Warm Light",
    primary: "#b76e79",
    primaryDark: "#9a5460",
    primaryLight: "#fff5f6",
    primaryBadgeBorder: "#f5c2c7",
    sidebarBg: "#faf8f5",
    sidebarHover: "#f0ece7",
    sidebarActiveBg: "rgba(183,110,121,0.1)",
    sidebarText: "#78716c",
    sidebarTextActive: "#1c1917",
    sidebarTextHover: "#44403c",
    sidebarTextMuted: "#a8a29e",
    sidebarBorder: "rgba(0,0,0,0.06)",
    sidebarItemHover: "rgba(0,0,0,0.03)",
    sidebarMode: "light",
  },
];

function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function applyTheme(theme: ThemeDefinition) {
  const root = document.documentElement;
  // Primary color as HSL for tailwind
  root.style.setProperty("--primary", hexToHSL(theme.primary));
  root.style.setProperty("--ring", hexToHSL(theme.primary));
  // Sidebar custom properties (raw hex for backgrounds)
  root.style.setProperty("--sidebar-bg-raw", theme.sidebarBg);
  root.style.setProperty("--sidebar-hover-raw", theme.sidebarHover);
  root.style.setProperty("--sidebar-active-bg-raw", theme.sidebarActiveBg);
  root.style.setProperty("--color-primary-light", theme.primaryLight);
  root.style.setProperty("--color-primary-badge-border", theme.primaryBadgeBorder);
  root.style.setProperty("--color-primary-raw", theme.primary);
  root.style.setProperty("--color-primary-dark-raw", theme.primaryDark);
  // Sidebar text colors
  root.style.setProperty("--sidebar-text-raw", theme.sidebarText);
  root.style.setProperty("--sidebar-text-active-raw", theme.sidebarTextActive);
  root.style.setProperty("--sidebar-text-hover-raw", theme.sidebarTextHover);
  root.style.setProperty("--sidebar-text-muted-raw", theme.sidebarTextMuted);
  root.style.setProperty("--sidebar-border-raw", theme.sidebarBorder);
  root.style.setProperty("--sidebar-item-hover-raw", theme.sidebarItemHover);
  // Sidebar HSL tokens for shadcn sidebar component
  root.style.setProperty("--sidebar-background", hexToHSL(theme.sidebarBg));
  root.style.setProperty("--sidebar-foreground", theme.sidebarMode === "dark" ? "220 14% 96%" : "222 47% 11%");
  root.style.setProperty("--sidebar-accent", hexToHSL(theme.sidebarHover));
  root.style.setProperty("--sidebar-accent-foreground", theme.sidebarMode === "dark" ? "220 14% 96%" : "222 47% 11%");
  root.style.setProperty("--sidebar-border", hexToHSL(theme.sidebarHover));
  root.style.setProperty("--sidebar-primary", hexToHSL(theme.primary));
  root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
  root.style.setProperty("--sidebar-ring", hexToHSL(theme.primary));
}

interface ThemeContextType {
  currentTheme: ThemeKey;
  setTheme: (key: ThemeKey) => Promise<void>;
  themeDefinition: ThemeDefinition;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>(() => {
    return (localStorage.getItem("user_theme") as ThemeKey) || "navy-blue";
  });

  const themeDefinition = themes.find(t => t.key === currentTheme) || themes[0];

  // Apply theme on mount and change
  useEffect(() => {
    applyTheme(themeDefinition);
  }, [themeDefinition]);

  // Load theme from profile
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("profiles")
      .select("theme_key")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.theme_key && themes.some(t => t.key === data.theme_key)) {
          setCurrentTheme(data.theme_key as ThemeKey);
          localStorage.setItem("user_theme", data.theme_key);
        }
      });
  }, [user?.id]);

  const setTheme = useCallback(async (key: ThemeKey) => {
    setCurrentTheme(key);
    localStorage.setItem("user_theme", key);
    const def = themes.find(t => t.key === key) || themes[0];
    applyTheme(def);
    if (user?.id) {
      await supabase
        .from("profiles")
        .update({ theme_key: key } as any)
        .eq("id", user.id);
    }
  }, [user?.id]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themeDefinition }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
