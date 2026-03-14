
import { useState } from "react";
import { AlertTriangle, Upload, MessageSquare, Eye, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BilingualLabel } from "./BilingualLabel";
import { CHINA_DOCUMENT_TYPES } from "@/lib/china-document-types";
import { useRevisoesPorSubmissao, useContestarRevisao } from "@/hooks/useChinaRevisoes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Props {
  submissaoId: string;
  documentos: any[];
  onViewDoc: (doc: any) => void;
  onReupload: (tipo: string, file: File) => void;
}

export function ChinaRevisaoFeedback({ submissaoId, documentos, onViewDoc, onReupload }: Props) {
  const { data: revisoes = [] } = useRevisoesPorSubmissao(submissaoId);
  const contestar = useContestarRevisao();
  const [contestDialog, setContestDialog] = useState<{ revisao: any; doc: any } | null>(null);
  const [contestTexto, setContestTexto] = useState("");
  const [reuploadDoc, setReuploadDoc] = useState<any | null>(null);

  const rejeitados = documentos.filter((d: any) => d.status === "rejeitado");

  if (rejeitados.length === 0) return null;

  const getDocLabel = (tipo: string) => {
    const cfg = CHINA_DOCUMENT_TYPES.find(d => d.tipo === tipo);
    return cfg ? cfg.labelPt : tipo;
  };

  const getDocLabelCn = (tipo: string) => {
    const cfg = CHINA_DOCUMENT_TYPES.find(d => d.tipo === tipo);
    return cfg?.labelCn || "";
  };

  const getLatestRevisao = (docId: string) => {
    return revisoes.find(r => r.documento_id === docId && r.resultado === "rejeitado");
  };

  const handleContestar = () => {
    if (!contestDialog || !contestTexto.trim()) return;
    contestar.mutate({
      revisao_id: contestDialog.revisao.id,
      submissao_id: submissaoId,
      documento_id: contestDialog.doc.id,
      contestacao_texto: contestTexto.trim(),
    });
    setContestDialog(null);
    setContestTexto("");
  };

  const handleFileChange = (doc: any, file: File) => {
    onReupload(doc.tipo_documento, file);
    setReuploadDoc(null);
  };

  return (
    <Card className="p-6 space-y-4 border-destructive/30 bg-destructive/5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <BilingualLabel
          pt={`${rejeitados.length} documento(s) precisam de correção`}
          cn={`${rejeitados.length} 个文件需要修正`}
          size="md"
        />
      </div>

      <div className="space-y-3">
        {rejeitados.map((doc: any) => {
          const revisao = getLatestRevisao(doc.id);
          const anotacoes = (revisao?.anotacoes || []) as any[];

          return (
            <div key={doc.id} className="p-4 border border-destructive/20 rounded-lg bg-card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{getDocLabel(doc.tipo_documento)}</p>
                  <p className="text-[10px] text-muted-foreground">{getDocLabelCn(doc.tipo_documento)}</p>
                  {doc.nome_arquivo && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">📎 {doc.nome_arquivo}</p>
                  )}
                </div>
                {revisao && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    Rodada 轮次 {revisao.rodada}
                  </Badge>
                )}
              </div>

              {/* Rejection reason */}
              {revisao?.motivo_rejeicao && (
                <div className="p-2 bg-destructive/10 rounded text-sm text-destructive font-medium">
                  ❌ {revisao.motivo_rejeicao}
                </div>
              )}

              {/* Annotations */}
              {anotacoes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Erros apontados 标注的错误:</p>
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
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => onViewDoc(doc)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver 查看
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => setReuploadDoc(doc)}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Corrigir e Reenviar 修正并重新提交
                </Button>
                {revisao && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 text-warning border-warning/30 hover:bg-warning/10"
                    onClick={() => setContestDialog({ revisao, doc })}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Contestar 异议
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reupload dialog */}
      <Dialog open={!!reuploadDoc} onOpenChange={(open) => !open && setReuploadDoc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Corrigir e Reenviar 修正并重新提交
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione o arquivo corrigido para <strong>{reuploadDoc && getDocLabel(reuploadDoc.tipo_documento)}</strong>
            </p>
            <input
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && reuploadDoc) handleFileChange(reuploadDoc, f);
              }}
              className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:font-medium file:cursor-pointer"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Contest dialog */}
      <Dialog open={!!contestDialog} onOpenChange={(open) => !open && setContestDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Contestar Rejeição 对拒绝提出异议
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Explique por que o documento está correto ou justifique sua posição.
              请解释为什么文件是正确的或证明您的立场。
            </p>
            <Textarea
              value={contestTexto}
              onChange={(e) => setContestTexto(e.target.value)}
              placeholder="Justificativa da contestação..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContestDialog(null)}>Cancelar</Button>
            <Button
              variant="default"
              onClick={handleContestar}
              disabled={!contestTexto.trim() || contestar.isPending}
              className="gap-1"
            >
              <AlertTriangle className="h-4 w-4" /> Enviar Contestação 提交异议
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
