import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";
import { FileText, Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RegraFiscal {
  id: string;
  nome: string;
  tipo_imposto: string;
  cfop: string;
  cst: string;
  aliquota: number;
  base_calculo_reduzida?: number;
  observacoes?: string;
  ativo: boolean;
}

export default function FabricaTabelaImpostos() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegra, setEditingRegra] = useState<RegraFiscal | null>(null);
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");

  const [formData, setFormData] = useState({
    nome: "",
    tipo_imposto: "ICMS",
    cfop: "",
    cst: "",
    aliquota: "",
    base_calculo_reduzida: "",
    observacoes: "",
  });

  const { data: regras, isLoading } = useSupabaseQuery<RegraFiscal[]>(
    ["regras-fiscais", tipoFiltro],
    async () => {
      let query = supabase
        .from("fabrica_regras_fiscais" as any)
        .select("*")
        .eq("ativo", true)
        .order("tipo_imposto")
        .order("nome");

      if (tipoFiltro !== "todos") {
        query = query.eq("tipo_imposto", tipoFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RegraFiscal[];
    }
  );

  const salvarMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingRegra) {
        const { error } = await supabase
          .from("fabrica_regras_fiscais" as any)
          .update(data)
          .eq("id", editingRegra.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fabrica_regras_fiscais" as any)
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingRegra ? "Regra atualizada!" : "Regra criada!");
      queryClient.invalidateQueries({ queryKey: ["regras-fiscais"] });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao salvar regra");
    },
  });

  const deletarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fabrica_regras_fiscais" as any)
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regra removida!");
      queryClient.invalidateQueries({ queryKey: ["regras-fiscais"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao remover regra");
    },
  });

  const handleOpenDialog = (regra?: RegraFiscal) => {
    if (regra) {
      setEditingRegra(regra);
      setFormData({
        nome: regra.nome,
        tipo_imposto: regra.tipo_imposto,
        cfop: regra.cfop,
        cst: regra.cst,
        aliquota: regra.aliquota.toString(),
        base_calculo_reduzida: regra.base_calculo_reduzida?.toString() || "",
        observacoes: regra.observacoes || "",
      });
    } else {
      setEditingRegra(null);
      setFormData({
        nome: "",
        tipo_imposto: "ICMS",
        cfop: "",
        cst: "",
        aliquota: "",
        base_calculo_reduzida: "",
        observacoes: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRegra(null);
    setFormData({
      nome: "",
      tipo_imposto: "ICMS",
      cfop: "",
      cst: "",
      aliquota: "",
      base_calculo_reduzida: "",
      observacoes: "",
    });
  };

  const handleSubmit = () => {
    if (!formData.nome || !formData.cfop || !formData.cst || !formData.aliquota) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    salvarMutation.mutate({
      nome: formData.nome,
      tipo_imposto: formData.tipo_imposto,
      cfop: formData.cfop,
      cst: formData.cst,
      aliquota: parseFloat(formData.aliquota),
      base_calculo_reduzida: formData.base_calculo_reduzida
        ? parseFloat(formData.base_calculo_reduzida)
        : null,
      observacoes: formData.observacoes || null,
      ativo: true,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => window.history.back()}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8" />
              Tabela de Impostos
            </h1>
            <p className="text-muted-foreground">
              Configure as regras fiscais e tributárias padrão
            </p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Regra
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tipoFiltro} onValueChange={setTipoFiltro}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="ICMS">ICMS</TabsTrigger>
                <TabsTrigger value="IPI">IPI</TabsTrigger>
                <TabsTrigger value="PIS">PIS</TabsTrigger>
                <TabsTrigger value="COFINS">COFINS</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Tabela de Regras */}
        <Card>
          <CardHeader>
            <CardTitle>Regras Cadastradas</CardTitle>
            <CardDescription>
              Regras fiscais para aplicação automática nos produtos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando regras...
              </div>
            ) : !regras || regras.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma regra cadastrada
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>CFOP</TableHead>
                      <TableHead>CST</TableHead>
                      <TableHead className="text-right">Alíquota</TableHead>
                      <TableHead className="text-right">BC Reduzida</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regras.map((regra) => (
                      <TableRow key={regra.id}>
                        <TableCell className="font-medium">
                          {regra.nome}
                        </TableCell>
                        <TableCell>{regra.tipo_imposto}</TableCell>
                        <TableCell>{regra.cfop}</TableCell>
                        <TableCell>{regra.cst}</TableCell>
                        <TableCell className="text-right">
                          {regra.aliquota}%
                        </TableCell>
                        <TableCell className="text-right">
                          {regra.base_calculo_reduzida
                            ? `${regra.base_calculo_reduzida}%`
                            : "-"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {regra.observacoes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(regra)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deletarMutation.mutate(regra.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Criação/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRegra ? "Editar Regra Fiscal" : "Nova Regra Fiscal"}
            </DialogTitle>
            <DialogDescription>
              Configure a regra fiscal que será aplicada aos produtos
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome da Regra *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                placeholder="Ex: ICMS Normal SP"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tipo_imposto">Tipo de Imposto *</Label>
                <Select
                  value={formData.tipo_imposto}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tipo_imposto: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ICMS">ICMS</SelectItem>
                    <SelectItem value="IPI">IPI</SelectItem>
                    <SelectItem value="PIS">PIS</SelectItem>
                    <SelectItem value="COFINS">COFINS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cfop">CFOP *</Label>
                <Input
                  id="cfop"
                  value={formData.cfop}
                  onChange={(e) =>
                    setFormData({ ...formData, cfop: e.target.value })
                  }
                  placeholder="Ex: 5101"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cst">CST *</Label>
                <Input
                  id="cst"
                  value={formData.cst}
                  onChange={(e) =>
                    setFormData({ ...formData, cst: e.target.value })
                  }
                  placeholder="Ex: 00"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="aliquota">Alíquota (%) *</Label>
                <Input
                  id="aliquota"
                  type="number"
                  step="0.01"
                  value={formData.aliquota}
                  onChange={(e) =>
                    setFormData({ ...formData, aliquota: e.target.value })
                  }
                  placeholder="Ex: 18.00"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="base_calculo_reduzida">
                Base de Cálculo Reduzida (%)
              </Label>
              <Input
                id="base_calculo_reduzida"
                type="number"
                step="0.01"
                value={formData.base_calculo_reduzida}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    base_calculo_reduzida: e.target.value,
                  })
                }
                placeholder="Ex: 61.11"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Input
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) =>
                  setFormData({ ...formData, observacoes: e.target.value })
                }
                placeholder="Informações adicionais sobre a regra"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={salvarMutation.isPending}>
              {salvarMutation.isPending
                ? "Salvando..."
                : editingRegra
                ? "Atualizar"
                : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
