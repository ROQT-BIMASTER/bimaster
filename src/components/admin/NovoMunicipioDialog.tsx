import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus } from "lucide-react";

interface NovoMunicipioDialogProps {
  onSuccess: () => void;
}

export const NovoMunicipioDialog = ({ onSuccess }: NovoMunicipioDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    uf: "",
    regiao: "",
    micro_regiao: "",
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.uf || !formData.regiao) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Mapear valores para os aceitos pelo banco
      const regiaoMap: Record<string, "Norte" | "Sul" | "Leste" | "Oeste" | "Centro"> = {
        "norte": "Norte",
        "nordeste": "Norte",
        "sul": "Sul",
        "sudeste": "Leste",
        "centro_oeste": "Centro"
      };

      const { error } = await supabase
        .from("municipios")
        .insert([{
          nome: formData.nome.trim(),
          uf: formData.uf,
          regiao: regiaoMap[formData.regiao],
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Município cadastrado com sucesso",
      });

      setFormData({
        nome: "",
        uf: "",
        regiao: "",
        micro_regiao: "",
      });
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao cadastrar município:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível cadastrar o município",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Município
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastrar Município</DialogTitle>
          <DialogDescription>
            Adicione um novo município ao sistema
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Município *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: São Paulo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="uf">UF *</Label>
            <Select
              value={formData.uf}
              onValueChange={(value) => setFormData({ ...formData, uf: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AC">Acre</SelectItem>
                <SelectItem value="AL">Alagoas</SelectItem>
                <SelectItem value="AP">Amapá</SelectItem>
                <SelectItem value="AM">Amazonas</SelectItem>
                <SelectItem value="BA">Bahia</SelectItem>
                <SelectItem value="CE">Ceará</SelectItem>
                <SelectItem value="DF">Distrito Federal</SelectItem>
                <SelectItem value="ES">Espírito Santo</SelectItem>
                <SelectItem value="GO">Goiás</SelectItem>
                <SelectItem value="MA">Maranhão</SelectItem>
                <SelectItem value="MT">Mato Grosso</SelectItem>
                <SelectItem value="MS">Mato Grosso do Sul</SelectItem>
                <SelectItem value="MG">Minas Gerais</SelectItem>
                <SelectItem value="PA">Pará</SelectItem>
                <SelectItem value="PB">Paraíba</SelectItem>
                <SelectItem value="PR">Paraná</SelectItem>
                <SelectItem value="PE">Pernambuco</SelectItem>
                <SelectItem value="PI">Piauí</SelectItem>
                <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                <SelectItem value="RN">Rio Grande do Norte</SelectItem>
                <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                <SelectItem value="RO">Rondônia</SelectItem>
                <SelectItem value="RR">Roraima</SelectItem>
                <SelectItem value="SC">Santa Catarina</SelectItem>
                <SelectItem value="SP">São Paulo</SelectItem>
                <SelectItem value="SE">Sergipe</SelectItem>
                <SelectItem value="TO">Tocantins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="regiao">Região *</Label>
            <Select
              value={formData.regiao}
              onValueChange={(value) => setFormData({ ...formData, regiao: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a região" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="norte">Norte</SelectItem>
                <SelectItem value="nordeste">Nordeste</SelectItem>
                <SelectItem value="centro_oeste">Centro-Oeste</SelectItem>
                <SelectItem value="sudeste">Sudeste</SelectItem>
                <SelectItem value="sul">Sul</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
