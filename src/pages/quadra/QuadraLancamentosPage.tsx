import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, MoreHorizontal, Pencil, Plus, Receipt, RefreshCw, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MesSelector } from "@/components/quadra/MesSelector";
import { QuadraKpiCards } from "@/components/quadra/QuadraKpiCards";
import { LancamentoFormDialog } from "@/components/quadra/LancamentoFormDialog";
import { BaixarLancamentoDialog } from "@/components/quadra/BaixarLancamentoDialog";
import { StatusLancamentoBadge, TipoLancamentoBadge } from "@/components/quadra/QuadraBadges";
import {
  useExcluirLancamento,
  useGerarMensalidades,
  useQuadraLancamentos,
} from "@/hooks/quadra/useQuadraLancamentos";
import { useConfirm } from "@/hooks/useConfirm";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { labelCategoria, labelFormaPagamento } from "@/lib/quadra/categorias";
import { calcularResumo, chaveMesDeDate, isLancamentoAtrasado } from "@/lib/quadra/resumoFinanceiro";
import type { QuadraLancamento, QuadraTipoLancamento } from "@/types/quadra";

type FiltroTipo = "todos" | QuadraTipoLancamento;
type FiltroStatus = "todos" | "pendente" | "atrasado" | "pago" | "cancelado";

function fmtData(iso: string | null): string {
  if (!iso) return "-";
  const d = parseLocalDate(iso);
  return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : iso;
}

export default function QuadraLancamentosPage() {
  const [mes, setMes] = useState(() => chaveMesDeDate(new Date()));
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [status, setStatus] = useState<FiltroStatus>("todos");
  const [busca, setBusca] = useState("");

  const [formAberto, setFormAberto] = useState(false);
  const [tipoNovo, setTipoNovo] = useState<QuadraTipoLancamento>("receita");
  const [editando, setEditando] = useState<QuadraLancamento | null>(null);
  const [baixando, setBaixando] = useState<QuadraLancamento | null>(null);

  const { data: lancamentos = [], isLoading } = useQuadraLancamentos({ mes });
  const excluir = useExcluirLancamento();
  const gerarMensalidades = useGerarMensalidades();
  const confirm = useConfirm();

  const resumo = useMemo(() => calcularResumo(lancamentos), [lancamentos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (tipo !== "todos" && l.tipo !== tipo) return false;
      if (status === "atrasado" && !isLancamentoAtrasado(l)) return false;
      if (status !== "todos" && status !== "atrasado" && l.status !== status) return false;
      if (termo) {
        const alvo = `${l.descricao} ${labelCategoria(l.categoria)} ${l.observacoes ?? ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [lancamentos, tipo, status, busca]);

  const totalFiltrado = useMemo(
    () =>
      filtrados.reduce((s, l) => {
        if (l.status === "cancelado") return s;
        return s + (l.tipo === "receita" ? l.valor : -l.valor);
      }, 0),
    [filtrados],
  );

  const abrirNovo = (t: QuadraTipoLancamento) => {
    setEditando(null);
    setTipoNovo(t);
    setFormAberto(true);
  };

  const abrirEdicao = (l: QuadraLancamento) => {
    setEditando(l);
    setFormAberto(true);
  };

  const handleExcluir = async (l: QuadraLancamento) => {
    const ok = await confirm({
      title: "Excluir lançamento",
      description: `"${l.descricao}" (${formatCurrency(l.valor)}) será removido do livro-caixa.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok) excluir.mutate(l.id);
  };

  const handleGerarMensalidades = async () => {
    const ok = await confirm({
      title: "Gerar mensalidades",
      description: "Cria uma receita pendente para cada mensalista ativo neste mês. Mensalidades já geradas não são duplicadas.",
      confirmLabel: "Gerar",
    });
    if (ok) gerarMensalidades.mutate(mes);
  };

  return (
    <DashboardLayout>
      <div className="w-full space-y-4 px-4 py-6 md:px-6">
        <PageHeader
          title="Lançamentos"
          description="Livro-caixa da quadra: receitas e despesas por competência"
          icon={Receipt}
          breadcrumbs={[{ label: "Quadra", href: "/dashboard/quadra" }, { label: "Lançamentos" }]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <MesSelector mes={mes} onChange={setMes} />
              <Button size="sm" variant="outline" onClick={handleGerarMensalidades} disabled={gerarMensalidades.isPending}>
                <RefreshCw className={`mr-1 h-4 w-4 ${gerarMensalidades.isPending ? "animate-spin" : ""}`} /> Gerar mensalidades
              </Button>
              <Button size="sm" variant="outline" onClick={() => abrirNovo("despesa")}>
                <Plus className="mr-1 h-4 w-4" /> Despesa
              </Button>
              <Button size="sm" onClick={() => abrirNovo("receita")}>
                <Plus className="mr-1 h-4 w-4" /> Receita
              </Button>
            </div>
          }
        />

        <QuadraKpiCards resumo={resumo} loading={isLoading} />

        <Card className="p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              placeholder="Buscar por descrição ou categoria"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="md:max-w-xs"
            />
            <Select value={tipo} onValueChange={(v) => setTipo(v as FiltroTipo)}>
              <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Receitas e despesas</SelectItem>
                <SelectItem value="receita">Só receitas</SelectItem>
                <SelectItem value="despesa">Só despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as FiltroStatus)}>
              <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="atrasado">Em atraso</SelectItem>
                <SelectItem value="pago">Pagos / recebidos</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto text-sm text-muted-foreground">
              {filtrados.length} lançamento(s) · saldo{" "}
              <span className={`font-medium tabular-nums ${totalFiltrado >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(totalFiltrado)}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum lançamento encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((l) => {
                    const atrasado = isLancamentoAtrasado(l);
                    const origem = l.reserva_id ? "Reserva" : l.competencia_mensalidade ? "Mensalidade" : null;
                    return (
                      <TableRow key={l.id} className={l.status === "cancelado" ? "opacity-60" : undefined}>
                        <TableCell className="whitespace-nowrap tabular-nums">{fmtData(l.data_vencimento)}</TableCell>
                        <TableCell><TipoLancamentoBadge tipo={l.tipo} /></TableCell>
                        <TableCell>
                          <p className="font-medium">{l.descricao}</p>
                          {origem && <p className="text-xs text-muted-foreground">Origem: {origem}</p>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{labelCategoria(l.categoria)}</TableCell>
                        <TableCell className={`whitespace-nowrap text-right tabular-nums ${l.tipo === "receita" ? "text-success" : "text-destructive"}`}>
                          {l.tipo === "receita" ? "+" : "-"}{formatCurrency(l.valor)}
                        </TableCell>
                        <TableCell><StatusLancamentoBadge lancamento={l} atrasado={atrasado} /></TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {l.status === "pago" ? `${fmtData(l.data_pagamento)} · ${labelFormaPagamento(l.forma_pagamento)}` : "-"}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {l.status === "pendente" && (
                                <DropdownMenuItem onClick={() => setBaixando(l)}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  {l.tipo === "receita" ? "Registrar recebimento" : "Registrar pagamento"}
                                </DropdownMenuItem>
                              )}
                              {!l.reserva_id && (
                                <DropdownMenuItem onClick={() => abrirEdicao(l)}>
                                  <Pencil className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                              )}
                              {l.reserva_id && (
                                <DropdownMenuItem asChild>
                                  <a href="/dashboard/quadra/reservas"><Pencil className="mr-2 h-4 w-4" /> Editar pela reserva</a>
                                </DropdownMenuItem>
                              )}
                              {!l.reserva_id && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleExcluir(l)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <LancamentoFormDialog
        open={formAberto}
        onOpenChange={(o) => {
          setFormAberto(o);
          if (!o) setEditando(null);
        }}
        lancamento={editando}
        tipoInicial={tipoNovo}
      />
      <BaixarLancamentoDialog lancamento={baixando} onOpenChange={(o) => !o && setBaixando(null)} />
    </DashboardLayout>
  );
}
