import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface EditarVisitaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: string | null;
  onSuccess?: () => void;
}

export const EditarVisitaDialog = ({ open, onOpenChange, visitId, onSuccess }: EditarVisitaDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    scheduled_date: "",
    scheduled_time: "",
    visit_type: "",
    status: "",
    observations: "",
  });

  useEffect(() => {
    if (open && visitId) {
      fetchVisit();
    }
  }, [open, visitId]);

  const fetchVisit = async () => {
    if (!visitId) return;
    
    try {
      const { data, error } = await supabase
        .from("visits")
        .select("*")
        .eq("id", visitId)
        .single();

      if (error) throw error;

      setFormData({
        scheduled_date: data.scheduled_date,
        scheduled_time: data.scheduled_time || "",
        visit_type: data.visit_type || "",
        status: data.status,
        observations: "",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao carregar visita",
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
        .from("visits")
        .update({
          scheduled_date: formData.scheduled_date,
          scheduled_time: formData.scheduled_time || null,
          visit_type: formData.visit_type || null,
          status: formData.status,
        })
        .eq("id", visitId);

      if (error) throw error;

      toast({
        title: "Visita atualizada",
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
          <DialogTitle>Editar Visita</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={formData.scheduled_date}
                onChange={(e) =>
                  setFormData({ ...formData, scheduled_date: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="time">Horário</Label>
              <Input
                id="time"
                type="time"
                value={formData.scheduled_time}
                onChange={(e) =>
                  setFormData({ ...formData, scheduled_time: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="type">Tipo de Visita</Label>
            <Select
              value={formData.visit_type}
              onValueChange={(value) =>
                setFormData({ ...formData, visit_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prospection">Prospecção</SelectItem>
                <SelectItem value="follow_up">Follow-up</SelectItem>
                <SelectItem value="audit">Auditoria</SelectItem>
                <SelectItem value="delivery">Entrega</SelectItem>
                <SelectItem value="maintenance">Manutenção</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Agendada</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
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