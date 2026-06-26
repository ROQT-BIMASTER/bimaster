import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, Search, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { useClientesLista, useClientesFiltrados } from "@/hooks/fornecedor/useClientesLista";
import { FuturaBackButton } from "@/components/fornecedor/FuturaBackButton";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

function fmtDate(s: string | null): string {
  const d = parseLocalDate(s);
  if (!d) return "—";
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export default function ClientesListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useClientesLista();
  const [search, setSearch] = useState("");
  const rows = useClientesFiltrados(data, search);

  return (
    <div className="w-full px-4 md:px-6 py-6 space-y-4">
      <PageHeader
        title="Clientes (histórico)"
        description="Lista de clientes com histórico de compras na Futura"
        icon={Users}
        breadcrumbs={[
          { label: "Fornecedor", href: "/dashboard/fornecedor" },
          { label: "Clientes" },
        ]}
      />

      <Card className="p-4 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CNPJ/CPF ou código"
            className="pl-9"
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive">Falha ao carregar clientes.</p>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CNPJ/CPF</TableHead>
                  <TableHead className="text-right">Compras</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Ticket médio</TableHead>
                  <TableHead>Última compra</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.cliente_futura_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/dashboard/fornecedor/clientes/${r.cliente_futura_id}`)}
                  >
                    <TableCell className="font-medium">
                      {r.cliente_nome ?? `Cliente #${r.cliente_futura_id}`}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.cliente_cnpj_cpf ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.total_compras}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.total_valor)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.ticket_medio)}</TableCell>
                    <TableCell className="text-sm">{fmtDate(r.ultima_compra)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Abrir histórico do cliente"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/dashboard/fornecedor/clientes/${r.cliente_futura_id}`);
                        }}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {rows.length} cliente(s) — clique em uma linha para ver o histórico, tendência e projeção.
          </p>
        )}
      </Card>
    </div>
  );
}
