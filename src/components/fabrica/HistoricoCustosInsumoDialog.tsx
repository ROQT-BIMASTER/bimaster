import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HistoricoItem {
  id: string;
  campo: string;
  valor_anterior: number;
  valor_novo: number;
  motivo: string | null;
  usuario_nome: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoCustoId: string;
  insumoNome: string;
}

const campoLabels: Record<string, string> = {
  custo_nf: "NF",
  custo_servico: "Serviço",
  custo_condicao: "Condição",
};

export function HistoricoCustosInsumoDialog({ open, onOpenChange, produtoCustoId, insumoNome }: Props) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !produtoCustoId) return;
    setLoading(true);
    supabase
      .from("fabrica_insumo_custo_historico")
      .select("*")
      .eq("produto_custo_id", produtoCustoId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setHistorico(data as HistoricoItem[]);
        setLoading(false);
      });
  }, [open, produtoCustoId]);

  const formatarMoeda = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 6 });

  const calcVariacao = (anterior: number, novo: number) => {
    if (anterior === 0) return novo > 0 ? 100 : 0;
    return ((novo - anterior) / anterior) * 100;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Custos — {insumoNome}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Carregando...</p>
        ) : historico.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nenhuma alteração registrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Campo</TableHead>
                <TableHead className="text-right">Anterior</TableHead>
                <TableHead className="text-right">Novo</TableHead>
                <TableHead className="text-right">Variação</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.map((h) => {
                const variacao = calcVariacao(Number(h.valor_anterior), Number(h.valor_novo));
                const aumentou = variacao > 0;
                const diminuiu = variacao < 0;
                return (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(h.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{campoLabels[h.campo] || h.campo}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatarMoeda(Number(h.valor_anterior))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatarMoeda(Number(h.valor_novo))}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`flex items-center justify-end gap-1 text-sm font-medium ${aumentou ? "text-red-600" : diminuiu ? "text-green-600" : "text-muted-foreground"}`}>
                        {aumentou ? <ArrowUp className="h-3 w-3" /> : diminuiu ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {Math.abs(variacao).toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{h.usuario_nome || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{h.motivo || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
