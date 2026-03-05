import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  X, Plus, Target, TrendingUp, AlertTriangle, CheckCircle2,
  BarChart3, ClipboardList, Trash2, ChevronDown, Clock, Flag,
} from "lucide-react";
import { useProjetoCalendarioRegras, CalendarioRegra } from "@/hooks/useProjetoCalendarioRegras";
import { useProjetoPlanosAcao } from "@/hooks/useProjetoPlanosAcao";
import { useProjetoTarefaMetasCalendario, TarefaMetaCalendario } from "@/hooks/useProjetoTarefaMetasCalendario";
import { ProjetoTarefa, ProjetoSecao } from "@/hooks/useProjetoTarefas";
import { format, differenceInWeeks, differenceInDays, isAfter, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  projetoId: string;
  tarefas: ProjetoTarefa[];
  secoes: ProjetoSecao[];
  periodoInicio: Date;
  periodoFim: Date;
  periodoLabel: string;
  darkBg?: boolean;
  onClose: () => void;
}

const TIPO_LABELS: Record<string, string> = {
  percentual_conclusao: "% Conclusão",
  max_atrasadas: "Máx. Atrasadas",
  min_velocity: "Mín. Velocidade",
  max_dias_andamento: "Máx. Dias em Andamento",
  max_simultaneas_andamento: "Máx. Simultâneas em Andamento",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Não iniciado",
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pendente: "secondary",
  nao_iniciado: "secondary",
  em_andamento: "warning",
  concluida: "success",
  bloqueada: "destructive",
};

const ESTAGIO_LABELS: Record<string, string> = {
  briefing: "Briefing",
  em_criacao: "Em Criação",
  revisao: "Revisão",
  aprovado: "Aprovado",
  producao: "Produção",
  lancamento: "Lançamento",
};

const ESTAGIO_COLORS: Record<string, string> = {
  briefing: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  em_criacao: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  revisao: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  aprovado: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  producao: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  lancamento: "bg-pink-500/20 text-pink-300 border-pink-500/30",
};

const ESTAGIO_COLORS_LIGHT: Record<string, string> = {
  briefing: "bg-purple-100 text-purple-700 border-purple-200",
  em_criacao: "bg-blue-100 text-blue-700 border-blue-200",
  revisao: "bg-amber-100 text-amber-700 border-amber-200",
  aprovado: "bg-emerald-100 text-emerald-700 border-emerald-200",
  producao: "bg-pink-100 text-pink-700 border-pink-200",
  lancamento: "bg-pink-100 text-pink-700 border-pink-200",
};

const STATUS_PLANO_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  em_andamento: { label: "Em andamento", variant: "warning" },
  concluido: { label: "Concluído", variant: "success" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

const TAREFA_META_TIPOS: Record<string, string> = {
  prazo_limite: "Prazo Limite",
  entrega_obrigatoria: "Entrega Obrigatória",
  qualidade: "Qualidade",
  custom: "Personalizada",
};

export function CalendarioAnalisePanel({ projetoId, tarefas, secoes, periodoInicio, periodoFim, periodoLabel, darkBg = false, onClose }: Props) {
  const { regras, createRegra, updateRegra, deleteRegra } = useProjetoCalendarioRegras(projetoId);
  const { planos, createPlano, updatePlano, deletePlano } = useProjetoPlanosAcao(projetoId);
  const { tarefaMetas, createTarefaMeta, updateTarefaMeta, deleteTarefaMeta } = useProjetoTarefaMetasCalendario(projetoId);

  const [showRegraDialog, setShowRegraDialog] = useState(false);
  const [regraSecaoId, setRegraSecaoId] = useState<string | null>(null);
  const [showPlanoDialog, setShowPlanoDialog] = useState(false);
  const [showTarefaMetaDialog, setShowTarefaMetaDialog] = useState(false);
  const [metaTarefaId, setMetaTarefaId] = useState<string | null>(null);

  // Filter tasks by period
  const periodTasks = useMemo(() => {
    return tarefas.filter((t) => {
      if (!t.data_prazo) return false;
      const d = parseISO(t.data_prazo);
      return !isBefore(d, periodoInicio) && !isAfter(d, periodoFim);
    });
  }, [tarefas, periodoInicio, periodoFim]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const now = new Date();
    const total = periodTasks.length;
    const concluidas = periodTasks.filter((t) => t.status === "concluida").length;
    const atrasadas = periodTasks.filter((t) => {
      if (t.status === "concluida") return false;
      if (!t.data_prazo) return false;
      return isBefore(parseISO(t.data_prazo), now);
    }).length;
    const emAndamento = periodTasks.filter((t) => t.status === "em_andamento").length;
    const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;
    const weeks = Math.max(1, differenceInWeeks(periodoFim, periodoInicio) || 1);
    const velocidade = +(concluidas / weeks).toFixed(1);
    const tarefasEmAndamento = periodTasks.filter((t) => t.status === "em_andamento");
    const maxDiasAndamento = tarefasEmAndamento.reduce((max, t) => {
      const startDate = t.updated_at ? parseISO(t.updated_at) : parseISO(t.created_at);
      return Math.max(max, differenceInDays(now, startDate));
    }, 0);
    return { total, concluidas, atrasadas, emAndamento, taxa, velocidade, maxDiasAndamento, simultaneasAndamento: emAndamento };
  }, [periodTasks, periodoInicio, periodoFim]);

  // Compute section-level KPIs
  const computeSectionKpis = (sectionTasks: ProjetoTarefa[]) => {
    const now = new Date();
    const total = sectionTasks.length;
    const concluidas = sectionTasks.filter((t) => t.status === "concluida").length;
    const atrasadas = sectionTasks.filter((t) => t.status !== "concluida" && t.data_prazo && isBefore(parseISO(t.data_prazo), now)).length;
    const emAndamento = sectionTasks.filter((t) => t.status === "em_andamento").length;
    const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;
    const weeks = Math.max(1, differenceInWeeks(periodoFim, periodoInicio) || 1);
    const velocidade = +(concluidas / weeks).toFixed(1);
    const maxDiasAndamento = sectionTasks.filter((t) => t.status === "em_andamento").reduce((max, t) => {
      return Math.max(max, differenceInDays(now, parseISO(t.updated_at || t.created_at)));
    }, 0);
    return { total, concluidas, atrasadas, emAndamento, taxa, velocidade, maxDiasAndamento, simultaneasAndamento: emAndamento };
  };

  // ── Tasks grouped by section ──
  const tasksBySection = useMemo(() => {
    const map: Record<string, ProjetoTarefa[]> = {};
    periodTasks.forEach((t) => {
      if (!map[t.secao_id]) map[t.secao_id] = [];
      map[t.secao_id].push(t);
    });
    return map;
  }, [periodTasks]);

  // Group regras: global vs per-section
  const globalRegras = regras.filter((r) => !r.secao_id);
  const regrasBySection = useMemo(() => {
    const map: Record<string, CalendarioRegra[]> = {};
    regras.filter((r) => r.secao_id).forEach((r) => {
      if (!map[r.secao_id!]) map[r.secao_id!] = [];
      map[r.secao_id!].push(r);
    });
    return map;
  }, [regras]);

  // Group task metas by tarefa_id
  const metasByTarefa = useMemo(() => {
    const map: Record<string, TarefaMetaCalendario[]> = {};
    tarefaMetas.forEach((m) => {
      if (!map[m.tarefa_id]) map[m.tarefa_id] = [];
      map[m.tarefa_id].push(m);
    });
    return map;
  }, [tarefaMetas]);

  // ── Evaluate rules ──
  const evaluateRegraWithKpis = (regra: CalendarioRegra, kpisData: typeof kpis): boolean => {
    let actual: number;
    switch (regra.tipo) {
      case "percentual_conclusao": actual = kpisData.taxa; break;
      case "max_atrasadas": actual = kpisData.atrasadas; break;
      case "min_velocity": actual = kpisData.velocidade; break;
      case "max_dias_andamento": actual = kpisData.maxDiasAndamento; break;
      case "max_simultaneas_andamento": actual = kpisData.simultaneasAndamento; break;
      default: return true;
    }
    switch (regra.operador) {
      case ">=": return actual >= regra.valor;
      case "<=": return actual <= regra.valor;
      case "=": return actual === regra.valor;
      case ">": return actual > regra.valor;
      case "<": return actual < regra.valor;
      default: return true;
    }
  };

  const bg = darkBg ? "bg-zinc-900/95" : "bg-background";
  const txt = darkBg ? "text-white" : "text-foreground";
  const txtMuted = darkBg ? "text-white/60" : "text-muted-foreground";
  const sectionBg = darkBg ? "bg-white/[0.03]" : "bg-muted/30";
  const borderColor = darkBg ? "border-white/10" : "border-border";

  const openRegraDialogForSection = (secaoId: string | null) => {
    setRegraSecaoId(secaoId);
    setShowRegraDialog(true);
  };

  const openTarefaMetaDialog = (tarefaId: string) => {
    setMetaTarefaId(tarefaId);
    setShowTarefaMetaDialog(true);
  };

  return (
    <div className={cn("w-full animate-in fade-in-0 duration-300", bg)}>
      {/* Header */}
      <div className={cn("flex items-center justify-between px-6 py-4 border-b", borderColor)}>
        <div className="flex items-center gap-3">
          <BarChart3 className={cn("h-5 w-5", darkBg ? "text-white/70" : "text-primary")} />
          <div>
            <h2 className={cn("font-semibold text-lg", txt)}>Painel de Análise</h2>
            <p className={cn("text-xs", txtMuted)}>{periodoLabel}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className={cn("h-8 w-8", darkBg && "text-white hover:bg-white/10")} onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-6 space-y-8 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* ── KPIs ── */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label="Total" value={kpis.total} icon={<ClipboardList className="h-4 w-4" />} darkBg={darkBg} />
            <KPICard label="Concluídas" value={`${kpis.concluidas} (${kpis.taxa}%)`} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} darkBg={darkBg} />
            <KPICard label="Atrasadas" value={kpis.atrasadas} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} darkBg={darkBg} accent={kpis.atrasadas > 0} />
            <KPICard label="Velocidade" value={`${kpis.velocidade}/sem`} icon={<TrendingUp className="h-4 w-4 text-blue-500" />} darkBg={darkBg} />
          </div>
          <div className={cn("mt-4 rounded-lg p-4", sectionBg)}>
            <div className="flex items-center justify-between mb-2">
              <span className={cn("text-sm font-medium", txt)}>Progresso Geral</span>
              <span className={cn("text-sm font-bold", txt)}>{kpis.taxa}%</span>
            </div>
            <Progress value={kpis.taxa} className="h-2.5" />
            <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-xs", txtMuted)}>
              <span>📊 Velocidade: {kpis.velocidade}/sem</span>
              <span>🔄 Em andamento: {kpis.emAndamento}</span>
              <span>⚠️ Atrasadas: {kpis.atrasadas}</span>
              <span>⏱️ Máx dias em and.: {kpis.maxDiasAndamento}d</span>
            </div>
          </div>
        </section>

        {/* ── Regras de Metas (Globais) ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn("text-sm font-semibold flex items-center gap-2", txt)}>
              <Target className="h-4 w-4" /> Regras de Metas (Projeto)
            </h3>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", darkBg && "bg-white/10 border-white/20 text-white hover:bg-white/20")} onClick={() => openRegraDialogForSection(null)}>
              <Plus className="h-3 w-3" /> Nova Regra
            </Button>
          </div>
          {globalRegras.length === 0 ? (
            <p className={cn("text-xs text-center py-4", txtMuted)}>Nenhuma regra global configurada</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {globalRegras.map((r) => (
                <RegraCard key={r.id} regra={r} passed={evaluateRegraWithKpis(r, kpis)} darkBg={darkBg} onToggle={(checked) => updateRegra.mutate({ id: r.id, ativo: checked })} onDelete={() => deleteRegra.mutate(r.id)} />
              ))}
            </div>
          )}
        </section>

        {/* ── Tabelas por Seção (com regras e metas de tarefa) ── */}
        <section>
          <h3 className={cn("text-sm font-semibold flex items-center gap-2 mb-4", txt)}>
            <ClipboardList className="h-4 w-4" /> Tarefas por Seção
          </h3>
          {secoes.length === 0 ? (
            <p className={cn("text-xs text-center py-6", txtMuted)}>Nenhuma seção encontrada</p>
          ) : (
            <div className="space-y-3">
              {secoes.map((secao) => {
                const secaoTasks = tasksBySection[secao.id] || [];
                const concluidas = secaoTasks.filter((t) => t.status === "concluida").length;
                const pct = secaoTasks.length > 0 ? Math.round((concluidas / secaoTasks.length) * 100) : 0;
                const secaoRegras = regrasBySection[secao.id] || [];
                const secaoKpis = computeSectionKpis(secaoTasks);

                return (
                  <SectionTable
                    key={secao.id}
                    secao={secao}
                    tarefas={secaoTasks}
                    concluidas={concluidas}
                    percentual={pct}
                    regras={secaoRegras}
                    secaoKpis={secaoKpis}
                    metasByTarefa={metasByTarefa}
                    darkBg={darkBg}
                    onAddRegra={() => openRegraDialogForSection(secao.id)}
                    onToggleRegra={(id, checked) => updateRegra.mutate({ id, ativo: checked })}
                    onDeleteRegra={(id) => deleteRegra.mutate(id)}
                    evaluateRegra={(r) => evaluateRegraWithKpis(r, secaoKpis)}
                    onAddTarefaMeta={openTarefaMetaDialog}
                    onToggleTarefaMeta={(id, cumprida) => updateTarefaMeta.mutate({ id, cumprida })}
                    onDeleteTarefaMeta={(id) => deleteTarefaMeta.mutate(id)}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* ── Planos de Ação ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className={cn("text-sm font-semibold flex items-center gap-2", txt)}>
              <ClipboardList className="h-4 w-4" /> Planos de Ação
            </h3>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", darkBg && "bg-white/10 border-white/20 text-white hover:bg-white/20")} onClick={() => setShowPlanoDialog(true)}>
              <Plus className="h-3 w-3" /> Novo Plano
            </Button>
          </div>
          {planos.length === 0 ? (
            <p className={cn("text-xs text-center py-6", txtMuted)}>Nenhum plano de ação registrado</p>
          ) : (
            <div className="space-y-2">
              {planos.map((p) => {
                const cfg = STATUS_PLANO_CONFIG[p.status] || STATUS_PLANO_CONFIG.pendente;
                return (
                  <div key={p.id} className={cn("rounded-lg p-4 border flex items-start gap-4", sectionBg, borderColor)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-sm font-medium", txt)}>{p.titulo}</span>
                        <Select value={p.status} onValueChange={(v) => updatePlano.mutate({ id: p.id, status: v })}>
                          <SelectTrigger className={cn("h-5 w-auto border-0 text-[10px] px-1.5 gap-0.5", darkBg && "bg-transparent text-white")}>
                            <Badge variant={cfg.variant} className="text-[10px] h-4">{cfg.label}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_PLANO_CONFIG).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {p.descricao && <p className={cn("text-xs line-clamp-2", txtMuted)}>{p.descricao}</p>}
                      {(p.data_inicio || p.data_fim) && (
                        <p className={cn("text-[10px] mt-1", txtMuted)}>
                          {p.data_inicio && format(parseISO(p.data_inicio), "dd/MM")} — {p.data_fim && format(parseISO(p.data_fim), "dd/MM")}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", darkBg && "text-white/50 hover:bg-white/10")} onClick={() => deletePlano.mutate(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Dialogs */}
      <NovaRegraDialog
        open={showRegraDialog}
        onOpenChange={setShowRegraDialog}
        secaoNome={regraSecaoId ? secoes.find((s) => s.id === regraSecaoId)?.nome : undefined}
        onSave={(data) => {
          createRegra.mutate({ projeto_id: projetoId, secao_id: regraSecaoId, ...data });
          setShowRegraDialog(false);
        }}
      />
      <NovoPlanoDialog
        open={showPlanoDialog}
        onOpenChange={setShowPlanoDialog}
        onSave={(data) => {
          createPlano.mutate({ projeto_id: projetoId, ...data });
          setShowPlanoDialog(false);
        }}
      />
      <NovaTarefaMetaDialog
        open={showTarefaMetaDialog}
        onOpenChange={setShowTarefaMetaDialog}
        tarefaNome={metaTarefaId ? tarefas.find((t) => t.id === metaTarefaId)?.titulo : undefined}
        onSave={(data) => {
          if (metaTarefaId) {
            createTarefaMeta.mutate({ projeto_id: projetoId, tarefa_id: metaTarefaId, ...data });
          }
          setShowTarefaMetaDialog(false);
        }}
      />
    </div>
  );
}

// ─── Regra Card (reused for global and section) ───
function RegraCard({ regra, passed, darkBg, onToggle, onDelete }: {
  regra: CalendarioRegra;
  passed: boolean;
  darkBg: boolean;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
}) {
  const txt = darkBg ? "text-white" : "text-foreground";
  const txtMuted = darkBg ? "text-white/60" : "text-muted-foreground";
  const sectionBg = darkBg ? "bg-white/[0.03]" : "bg-muted/30";
  const borderColor = darkBg ? "border-white/10" : "border-border";

  return (
    <div className={cn("rounded-lg p-3 flex items-center gap-3 border", sectionBg, borderColor)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("text-xs font-medium truncate", txt)}>{regra.titulo}</span>
          {regra.ativo ? (
            <Badge variant={passed ? "success" : "destructive"} className="text-[10px] h-4 shrink-0">
              {passed ? "✅ Cumprida" : "❌ Violada"}
            </Badge>
          ) : (
            <Badge variant="ghost" className="text-[10px] h-4">Inativa</Badge>
          )}
        </div>
        <p className={cn("text-[10px]", txtMuted)}>
          {TIPO_LABELS[regra.tipo] || regra.tipo} {regra.operador} {regra.valor}{regra.tipo === "percentual_conclusao" ? "%" : ""} • {regra.periodo}
        </p>
      </div>
      <Switch checked={regra.ativo} onCheckedChange={onToggle} className="scale-75" />
      <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", darkBg && "text-white/50 hover:bg-white/10")} onClick={onDelete}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Section Table (Collapsible) with regras + task metas ───
function SectionTable({ secao, tarefas, concluidas, percentual, regras, secaoKpis, metasByTarefa, darkBg, onAddRegra, onToggleRegra, onDeleteRegra, evaluateRegra, onAddTarefaMeta, onToggleTarefaMeta, onDeleteTarefaMeta }: {
  secao: ProjetoSecao;
  tarefas: ProjetoTarefa[];
  concluidas: number;
  percentual: number;
  regras: CalendarioRegra[];
  secaoKpis: any;
  metasByTarefa: Record<string, TarefaMetaCalendario[]>;
  darkBg: boolean;
  onAddRegra: () => void;
  onToggleRegra: (id: string, checked: boolean) => void;
  onDeleteRegra: (id: string) => void;
  evaluateRegra: (r: CalendarioRegra) => boolean;
  onAddTarefaMeta: (tarefaId: string) => void;
  onToggleTarefaMeta: (id: string, cumprida: boolean) => void;
  onDeleteTarefaMeta: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const txt = darkBg ? "text-white" : "text-foreground";
  const txtMuted = darkBg ? "text-white/60" : "text-muted-foreground";
  const borderColor = darkBg ? "border-white/10" : "border-border";
  const headerBg = darkBg ? "bg-white/[0.05]" : "bg-muted/50";
  const sectionBg = darkBg ? "bg-white/[0.03]" : "bg-muted/30";
  const now = new Date();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn("rounded-lg border overflow-hidden", borderColor)}>
        <CollapsibleTrigger asChild>
          <button className={cn("w-full flex items-center gap-3 px-4 py-3 transition-colors", headerBg, darkBg ? "hover:bg-white/[0.08]" : "hover:bg-muted/70")}>
            <ChevronDown className={cn("h-4 w-4 transition-transform shrink-0", !open && "-rotate-90", darkBg ? "text-white/50" : "text-muted-foreground")} />
            <span className={cn("text-sm font-medium", txt)}>{secao.nome}</span>
            <Badge variant="secondary" className="text-[10px] h-4">{tarefas.length} tarefas</Badge>
            <div className="flex-1 mx-3">
              <Progress value={percentual} className="h-1.5" />
            </div>
            <span className={cn("text-xs font-medium shrink-0", txt)}>{concluidas}/{tarefas.length} ({percentual}%)</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {/* Section-level regras */}
          <div className={cn("px-4 py-2 border-b flex items-center gap-2 flex-wrap", borderColor, sectionBg)}>
            <Target className={cn("h-3 w-3 shrink-0", txtMuted)} />
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", txtMuted)}>Metas da seção</span>
            {regras.map((r) => {
              const passed = evaluateRegra(r);
              return (
                <div key={r.id} className="flex items-center gap-1">
                  <Badge variant={r.ativo ? (passed ? "success" : "destructive") : "ghost"} className="text-[10px] h-4">
                    {r.ativo ? (passed ? "✅" : "❌") : "⏸️"} {r.titulo}
                  </Badge>
                  <button className={cn("text-[10px] opacity-50 hover:opacity-100", darkBg ? "text-white" : "text-foreground")} onClick={() => onDeleteRegra(r.id)}>×</button>
                </div>
              );
            })}
            <Button variant="ghost" size="sm" className={cn("h-5 text-[10px] px-1.5 gap-0.5", darkBg && "text-white/50 hover:bg-white/10")} onClick={(e) => { e.stopPropagation(); onAddRegra(); }}>
              <Plus className="h-2.5 w-2.5" /> Meta
            </Button>
          </div>

          {tarefas.length === 0 ? (
            <p className={cn("text-xs text-center py-4", txtMuted)}>Sem tarefas neste período</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className={cn(borderColor)}>
                  <TableHead className={cn("text-xs", txtMuted)}>Tarefa</TableHead>
                  <TableHead className={cn("text-xs w-[120px]", txtMuted)}>Status</TableHead>
                  <TableHead className={cn("text-xs w-[80px]", txtMuted)}>Prazo</TableHead>
                  <TableHead className={cn("text-xs w-[100px]", txtMuted)}>Estágio</TableHead>
                  <TableHead className={cn("text-xs w-[120px]", txtMuted)}>Responsável</TableHead>
                  <TableHead className={cn("text-xs w-[140px]", txtMuted)}>Metas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tarefas.map((t) => {
                  const isOverdue = t.status !== "concluida" && t.data_prazo && isBefore(parseISO(t.data_prazo), now);
                  const diasAndamento = t.status === "em_andamento" ? differenceInDays(now, parseISO(t.updated_at || t.created_at)) : null;
                  const estagioLabel = ESTAGIO_LABELS[t.estagio || ""] || "—";
                  const estagioColors = darkBg
                    ? (ESTAGIO_COLORS[t.estagio || ""] || "bg-white/10 text-white/50")
                    : (ESTAGIO_COLORS_LIGHT[t.estagio || ""] || "bg-muted text-muted-foreground");
                  const taskMetas = metasByTarefa[t.id] || [];

                  return (
                    <TableRow key={t.id} className={cn(borderColor, darkBg ? "hover:bg-white/[0.03]" : "hover:bg-muted/30")}>
                      <TableCell className={cn("text-xs font-medium py-2", txt)}>
                        <div className="flex flex-col gap-0.5">
                          <span className={cn(t.status === "concluida" && "line-through opacity-60")}>{t.titulo}</span>
                          {diasAndamento !== null && diasAndamento > 7 && (
                            <span className="text-[10px] text-amber-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {diasAndamento}d em andamento
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant={STATUS_BADGE_VARIANT[t.status] || "secondary"} className={cn("text-[10px] h-5", isOverdue && "border-red-500/50")}>
                          {isOverdue && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                          {STATUS_LABELS[t.status] || t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn("text-xs py-2", isOverdue ? "text-red-500 font-medium" : txtMuted)}>
                        {t.data_prazo ? format(parseISO(t.data_prazo), "dd/MM") : "—"}
                      </TableCell>
                      <TableCell className="py-2">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", estagioColors)}>
                          {estagioLabel}
                        </span>
                      </TableCell>
                      <TableCell className="py-2">
                        {t.responsavel ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={t.responsavel.avatar_url || undefined} />
                              <AvatarFallback className="text-[8px]">{t.responsavel.nome?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className={cn("text-xs truncate max-w-[80px]", txtMuted)}>{t.responsavel.nome}</span>
                          </div>
                        ) : (
                          <span className={cn("text-xs", txtMuted)}>—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-col gap-0.5">
                          {taskMetas.map((m) => (
                            <div key={m.id} className="flex items-center gap-1">
                              <Checkbox
                                checked={m.cumprida}
                                onCheckedChange={(checked) => onToggleTarefaMeta(m.id, !!checked)}
                                className="h-3 w-3"
                              />
                              <span className={cn("text-[10px] truncate max-w-[90px]", m.cumprida && "line-through opacity-60", txtMuted)}>{m.titulo}</span>
                              <button className={cn("text-[10px] opacity-40 hover:opacity-100 shrink-0", darkBg ? "text-white" : "text-foreground")} onClick={() => onDeleteTarefaMeta(m.id)}>×</button>
                            </div>
                          ))}
                          <button
                            className={cn("text-[10px] flex items-center gap-0.5 opacity-40 hover:opacity-100 transition-opacity", darkBg ? "text-white" : "text-foreground")}
                            onClick={() => onAddTarefaMeta(t.id)}
                          >
                            <Flag className="h-2.5 w-2.5" /> meta
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── KPI Card ───
function KPICard({ label, value, icon, darkBg, accent }: { label: string; value: number | string; icon: React.ReactNode; darkBg: boolean; accent?: boolean }) {
  const bg = darkBg ? "bg-white/5 border-white/10" : "bg-card border-border";
  const txt = darkBg ? "text-white" : "text-foreground";
  const txtMuted = darkBg ? "text-white/60" : "text-muted-foreground";

  return (
    <div className={cn("rounded-lg border p-4 flex items-center gap-3", bg, accent && "border-red-500/30")}>
      {icon}
      <div>
        <p className={cn("text-lg font-bold leading-none", txt)}>{value}</p>
        <p className={cn("text-[10px] mt-0.5", txtMuted)}>{label}</p>
      </div>
    </div>
  );
}

// ─── Nova Regra Dialog ───
function NovaRegraDialog({ open, onOpenChange, secaoNome, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  secaoNome?: string;
  onSave: (data: { titulo: string; tipo: string; operador: string; valor: number; periodo: string; ativo: boolean }) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("percentual_conclusao");
  const [operador, setOperador] = useState(">=");
  const [valor, setValor] = useState("80");
  const [periodo, setPeriodo] = useState("mensal");

  const handleSave = () => {
    if (!titulo.trim()) return;
    onSave({ titulo: titulo.trim(), tipo, operador, valor: parseFloat(valor) || 0, periodo, ativo: true });
    setTitulo("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Regra de Meta{secaoNome ? ` — ${secaoNome}` : " (Projeto)"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título da regra" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual_conclusao">% Conclusão</SelectItem>
                <SelectItem value="max_atrasadas">Máx. Atrasadas</SelectItem>
                <SelectItem value="min_velocity">Mín. Velocidade</SelectItem>
                <SelectItem value="max_dias_andamento">Máx. Dias em And.</SelectItem>
                <SelectItem value="max_simultaneas_andamento">Máx. Simultâneas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={operador} onValueChange={setOperador}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value=">=">≥</SelectItem>
                <SelectItem value="<=">≤</SelectItem>
                <SelectItem value="=">=</SelectItem>
                <SelectItem value=">">{">"}</SelectItem>
                <SelectItem value="<">{"<"}</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Valor" value={valor} onChange={(e) => setValor(e.target.value)} className="text-xs" />
          </div>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mensal">Mensal</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="trimestral">Trimestral</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!titulo.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Nova Tarefa Meta Dialog ───
function NovaTarefaMetaDialog({ open, onOpenChange, tarefaNome, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tarefaNome?: string;
  onSave: (data: { titulo: string; tipo: string; valor: string | null; cumprida: boolean }) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("entrega_obrigatoria");
  const [valor, setValor] = useState("");

  const handleSave = () => {
    if (!titulo.trim()) return;
    onSave({ titulo: titulo.trim(), tipo, valor: valor.trim() || null, cumprida: false });
    setTitulo("");
    setValor("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Meta — {tarefaNome || "Tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título da meta (ex: Aprovar arte final)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TAREFA_META_TIPOS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Valor/descrição (opcional)" value={valor} onChange={(e) => setValor(e.target.value)} className="text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!titulo.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Novo Plano Dialog ───
function NovoPlanoDialog({ open, onOpenChange, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: { titulo: string; descricao: string | null; data_inicio: string | null; data_fim: string | null; status: string; responsavel_id: string | null }) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const handleSave = () => {
    if (!titulo.trim()) return;
    onSave({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
      status: "pendente",
      responsavel_id: null,
    });
    setTitulo("");
    setDescricao("");
    setDataInicio("");
    setDataFim("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Plano de Ação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título do plano" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <Textarea placeholder="Descrição (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Início</label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="text-xs" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fim</label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="text-xs" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!titulo.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
