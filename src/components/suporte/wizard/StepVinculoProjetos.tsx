import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  processoId: string;
}

type EtapaRow = {
  id: string;
  ordem: number;
  nome_override: string | null;
  rotina_fixa_id: string;
  rotina_titulo: string;
  fila_nome: string | null;
  projeto_id_espelho: string | null;
};

/**
 * Passo 4 — vincula cada etapa (via sua rotina fixa) a um projeto do módulo Projetos.
 * A ligação com "seção do projeto" acontece automaticamente pela `ordem` da etapa
 * (o gatilho `trg_projeto_tarefa_processo_update` usa `secao.ordem = etapa.ordem - 1`).
 */
export function StepVinculoProjetos({ processoId }: Props) {
  const qc = useQueryClient();

  const { data: etapas = [], isLoading } = useQuery({
    queryKey: ["wizard-etapas-projeto", processoId],
    queryFn: async () => {
      const { data: pes, error } = await supabase
        .from("processo_etapas" as any)
        .select("id, ordem, nome_override, rotina_fixa_id")
        .eq("processo_id", processoId)
        .order("ordem");
      if (error) throw error;
      const rotinaIds = (pes ?? []).map((r: any) => r.rotina_fixa_id);
      let rotinas: any[] = [];
      if (rotinaIds.length) {
        const { data: rows, error: e2 } = await supabase
          .from("suporte_rotinas_fixas" as any)
          .select("id, titulo, projeto_id_espelho, fila_id")
          .in("id", rotinaIds);
        if (e2) throw e2;
        rotinas = rows ?? [];
      }
      const filaIds = Array.from(new Set(rotinas.map((r) => r.fila_id).filter(Boolean)));
      let filas: any[] = [];
      if (filaIds.length) {
        const { data: rf } = await supabase
          .from("suporte_filas" as any)
          .select("id, nome")
          .in("id", filaIds);
        filas = rf ?? [];
      }
      const rMap = new Map(rotinas.map((r) => [r.id, r]));
      const fMap = new Map(filas.map((f) => [f.id, f]));
      return ((pes ?? []) as any[]).map((pe) => {
        const r = rMap.get(pe.rotina_fixa_id);
        return {
          id: pe.id,
          ordem: pe.ordem,
          nome_override: pe.nome_override,
          rotina_fixa_id: pe.rotina_fixa_id,
          rotina_titulo: r?.titulo ?? "(sem título)",
          projeto_id_espelho: r?.projeto_id_espelho ?? null,
          fila_nome: r?.fila_id ? (fMap.get(r.fila_id)?.nome ?? null) : null,
        } as EtapaRow;
      });
    },
  });

  const { data: projetos = [] } = useQuery({
    queryKey: ["wizard-projetos-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos" as any)
        .select("id, nome")
        .order("nome")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Array<{ id: string; nome: string }>;
    },
  });

  const projetoIds = useMemo(
    () => Array.from(new Set(etapas.map((e) => e.projeto_id_espelho).filter(Boolean))) as string[],
    [etapas],
  );

  const { data: secoesPorProjeto = {} } = useQuery({
    enabled: projetoIds.length > 0,
    queryKey: ["wizard-secoes-projeto", projetoIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_secoes" as any)
        .select("id, projeto_id, nome, ordem")
        .in("projeto_id", projetoIds)
        .order("ordem");
      if (error) throw error;
      const map: Record<string, Array<{ id: string; nome: string; ordem: number }>> = {};
      for (const s of (data ?? []) as any[]) {
        if (!map[s.projeto_id]) map[s.projeto_id] = [];
        map[s.projeto_id].push({ id: s.id, nome: s.nome, ordem: s.ordem });
      }
      return map;
    },
  });

  const vincular = useMutation({
    mutationFn: async (payload: { rotinaId: string; projetoId: string | null }) => {
      const { error } = await supabase
        .from("suporte_rotinas_fixas" as any)
        .update({ projeto_id_espelho: payload.projetoId })
        .eq("id", payload.rotinaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo atualizado.");
      qc.invalidateQueries({ queryKey: ["wizard-etapas-projeto", processoId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar vínculo."),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Carregando…
        </CardContent>
      </Card>
    );
  }

  if (etapas.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Adicione etapas no passo anterior antes de vincular a projetos.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Para cada etapa, escolha o projeto de <b>Projetos</b> que representa a execução dessa
        etapa. A seção correspondente é resolvida automaticamente pela ordem da etapa
        (etapa {"{"}n{"}"} = seção de ordem {"{"}n − 1{"}"}). Se o projeto ainda não tem essa
        seção, o wizard sinaliza como aviso na revisão.
      </p>

      {etapas.map((e) => {
        const secoes = e.projeto_id_espelho ? secoesPorProjeto[e.projeto_id_espelho] : undefined;
        const secaoEsperada = secoes?.find((s) => s.ordem === e.ordem - 1);
        return (
          <Card key={e.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {e.ordem}
                </span>
                {e.nome_override ?? e.rotina_titulo}
                {e.fila_nome && (
                  <Badge variant="outline" className="ml-1">
                    {e.fila_nome}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Projeto vinculado</Label>
                <Select
                  value={e.projeto_id_espelho ?? "__none__"}
                  onValueChange={(v) =>
                    vincular.mutate({
                      rotinaId: e.rotina_fixa_id,
                      projetoId: v === "__none__" ? null : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem vínculo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem vínculo (etapa manual)</SelectItem>
                    {projetos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Seção correspondente</Label>
                <div className="text-sm rounded-md border px-3 py-2 bg-muted/40">
                  {!e.projeto_id_espelho ? (
                    <span className="text-muted-foreground">—</span>
                  ) : secaoEsperada ? (
                    <span className="inline-flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" /> {secaoEsperada.nome}
                    </span>
                  ) : (
                    <span className="text-amber-600">
                      Nenhuma seção de ordem {e.ordem - 1} no projeto.
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
