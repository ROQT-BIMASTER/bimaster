import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Workflow, ExternalLink, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useConcluirModuloLink } from "@/hooks/useModuloProcessoLink";
import { cn } from "@/lib/utils";

interface Props {
  registroId: string | undefined | null;
  /** Filtra somente vínculos onde a entidade for este produto */
  className?: string;
  title?: string;
}

interface LinkRow {
  id: string;
  modulo_codigo: string;
  registro_id: string;
  instancia_id: string;
  etapa_id: string;
  status: string;
  etapa_label?: string;
  perfil_nome?: string;
  modulo_label?: string;
  modulo_rota?: string;
  entidade_tipo?: string;
  entidade_id?: string;
}

/**
 * Banner agregador: mostra TODOS os módulos vinculados a este produto/entidade
 * em qualquer processo ativo. Use no detalhe do Produto.
 */
export function ProcessoModulosResumoBanner({ registroId, className, title = "Módulos vinculados ao processo" }: Props) {
  const navigate = useNavigate();
  const concluir = useConcluirModuloLink();

  const { data: links = [], isLoading } = useQuery<LinkRow[]>({
    queryKey: ["modulo-link-by-registro-any", registroId],
    enabled: !!registroId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("modulo_processo_link")
        .select("*")
        .eq("registro_id", registroId)
        .neq("status", "cancelado");
      if (error) throw error;
      const base = (data ?? []) as any[];
      if (base.length === 0) return [];

      const etapaIds = [...new Set(base.map((l) => l.etapa_id))];
      const instIds = [...new Set(base.map((l) => l.instancia_id))];
      const modCodes = [...new Set(base.map((l) => l.modulo_codigo))];

      const [etapasRes, instRes, modRes] = await Promise.all([
        (supabase as any).from("processo_perfil_etapas").select("id, label, perfil_id").in("id", etapaIds),
        (supabase as any).from("processo_instancias").select("id, perfil_id, entidade_tipo, entidade_id").in("id", instIds),
        (supabase as any).from("processo_modulo_catalogo").select("codigo, label, rota").in("codigo", modCodes),
      ]);
      const perfilIds = [...new Set((instRes.data ?? []).map((i: any) => i.perfil_id))];
      const perfisRes = perfilIds.length
        ? await (supabase as any).from("processo_perfis").select("id, nome").in("id", perfilIds)
        : { data: [] };

      const etapaMap = Object.fromEntries((etapasRes.data ?? []).map((e: any) => [e.id, e]));
      const instMap = Object.fromEntries((instRes.data ?? []).map((i: any) => [i.id, i]));
      const modMap = Object.fromEntries((modRes.data ?? []).map((m: any) => [m.codigo, m]));
      const perfilMap = Object.fromEntries((perfisRes.data ?? []).map((p: any) => [p.id, p.nome]));

      return base.map((l) => {
        const e = etapaMap[l.etapa_id];
        const i = instMap[l.instancia_id];
        const m = modMap[l.modulo_codigo];
        return {
          ...l,
          etapa_label: e?.label,
          perfil_nome: i?.perfil_id ? perfilMap[i.perfil_id] : undefined,
          modulo_label: m?.label,
          modulo_rota: m?.rota,
          entidade_tipo: i?.entidade_tipo,
          entidade_id: i?.entidade_id,
        } as LinkRow;
      });
    },
  });

  if (isLoading || !registroId || links.length === 0) return null;

  return (
    <Card className={cn("border-primary/30 bg-primary/5 p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Workflow className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <Badge variant="outline" className="text-[10px]">{links.length}</Badge>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {links.map((l) => (
          <div key={l.id} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
            {l.status === "concluido" ? (
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">
                {l.modulo_label ?? l.modulo_codigo}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                Etapa: {l.etapa_label ?? "—"}{l.perfil_nome ? ` · ${l.perfil_nome}` : ""}
              </div>
            </div>
            {l.modulo_rota && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => navigate(l.modulo_rota!)}
                title="Abrir módulo"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
            {l.status !== "concluido" && (
              <Button
                size="sm"
                variant="success"
                className="h-7 text-[10px] px-2"
                disabled={concluir.isPending}
                onClick={() =>
                  concluir.mutate({
                    modulo_codigo: l.modulo_codigo,
                    registro_id: l.registro_id,
                    etapa_id: l.etapa_id,
                  })
                }
              >
                {concluir.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Concluir"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
