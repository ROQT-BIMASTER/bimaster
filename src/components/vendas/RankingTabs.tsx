import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/formatters";
import { ArrowUpDown, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVendasRankingVendedor, useVendasRankingCoordenador, type VendasFilters } from "@/hooks/useVendasAnalise";

const fmtInt = (n: number) => n.toLocaleString("pt-BR");

type SortDir = "asc" | "desc";

function useSort<T extends Record<string, any>>(rows: T[], initialKey: string) {
  const [key, setKey] = useState<string>(initialKey);
  const [dir, setDir] = useState<SortDir>("desc");
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, key, dir]);
  const toggle = (k: string) => {
    if (k === key) setDir(dir === "asc" ? "desc" : "asc");
    else { setKey(k); setDir("desc"); }
  };
  return { sorted, toggle, key, dir };
}

function SortHead({ active, dir, onClick, children, align = "left" }: { active: boolean; dir: SortDir; onClick: () => void; children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button onClick={onClick} className={`inline-flex items-center gap-1 ${active ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  );
}

function ChartHoriz({ data }: { data: { name: string; faturamento: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip formatter={(v: number) => [formatCurrency(v), "Faturamento"]}
          contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
        <Bar dataKey="faturamento" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function VendedorPanel({ filters }: { filters: VendasFilters }) {
  const { data, isLoading } = useVendasRankingVendedor(filters);
  const rows = data || [];
  const { sorted, toggle, key, dir } = useSort(rows, "faturamento" as any);
  const top = [...rows].slice(0, 10).map((r) => ({
    name: r.vendedor_nome.length > 22 ? r.vendedor_nome.slice(0, 20) + "…" : r.vendedor_nome,
    faturamento: r.faturamento,
  }));

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (rows.length === 0) return <div className="text-sm text-muted-foreground py-8 text-center">Sem vendas no período</div>;

  return (
    <div className="space-y-4">
      <ChartHoriz data={top} />
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead active={key === ("vendedor_nome" as any)} dir={dir} onClick={() => toggle("vendedor_nome" as any)}>Vendedor</SortHead>
              <SortHead active={key === ("coordenador_nome" as any)} dir={dir} onClick={() => toggle("coordenador_nome" as any)}>Coordenador</SortHead>
              <SortHead active={key === ("notas" as any)} dir={dir} onClick={() => toggle("notas" as any)} align="right">Notas</SortHead>
              <SortHead active={key === ("faturamento" as any)} dir={dir} onClick={() => toggle("faturamento" as any)} align="right">Faturamento</SortHead>
              <SortHead active={key === ("ticket_medio" as any)} dir={dir} onClick={() => toggle("ticket_medio" as any)} align="right">Ticket médio</SortHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r, i) => (
              <TableRow key={`${r.vendedor_id ?? "x"}-${i}`}>
                <TableCell className="font-medium">{r.vendedor_nome}</TableCell>
                <TableCell className="text-muted-foreground">{r.coordenador_nome ?? "Sem coordenador"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(r.notas)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(r.faturamento)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(r.ticket_medio)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CoordenadorPanel({ filters }: { filters: VendasFilters }) {
  const { data, isLoading } = useVendasRankingCoordenador(filters);
  const rows = data || [];
  const { sorted, toggle, key, dir } = useSort(rows, "faturamento" as any);
  const top = [...rows].slice(0, 10).map((r) => ({
    name: r.coordenador_nome.length > 22 ? r.coordenador_nome.slice(0, 20) + "…" : r.coordenador_nome,
    faturamento: r.faturamento,
  }));

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (rows.length === 0) return <div className="text-sm text-muted-foreground py-8 text-center">Sem vendas no período</div>;

  return (
    <div className="space-y-4">
      <ChartHoriz data={top} />
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead active={key === ("coordenador_nome" as any)} dir={dir} onClick={() => toggle("coordenador_nome" as any)}>Coordenador</SortHead>
              <SortHead active={key === ("notas" as any)} dir={dir} onClick={() => toggle("notas" as any)} align="right">Notas</SortHead>
              <SortHead active={key === ("faturamento" as any)} dir={dir} onClick={() => toggle("faturamento" as any)} align="right">Faturamento</SortHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r, i) => (
              <TableRow key={`${r.coordenador_id ?? "x"}-${i}`}>
                <TableCell className="font-medium">{r.coordenador_nome}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(r.notas)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(r.faturamento)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function RankingTabs({ filters }: { filters: VendasFilters }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-600" />
          Ranking
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="vendedor">
          <TabsList>
            <TabsTrigger value="vendedor">Por vendedor</TabsTrigger>
            <TabsTrigger value="coordenador">Por coordenador</TabsTrigger>
          </TabsList>
          <TabsContent value="vendedor" className="mt-4"><VendedorPanel filters={filters} /></TabsContent>
          <TabsContent value="coordenador" className="mt-4"><CoordenadorPanel filters={filters} /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
