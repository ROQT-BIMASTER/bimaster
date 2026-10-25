import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Plus, Receipt, Trophy, Users } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MesSelector } from "@/components/quadra/MesSelector";
import { QuadraKpiCards } from "@/components/quadra/QuadraKpiCards";
import { QuadraFluxoMensalChart } from "@/components/quadra/QuadraFluxoMensalChart";
import { LancamentoFormDialog } from "@/components/quadra/LancamentoFormDialog";
import { ReservaFormDialog } from "@/components/quadra/ReservaFormDialog";
import { StatusLancamentoBadge } from "@/components/quadra/QuadraBadges";
import { useQuadraLancamentosPeriodo } from "@/hooks/quadra/useQuadraLancamentos";
import { useQuadraReservas } from "@/hooks/quadra/useQuadraReservas";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate, todayBR } from "@/lib/utils/parseLocalDate";
import { formatHora, labelCategoria } from "@/lib/quadra/categorias";
import {
  calcularResumo,
  chaveMes,
  chaveMesDeDate,
  intervaloMes,
  isLancamentoAtrasado,
  serieMensal,
  totaisPorCategoria,
} from "@/lib/quadra/resumoFinanceiro";
import type { QuadraTipoLancamento } from "@/types/quadra";

const MESES_GRAFICO = 6;

function fmtData(iso: string, padrao = "dd/MM"): string {
  const d = parseLocalDate(iso);
  return d ? format(d, padrao, { locale: ptBR }) : iso;
}

export default function QuadraDashboardPage() {
  const [mes, setMes] = useState(() => chaveMesDeDate(new Date()));
  const [novoLancamento, setNovoLancamento] = useState<QuadraTipoLancamento | null>(null);
  const [novaReserva, setNovaReserva] = useState(false);

  // Período do gráfico: últimos N meses até o mês selecionado
  const periodo = useMemo(() => {
    const fimMes = intervaloMes(mes).fim;
    const inicioRef = parseLocalDate(`${mes}-01`) ?? new Date();
    const inicio = format(subMonths(inicioRef, MESES_GRAFICO - 1), "yyyy-MM-01");
    return { inicio, fim: fimMes };
  }, [mes]);

  const { data: lancamentos = [], isLoading } = useQuadraLancamentosPeriodo(periodo.inicio, periodo.fim);

  const hoje = todayBR();
  const { data: proximasReservas = [], isLoading: loadingReservas } = useQuadraReservas({
    inicio: hoje,
    status: "confirmada",
  });

  const doMes = useMemo(() => lancamentos.filter((l) => chaveMes(l.data_competencia) === mes), [lancamentos, mes]);
  const resumo = useMemo(() => calcularResumo(doMes), [doMes]);
  const serie = useMemo(() => serieMensal(lancamentos, mes, MESES_GRAFICO), [lancamentos, mes]);
  const topDespesas = useMemo(() => totaisPorCategoria(doMes, "despesa").slice(0, 5), [doMes]);
  const topReceitas = useMemo(() => totaisPorCategoria(doMes, "receita").slice(0, 5), [doMes]);

  const pendencias = useMemo(
    () =>
      lancamentos
        .filter((l) => l.status === "pendente")
        .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
        .slice(0, 8),
    [lancamentos],
  );

  return (
    <DashboardLayout>
      <div className="w-full space-y-4 px-4 py-6 md:px-6">
        <PageHeader
          title="Quadra de Futebol"
          description="Visão financeira da quadra: receitas, despesas, reservas e mensalistas"
          icon={Trophy}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <MesSelector mes={mes} onChange={setMes} />
              <Button size="sm" variant="outline" onClick={() => setNovaReserva(true)}>
                <CalendarDays className="mr-1 h-4 w-4" /> Reserva
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNovoLancamento("despesa")}>
                <Plus className="mr-1 h-4 w-4" /> Despesa
              </Button>
              <Button size="sm" onClick={() => setNovoLancamento("receita")}>
                <Plus className="mr-1 h-4 w-4" /> Receita
              </Button>
            </div>
          }
        />

        <QuadraKpiCards resumo={resumo} loading={isLoading} />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <QuadraFluxoMensalChart dados={serie} loading={isLoading} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Por categoria no mês</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <>
                  <ListaCategorias titulo="Receitas" itens={topReceitas} tom="text-success" />
                  <ListaCategorias titulo="Despesas" itens={topDespesas} tom="text-destructive" />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Próximos vencimentos</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/quadra/lancamentos"><Receipt className="mr-1 h-4 w-4" /> Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : pendencias.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma pendência no período.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {pendencias.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{l.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {labelCategoria(l.categoria)} · vence {fmtData(l.data_vencimento)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`tabular-nums ${l.tipo === "receita" ? "text-success" : "text-destructive"}`}>
                          {l.tipo === "receita" ? "+" : "-"}{formatCurrency(l.valor)}
                        </span>
                        <StatusLancamentoBadge lancamento={l} atrasado={isLancamentoAtrasado(l)} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Próximas reservas</CardTitle>
              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="sm">
                  <Link to="/dashboard/quadra/mensalistas"><Users className="mr-1 h-4 w-4" /> Mensalistas</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/dashboard/quadra/reservas"><CalendarDays className="mr-1 h-4 w-4" /> Agenda</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingReservas ? (
                <Skeleton className="h-40 w-full" />
              ) : proximasReservas.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma reserva confirmada a partir de hoje.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {proximasReservas.slice(0, 8).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.cliente_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtData(r.data, "EEE, dd/MM")} · {formatHora(r.horario_inicio)} às {formatHora(r.horario_fim)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="tabular-nums">{formatCurrency(r.valor)}</span>
                        <span className={`text-xs ${r.status_pagamento === "pago" ? "text-success" : "text-warning"}`}>
                          {r.status_pagamento === "pago" ? "Pago" : "A receber"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <LancamentoFormDialog
        open={novoLancamento !== null}
        onOpenChange={(o) => !o && setNovoLancamento(null)}
        tipoInicial={novoLancamento ?? "receita"}
      />
      <ReservaFormDialog open={novaReserva} onOpenChange={setNovaReserva} />
    </DashboardLayout>
  );
}

function ListaCategorias({
  titulo,
  itens,
  tom,
}: {
  titulo: string;
  itens: { categoria: string; total: number }[];
  tom: string;
}) {
  const total = itens.reduce((s, i) => s + i.total, 0);
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem lançamentos.</p>
      ) : (
        <ul className="space-y-1.5">
          {itens.map((i) => {
            const pct = total > 0 ? Math.round((i.total / total) * 100) : 0;
            return (
              <li key={i.categoria} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{labelCategoria(i.categoria)}</span>
                  <span className={`shrink-0 tabular-nums ${tom}`}>{formatCurrency(i.total)}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
