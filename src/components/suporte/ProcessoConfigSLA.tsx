import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuporteFilas } from "@/hooks/suporte/useSuporteFilas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type EtapaConfig = {
  id: string;
  ordem: number;
  nome_override: string | null;
  sla_minutos: number | null;
  horario_corte: string | null;
  escalonamento_ativo: boolean;
  fila_escalonamento_id: string | null;
  prioridade_escalonamento: "baixa" | "media" | "alta" | "critica" | null;
  risco_percent: number;
  escalonamento_assignee_id: string | null;
  parecer_administrativo: string | null;
};

const PRIORIDADES: Array<{ value: EtapaConfig["prioridade_escalonamento"]; label: string }> = [
  { value: null, label: "Automática (por atraso)" },
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

export function ProcessoConfigSLA({ processoId }: { processoId: string }) {
  const qc = useQueryClient();
  const { data: filas = [] } = useSuporteFilas();

  const { data: etapas = [], isLoading } = useQuery({
    queryKey: ["processo-etapas-config", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processo_etapas" as any)
        .select(
          "id, ordem, nome_override, sla_minutos, horario_corte, escalonamento_ativo, fila_escalonamento_id, prioridade_escalonamento, risco_percent, escalonamento_assignee_id, parecer_administrativo",
        )
        .eq("processo_id", processoId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EtapaConfig[];
    },
  });

  const [local, setLocal] = useState<Record<string, EtapaConfig>>({});

  useEffect(() => {
    const map: Record<string, EtapaConfig> = {};
    etapas.forEach((e) => (map[e.id] = { ...e }));
    setLocal(map);
  }, [etapas]);

  const dirtyIds = useMemo(() => {
    const ids: string[] = [];
    etapas.forEach((e) => {
      const l = local[e.id];
      if (!l) return;
      if (
        l.sla_minutos !== e.sla_minutos ||
        l.horario_corte !== e.horario_corte ||
        l.escalonamento_ativo !== e.escalonamento_ativo ||
        l.fila_escalonamento_id !== e.fila_escalonamento_id ||
        l.prioridade_escalonamento !== e.prioridade_escalonamento ||
        l.risco_percent !== e.risco_percent
      ) {
        ids.push(e.id);
      }
    });
    return ids;
  }, [local, etapas]);

  const saveMut = useMutation({
    mutationFn: async () => {
      for (const id of dirtyIds) {
        const l = local[id];
        const { error } = await supabase
          .from("processo_etapas" as any)
          .update({
            sla_minutos: l.sla_minutos,
            horario_corte: l.horario_corte,
            escalonamento_ativo: l.escalonamento_ativo,
            fila_escalonamento_id: l.fila_escalonamento_id,
            prioridade_escalonamento: l.prioridade_escalonamento,
            risco_percent: l.risco_percent,
          })
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["processo-etapas-config", processoId] });
      qc.invalidateQueries({ queryKey: ["processo", processoId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const update = (id: string, patch: Partial<EtapaConfig>) =>
    setLocal((s) => ({ ...s, [id]: { ...s[id], ...patch } }));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando etapas…
      </div>
    );
  }

  if (etapas.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Este processo ainda não possui etapas. Adicione etapas no Canvas para configurar SLA.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-3xl">
          Defina, para cada etapa, o prazo interno (Camada 1, monitorado no Meus Projetos) e a
          lógica de escalonamento automática (Camada 2, que abre chamado no Suporte na categoria
          selecionada quando o SLA entra em risco ou é violado).
        </p>
        <Button
          size="sm"
          onClick={() => saveMut.mutate()}
          disabled={dirtyIds.length === 0 || saveMut.isPending}
        >
          {saveMut.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          Salvar ({dirtyIds.length})
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {etapas.map((e) => {
          const l = local[e.id] ?? e;
          const filaAtual = filas.find((f: any) => f.id === l.fila_escalonamento_id);
          return (
            <Card key={e.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {e.ordem}
                  </span>
                  {l.nome_override ?? `Etapa ${e.ordem}`}
                  {!l.escalonamento_ativo && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" /> Escalonamento desativado
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">SLA da etapa (minutos)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={l.sla_minutos ?? ""}
                      onChange={(ev) =>
                        update(e.id, {
                          sla_minutos: ev.target.value === "" ? null : Number(ev.target.value),
                        })
                      }
                      placeholder="ex.: 60"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Prazo para o coordenador cobrar a execução (Camada 1).
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Horário de corte (opcional)</Label>
                    <Input
                      type="time"
                      value={l.horario_corte ?? ""}
                      onChange={(ev) =>
                        update(e.id, { horario_corte: ev.target.value || null })
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Após este horário, tarefas rolam para o próximo dia útil.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Percentual para "em risco"</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={l.risco_percent}
                      onChange={(ev) =>
                        update(e.id, {
                          risco_percent: Math.min(100, Math.max(1, Number(ev.target.value) || 1)),
                        })
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Quando o consumo do SLA atingir esse %, sinaliza risco antes da violação.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label className="text-xs">
                      Categoria de hierarquia do Suporte (fila do chamado)
                    </Label>
                    <Select
                      value={l.fila_escalonamento_id ?? "__none__"}
                      onValueChange={(v) =>
                        update(e.id, {
                          fila_escalonamento_id: v === "__none__" ? null : v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Usar fila dona do processo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          Usar fila dona do processo (padrão)
                        </SelectItem>
                        {filas.map((f: any) => (
                          <SelectItem key={f.id} value={f.id}>
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ background: f.cor ?? "#94a3b8" }}
                              />
                              {f.nome}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      {filaAtual
                        ? `Chamados desta etapa serão roteados para: ${filaAtual.nome}.`
                        : "Sem override — o chamado vai para a fila dona configurada no processo."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Prioridade do chamado</Label>
                    <Select
                      value={l.prioridade_escalonamento ?? "__auto__"}
                      onValueChange={(v) =>
                        update(e.id, {
                          prioridade_escalonamento:
                            v === "__auto__"
                              ? null
                              : (v as EtapaConfig["prioridade_escalonamento"]),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORIDADES.map((p) => (
                          <SelectItem
                            key={p.value ?? "auto"}
                            value={p.value ?? "__auto__"}
                          >
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between md:col-span-3 border-t pt-3">
                    <div className="flex flex-col">
                      <Label className="text-xs">Escalonamento automático (Camada 2)</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Quando desligado, o SLA continua sendo monitorado, mas nenhum chamado
                        formal é aberto na Central de Suporte.
                      </p>
                    </div>
                    <Switch
                      checked={l.escalonamento_ativo}
                      onCheckedChange={(v) => update(e.id, { escalonamento_ativo: v })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
