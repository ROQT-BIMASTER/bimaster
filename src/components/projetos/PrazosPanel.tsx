import { useMemo } from "react";
import { useProjetoTarefas, ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { useProjeto } from "@/hooks/useProjetos";
import { useFeriados } from "@/hooks/useFeriados";
import { PrazoEditorPopover } from "./PrazoEditorPopover";
import { TarefaRiskBadge } from "./TarefaRiskBadge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, CalendarClock, FolderKanban, ListTodo, GitBranch } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  contarDiasUteisEntre,
  feriadosToSet,
  parseDateLocal,
  RegimeCalendario,
} from "@/lib/prazoCalculator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface PrazosPanelProps {
  projetoId: string;
  darkBg?: boolean;
}

const fmt = (iso: string | null | undefined) =>
  iso ? format(new Date(iso + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "—";

export function PrazosPanel({ projetoId, darkBg = false }: PrazosPanelProps) {
  const { data: projeto } = useProjeto(projetoId);
  const { secoes, tarefas, tarefasPorSecao, updateSecao } = useProjetoTarefas(projetoId);
  const queryClient = useQueryClient();
  const ano = new Date().getFullYear();
  const { feriados } = useFeriados(ano);
  const { feriados: feriadosProx } = useFeriados(ano + 1);
  const feriadosSet = useMemo(
    () => feriadosToSet([...(feriados ?? []), ...(feriadosProx ?? [])]),
    [feriados, feriadosProx],
  );
  const regime: RegimeCalendario = (projeto?.regime_calendario ?? "dias_uteis") as RegimeCalendario;

  const [collapsedSecoes, setCollapsedSecoes] = useState<Record<string, boolean>>({});
  const [collapsedTarefas, setCollapsedTarefas] = useState<Record<string, boolean>>({});

  const updateTarefaPrazo = async (tarefaId: string, updates: Record<string, any>) => {
    const { error } = await supabase
      .from("projeto_tarefas")
      .update(updates as any)
      .eq("id", tarefaId);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
    toast.success("Prazo atualizado");
  };

  const calcFolga = (filhoPrazo: string | null | undefined, paiPrazo: string | null | undefined): number | null => {
    const f = parseDateLocal(filhoPrazo ?? null);
    const p = parseDateLocal(paiPrazo ?? null);
    if (!f || !p) return null;
    return Math.round((p.getTime() - f.getTime()) / 86400000);
  };

  const calcDuracao = (inicio: string | null | undefined, prazo: string | null | undefined): number | null => {
    if (!inicio || !prazo) return null;
    return contarDiasUteisEntre(inicio, prazo, regime, feriadosSet);
  };

  const FolgaCell = ({ folga }: { folga: number | null }) => {
    if (folga === null) return <span className="text-muted-foreground">—</span>;
    if (folga < 0) return <span className="text-red-500 font-semibold">{folga}d</span>;
    if (folga <= 2) return <span className="text-amber-500 font-medium">{folga}d</span>;
    return <span className="text-emerald-500">{folga}d</span>;
  };

  if (!projeto) return null;

  return (
    <div className={cn("space-y-3", darkBg && "text-white")}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Hierarquia de Prazos
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Calendário: {regime === "corridos" ? "Dias corridos" : regime === "uteis_com_sabado" ? "Úteis com sábado" : "Dias úteis"} ·
            Feriados nacionais aplicados · Filho não pode ultrapassar pai
          </p>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border overflow-hidden">
        <div className={cn(
          "grid items-center px-3 py-2 text-[11px] font-semibold border-b",
          darkBg ? "bg-white/5 border-white/10" : "bg-muted/40 border-border",
        )} style={{ gridTemplateColumns: "minmax(280px,1fr) 110px 110px 90px 90px 80px 60px" }}>
          <div>Item</div>
          <div>Início</div>
          <div>Prazo</div>
          <div>Duração</div>
          <div>Folga</div>
          <div>Risco</div>
          <div className="text-right">Ações</div>
        </div>

        {/* PROJETO */}
        <div
          className={cn("grid items-center px-3 py-2 border-b text-xs", darkBg ? "border-white/10 bg-primary/10" : "border-border bg-primary/5")}
          style={{ gridTemplateColumns: "minmax(280px,1fr) 110px 110px 90px 90px 80px 60px" }}
        >
          <div className="flex items-center gap-2 font-semibold">
            <FolderKanban className="h-4 w-4 text-primary" />
            {projeto.nome}
          </div>
          <div>{fmt(projeto.data_inicio)}</div>
          <div>{fmt(projeto.data_fim_alvo)}</div>
          <div>{calcDuracao(projeto.data_inicio, projeto.data_fim_alvo) ?? "—"}d</div>
          <div className="text-muted-foreground">—</div>
          <div>
            <TarefaRiskBadge
              status="em_andamento"
              dataPrazo={projeto.data_fim_alvo ?? null}
              diasAlertaAntes={projeto.alerta_antecipacao_dias ?? 2}
              compact
            />
          </div>
          <div className="text-right text-[10px] text-muted-foreground">Ed. no header</div>
        </div>

        {/* SEÇÕES */}
        {secoes.map((secao, sIdx) => {
          const secColapsada = collapsedSecoes[secao.id];
          const secTarefas = tarefasPorSecao(secao.id);
          const folgaSec = calcFolga(secao.data_prazo, projeto.data_fim_alvo);

          return (
            <div key={secao.id}>
              <div
                className={cn("grid items-center px-3 py-2 border-b text-xs", darkBg ? "border-white/10 hover:bg-white/5" : "border-border hover:bg-muted/30")}
                style={{ gridTemplateColumns: "minmax(280px,1fr) 110px 110px 90px 90px 80px 60px" }}
              >
                <button
                  onClick={() => setCollapsedSecoes((s) => ({ ...s, [secao.id]: !s[secao.id] }))}
                  className="flex items-center gap-2 font-medium text-left min-w-0 pl-3"
                >
                  {secColapsada ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  <span className="truncate">{secao.nome}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({secTarefas.length})</span>
                </button>
                <div>{fmt(secao.data_inicio)}</div>
                <div>{fmt(secao.data_prazo)}</div>
                <div>{calcDuracao(secao.data_inicio, secao.data_prazo) ?? "—"}{calcDuracao(secao.data_inicio, secao.data_prazo) !== null && "d"}</div>
                <div><FolgaCell folga={folgaSec} /></div>
                <div>
                  <TarefaRiskBadge
                    status="em_andamento"
                    dataPrazo={secao.data_prazo ?? null}
                    diasAlertaAntes={secao.dias_alerta_antes ?? 2}
                    compact
                  />
                </div>
                <div className="text-right">
                  <PrazoEditorPopover
                    label={`Prazo da seção: ${secao.nome}`}
                    dataInicio={secao.data_inicio ?? null}
                    dataPrazo={secao.data_prazo ?? null}
                    diasAlertaAntes={secao.dias_alerta_antes ?? 2}
                    regime={regime}
                    limiteSuperior={projeto.data_fim_alvo ?? null}
                    limiteInferior={projeto.data_inicio ?? null}
                    onSave={async (next) => {
                      await updateSecao.mutateAsync({ secaoId: secao.id, updates: next });
                    }}
                  >
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <CalendarClock className="h-3.5 w-3.5" />
                    </Button>
                  </PrazoEditorPopover>
                </div>
              </div>

              {/* TAREFAS */}
              {!secColapsada && secTarefas.map((tar) => {
                const tarColapsada = collapsedTarefas[tar.id];
                const subs = (tar.subtarefas ?? []) as ProjetoTarefa[];
                const folgaT = calcFolga(tar.data_prazo, secao.data_prazo ?? projeto.data_fim_alvo);

                return (
                  <div key={tar.id}>
                    <div
                      className={cn("grid items-center px-3 py-1.5 border-b text-xs", darkBg ? "border-white/10 hover:bg-white/5" : "border-border/50 hover:bg-muted/20")}
                      style={{ gridTemplateColumns: "minmax(280px,1fr) 110px 110px 90px 90px 80px 60px" }}
                    >
                      <button
                        onClick={() => subs.length > 0 && setCollapsedTarefas((s) => ({ ...s, [tar.id]: !s[tar.id] }))}
                        className="flex items-center gap-2 text-left min-w-0 pl-8"
                      >
                        {subs.length > 0 ? (
                          tarColapsada ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ListTodo className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="truncate">{tar.titulo}</span>
                        {subs.length > 0 && <span className="text-[10px] text-muted-foreground">({subs.length})</span>}
                      </button>
                      <div>{fmt((tar as any).data_inicio_planejada)}</div>
                      <div>{fmt(tar.data_prazo)}</div>
                      <div>{calcDuracao((tar as any).data_inicio_planejada, tar.data_prazo) ?? "—"}{calcDuracao((tar as any).data_inicio_planejada, tar.data_prazo) !== null && "d"}</div>
                      <div><FolgaCell folga={folgaT} /></div>
                      <div>
                        <TarefaRiskBadge
                          status={tar.status}
                          dataPrazo={tar.data_prazo}
                          diasAlertaAntes={tar.dias_alerta_antes ?? 2}
                          compact
                        />
                      </div>
                      <div className="text-right">
                        <PrazoEditorPopover
                          label={`Prazo da tarefa: ${tar.titulo}`}
                          dataInicio={(tar as any).data_inicio_planejada ?? null}
                          dataPrazo={tar.data_prazo}
                          diasAlertaAntes={tar.dias_alerta_antes ?? 2}
                          regime={regime}
                          limiteSuperior={secao.data_prazo ?? projeto.data_fim_alvo ?? null}
                          limiteInferior={secao.data_inicio ?? projeto.data_inicio ?? null}
                          onSave={async (next) => {
                            await updateTarefaPrazo(tar.id, {
                              data_inicio_planejada: next.data_inicio,
                              data_prazo: next.data_prazo,
                              dias_alerta_antes: next.dias_alerta_antes,
                            });
                          }}
                        >
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <CalendarClock className="h-3.5 w-3.5" />
                          </Button>
                        </PrazoEditorPopover>
                      </div>
                    </div>

                    {/* SUBTAREFAS */}
                    {!tarColapsada && subs.map((sub) => {
                      const folgaS = calcFolga(sub.data_prazo, tar.data_prazo);
                      return (
                        <div
                          key={sub.id}
                          className={cn("grid items-center px-3 py-1 border-b text-[11px]", darkBg ? "border-white/5 hover:bg-white/5" : "border-border/30 hover:bg-muted/10")}
                          style={{ gridTemplateColumns: "minmax(280px,1fr) 110px 110px 90px 90px 80px 60px" }}
                        >
                          <div className="flex items-center gap-2 min-w-0 pl-14 text-muted-foreground">
                            <GitBranch className="h-3 w-3" />
                            <span className="truncate">{sub.titulo}</span>
                          </div>
                          <div>{fmt((sub as any).data_inicio_planejada)}</div>
                          <div>{fmt(sub.data_prazo)}</div>
                          <div>{calcDuracao((sub as any).data_inicio_planejada, sub.data_prazo) ?? "—"}{calcDuracao((sub as any).data_inicio_planejada, sub.data_prazo) !== null && "d"}</div>
                          <div><FolgaCell folga={folgaS} /></div>
                          <div>
                            <TarefaRiskBadge
                              status={sub.status}
                              dataPrazo={sub.data_prazo}
                              diasAlertaAntes={sub.dias_alerta_antes ?? 2}
                              compact
                            />
                          </div>
                          <div className="text-right">
                            <PrazoEditorPopover
                              label={`Prazo da subtarefa: ${sub.titulo}`}
                              dataInicio={(sub as any).data_inicio_planejada ?? null}
                              dataPrazo={sub.data_prazo}
                              diasAlertaAntes={sub.dias_alerta_antes ?? 2}
                              regime={regime}
                              limiteSuperior={tar.data_prazo ?? secao.data_prazo ?? projeto.data_fim_alvo ?? null}
                              limiteInferior={(tar as any).data_inicio_planejada ?? secao.data_inicio ?? projeto.data_inicio ?? null}
                              onSave={async (next) => {
                                await updateTarefaPrazo(sub.id, {
                                  data_inicio_planejada: next.data_inicio,
                                  data_prazo: next.data_prazo,
                                  dias_alerta_antes: next.dias_alerta_antes,
                                });
                              }}
                            >
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <CalendarClock className="h-3 w-3" />
                              </Button>
                            </PrazoEditorPopover>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}

        {secoes.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Crie seções e tarefas no projeto para definir prazos hierárquicos.
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Folga = dias entre o prazo do item e o prazo do nível superior (negativo = ultrapassa o pai).
      </p>
    </div>
  );
}
