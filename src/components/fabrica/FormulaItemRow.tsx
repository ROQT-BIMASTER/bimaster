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
import { Trash2, GripVertical, Plus, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
    unidade_medida_id: "" 
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
      setNovaMP({ codigo: "", nome: "", unidade_medida_id: "" });
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
              value={item.ordem_adicao}
              onChange={(e) =>
                onUpdate(index, "ordem_adicao", parseInt(e.target.value))
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
                value={item.quantidade}
                onChange={(e) =>
                  onUpdate(index, "quantidade", parseFloat(e.target.value))
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
                value={item.percentual}
                onChange={(e) =>
                  onUpdate(index, "percentual", parseFloat(e.target.value))
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
      <Dialog open={showNovaMP} onOpenChange={setShowNovaMP}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Cadastrar Nova Matéria-Prima
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={novaMP.codigo}
                onChange={(e) => setNovaMP({ ...novaMP, codigo: e.target.value })}
                placeholder="Ex: MP-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={novaMP.nome}
                onChange={(e) => setNovaMP({ ...novaMP, nome: e.target.value })}
                placeholder="Ex: Farinha de Trigo"
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
