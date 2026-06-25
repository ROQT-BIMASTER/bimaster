import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import {
  useBudgetDistributions,
  useBudgetKpis,
  useBudgetPlanCategories,
  useDeletePlanCategoria,
  useOrcamentoCategorias,
  useUpsertPlanCategoria,
} from "@/hooks/orcamento/useOrcamentoCorporativo";

type Linha = {
  id?: string;
  categoria_id: string;
  nome: string;
  valor_planejado: number;
  is_reserva: boolean;
  ordem: number;
  cor?: string | null;
};

export function PlanoDepartamentoPanel({ periodId }: { periodId: string }) {
  const { data: deps, isLoading: loadingDeps } = useQuery({
    queryKey: ["meus_departamentos_plano"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departamentos")
        .select("id,nome,ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: distribuicoes } = useBudgetDistributions(periodId);
  const { data: categorias } = useOrcamentoCategorias();

  const [depId, setDepId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!depId && distribuicoes?.length) setDepId(distribuicoes[0].department_id);
  }, [distribuicoes, depId]);

  const distribution = useMemo(
    () => distribuicoes?.find((d) => d.department_id === depId),
    [distribuicoes, depId],
  );

  const { data: linhasDb, isLoading: loadingPlano } = useBudgetPlanCategories(distribution?.id);
  const { data: kpis } = useBudgetKpis(distribution?.id);

  const upsertMut = useUpsertPlanCategoria();
  const deleteMut = useDeletePlanCategoria();

  const [linhas, setLinhas] = useState<Linha[]>([]);

  useEffect(() => {
    if (!linhasDb) return;
    setLinhas(
      linhasDb.map((l) => ({
        id: l.id,
        categoria_id: l.categoria_id,
        nome: l.nome ?? "",
        valor_planejado: Number(l.valor_planejado ?? 0),
        is_reserva: Boolean(l.is_reserva),
        ordem: Number(l.ordem ?? 0),
        cor: l.cor,
      })),
    );
  }, [linhasDb]);

  const alocado = Number(distribution?.valor_alocado ?? 0);
  const planejado = linhas.reduce((acc, l) => acc + (Number(l.valor_planejado) || 0), 0);
  // Disponível = alocado − planejado (reserva já está contida em planejado; não subtrair de novo)
  const disponivel = alocado - planejado;
  const excedeu = planejado > alocado;

  const addLinha = () => {
    if (!categorias?.length) return;
    setLinhas((prev) => [
      ...prev,
      {
        categoria_id: categorias[0].id,
        nome: "",
        valor_planejado: 0,
        is_reserva: false,
        ordem: prev.length,
      },
    ]);
  };

  const updateLinha = (idx: number, patch: Partial<Linha>) => {
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removerLinha = async (idx: number) => {
    const l = linhas[idx];
    if (l.id && distribution) {
      try {
        await deleteMut.mutateAsync({ id: l.id, distribution_id: distribution.id });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao excluir");
        return;
      }
    }
    setLinhas((prev) => prev.filter((_, i) => i !== idx));
  };

  const salvar = async () => {
    if (!distribution) return;
    if (excedeu) {
      toast.error("Plano excede a verba alocada");
      return;
    }
    try {
      for (const l of linhas) {
        await upsertMut.mutateAsync({
          id: l.id,
          distribution_id: distribution.id,
          categoria_id: l.categoria_id,
          nome: l.nome || undefined,
          valor_planejado: Number(l.valor_planejado) || 0,
          is_reserva: l.is_reserva,
          ordem: l.ordem,
          cor: l.cor ?? undefined,
        });
      }
      toast.success("Plano salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar plano");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Plano do Departamento</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Departamento</Label>
            <Select value={depId} onValueChange={setDepId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {deps?.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDeps ? (
            <Skeleton className="h-16 w-full" />
          ) : !distribution ? (
            <Alert>
              <AlertDescription>
                Este departamento ainda não tem verba distribuída neste período.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Kpi label="Alocado" value={alocado} />
              <Kpi label="Planejado" value={kpis?.valor_planejado ?? planejado} />
              <Kpi label="Reservado" value={kpis?.saldo_reservado ?? 0} />
              <Kpi label="Comprometido" value={kpis?.valor_comprometido ?? 0} />
              <Kpi label="Utilizado" value={kpis?.valor_utilizado ?? 0} />
              <Kpi
                label="Disponível"
                value={disponivel}
                tone={disponivel < 0 ? "destructive" : "default"}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {distribution && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Categorias planejadas</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={addLinha}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
              <Button size="sm" onClick={salvar} disabled={upsertMut.isPending || excedeu}>
                {upsertMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar plano
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingPlano ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Rótulo</TableHead>
                    <TableHead className="text-center">Reserva</TableHead>
                    <TableHead className="text-right w-40">Valor (R$)</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                        Nenhuma categoria. Clique em "Adicionar" para começar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    linhas.map((l, idx) => (
                      <TableRow key={l.id ?? `new-${idx}`}>
                        <TableCell>
                          <Select
                            value={l.categoria_id}
                            onValueChange={(v) => updateLinha(idx, { categoria_id: v })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {categorias?.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={l.nome}
                            placeholder="(opcional)"
                            onChange={(e) => updateLinha(idx, { nome: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={l.is_reserva}
                            onCheckedChange={(v) => updateLinha(idx, { is_reserva: v })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="text-right tabular-nums"
                            value={l.valor_planejado}
                            onChange={(e) =>
                              updateLinha(idx, { valor_planejado: parseFloat(e.target.value || "0") })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removerLinha(idx)}
                            disabled={deleteMut.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
            {excedeu && (
              <Alert variant="destructive" className="mt-3">
                <AlertDescription>
                  Σ planejado ({formatCurrency(planejado)}) excede o alocado ({formatCurrency(alocado)}).
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "default",
}: { label: string; value: number; tone?: "default" | "destructive" }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`text-base font-semibold tabular-nums mt-1 ${
          tone === "destructive" ? "text-destructive" : "text-foreground"
        }`}
      >
        {formatCurrency(Number(value ?? 0))}
      </div>
    </div>
  );
}
