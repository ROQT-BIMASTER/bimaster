// src/components/briefings/cofre/CofreTab.tsx
import { useMemo, useState } from "react";
import { Plus, FolderOpen, FileCheck2, Truck, Package, ListChecks, Send, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  useBriefingDocumentos, useChecklistTemplates, useAplicarTemplate,
  useAtualizarDocumento, useExcluirDocumento,
  CATEGORIA_LABELS, STATUS_LABELS,
  type BriefingDocumento, type BriefingDocStatus,
} from "@/hooks/useBriefingCofre";
import { DocumentoCard } from "./DocumentoCard";
import { UploadDocumentoDialog } from "./UploadDocumentoDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  briefingId: string;
  tipoBriefing: string;
}

type EixoTab = "categoria" | "status" | "fornecedor" | "lote";

function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const it of arr) {
    const k = key(it) || "—";
    (out[k] ??= []).push(it);
  }
  return out;
}

export function CofreTab({ briefingId, tipoBriefing }: Props) {
  const { data: docs = [], isLoading } = useBriefingDocumentos(briefingId);
  const { data: templates = [] } = useChecklistTemplates(tipoBriefing);
  const aplicar = useAplicarTemplate(briefingId);
  const atualizar = useAtualizarDocumento(briefingId);
  const excluir = useExcluirDocumento(briefingId);

  const [eixo, setEixo] = useState<EixoTab>("categoria");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [alvo, setAlvo] = useState<BriefingDocumento | null>(null);
  const [templateSel, setTemplateSel] = useState<string | undefined>();
  const [enviandoNotion, setEnviandoNotion] = useState(false);

  const stats = useMemo(() => {
    const aprovados = docs.filter((d) => d.status === "aprovado").length;
    const pendentes = docs.filter((d) => d.status === "pendente").length;
    return { total: docs.length, aprovados, pendentes };
  }, [docs]);

  const grupos = useMemo(() => {
    const keyFn: Record<EixoTab, (d: BriefingDocumento) => string> = {
      categoria: (d) => CATEGORIA_LABELS[d.categoria] || d.categoria,
      status: (d) => STATUS_LABELS[d.status],
      fornecedor: (d) => d.fornecedor_nome || "Sem fornecedor",
      lote: (d) => d.lote || "Sem lote",
    };
    return groupBy(docs, keyFn[eixo]);
  }, [docs, eixo]);

  const abrirUpload = (doc?: BriefingDocumento | null) => {
    setAlvo(doc ?? null);
    setUploadOpen(true);
  };

  const enviarParaNotion = async () => {
    setEnviandoNotion(true);
    try {
      const { data, error } = await supabase.functions.invoke("notion-export-briefing", {
        body: { briefing_id: briefingId, bimaster_origin: window.location.origin, incluir_documentos: true },
      });
      if (error || !(data as any)?.ok) {
        throw new Error((data as any)?.message || error?.message || "Falha no envio");
      }
      toast.success("Briefing e documentos enviados para o Notion");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar para o Notion");
    } finally {
      setEnviandoNotion(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-6">Carregando cofre...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header com stats + ações */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Cofre de documentos</h3>
              <p className="text-[11px] text-muted-foreground">
                {stats.total} documento{stats.total !== 1 ? "s" : ""} ·{" "}
                {stats.aprovados} aprovado{stats.aprovados !== 1 ? "s" : ""} ·{" "}
                {stats.pendentes} pendente{stats.pendentes !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <>
                <Select value={templateSel} onValueChange={setTemplateSel}>
                  <SelectTrigger className="h-8 text-xs w-[200px]">
                    <SelectValue placeholder="Aplicar checklist..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <ListChecks className="h-3 w-3" /> {t.nome}
                          <span className="text-muted-foreground">
                            ({t.itens?.length ?? 0})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm" variant="outline" className="h-8"
                  disabled={!templateSel || aplicar.isPending}
                  onClick={() => templateSel && aplicar.mutate(templateSel)}
                >
                  Aplicar
                </Button>
              </>
            )}
            <Button size="sm" className="h-8" onClick={() => abrirUpload(null)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Novo documento
            </Button>
            <Button
              size="sm" variant="outline" className="h-8"
              onClick={enviarParaNotion} disabled={enviandoNotion || docs.length === 0}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              {enviandoNotion ? "Enviando..." : "Enviar ao Notion"}
            </Button>
          </div>
        </div>

        {stats.total > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Progresso de aprovação</span>
              <span className="tabular-nums">
                {stats.aprovados}/{stats.total}
              </span>
            </div>
            <Progress value={(stats.aprovados / stats.total) * 100} className="h-1.5" />
          </div>
        )}
      </div>

      {/* Tabs de eixo */}
      <Tabs value={eixo} onValueChange={(v) => setEixo(v as EixoTab)}>
        <TabsList className="bg-muted/40">
          <TabsTrigger value="categoria" className="text-xs gap-1">
            <FolderOpen className="h-3 w-3" /> Categoria
          </TabsTrigger>
          <TabsTrigger value="status" className="text-xs gap-1">
            <FileCheck2 className="h-3 w-3" /> Status
          </TabsTrigger>
          <TabsTrigger value="fornecedor" className="text-xs gap-1">
            <Truck className="h-3 w-3" /> Fornecedor
          </TabsTrigger>
          <TabsTrigger value="lote" className="text-xs gap-1">
            <Package className="h-3 w-3" /> Lote / entrega
          </TabsTrigger>
        </TabsList>

        <TabsContent value={eixo} className="mt-4">
          {docs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
              <p className="text-sm font-medium">Nenhum documento ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Aplique um checklist ou clique em <strong>Novo documento</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(grupos)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([grupo, items]) => (
                  <div key={grupo}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {grupo}
                      </h4>
                      <span className="text-[10px] text-muted-foreground">
                        {items.length} doc{items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {items.map((d) => (
                        <DocumentoCard
                          key={d.id}
                          doc={d}
                          onAnexarArquivo={abrirUpload}
                          onMudarStatus={(doc, status) =>
                            atualizar.mutate({ id: doc.id, patch: { status } })
                          }
                          onExcluir={(doc) => {
                            if (confirm(`Excluir "${doc.nome}"?`)) excluir.mutate(doc);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <UploadDocumentoDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        briefingId={briefingId}
        documentoAlvo={alvo}
      />
    </div>
  );
}
