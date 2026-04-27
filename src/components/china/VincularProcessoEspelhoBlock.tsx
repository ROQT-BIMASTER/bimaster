import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Workflow, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCriarTarefaEspelho } from "@/hooks/useProcessoTarefaEspelho";

interface Props {
  /** ID do submissão China (vira registro_id de modulo_processo_link) */
  submissaoId: string;
  /** IDs de tarefas selecionadas no painel esquerdo da aba "Vincular" */
  tarefasSelecionadas: { id: string; titulo: string }[];
}

/**
 * Bloco que aparece dentro da aba "Vincular" do painel China.
 * Permite, em UM clique, vincular uma tarefa selecionada à etapa de um processo
 * da submissão — usando a mesma regra de "tarefa-espelho" do perfil de processo.
 */
export function VincularProcessoEspelhoBlock({ submissaoId, tarefasSelecionadas }: Props) {
  const [etapaId, setEtapaId] = useState<string>("");
  const [exigeDocs, setExigeDocs] = useState(true);
  const criarEspelho = useCriarTarefaEspelho();

  // Busca processos vinculados a essa submissão China e suas etapas
  const { data: processos = [], isLoading } = useQuery({
    queryKey: ["processo-china-instancia", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data: insts, error } = await (supabase as any)
        .from("processo_instancias")
        .select("id, perfil_id, perfil:processo_perfis(nome), entidade_tipo, entidade_id")
        .eq("entidade_tipo", "china_submissao")
        .eq("entidade_id", submissaoId);
      if (error) throw error;
      const list = (insts ?? []) as any[];
      if (list.length === 0) return [];

      const perfilIds = [...new Set(list.map((i) => i.perfil_id))];
      const { data: etapas } = await (supabase as any)
        .from("processo_perfil_etapas")
        .select("id, label, perfil_id, ordem")
        .in("perfil_id", perfilIds)
        .order("ordem");

      return list.map((i) => ({
        instancia_id: i.id,
        perfil_nome: i.perfil?.nome ?? "Processo",
        etapas: (etapas ?? []).filter((e: any) => e.perfil_id === i.perfil_id),
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (processos.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        <Workflow className="h-3.5 w-3.5 inline mr-1" />
        Esta submissão ainda não tem um processo aplicado. Aplique um perfil de processo na ficha do produto para habilitar o espelhamento.
      </div>
    );
  }

  const selecionadas = tarefasSelecionadas.length;
  const opcoesEtapa: { id: string; label: string; instanciaId: string; perfilNome: string }[] = [];
  processos.forEach((p: any) => {
    p.etapas.forEach((e: any) => {
      opcoesEtapa.push({ id: e.id, label: e.label, instanciaId: p.instancia_id, perfilNome: p.perfil_nome });
    });
  });

  const etapaSelecionada = opcoesEtapa.find((e) => e.id === etapaId);

  const handleVincular = async () => {
    if (!etapaSelecionada || tarefasSelecionadas.length === 0) return;
    for (const t of tarefasSelecionadas) {
      await criarEspelho.mutateAsync({
        instancia_id: etapaSelecionada.instanciaId,
        etapa_id: etapaSelecionada.id,
        projeto_tarefa_id: t.id,
        exige_documentos: exigeDocs,
      });
    }
  };

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Workflow className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Espelhar no processo aplicado</span>
        <Badge variant="secondary" className="text-[9px] ml-auto">
          {selecionadas} tarefa{selecionadas === 1 ? "" : "s"} selecionada{selecionadas === 1 ? "" : "s"}
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Vincule a(s) tarefa(s) marcada(s) como "espelho" de uma etapa do processo. Quando concluídas no projeto, a etapa avança automaticamente — exigindo os documentos oficiais cadastrados na etapa.
      </p>

      <div className="grid gap-2 grid-cols-[1fr_auto]">
        <Select value={etapaId} onValueChange={setEtapaId}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Escolher etapa do processo" />
          </SelectTrigger>
          <SelectContent>
            {opcoesEtapa.map((e) => (
              <SelectItem key={e.id} value={e.id} className="text-xs">
                {e.perfilNome} › {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="h-8 gap-1"
          disabled={!etapaSelecionada || selecionadas === 0 || criarEspelho.isPending}
          onClick={handleVincular}
        >
          <Link2 className="h-3 w-3" />
          Espelhar
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={exigeDocs} onCheckedChange={setExigeDocs} />
        <Label className="text-[11px] cursor-pointer">
          Exigir documentos oficiais da etapa para concluir
        </Label>
      </div>
    </div>
  );
}
