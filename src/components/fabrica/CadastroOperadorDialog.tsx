import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserCircle } from "lucide-react";

interface CadastroOperadorDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CadastroOperadorDialog({ open, onClose }: CadastroOperadorDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    matricula: "",
    nome: "",
    funcao: "",
    custo_hora: "",
    centro_custo: "",
    nivel_experiencia: "pleno",
    status: "ativo",
    data_admissao: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const operadorData = {
        matricula: formData.matricula,
        nome: formData.nome,
        funcao: formData.funcao || null,
        custo_hora: formData.custo_hora ? parseFloat(formData.custo_hora) : null,
        centro_custo: formData.centro_custo || null,
        nivel_experiencia: formData.nivel_experiencia,
        status: formData.status,
        data_admissao: formData.data_admissao || null,
      };

      const { error } = await supabase
        .from("fabrica_operadores")
        .insert(operadorData);

      if (error) throw error;

      toast.success("Operador cadastrado com sucesso!");
      onClose();
      
      // Resetar formulário
      setFormData({
        matricula: "",
        nome: "",
        funcao: "",
        custo_hora: "",
        centro_custo: "",
        nivel_experiencia: "pleno",
        status: "ativo",
        data_admissao: "",
      });
    } catch (error: any) {
      console.error("Erro ao cadastrar operador:", error);
      toast.error("Erro ao cadastrar operador: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Cadastrar Novo Operador
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">
              DADOS PESSOAIS
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="matricula">Matrícula *</Label>
                <Input
                  id="matricula"
                  value={formData.matricula}
                  onChange={(e) =>
                    setFormData({ ...formData, matricula: e.target.value })
                  }
                  placeholder="OP-001"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="João da Silva"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="funcao">Função</Label>
                <Input
                  id="funcao"
                  value={formData.funcao}
                  onChange={(e) =>
                    setFormData({ ...formData, funcao: e.target.value })
                  }
                  placeholder="Operador de Máquina, Auxiliar..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_admissao">Data de Admissão</Label>
                <Input
                  id="data_admissao"
                  type="date"
                  value={formData.data_admissao}
                  onChange={(e) =>
                    setFormData({ ...formData, data_admissao: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Custos e Classificação */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">
              CUSTOS E CLASSIFICAÇÃO
            </h3>
            <div className="grid grid-cols-3 gap-4">
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
                  placeholder="25.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="centro_custo">Centro de Custo</Label>
                <Input
                  id="centro_custo"
                  value={formData.centro_custo}
                  onChange={(e) =>
                    setFormData({ ...formData, centro_custo: e.target.value })
                  }
                  placeholder="MOD-PROD"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nivel_experiencia">Nível</Label>
                <Select
                  value={formData.nivel_experiencia}
                  onValueChange={(value) =>
                    setFormData({ ...formData, nivel_experiencia: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="junior">Júnior</SelectItem>
                    <SelectItem value="pleno">Pleno</SelectItem>
                    <SelectItem value="senior">Sênior</SelectItem>
                    <SelectItem value="especialista">Especialista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground">
              STATUS
            </h3>
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
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Cadastrando..." : "Cadastrar Operador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
