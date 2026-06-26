import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { formatQtd, UNIDADE_LABEL, type Unidade } from "@/lib/vendas/unidade";

interface Props {
  data?: {
    faturamento: number; notas: number; ticket_medio: number;
    qtd_un: number;
    clientes: number; vendedores: number;
  };
  isLoading: boolean;
  ano?: number;
  unidade: Unidade;
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

export function KPICards({ data, isLoading, ano = new Date().getFullYear(), unidade }: Props) {
  // CX desabilitado em agregado: cai para "—".
  const qtdLabel = data ? formatQtd(data.qtd_un, unidade === "CX" ? "DZ" : unidade) : "—";

  const items = [
    { label: "Faturamento", value: data ? formatShortBRL(data.faturamento) : "—", hint: `${ano}` },
    { label: "Notas", value: data ? fmtInt(data.notas) : "—", hint: "emitidas (saída)" },
    { label: "Ticket médio", value: data ? formatCurrency(data.ticket_medio) : "—", hint: "por nota" },
    { label: `Qtd. vendida`, value: qtdLabel, hint: unidade === "CX" ? "use DZ ou UN no agregado" : UNIDADE_LABEL[unidade] },
    { label: "Clientes", value: data ? fmtInt(data.clientes) : "—", hint: "atendidos" },
    { label: "Vendedores", value: data ? fmtInt(data.vendedores) : "—", hint: "ativos" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((it) => <Card key={it.label} {...it} isLoading={isLoading} />)}
    </div>
  );
}
