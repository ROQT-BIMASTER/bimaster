import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ListChecks,
  Link2,
  Workflow,
  ChevronDown,
  ChevronUp,
  X,
  ArrowRight,
} from "lucide-react";

const LS_KEY = "suporte.onboarding.processos.dismissed";

interface Props {
  /** Se true, esconde o botão "dispensar" (usado em empty state). */
  persistent?: boolean;
  /** Título/subtítulo compactos. */
  compact?: boolean;
}

export function ProcessoOnboardingGuide({ persistent, compact }: Props) {
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (persistent) return;
    setDismissed(localStorage.getItem(LS_KEY) === "1");
  }, [persistent]);

  if (dismissed) return null;

  const dispensar = () => {
    localStorage.setItem(LS_KEY, "1");
    setDismissed(true);
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" />
            Como montar um processo em 3 passos
          </span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {!persistent && (
              <Button size="sm" variant="ghost" onClick={dispensar} title="Não mostrar mais">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
        {!compact && (
          <p className="text-xs text-muted-foreground">
            Um processo é uma sequência de <strong>rotinas fixas</strong> (uma por
            departamento). O sistema gera um chamado por rotina todo dia útil e
            controla o encadeamento e os prazos entre elas.
          </p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Passo 1 */}
          <div className="rounded-md border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full h-6 w-6 p-0 flex items-center justify-center">1</Badge>
              <span className="text-sm font-medium flex items-center gap-1">
                <ListChecks className="h-4 w-4" /> Cadastre as rotinas fixas
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Em <strong>Rotinas fixas</strong>, crie uma rotina para cada etapa do fluxo,
              cada uma na sua fila (departamento) com horário de geração e SLA.
            </p>
            <Button size="sm" variant="outline" asChild className="w-full">
              <Link to="/dashboard/suporte/rotinas-fixas">
                Ir para Rotinas fixas <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>

          {/* Passo 2 */}
          <div className="rounded-md border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full h-6 w-6 p-0 flex items-center justify-center">2</Badge>
              <span className="text-sm font-medium flex items-center gap-1">
                <Link2 className="h-4 w-4" /> Vincule as rotinas ao processo
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              No diálogo de cada rotina, seção <em>"Encadeamento de processo"</em>:
              na primeira, escolha <strong>"+ Criar novo processo"</strong>. Nas seguintes,
              escolha o processo existente e marque quais são as <strong>próximas rotinas</strong>.
            </p>
            <div className="rounded bg-muted/50 p-2 text-[11px] font-mono leading-relaxed">
              Rotina A ──▶ Rotina B ──▶ Rotina C
              <br />
              <span className="text-muted-foreground">
                (o handoff entre filas diferentes gera alerta se atrasar)
              </span>
            </div>
          </div>

          {/* Passo 3 */}
          <div className="rounded-md border bg-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full h-6 w-6 p-0 flex items-center justify-center">3</Badge>
              <span className="text-sm font-medium flex items-center gap-1">
                <Workflow className="h-4 w-4" /> Ajuste o desenho
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Abra o processo, aba <strong>Canvas</strong>. Arraste as etapas para organizar
              as swimlanes (por fila) e conecte os pontos das bordas para novas ligações.
              Pressione <kbd className="rounded border px-1 text-[10px]">Delete</kbd> sobre
              uma ligação para removê-la.
            </p>
            <p className="text-xs text-muted-foreground">
              Acompanhe a execução do dia e alertas de handoff nesta Central Operacional.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
