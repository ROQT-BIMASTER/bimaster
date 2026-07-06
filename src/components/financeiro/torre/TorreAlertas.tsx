// Fila de alertas forenses da Torre (Fase 2) — layout planilha densa.
// Detecção é determinística (motor SQL); aqui o humano TRIA: analisa, encerra com
// decisão assinada (justificativa obrigatória → trilha imutável) ou cria uma
// revisão operacional. Toda transição passa por fn_despesas_alerta_transicao.
// RLS restringe esta lista a admin/supervisor — usuário comum não vê alertas.
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle, RefreshCw, Search, Ban, ClipboardCheck, Eye, ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { MarcarRevisaoDialog } from "@/components/financeiro/MarcarRevisaoDialog";
import {
  useTorreAlertas, useTorreAlertasContagem, useAlertaTransicao, useReprocessarDeteccao,
} from "@/hooks/financeiro/useTorreAlertas";
import type { AlertaAba, AlertaSeveridade, DespesaAlerta } from "@/types/financeiro/torre-alertas";

const REGRA_LABEL: Record<string, string> = {
  R01: "Variação anômala", R02: "Fornecedor novo", R03: "Duplicidade", R04: "Fracionamento",
  R06: "Concentração", R07: "Dia não útil", R08: "Benford", R09: "Provisão inflada",
  R11: "Juros crônicos", R12: "Portador atípico", R13: "Cobrança intragrupo",
  R14: "Higiene", R15: "Fornecedor duplicado",
};
const regraLabel = (cod: string) => REGRA_LABEL[cod.slice(0, 3)] ?? cod;

const sevCls: Record<AlertaSeveridade, string> = {
  critica: "bg-destructive/10 text-destructive border border-destructive/20",
  alta: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
  media: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20",
  baixa: "bg-muted text-muted-foreground border border-border",
};
const sevLabel: Record<AlertaSeveridade, string> = {
  critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa",
};

const SEV_ORDEM: AlertaSeveridade[] = ["critica", "alta", "media", "baixa"];

const money = (v: number | null) => (v == null ? "—" : formatCurrency(v));
const fmtData = (v: string | null) => (v ? format(parseISO(v), "dd/MM/yyyy") : "—");

export function TorreAlertas() {
  const [aba, setAba] = useState<AlertaAba>("novo");
  const [busca, setBusca] = useState("");
  const [sevFiltro, setSevFiltro] = useState<AlertaSeveridade | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [expandido, setExpandido] = useState<string | null>(null);

  const { data: alertas = [], isLoading } = useTorreAlertas(aba);
  const { data: contagem } = useTorreAlertasContagem();
  const transicao = useAlertaTransicao();
  const reprocessar = useReprocessarDeteccao();

  const [encerrarAlvo, setEncerrarAlvo] = useState<DespesaAlerta | null>(null);
  const [encerrarLote, setEncerrarLote] = useState<DespesaAlerta[] | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [revisarAlvo, setRevisarAlvo] = useState<DespesaAlerta | null>(null);
  const [revisaoAberta, setRevisaoAberta] = useState(false);

  // Filtro client-side (busca + severidade)
  const alertasFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return alertas.filter((a) => {
      if (sevFiltro && a.severidade !== sevFiltro) return false;
      if (!q) return true;
      const hay = `${a.titulo} ${a.descricao ?? ""} ${a.fornecedor_nome ?? ""} ${a.regra_codigo} ${regraLabel(a.regra_codigo)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [alertas, busca, sevFiltro]);

  const idsVisiveis = alertasFiltrados.map((a) => a.id);
  const todosMarcados = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.has(id));
  const algunsMarcados = idsVisiveis.some((id) => selecionados.has(id)) && !todosMarcados;

  const toggleTodos = (checked: boolean) => {
    const next = new Set(selecionados);
    if (checked) idsVisiveis.forEach((id) => next.add(id));
    else idsVisiveis.forEach((id) => next.delete(id));
    setSelecionados(next);
  };
  const toggleUm = (id: string, checked: boolean) => {
    const next = new Set(selecionados);
    if (checked) next.add(id); else next.delete(id);
    setSelecionados(next);
  };
  const limparSelecao = () => setSelecionados(new Set());

  const alertasSelecionados = alertasFiltrados.filter((a) => selecionados.has(a.id));

  const analisar = (a: DespesaAlerta) =>
    transicao.mutate(
      { alertaId: a.id, novoStatus: "em_analise" },
      { onSuccess: () => toast.success("Alerta em análise"), onError: (e) => toast.error(e.message ?? "Falha") },
    );

  const analisarLote = () => {
    const alvos = alertasSelecionados.filter((a) => a.status === "novo");
    if (alvos.length === 0) { toast.info("Nenhum alerta novo selecionado."); return; }
    Promise.all(
      alvos.map((a) =>
        transicao.mutateAsync({ alertaId: a.id, novoStatus: "em_analise" }).catch(() => null),
      ),
    ).then(() => {
      toast.success(`${alvos.length} alerta(s) movido(s) para análise`);
      limparSelecao();
    });
  };

  const confirmarEncerrar = () => {
    const texto = justificativa.trim();
    if (!texto) { toast.error("A justificativa é obrigatória — ela fica registrada na trilha."); return; }

    if (encerrarLote) {
      Promise.all(
        encerrarLote.map((a) =>
          transicao.mutateAsync({ alertaId: a.id, novoStatus: "descartado", justificativa: texto }).catch(() => null),
        ),
      ).then(() => {
        toast.success(`${encerrarLote.length} alerta(s) encerrado(s) — decisão registrada na trilha`);
        setEncerrarLote(null);
        setJustificativa("");
        limparSelecao();
      });
      return;
    }

    if (!encerrarAlvo) return;
    transicao.mutate(
      { alertaId: encerrarAlvo.id, novoStatus: "descartado", justificativa: texto },
      {
        onSuccess: () => { toast.success("Alerta encerrado — decisão registrada na trilha"); setEncerrarAlvo(null); setJustificativa(""); },
        onError: (e) => toast.error(e.message ?? "Falha ao encerrar"),
      },
    );
  };

  const abrirRevisao = (a: DespesaAlerta) => { setRevisarAlvo(a); setRevisaoAberta(true); };

  const doReprocessar = () =>
    reprocessar.mutate(undefined, {
      onSuccess: (res) => {
        const ins = res.reduce((s, r) => s + (r.inseridos ?? 0), 0);
        const upd = res.reduce((s, r) => s + (r.atualizados ?? 0), 0);
        toast.success(`Detecção concluída: ${ins} novo(s), ${upd} atualizado(s)`);
      },
      onError: (e) => toast.error(e.message ?? "Falha ao reprocessar"),
    });

  const c = contagem ?? { novo: 0, em_analise: 0, acionado: 0, encerrado: 0 };
  const dialogEncerrarAberto = !!encerrarAlvo || !!encerrarLote;
  const dialogTitulo = encerrarLote ? `Encerrar ${encerrarLote.length} alertas` : "Encerrar alerta";
  const dialogSubtitulo = encerrarLote
    ? `A mesma justificativa será registrada na trilha imutável para todos os ${encerrarLote.length} alertas selecionados.`
    : encerrarAlvo?.titulo;

  const tabs: { id: AlertaAba; label: string; count: number }[] = [
    { id: "novo", label: "Novos", count: c.novo },
    { id: "em_analise", label: "Em análise", count: c.em_analise },
    { id: "encerrado", label: "Encerrados", count: c.encerrado },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden">
        {/* Header do bloco */}
        <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap bg-muted/30">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="text-lg font-semibold text-foreground">Alertas de risco</h2>
            </div>
            <nav className="flex gap-1">
              {tabs.map((t) => {
                const active = aba === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setAba(t.id); limparSelecao(); setExpandido(null); }}
                    className={cn(
                      "relative px-3 py-2 text-sm font-medium transition-colors",
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                    {t.count > 0 && (
                      <span className={cn(
                        "ml-1.5 text-[11px] tabular-nums",
                        active ? "text-primary font-semibold" : "text-muted-foreground",
                      )}>
                        ({t.count.toLocaleString("pt-BR")})
                      </span>
                    )}
                    {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar fornecedor ou regra…"
                className="pl-8 h-9 w-64 text-sm"
              />
            </div>
            <Button
              size="sm" variant="outline" className="h-9 gap-1.5"
              disabled={reprocessar.isPending} onClick={doReprocessar}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", reprocessar.isPending && "animate-spin")} />
              {reprocessar.isPending ? "Reprocessando…" : "Reprocessar"}
            </Button>
          </div>
        </div>

        {/* Filtros por severidade */}
        <div className="px-4 md:px-6 py-2 border-b border-border flex items-center gap-1.5 flex-wrap bg-card">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
            Severidade
          </span>
          <button
            type="button"
            onClick={() => setSevFiltro(null)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
              sevFiltro === null
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent text-muted-foreground border-border hover:text-foreground",
            )}
          >
            Todas
          </button>
          {SEV_ORDEM.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSevFiltro(sevFiltro === s ? null : s)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors",
                sevFiltro === s ? sevCls[s] : "text-muted-foreground border border-border hover:text-foreground",
              )}
            >
              {sevLabel[s]}
            </button>
          ))}
        </div>

        {/* Barra de seleção em lote */}
        {alertasSelecionados.length > 0 && (
          <div className="px-4 md:px-6 py-2 bg-primary/5 border-b border-primary/20 flex items-center justify-between text-xs font-medium text-foreground flex-wrap gap-2">
            <div className="flex items-center gap-4">
              <span>{alertasSelecionados.length} item(ns) selecionado(s)</span>
              <button type="button" onClick={limparSelecao} className="text-primary hover:underline">
                Limpar seleção
              </button>
            </div>
            <div className="flex gap-2">
              {aba === "novo" && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={analisarLote}>
                  Mover para análise
                </Button>
              )}
              {aba !== "encerrado" && (
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setEncerrarLote(alertasSelecionados)}
                >
                  Encerrar em lote
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Planilha */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded" />
              ))}
            </div>
          ) : alertasFiltrados.length === 0 ? (
            <div className="text-center py-14 text-sm text-muted-foreground">
              {alertas.length === 0
                ? (aba === "novo"
                    ? "Nenhum alerta novo. Rode a detecção (Reprocessar) ou aguarde o ciclo diário."
                    : "Nada aqui.")
                : "Nenhum alerta corresponde aos filtros atuais."}
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-muted/50 z-10">
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="w-10 pl-4">
                    <Checkbox
                      checked={todosMarcados || (algunsMarcados ? "indeterminate" : false)}
                      onCheckedChange={(v) => toggleTodos(!!v)}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead className="w-6 p-0"></TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Severidade</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Regra</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Fornecedor</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Competência</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Títulos</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">Valor em risco</TableHead>
                  <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center w-24 pr-4">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertasFiltrados.map((a) => {
                  const encerrado = a.status === "resolvido" || a.status === "descartado";
                  const busy = transicao.isPending && transicao.variables?.alertaId === a.id;
                  const marcado = selecionados.has(a.id);
                  const aberto = expandido === a.id;
                  const evid = Object.entries(a.evidencia ?? {}).slice(0, 12);

                  return (
                    <>
                      <TableRow
                        key={a.id}
                        className={cn(
                          "group text-sm border-border hover:bg-muted/40 cursor-pointer",
                          marcado && "bg-primary/5",
                        )}
                        onClick={() => setExpandido(aberto ? null : a.id)}
                      >
                        <TableCell className="pl-4 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={marcado}
                            onCheckedChange={(v) => toggleUm(a.id, !!v)}
                            aria-label="Selecionar alerta"
                          />
                        </TableCell>
                        <TableCell className="p-0 text-muted-foreground">
                          {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </TableCell>
                        <TableCell className="py-2">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            sevCls[a.severidade],
                          )}>
                            {sevLabel[a.severidade]}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="max-w-[280px]">
                                <div className="font-medium text-foreground truncate">{regraLabel(a.regra_codigo)}</div>
                                <div className="text-[11px] text-muted-foreground truncate">{a.titulo}</div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-sm">
                              <div className="font-mono text-[10px] text-muted-foreground">{a.regra_codigo}</div>
                              <div className="text-xs">{a.titulo}</div>
                              {a.descricao && <div className="text-[11px] text-muted-foreground mt-1">{a.descricao}</div>}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="py-2 text-muted-foreground max-w-[240px] truncate">
                          {a.fornecedor_nome ?? "—"}
                        </TableCell>
                        <TableCell className="py-2 text-muted-foreground tabular-nums">
                          {fmtData(a.competencia)}
                        </TableCell>
                        <TableCell className="py-2 text-right text-muted-foreground tabular-nums">
                          {a.conta_ids?.length ?? 0}
                        </TableCell>
                        <TableCell className="py-2 text-right font-semibold text-foreground tabular-nums font-mono">
                          {money(a.valor_impacto)}
                        </TableCell>
                        <TableCell className="py-2 pr-4" onClick={(e) => e.stopPropagation()}>
                          {encerrado ? (
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block text-center">
                              {a.status === "descartado" ? "Encerrado" : "Resolvido"}
                            </span>
                          ) : (
                            <div className="flex justify-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                              {a.status === "novo" && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy} onClick={() => analisar(a)}>
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Analisar</TooltipContent>
                                </Tooltip>
                              )}
                              {a.status === "em_analise" && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={busy} onClick={() => abrirRevisao(a)}>
                                      <ClipboardCheck className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Marcar para revisão</TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon" variant="ghost"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    disabled={busy} onClick={() => setEncerrarAlvo(a)}
                                  >
                                    <Ban className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Encerrar</TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      {aberto && (
                        <TableRow key={`${a.id}-exp`} className="bg-muted/20 hover:bg-muted/20 border-border">
                          <TableCell colSpan={9} className="py-3 px-4 md:px-6">
                            <div className="space-y-2">
                              {a.descricao && (
                                <p className="text-xs text-muted-foreground">{a.descricao}</p>
                              )}
                              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                                {a.ocorrencias > 1 && <span>{a.ocorrencias}× detectado</span>}
                                {a.score !== null && <span>Score {a.score.toFixed(1)}</span>}
                                <span>Detectado em {fmtData(a.primeiro_detectado_em?.slice(0, 10))}</span>
                                {encerrado && a.resolucao_nota && (
                                  <span className="italic">“{a.resolucao_nota}”</span>
                                )}
                              </div>
                              {evid.length > 0 && (
                                <div className="rounded-lg bg-muted/40 p-2 text-[11px] font-mono text-muted-foreground grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0.5">
                                  {evid.map(([k, v]) => (
                                    <div key={k} className="truncate">
                                      <span className="text-foreground/70">{k}:</span> {String(v)}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Rodapé de contagem */}
        {!isLoading && alertasFiltrados.length > 0 && (
          <div className="px-4 md:px-6 py-3 border-t border-border text-xs text-muted-foreground bg-muted/30">
            Exibindo {alertasFiltrados.length.toLocaleString("pt-BR")} de {alertas.length.toLocaleString("pt-BR")} alertas
            {busca || sevFiltro ? " (filtrado)" : ""}
          </div>
        )}
      </div>

      {/* Encerrar (individual ou lote) — justificativa obrigatória */}
      <Dialog
        open={dialogEncerrarAberto}
        onOpenChange={(o) => {
          if (!o) { setEncerrarAlvo(null); setEncerrarLote(null); setJustificativa(""); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitulo}</DialogTitle>
            <DialogDescription>
              A justificativa fica registrada na trilha de auditoria imutável (quem, quando, por quê). Descreva a decisão: falso positivo, aceito como legítimo, ou providência tomada.
            </DialogDescription>
          </DialogHeader>
          {dialogSubtitulo && (
            <div className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-2">{dialogSubtitulo}</div>
          )}
          <Textarea
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={4}
            placeholder="Ex.: Recorrência legítima do contrato X; ou enviado à auditoria; ou negociado redução com o fornecedor."
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => { setEncerrarAlvo(null); setEncerrarLote(null); setJustificativa(""); }}
            >
              Cancelar
            </Button>
            <Button variant="destructive" disabled={transicao.isPending} onClick={confirmarEncerrar}>
              Encerrar e registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {revisarAlvo && (
        <MarcarRevisaoDialog
          open={revisaoAberta}
          onOpenChange={(o) => { setRevisaoAberta(o); if (!o) setRevisarAlvo(null); }}
          contaId={revisarAlvo.conta_ids?.[0]}
          planoContasId={revisarAlvo.plano_contas_id ?? undefined}
          departamentoId={revisarAlvo.departamento_id ?? undefined}
          valorAtual={revisarAlvo.valor_impacto ?? 0}
          nomeItem={revisarAlvo.titulo}
          fornecedorNome={revisarAlvo.fornecedor_nome ?? undefined}
          fornecedorCodigo={revisarAlvo.fornecedor_codigo ?? undefined}
          onSuccess={() => toast.success("Revisão criada na fila operacional")}
        />
      )}
    </TooltipProvider>
  );
}
