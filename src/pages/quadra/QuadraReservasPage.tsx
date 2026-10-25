import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CheckCircle2, MoreHorizontal, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ReservaFormDialog } from "@/components/quadra/ReservaFormDialog";
import { PagamentoReservaBadge, StatusReservaBadge } from "@/components/quadra/QuadraBadges";
import {
  useAtualizarReserva,
  useExcluirReserva,
  useQuadraReservas,
} from "@/hooks/quadra/useQuadraReservas";
import { useConfirm } from "@/hooks/useConfirm";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { formatHora, labelFormaPagamento } from "@/lib/quadra/categorias";
import { chaveMesDeDate, intervaloMes } from "@/lib/quadra/resumoFinanceiro";
import type { QuadraReserva } from "@/types/quadra";

type FiltroStatus = "todas" | QuadraReserva["status"];
type FiltroPagamento = "todos" | QuadraReserva["status_pagamento"];

function fmtData(iso: string): string {
  const d = parseLocalDate(iso);
  return d ? format(d, "EEE, dd/MM", { locale: ptBR }) : iso;
}

export default function QuadraReservasPage() {
  const [mes, setMes] = useState(() => chaveMesDeDate(new Date()));
  const [status, setStatus] = useState<FiltroStatus>("todas");
  const [pagamento, setPagamento] = useState<FiltroPagamento>("todos");
  const [busca, setBusca] = useState("");
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<QuadraReserva | null>(null);

  const periodo = useMemo(() => intervaloMes(mes), [mes]);
  const { data: reservas = [], isLoading } = useQuadraReservas({ inicio: periodo.inicio, fim: periodo.fim });
  const atualizar = useAtualizarReserva();
  const excluir = useExcluirReserva();
  const confirm = useConfirm();

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return reservas.filter((r) => {
      if (status !== "todas" && r.status !== status) return false;
      if (pagamento !== "todos" && r.status_pagamento !== pagamento) return false;
      if (termo && !`${r.cliente_nome} ${r.cliente_telefone ?? ""}`.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [reservas, status, pagamento, busca]);

  const kpis = useMemo(() => {
    const ativas = reservas.filter((r) => r.status !== "cancelada");
    const recebido = ativas.filter((r) => r.status_pagamento === "pago").reduce((s, r) => s + r.valor, 0);
    const aReceber = ativas.filter((r) => r.status_pagamento === "pendente").reduce((s, r) => s + r.valor, 0);
    const horas = ativas.reduce((s, r) => s + duracaoHoras(r), 0);
    return { qtd: ativas.length, recebido, aReceber, horas };
  }, [reservas]);

  const abrirNova = () => {
    setEditando(null);
    setFormAberto(true);
  };

  const handleExcluir = async (r: QuadraReserva) => {
    const ok = await confirm({
      title: "Excluir reserva",
      description: `A reserva de ${r.cliente_nome} em ${fmtData(r.data)} e a receita vinculada serão removidas.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok) excluir.mutate(r.id);
  };

  const handleCancelar = async (r: QuadraReserva) => {
    const ok = await confirm({
      title: "Cancelar reserva",
      description: "A receita vinculada no livro-caixa será marcada como cancelada.",
      confirmLabel: "Cancelar reserva",
      destructive: true,
    });
    if (ok) atualizar.mutate({ id: r.id, status: "cancelada" });
  };

  return (
    <DashboardLayout>
      <div className="w-full space-y-4 px-4 py-6 md:px-6">
        <PageHeader
          title="Reservas"
          description="Agenda de aluguel de horários. Cada reserva gera a receita correspondente no livro-caixa."
          icon={CalendarDays}
          breadcrumbs={[{ label: "Quadra", href: "/dashboard/quadra" }, { label: "Reservas" }]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <MesSelector mes={mes} onChange={setMes} />
              <Button size="sm" onClick={abrirNova}>
                <Plus className="mr-1 h-4 w-4" /> Nova reserva
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi titulo="Reservas no mês" valor={String(kpis.qtd)} loading={isLoading} />
          <Kpi titulo="Horas reservadas" valor={`${kpis.horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`} loading={isLoading} />
          <Kpi titulo="Recebido" valor={formatCurrency(kpis.recebido)} tom="text-success" loading={isLoading} />
          <Kpi titulo="A receber" valor={formatCurrency(kpis.aReceber)} tom="text-warning" loading={isLoading} />
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input placeholder="Buscar por cliente ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} className="md:max-w-xs" />
            <Select value={status} onValueChange={(v) => setStatus(v as FiltroStatus)}>
              <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as situações</SelectItem>
                <SelectItem value="confirmada">Confirmadas</SelectItem>
                <SelectItem value="realizada">Realizadas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pagamento} onValueChange={(v) => setPagamento(v as FiltroPagamento)}>
              <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Pagas e pendentes</SelectItem>
                <SelectItem value="pago">Pagas</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto text-sm text-muted-foreground">{filtradas.length} reserva(s)</div>
          </div>
        </Card>

        <Card>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma reserva neste mês com os filtros selecionados.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((r) => (
                    <TableRow key={r.id} className={r.status === "cancelada" ? "opacity-60" : undefined}>
                      <TableCell className="whitespace-nowrap capitalize">{fmtData(r.data)}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatHora(r.horario_inicio)} às {formatHora(r.horario_fim)}</TableCell>
                      <TableCell>
                        <p className="font-medium">{r.cliente_nome}</p>
                        {r.cliente_telefone && <p className="text-xs text-muted-foreground">{r.cliente_telefone}</p>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(r.valor)}</TableCell>
                      <TableCell><StatusReservaBadge reserva={r} /></TableCell>
                      <TableCell><PagamentoReservaBadge reserva={r} /></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{labelFormaPagamento(r.forma_pagamento)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {r.status !== "cancelada" && r.status_pagamento === "pendente" && (
                              <DropdownMenuItem onClick={() => atualizar.mutate({ id: r.id, status_pagamento: "pago" })}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como paga
                              </DropdownMenuItem>
                            )}
                            {r.status === "confirmada" && (
                              <DropdownMenuItem onClick={() => atualizar.mutate({ id: r.id, status: "realizada" })}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como realizada
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { setEditando(r); setFormAberto(true); }}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            {r.status !== "cancelada" && (
                              <DropdownMenuItem onClick={() => handleCancelar(r)}>
                                <XCircle className="mr-2 h-4 w-4" /> Cancelar reserva
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleExcluir(r)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <ReservaFormDialog
        open={formAberto}
        onOpenChange={(o) => {
          setFormAberto(o);
          if (!o) setEditando(null);
        }}
        reserva={editando}
      />
    </DashboardLayout>
  );
}

function duracaoHoras(r: QuadraReserva): number {
  const [hi, mi] = r.horario_inicio.split(":").map(Number);
  const [hf, mf] = r.horario_fim.split(":").map(Number);
  const minutos = hf * 60 + mf - (hi * 60 + mi);
  return minutos > 0 ? minutos / 60 : 0;
}

function Kpi({ titulo, valor, tom, loading }: { titulo: string; valor: string; tom?: string; loading?: boolean }) {
  return (
    <Card className="bg-card/70 backdrop-blur-sm">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
        {loading ? <Skeleton className="mt-2 h-7 w-24" /> : <p className={`mt-1 text-2xl font-semibold tabular-nums ${tom ?? ""}`}>{valor}</p>}
      </CardContent>
    </Card>
  );
}
