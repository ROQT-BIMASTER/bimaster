import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  useBudgetDistributions,
  useDistribuirVerba,
} from "@/hooks/orcamento/useOrcamentoCorporativo";

interface Periodo {
  id: string;
  nome: string;
  valor_total_empresa: number;
  status: string;
}

export function DistribuirVerbaPanel({ periodo }: { periodo: Periodo }) {
  const { data: deps, isLoading: loadingDeps } = useQuery({
    queryKey: ["departamentos_ativos"],
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

  const { data: distribuicoes, isLoading: loadingDist } = useBudgetDistributions(periodo.id);
  const distribuirMut = useDistribuirVerba();

  const [valores, setValores] = useState<Record<string, number>>({});

  useEffect(() => {
    const map: Record<string, number> = {};
    distribuicoes?.forEach((d) => {
      map[d.department_id] = Number(d.valor_alocado ?? 0);
    });
    setValores(map);
  }, [distribuicoes]);

  const totalDistribuido = useMemo(
    () => Object.values(valores).reduce((acc, v) => acc + (Number(v) || 0), 0),
    [valores],
  );
  const teto = Number(periodo.valor_total_empresa ?? 0);
  const restante = teto - totalDistribuido;
  const excedeu = totalDistribuido > teto;

  const onSalvar = async () => {
    if (excedeu) {
      toast.error("Soma da distribuição excede o teto da empresa");
      return;
    }
    const alocacoes = Object.entries(valores).map(([department_id, valor]) => ({
      department_id,
      valor: Number(valor) || 0,
    }));
    try {
      await distribuirMut.mutateAsync({ period_id: periodo.id, alocacoes });
      toast.success("Distribuição aplicada");
    } catch {
      // Erro tratado em onError do hook useDistribuirVerba (mensagem real do banco)
    }
  };


  const statusByDep = useMemo(() => {
    const map: Record<string, string> = {};
    distribuicoes?.forEach((d) => { map[d.department_id] = d.status; });
    return map;
  }, [distribuicoes]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">Distribuição — {periodo.nome}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Teto da empresa: <span className="font-medium text-foreground">{formatCurrency(teto)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Distribuído</div>
            <div className={`text-base font-semibold tabular-nums ${excedeu ? "text-destructive" : "text-foreground"}`}>
              {formatCurrency(totalDistribuido)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Restante</div>
            <div className={`text-base font-semibold tabular-nums ${restante < 0 ? "text-destructive" : "text-foreground"}`}>
              {formatCurrency(restante)}
            </div>
          </div>
          <Button size="sm" onClick={onSalvar} disabled={distribuirMut.isPending || excedeu}>
            {distribuirMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar distribuição
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingDeps || loadingDist ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-56">Valor alocado (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deps?.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {statusByDep[d.id] ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="text-right tabular-nums"
                      value={valores[d.id] ?? 0}
                      onChange={(e) =>
                        setValores((prev) => ({ ...prev, [d.id]: parseFloat(e.target.value || "0") }))
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
