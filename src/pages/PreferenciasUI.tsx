import { useEffect, useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useLauncherTheme, type LauncherTheme } from "@/components/navigation/v2/useLauncherTheme";

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
import { cn } from "@/lib/utils";

export default function PreferenciasUI() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Preferências de interface</h1>
          <p className="text-sm text-muted-foreground">
            Ajustes visuais da sua conta. A navegação lateral usa o ambiente novo (v2) para
            todos os usuários.
          </p>
        </header>

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
