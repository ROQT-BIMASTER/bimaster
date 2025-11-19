import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, AlertTriangle, Package, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function FabricaPlanejamento() {
  const { data: necessidades } = useQuery({
    queryKey: ["fabrica-necessidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_planejamento_necessidades")
        .select(`
          *,
          fabrica_materias_primas (
            codigo,
            nome,
            estoque_atual,
            estoque_minimo,
            lead_time_dias
          )
        `)
        .order("data_necessidade");

      if (error) throw error;
      return data;
    },
  });

  const { data: mpsEmFalta } = useQuery({
    queryKey: ["fabrica-mps-em-falta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_materias_primas")
        .select("*")
        .or("estoque_atual.lt.estoque_minimo,estoque_atual.eq.0")
        .order("estoque_atual");

      if (error) throw error;
      return data;
    },
  });

  const necessidadesPendentes = necessidades?.filter(
    (n) => n.status === "planejado"
  ).length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Planejamento MRP
            </h1>
            <p className="text-muted-foreground mt-1">
              Material Requirements Planning - Gestão de Necessidades
            </p>
          </div>
          <Button>
            <TrendingUp className="mr-2 h-4 w-4" />
            Calcular Necessidades
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                MPs em Falta
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {mpsEmFalta?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Abaixo do mínimo
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Necessidades Pendentes
              </CardTitle>
              <Calendar className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{necessidadesPendentes}</div>
              <p className="text-xs text-muted-foreground">
                Aguardando compra
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Sugestões de Compra
              </CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                Para os próximos 30 dias
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Valor Estimado
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 0,00</div>
              <p className="text-xs text-muted-foreground">
                Compras sugeridas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas de Ruptura */}
        {mpsEmFalta && mpsEmFalta.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Alertas de Ruptura
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mpsEmFalta.slice(0, 5).map((mp) => (
                  <div
                    key={mp.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-destructive/5"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <div>
                        <p className="font-medium">{mp.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {mp.codigo}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive">
                        Estoque: {mp.estoque_atual || 0} /{" "}
                        {mp.estoque_minimo || 0}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Necessidades Planejadas */}
        <Card>
          <CardHeader>
            <CardTitle>Necessidades dos Próximos 90 Dias</CardTitle>
          </CardHeader>
          <CardContent>
            {necessidades && necessidades.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Matéria-Prima</TableHead>
                      <TableHead className="text-right">Necessário</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-right">A Comprar</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {necessidades.map((nec) => {
                      const mp = nec.fabrica_materias_primas;
                      return (
                        <TableRow key={nec.id}>
                          <TableCell>
                            {new Date(nec.data_necessidade).toLocaleDateString(
                              "pt-BR"
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{mp?.nome}</p>
                              <p className="text-sm text-muted-foreground">
                                {mp?.codigo}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {nec.quantidade_necessaria?.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {nec.quantidade_disponivel?.toFixed(2) || "0.00"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {nec.quantidade_a_comprar?.toFixed(2) || "0.00"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                nec.status === "planejado"
                                  ? "secondary"
                                  : "default"
                              }
                            >
                              {nec.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">
                              Gerar Compra
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma necessidade planejada
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Execute o cálculo de MRP para gerar o planejamento
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
