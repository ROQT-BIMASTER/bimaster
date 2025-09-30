import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";

interface Prospect {
  id: string;
  nome_empresa: string;
}

interface NovaAtividadeDialogProps {
  onSuccess: () => void;
}

export const NovaAtividadeDialog = ({ onSuccess }: NovaAtividadeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [formData, setFormData] = useState({
    prospect_id: "",
    tipo: "ligacao",
    descricao: "",
    resultado: "",
    data_atividade: new Date().toISOString().split('T')[0],
    proximo_followup: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchProspects();
    }
  }, [open]);

  const fetchProspects = async () => {
    try {
      const { data, error } = await supabase
        .from("prospects")
        .select("id, nome_empresa")
        .order("nome_empresa");

      if (error) throw error;
      setProspects(data || []);
    } catch (error) {
      console.error("Erro ao carregar prospects:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os prospects",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("atividades").insert([
        {
          prospect_id: formData.prospect_id,
          vendedor_id: user.id,
          tipo: formData.tipo as "ligacao" | "email" | "reuniao" | "visita" | "proposta",
          descricao: formData.descricao,
          resultado: (formData.resultado || null) as "positivo" | "neutro" | "negativo" | null,
          data_atividade: formData.data_atividade,
          proximo_followup: formData.proximo_followup || null,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Atividade registrada com sucesso",
      });

      setFormData({
        prospect_id: "",
        tipo: "ligacao",
        descricao: "",
        resultado: "",
        data_atividade: new Date().toISOString().split('T')[0],
        proximo_followup: "",
      });
      
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao criar atividade:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível registrar a atividade",
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
          Nova Atividade
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Atividade</DialogTitle>
          <DialogDescription>
            Registre uma nova atividade ou interação com um prospect
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prospect_id">Prospect *</Label>
            <Select value={formData.prospect_id} onValueChange={(value) => setFormData({ ...formData, prospect_id: value })} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um prospect" />
              </SelectTrigger>
              <SelectContent>
                {prospects.map((prospect) => (
                  <SelectItem key={prospect.id} value={prospect.id}>
                    {prospect.nome_empresa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Atividade *</Label>
              <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })} required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="reuniao">Reunião</SelectItem>
                  <SelectItem value="visita">Visita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_atividade">Data da Atividade *</Label>
              <Input
                id="data_atividade"
                type="date"
                value={formData.data_atividade}
                onChange={(e) => setFormData({ ...formData, data_atividade: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva a atividade realizada"
              rows={4}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="resultado">Resultado</Label>
              <Select value={formData.resultado} onValueChange={(value) => setFormData({ ...formData, resultado: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o resultado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="positivo">Positivo</SelectItem>
                  <SelectItem value="neutro">Neutro</SelectItem>
                  <SelectItem value="negativo">Negativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="proximo_followup">Próximo Follow-up</Label>
              <Input
                id="proximo_followup"
                type="date"
                value={formData.proximo_followup}
                onChange={(e) => setFormData({ ...formData, proximo_followup: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Registrando..." : "Registrar Atividade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
