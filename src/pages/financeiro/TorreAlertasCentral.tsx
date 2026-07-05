// Central de Alertas — Torre de Despesas.
// Lista/filtra tudo que a detecção gerou em public.despesa_alertas e mostra,
// por alerta, a evidência bruta + trilha imutável de transições
// (public.despesa_alertas_eventos). Toda decisão é registrada via
// fn_despesas_alerta_transicao (RPC SECURITY DEFINER).
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Search,
  X,
  Filter,
  ClipboardCheck,
  Ban,
  History,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useAlertasCentral, useAlertaHistorico, useAlertaTransicao,
  type AlertaFiltrosCentral, type DespesaAlertaEvento,
} from "@/hooks/financeiro/useTorreAlertas";
import type {
  AlertaSeveridade, AlertaStatus, DespesaAlerta,
} from "@/types/financeiro/torre-alertas";

const REGRA_LABEL: Record<string, string> = {
  R01: "Variação anômala", R02: "Fornecedor novo", R03: "Duplicidade",
  R04: "Fracionamento", R06: "Concentração", R07: "Dia não útil",
  R08: "Benford", R09: "Provisão inflada", R11: "Juros crônicos",
  R12: "Portador atípico", R13: "Cobrança intragrupo", R14: "Higiene",
  R15: "Fornecedor duplicado",
};
const REGRAS_LISTA = Object.keys(REGRA_LABEL);
const regraLabel = (cod: string) => REGRA_LABEL[cod.slice(0, 3)] ?? cod;

const SEVERIDADES: AlertaSeveridade[] = ["critica", "alta", "media", "baixa"];
const STATUSES: AlertaStatus[] = ["novo", "em_analise", "acionado", "resolvido", "descartado"];

const sevCls: Record<AlertaSeveridade, string> = {
  critica: "bg-destructive text-destructive-foreground",
  alta: "bg-destructive/15 text-destructive border border-destructive/30",
  media: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30",
  baixa: "bg-muted text-muted-foreground",
};
const sevLabel: Record<AlertaSeveridade, string> = {
  critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa",
};
const statusLabel: Record<AlertaStatus, string> = {
  novo: "Novo", em_analise: "Em análise", acionado: "Acionado",
  resolvido: "Resolvido", descartado: "Encerrado",
};
const statusCls: Record<AlertaStatus, string> = {
  novo: "bg-destructive/15 text-destructive border border-destructive/30",
  em_analise: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30",
  acionado: "bg-primary/15 text-primary border border-primary/30",
  resolvido: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30",
  descartado: "bg-muted text-muted-foreground border border-border",
};

const money = (v: number | null) => (v == null ? "—" : formatCurrency(v));
const fmtData = (v: string | null) => (v ? format(parseISO(v), "dd/MM/yyyy") : "—");
const fmtDataHora = (v: string | null) =>
  v ? format(parseISO(v), "dd/MM/yyyy HH:mm") : "—";

const FILTROS_VAZIO: AlertaFiltrosCentral = {
  severidades: [], statuses: [], regras: [], empresaIds: [],
  competenciaDe: null, competenciaAte: null, busca: "",
};

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

interface EmpresaOpc { id: number; nome: string }

function MultiPopover({
  label, count, children,
}: { label: string; count: number; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <Filter className="h-3.5 w-3.5" />
          {label}
          {count > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{count}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">{children}</PopoverContent>
    </Popover>
  );
}

function HistoricoTrilha({ alertaId }: { alertaId: string }) {
  const { data: eventos = [], isLoading } = useAlertaHistorico(alertaId);
  if (isLoading) {
    return <div className="space-y-2">{[0,1,2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }
  if (eventos.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic text-center py-6">
        Nenhuma transição registrada — o alerta ainda está no estado inicial.
      </div>
    );
  }
  return (
    <ol className="relative border-l border-border/60 ml-2 space-y-3">
      {eventos.map((ev: DespesaAlertaEvento) => (
        <li key={ev.id} className="ml-4">
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary/80 ring-4 ring-background" />
          <div className="rounded-lg border border-border/60 bg-card p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                {ev.de_status && (
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", statusCls[ev.de_status])}>
                    {statusLabel[ev.de_status]}
                  </span>
                )}
                <span className="text-muted-foreground">→</span>
                {ev.para_status && (
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", statusCls[ev.para_status])}>
                    {statusLabel[ev.para_status]}
                  </span>
                )}
              </div>
              <time className="text-[10px] text-muted-foreground font-mono">
                {fmtDataHora(ev.created_at)}
              </time>
            </div>
            {ev.nota && (
              <p className="mt-2 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                "{ev.nota}"
              </p>
            )}
            {ev.usuario_id && (
              <div className="mt-1 text-[10px] text-muted-foreground font-mono truncate">
                usuário: {ev.usuario_id}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function DetalheAlerta({
  alerta, onClose,
}: { alerta: DespesaAlerta | null; onClose: () => void }) {
  const transicao = useAlertaTransicao();
  const [encerrar, setEncerrar] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const aberto = !!alerta;
  const encerrado = alerta?.status === "resolvido" || alerta?.status === "descartado";

  const analisar = () => {
    if (!alerta) return;
    transicao.mutate(
      { alertaId: alerta.id, novoStatus: "em_analise" },
      { onSuccess: () => toast.success("Alerta em análise"), onError: (e) => toast.error(e.message ?? "Falha") },
    );
  };
  const confirmarEncerrar = () => {
    if (!alerta) return;
    const t = justificativa.trim();
    if (!t) { toast.error("A justificativa é obrigatória — fica registrada na trilha."); return; }
    transicao.mutate(
      { alertaId: alerta.id, novoStatus: "descartado", justificativa: t },
      {
        onSuccess: () => {
          toast.success("Alerta encerrado — decisão registrada na trilha");
          setEncerrar(false); setJustificativa(""); onClose();
        },
        onError: (e) => toast.error(e.message ?? "Falha"),
      },
    );
  };

  return (
    <>
      <Sheet open={aberto} onOpenChange={(v) => { if (!v) onClose(); }}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
          {alerta && (
            <>
              <SheetHeader className="p-5 border-b border-border">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", sevCls[alerta.severidade])}>
                    {sevLabel[alerta.severidade]}
                  </span>
                  <Badge variant="outline" className="text-[10px]">{regraLabel(alerta.regra_codigo)}</Badge>
                  <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", statusCls[alerta.status])}>
                    {statusLabel[alerta.status]}
                  </span>
                </div>
                <SheetTitle className="text-base leading-snug text-left">{alerta.titulo}</SheetTitle>
                {alerta.descricao && (
                  <SheetDescription className="text-left">{alerta.descricao}</SheetDescription>
                )}
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Em risco</div>
                      <div className="text-lg font-bold tabular-nums font-mono">{money(alerta.valor_impacto)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</div>
                      <div className="text-lg font-bold tabular-nums font-mono">{alerta.score?.toFixed(2) ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fornecedor</div>
                      <div className="truncate">{alerta.fornecedor_nome ?? "—"}</div>
                      {alerta.fornecedor_codigo && (
                        <div className="text-[10px] text-muted-foreground font-mono">{alerta.fornecedor_codigo}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Competência</div>
                      <div>{fmtData(alerta.competencia)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">1º detectado</div>
                      <div>{fmtDataHora(alerta.primeiro_detectado_em)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Último detectado</div>
                      <div>{fmtDataHora(alerta.ultimo_detectado_em)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Ocorrências</div>
                      <div>{alerta.ocorrencias}× (reabriu {alerta.reaberto_count}×)</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Títulos vinculados</div>
                      <div>{alerta.conta_ids?.length ?? 0}</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Evidência
                    </h4>
                    <div className="rounded-lg bg-muted/40 p-3 text-[11px] font-mono grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                      {Object.entries(alerta.evidencia ?? {}).map(([k, v]) => (
                        <div key={k} className="truncate">
                          <span className="text-foreground/60">{k}:</span>{" "}
                          <span className="text-foreground">{String(v)}</span>
                        </div>
                      ))}
                      {Object.keys(alerta.evidencia ?? {}).length === 0 && (
                        <div className="text-muted-foreground italic">sem evidência estruturada</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" /> Trilha de transições
                    </h4>
                    <HistoricoTrilha alertaId={alerta.id} />
                  </div>

                  {encerrado && alerta.resolucao_nota && (
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Justificativa de encerramento
                      </div>
                      <p className="text-xs whitespace-pre-wrap">"{alerta.resolucao_nota}"</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {!encerrado && (
                <div className="p-4 border-t border-border flex items-center gap-2 flex-wrap bg-card">
                  {alerta.status === "novo" && (
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={transicao.isPending} onClick={analisar}>
                      <Search className="h-3.5 w-3.5" /> Colocar em análise
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive ml-auto"
                    disabled={transicao.isPending} onClick={() => setEncerrar(true)}>
                    <Ban className="h-3.5 w-3.5" /> Encerrar com justificativa
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={encerrar} onOpenChange={setEncerrar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar alerta</DialogTitle>
            <DialogDescription>
              A justificativa é obrigatória e será registrada na trilha imutável do alerta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="just">Justificativa</Label>
            <Textarea id="just" rows={4} value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: duplicidade confirmada como pagamentos distintos (nota fiscal diferente)." />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEncerrar(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarEncerrar} disabled={transicao.isPending}>
              <ClipboardCheck className="h-4 w-4 mr-1.5" /> Registrar encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function TorreAlertasCentral() {
  const [f, setF] = useState<AlertaFiltrosCentral>(FILTROS_VAZIO);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<DespesaAlerta | null>(null);

  // debounce simples da busca
  useMemo(() => {
    const t = setTimeout(() => setF((p) => ({ ...p, busca })), 300);
    return () => clearTimeout(t);
  }, [busca]);

  const { data: alertas = [], isLoading } = useAlertasCentral(f);
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-torre-alertas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id, nome").order("nome");
      if (error) throw error;
      return (data ?? []) as EmpresaOpc[];
    },
    staleTime: 5 * 60_000,
  });

  const totalImpacto = useMemo(
    () => alertas.reduce((s, a) => s + (a.valor_impacto ?? 0), 0),
    [alertas],
  );

  const temFiltro =
    f.severidades.length + f.statuses.length + f.regras.length + f.empresaIds.length > 0 ||
    !!f.competenciaDe || !!f.competenciaAte || !!f.busca;

  const limpar = () => { setBusca(""); setF(FILTROS_VAZIO); };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Central de Alertas</h1>
            <p className="text-xs text-muted-foreground">
              Torre de Despesas · detecção determinística · trilha imutável de decisões
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Alertas</div>
            <div className="text-lg font-bold tabular-nums">{alertas.length}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Em risco</div>
            <div className="text-lg font-bold tabular-nums font-mono">{formatCurrency(totalImpacto)}</div>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-border bg-card p-3 md:p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Fornecedor, título, descrição…" className="pl-9 h-9" />
          </div>

          <MultiPopover label="Severidade" count={f.severidades.length}>
            <div className="space-y-1">
              {SEVERIDADES.map((s) => (
                <label key={s} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer">
                  <Checkbox checked={f.severidades.includes(s)}
                    onCheckedChange={() => setF((p) => ({ ...p, severidades: toggle(p.severidades, s) }))} />
                  <span className="text-sm">{sevLabel[s]}</span>
                </label>
              ))}
            </div>
          </MultiPopover>

          <MultiPopover label="Status" count={f.statuses.length}>
            <div className="space-y-1">
              {STATUSES.map((s) => (
                <label key={s} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer">
                  <Checkbox checked={f.statuses.includes(s)}
                    onCheckedChange={() => setF((p) => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                  <span className="text-sm">{statusLabel[s]}</span>
                </label>
              ))}
            </div>
          </MultiPopover>

          <MultiPopover label="Regra" count={f.regras.length}>
            <ScrollArea className="h-64">
              <div className="space-y-1 pr-2">
                {REGRAS_LISTA.map((r) => (
                  <label key={r} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer">
                    <Checkbox checked={f.regras.includes(r)}
                      onCheckedChange={() => setF((p) => ({ ...p, regras: toggle(p.regras, r) }))} />
                    <span className="text-sm">
                      <span className="font-mono text-[11px] text-muted-foreground mr-1">{r}</span>
                      {REGRA_LABEL[r]}
                    </span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </MultiPopover>

          <MultiPopover label="Empresa" count={f.empresaIds.length}>
            <ScrollArea className="h-64">
              <div className="space-y-1 pr-2">
                {empresas.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer">
                    <Checkbox checked={f.empresaIds.includes(e.id)}
                      onCheckedChange={() => setF((p) => ({ ...p, empresaIds: toggle(p.empresaIds, e.id) }))} />
                    <span className="text-sm truncate">{e.nome}</span>
                  </label>
                ))}
                {empresas.length === 0 && (
                  <div className="text-xs text-muted-foreground italic p-2">Nenhuma empresa</div>
                )}
              </div>
            </ScrollArea>
          </MultiPopover>

          <div className="flex items-center gap-1.5">
            <Input type="date" value={f.competenciaDe ?? ""} className="h-9 w-[140px]"
              onChange={(e) => setF((p) => ({ ...p, competenciaDe: e.target.value || null }))} />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={f.competenciaAte ?? ""} className="h-9 w-[140px]"
              onChange={(e) => setF((p) => ({ ...p, competenciaAte: e.target.value || null }))} />
          </div>

          {temFiltro && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={limpar}>
              <X className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : alertas.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum alerta encontrado com os filtros atuais.
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(100vh-320px)]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-[100px]">Severidade</TableHead>
                  <TableHead className="w-[130px]">Regra</TableHead>
                  <TableHead>Alerta</TableHead>
                  <TableHead className="w-[200px]">Fornecedor</TableHead>
                  <TableHead className="w-[110px]">Competência</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[140px] text-right">Em risco</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertas.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelecionado(a)}>
                    <TableCell>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", sevCls[a.severidade])}>
                        {sevLabel[a.severidade]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {regraLabel(a.regra_codigo)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[420px]">
                      <div className="text-sm font-medium truncate">{a.titulo}</div>
                      {a.ocorrencias > 1 && (
                        <div className="text-[10px] text-muted-foreground">{a.ocorrencias}× detectado</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-[200px]">
                      {a.fornecedor_nome ?? <span className="text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">{fmtData(a.competencia)}</TableCell>
                    <TableCell>
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", statusCls[a.status])}>
                        {statusLabel[a.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono text-sm">
                      {money(a.valor_impacto)}
                    </TableCell>
                    <TableCell>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>

      <DetalheAlerta alerta={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}
