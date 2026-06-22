import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  data?: {
    faturamento: number; notas: number; ticket_medio: number;
    clientes: number; vendedores: number;
  };
  isLoading: boolean;
  ano?: number;
}

const fmtInt = (n: number) => n.toLocaleString("pt-BR");

function formatShortBRL(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return formatCurrency(n);
}

function Card({ label, value, hint, isLoading }: { label: string; value: string; hint: string; isLoading: boolean }) {
  return (
    <div
      className="relative rounded-xl bg-card border border-border shadow-sm overflow-hidden px-4 py-4"
      style={{ borderTop: "3px solid hsl(var(--vendas-accent))" }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      {isLoading ? (
        <Skeleton className="h-7 w-24 mt-2" />
      ) : (
        <div className="text-2xl font-bold tracking-tight mt-1.5 text-foreground">{value}</div>
      )}
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

export function KPICards({ data, isLoading, ano = new Date().getFullYear() }: Props) {
  const items = [
    { label: "Faturamento", value: data ? formatShortBRL(data.faturamento) : "—", hint: `${ano} · jan-jun` },
    { label: "Notas", value: data ? fmtInt(data.notas) : "—", hint: "emitidas (saída)" },
    { label: "Ticket médio", value: data ? formatCurrency(data.ticket_medio) : "—", hint: "por nota" },
    { label: "Clientes", value: data ? fmtInt(data.clientes) : "—", hint: "atendidos" },
    { label: "Vendedores", value: data ? fmtInt(data.vendedores) : "—", hint: "ativos" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map((it) => <Card key={it.label} {...it} isLoading={isLoading} />)}
    </div>
  );
}
