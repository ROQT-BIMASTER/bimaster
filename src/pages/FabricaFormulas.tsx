import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Package, FileText, History, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function FabricaFormulas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");

  const { data: formulas, isLoading } = useQuery({
    queryKey: ["fabrica-formulas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_formulas")
        .select(`
          *,
          fabrica_produtos (
            id,
            nome,
            codigo
          ),
          fabrica_formula_itens (count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const formulasFiltradas = formulas?.filter((formula) => {
    const produto = formula.fabrica_produtos;
    const searchTerm = busca.toLowerCase();
    return (
      produto?.nome?.toLowerCase().includes(searchTerm) ||
      produto?.codigo?.toLowerCase().includes(searchTerm)
    );
  });

  const excluirMutation = useMutation({
    mutationFn: async (formulaId: string) => {
      const { error } = await supabase
        .from("fabrica_formulas")
        .delete()
        .eq("id", formulaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fórmula excluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["fabrica-formulas"] });
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir: " + error.message);
    }
  });

  const handleExcluir = (e: React.MouseEvent, formula: any) => {
    e.stopPropagation();
    if (!confirm(`Tem certeza que deseja excluir a fórmula do produto "${formula.fabrica_produtos?.nome}"?`)) {
      return;
    }
    excluirMutation.mutate(formula.id);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Fórmulas de Produção
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as fórmulas (BOM) dos produtos
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard/fabrica/formulas/nova")}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Fórmula
          </Button>
        </div>

        {/* Busca */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por produto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Lista de Fórmulas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : formulasFiltradas && formulasFiltradas.length > 0 ? (
            formulasFiltradas.map((formula) => {
              const produto = formula.fabrica_produtos;
              const numItens = formula.fabrica_formula_itens?.[0]?.count || 0;

              return (
                <Card
                  key={formula.id}
                  className="hover:border-primary cursor-pointer transition-colors"
                  onClick={() =>
                    navigate(`/dashboard/fabrica/formulas/${formula.id}`)
                  }
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          {produto?.nome || "Produto sem nome"}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {produto?.codigo}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={formula.ativa ? "default" : "secondary"}>
                          {formula.ativa ? "Ativa" : "Inativa"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleExcluir(e, formula)}
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Package className="h-4 w-4" />
                        <span>{numItens} ingredientes</span>
                      </div>
                      {formula.rendimento && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />
                          <span>Rendimento: {formula.rendimento} un</span>
                        </div>
                      )}
                      {formula.versao && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <History className="h-4 w-4" />
                          <span>Versão {formula.versao}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {busca
                    ? "Nenhuma fórmula encontrada"
                    : "Nenhuma fórmula cadastrada ainda"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
