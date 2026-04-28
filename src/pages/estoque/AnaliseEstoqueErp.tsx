import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/utils/fetchAllRows';
import { formatCurrency } from '@/lib/formatters';
import { Boxes, AlertTriangle, Package, Building2, Download, Search, Loader2 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

interface EstoqueRow {
  id: string;
  empresa_par: number | null;
  abrev_par: string | null;
  cod_produto: number | null;
  nome_prod: string | null;
  saldo: number | null;
  custo_unitario: number | null;
  custo_total: number | null;
  valor_venda: number | null;
  validade: string | null;
  lote: string | null;
  localizacao: string | null;
  sincronizado_em: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];

export default function AnaliseEstoqueErp() {
  const [distribuidora, setDistribuidora] = useState<string>('todas');
  const [termo, setTermo] = useState('');
  const [faixa, setFaixa] = useState<string>('todos');

  const { data: rows = [], isLoading } = useQuery<EstoqueRow[]>({
    queryKey: ['erp-estoque-distribuidora-all'],
    queryFn: () => fetchAllRows<EstoqueRow>(
      'erp_estoque_distribuidora',
      'id,empresa_par,abrev_par,cod_produto,nome_prod,saldo,custo_unitario,custo_total,valor_venda,validade,lote,localizacao,sincronizado_em',
      (q) => q.order('abrev_par', { ascending: true }),
    ),
    staleTime: 5 * 60 * 1000,
  });

  const distribuidoras = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.abrev_par) set.add(r.abrev_par); });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return rows.filter(r => {
      if (distribuidora !== 'todas' && r.abrev_par !== distribuidora) return false;
      if (faixa === 'zerados' && (Number(r.saldo) || 0) > 0) return false;
      if (faixa === 'positivo' && (Number(r.saldo) || 0) <= 0) return false;
      if (faixa === 'baixo' && !((Number(r.saldo) || 0) > 0 && (Number(r.saldo) || 0) < 10)) return false;
      if (t) {
        const hay = `${r.nome_prod || ''} ${r.cod_produto || ''} ${r.abrev_par || ''}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [rows, distribuidora, termo, faixa]);

  const kpis = useMemo(() => {
    let valorCusto = 0;
    let valorVenda = 0;
    let zerados = 0;
    filtered.forEach(r => {
      valorCusto += Number(r.custo_total) || 0;
      valorVenda += (Number(r.valor_venda) || 0) * (Number(r.saldo) || 0);
      if ((Number(r.saldo) || 0) <= 0) zerados++;
    });
    return {
      totalSkus: filtered.length,
      distribuidoras: new Set(filtered.map(r => r.abrev_par).filter(Boolean)).size,
      valorCusto, valorVenda, zerados,
    };
  }, [filtered]);

  const porDistribuidora = useMemo(() => {
    const map = new Map<string, { nome: string; skus: number; valor: number }>();
    filtered.forEach(r => {
      const k = r.abrev_par || 'Sem nome';
      const cur = map.get(k) || { nome: k, skus: 0, valor: 0 };
      cur.skus += 1;
      cur.valor += Number(r.custo_total) || 0;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [filtered]);

  const topProdutos = useMemo(() => {
    const map = new Map<string, { nome: string; saldo: number; valor: number }>();
    filtered.forEach(r => {
      const k = `${r.cod_produto}-${r.nome_prod}`;
      const cur = map.get(k) || { nome: (r.nome_prod || `#${r.cod_produto}`).slice(0, 30), saldo: 0, valor: 0 };
      cur.saldo += Number(r.saldo) || 0;
      cur.valor += Number(r.custo_total) || 0;
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.saldo - a.saldo).slice(0, 20);
  }, [filtered]);

  const exportCsv = () => {
    const header = ['Distribuidora', 'Cod Produto', 'Produto', 'Saldo', 'Custo Unit.', 'Custo Total', 'Valor Venda', 'Validade', 'Lote', 'Localização'];
    const lines = [header.join(';')];
    filtered.forEach(r => {
      lines.push([
        r.abrev_par || '', r.cod_produto || '', `"${(r.nome_prod || '').replace(/"/g, '""')}"`,
        r.saldo ?? 0, r.custo_unitario ?? 0, r.custo_total ?? 0, r.valor_venda ?? 0,
        r.validade || '', r.lote || '', r.localizacao || '',
      ].join(';'));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `estoque_distribuidoras_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Análise de Estoque — Distribuidoras</h1>
            <p className="text-muted-foreground">Posição atual sincronizada do ERP (Cust_EstoqueDistribuidora)</p>
          </div>
          <Button onClick={exportCsv} variant="outline" disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" />SKUs</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{kpis.totalSkus.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Building2 className="h-4 w-4" />Distribuidoras</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{kpis.distribuidoras}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Zerados</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold text-destructive">{kpis.zerados.toLocaleString()}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Package className="h-4 w-4 text-green-500" />Valor Custo</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold text-green-600">{formatCurrency(kpis.valorCusto)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Package className="h-4 w-4 text-blue-500" />Valor Venda</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold text-blue-600">{formatCurrency(kpis.valorVenda)}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select value={distribuidora} onValueChange={setDistribuidora}>
                <SelectTrigger><SelectValue placeholder="Distribuidora" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas distribuidoras</SelectItem>
                  {distribuidoras.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={faixa} onValueChange={setFaixa}>
                <SelectTrigger><SelectValue placeholder="Faixa de saldo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos saldos</SelectItem>
                  <SelectItem value="positivo">Apenas com saldo</SelectItem>
                  <SelectItem value="baixo">Saldo baixo (&lt; 10)</SelectItem>
                  <SelectItem value="zerados">Apenas zerados</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar produto, código ou distribuidora" value={termo} onChange={e => setTermo(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Top 10 distribuidoras por valor de estoque</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={porDistribuidora} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="nome" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Bar dataKey="valor" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Distribuição de SKUs por distribuidora (top 10)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={porDistribuidora} dataKey="skus" nameKey="nome" outerRadius={100} label={(e: any) => e.nome}>
                    {porDistribuidora.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Posições de estoque ({filtered.length.toLocaleString()})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">Nenhuma posição encontrada. Execute uma sincronização primeiro.</p>
            ) : (
              <div className="overflow-x-auto max-h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Distribuidora</TableHead>
                      <TableHead>Cód.</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead className="text-right">Valor Venda</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Lote</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 500).map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.abrev_par}</TableCell>
                        <TableCell className="font-mono text-xs">{r.cod_produto}</TableCell>
                        <TableCell className="text-xs max-w-[280px] truncate" title={r.nome_prod || ''}>{r.nome_prod}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={(Number(r.saldo) || 0) <= 0 ? 'destructive' : 'secondary'}>
                            {Number(r.saldo || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(Number(r.custo_unitario) || 0)}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{formatCurrency(Number(r.custo_total) || 0)}</TableCell>
                        <TableCell className="text-right text-xs">{formatCurrency(Number(r.valor_venda) || 0)}</TableCell>
                        <TableCell className="text-xs">{r.validade || '—'}</TableCell>
                        <TableCell className="text-xs">{r.lote || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filtered.length > 500 && (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    Exibindo 500 de {filtered.length.toLocaleString()} registros — refine os filtros ou exporte para CSV.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
