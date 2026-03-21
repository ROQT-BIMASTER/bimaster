import { useState, useCallback } from "react";
import { DashboardFiltersBar } from "@/components/painel-executivo/DashboardFilters";
import type { DashboardFilters } from "@/hooks/useDashboardKPIs";
import { useMetasVendas, useMetasCRUD } from "@/hooks/useMetasVendas";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Target, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ValueLegend } from "@/components/ui/smart-value";
import { useDashboardFilterOptions } from "@/hooks/useDashboardFilterOptions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const now = new Date();
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function GaugeCard({ label, realizado, meta, projecao, pctAtingimento }: { label: string; realizado: number; meta: number; projecao: number; pctAtingimento: number }) {
  const pct = Math.min(pctAtingimento, 100);
  const color = pct >= 100 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-red-600";
  const bgColor = pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <p className="text-sm font-medium truncate">{label}</p>
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          <div className={`absolute inset-y-0 left-0 ${bgColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{fmt(realizado)}</span>
          <span className={`font-bold ${color}`}>{fmtPct(pctAtingimento)}</span>
          <span>Meta: {fmt(meta)}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">Projeção: {fmt(projecao)}</p>
      </CardContent>
    </Card>
  );
}

export default function MetasProjecoes() {
  const [filters, setFilters] = useState<DashboardFilters>({ ano: now.getFullYear(), mes: now.getMonth() + 1 });
  const handleFilterChange = useCallback((p: Partial<DashboardFilters>) => setFilters(prev => ({ ...prev, ...p })), []);
  const { toast } = useToast();
  const { isAdmin } = useUserRole();

  const { data, isLoading } = useMetasVendas(filters);
  const { upsert, remove } = useMetasCRUD();
  const { supervisores, vendedores } = useDashboardFilterOptions();
  const { data: empresas } = useQuery({
    queryKey: ["dim-empresas"],
    queryFn: async () => {
      const { data } = await supabase.from("dim_empresa").select("id_empresa,nome_empresa");
      return (data || []) as { id_empresa: number; nome_empresa: string }[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [newMeta, setNewMeta] = useState({ tipo_meta: "empresa", referencia_id: "", valor_meta: "" });

  const handleSaveMeta = async () => {
    if (!newMeta.referencia_id || !newMeta.valor_meta) return;
    const periodo = filters.mes ? `${filters.ano}-${String(filters.mes).padStart(2, "0")}` : `${filters.ano}-01`;
    try {
      await upsert.mutateAsync({ periodo, tipo_meta: newMeta.tipo_meta, referencia_id: newMeta.referencia_id, valor_meta: Number(newMeta.valor_meta) });
      toast({ title: "Meta salva com sucesso" });
      setAddOpen(false);
      setNewMeta({ tipo_meta: "empresa", referencia_id: "", valor_meta: "" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar meta", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast({ title: "Meta removida" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const allMetas = [...(data?.empresaMetas || []), ...(data?.supervisorMetas || []), ...(data?.vendedorMetas || [])];

  const referenceOptions = () => {
    switch (newMeta.tipo_meta) {
      case "empresa": return (empresas || []).map(e => ({ value: String(e.id_empresa), label: e.nome_empresa }));
      case "supervisor": return (supervisores.data || []).map(s => ({ value: s, label: s }));
      case "vendedor": return (vendedores.data || []).map(v => ({ value: String(v.cod_vend), label: v.nome_vendedor }));
      default: return [];
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/30">
            <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Metas e Projeções</h1>
            <p className="text-sm text-muted-foreground">Acompanhamento de metas por empresa, supervisor e vendedor</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ValueLegend />
          {isAdmin && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Meta</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Cadastrar Meta</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Tipo</label>
                    <Select value={newMeta.tipo_meta} onValueChange={v => setNewMeta(prev => ({ ...prev, tipo_meta: v, referencia_id: "" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empresa">Empresa</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Referência</label>
                    <Select value={newMeta.referencia_id} onValueChange={v => setNewMeta(prev => ({ ...prev, referencia_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {referenceOptions().map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Valor da Meta (R$)</label>
                    <Input type="number" value={newMeta.valor_meta} onChange={e => setNewMeta(prev => ({ ...prev, valor_meta: e.target.value }))} placeholder="100000" />
                  </div>
                </div>
                <DialogFooter><Button onClick={handleSaveMeta} disabled={upsert.isPending}>Salvar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <DashboardFiltersBar filters={filters} onChange={handleFilterChange} />

      {/* Gauge Cards */}
      {isLoading ? <Skeleton className="h-[120px]" /> : (
        <>
          {(data?.empresaMetas?.length || 0) > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Metas por Empresa</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {data!.empresaMetas.map(m => <GaugeCard key={m.id} label={m.label} realizado={m.realizado} meta={m.valor_meta} projecao={m.projecao} pctAtingimento={m.pctAtingimento} />)}
              </div>
            </div>
          )}
          {(data?.supervisorMetas?.length || 0) > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Metas por Supervisor</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {data!.supervisorMetas.map(m => <GaugeCard key={m.id} label={m.label} realizado={m.realizado} meta={m.valor_meta} projecao={m.projecao} pctAtingimento={m.pctAtingimento} />)}
              </div>
            </div>
          )}
          {(data?.vendedorMetas?.length || 0) > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Metas por Vendedor</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {data!.vendedorMetas.map(m => <GaugeCard key={m.id} label={m.label} realizado={m.realizado} meta={m.valor_meta} projecao={m.projecao} pctAtingimento={m.pctAtingimento} />)}
              </div>
            </div>
          )}
        </>
      )}

      {allMetas.length === 0 && !isLoading && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhuma meta cadastrada</p>
          <p className="text-sm">Use o botão "Nova Meta" para cadastrar metas para o período selecionado.</p>
        </CardContent></Card>
      )}

      {/* Detail Table */}
      {allMetas.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Tabela Detalhada de Metas</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Tipo</TableHead><TableHead>Referência</TableHead><TableHead className="text-right">Meta</TableHead><TableHead className="text-right">Realizado</TableHead><TableHead className="text-right">% Ating.</TableHead><TableHead className="text-right">Gap</TableHead><TableHead className="text-right">Projeção</TableHead>
                  {isAdmin && <TableHead className="w-10" />}
                </TableRow></TableHeader>
                <TableBody>
                  {allMetas.sort((a, b) => b.pctAtingimento - a.pctAtingimento).map(m => (
                    <TableRow key={m.id}>
                      <TableCell><Badge variant="outline" className="text-xs">{m.tipo_meta}</Badge></TableCell>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell className="text-right">{fmt(m.valor_meta)}</TableCell>
                      <TableCell className="text-right">{fmt(m.realizado)}</TableCell>
                      <TableCell className="text-right">
                        <span className={m.pctAtingimento >= 100 ? "text-emerald-600 font-bold" : m.pctAtingimento >= 70 ? "text-amber-600" : "text-red-600"}>
                          {fmtPct(m.pctAtingimento)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{fmt(m.gap)}</TableCell>
                      <TableCell className="text-right">{fmt(m.projecao)}</TableCell>
                      {isAdmin && (
                        <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(m.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button></TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
