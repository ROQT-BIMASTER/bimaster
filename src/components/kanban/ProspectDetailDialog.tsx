import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Prospect {
  id: string;
  nome_empresa: string;
  contato_principal: string | null;
  email: string | null;
  telefone: string | null;
  cnpj: string | null;
  status: string;
  categoria: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  observacoes: string | null;
  municipio_id: string | null;
}

interface ProspectDetailDialogProps {
  prospect: Prospect | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const ProspectDetailDialog = ({ prospect, open, onOpenChange, onUpdate }: ProspectDetailDialogProps) => {
  const [formData, setFormData] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(false);
  const [municipios, setMunicipios] = useState<Array<{ id: string; nome: string }>>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (prospect) {
      setFormData(prospect);
    }
  }, [prospect]);

  useEffect(() => {
    fetchMunicipios();
  }, []);

  const fetchMunicipios = async () => {
    try {
      const { data } = await supabase
        .from("municipios")
        .select("id, nome")
        .order("nome");
      
      setMunicipios(data || []);
    } catch (error) {
      console.error("Erro ao carregar municípios:", error);
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("prospects")
        .update({
          nome_empresa: formData.nome_empresa,
          contato_principal: formData.contato_principal,
          email: formData.email,
          telefone: formData.telefone,
          cnpj: formData.cnpj,
          status: formData.status as "novo" | "em_contato" | "proposta_enviada" | "negociacao" | "ganho" | "perdido",
          categoria: formData.categoria as "A" | "B" | "C" | "D" | null,
          ultimo_contato: formData.ultimo_contato,
          proxima_acao: formData.proxima_acao,
          observacoes: formData.observacoes,
          municipio_id: formData.municipio_id,
        })
        .eq("id", formData.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Prospect atualizado com sucesso",
      });
      
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao atualizar prospect:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o prospect",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!formData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Prospect</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="nome_empresa">Nome da Empresa *</Label>
            <Input
              id="nome_empresa"
              value={formData.nome_empresa}
              onChange={(e) => setFormData({ ...formData, nome_empresa: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="em_contato">Em Contato</SelectItem>
                  <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
                  <SelectItem value="negociacao">Negociação</SelectItem>
                  <SelectItem value="ganho">Ganho</SelectItem>
                  <SelectItem value="perdido">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                value={formData.categoria || ""}
                onValueChange={(value) => setFormData({ ...formData, categoria: value || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A - Alta Prioridade</SelectItem>
                  <SelectItem value="B">B - Média Prioridade</SelectItem>
                  <SelectItem value="C">C - Baixa Prioridade</SelectItem>
                  <SelectItem value="D">D - Mínima Prioridade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="contato_principal">Contato Principal</Label>
              <Input
                id="contato_principal"
                value={formData.contato_principal || ""}
                onChange={(e) => setFormData({ ...formData, contato_principal: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj || ""}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone || ""}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="municipio_id">Município</Label>
            <Select
              value={formData.municipio_id || ""}
              onValueChange={(value) => setFormData({ ...formData, municipio_id: value || null })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um município" />
              </SelectTrigger>
              <SelectContent>
                {municipios.map((municipio) => (
                  <SelectItem key={municipio.id} value={municipio.id}>
                    {municipio.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ultimo_contato">Último Contato</Label>
              <Input
                id="ultimo_contato"
                type="date"
                value={formData.ultimo_contato || ""}
                onChange={(e) => setFormData({ ...formData, ultimo_contato: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="proxima_acao">Próxima Ação</Label>
              <Input
                id="proxima_acao"
                type="date"
                value={formData.proxima_acao || ""}
                onChange={(e) => setFormData({ ...formData, proxima_acao: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              rows={4}
              value={formData.observacoes || ""}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
