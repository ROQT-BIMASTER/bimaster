import { useMemo, useState } from 'react';
import { Search, Link2, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useBuscarSkuMaster,
  useFornecedorIntegradoKpis,
  useFornecedorNaoCasados,
  useVincularDepara,
  type FornecedorIntegradoRow,
  type MasterSearchRow,
} from '@/hooks/estoque/useFornecedorIntegrado';
import { useQueryClient } from '@tanstack/react-query';

const PAGE_SIZE = 25;

function VincularDialog({
  row,
  open,
  onOpenChange,
}: {
  row: FornecedorIntegradoRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [termo, setTermo] = useState('');
  const [selecionado, setSelecionado] = useState<MasterSearchRow | null>(null);
  const [motivo, setMotivo] = useState('');
  const { data: resultados = [], isLoading } = useBuscarSkuMaster(termo);
  const vincular = useVincularDepara();

  const handleClose = (v: boolean) => {
    if (!v) {
      setTermo('');
      setSelecionado(null);
      setMotivo('');
    }
    onOpenChange(v);
  };

  const handleSalvar = async () => {
    if (!row?.ean_normalizado) return;
    try {
      await vincular.mutateAsync({
        ean_fornecedor: row.ean_normalizado,
        codigo_rp: selecionado?.codigo_rp ?? null,
        sku_master: selecionado?.sku_master ?? null,
        nome_master: selecionado?.nome ?? null,
        motivo: motivo.trim() || null,
      });
      toast.success('Vínculo registrado.');
      handleClose(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao salvar vínculo.');
    }
  };

  const handleMarcarForaDeLinha = async () => {
    if (!row?.ean_normalizado) return;
    if (!motivo.trim()) {
      toast.error('Informe um motivo para marcar como fora de linha.');
      return;
    }
    try {
      await vincular.mutateAsync({
        ean_fornecedor: row.ean_normalizado,
        codigo_rp: null,
        sku_master: null,
        nome_master: null,
        motivo: motivo.trim(),
      });
      toast.success('Item marcado como fora de linha.');
      handleClose(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao salvar.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular EAN a SKU do catálogo</DialogTitle>
          <DialogDescription>
            {row?.futura_descricao} — EAN {row?.ean_normalizado} (cód. fornecedor {row?.futura_codigo})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="busca-master">Buscar SKU master (código RP, SKU, nome ou EAN)</Label>
            <Input
              id="busca-master"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Mínimo 2 caracteres…"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-auto rounded border border-border">
            {isLoading && <div className="p-3 text-sm text-muted-foreground">Buscando…</div>}
            {!isLoading && termo.trim().length >= 2 && resultados.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">Nenhum SKU encontrado.</div>
            )}
            {resultados.map((r) => {
              const isSel = selecionado?.codigo_rp === r.codigo_rp;
              return (
                <button
                  key={`${r.codigo_rp}-${r.sku_master}`}
                  type="button"
                  onClick={() => setSelecionado(r)}
                  className={`block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted ${
                    isSel ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="font-medium">
                    {r.codigo_rp} · {r.sku_master}
                  </div>
                  <div className="text-xs text-muted-foreground">{r.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    EAN caixa: {r.ean_caixa_master ?? '—'} · EAN un.: {r.ean_unitario_master ?? '—'}
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <Label htmlFor="motivo">Motivo / observação (opcional para vínculo, obrigatório para "fora de linha")</Label>
            <Input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={handleMarcarForaDeLinha} disabled={vincular.isPending}>
            Marcar como fora de linha
          </Button>
          <Button onClick={handleSalvar} disabled={!selecionado || vincular.isPending}>
            <Link2 className="mr-2 h-4 w-4" /> Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function FornecedorDeParaEanPage() {
  const [busca, setBusca] = useState('');
  const [apenasComSaldo, setApenasComSaldo] = useState(true);
  const [page, setPage] = useState(0);
  const [linhaSel, setLinhaSel] = useState<FornecedorIntegradoRow | null>(null);
  const qc = useQueryClient();

  const { data: kpis, isLoading: kpisLoading } = useFornecedorIntegradoKpis();
  const { data, isLoading } = useFornecedorNaoCasados({ busca, apenasComSaldo, page, pageSize: PAGE_SIZE });

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE)), [data?.total]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'De-para EAN do fornecedor · Estoque';
    return () => { document.title = prev; };
  }, []);

  return (
    <>


      <div className="container mx-auto space-y-4 p-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">De-para EAN do fornecedor</h1>
            <p className="text-sm text-muted-foreground">
              Itens do Futura sem casamento automático com o catálogo master. Vincule ao SKU correto para
              entrarem na reposição.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ['fornecedor-nao-casados'] });
              qc.invalidateQueries({ queryKey: ['fornecedor-integrado-kpis'] });
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Cobertura total" value={kpisLoading ? '—' : `${kpis?.pct_casado ?? 0}%`} sub={kpisLoading ? '' : `${kpis?.casados ?? 0} / ${kpis?.total ?? 0}`} />
          <KpiCard label="Cobertura com saldo" value={kpisLoading ? '—' : `${kpis?.pct_casado_com_saldo ?? 0}%`} sub={kpisLoading ? '' : `${kpis?.com_saldo_casados ?? 0} / ${kpis?.com_saldo ?? 0}`} />
          <KpiCard label="Exceções com saldo" value={kpisLoading ? '—' : String(kpis?.exceptions_pendentes ?? 0)} sub="Não casados com estoque > 0" />
          <KpiCard label="Total no fornecedor" value={kpisLoading ? '—' : String(kpis?.total ?? 0)} sub="Itens importados do Futura" />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Itens sem casamento</CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="apenas-saldo"
                  checked={apenasComSaldo}
                  onCheckedChange={(v) => {
                    setApenasComSaldo(v);
                    setPage(0);
                  }}
                />
                <Label htmlFor="apenas-saldo" className="text-sm">
                  Apenas com saldo
                </Label>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-72 pl-8"
                  placeholder="Buscar código, EAN ou descrição"
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cód. Futura</TableHead>
                  <TableHead>EAN</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Cx. fornecedor</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={5}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                {!isLoading && (data?.rows.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Nenhum item nessas condições.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading &&
                  data?.rows.map((r) => (
                    <TableRow key={`${r.futura_codigo}-${r.ean_normalizado}`}>
                      <TableCell className="font-mono text-xs">{r.futura_codigo ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{r.ean_normalizado ?? r.ean_caixa ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{r.futura_descricao ?? '—'}</span>
                          {r.futura_status && (
                            <Badge variant="outline" className="text-xs">
                              {r.futura_status}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.fornecedor_caixas != null ? Number(r.fornecedor_caixas).toFixed(4) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setLinhaSel(r)}>
                          <Link2 className="mr-1 h-3.5 w-3.5" /> Vincular
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data?.total ?? 0} item(ns) — página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <VincularDialog row={linhaSel} open={!!linhaSel} onOpenChange={(v) => !v && setLinhaSel(null)} />
    </>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
