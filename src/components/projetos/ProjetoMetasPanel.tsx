import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { Target, TrendingUp, AlertTriangle, CheckCircle2, Clock, Plus, Trash2, Pencil } from "lucide-react";
import { useProjetoMetas, type ProjetoMeta, type NovaMeta } from "@/hooks/useProjetoMetas";
import { useProjetoTarefas } from "@/hooks/useProjetoTarefas";
import { MetasIAAssistente } from "./MetasIAAssistente";
import { format, eachDayOfInterval, parseISO, isAfter, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/hooks/useConfirm";

interface Props {
  projetoId: string;
  darkBg?: boolean;
}

const STATUS_CONFIG = {
  em_andamento: { label: "Em andamento", color: "bg-blue-500", icon: Clock, variant: "default" as const },
  em_risco: { label: "Em risco", color: "bg-amber-500", icon: AlertTriangle, variant: "default" as const },
  atrasada: { label: "Atrasada", color: "bg-destructive", icon: AlertTriangle, variant: "destructive" as const },
  concluida: { label: "Concluída", color: "bg-emerald-500", icon: CheckCircle2, variant: "secondary" as const },
};

const TIPOS_META = [
  { value: "entrega", label: "Entrega" },
  { value: "prazo", label: "Prazo" },
  { value: "qualidade", label: "Qualidade" },
  { value: "custo", label: "Custo" },
  { value: "volume", label: "Volume" },
] as const;

export function ProjetoMetasPanel({ projetoId, darkBg }: Props) {
  const confirm = useConfirm();
  const { metas, isLoading, criarMeta, atualizarMeta, removerMeta, scoreGlobal, stats } =
    useProjetoMetas(projetoId);
  const { tarefas } = useProjetoTarefas(projetoId);
  const [metaSelecionada, setMetaSelecionada] = useState<ProjetoMeta | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProjetoMeta | null>(null);

  // Burndown: tarefas restantes por dia (últimos 30 dias)
  const burndownData = useMemo(() => {
    if (!tarefas?.length) return [];
    const inicio = tarefas
      .map((t) => new Date(t.created_at))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const hoje = new Date();
    const dias = eachDayOfInterval({
      start: inicio < hoje ? inicio : hoje,
      end: hoje,
    }).slice(-30);
    const total = tarefas.length;
    return dias.map((d) => {
      const concluidasAteDia = tarefas.filter(
        (t) => t.status === "concluida" && t.updated_at && new Date(t.updated_at) <= d,
      ).length;
      const restantes = total - concluidasAteDia;
      // Linha ideal: redução linear
      const idx = dias.findIndex((x) => x.getTime() === d.getTime());
      const ideal = Math.max(0, Math.round(total - (total / Math.max(dias.length - 1, 1)) * idx));
      return {
        dia: format(d, "dd/MM", { locale: ptBR }),
        Restantes: restantes,
        Ideal: ideal,
      };
    });
  }, [tarefas]);

  // Evolução de progresso ponderado das metas
  const evolucaoData = useMemo(() => {
    return metas.map((m) => ({
      meta: m.titulo.length > 12 ? m.titulo.slice(0, 12) + "…" : m.titulo,
      Atual: Math.min(100, (m.valor_atual / Math.max(m.valor_alvo, 1)) * 100),
      Alvo: 100,
    }));
  }, [metas]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <div className="space-y-4">
        {/* Header & KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Target className="h-3.5 w-3.5" /> Score do projeto
              </div>
              <div className="mt-1 text-3xl font-bold">{scoreGlobal}</div>
              <Progress value={scoreGlobal} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Em andamento", value: stats.emAndamento, color: "text-blue-500" },
            { label: "Em risco", value: stats.emRisco, color: "text-amber-500" },
            { label: "Atrasadas", value: stats.atrasadas, color: "text-destructive" },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="text-muted-foreground text-xs">{k.label}</div>
                <div className={cn("mt-1 text-3xl font-bold", k.color)}>{k.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Burndown — tarefas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={burndownData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Ideal" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="Restantes" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Progresso das metas (%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={evolucaoData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="meta" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Atual" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="Alvo" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Lista de metas */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Metas do projeto</CardTitle>
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova meta
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando metas…</p>
            ) : metas.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhuma meta cadastrada. Comece criando sua primeira meta.
              </div>
            ) : (
              <div className="space-y-2">
                {metas.map((m) => {
                  const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.em_andamento;
                  const StatusIcon = cfg.icon;
                  const pct = Math.min(100, Math.round((m.valor_atual / Math.max(m.valor_alvo, 1)) * 100));
                  const diasRestantes = m.data_alvo
                    ? differenceInDays(parseISO(m.data_alvo), new Date())
                    : null;
                  const isSelected = metaSelecionada?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setMetaSelecionada(m)}
                      className={cn(
                        "rounded-lg border p-3 transition-all cursor-pointer hover:bg-muted/40",
                        isSelected && "border-primary bg-primary/5 shadow-sm",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-medium text-sm truncate">{m.titulo}</p>
                            <Badge variant={cfg.variant} className="text-[10px] gap-1">
                              <StatusIcon className="h-3 w-3" /> {cfg.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">
                              {TIPOS_META.find((t) => t.value === m.tipo)?.label}
                            </Badge>
                            {m.peso > 1 && (
                              <Badge variant="outline" className="text-[10px]">
                                Peso {m.peso}
                              </Badge>
                            )}
                          </div>
                          {m.descricao && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                              {m.descricao}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-1.5">
                            <span>
                              {m.valor_atual} / {m.valor_alvo} {m.unidade || ""}
                            </span>
                            {diasRestantes !== null && (
                              <span className={cn(diasRestantes < 0 && "text-destructive font-medium")}>
                                {diasRestantes >= 0
                                  ? `${diasRestantes} dia(s) restantes`
                                  : `${Math.abs(diasRestantes)} dia(s) atrasada`}
                              </span>
                            )}
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); setEditing(m); setDialogOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if ((await confirm({ title: `Remover meta "${m.titulo}"?`, destructive: true }))) removerMeta.mutate(m.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sidebar IA */}
      <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
        <MetasIAAssistente projetoId={projetoId} metaSelecionada={metaSelecionada} />
      </div>

      <MetaFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projetoId={projetoId}
        meta={editing}
        onSave={async (payload) => {
          if (editing) {
            await atualizarMeta.mutateAsync({ id: editing.id, ...payload });
          } else {
            await criarMeta.mutateAsync(payload as NovaMeta);
          }
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

function MetaFormDialog({
  open,
  onOpenChange,
  projetoId,
  meta,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projetoId: string;
  meta: ProjetoMeta | null;
  onSave: (payload: Partial<ProjetoMeta>) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState(meta?.titulo ?? "");
  const [descricao, setDescricao] = useState(meta?.descricao ?? "");
  const [tipo, setTipo] = useState<ProjetoMeta["tipo"]>(meta?.tipo ?? "entrega");
  const [valorAlvo, setValorAlvo] = useState(meta?.valor_alvo ?? 100);
  const [valorAtual, setValorAtual] = useState(meta?.valor_atual ?? 0);
  const [unidade, setUnidade] = useState(meta?.unidade ?? "%");
  const [dataAlvo, setDataAlvo] = useState(meta?.data_alvo ?? "");
  const [peso, setPeso] = useState(meta?.peso ?? 1);

  // Reset state ao abrir
  useMemo(() => {
    if (open) {
      setTitulo(meta?.titulo ?? "");
      setDescricao(meta?.descricao ?? "");
      setTipo(meta?.tipo ?? "entrega");
      setValorAlvo(meta?.valor_alvo ?? 100);
      setValorAtual(meta?.valor_atual ?? 0);
      setUnidade(meta?.unidade ?? "%");
      setDataAlvo(meta?.data_alvo ?? "");
      setPeso(meta?.peso ?? 1);
    }
  }, [open, meta]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{meta ? "Editar meta" : "Nova meta"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Entregar 5 SKUs no Q1" />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_META.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Atual</Label>
              <Input type="number" value={valorAtual} onChange={(e) => setValorAtual(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Alvo</Label>
              <Input type="number" value={valorAlvo} onChange={(e) => setValorAlvo(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="%, R$, un..." />
            </div>
            <div className="space-y-2">
              <Label>Data alvo</Label>
              <Input type="date" value={dataAlvo} onChange={(e) => setDataAlvo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Peso</Label>
              <Input type="number" min={1} max={10} value={peso} onChange={(e) => setPeso(parseInt(e.target.value) || 1)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() =>
              onSave({
                projeto_id: projetoId,
                titulo,
                descricao: descricao || null,
                tipo,
                valor_alvo: valorAlvo,
                valor_atual: valorAtual,
                unidade: unidade || null,
                data_alvo: dataAlvo || null,
                peso,
              })
            }
            disabled={!titulo.trim()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
