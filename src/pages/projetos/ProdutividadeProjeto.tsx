import { useParams, useNavigate } from "react-router-dom";
import { useProjetoHoras, useProjetoProdutividade } from "@/hooks/useProjetoHoras";
import { useEstimarHorasIA } from "@/hooks/useEstimarHorasIA";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProjetoHorasMiniPanel } from "@/components/projetos/ProjetoHorasMiniPanel";
import { BackfillIADialog } from "@/components/projetos/BackfillIADialog";

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function ProdutividadeProjeto() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projetoId = id || null;
  const { lancamentos, isLoading, remover } = useProjetoHoras(projetoId);
  const { data: prod } = useProjetoProdutividade(projetoId);
  const [iaOpen, setIaOpen] = useState(false);

  const totals = useMemo(() => {
    const horas = lancamentos.reduce((s, l) => s + Number(l.horas || 0), 0);
    const custoPessoas = lancamentos.reduce(
      (s, l) => s + Number(l.horas || 0) * Number(l.custo_hora_snapshot || 0),
      0
    );
    const custoTec = (prod?.tecnologia || []).reduce((s, t) => s + Number(t.custo_tecnologia_rateado || 0), 0);
    return { horas, custoPessoas, custoTec, total: custoPessoas + custoTec };
  }, [lancamentos, prod]);

  const chartData = useMemo(() => {
    const map = new Map<string, { mes: string; horas: number; pessoas: number; tecnologia: number }>();
    (prod?.meses || []).forEach((m) => {
      map.set(m.mes, {
        mes: format(parseISO(m.mes), "MMM/yy", { locale: ptBR }),
        horas: Number(m.horas_totais || 0),
        pessoas: Number(m.custo_pessoas || 0),
        tecnologia: 0,
      });
    });
    (prod?.tecnologia || []).forEach((t) => {
      const key = format(parseISO(t.mes), "MMM/yy", { locale: ptBR });
      const existing = [...map.values()].find((v) => v.mes === key);
      if (existing) existing.tecnologia = Number(t.custo_tecnologia_rateado || 0);
      else map.set(t.mes, { mes: key, horas: 0, pessoas: 0, tecnologia: Number(t.custo_tecnologia_rateado || 0) });
    });
    return [...map.values()].reverse();
  }, [prod]);

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/projetos/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Produtividade do projeto</h1>
            <p className="text-sm text-muted-foreground">Horas, custos de pessoas e tecnologia rateada</p>
          </div>
        </div>
        <Button onClick={() => setIaOpen(true)} variant="outline">
          <Sparkles className="h-4 w-4 mr-2" /> Estimar horas com IA
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Horas totais</div>
          <div className="text-2xl font-bold mt-1">{totals.horas.toFixed(1)}h</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Custo pessoas</div>
          <div className="text-2xl font-bold mt-1">{formatBRL(totals.custoPessoas)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Custo tecnologia (rateio)</div>
          <div className="text-2xl font-bold mt-1">{formatBRL(totals.custoTec)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total investido</div>
          <div className="text-2xl font-bold mt-1 text-primary">{formatBRL(totals.total)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Horas por mês</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="horas" fill="hsl(var(--primary))" name="Horas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Custos por mês</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="pessoas" stroke="hsl(var(--primary))" name="Pessoas" />
                <Line type="monotone" dataKey="tecnologia" stroke="hsl(var(--destructive))" name="Tecnologia" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          {projetoId && <ProjetoHorasMiniPanel projetoId={projetoId} />}
        </div>
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Últimos lançamentos</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Pessoa</TableHead>
                <TableHead>Tarefa</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && lancamentos.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum lançamento ainda.</TableCell></TableRow>
              )}
              {lancamentos.slice(0, 50).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm">{format(parseISO(l.data), "dd/MM/yy")}</TableCell>
                  <TableCell className="text-sm">{l.autor?.nome || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {(l.tarefa as any)?.titulo || l.descricao || "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">{Number(l.horas).toFixed(1)}h</TableCell>
                  <TableCell className="text-right text-sm">{formatBRL(Number(l.horas) * Number(l.custo_hora_snapshot || 0))}</TableCell>
                  <TableCell>
                    <Badge variant={l.origem === "ia_backfill" ? "secondary" : "outline"} className="text-xs">
                      {l.origem === "ia_backfill" ? "IA" : l.origem === "importacao" ? "import" : "manual"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remover?")) remover.mutate(l.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {projetoId && <BackfillIADialog open={iaOpen} onOpenChange={setIaOpen} projetoId={projetoId} />}
    </div>
  );
}
