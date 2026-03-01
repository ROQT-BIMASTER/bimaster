import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Clock, User, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveStorageUrl } from "@/lib/utils/storage-url";
import { toast } from "sonner";

interface Props {
  produtoId: string;
  configId: string;
}

interface RevisaoComRequisitos {
  id: string;
  versao: number;
  status: string;
  submetido_em: string;
  revisado_em: string | null;
  parecer: string | null;
  requisitos: any[];
}

export function RequisitosHistoricoTimeline({ produtoId, configId }: Props) {
  const [revisoes, setRevisoes] = useState<RevisaoComRequisitos[]>([]);
  const [evidenciasPorReq, setEvidenciasPorReq] = useState<Record<string, any[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const carregarHistorico = useCallback(async () => {
    setLoading(true);
    try {
      // Buscar todas as revisões do config
      const { data: revs } = await supabase
        .from("fabrica_ficha_custo_revisoes")
        .select("id, versao, status, submetido_em, revisado_em, parecer")
        .eq("config_id", configId)
        .order("versao", { ascending: false });

      if (!revs || revs.length === 0) { setRevisoes([]); return; }

      // Buscar todos os requisitos dessas revisões
      const revisaoIds = revs.map(r => r.id);
      const { data: reqs } = await supabase
        .from("fabrica_revisao_requisitos" as any)
        .select("*")
        .in("revisao_id", revisaoIds);

      // Buscar evidências vinculadas a requisitos
      if (reqs && reqs.length > 0) {
        const reqIds = (reqs as any[]).map(r => r.id);
        const { data: evs } = await supabase
          .from("fabrica_custo_evidencias" as any)
          .select("*")
          .in("requisito_id", reqIds);
        if (evs) {
          const map: Record<string, any[]> = {};
          (evs as any[]).forEach(ev => {
            if (!map[ev.requisito_id]) map[ev.requisito_id] = [];
            map[ev.requisito_id].push(ev);
          });
          setEvidenciasPorReq(map);
        }
      }

      // Agrupar requisitos por revisão
      const reqMap = new Map<string, any[]>();
      (reqs as any[] || []).forEach(r => {
        if (!reqMap.has(r.revisao_id)) reqMap.set(r.revisao_id, []);
        reqMap.get(r.revisao_id)!.push(r);
      });

      setRevisoes(revs.map(r => ({
        ...r,
        requisitos: reqMap.get(r.id) || [],
      })));
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoading(false);
    }
  }, [configId]);

  useEffect(() => { carregarHistorico(); }, [carregarHistorico]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "pendente": return { label: "Pendente", variant: "warning" as const };
      case "aprovada": return { label: "Aprovada", variant: "success" as const };
      case "revisao_solicitada": return { label: "Revisão Solicitada", variant: "destructive" as const };
      case "rejeitada": return { label: "Rejeitada", variant: "destructive" as const };
      default: return { label: s, variant: "secondary" as const };
    }
  };

  const reqStatus = (req: any) => {
    if (req.cumprido) return { label: "✓ Cumprido", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" };
    if (req.contestado) return { label: "⚖ Contestado", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" };
    return { label: "Pendente", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" };
  };

  // Filtrar revisões que têm requisitos
  const revisoesComRequisitos = revisoes.filter(r => r.requisitos.length > 0);

  if (loading) return null;
  if (revisoesComRequisitos.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Histórico de Solicitações da Diretoria
          <Badge variant="secondary" className="text-[10px]">{revisoesComRequisitos.length} revisão(ões)</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {revisoesComRequisitos.map((rev) => {
          const isOpen = expanded.has(rev.id);
          const st = statusLabel(rev.status);

          return (
            <Collapsible key={rev.id} open={isOpen} onOpenChange={() => toggleExpand(rev.id)}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors text-left">
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">Versão {rev.versao}</span>
                    <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(rev.submetido_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{rev.requisitos.length} requisito(s)</span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-6 mt-2 space-y-2 pb-2">
                  {rev.parecer && (
                    <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                      <strong>Parecer:</strong> {rev.parecer}
                    </div>
                  )}
                  {rev.requisitos.map((req: any) => {
                    const rs = reqStatus(req);
                    const evs = evidenciasPorReq[req.id] || [];
                    return (
                      <div key={req.id} className="p-3 rounded border bg-background space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${rs.cls}`}>{rs.label}</span>
                          <span className="text-sm flex-1">{req.descricao}</span>
                        </div>
                        {req.criado_por_nome && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            Solicitado por <strong>{req.criado_por_nome}</strong>
                            {req.created_at && (
                              <span>em {new Date(req.created_at).toLocaleDateString("pt-BR")}</span>
                            )}
                          </div>
                        )}
                        {req.contestado && req.contestacao_motivo && (
                          <div className="text-xs bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
                            <strong>Defesa:</strong> {req.contestacao_motivo}
                          </div>
                        )}
                        {req.cumprido && req.resolucao_descricao && (
                          <div className="text-xs bg-green-50 dark:bg-green-950/20 p-2 rounded">
                            <strong>Resolução:</strong> {req.resolucao_descricao}
                          </div>
                        )}
                        {evs.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase">Evidências vinculadas</span>
                            {evs.map((ev: any) => (
                              <div key={ev.id} className="flex items-center gap-2 text-xs bg-muted/30 p-1.5 rounded">
                                <FileText className="h-3 w-3 text-muted-foreground" />
                                <span className="flex-1 truncate">{ev.nome_arquivo}</span>
                                <span className="text-muted-foreground">{ev.usuario_nome}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={async () => {
                                    const { signedUrl, error } = await resolveStorageUrl(ev.url_arquivo);
                                    if (error || !signedUrl) { toast.error(error || "Erro ao abrir"); return; }
                                    window.open(signedUrl, "_blank");
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
