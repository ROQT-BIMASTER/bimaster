import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useProjetosParaVinculo, useSecoesETarefas } from "@/hooks/useChinaTarefaVinculos";

export interface EspelhoValue {
  projeto_id: string | null;
  secao_id: string | null;
  tarefa_id: string | null;
  /** Subtarefa opcional. Quando definida, o espelho aponta para a subtarefa específica. */
  subtarefa_id?: string | null;
  exige_documentos: boolean;
}

/** Hook auxiliar: lista subtarefas de uma tarefa pai. */
function useSubtarefasDaTarefa(tarefaId: string | null) {
  return useQuery({
    queryKey: ["subtarefas-da-tarefa", tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, status")
        .eq("parent_tarefa_id", tarefaId!)
        .is("excluida_em" as any, null)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

interface Props {
  value: EspelhoValue;
  onChange: (v: EspelhoValue) => void;
  /** Se true, mostra o toggle de exigência de docs. */
  showDocsToggle?: boolean;
  /** Se true, exige tarefa selecionada (modo espelhar_tarefa). Caso contrário aceita seção. */
  requireTarefa?: boolean;
  disabled?: boolean;
}

/**
 * Seletor encadeado Projeto → Seção → Tarefa, reutilizado em PerfisProcesso e Vincular China.
 * Regra simples: o usuário escolhe a tarefa real do módulo Projetos que vai "espelhar"
 * a etapa do processo. Quando ela for concluída lá, será concluída aqui.
 */
export function TarefaEspelhoSelect({
  value,
  onChange,
  showDocsToggle = true,
  requireTarefa = false,
  disabled,
}: Props) {
  const { data: projetos = [] } = useProjetosParaVinculo();
  const { data: secoesData } = useSecoesETarefas(value.projeto_id);
  const secoes = secoesData?.secoes ?? [];
  const tarefas = (secoesData?.tarefas ?? []).filter(
    (t: any) => !value.secao_id || t.secao_id === value.secao_id,
  );

  return (
    <div className="space-y-2">
      <div className="grid gap-2 grid-cols-3">
        <Select
          disabled={disabled}
          value={value.projeto_id ?? ""}
          onValueChange={(v) => onChange({ ...value, projeto_id: v, secao_id: null, tarefa_id: null })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Projeto" />
          </SelectTrigger>
          <SelectContent>
            {projetos.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={disabled || !value.projeto_id || secoes.length === 0}
          value={value.secao_id ?? ""}
          onValueChange={(v) => onChange({ ...value, secao_id: v, tarefa_id: null })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Seção" />
          </SelectTrigger>
          <SelectContent>
            {secoes.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={disabled || !value.projeto_id || tarefas.length === 0}
          value={value.tarefa_id ?? ""}
          onValueChange={(v) => onChange({ ...value, tarefa_id: v })}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={requireTarefa ? "Tarefa (obrigatória)" : "Tarefa"} />
          </SelectTrigger>
          <SelectContent>
            {tarefas.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>
                {t.titulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showDocsToggle && (
        <div className="flex items-center gap-2">
          <Switch
            checked={value.exige_documentos}
            onCheckedChange={(b) => onChange({ ...value, exige_documentos: b })}
            disabled={disabled}
          />
          <Label className="text-xs cursor-pointer">
            Exigir documentos oficiais da etapa para concluir esta tarefa
          </Label>
        </div>
      )}
    </div>
  );
}
