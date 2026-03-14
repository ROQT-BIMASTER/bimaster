import { useState } from "react";
import { X, ArrowUpRight, ArrowDownLeft, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BilingualLabel } from "./BilingualLabel";
import { ChinaDocCard } from "./ChinaDocCard";
import { ChinaAprovacaoTimeline } from "./ChinaAprovacaoTimeline";
import {
  DOCUMENT_CATEGORIES,
  CATEGORIES_CHINA_ENVIA,
  CATEGORIES_BRASIL_ENVIA,
  CHINA_DOCUMENT_TYPES,
} from "@/lib/china-document-types";
import {
  useRevisoesPorSubmissao,
  useCriarRevisao,
  useContestarRevisao,
} from "@/hooks/useChinaRevisoes";
import { useDarCiencia } from "@/hooks/useChinaRevisoes";

interface Props {
  submissaoId: string;
  produtoNome: string;
  documentos: any[];
  isBrasilUser: boolean;
  isChinaUser: boolean;
  onViewDoc: (doc: any) => void;
  onReupload: (tipo: string, file: File) => void;
  onClose: () => void;
}

export function ChinaPainelAprovacao({
  submissaoId, produtoNome, documentos, isBrasilUser, isChinaUser,
  onViewDoc, onReupload, onClose,
}: Props) {
  const { data: revisoes = [] } = useRevisoesPorSubmissao(submissaoId);
  const criarRevisao = useCriarRevisao();
  const contestar = useContestarRevisao();
  const darCiencia = useDarCiencia();

  const getLatestRevisao = (docId: string) => {
    return revisoes.find(r => r.documento_id === docId);
  };

  const handleAprovar = (doc: any) => {
    criarRevisao.mutate({
      documento_id: doc.id,
      submissao_id: submissaoId,
      resultado: "aprovado",
      acao_tipo: "aprovar",
    });
  };

  const handleRejeitar = (doc: any, motivo: string, anotacoes: any[]) => {
    criarRevisao.mutate({
      documento_id: doc.id,
      submissao_id: submissaoId,
      resultado: "rejeitado",
      motivo_rejeicao: motivo,
      anotacoes,
      acao_tipo: "rejeitar",
    });
  };

  const handleCiencia = (doc: any) => {
    darCiencia.mutate({
      documento_id: doc.id,
      submissao_id: submissaoId,
    });
  };

  const handleContestar = (doc: any, texto: string) => {
    const rev = getLatestRevisao(doc.id);
    if (rev) {
      contestar.mutate({
        revisao_id: rev.id,
        submissao_id: submissaoId,
        documento_id: doc.id,
        contestacao_texto: texto,
      });
    }
  };

  // Stats
  const totalDocs = documentos.length;
  const aprovados = documentos.filter(d => d.status === "aprovado" || d.status === "ciencia").length;
  const pct = totalDocs > 0 ? Math.round((aprovados / totalDocs) * 100) : 0;

  const renderColumn = (
    categories: typeof DOCUMENT_CATEGORIES,
    fluxo: "china_envia" | "brasil_envia",
    headerPt: string,
    headerCn: string,
    icon: React.ReactNode,
    colorClass: string,
  ) => {
    return (
      <div className="space-y-4">
        {/* Column header */}
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${colorClass} font-bold text-sm`}>
          {icon}
          <span>{headerPt}</span>
          <span className="font-normal text-xs opacity-75">{headerCn}</span>
        </div>

        {categories.map(cat => {
          const catDocs = documentos.filter(d => cat.tipos.includes(d.tipo_documento));
          if (catDocs.length === 0) {
            // Show empty placeholder for types in this category
            const types = CHINA_DOCUMENT_TYPES.filter(t => cat.tipos.includes(t.tipo));
            if (types.length === 0) return null;
            return (
              <div key={cat.key} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground px-1">
                  {cat.labelPt} <span className="font-normal">{cat.labelCn}</span>
                </p>
                <div className="p-3 border border-dashed rounded-lg text-xs text-muted-foreground text-center">
                  Nenhum documento enviado 尚未发送文件
                </div>
              </div>
            );
          }

          return (
            <div key={cat.key} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground px-1">
                {cat.labelPt} <span className="font-normal">{cat.labelCn}</span>
              </p>
              {catDocs.map(doc => (
                <ChinaDocCard
                  key={doc.id}
                  doc={doc}
                  fluxo={fluxo}
                  revisao={getLatestRevisao(doc.id)}
                  isBrasilUser={isBrasilUser}
                  isChinaUser={isChinaUser}
                  onView={onViewDoc}
                  onAprovar={handleAprovar}
                  onRejeitar={handleRejeitar}
                  onCiencia={handleCiencia}
                  onContestar={handleContestar}
                  onReupload={onReupload}
                />
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BilingualLabel pt="Painel de Aprovação" cn="审批面板" size="lg" />
            <span className="text-sm text-muted-foreground truncate">— {produtoNome}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{pct}%</span>
              <Progress value={pct} gradient className="h-2 w-24" />
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Dual columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderColumn(
            CATEGORIES_CHINA_ENVIA,
            "china_envia",
            "China → Brasil",
            "中国 → 巴西",
            <ArrowUpRight className="h-4 w-4" />,
            "bg-primary/10 text-primary border-primary/30",
          )}
          {renderColumn(
            CATEGORIES_BRASIL_ENVIA,
            "brasil_envia",
            "Brasil → China",
            "巴西 → 中国",
            <ArrowDownLeft className="h-4 w-4" />,
            "bg-success/10 text-success border-success/30",
          )}
        </div>

        {/* Timeline */}
        <Card className="p-4">
          <ChinaAprovacaoTimeline revisoes={revisoes} />
        </Card>
      </div>
    </div>
  );
}
