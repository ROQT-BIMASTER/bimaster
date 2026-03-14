
import { useState } from "react";
import { CheckCircle2, XCircle, Eye, MessageSquare, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { BilingualLabel } from "./BilingualLabel";
import { CHINA_DOCUMENT_TYPES, DOCUMENT_CATEGORIES } from "@/lib/china-document-types";
import { useCriarRevisao, useRevisoesPorSubmissao, type Anotacao } from "@/hooks/useChinaRevisoes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const MOTIVOS_REJEICAO = [
  { value: "imagem_ilegivel", label: "Imagem ilegível 图片不清晰" },
  { value: "dados_incorretos", label: "Dados incorretos 数据不正确" },
  { value: "documento_errado", label: "Documento errado 文件错误" },
  { value: "informacao_faltante", label: "Informação faltante 信息缺失" },
  { value: "outro", label: "Outro 其他" },
];

interface Props {
  submissaoId: string;
  documentos: any[];
  onViewDoc: (doc: any) => void;
}

type FilterStatus = "todos" | "pendente" | "rejeitado" | "aprovado" | "contestado";

export function ChinaRevisaoPanel({ submissaoId, documentos, onViewDoc }: Props) {
  const [filter, setFilter] = useState<FilterStatus>("todos");
  const [rejectDialog, setRejectDialog] = useState<any | null>(null);
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [newAnotacao, setNewAnotacao] = useState("");

  const { data: revisoes = [] } = useRevisoesPorSubmissao(submissaoId);
  const criarRevisao = useCriarRevisao();

  const enviadosDocs = documentos.filter((d: any) =>
    ["pendente", "enviado", "rejeitado", "aprovado", "contestado"].includes(d.status)
  );

  const filtered = filter === "todos"
    ? enviadosDocs
    : enviadosDocs.filter((d: any) => d.status === filter);

  const aprovados = enviadosDocs.filter((d: any) => d.status === "aprovado").length;
  const total = enviadosDocs.length;
  const pctAprovado = total > 0 ? Math.round((aprovados / total) * 100) : 0;

  const handleAprovar = (doc: any) => {
    criarRevisao.mutate({
      documento_id: doc.id,
      submissao_id: submissaoId,
      resultado: "aprovado",
    });
  };

  const handleRejeitar = () => {
    if (!rejectDialog || !motivo) return;
    criarRevisao.mutate({
      documento_id: rejectDialog.id,
      submissao_id: submissaoId,
      resultado: "rejeitado",
      motivo_rejeicao: motivo,
      anotacoes: anotacoes.length > 0
        ? anotacoes
        : observacao
          ? [{ tipo: "observacao", descricao: observacao }]
          : [],
    });
    setRejectDialog(null);
    setMotivo("");
    setObservacao("");
    setAnotacoes([]);
  };

  const addAnotacao = () => {
    if (!newAnotacao.trim()) return;
    setAnotacoes(prev => [...prev, { tipo: "erro", descricao: newAnotacao.trim() }]);
    setNewAnotacao("");
  };

  const getDocLabel = (tipo: string) => {
    const cfg = CHINA_DOCUMENT_TYPES.find(d => d.tipo === tipo);
    return cfg ? `${cfg.labelPt}` : tipo;
  };

  const getDocLabelCn = (tipo: string) => {
    const cfg = CHINA_DOCUMENT_TYPES.find(d => d.tipo === tipo);
    return cfg?.labelCn || "";
  };

  const getLatestRevisao = (docId: string) => {
    return revisoes.find(r => r.documento_id === docId);
  };

  const filterButtons: { key: FilterStatus; label: string; count: number }[] = [
    { key: "todos", label: "Todos 全部", count: enviadosDocs.length },
    { key: "pendente", label: "Pendentes 待审", count: enviadosDocs.filter(d => d.status === "pendente" || d.status === "enviado").length },
    { key: "rejeitado", label: "Rejeitados 被拒", count: enviadosDocs.filter(d => d.status === "rejeitado").length },
    { key: "aprovado", label: "Aprovados 已批", count: enviadosDocs.filter(d => d.status === "aprovado").length },
    { key: "contestado", label: "Contestados 异议", count: enviadosDocs.filter(d => d.status === "contestado").length },
  ];

  if (enviadosDocs.length === 0) return null;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <BilingualLabel pt="Painel de Revisão" cn="审核面板" size="md" />
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{aprovados}/{total} aprovados</p>
          <Progress value={pctAprovado} className="w-32 h-2 mt-1" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filterButtons.map(f => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key)}
            className="text-xs"
          >
            {f.label} ({f.count})
          </Button>
        ))}
      </div>

      {/* Document list grouped by category */}
      <div className="space-y-4">
        {DOCUMENT_CATEGORIES.map(cat => {
          const catDocs = filtered.filter((d: any) => cat.tipos.includes(d.tipo_documento));
          if (catDocs.length === 0) return null;

          return (
            <div key={cat.key} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {cat.labelPt} {cat.labelCn}
              </p>
              <div className="space-y-2">
                {catDocs.map((doc: any) => {
                  const latestRevisao = getLatestRevisao(doc.id);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {getDocLabel(doc.tipo_documento)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{getDocLabelCn(doc.tipo_documento)}</p>
                        {doc.nome_arquivo && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">📎 {doc.nome_arquivo}</p>
                        )}
                        {latestRevisao && latestRevisao.resultado === "rejeitado" && (
                          <p className="text-[10px] text-destructive mt-1">
                            Rodada {latestRevisao.rodada} — {latestRevisao.motivo_rejeicao}
                          </p>
                        )}
                        {latestRevisao && latestRevisao.resultado === "contestado" && (
                          <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Contestado: {latestRevisao.contestacao_texto}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={
                          doc.status === "aprovado" ? "success"
                          : doc.status === "rejeitado" ? "destructive"
                          : doc.status === "contestado" ? "warning"
                          : "secondary"
                        }
                        className="text-[10px] shrink-0"
                      >
                        {doc.status}
                      </Badge>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onViewDoc(doc)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(doc.status === "pendente" || doc.status === "enviado" || doc.status === "contestado") && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-success hover:text-success"
                              onClick={() => handleAprovar(doc)}
                              disabled={criarRevisao.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => setRejectDialog(doc)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Rejeitar Documento 拒绝文件
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Motivo 原因 *</label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_REJEICAO.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Observação detalhada 详细说明</label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Descreva o problema..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Anotações / Erros 标注/错误
              </label>
              {anotacoes.map((a, i) => (
                <div key={i} className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-foreground flex-1 bg-destructive/10 rounded px-2 py-1">
                    {a.descricao}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setAnotacoes(prev => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <Textarea
                  value={newAnotacao}
                  onChange={(e) => setNewAnotacao(e.target.value)}
                  placeholder="Adicionar anotação..."
                  rows={1}
                  className="text-xs"
                />
                <Button variant="outline" size="icon" className="shrink-0" onClick={addAnotacao}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRejeitar} disabled={!motivo || criarRevisao.isPending}>
              <XCircle className="h-4 w-4 mr-1" /> Confirmar Rejeição 确认拒绝
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
