import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings } from "lucide-react";

interface CadastroMaquinaDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CadastroMaquinaDialog({ open, onClose }: CadastroMaquinaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    tipo: "",
    fabricante: "",
    numero_serie: "",
    ano_fabricacao: "",
    capacidade_hora: "",
    unidade_capacidade: "",
    custo_hora: "",
    centro_custo: "",
    localizacao: "",
    status: "ativo",
    observacoes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const maquinaData = {
        codigo: formData.codigo,
        nome: formData.nome,
        tipo: formData.tipo || null,
        fabricante: formData.fabricante || null,
        numero_serie: formData.numero_serie || null,
        ano_fabricacao: formData.ano_fabricacao ? parseInt(formData.ano_fabricacao) : null,
        capacidade_hora: formData.capacidade_hora ? parseFloat(formData.capacidade_hora) : null,
        unidade_capacidade: formData.unidade_capacidade || null,
        custo_hora: formData.custo_hora ? parseFloat(formData.custo_hora) : null,
        centro_custo: formData.centro_custo || null,
        localizacao: formData.localizacao || null,
        status: formData.status,
        observacoes: formData.observacoes || null,
      };

      const { error } = await supabase
        .from("fabrica_maquinas")
        .insert(maquinaData);

      if (error) throw error;

      toast.success("Máquina cadastrada com sucesso!");
      onClose();
      
      // Resetar formulário
      setFormData({
        codigo: "",
        nome: "",
        tipo: "",
        fabricante: "",
        numero_serie: "",
        ano_fabricacao: "",
        capacidade_hora: "",
        unidade_capacidade: "",
        custo_hora: "",
        centro_custo: "",
        localizacao: "",
        status: "ativo",
        observacoes: "",
      });
    } catch (error: any) {
      console.error("Erro ao cadastrar máquina:", error);
      toast.error("Erro ao cadastrar máquina: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Cadastrar Nova Máquina
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identificação */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">
              IDENTIFICAÇÃO
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo: e.target.value })
                  }
                  placeholder="MAQ-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Injetora Principal"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Input
                  id="tipo"
                  value={formData.tipo}
                  onChange={(e) =>
                    setFormData({ ...formData, tipo: e.target.value })
                  }
                  placeholder="Injetora, Extrusora, CNC..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fabricante">Fabricante</Label>
                <Input
                  id="fabricante"
                  value={formData.fabricante}
                  onChange={(e) =>
                    setFormData({ ...formData, fabricante: e.target.value })
                  }
                  placeholder="Nome do fabricante"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="numero_serie">Número de Série</Label>
                <Input
                  id="numero_serie"
                  value={formData.numero_serie}
                  onChange={(e) =>
                    setFormData({ ...formData, numero_serie: e.target.value })
                  }
                  placeholder="NS-123456"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ano_fabricacao">Ano Fabricação</Label>
                <Input
                  id="ano_fabricacao"
                  type="number"
                  value={formData.ano_fabricacao}
                  onChange={(e) =>
                    setFormData({ ...formData, ano_fabricacao: e.target.value })
                  }
                  placeholder="2020"
                  min="1950"
                  max={new Date().getFullYear()}
                />
              </div>
            </div>
          </div>

          {/* Capacidade e Custos */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">
              CAPACIDADE E CUSTOS
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacidade_hora">Capacidade/Hora</Label>
                <Input
                  id="capacidade_hora"
                  type="number"
                  step="0.001"
                  value={formData.capacidade_hora}
                  onChange={(e) =>
                    setFormData({ ...formData, capacidade_hora: e.target.value })
                  }
                  placeholder="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unidade_capacidade">Unidade</Label>
                <Input
                  id="unidade_capacidade"
                  value={formData.unidade_capacidade}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unidade_capacidade: e.target.value,
                    })
                  }
                  placeholder="kg, peças, litros..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custo_hora">Custo/Hora (R$)</Label>
                <Input
                  id="custo_hora"
                  type="number"
                  step="0.01"
                  value={formData.custo_hora}
                  onChange={(e) =>
                    setFormData({ ...formData, custo_hora: e.target.value })
                  }
                  placeholder="150.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="centro_custo">Centro de Custo</Label>
                <Input
                  id="centro_custo"
                  value={formData.centro_custo}
                  onChange={(e) =>
                    setFormData({ ...formData, centro_custo: e.target.value })
                  }
                  placeholder="PROD-01"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="localizacao">Localização</Label>
                <Input
                  id="localizacao"
                  value={formData.localizacao}
                  onChange={(e) =>
                    setFormData({ ...formData, localizacao: e.target.value })
                  }
                  placeholder="Pavilhão A - Setor 2"
                />
              </div>
            </div>
          </div>

          {/* Status e Observações */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="manutencao">Em Manutenção</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) =>
                  setFormData({ ...formData, observacoes: e.target.value })
                }
                placeholder="Informações adicionais sobre a máquina..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Cadastrando..." : "Cadastrar Máquina"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
