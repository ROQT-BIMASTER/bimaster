import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Send,
  MessageSquareWarning,
  Check,
  Eye,
  Download,
  Paperclip,
  Loader2,
  ChevronDown,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  useRevisoesPorSubmissao,
  type Revisao,
  type RevisaoAnexo,
} from "@/hooks/useChinaRevisoes";
import {
  useVersoesPorDocumento,
  type ChinaDocVersao,
} from "@/hooks/useChinaDocVersoes";
import {
  downloadStorageBlob,
  triggerBlobDownload,
} from "@/lib/utils/storage-download";
import { toast } from "sonner";

interface Props {
  submissaoId: string;
  documentoId: string;
}

const BUCKET = "china-documentos";

type Tipo = "envio" | "aprovado" | "rejeitado" | "ciencia" | "revisao";

function classifyAcao(r?: Revisao | null, hasVersao?: boolean): Tipo {
  const v = (r?.acao_tipo || r?.resultado || "").toLowerCase();
  if (v === "aprovado" || v === "aprovar") return "aprovado";
  if (v === "rejeitado" || v === "rejeitar") return "rejeitado";
  if (v === "ciencia") return "ciencia";
  if (v === "contestado" || v === "contestar") return "revisao";
  return hasVersao ? "envio" : "revisao";
}

function labelTipo(t: Tipo): string {
  switch (t) {
    case "envio":
      return "Envio";
    case "aprovado":
      return "Aprovado";
    case "rejeitado":
      return "Rejeitado";
    case "ciencia":
      return "Ciência";
    case "revisao":
      return "Revisão";
  }
}

function badgeClassFor(t: Tipo): string {
  switch (t) {
    case "envio":
      return "border-primary/40 text-primary bg-primary/10";
    case "aprovado":
      return "border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10";
    case "rejeitado":
      return "border-rose-500/40 text-rose-700 dark:text-rose-400 bg-rose-500/10";
    case "ciencia":
      return "border-sky-500/40 text-sky-700 dark:text-sky-400 bg-sky-500/10";
    case "revisao":
      return "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10";
  }
}

function bulletClassFor(t: Tipo): string {
  switch (t) {
    case "envio":
      return "bg-primary";
    case "aprovado":
      return "bg-emerald-500";
    case "rejeitado":
      return "bg-rose-500";
    case "ciencia":
      return "bg-sky-500";
    case "revisao":
      return "bg-amber-500";
  }
}

function IconFor({ tipo }: { tipo: Tipo }) {
  const Icon =
    tipo === "envio"
      ? Send
      : tipo === "aprovado"
        ? Check
        : tipo === "rejeitado"
          ? MessageSquareWarning
          : tipo === "ciencia"
            ? Eye
            : MessageSquareWarning;
  return <Icon className="h-3 w-3 mr-1" />;
}

/**
 * Timeline visual de rodadas — padrão idêntico ao histórico de briefing.
 * Cada rodada vira um cartão com bullet vertical, badge de tipo (Envio /
 * Revisão / Aprovado / Rejeitado / Ciência), data, parecer e anexos.
 */
export function ChinaRevisaoTimeline({ submissaoId, documentoId }: Props) {
  const { data: revisoesAll = [], isLoading: loadingRev } =
    useRevisoesPorSubmissao(submissaoId);
  const { data: versoes = [], isLoading: loadingVer } =
    useVersoesPorDocumento(documentoId);
  const [downloading, setDownloading] = useState<string | null>(null);

  const revisoes = useMemo(
    () => revisoesAll.filter((r) => r.documento_id === documentoId),
    [revisoesAll, documentoId],
  );

  const versoesPorRodada = useMemo(() => {
    const m = new Map<number, ChinaDocVersao>();
    for (const v of versoes) m.set(v.rodada, v);
    return m;
  }, [versoes]);

  const merged = useMemo(() => {
    const rodadas = new Set<number>();
    for (const r of revisoes) rodadas.add(r.rodada);
    for (const v of versoes) rodadas.add(v.rodada);
    return Array.from(rodadas)
      .sort((a, b) => a - b) // ASC — bullet timeline
      .map((rodada) => ({
        rodada,
        revisao: revisoes.find((r) => r.rodada === rodada) ?? null,
        versao: versoesPorRodada.get(rodada) ?? null,
      }));
  }, [revisoes, versoes, versoesPorRodada]);

  async function baixar(path: string, nome: string, key: string) {
    setDownloading(key);
    try {
      const r = await downloadStorageBlob(path, nome, BUCKET);
      if (r.error || !r.blob) {
        toast.error(r.error || "Falha ao baixar arquivo.");
        return;
      }
      triggerBlobDownload(r.blobUrl, r.filename);
    } finally {
      setDownloading(null);
    }
  }

  if (loadingRev || loadingVer) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando histórico…
      </div>
    );
  }

  if (merged.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Sem rodadas registradas ainda.
      </Card>
    );
  }

  return (
    <div className="relative space-y-4 pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
      {merged.map(({ rodada, revisao, versao }) => {
        const tipo = classifyAcao(revisao, !!versao);
        const data = revisao?.created_at || versao?.enviada_em;
        const dataFmt = data
          ? format(new Date(data), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : "";
        const texto =
          revisao?.motivo_rejeicao || revisao?.contestacao_texto || "";
        const anexos: RevisaoAnexo[] = revisao?.anexos ?? [];

        return (
          <div key={`r-${rodada}`} className="relative">
            <span
              className={cn(
                "absolute -left-[1.35rem] top-4 h-3 w-3 rounded-full border-2 border-background",
                bulletClassFor(tipo),
              )}
            />
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Round {rodada}</h3>
                  <Badge variant="outline" className={badgeClassFor(tipo)}>
                    <IconFor tipo={tipo} />
                    {labelTipo(tipo)}
                  </Badge>
                </div>
                {dataFmt && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {dataFmt}
                  </span>
                )}
              </div>

              {revisao?.acao_por_nome && (
                <div className="text-xs text-muted-foreground">
                  por{" "}
                  <span className="text-foreground/90 font-medium">
                    {revisao.acao_por_nome}
                  </span>
                </div>
              )}

              {texto && (
                <div className="rounded-md bg-muted/50 p-3 text-xs">
                  <div className="font-semibold text-muted-foreground mb-1">
                    {tipo === "rejeitado"
                      ? "Laudo técnico"
                      : tipo === "ciencia"
                        ? "Notas da análise"
                        : "Parecer"}
                  </div>
                  <div className="text-foreground whitespace-pre-wrap">
                    {texto}
                  </div>
                </div>
              )}

              {(anexos.length > 0 || versao?.arquivo_path) && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground group">
                    <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                    Ver anexos ({anexos.length + (versao?.arquivo_path ? 1 : 0)})
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 flex flex-wrap gap-1.5">
                    {versao?.arquivo_path && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-[11px]"
                        onClick={() =>
                          baixar(
                            versao.arquivo_path,
                            versao.nome_arquivo || `R${rodada}`,
                            `ver-${rodada}`,
                          )
                        }
                        disabled={downloading === `ver-${rodada}`}
                      >
                        {downloading === `ver-${rodada}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
                        Arquivo R{rodada}
                      </Button>
                    )}
                    {anexos.map((a, i) => (
                      <Button
                        key={`a-${rodada}-${i}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 px-2 text-[11px]"
                        onClick={() =>
                          baixar(a.path, a.nome, `anx-${rodada}-${i}`)
                        }
                        disabled={downloading === `anx-${rodada}-${i}`}
                        title={a.nome}
                      >
                        {downloading === `anx-${rodada}-${i}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Paperclip className="h-3 w-3" />
                        )}
                        <span className="max-w-[140px] truncate">{a.nome}</span>
                      </Button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
}
