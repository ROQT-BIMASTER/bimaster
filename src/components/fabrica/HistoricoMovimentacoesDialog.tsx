import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, TrendingUp, TrendingDown, Plus, Minus, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HistoricoMovimentacoesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materiaPrimaId: string;
  materiaPrimaNome: string;
}

interface Movimentacao {
  id: string;
  tipo_movimento: string;
  quantidade: number;
  quantidade_anterior: number | null;
  quantidade_nova: number | null;
  custo_unitario: number | null;
  custo_total: number | null;
  lote: string | null;
  data_validade: string | null;
  observacoes: string | null;
  created_at: string;
}

const tipoMovimentoConfig = {
  entrada: {
    label: "Entrada",
    color: "default" as const,
    icon: TrendingUp,
  },
  saida: {
    label: "Saída",
    color: "secondary" as const,
    icon: TrendingDown,
  },
  ajuste: {
    label: "Ajuste",
    color: "outline" as const,
    icon: RefreshCw,
  },
  transferencia: {
    label: "Transferência",
    color: "outline" as const,
    icon: Plus,
  },
};

export function HistoricoMovimentacoesDialog({
  open,
  onOpenChange,
  materiaPrimaId,
  materiaPrimaNome,
}: HistoricoMovimentacoesDialogProps) {
  const { data: movimentacoes, isLoading } = useQuery({
    queryKey: ["movimentacoes", materiaPrimaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_movimentacoes_estoque")
        .select("*")
        .eq("mp_id", materiaPrimaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Movimentacao[];
    },
    enabled: open && !!materiaPrimaId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            Histórico de Movimentações - {materiaPrimaNome}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !movimentacoes || movimentacoes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma movimentação registrada para esta matéria-prima
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(85vh-120px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Estoque Anterior</TableHead>
                  <TableHead className="text-right">Estoque Novo</TableHead>
                  <TableHead className="text-right">Custo Unit.</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoes.map((mov) => {
                  const config = tipoMovimentoConfig[mov.tipo_movimento as keyof typeof tipoMovimentoConfig] || tipoMovimentoConfig.ajuste;
                  const Icon = config.icon;

                  return (
                    <TableRow key={mov.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(mov.created_at), "dd/MM/yyyy HH:mm", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={config.color} className="gap-1">
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {mov.tipo_movimento === "saida" && "-"}
                        {mov.quantidade.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {mov.quantidade_anterior !== null
                          ? mov.quantidade_anterior.toFixed(3)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {mov.quantidade_nova !== null
                          ? mov.quantidade_nova.toFixed(3)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {mov.custo_unitario !== null
                          ? `R$ ${mov.custo_unitario.toFixed(2)}`
                          : "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {mov.lote || "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {mov.data_validade
                          ? format(new Date(mov.data_validade), "dd/MM/yyyy", {
                              locale: ptBR,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                        {mov.observacoes || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
