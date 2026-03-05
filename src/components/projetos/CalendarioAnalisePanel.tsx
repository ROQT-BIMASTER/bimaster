import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  X, Plus, Target, TrendingUp, AlertTriangle, CheckCircle2,
  BarChart3, ClipboardList, Trash2, Edit2,
} from "lucide-react";
import { useProjetoCalendarioRegras, CalendarioRegra } from "@/hooks/useProjetoCalendarioRegras";
import { useProjetoPlanosAcao, PlanoAcao } from "@/hooks/useProjetoPlanosAcao";
import { ProjetoTarefa } from "@/hooks/useProjetoTarefas";
import { format, differenceInWeeks, isAfter, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  projetoId: string;
  tarefas: ProjetoTarefa[];
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
};

const STATUS_PLANO_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
  pendente: { label: "Pendente", variant: "secondary" },
  em_andamento: { label: "Em andamento", variant: "warning" },
  concluido: { label: "Concluído", variant: "success" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

export function CalendarioAnalisePanel({ projetoId, tarefas, periodoInicio, periodoFim, periodoLabel, darkBg = false, onClose }: Props) {
  const { regras, createRegra, updateRegra, deleteRegra } = useProjetoCalendarioRegras(projetoId);
  const { planos, createPlano, updatePlano, deletePlano } = useProjetoPlanosAcao(projetoId);

  const [showRegraDialog, setShowRegraDialog] = useState(false);
  const [showPlanoDialog, setShowPlanoDialog] = useState(false);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const now = new Date();
    const periodTasks = tarefas.filter((t) => {
      if (!t.data_prazo) return false;
      const d = parseISO(t.data_prazo);
      return !isBefore(d, periodoInicio) && !isAfter(d, periodoFim);
    });

    const total = periodTasks.length;
    const concluidas = periodTasks.filter((t) => t.status === "concluida").length;
    const atrasadas = periodTasks.filter((t) => {
      if (t.status === "concluida") return false;
      if (!t.data_prazo) return false;
      return isBefore(parseISO(t.data_prazo), now);
    }).length;
    const emRisco = periodTasks.filter((t) => {
      if (t.status === "concluida" || !t.data_prazo) return false;
      const d = parseISO(t.data_prazo);
      const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 0 && diffDays <= 3;
    }).length;
    const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;
    const weeks = Math.max(1, differenceInWeeks(periodoFim, periodoInicio) || 1);
    const velocidade = +(concluidas / weeks).toFixed(1);

    return { total, concluidas, atrasadas, emRisco, taxa, velocidade };
  }, [tarefas, periodoInicio, periodoFim]);

  // ── Evaluate rules ──
  const evaluateRegra = (regra: CalendarioRegra): boolean => {
    let actual: number;
    switch (regra.tipo) {
      case "percentual_conclusao": actual = kpis.taxa; break;
      case "max_atrasadas": actual = kpis.atrasadas; break;
      case "min_velocity": actual = kpis.velocidade; break;
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

  const bg = darkBg ? "bg-zinc-900/95 border-white/10" : "bg-background border-border";
  const txt = darkBg ? "text-white" : "text-foreground";
  const txtMuted = darkBg ? "text-white/60" : "text-muted-foreground";
  const cardBg = darkBg ? "bg-white/5 border-white/10" : "";
  const sectionBg = darkBg ? "bg-white/[0.03]" : "bg-muted/30";

  return (
    <div className={cn(
      "fixed inset-y-0 right-0 w-[420px] z-50 shadow-2xl border-l overflow-y-auto animate-in slide-in-from-right-5",
      bg
    )}>
      {/* Header */}
      <div className={cn("sticky top-0 z-10 flex items-center justify-between p-4 border-b backdrop-blur-sm", bg)}>
        <div>
          <h2 className={cn("font-semibold text-base", txt)}>📊 Painel de Análise</h2>
          <p className={cn("text-xs mt-0.5", txtMuted)}>{periodoLabel}</p>
        </div>
        <Button variant="ghost" size="icon" className={cn("h-8 w-8", darkBg && "text-white hover:bg-white/10")} onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* ── KPIs ── */}
        <section>
          <h3 className={cn("text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5", txtMuted)}>
            <BarChart3 className="h-3.5 w-3.5" /> KPIs do Período
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <KPICard label="Total" value={kpis.total} icon={<ClipboardList className="h-4 w-4" />} darkBg={darkBg} />
            <KPICard label="Concluídas" value={kpis.concluidas} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} darkBg={darkBg} />
            <KPICard label="Atrasadas" value={kpis.atrasadas} icon={<AlertTriangle className="h-4 w-4 text-red-500" />} darkBg={darkBg} accent={kpis.atrasadas > 0 ? "destructive" : undefined} />
            <KPICard label="Em Risco" value={kpis.emRisco} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} darkBg={darkBg} accent={kpis.emRisco > 0 ? "warning" : undefined} />
          </div>
          <div className={cn("mt-3 rounded-lg p-3", sectionBg)}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn("text-xs font-medium", txt)}>Taxa de Conclusão</span>
              <span className={cn("text-sm font-bold", txt)}>{kpis.taxa}%</span>
            </div>
            <Progress value={kpis.taxa} className="h-2" />
            <div className={cn("flex items-center justify-between mt-2 text-xs", txtMuted)}>
              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Velocidade</span>
              <span className="font-medium">{kpis.velocidade} tarefas/semana</span>
            </div>
          </div>
        </section>

        {/* ── Regras de Metas ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className={cn("text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5", txtMuted)}>
              <Target className="h-3.5 w-3.5" /> Regras de Metas
            </h3>
            <Button variant="ghost" size="sm" className={cn("h-7 text-xs gap-1", darkBg && "text-white hover:bg-white/10")} onClick={() => setShowRegraDialog(true)}>
              <Plus className="h-3 w-3" /> Nova
            </Button>
          </div>
          {regras.length === 0 ? (
            <p className={cn("text-xs text-center py-4", txtMuted)}>Nenhuma regra configurada</p>
          ) : (
            <div className="space-y-2">
              {regras.map((r) => {
                const passed = evaluateRegra(r);
                return (
                  <div key={r.id} className={cn("rounded-lg p-3 flex items-center gap-3", sectionBg)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs font-medium truncate", txt)}>{r.titulo}</span>
                        {r.ativo ? (
                          <Badge variant={passed ? "success" : "destructive"} className="text-[10px] h-4">
                            {passed ? "✅ Cumprida" : "❌ Violada"}
                          </Badge>
                        ) : (
                          <Badge variant="ghost" className="text-[10px] h-4">Inativa</Badge>
                        )}
                      </div>
                      <p className={cn("text-[10px]", txtMuted)}>
                        {TIPO_LABELS[r.tipo] || r.tipo} {r.operador} {r.valor}{r.tipo === "percentual_conclusao" ? "%" : ""} • {r.periodo}
                      </p>
                    </div>
                    <Switch
                      checked={r.ativo}
                      onCheckedChange={(checked) => updateRegra.mutate({ id: r.id, ativo: checked })}
                      className="scale-75"
                    />
                    <Button variant="ghost" size="icon" className={cn("h-6 w-6 shrink-0", darkBg && "text-white/50 hover:bg-white/10")} onClick={() => deleteRegra.mutate(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Planos de Ação ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className={cn("text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5", txtMuted)}>
              <ClipboardList className="h-3.5 w-3.5" /> Planos de Ação
            </h3>
            <Button variant="ghost" size="sm" className={cn("h-7 text-xs gap-1", darkBg && "text-white hover:bg-white/10")} onClick={() => setShowPlanoDialog(true)}>
              <Plus className="h-3 w-3" /> Novo
            </Button>
          </div>
          {planos.length === 0 ? (
            <p className={cn("text-xs text-center py-4", txtMuted)}>Nenhum plano de ação registrado</p>
          ) : (
            <div className="space-y-2">
              {planos.map((p) => {
                const cfg = STATUS_PLANO_CONFIG[p.status] || STATUS_PLANO_CONFIG.pendente;
                return (
                  <div key={p.id} className={cn("rounded-lg p-3", sectionBg)}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("text-xs font-medium", txt)}>{p.titulo}</span>
                      <div className="flex items-center gap-1">
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
                        <Button variant="ghost" size="icon" className={cn("h-5 w-5", darkBg && "text-white/50 hover:bg-white/10")} onClick={() => deletePlano.mutate(p.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {p.descricao && <p className={cn("text-[10px] line-clamp-2", txtMuted)}>{p.descricao}</p>}
                    {(p.data_inicio || p.data_fim) && (
                      <p className={cn("text-[10px] mt-1", txtMuted)}>
                        {p.data_inicio && format(parseISO(p.data_inicio), "dd/MM")} — {p.data_fim && format(parseISO(p.data_fim), "dd/MM")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Dialog Nova Regra ── */}
      <NovaRegraDialog
        open={showRegraDialog}
        onOpenChange={setShowRegraDialog}
        onSave={(data) => {
          createRegra.mutate({ projeto_id: projetoId, ...data });
          setShowRegraDialog(false);
        }}
      />

      {/* ── Dialog Novo Plano ── */}
      <NovoPlanoDialog
        open={showPlanoDialog}
        onOpenChange={setShowPlanoDialog}
        onSave={(data) => {
          createPlano.mutate({ projeto_id: projetoId, ...data });
          setShowPlanoDialog(false);
        }}
      />
    </div>
  );
}

// ─── KPI Card ───
function KPICard({ label, value, icon, darkBg, accent }: { label: string; value: number; icon: React.ReactNode; darkBg: boolean; accent?: string }) {
  const bg = darkBg ? "bg-white/5 border-white/10" : "bg-card";
  const txt = darkBg ? "text-white" : "text-foreground";
  const txtMuted = darkBg ? "text-white/60" : "text-muted-foreground";

  return (
    <Card className={cn("border", bg)}>
      <CardContent className="p-3 flex items-center gap-2.5">
        {icon}
        <div>
          <p className={cn("text-lg font-bold leading-none", txt)}>{value}</p>
          <p className={cn("text-[10px] mt-0.5", txtMuted)}>{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Nova Regra Dialog ───
function NovaRegraDialog({ open, onOpenChange, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
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
          <DialogTitle>Nova Regra de Meta</DialogTitle>
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
              <label className="text-xs text-muted-foreground">Início</label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="text-xs" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Fim</label>
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
