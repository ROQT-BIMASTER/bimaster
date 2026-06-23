import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Sparkles, LayoutGrid, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_NAV_VERSION, type NavVersion } from "@/lib/featureFlags/navigationVersion";
import { useLauncherTheme, type LauncherTheme } from "@/components/navigation/v2/useLauncherTheme";

// Validação client-side: espelha o CHECK constraint do banco
// (nav_version IN ('v1','v2')). Mass-assignment bloqueado via .strict().
const NavVersionSchema = z.enum(["v1", "v2"]);
const SavePayloadSchema = z
  .object({ nav_version: NavVersionSchema })
  .strict();

// Espelha o CHECK constraint launcher_theme IN ('dark','light').
const LauncherThemeSchema = z.enum(["dark", "light"]);

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
      return ((data as unknown) as UiPrefsRow | null) ?? null;
    },
  });

  useEffect(() => {
    const v = data?.nav_version;
    if (v === "v1" || v === "v2") setSelected(v);
  }, [data?.nav_version]);

  const save = useMutation({
    mutationFn: async (next: NavVersion) => {
      if (!user?.id) throw new Error("Sessão expirada. Faça login novamente.");

      // Valida antes de tocar no banco — bloqueia qualquer valor fora de v1/v2
      // mesmo que o estado do componente seja manipulado externamente.
      const parsed = SavePayloadSchema.safeParse({ nav_version: next });
      if (!parsed.success) {
        throw new Error("Versão de navegação inválida. Use apenas 'v1' ou 'v2'.");
      }

      const loadingId = toast.loading("Salvando preferência…");
      try {
        const { error } = await supabase
          .from("user_ui_preferences" as any)
          .upsert(
            { user_id: user.id, nav_version: parsed.data.nav_version },
            { onConflict: "user_id" },
          );
        if (error) throw error;
        return parsed.data.nav_version;
      } finally {
        toast.dismiss(loadingId);
      }
    },
    onSuccess: (next) => {
      toast.success(
        next === "v2"
          ? "Nova navegação ativada. Recarregando…"
          : "Navegação clássica ativada. Recarregando…",
        { icon: <CheckCircle2 className="h-4 w-4" /> },
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
                aria-busy={save.isPending}
              >
                {save.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar e recarregar
                  </>
                )}
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground pt-1">
              A tela será recarregada para aplicar a nova navegação. Você pode voltar à versão clássica a qualquer momento por esta mesma tela.
            </p>
          </CardContent>
        </Card>

        <LauncherThemeCard />
      </div>
    </DashboardLayout>
  );
}

// ────────────────────────────────────────────────────────────
// Card: tema do Launcher (dark | light)
// ────────────────────────────────────────────────────────────
function LauncherThemeCard() {
  const { theme, isLoading, save } = useLauncherTheme();
  const [selected, setSelected] = useState<LauncherTheme>("dark");

  useEffect(() => {
    setSelected(theme);
  }, [theme]);

  const dirty = selected !== theme;

  const onSave = () => {
    const parsed = LauncherThemeSchema.safeParse(selected);
    if (!parsed.success) {
      toast.error("Tema inválido. Escolha Escura ou Clara.");
      return;
    }
    const loadingId = toast.loading("Aplicando tema do launcher…");
    save.mutate(parsed.data, {
      onSettled: () => toast.dismiss(loadingId),
      onSuccess: (next) =>
        toast.success(
          next === "light"
            ? "Launcher claro ativado."
            : "Launcher escuro ativado.",
        ),
      onError: (e: any) =>
        toast.error(e?.message ?? "Não foi possível salvar o tema."),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Tema do Launcher (⌘K)
        </CardTitle>
        <CardDescription>
          Tema atual:{" "}
          <strong>{theme === "light" ? "Clara" : "Escura"}</strong>
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
            onValueChange={(v) => setSelected(v as LauncherTheme)}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <ThemeOption
              value="dark"
              active={selected === "dark"}
              title="Escura"
              description="Fundo navy, contraste alto. Recomendado para uso prolongado."
              swatch={["222 47% 7%", "222 38% 11%", "210 20% 96%"]}
            />
            <ThemeOption
              value="light"
              active={selected === "light"}
              title="Clara"
              description="Fundo branco, mesma estrutura. Combina com tema claro do app."
              swatch={["0 0% 100%", "220 18% 97%", "222 47% 11%"]}
            />
          </RadioGroup>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => setSelected(theme)}
            disabled={!dirty || save.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={onSave}
            disabled={!dirty || save.isPending}
            aria-busy={save.isPending}
          >
            {save.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Aplicar tema
              </>
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground pt-1">
          O tema é aplicado na próxima abertura do launcher (⌘K). Não recarrega a página.
        </p>
      </CardContent>
    </Card>
  );
}

interface ThemeOptionProps {
  value: LauncherTheme;
  active: boolean;
  title: string;
  description: string;
  swatch: [string, string, string];
}

function ThemeOption({ value, active, title, description, swatch }: ThemeOptionProps) {
  const id = `launcher-theme-${value}`;
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
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm text-foreground">{title}</span>
            <div className="flex items-center gap-1">
              {swatch.map((hsl, i) => (
                <span
                  key={i}
                  className="h-4 w-4 rounded-full border border-border/60"
                  style={{ background: `hsl(${hsl})` }}
                />
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
    </Label>
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
