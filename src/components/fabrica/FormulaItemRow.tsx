import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, GripVertical, Plus, Package, FileText, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";

interface FormulaItemRowProps {
  item: any;
  index: number;
  materiasPrimas: any[];
  onUpdate: (index: number, campo: string, valor: any) => void;
  onRemove: (index: number) => void;
}

export function FormulaItemRow({
  item,
  index,
  materiasPrimas,
  onUpdate,
  onRemove,
}: FormulaItemRowProps) {
  const queryClient = useQueryClient();
  const mpSelecionada = materiasPrimas.find((mp) => mp.id === item.mp_id);

  // Estado para cadastro rápido
  const [showNovaMP, setShowNovaMP] = useState(false);
  const [novaMP, setNovaMP] = useState({ 
    codigo: "", 
    nome: "", 
    unidade_medida_id: "",
    categoria_id: "",
    custo_unitario: "",
    estoque_minimo: "",
    lead_time_dias: "",
    observacoes: ""
  });
  const [salvando, setSalvando] = useState(false);

  // Buscar unidades de medida
  const { data: unidades } = useQuery({
    queryKey: ["fabrica-unidades-medida"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_unidades_medida")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Buscar categorias
  const { data: categorias } = useQuery({
    queryKey: ["fabrica-categorias-mp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_categorias_mp")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setNovaMP({ 
      codigo: "", 
      nome: "", 
      unidade_medida_id: "",
      categoria_id: "",
      custo_unitario: "",
      estoque_minimo: "",
      lead_time_dias: "",
      observacoes: ""
    });
  };

  const salvarNovaMP = async () => {
    if (!novaMP.codigo.trim() || !novaMP.nome.trim() || !novaMP.unidade_medida_id) {
      toast.error("Código, nome e unidade de medida são obrigatórios");
      return;
    }

    setSalvando(true);
    try {
      const { data, error } = await supabase
        .from("fabrica_materias_primas")
        .insert({
          codigo: novaMP.codigo.trim(),
          nome: novaMP.nome.trim(),
          unidade_medida_id: novaMP.unidade_medida_id,
          categoria_id: novaMP.categoria_id || null,
          custo_unitario: novaMP.custo_unitario ? parseFloat(novaMP.custo_unitario) : null,
          estoque_minimo: novaMP.estoque_minimo ? parseFloat(novaMP.estoque_minimo) : null,
          lead_time_dias: novaMP.lead_time_dias ? parseInt(novaMP.lead_time_dias) : null,
          observacoes: novaMP.observacoes.trim() || null,
          status: "disponivel",
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Matéria-prima cadastrada com sucesso!");
      
      // Atualizar lista
      queryClient.invalidateQueries({ queryKey: ["fabrica-mps-ativas"] });
      
      // Vincular ao item
      if (data) {
        onUpdate(index, "mp_id", data.id);
      }

      setShowNovaMP(false);
      resetForm();
    } catch (error: any) {
      toast.error("Erro ao cadastrar: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className="flex items-start gap-3 p-4 border rounded-lg bg-background">
        <div className="cursor-move pt-2">
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="flex-1 grid gap-3 md:grid-cols-12">
          {/* Ordem */}
          <div className="md:col-span-1">
            <Input
              type="number"
              value={item.ordem_adicao || ""}
              onChange={(e) =>
                onUpdate(index, "ordem_adicao", e.target.value ? parseInt(e.target.value) : 1)
              }
              min="1"
              className="text-center"
            />
          </div>

          {/* Matéria Prima */}
          <div className="md:col-span-4">
            <div className="flex gap-2">
              <Select
                value={item.mp_id}
                onValueChange={(value) => onUpdate(index, "mp_id", value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione a matéria-prima" />
                </SelectTrigger>
                <SelectContent>
                  {materiasPrimas.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>
                      {mp.codigo} - {mp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowNovaMP(true)}
                title="Cadastrar nova matéria-prima"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quantidade */}
          <div className="md:col-span-2">
            <div className="relative">
              <Input
                type="number"
                value={item.quantidade || ""}
                onChange={(e) =>
                  onUpdate(index, "quantidade", e.target.value ? parseFloat(e.target.value) : 0)
                }
                step="0.01"
                placeholder="Qtd"
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {mpSelecionada?.fabrica_unidades_medida?.sigla || "un"}
              </span>
            </div>
          </div>

          {/* Percentual */}
          <div className="md:col-span-2">
            <div className="relative">
              <Input
                type="number"
                value={item.percentual || ""}
                onChange={(e) =>
                  onUpdate(index, "percentual", e.target.value ? parseFloat(e.target.value) : 0)
                }
                step="0.01"
                placeholder="%"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </div>

          {/* Criticidade */}
          <div className="md:col-span-2">
            <Select
              value={item.criticidade}
              onValueChange={(value) => onUpdate(index, "criticidade", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critico">
                  <Badge variant="destructive" className="text-xs">
                    Crítico
                  </Badge>
                </SelectItem>
                <SelectItem value="importante">
                  <Badge className="text-xs">Importante</Badge>
                </SelectItem>
                <SelectItem value="opcional">
                  <Badge variant="secondary" className="text-xs">
                    Opcional
                  </Badge>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Remover */}
          <div className="md:col-span-1 flex items-start">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(index)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog de Cadastro Rápido de Matéria-Prima */}
      <Dialog open={showNovaMP} onOpenChange={(open) => { setShowNovaMP(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Cadastrar Nova Matéria-Prima
            </DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo ou importe via XML de nota fiscal.
            </DialogDescription>
          </DialogHeader>

          {/* Link para recebimento via XML */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Deseja importar via Nota Fiscal?</span>
            </div>
            <Link to="/dashboard/fabrica/recebimentos">
              <Button variant="outline" size="sm" type="button">
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Recebimento XML
              </Button>
            </Link>
          </div>

          <div className="space-y-4 py-2">
            {/* Campos obrigatórios */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={novaMP.codigo}
                  onChange={(e) => setNovaMP({ ...novaMP, codigo: e.target.value })}
                  placeholder="Ex: MP-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade de Medida *</Label>
                <Select
                  value={novaMP.unidade_medida_id}
                  onValueChange={(value) => setNovaMP({ ...novaMP, unidade_medida_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades?.map((un) => (
                      <SelectItem key={un.id} value={un.id}>
                        {un.sigla} - {un.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={novaMP.nome}
                onChange={(e) => setNovaMP({ ...novaMP, nome: e.target.value })}
                placeholder="Ex: Farinha de Trigo Tipo 1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={novaMP.categoria_id || "none"}
                  onValueChange={(value) => setNovaMP({ ...novaMP, categoria_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categorias?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Custo Unitário (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={novaMP.custo_unitario}
                  onChange={(e) => setNovaMP({ ...novaMP, custo_unitario: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estoque Mínimo</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={novaMP.estoque_minimo}
                  onChange={(e) => setNovaMP({ ...novaMP, estoque_minimo: e.target.value })}
                  placeholder="Quantidade mínima em estoque"
                />
              </div>
              <div className="space-y-2">
                <Label>Lead Time (dias)</Label>
                <Input
                  type="number"
                  value={novaMP.lead_time_dias}
                  onChange={(e) => setNovaMP({ ...novaMP, lead_time_dias: e.target.value })}
                  placeholder="Tempo de reposição"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                value={novaMP.observacoes}
                onChange={(e) => setNovaMP({ ...novaMP, observacoes: e.target.value })}
                placeholder="Informações adicionais sobre a matéria-prima"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovaMP(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarNovaMP} disabled={salvando}>
              {salvando ? "Salvando..." : "Cadastrar Matéria-Prima"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
