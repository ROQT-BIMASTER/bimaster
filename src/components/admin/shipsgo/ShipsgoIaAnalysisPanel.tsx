import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Copy, Check, ShieldCheck, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import type { IaAnalise } from "@/hooks/useShipsgoIntegration";

interface Props {
  loading: boolean;
  analise: IaAnalise | null;
  onGerar: () => void;
  onAplicar: () => void;
  divergenciasDisponiveis: number;
}

const RISCO: Record<string, string> = {
  baixo: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  medio: "bg-amber-500/10 text-amber-700 border-amber-300",
  alto: "bg-orange-500/10 text-orange-700 border-orange-300",
  critico: "bg-destructive/10 text-destructive border-destructive/30",
};
const PRIO: Record<string, string> = {
  P0: "bg-destructive/10 text-destructive border-destructive/30",
  P1: "bg-orange-500/10 text-orange-700 border-orange-300",
  P2: "bg-muted text-foreground border-border",
};

export function ShipsgoIaAnalysisPanel({ loading, analise, onGerar, onAplicar, divergenciasDisponiveis }: Props) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!analise?.relatorio_md) return;
    navigator.clipboard.writeText(analise.relatorio_md);
    setCopied(true);
    toast.success("Relatório copiado");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Brain className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-[240px]">
            <div className="text-sm font-medium">Auditor IA — comparação dos dois lados</div>
            <div className="text-xs text-muted-foreground">
              Analisa diferenças operacionais (dados) e cobertura técnica (schema/eventos) entre o sistema local e a API ShipsGo v2.
            </div>
          </div>
          <Button onClick={onGerar} disabled={loading || divergenciasDisponiveis === 0}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisando…</> : "Gerar análise completa"}
          </Button>
        </CardContent>
      </Card>

      {analise && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <CardTitle className="text-base flex-1">Relatório</CardTitle>
            {analise.resumo?.risco_geral && (
              <Badge variant="outline" className={RISCO[analise.resumo.risco_geral] ?? ""}>
                Risco: {analise.resumo.risco_geral}
              </Badge>
            )}
            <Badge variant="outline">Modelo: {analise.model}</Badge>
            <Button size="sm" variant="ghost" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] pr-4">
              <article className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{analise.relatorio_md}</ReactMarkdown>
              </article>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {analise?.plano_autofix && analise.plano_autofix.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <CardTitle className="text-base flex-1">Plano de auto-fix ({analise.plano_autofix.length})</CardTitle>
            <Button onClick={onAplicar} className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Aplicar plano
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[260px]">
              <ul className="space-y-2">
                {analise.plano_autofix.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm border rounded-md p-2">
                    <Badge variant="outline" className={PRIO[p.prioridade]}>{p.prioridade}</Badge>
                    <Badge variant="outline">{p.acao}</Badge>
                    {p.container && <code className="text-xs bg-muted px-1 rounded">{p.container}</code>}
                    <span className="text-muted-foreground flex-1">{p.motivo}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
