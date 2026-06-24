import { useState } from "react";
import { Check, LayoutGrid, Sparkles, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  useNavVersion,
  type NavVersion,
} from "@/lib/featureFlags/navigationVersion";
import { cn } from "@/lib/utils";

const NavVersionSchema = z.enum(["v1", "v2"]);

interface NavVersionToggleProps {
  /** Variante visual: "sidebar" (v1, ícone pequeno) ou "rail" (v2, botão do rail). */
  variant?: "sidebar" | "rail";
}

/**
 * Botão compacto no rodapé do menu para alternar entre Ambiente v1 e v2.
 * Persiste em `user_ui_preferences.nav_version` e recarrega para remontar
 * o AppRail/AppSidebar limpo (mesmo padrão de PreferenciasUI).
 */
export function NavVersionToggle({ variant = "sidebar" }: NavVersionToggleProps) {
  const { user } = useAuth();
  const { version } = useNavVersion();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<NavVersion | null>(null);
  const [open, setOpen] = useState(false);

  const apply = async (next: NavVersion) => {
    if (!user?.id) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    const parsed = NavVersionSchema.safeParse(next);
    if (!parsed.success) {
      toast.error("Versão de navegação inválida.");
      return;
    }
    if (next === version) {
      setOpen(false);
      return;
    }
    setSaving(next);
    const loadingId = toast.loading("Salvando preferência…");
    try {
      const { error } = await supabase
        .from("user_ui_preferences" as any)
        .upsert(
          { user_id: user.id, nav_version: parsed.data },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      toast.dismiss(loadingId);
      toast.success(
        next === "v2"
          ? "Ambiente novo (v2) ativado. Recarregando…"
          : "Ambiente clássico (v1) ativado. Recarregando…",
      );
      queryClient.invalidateQueries({ queryKey: ["feature-flag", "nav-version"] });
      queryClient.invalidateQueries({ queryKey: ["user-ui-preferences", "self"] });
      setOpen(false);
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(err?.message ?? "Não foi possível salvar.");
      setSaving(null);
    }
  };

  const trigger =
    variant === "rail" ? (
      <button
        type="button"
        title="Ambiente da navegação"
        aria-label="Ambiente da navegação"
        className="flex items-center justify-center h-10 w-10 rounded-lg transition-colors"
        style={{ color: "hsl(var(--launcher-muted))" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "hsl(var(--launcher-surface-hover))";
          e.currentTarget.style.color = "hsl(var(--launcher-foreground))";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "hsl(var(--launcher-muted))";
        }}
      >
        <LayoutGrid className="h-5 w-5" />
      </button>
    ) : (
      <button
        type="button"
        title="Ambiente da navegação"
        aria-label="Ambiente da navegação"
        className="flex items-center justify-center w-8 h-8 rounded-md transition-all duration-150 hover:bg-[var(--sidebar-item-hover-raw)] text-[var(--sidebar-text-raw)] hover:text-[var(--sidebar-text-hover-raw)]"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-56 p-2 z-[120]"
      >
        <p className="text-[10px] uppercase tracking-wider font-bold mb-2 px-2 text-muted-foreground">
          Ambiente
        </p>
        <div className="space-y-0.5">
          <OptionRow
            label="Clássico (v1)"
            description="Sidebar tradicional"
            active={version === "v1"}
            loading={saving === "v1"}
            onClick={() => apply("v1")}
          />
          <OptionRow
            label="Novo (v2)"
            description="Rail compacto + launcher ⌘K"
            active={version === "v2"}
            loading={saving === "v2"}
            badge="Beta"
            onClick={() => apply("v2")}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface OptionRowProps {
  label: string;
  description: string;
  active: boolean;
  loading: boolean;
  badge?: string;
  onClick: () => void;
}

function OptionRow({ label, description, active, loading, badge, onClick }: OptionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex items-start gap-2 w-full px-2 py-2 rounded-md text-sm text-left transition-colors",
        active ? "bg-muted" : "hover:bg-muted/60",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{label}</span>
          {badge && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Sparkles className="h-2.5 w-2.5" />
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
          {description}
        </p>
      </div>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 mt-0.5" />
      ) : active ? (
        <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
      ) : null}
    </button>
  );
}
