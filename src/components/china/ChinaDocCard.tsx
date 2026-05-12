import { useState } from "react";
import { Eye, CheckCircle2, XCircle, AlertTriangle, MessageSquare, Clock, FileText, History, Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BilingualLabel } from "./BilingualLabel";
import { CHINA_DOCUMENT_TYPES, STATUS_LABELS } from "@/lib/china-document-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatLocalDate } from "@/utils/dateUtils";
import type { Revisao } from "@/hooks/useChinaRevisoes";
import { useSalvarTraducaoRevisao } from "@/hooks/useChinaRevisoes";
import { useVersoesPorDocumento } from "@/hooks/useChinaDocVersoes";
import { TextoComTraducao } from "./TextoComTraducao";
import { DialogRejeitarDocumento } from "./DialogRejeitarDocumento";
import { DialogContestarDocumento } from "./DialogContestarDocumento";
import { supabase } from "@/integrations/supabase/client";
import { triggerBlobDownload } from "@/lib/utils/storage-download";
import { toast } from "sonner";

interface ChinaDocCardProps {
  doc: any;
  fluxo: "china_envia" | "brasil_envia";
  revisao?: Revisao | null;
  isBrasilUser: boolean;
  isChinaUser: boolean;
  onView: (doc: any) => void;
  onAprovar?: (doc: any) => void;
  // mantidos para compatibilidade — fluxo antigo via pai
  onRejeitar?: (doc: any, motivo: string, anotacoes: any[]) => void;
  onCiencia?: (doc: any) => void;
  onContestar?: (doc: any, texto: string) => void;
  onReupload?: (tipo: string, file: File) => void;
}

const BUCKET = "china-documentos";

async function downloadStoragePath(path: string, nome: string) {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) throw error || new Error("Falha");
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    triggerBlobDownload(url, nome);
  } catch {
    toast.error("Não foi possível baixar o arquivo.");
  }
}

export function ChinaDocCard({
  doc, fluxo, revisao, isBrasilUser, isChinaUser,
  onView, onAprovar, onCiencia, onContestar,
}: ChinaDocCardProps) {
  const [rejectDialog, setRejectDialog] = useState(false);
  const [contestDialog, setContestDialog] = useState(false);
  const [substituirDialog, setSubstituirDialog] = useState(false);
  const [contestTexto, setContestTexto] = useState("");
  const [historicoOpen, setHistoricoOpen] = useState(false);

  const { data: versoes = [] } = useVersoesPorDocumento(historicoOpen ? doc.id : undefined);
  const salvarTraducao = useSalvarTraducaoRevisao();

  const cfg = CHINA_DOCUMENT_TYPES.find(d => d.tipo === doc.tipo_documento);
  const statusInfo = STATUS_LABELS[doc.status] || STATUS_LABELS.rascunho;
  const anotacoes = (revisao?.anotacoes || []) as any[];

  const borderColor = fluxo === "china_envia" ? "border-l-primary" : "border-l-success";

  const showBrasilApproveReject = isBrasilUser && fluxo === "china_envia" && doc.status === "pendente";
  const showChinaCiencia = isChinaUser && fluxo === "brasil_envia" && doc.status === "pendente";
  const showChinaCorrectContest = isChinaUser && fluxo === "china_envia" && doc.status === "rejeitado";
  const showBrasilContestedActions = isBrasilUser && doc.status === "contestado";

  return (
    <>
      <div className={`p-4 border border-l-4 ${borderColor} rounded-lg bg-card space-y-3 transition-all hover:shadow-sm`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="shrink-0 text-muted-foreground">
              {cfg?.icon || <FileText className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{cfg?.labelPt || doc.tipo_documento}</p>
              <p className="text-[10px] text-muted-foreground">{cfg?.labelCn || ""}</p>
              {doc.nome_arquivo && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">📎 {doc.nome_arquivo}</p>
              )}
            </div>
          </div>
          <Badge variant={statusInfo.variant} className="text-[10px] shrink-0">
            {statusInfo.pt} {statusInfo.cn}
            {revisao && revisao.rodada > 1 && ` · v${revisao.rodada}`}
          </Badge>
        </div>

        {/* Last action info */}
        {revisao && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              {revisao.acao_por_nome ? `${revisao.acao_por_nome} — ` : ""}
              {formatLocalDate(revisao.created_at, "dd/MM HH:mm")}
              {revisao.rodada > 1 && ` (Rodada ${revisao.rodada})`}
            </span>
          </div>
        )}

        {/* Laudo de rejeição (Brasil) com tradução */}
        {revisao?.motivo_rejeicao && (doc.status === "rejeitado" || doc.status === "contestado") && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 space-y-2">
            <div className="text-[11px] font-medium text-destructive flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Laudo técnico do Brasil
            </div>
            <TextoComTraducao
              texto={revisao.motivo_rejeicao}
              idiomaOrigem={revisao.motivo_idioma_origem}
              traducoes={revisao.motivo_traducoes}
              onCacheTraducao={(p) =>
                salvarTraducao.mutate({
                  revisao_id: revisao.id,
                  submissao_id: doc.submissao_id,
                  campo: "motivo",
                  traducoes: p.traducoes,
                  origem: p.origem,
                })
              }
            />
            {revisao.anexos?.filter((a) => a.lado === "brasil").length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {revisao.anexos.filter((a) => a.lado === "brasil").map((a, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] gap-1"
                    onClick={() => downloadStoragePath(a.path, a.nome)}
                  >
                    <Paperclip className="h-3 w-3" /> {a.nome}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Parecer técnico (China) com tradução */}
        {revisao?.contestacao_texto && (doc.status === "contestado" || doc.status === "pendente") && (
          <div className="rounded-md border border-warning/40 bg-warning/5 p-2 space-y-2">
            <div className="text-[11px] font-medium text-warning-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Parecer técnico da China
            </div>
            <TextoComTraducao
              texto={revisao.contestacao_texto}
              idiomaOrigem={revisao.contestacao_idioma_origem}
              traducoes={revisao.contestacao_traducoes}
              onCacheTraducao={(p) =>
                salvarTraducao.mutate({
                  revisao_id: revisao.id,
                  submissao_id: doc.submissao_id,
                  campo: "contestacao",
                  traducoes: p.traducoes,
                  origem: p.origem,
                })
              }
            />
            {revisao.anexos?.filter((a) => a.lado === "china").length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {revisao.anexos.filter((a) => a.lado === "china").map((a, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] gap-1"
                    onClick={() => downloadStoragePath(a.path, a.nome)}
                  >
                    <Paperclip className="h-3 w-3" /> {a.nome}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Annotations */}
        {anotacoes.length > 0 && (
          <div className="space-y-1">
            {anotacoes.map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground bg-warning/10 rounded px-2 py-1">
                <MessageSquare className="h-3 w-3 mt-0.5 text-warning shrink-0" />
                <span>{a.descricao}</span>
              </div>
            ))}
          </div>
        )}

        {/* Histórico de versões */}
        <Collapsible open={historicoOpen} onOpenChange={setHistoricoOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground gap-1">
              <History className="h-3 w-3" />
              {historicoOpen ? "Ocultar histórico" : "Ver histórico de versões"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-1">
            {versoes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">Nenhuma versão anterior arquivada.</p>
            ) : (
              versoes.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-2 rounded border bg-muted/40 p-2 text-[11px]">
                  <div className="min-w-0">
                    <span className="font-medium">v{v.rodada}</span>
                    <span className="ml-2 text-muted-foreground">{v.status_no_momento}</span>
                    <span className="ml-2 text-muted-foreground">{formatLocalDate(v.enviada_em, "dd/MM HH:mm")}</span>
                    <p className="truncate text-muted-foreground">{v.nome_arquivo}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => downloadStoragePath(v.arquivo_path, v.nome_arquivo)}
                  >
                    Baixar
                  </Button>
                </div>
              ))
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => onView(doc)}>
            <Eye className="h-3 w-3 mr-1" /> Ver 查看
          </Button>

          {showBrasilApproveReject && (
            <>
              <Button variant="success" size="sm" className="text-xs h-7" onClick={() => onAprovar?.(doc)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Aprovar 批准
              </Button>
              <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => setRejectDialog(true)}>
                <XCircle className="h-3 w-3 mr-1" /> Rejeitar 拒绝
              </Button>
            </>
          )}

          {showChinaCiencia && (
            <>
              <Button variant="success" size="sm" className="text-xs h-7" onClick={() => onCiencia?.(doc)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Aceitar / Ciência 确认
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setContestDialog(true)}>
                <AlertTriangle className="h-3 w-3 mr-1" /> Contestar 异议
              </Button>
            </>
          )}

          {showChinaCorrectContest && (
            <Button size="sm" className="text-xs h-7" onClick={() => setSubstituirDialog(true)}>
              <Upload className="h-3 w-3 mr-1" /> Substituir com parecer técnico 提交新文件与技术意见
            </Button>
          )}

          {showBrasilContestedActions && (
            <>
              <Button variant="success" size="sm" className="text-xs h-7" onClick={() => onAprovar?.(doc)}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Aceitar Contestação
              </Button>
              <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => setRejectDialog(true)}>
                <XCircle className="h-3 w-3 mr-1" /> Manter Rejeição
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Novo Reject Dialog (laudo + anexos) */}
      <DialogRejeitarDocumento
        open={rejectDialog}
        onOpenChange={setRejectDialog}
        documentoId={doc.id}
        submissaoId={doc.submissao_id}
        tipoDocumentoLabel={cfg?.labelPt}
      />

      {/* Substituir com parecer (China responde rejeição) */}
      <DialogContestarDocumento
        open={substituirDialog}
        onOpenChange={setSubstituirDialog}
        documentoId={doc.id}
        submissaoId={doc.submissao_id}
        tipoDocumento={doc.tipo_documento}
        tipoDocumentoLabel={cfg?.labelPt}
        laudoRevisao={revisao || null}
      />

      {/* Contest Dialog (somente texto — usado por China em fluxo brasil_envia) */}
      <Dialog open={contestDialog} onOpenChange={setContestDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contestar 异议</DialogTitle>
          </DialogHeader>
          <Textarea value={contestTexto} onChange={e => setContestTexto(e.target.value)} placeholder="Justificativa..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setContestDialog(false)}>Cancelar</Button>
            <Button disabled={!contestTexto.trim()} onClick={() => {
              onContestar?.(doc, contestTexto.trim());
              setContestDialog(false);
              setContestTexto("");
            }}>
              Enviar 提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
