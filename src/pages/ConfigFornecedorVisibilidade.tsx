import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Building2, Eye, Save, Loader2 } from "lucide-react";
import { useEmpresaFilter } from "@/hooks/useEmpresaFilter";

interface VisibilityConfig {
  id: string;
  empresa_id: number;
  modulo: string;
  visibilidade: string;
  empresa_nome?: string;
}

const MODULOS = [
  { value: "contas_pagar", label: "Contas a Pagar" },
  { value: "trade", label: "Trade Marketing" },
  { value: "eventos", label: "Eventos" },
];

const VISIBILIDADE_OPTIONS = [
  { value: "propria", label: "Apenas própria empresa", description: "Vê somente fornecedores vinculados à sua empresa" },
  { value: "grupo", label: "Empresas do grupo", description: "Vê fornecedores de todas as empresas do mesmo grupo" },
  { value: "todas", label: "Todas as empresas", description: "Vê todos os fornecedores do sistema" },
];

export default function ConfigFornecedorVisibilidade() {
  const queryClient = useQueryClient();
  const { empresasDoUsuario } = useEmpresaFilter();
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("");
  const [selectedModulo, setSelectedModulo] = useState<string>("contas_pagar");

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["config-fornecedor-visibilidade"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_fornecedor_visibilidade")
        .select("*")
        .order("empresa_id");
      if (error) throw error;
      return data as VisibilityConfig[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ empresa_id, modulo, visibilidade }: { empresa_id: number; modulo: string; visibilidade: string }) => {
      const { error } = await supabase
        .from("config_fornecedor_visibilidade")
        .upsert(
          { empresa_id, modulo, visibilidade, updated_at: new Date().toISOString() },
          { onConflict: "empresa_id,modulo" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-fornecedor-visibilidade"] });
      toast.success("Configuração salva!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getConfigValue = (empresaId: number, modulo: string): string => {
    const config = configs.find(c => c.empresa_id === empresaId && c.modulo === modulo);
    return config?.visibilidade || "todas";
  };

  const handleChange = (empresaId: number, modulo: string, visibilidade: string) => {
    saveMutation.mutate({ empresa_id: empresaId, modulo, visibilidade });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Visibilidade de Fornecedores</h1>
          <p className="text-sm text-muted-foreground">
            Configure quais fornecedores cada empresa pode visualizar por módulo.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" /> Regras de Visibilidade
          </CardTitle>
          <CardDescription>
            Defina se cada empresa vê apenas seus fornecedores, os do grupo, ou todos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  {MODULOS.map(m => (
                    <TableHead key={m.value}>{m.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {empresasDoUsuario.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhuma empresa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  empresasDoUsuario.map(empresa => (
                    <TableRow key={empresa.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {empresa.nome}
                        </div>
                      </TableCell>
                      {MODULOS.map(modulo => (
                        <TableCell key={modulo.value}>
                          <Select
                            value={getConfigValue(empresa.id, modulo.value)}
                            onValueChange={(v) => handleChange(empresa.id, modulo.value, v)}
                          >
                            <SelectTrigger className="w-[180px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VISIBILIDADE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <div>
                                    <span className="text-xs font-medium">{opt.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legenda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {VISIBILIDADE_OPTIONS.map(opt => (
              <div key={opt.value} className="flex items-start gap-2">
                <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">{opt.value}</Badge>
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
