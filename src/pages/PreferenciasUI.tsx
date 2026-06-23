import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Sparkles, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_NAV_VERSION, type NavVersion } from "@/lib/featureFlags/navigationVersion";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV_QUERY_KEY = ["user-ui-preferences", "self"] as const;

interface UiPrefsRow {
  user_id: string;
  nav_version: NavVersion;
}

export default function PreferenciasUI() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<NavVersion>(DEFAULT_NAV_VERSION);

  const { data, isLoading } = useQuery({
    queryKey: NAV_QUERY_KEY,
    enabled: !!user?.id,
    queryFn: async (): Promise<UiPrefsRow | null> => {
      const { data, error } = await supabase
        .from("user_ui_preferences" as any)
        .select("user_id,nav_version")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as UiPrefsRow | null) ?? null;
    },
  });

  useEffect(() => {
    const v = data?.nav_version;
    if (v === "v1" || v === "v2") setSelected(v);
  }, [data?.nav_version]);

  const save = useMutation({
    mutationFn: async (next: NavVersion) => {
      if (!user?.id) throw new Error("Sessão expirada.");
      const { error } = await supabase
        .from("user_ui_preferences" as any)
        .upsert(
          { user_id: user.id, nav_version: next },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      toast.success(
        next === "v2"
          ? "Nova navegação ativada. Recarregando…"
          : "Navegação clássica ativada. Recarregando…",
      );
      queryClient.invalidateQueries({ queryKey: NAV_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["feature-flag", "nav-version"] });
      // Reload garante remontagem limpa do AppRail/AppSidebar.
      setTimeout(() => window.location.reload(), 600);
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Não foi possível salvar a preferência.");
    },
  });

  const current = data?.nav_version ?? DEFAULT_NAV_VERSION;
  const dirty = selected !== current;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Preferências de interface</h1>
          <p className="text-sm text-muted-foreground">
            Escolha a versão da navegação lateral. A mudança vale apenas para a sua conta.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              Navegação lateral
            </CardTitle>
            <CardDescription>
              Versão atual: <strong>{current === "v2" ? "Nova (v2)" : "Clássica (v1)"}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <RadioGroup
                value={selected}
                onValueChange={(v) => setSelected(v as NavVersion)}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                <NavOption
                  value="v1"
                  active={selected === "v1"}
                  title="Clássica (v1)"
                  badge="Padrão"
                  description="Sidebar tradicional, com módulos expansíveis e busca integrada. Comportamento atual do sistema."
                />
                <NavOption
                  value="v2"
                  active={selected === "v2"}
                  title="Nova (v2)"
                  badge="Beta"
                  badgeVariant="accent"
                  description="Rail compacto de 68 px + painel contextual por módulo + launcher ⌘K. Mais espaço útil na tela."
                />
              </RadioGroup>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelected(current)}
                disabled={!dirty || save.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => save.mutate(selected)}
                disabled={!dirty || save.isPending}
              >
                {save.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar e recarregar
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground pt-1">
              A tela será recarregada para aplicar a nova navegação. Você pode voltar à versão clássica a qualquer momento por esta mesma tela.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

interface NavOptionProps {
  value: NavVersion;
  active: boolean;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: "default" | "accent";
}

function NavOption({ value, active, title, description, badge, badgeVariant = "default" }: NavOptionProps) {
  const id = `nav-version-${value}`;
  return (
    <Label
      htmlFor={id}
      className={cn(
        "relative flex flex-col gap-2 rounded-lg border p-4 cursor-pointer transition-colors",
        active
          ? "border-primary bg-[hsl(var(--primary)/0.05)]"
          : "border-border hover:bg-muted/40",
      )}
    >
      <div className="flex items-start gap-3">
        <RadioGroupItem id={id} value={value} className="mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">{title}</span>
            {badge && (
              <Badge
                variant={badgeVariant === "accent" ? "default" : "secondary"}
                className={cn(
                  "text-[10px]",
                  badgeVariant === "accent" && "gap-1",
                )}
              >
                {badgeVariant === "accent" && <Sparkles className="h-2.5 w-2.5" />}
                {badge}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
    </Label>
  );
}
