import { useState } from "react";
import { Eye, CheckCircle2, XCircle, RotateCcw, AlertTriangle, MessageSquare, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BilingualLabel } from "./BilingualLabel";
import { CHINA_DOCUMENT_TYPES, STATUS_LABELS } from "@/lib/china-document-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatLocalDate } from "@/utils/dateUtils";
import type { Revisao } from "@/hooks/useChinaRevisoes";

interface ChinaDocCardProps {
  doc: any;
  fluxo: "china_envia" | "brasil_envia";
  revisao?: Revisao | null;
  isBrasilUser: boolean;
  isChinaUser: boolean;
  onView: (doc: any) => void;
  onAprovar?: (doc: any) => void;
  onRejeitar?: (doc: any, motivo: string, anotacoes: any[]) => void;
  onCiencia?: (doc: any) => void;
  onContestar?: (doc: any, texto: string) => void;
  onReupload?: (tipo: string, file: File) => void;
}

export function ChinaDocCard({
  doc, fluxo, revisao, isBrasilUser, isChinaUser,
  onView, onAprovar, onRejeitar, onCiencia, onContestar, onReupload,
}: ChinaDocCardProps) {
  const [rejectDialog, setRejectDialog] = useState(false);
  const [contestDialog, setContestDialog] = useState(false);
  const [reuploadDialog, setReuploadDialog] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [contestTexto, setContestTexto] = useState("");

  const cfg = CHINA_DOCUMENT_TYPES.find(d => d.tipo === doc.tipo_documento);
  const statusInfo = STATUS_LABELS[doc.status] || STATUS_LABELS.rascunho;
  const anotacoes = (revisao?.anotacoes || []) as any[];

  const borderColor = fluxo === "china_envia" ? "border-l-primary" : "border-l-success";

  // Determine available actions
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

        {/* Rejection reason */}
        {revisao?.motivo_rejeicao && doc.status === "rejeitado" && (
          <div className="p-2 bg-destructive/10 rounded text-xs text-destructive font-medium">
            ❌ {revisao.motivo_rejeicao}
          </div>
        )}

        {/* Contest text */}
        {revisao?.contestacao_texto && doc.status === "contestado" && (
          <div className="p-2 bg-warning/10 rounded text-xs text-warning font-medium">
            ⚠️ {revisao.contestacao_texto}
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
            <>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setReuploadDialog(true)}>
                <RotateCcw className="h-3 w-3 mr-1" /> Corrigir 修正
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-7 text-warning border-warning/30" onClick={() => setContestDialog(true)}>
                <AlertTriangle className="h-3 w-3 mr-1" /> Contestar 异议
              </Button>
            </>
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

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Documento 拒绝文件</DialogTitle>
          </DialogHeader>
          <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo da rejeição..." rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={!motivo.trim()} onClick={() => {
              onRejeitar?.(doc, motivo.trim(), []);
              setRejectDialog(false);
              setMotivo("");
            }}>
              Rejeitar 拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contest Dialog */}
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

      {/* Reupload Dialog */}
      <Dialog open={reuploadDialog} onOpenChange={setReuploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Corrigir e Reenviar 修正并重新提交</DialogTitle>
          </DialogHeader>
          <input
            type="file"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) { onReupload?.(doc.tipo_documento, f); setReuploadDialog(false); }
            }}
            className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:font-medium file:cursor-pointer"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
