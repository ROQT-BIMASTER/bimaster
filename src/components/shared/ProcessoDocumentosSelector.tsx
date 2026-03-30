import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  FileText, Loader2, Eye, GitBranch, Users, Circle, CheckCircle2,
  Download, CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

export interface ProcessoDoc {
  id: string;
  tipo_documento: string;
  nome_arquivo: string | null;
  arquivo_url: string | null;
  arquivo_path: string | null;
  status: string;
  checklists: string[];
  despacho: {
    id: string;
    workflow_config_id: string | null;
    modulo_destino: string;
    status: string;
    etapa_atual: number;
    workflow: {
      nome: string;
      tipo_documento: string;
      etapas: any[];
    } | null;
  } | null;
}

interface Recebimento {
  id: string;
  documento_id: string;
  confirmado_por: string;
  confirmado_em: string;
}

interface Props {
  submissaoId: string;
  moduloDestino?: string;
  onSelectDoc: (doc: ProcessoDoc) => void;
  className?: string;
}

export function ProcessoDocumentosSelector({ submissaoId, moduloDestino, onSelectDoc, className }: Props) {
  const [docs, setDocs] = useState<ProcessoDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [recebimentos, setRecebimentos] = useState<Record<string, Recebimento>>({});
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const { user } = useAuth();

  const loadDocs = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const { data: vinculos } = await (supabase
        .from("china_documento_tarefa_vinculos" as any)
        .select("documento_id, projeto:projetos(nome), secao:projeto_secoes(nome)") as any);

      if (!vinculos || vinculos.length === 0) {
        setDocs([]);
        setLoaded(true);
        return;
      }

      const docChecklistMap: Record<string, string[]> = {};
      (vinculos as any[]).forEach((v: any) => {
        const labels: string[] = [];
        if (v.projeto?.nome) labels.push(v.projeto.nome);
        if (v.secao?.nome) labels.push(v.secao.nome);
        const label = labels.join(" › ") || "Vinculado";
        if (!docChecklistMap[v.documento_id]) docChecklistMap[v.documento_id] = [];
        if (!docChecklistMap[v.documento_id].includes(label)) {
          docChecklistMap[v.documento_id].push(label);
        }
      });

      const docIds = Object.keys(docChecklistMap);

      const [docsRes, despachoRes, recebimentosRes] = await Promise.all([
        supabase
          .from("china_produto_documentos")
          .select("id, tipo_documento, nome_arquivo, arquivo_url, arquivo_path, status")
          .eq("submissao_id", submissaoId)
          .in("id", docIds)
          .order("created_at", { ascending: false }),
        ((() => {
          let q = supabase
            .from("process_despacho_documento" as any)
            .select("id, documento_id, workflow_config_id, modulo_destino, status, etapa_atual")
            .in("documento_id", docIds);
          if (moduloDestino) q = q.eq("modulo_destino", moduloDestino);
          return q;
        })() as any),
        (supabase
          .from("processo_documento_recebimentos" as any)
          .select("id, documento_id, confirmado_por, confirmado_em")
          .eq("submissao_id", submissaoId) as any),
      ]);

      // Map recebimentos by documento_id
      const recMap: Record<string, Recebimento> = {};
      ((recebimentosRes.data || []) as Recebimento[]).forEach((r) => {
        recMap[r.documento_id] = r;
      });
      setRecebimentos(recMap);

      const data = docsRes.data;
      const despachos = despachoRes.data;

      // Fetch workflow configs
      let workflowMap: Record<string, any> = {};
      if (despachos && despachos.length > 0) {
        const configIds = [...new Set((despachos as any[]).map((d: any) => d.workflow_config_id).filter(Boolean))];
        if (configIds.length > 0) {
          const [configRes, etapasRes] = await Promise.all([
            (supabase.from("process_doc_workflow_config" as any).select("id, nome, tipo_documento").in("id", configIds) as any),
            (supabase.from("process_doc_workflow_etapas" as any).select("*").in("config_id", configIds).order("ordem") as any),
          ]);
          const configs = (configRes.data || []) as any[];
          const etapas = (etapasRes.data || []) as any[];
          configs.forEach((cfg: any) => {
            workflowMap[cfg.id] = {
              nome: cfg.nome,
              tipo_documento: cfg.tipo_documento,
              etapas: etapas.filter((e: any) => e.config_id === cfg.id),
            };
          });
        }
      }

      const despachoMap: Record<string, any> = {};
      (despachos as any[] || []).forEach((d: any) => {
        despachoMap[d.documento_id] = {
          id: d.id,
          workflow_config_id: d.workflow_config_id,
          modulo_destino: d.modulo_destino,
          status: d.status,
          etapa_atual: d.etapa_atual,
          workflow: d.workflow_config_id ? workflowMap[d.workflow_config_id] || null : null,
        };
      });

      const docsWithMeta: ProcessoDoc[] = (data || []).map((doc: any) => ({
        ...doc,
        checklists: docChecklistMap[doc.id] || [],
        despacho: despachoMap[doc.id] || null,
      }));

      const filtered = moduloDestino
        ? docsWithMeta.filter(d => d.despacho !== null)
        : docsWithMeta;

      setDocs(filtered);
      setLoaded(true);
    } catch {
      toast.error("Erro ao carregar documentos do processo");
    } finally {
      setLoading(false);
    }
  }, [submissaoId, moduloDestino, loaded]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleVerDocumento = async (doc: ProcessoDoc) => {
    try {
      let url = doc.arquivo_url;
      if (doc.arquivo_path) {
        const { signedUrl } = await getSignedUrl("china-documentos", doc.arquivo_path);
        if (signedUrl) url = signedUrl;
      }
      if (url) {
        window.open(url, "_blank");
      } else {
        toast.error("Arquivo não encontrado");
      }
    } catch {
      toast.error("Erro ao abrir documento");
    }
  };

  const handleConfirmarRecebimento = async (doc: ProcessoDoc) => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }
    setConfirmando(doc.id);
    try {
      const { error } = await (supabase
        .from("processo_documento_recebimentos" as any)
        .insert({
          documento_id: doc.id,
          submissao_id: submissaoId,
          confirmado_por: user.id,
        }) as any);

      if (error) {
        if (error.code === "23505") {
          toast.info("Recebimento já confirmado anteriormente");
        } else {
          throw error;
        }
      } else {
        toast.success("Recebimento confirmado com sucesso");
      }

      // Refresh recebimentos
      const { data: updated } = await (supabase
        .from("processo_documento_recebimentos" as any)
        .select("id, documento_id, confirmado_por, confirmado_em")
        .eq("submissao_id", submissaoId) as any);

      const recMap: Record<string, Recebimento> = {};
      ((updated || []) as Recebimento[]).forEach((r) => {
        recMap[r.documento_id] = r;
      });
      setRecebimentos(recMap);
    } catch {
      toast.error("Erro ao confirmar recebimento");
    } finally {
      setConfirmando(null);
    }
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">Nenhum documento vinculado ao processo</p>
        <p className="text-xs mt-1">Use a tela <strong>Vincular China</strong> para despachar documentos para este módulo.</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-[400px]", className)}>
      <div className="space-y-2">
        {docs.map((doc) => {
          const rec = recebimentos[doc.id];
          const isConfirmado = !!rec;

          return (
            <Card key={doc.id} className={cn(
              "transition-colors",
              isConfirmado && "border-emerald-500/30 bg-emerald-500/5"
            )}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.nome_arquivo || doc.tipo_documento}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-xs text-muted-foreground">{doc.tipo_documento}</span>
                      {doc.checklists?.map((cl, i) => (
                        <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-normal">
                          {cl}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{doc.status}</Badge>
                </div>

                {isConfirmado && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 rounded px-2 py-1">
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Recebido em {format(new Date(rec.confirmado_em), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleVerDocumento(doc)}
                    className="gap-1.5 text-xs"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Ver Documento
                  </Button>

                  {!isConfirmado && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleConfirmarRecebimento(doc)}
                      disabled={confirmando === doc.id}
                      className="gap-1.5 text-xs"
                    >
                      {confirmando === doc.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCheck className="h-3.5 w-3.5" />
                      )}
                      Confirmar Recebimento
                    </Button>
                  )}

                  <Button size="sm" variant="ghost" onClick={() => onSelectDoc(doc)} className="gap-1.5 text-xs">
                    <Eye className="h-3.5 w-3.5" />
                    Detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
}
/** Displays the workflow/stage info for a selected process document */
export function ProcessoEtapaInfo({ despacho }: { despacho: ProcessoDoc["despacho"] }) {
  if (!despacho?.workflow) return null;

  const { workflow, etapa_atual } = despacho;
  const etapas = workflow.etapas || [];
  const totalEtapas = etapas.length;
  const completedCount = etapas.filter((e: any) => e.ordem < (etapa_atual ?? 0)).length;
  const progressPct = totalEtapas > 0 ? Math.round(((completedCount + ((etapa_atual ?? 0) < totalEtapas ? 0.5 : 0)) / totalEtapas) * 100) : 0;

  return (
    <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2">
        <GitBranch className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Fluxo de Aprovação Vinculado</p>
            <Badge variant="default" className="text-[10px] h-5">{workflow.nome}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Documento segue o fluxo de aprovação configurado. As regras são imutáveis.
          </p>

          {etapas.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Progresso do fluxo</span>
                <span className="ml-auto">{completedCount}/{totalEtapas} etapas</span>
              </div>
              <Progress value={progressPct} className="h-1.5" />

              <div className="space-y-1.5 mt-2">
                {etapas.map((etapa: any, idx: number) => {
                  const isCompleted = etapa.ordem < (etapa_atual ?? 0);
                  const isCurrent = etapa.ordem === (etapa_atual ?? 0);
                  const isPending = etapa.ordem > (etapa_atual ?? 0);

                  return (
                    <div
                      key={etapa.id || idx}
                      className={cn(
                        "flex items-center gap-2 text-xs rounded px-2.5 py-1.5",
                        isCurrent ? "bg-primary/10 border border-primary/30 font-medium" :
                        isCompleted ? "bg-emerald-500/5 border border-emerald-500/20" :
                        "bg-muted/50"
                      )}
                    >
                      {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                      {isCurrent && <Circle className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />}
                      {isPending && <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}

                      <span className="flex-1">{etapa.nome}</span>

                      <Badge variant="outline" className="text-[9px] h-4 px-1.5">{etapa.tipo_acao}</Badge>
                      {etapa.aprovadores_nomes?.length > 0 && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {etapa.aprovadores_nomes.join(", ")}
                        </span>
                      )}
                      {isCompleted && <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700">Concluída</Badge>}
                      {isCurrent && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Etapa atual</Badge>}
                      {isPending && <span className="text-[9px] text-muted-foreground">Pendente</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
