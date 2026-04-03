import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { commandRoutes, quickActions, type CommandRoute, type QuickAction } from "./command-routes";
import { useScreenPermissions } from "@/hooks/useScreenPermissions";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Home, Users, Building2, Settings, Upload, Shield, LayoutGrid, CheckSquare,
  MapPin, MessageSquare, Activity, Clock, Store, Calendar, Camera, Tag,
  TrendingUp, Brain, Image, ClipboardCheck, DollarSign, FileText, Download,
  Phone, Trophy, BarChart3, Sparkles, Package, Factory, Receipt, Layers,
  Cog, UserCircle, AlertCircle, AlertTriangle, Pause, Wrench, List, Bot,
  Wallet, Grid3X3, Briefcase, Rocket, PartyPopper, CreditCard, Pickaxe,
  Compass, Ticket, FolderKanban, Inbox, Mic, Globe, ShoppingCart, Send,
  Landmark, Palette, FlaskConical, Scale, Network, Key, Megaphone, BarChart2,
  UserCheck, Target, RefreshCw, CalendarDays, Search,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  Home, Users, Building2, Settings, Upload, Shield, LayoutGrid, CheckSquare,
  MapPin, MessageSquare, Activity, Clock, Store, Calendar, Camera, Tag,
  TrendingUp, Brain, Image, ClipboardCheck, DollarSign, FileText, Download,
  Phone, Trophy, BarChart3, Sparkles, Package, Factory, Receipt, Layers,
  Cog, UserCircle, AlertCircle, AlertTriangle, Pause, Wrench, List, Bot,
  Wallet, Grid3X3, Briefcase, Rocket, PartyPopper, CreditCard, Pickaxe,
  Compass, Ticket, FolderKanban, Inbox, Mic, Globe, ShoppingCart, Send,
  Landmark, Palette, FlaskConical, Scale, Network, Key, Megaphone, BarChart2,
  UserCheck, Target, RefreshCw, CalendarDays, Search,
};

function getIcon(name: string): LucideIcon {
  return iconMap[name] || Home;
}

// Simple fuzzy match: checks if all chars of query appear in order in target
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function matchesSearch(query: string, route: CommandRoute | QuickAction): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (fuzzyMatch(q, route.title)) return true;
  if ("module" in route && fuzzyMatch(q, route.module)) return true;
  if (route.keywords?.some(k => fuzzyMatch(q, k))) return true;
  if (route.path.toLowerCase().includes(q)) return true;
  return false;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { hasPermission } = useScreenPermissions();
  const { hasModulePermission } = useModulePermissions();
  const { isAdmin } = useUserRole();
  const [recentPaths, setRecentPaths] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("cmd-recent") || "[]");
    } catch { return []; }
  });

  // Filter routes based on permissions
  const filteredRoutes = useMemo(() => {
    return commandRoutes.filter(route => {
      if (route.screenCode === "admin" && !isAdmin) return false;
      if (route.moduleCode && !hasModulePermission(route.moduleCode)) return false;
      if (route.screenCode && route.screenCode !== "admin" && !hasPermission(route.screenCode)) return false;
      return true;
    });
  }, [hasPermission, hasModulePermission, isAdmin]);

  const recentRoutes = useMemo(() => {
    return recentPaths
      .map(p => filteredRoutes.find(r => r.path === p))
      .filter(Boolean) as CommandRoute[];
  }, [recentPaths, filteredRoutes]);

  // Group routes by module
  const groupedRoutes = useMemo(() => {
    const groups: Record<string, CommandRoute[]> = {};
    for (const route of filteredRoutes) {
      const mod = route.module;
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(route);
    }
    return groups;
  }, [filteredRoutes]);

  const handleSelect = useCallback((path: string) => {
    onOpenChange(false);
    // Track recent
    setRecentPaths(prev => {
      const next = [path, ...prev.filter(p => p !== path)].slice(0, 5);
      localStorage.setItem("cmd-recent", JSON.stringify(next));
      return next;
    });
    navigate(path);
  }, [navigate, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar página, módulo ou ação..." />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* Quick Actions */}
        <CommandGroup heading="Ações Rápidas">
          {quickActions.map(action => {
            const Icon = getIcon(action.icon);
            return (
              <CommandItem
                key={action.path}
                value={`action:${action.title} ${action.keywords?.join(" ") || ""}`}
                onSelect={() => handleSelect(action.path)}
                className="gap-2"
              >
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <span>{action.title}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* Recent */}
        {recentRoutes.length > 0 && (
          <>
            <CommandGroup heading="Recentes">
              {recentRoutes.map(route => {
                const Icon = getIcon(route.icon);
                return (
                  <CommandItem
                    key={`recent-${route.path}`}
                    value={`recent:${route.title} ${route.module}`}
                    onSelect={() => handleSelect(route.path)}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1">{route.title}</span>
                    <span className="text-xs text-muted-foreground">{route.module}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* All pages grouped by module */}
        {Object.entries(groupedRoutes).map(([module, routes]) => (
          <CommandGroup key={module} heading={module}>
            {routes.map(route => {
              const Icon = getIcon(route.icon);
              return (
                <CommandItem
                  key={route.path}
                  value={`${route.title} ${route.module} ${route.keywords?.join(" ") || ""} ${route.path}`}
                  onSelect={() => handleSelect(route.path)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{route.title}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Hook global para abrir o Command Palette com Ctrl+K / Cmd+K
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return { open, setOpen };
}
