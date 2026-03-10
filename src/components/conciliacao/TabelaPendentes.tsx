import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Link2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface TabelaPendentesProps {
  conciliacoes: any[];
  onMatch: (conciliacaoId: string, contaPagarId: string) => void;
  isMatching: boolean;
  filter?: string;
}

export function TabelaPendentes({ conciliacoes, onMatch, isMatching, filter = "all" }: TabelaPendentesProps) {
  const [searchContaPagar, setSearchContaPagar] = useState("");
  const [selectedConciliacao, setSelectedConciliacao] = useState<any>(null);

  const filtered = conciliacoes.filter((c) => {
    if (filter === "all") return true;
    return c.status_conciliacao === filter;
  });

  const { data: contasPagar } = useQuery({
    queryKey: ["contas-pagar-match", searchContaPagar],
    queryFn: async () => {
      let query = supabase
        .from("contas_pagar")
        .select("id, fornecedor_nome, valor_original, valor_aberto, data_vencimento, numero_documento, status")
        .in("status", ["Pendente", "Vencido", "Parcial"])
        .limit(20);

      if (searchContaPagar) {
        query = query.or(
          `fornecedor_nome.ilike.%${searchContaPagar}%,numero_documento.ilike.%${searchContaPagar}%`
        );
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!selectedConciliacao,
  });

  const statusBadge = (status: string, confianca: string | null) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      conciliado: "default",
      pendente: "secondary",
      divergente: "destructive",
    };
    return (
      <div className="flex items-center gap-1">
        <Badge variant={variants[status] || "outline"}>
          {status}
        </Badge>
        {confianca && (
          <Badge variant="outline" className="text-[10px]">
            {confianca}
          </Badge>
        )}
      </div>
    );
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhuma transação encontrada
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-sm">
                  {new Date(c.data_transacao).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-sm max-w-[300px] truncate">
                  {c.descricao}
                </TableCell>
                <TableCell className={`text-right text-sm font-medium ${c.valor < 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatCurrency(c.valor)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {c.tipo}
                  </Badge>
                </TableCell>
                <TableCell>{statusBadge(c.status_conciliacao, c.confianca)}</TableCell>
                <TableCell>
                  {c.status_conciliacao !== "conciliado" && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedConciliacao(c)}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          Vincular
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Vincular a Conta a Pagar</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Transação: <strong>{c.descricao}</strong> —{" "}
                            {formatCurrency(c.valor)} em{" "}
                            {new Date(c.data_transacao).toLocaleDateString("pt-BR")}
                          </p>
                          <div className="flex gap-2">
                            <Search className="h-4 w-4 mt-3 text-muted-foreground" />
                            <Input
                              placeholder="Buscar por fornecedor ou documento..."
                              value={searchContaPagar}
                              onChange={(e) => setSearchContaPagar(e.target.value)}
                            />
                          </div>
                          <div className="max-h-60 overflow-auto space-y-1">
                            {contasPagar?.map((cp: any) => (
                              <div
                                key={cp.id}
                                className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer border"
                                onClick={() => {
                                  onMatch(c.id, cp.id);
                                  setSelectedConciliacao(null);
                                }}
                              >
                                <div>
                                  <p className="text-sm font-medium">{cp.fornecedor_nome}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Doc: {cp.numero_documento || "—"} | Venc:{" "}
                                    {cp.data_vencimento
                                      ? new Date(cp.data_vencimento).toLocaleDateString("pt-BR")
                                      : "—"}
                                  </p>
                                </div>
                                <span className="text-sm font-medium">
                                  {formatCurrency(parseFloat(cp.valor_aberto || cp.valor_original))}
                                </span>
                              </div>
                            ))}
                            {contasPagar?.length === 0 && (
                              <p className="text-sm text-center text-muted-foreground py-4">
                                Nenhuma conta encontrada
                              </p>
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
