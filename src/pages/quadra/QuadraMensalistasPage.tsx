import { useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MensalistaFormDialog } from "@/components/quadra/MensalistaFormDialog";
import { useAtualizarMensalista, useExcluirMensalista, useQuadraMensalistas } from "@/hooks/quadra/useQuadraMensalistas";
import { useConfirm } from "@/hooks/useConfirm";
import { formatCurrency } from "@/lib/formatters";
import { formatHora, labelDiaSemana } from "@/lib/quadra/categorias";
import type { QuadraMensalista } from "@/types/quadra";

type FiltroAtivo = "todos" | "ativos" | "inativos";

export default function QuadraMensalistasPage() {
  const [filtro, setFiltro] = useState<FiltroAtivo>("ativos");
  const [busca, setBusca] = useState("");
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<QuadraMensalista | null>(null);

  const { data: mensalistas = [], isLoading } = useQuadraMensalistas();
  const atualizar = useAtualizarMensalista();
  const excluir = useExcluirMensalista();
  const confirm = useConfirm();

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return mensalistas.filter((m) => {
      if (filtro === "ativos" && !m.ativo) return false;
      if (filtro === "inativos" && m.ativo) return false;
      if (termo && !`${m.nome} ${m.telefone ?? ""} ${m.email ?? ""}`.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [mensalistas, filtro, busca]);

  const kpis = useMemo(() => {
    const ativos = mensalistas.filter((m) => m.ativo);
    return {
      ativos: ativos.length,
      receitaPrevista: ativos.reduce((s, m) => s + m.valor_mensal, 0),
      horasSemana: ativos.reduce((s, m) => s + duracaoHoras(m), 0),
    };
  }, [mensalistas]);

  const handleExcluir = async (m: QuadraMensalista) => {
    const ok = await confirm({
      title: "Excluir mensalista",
      description: `${m.nome} será removido. As mensalidades já lançadas permanecem no livro-caixa. Prefira inativar se quiser manter o histórico vinculado.`,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (ok) excluir.mutate(m.id);
  };

  return (
    <DashboardLayout>
      <div className="w-full space-y-4 px-4 py-6 md:px-6">
        <PageHeader
          title="Mensalistas"
          description="Clientes com horário fixo semanal e mensalidade recorrente"
          icon={Users}
          breadcrumbs={[{ label: "Quadra", href: "/dashboard/quadra" }, { label: "Mensalistas" }]}
          actions={
            <Button size="sm" onClick={() => { setEditando(null); setFormAberto(true); }}>
              <Plus className="mr-1 h-4 w-4" /> Novo mensalista
            </Button>
          }
        />

        <div className="grid grid-cols-3 gap-3">
          <Kpi titulo="Mensalistas ativos" valor={String(kpis.ativos)} loading={isLoading} />
          <Kpi titulo="Receita mensal prevista" valor={formatCurrency(kpis.receitaPrevista)} tom="text-success" loading={isLoading} />
          <Kpi titulo="Horas fixas por semana" valor={`${kpis.horasSemana.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`} loading={isLoading} />
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Input placeholder="Buscar por nome, telefone ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} className="md:max-w-xs" />
            <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroAtivo)}>
              <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="inativos">Inativos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto text-sm text-muted-foreground">{filtrados.length} mensalista(s)</div>
          </div>
        </Card>

        <Card>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum mensalista encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Horário fixo</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Mensalidade</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((m) => (
                    <TableRow key={m.id} className={m.ativo ? undefined : "opacity-60"}>
                      <TableCell className="font-medium">{m.nome}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {labelDiaSemana(m.dia_semana)} · {formatHora(m.horario_inicio)} às {formatHora(m.horario_fim)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.telefone && <p>{m.telefone}</p>}
                        {m.email && <p>{m.email}</p>}
                        {!m.telefone && !m.email && "-"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCurrency(m.valor_mensal)}</TableCell>
                      <TableCell className="whitespace-nowrap">Dia {m.dia_vencimento}</TableCell>
                      <TableCell>{m.ativo ? <Badge variant="success">Ativo</Badge> : <Badge variant="ghost">Inativo</Badge>}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditando(m); setFormAberto(true); }}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => atualizar.mutate({ id: m.id, ativo: !m.ativo })}>
                              {m.ativo ? "Inativar" : "Reativar"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleExcluir(m)}>
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

      <MensalistaFormDialog
        open={formAberto}
        onOpenChange={(o) => {
          setFormAberto(o);
          if (!o) setEditando(null);
        }}
        mensalista={editando}
      />
    </DashboardLayout>
  );
}

function duracaoHoras(m: QuadraMensalista): number {
  const [hi, mi] = m.horario_inicio.split(":").map(Number);
  const [hf, mf] = m.horario_fim.split(":").map(Number);
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
