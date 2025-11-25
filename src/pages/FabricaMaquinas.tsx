import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Settings, Wrench, TrendingUp, AlertCircle } from "lucide-react";
import { CadastroMaquinaDialog } from "@/components/fabrica/CadastroMaquinaDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function FabricaMaquinas() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: maquinas, isLoading } = useQuery({
    queryKey: ["fabrica-maquinas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_maquinas")
        .select("*")
        .order("codigo");

      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      ativo: { variant: "default", label: "Ativo" },
      manutencao: { variant: "secondary", label: "Manutenção" },
      inativo: { variant: "outline", label: "Inativo" },
    };

    const cfg = config[status] || config.ativo;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const maquinasAtivas = maquinas?.filter((m) => m.status === "ativo").length || 0;
  const maquinasManutencao = maquinas?.filter((m) => m.status === "manutencao").length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Máquinas</h1>
            <p className="text-muted-foreground">
              Gerencie as máquinas e equipamentos da fábrica
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Máquina
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{maquinas?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ativas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{maquinasAtivas}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Manutenção</CardTitle>
              <Wrench className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{maquinasManutencao}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disponibilidade</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {maquinas && maquinas.length > 0
                  ? Math.round((maquinasAtivas / maquinas.length) * 100)
                  : 0}
                %
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Máquinas */}
        <Card>
          <CardHeader>
            <CardTitle>Máquinas Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : maquinas && maquinas.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Capacidade</TableHead>
                    <TableHead className="text-right">Custo/Hora</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maquinas.map((maquina) => (
                    <TableRow key={maquina.id}>
                      <TableCell className="font-medium">{maquina.codigo}</TableCell>
                      <TableCell>{maquina.nome}</TableCell>
                      <TableCell>{maquina.tipo || "-"}</TableCell>
                      <TableCell>
                        {maquina.capacidade_hora
                          ? `${maquina.capacidade_hora} ${maquina.unidade_capacidade || "un"}/h`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {maquina.custo_hora
                          ? `R$ ${maquina.custo_hora.toFixed(2)}`
                          : "-"}
                      </TableCell>
                      <TableCell>{maquina.localizacao || "-"}</TableCell>
                      <TableCell>{getStatusBadge(maquina.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma máquina cadastrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CadastroMaquinaDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </DashboardLayout>
  );
}
