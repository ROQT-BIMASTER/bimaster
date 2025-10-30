import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditarAuditoriaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  auditoriaId: string | null;
  onSuccess?: () => void;
}

export const EditarAuditoriaDialog = ({ open, onOpenChange, auditoriaId, onSuccess }: EditarAuditoriaDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    preco_praticado: "",
    produto_presente: true,
    quantidade_frentes: "",
    conforme_planograma: false,
    concorrentes_presentes: false,
    observacoes: "",
  });

  useEffect(() => {
    if (open && auditoriaId) {
      fetchAuditoria();
    }
  }, [open, auditoriaId]);

  const fetchAuditoria = async () => {
    if (!auditoriaId) return;
    
    try {
      const { data, error } = await supabase
        .from("gondola_audits")
        .select("*")
        .eq("id", auditoriaId)
        .single();

      if (error) throw error;

      setFormData({
        preco_praticado: data.preco_praticado?.toString() || "",
        produto_presente: data.produto_presente,
        quantidade_frentes: data.quantidade_frentes?.toString() || "",
        conforme_planograma: data.conforme_planograma,
        concorrentes_presentes: data.concorrentes_presentes,
        observacoes: data.observacoes || "",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar auditoria",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("gondola_audits")
        .update({
          preco_praticado: formData.preco_praticado ? parseFloat(formData.preco_praticado) : null,
          produto_presente: formData.produto_presente,
          quantidade_frentes: formData.quantidade_frentes ? parseInt(formData.quantidade_frentes) : 0,
          conforme_planograma: formData.conforme_planograma,
          concorrentes_presentes: formData.concorrentes_presentes,
          observacoes: formData.observacoes,
        })
        .eq("id", auditoriaId);

      if (error) throw error;

      toast({
        title: "Auditoria atualizada",
        description: "As alterações foram salvas com sucesso.",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Auditoria</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.produto_presente}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, produto_presente: checked })
                }
              />
              <Label>Produto Presente</Label>
            </div>
          </div>

          {formData.produto_presente && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="preco">Preço Praticado</Label>
                  <Input
                    id="preco"
                    type="number"
                    step="0.01"
                    value={formData.preco_praticado}
                    onChange={(e) =>
                      setFormData({ ...formData, preco_praticado: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="frentes">Quantidade de Frentes</Label>
                  <Input
                    id="frentes"
                    type="number"
                    value={formData.quantidade_frentes}
                    onChange={(e) =>
                      setFormData({ ...formData, quantidade_frentes: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.conforme_planograma}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, conforme_planograma: checked })
                  }
                />
                <Label>Conforme Planograma</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.concorrentes_presentes}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, concorrentes_presentes: checked })
                  }
                />
                <Label>Concorrentes Presentes</Label>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) =>
                setFormData({ ...formData, observacoes: e.target.value })
              }
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};