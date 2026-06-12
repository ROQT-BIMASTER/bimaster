import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Download, Search, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface DivRow {
  cod_produto: number;
  nome_prod: string | null;
  cod_fabricante: string | null;
  linhas_distintas: string[];
  qtd_linhas_distintas: number;
  por_filial: Array<{ empresa_par: number; abrev_par: string | null; nome_linha: string | null; saldo: number }>;
  saldo_total: number;
}

export default function EstoqueAuditoriaLinhasErpPage() {
  const [busca, setBusca] = useState('');

  const q = useQuery({
    queryKey: ['auditoria-linhas-erp'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('vw_divergencia_linha_erp')
        .select('*')
        .order('qtd_linhas_distintas', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as DivRow[];
    },
  });

  const rows = useMemo(() => {
    const all = q.data ?? [];
    if (!busca.trim()) return all;
    const t = busca.toLowerCase();
    return all.filter(
      (r) =>
        String(r.cod_produto).includes(t) ||
        (r.nome_prod ?? '').toLowerCase().includes(t) ||
        (r.cod_fabricante ?? '').toLowerCase().includes(t) ||
        (r.linhas_distintas ?? []).some((l) => l.toLowerCase().includes(t)),
    );
  }, [q.data, busca]);

  const exportCsv = () => {
    const header = ['cod_produto', 'cod_fabricante', 'nome_prod', 'qtd_linhas', 'linhas', 'saldo_total', 'filiais'];
    const lines = [header.join(';')];
    for (const r of rows) {
      const filiais = (r.por_filial ?? [])
        .map((f) => `${f.abrev_par ?? f.empresa_par}=${f.nome_linha ?? '∅'}`)
        .join(' | ');
      lines.push([
        r.cod_produto,
        JSON.stringify(r.cod_fabricante ?? ''),
        JSON.stringify(r.nome_prod ?? ''),
        r.qtd_linhas_distintas,
        JSON.stringify((r.linhas_distintas ?? []).join(' / ')),
        Math.round(Number(r.saldo_total ?? 0)),
        JSON.stringify(filiais),
      ].join(';'));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-linhas-erp-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm" className="h-7 px-2">
                <Link to="/dashboard/estoque/cores"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <h1 className="text-2xl font-bold tracking-tight">Auditoria — Linhas divergentes no ERP</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              SKUs cadastrados em mais de uma linha entre filiais. Corrija no ERP para padronizar o rótulo.
            </p>
          </div>
          <Button onClick={exportCsv} variant="outline" size="sm" className="h-9">
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
        </div>

        <Alert className="py-2 border-warning/50 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-xs">
            A divergência é apenas no <strong>nome da linha</strong>. O saldo unificado por SKU continua somando todas as filiais corretamente — não há duplicidade de estoque.
          </AlertDescription>
        </Alert>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código, produto, fabricante ou linha..."
            className="pl-9 h-9"
          />
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs">Cód.</TableHead>
                <TableHead className="text-xs">Produto</TableHead>
                <TableHead className="text-xs">Linhas divergentes</TableHead>
                <TableHead className="text-xs">Cadastro por filial</TableHead>
                <TableHead className="text-xs text-right">Saldo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhuma divergência encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.cod_produto}>
                    <TableCell className="text-xs font-mono">{r.cod_produto}</TableCell>
                    <TableCell className="max-w-[280px]">
                      <div className="text-sm font-medium truncate">{r.nome_prod ?? '(sem nome)'}</div>
                      {r.cod_fabricante && (
                        <div className="text-[10px] text-muted-foreground font-mono">{r.cod_fabricante}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(r.linhas_distintas ?? []).map((l) => (
                          <Badge key={l} variant="outline" className="text-[10px] border-warning/40 text-warning">
                            {l}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        {(r.por_filial ?? []).map((f, i) => (
                          <div key={`${f.empresa_par}-${i}`} className="flex items-center gap-2">
                            <span className="font-mono text-muted-foreground min-w-[36px]">
                              {f.abrev_par ?? f.empresa_par}
                            </span>
                            <span className="font-medium">{f.nome_linha ?? '∅'}</span>
                            <span className="text-muted-foreground">
                              {Math.round(Number(f.saldo ?? 0)).toLocaleString('pt-BR')} un.
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-semibold">
                      {Math.round(Number(r.saldo_total ?? 0)).toLocaleString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="text-xs text-muted-foreground px-1">
          {rows.length.toLocaleString('pt-BR')} SKU{rows.length === 1 ? '' : 's'} com divergência.
        </div>
      </div>
    </DashboardLayout>
  );
}
