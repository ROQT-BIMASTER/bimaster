import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { atividadeSchema } from "@/lib/validations/atividade";

interface Prospect {
  id: string;
  nome_empresa: string;
}

interface Atividade {
  id: string;
  prospect_id: string;
  tipo: string;
  descricao: string;
  resultado: string | null;
  data_atividade: string;
  proximo_followup: string | null;
}

interface EditarAtividadeDialogProps {
  atividade: Atividade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const EditarAtividadeDialog = ({ atividade, open, onOpenChange, onSuccess }: EditarAtividadeDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
      if (atividade) {
        setFormData({
          prospect_id: atividade.prospect_id,
          tipo: atividade.tipo,
          descricao: atividade.descricao,
          resultado: atividade.resultado || "",
          data_atividade: atividade.data_atividade.split('T')[0],
          proximo_followup: atividade.proximo_followup || "",
        });
      }
    }
  }, [open, atividade]);

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
    if (!atividade) return;
    
    setErrors({});
    setLoading(true);

    try {
      const validatedData = atividadeSchema.parse(formData);

      const { error } = await supabase
        .from("atividades")
        .update({
          prospect_id: validatedData.prospect_id,
          tipo: validatedData.tipo as "ligacao" | "email" | "reuniao" | "visita" | "proposta",
          descricao: validatedData.descricao,
          resultado: (validatedData.resultado || null) as "positivo" | "neutro" | "negativo" | null,
          data_atividade: validatedData.data_atividade,
          proximo_followup: validatedData.proximo_followup || null,
        })
        .eq("id", atividade.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Atividade atualizada com sucesso",
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      if (error.errors) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err: any) => {
          fieldErrors[err.path[0]] = err.message;
        });
        setErrors(fieldErrors);
        toast({
          title: "Erro de validação",
          description: "Verifique os campos destacados",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: error.message || "Não foi possível atualizar a atividade",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Atividade</DialogTitle>
          <DialogDescription>
            Atualize as informações da atividade
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
            {errors.prospect_id && <p className="text-sm text-destructive">{errors.prospect_id}</p>}
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
                max={new Date().toISOString().split('T')[0]}
              />
              {errors.data_atividade && <p className="text-sm text-destructive">{errors.data_atividade}</p>}
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
              maxLength={1000}
            />
            {errors.descricao && <p className="text-sm text-destructive">{errors.descricao}</p>}
            <p className="text-xs text-muted-foreground">{formData.descricao.length}/1000 caracteres</p>
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
                min={new Date().toISOString().split('T')[0]}
              />
              {errors.proximo_followup && <p className="text-sm text-destructive">{errors.proximo_followup}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
