import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function NFSaidaListagem() {
  const { data: notas, isLoading } = useQuery({
    queryKey: ["nf-saida"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("fabrica_notas_fiscais_saida") as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Array<{
        id: string;
        numero_nf: string;
        serie: string;
        data_emissao: string;
        cliente_nome: string;
        cliente_cnpj: string | null;
        valor_total: number;
        status: string;
      }>;
    },
  });

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const statusColor = (s: string) => {
    switch (s) {
      case "emitida": return "default";
      case "cancelada": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notas Fiscais de Saída</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !notas || notas.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">
            Nenhuma NF de saída registrada ainda.
          </p>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NF</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notas.map((nf) => (
                  <TableRow key={nf.id}>
                    <TableCell className="font-medium">
                      {nf.numero_nf}/{nf.serie}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {nf.data_emissao
                        ? new Date(nf.data_emissao + "T00:00:00").toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {nf.cliente_nome}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {nf.cliente_cnpj || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {fmt(nf.valor_total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor(nf.status) as any}>
                        {nf.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
