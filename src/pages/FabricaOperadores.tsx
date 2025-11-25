import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, UserCircle, Users, TrendingUp, DollarSign } from "lucide-react";
import { CadastroOperadorDialog } from "@/components/fabrica/CadastroOperadorDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function FabricaOperadores() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: operadores, isLoading } = useQuery({
    queryKey: ["fabrica-operadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_operadores")
        .select("*")
        .order("nome");

      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "outline", label: string }> = {
      ativo: { variant: "default", label: "Ativo" },
      afastado: { variant: "secondary", label: "Afastado" },
      ferias: { variant: "secondary", label: "Férias" },
      inativo: { variant: "outline", label: "Inativo" },
    };

    const cfg = config[status] || config.ativo;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const getNivelBadge = (nivel: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "outline", label: string }> = {
      junior: { variant: "outline", label: "Júnior" },
      pleno: { variant: "secondary", label: "Pleno" },
      senior: { variant: "default", label: "Sênior" },
      especialista: { variant: "default", label: "Especialista" },
    };

    const cfg = config[nivel] || config.pleno;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const operadoresAtivos = operadores?.filter((o) => o.status === "ativo").length || 0;
  const custoMedioHora =
    operadores && operadores.length > 0
      ? operadores
          .filter((o) => o.custo_hora)
          .reduce((sum, o) => sum + (o.custo_hora || 0), 0) /
        operadores.filter((o) => o.custo_hora).length
      : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Operadores</h1>
            <p className="text-muted-foreground">
              Gerencie os operadores de produção
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Operador
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{operadores?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ativos</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {operadoresAtivos}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo Médio/Hora</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {custoMedioHora.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disponibilidade</CardTitle>
              <UserCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {operadores && operadores.length > 0
                  ? Math.round((operadoresAtivos / operadores.length) * 100)
                  : 0}
                %
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Operadores */}
        <Card>
          <CardHeader>
            <CardTitle>Operadores Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : operadores && operadores.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead className="text-right">Custo/Hora</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operadores.map((operador) => (
                    <TableRow key={operador.id}>
                      <TableCell className="font-medium">{operador.matricula}</TableCell>
                      <TableCell>{operador.nome}</TableCell>
                      <TableCell>{operador.funcao || "-"}</TableCell>
                      <TableCell>
                        {operador.nivel_experiencia
                          ? getNivelBadge(operador.nivel_experiencia)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {operador.custo_hora
                          ? `R$ ${operador.custo_hora.toFixed(2)}`
                          : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(operador.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <UserCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum operador cadastrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CadastroOperadorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </DashboardLayout>
  );
}
