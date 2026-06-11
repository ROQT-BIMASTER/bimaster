import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  AlertCircle,
  MessageSquareWarning,
  Eye,
  Download,
  Paperclip,
  Loader2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

function iconForAcao(acao?: string | null, resultado?: string | null) {
  const v = (acao || resultado || "").toLowerCase();
  if (v === "aprovado" || v === "aprovar") return Check;
  if (v === "rejeitado" || v === "rejeitar") return AlertCircle;
  if (v === "contestado" || v === "contestar") return MessageSquareWarning;
  if (v === "ciencia") return Eye;
  return FileText;
}

function toneForAcao(acao?: string | null, resultado?: string | null) {
  const v = (acao || resultado || "").toLowerCase();
  if (v === "aprovado" || v === "aprovar")
    return "border-emerald-500/40 bg-emerald-500/5 text-emerald-700";
  if (v === "rejeitado" || v === "rejeitar")
    return "border-rose-500/40 bg-rose-500/5 text-rose-700";
  if (v === "contestado" || v === "contestar")
    return "border-amber-500/40 bg-amber-500/5 text-amber-700";
  if (v === "ciencia")
    return "border-sky-500/40 bg-sky-500/5 text-sky-700";
  return "border-border bg-muted/40 text-muted-foreground";
}

function labelAcao(acao?: string | null, resultado?: string | null) {
  const v = (acao || resultado || "").toLowerCase();
  if (v === "aprovado" || v === "aprovar") return "Aprovado";
  if (v === "rejeitado" || v === "rejeitar") return "Rejeitado";
  if (v === "contestado" || v === "contestar") return "Substituído";
  if (v === "ciencia") return "Ciência";
  return v || "Evento";
}

export function DrawerRevisoesList({ submissaoId, documentoId }: Props) {
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
    // Une rodadas vindas de revisões e de versões para não perder snapshots
    // sem revisão correspondente.
    const rodadas = new Set<number>();
    for (const r of revisoes) rodadas.add(r.rodada);
    for (const v of versoes) rodadas.add(v.rodada);
    return Array.from(rodadas)
      .sort((a, b) => b - a)
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
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-[11px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Carregando histórico…
      </div>
    );
  }

  if (merged.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
        Sem revisões ainda.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Histórico de revisões
      </p>
      <ol className="space-y-2">
        {merged.map(({ rodada, revisao, versao }) => {
          const Icon = iconForAcao(revisao?.acao_tipo, revisao?.resultado);
          const tone = toneForAcao(revisao?.acao_tipo, revisao?.resultado);
          const label = labelAcao(revisao?.acao_tipo, revisao?.resultado);
          const texto =
            revisao?.motivo_rejeicao || revisao?.contestacao_texto || "";
          const anexos: RevisaoAnexo[] = revisao?.anexos ?? [];
          const data = revisao?.created_at || versao?.enviada_em;

          return (
            <li
              key={`r-${rodada}`}
              className="space-y-1.5 rounded-md border border-border bg-card/30 p-2.5"
            >
              <div className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 font-mono text-[10px] tabular-nums"
                >
                  R{rodada}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 gap-1 border px-1.5 text-[10px]",
                    tone,
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </Badge>
                {data && (
                  <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                    {format(new Date(data), "dd/MM/yy HH:mm", {
                      locale: ptBR,
                    })}
                  </span>
                )}
              </div>

              {revisao?.acao_por_nome && (
                <div className="text-[11px] text-muted-foreground">
                  por{" "}
                  <span className="text-foreground/90">
                    {revisao.acao_por_nome}
                  </span>
                </div>
              )}

              {texto && (
                <p className="whitespace-pre-wrap text-[11.5px] leading-snug text-foreground/90 line-clamp-4">
                  {texto}
                </p>
              )}

              {(anexos.length > 0 || versao) && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {versao?.arquivo_path && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 gap-1 px-1.5 text-[10.5px]"
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
                      className="h-6 gap-1 px-1.5 text-[10.5px]"
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
                      <span className="max-w-[120px] truncate">{a.nome}</span>
                    </Button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
