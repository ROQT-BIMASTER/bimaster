import { useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChinaChatPanel } from "@/components/china/ChinaChatPanel";
import { getOPStatusInfo } from "@/lib/china/opStatus";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import type { ChinaOPRow } from "@/hooks/useChinaOrdensProducao";
import { Activity, Clock, FileText, MessageSquare, History, Loader2 } from "lucide-react";
import { useChinaI18n } from "@/hooks/useChinaI18n";

interface Props {
  op: ChinaOPRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const STATUS_KEY: Record<string, string> = {
  pendente: "op.stPendente",
  em_andamento: "op.stEmAndamento",
  pausada: "op.stPausada",
  concluida: "op.stConcluida",
  cancelada: "op.stCancelada",
};

export function ChinaOPDrawer({ op, open, onOpenChange }: Props) {
  const { t } = useChinaI18n();
  const { data: apontamentos = [], isFetching } = useQuery({
    queryKey: ["china-op-apontamentos", op?.id],
    enabled: !!op?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_apontamentos" as any)
        .select(
          "id, tipo, quantidade_apontada, quantidade_refugo, quantidade_retrabalho, duracao_minutos, observacoes, timestamp_evento, created_by",
        )
        .eq("ordem_producao_id", op!.id)
        .order("timestamp_evento", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const timeline = useTimeline(op, t);

  if (!op) return null;
  const info = getOPStatusInfo(op.status);
  const planejada = Number(op.quantidade_planejada || 0);
  const produzida = Number(op.quantidade_produzida || 0);
  const pct = planejada > 0 ? Math.round((produzida / planejada) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border bg-muted/30">
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-base">{op.numero}</span>
            <Badge variant={info.variant} className="text-[10px]">
              {STATUS_KEY[op.status] ? t(STATUS_KEY[op.status]) : op.status}
            </Badge>
            {!op.oc_id && (
              <Badge variant="warning" className="text-[10px]">{t("op.semOC")}</Badge>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {op.produto_codigo} — {op.produto_nome}
            {op.submissao_numero && (
              <> · {t("op.submissaoLabel")} <span className="font-mono">{op.submissao_numero}</span></>
            )}
            {op.oc_numero && (
              <> · {t("op.ocLabel")} <span className="font-mono">{op.oc_numero}</span></>
            )}
          </SheetDescription>

          <div className="grid grid-cols-3 gap-3 mt-2">
            <Mini label={t("op.planejada")} value={planejada.toLocaleString()} />
            <Mini label={t("op.produzida")} value={produzida.toLocaleString()} />
            <Mini label={t("op.progresso")} value={`${pct}%`} />
          </div>
          <Progress value={pct} className="h-1.5 mt-1" />
        </SheetHeader>

        <Tabs defaultValue="detalhes" className="px-5 py-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="detalhes" className="gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" /> {t("op.tabDetalhes")}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1 text-xs">
              <History className="h-3.5 w-3.5" /> {t("op.tabHistorico")}
            </TabsTrigger>
            <TabsTrigger value="apontamentos" className="gap-1 text-xs">
              <Activity className="h-3.5 w-3.5" /> {t("op.tabApontamentos")}
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1 text-xs" disabled={!op.submissao_id}>
              <MessageSquare className="h-3.5 w-3.5" /> {t("op.tabChat")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="space-y-3 mt-3">
            <DetailRow label={t("op.loteLabel")} value={op.lote || "—"} />
            <DetailRow
              label={t("op.dataInicioLabel")}
              value={op.data_inicio ? parseLocalDate(op.data_inicio)?.toLocaleDateString("pt-BR") || "—" : "—"}
            />
            <DetailRow
              label={t("op.dataPrevistaLabel")}
              value={op.data_prevista ? parseLocalDate(op.data_prevista)?.toLocaleDateString("pt-BR") || "—" : "—"}
            />
            <DetailRow
              label={t("op.dataFim")}
              value={op.data_fim ? new Date(op.data_fim).toLocaleString("pt-BR") : "—"}
            />
            <Separator />
            <DetailRow
              label={t("op.criadaEm")}
              value={new Date(op.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            />
            {op.observacoes && (
              <Card className="p-3 bg-muted/30">
                <div className="text-[10px] uppercase text-muted-foreground mb-1">{t("op.observacoesLabel")}</div>
                <p className="text-xs whitespace-pre-wrap">{op.observacoes}</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="mt-3">
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">{t("op.semEventos")}</p>
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-3">
                {timeline.map((tl, i) => (
                  <li key={i} className="ml-4">
                    <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary border border-background" />
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{tl.when}</span>
                    </div>
                    <p className="text-sm text-foreground">{tl.label}</p>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>

          <TabsContent value="apontamentos" className="mt-3">
            {isFetching ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : apontamentos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                {t("op.semApontamentos")}
              </p>
            ) : (
              <div className="space-y-2">
                {apontamentos.map((a) => (
                  <Card key={a.id} className="p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-[10px]">{a.tipo}</Badge>
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(a.timestamp_evento).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <span>{t("op.qtdLabel")}: <b>{Number(a.quantidade_apontada || 0).toLocaleString()}</b></span>
                      {Number(a.quantidade_refugo) > 0 && (
                        <span className="text-destructive">{t("op.refugo")}: {a.quantidade_refugo}</span>
                      )}
                      {Number(a.quantidade_retrabalho) > 0 && (
                        <span className="text-warning">{t("op.retrabalho")}: {a.quantidade_retrabalho}</span>
                      )}
                    </div>
                    {a.observacoes && (
                      <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{a.observacoes}</p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="chat" className="mt-3">
            {op.submissao_id ? (
              <ChinaChatPanel
                submissaoId={op.submissao_id}
                produtoNome={op.produto_nome || op.produto_codigo || ""}
                tipoRemetente="china"
              />
            ) : (
              <p className="text-xs text-muted-foreground py-6 text-center">
                {t("op.vincularSubmissaoChat")}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-bold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}

function useTimeline(op: ChinaOPRow | null, t: (key: string, vars?: Record<string, any>) => string) {
  if (!op) return [];
  const fmt = (s?: string | null) =>
    s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
  const items: { when: string; label: string }[] = [];
  if (op.created_at) items.push({ when: fmt(op.created_at), label: t("op.opCriada", { numero: op.numero }) });
  if (op.data_inicio) items.push({ when: fmt(op.data_inicio), label: t("op.inicioProducao") });
  if (op.data_fim) items.push({ when: fmt(op.data_fim), label: t("op.conclusaoProducao") });
  return items.sort((a, b) => (a.when < b.when ? -1 : 1));
}
