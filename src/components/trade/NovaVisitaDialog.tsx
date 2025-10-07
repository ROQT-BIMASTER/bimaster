import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VincularStoreDialog } from "./VincularStoreDialog";

interface NovaVisitaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const NovaVisitaDialog = ({ open, onOpenChange, onSuccess }: NovaVisitaDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [showVincularStore, setShowVincularStore] = useState(false);
  const [formData, setFormData] = useState({
    store_id: "",
    store_name: "",
    scheduled_date: "",
    scheduled_time: "",
    visit_type: "rotina",
    notes: "",
  });

  const handleStoreLinked = (storeId: string) => {
    setFormData({ ...formData, store_id: storeId });
    // Buscar nome da loja
    supabase
      .from("stores")
      .select("name")
      .eq("id", storeId)
      .single()
      .then(({ data }) => {
        if (data) {
          setFormData((prev) => ({ ...prev, store_name: data.name }));
        }
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.store_id) {
      toast.error("Selecione uma loja");
      return;
    }

    if (!formData.scheduled_date) {
      toast.error("Data da visita é obrigatória");
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("visits").insert({
        visit_code: `VISIT-${Date.now()}`,
        store_id: formData.store_id,
        user_id: userData.user?.id,
        scheduled_date: formData.scheduled_date,
        scheduled_time: formData.scheduled_time || null,
        visit_type: formData.visit_type,
        notes: formData.notes || null,
        status: "scheduled",
      });

      if (error) throw error;

      toast.success("Visita agendada com sucesso!");
      onSuccess?.();
      onOpenChange(false);
      setFormData({
        store_id: "",
        store_name: "",
        scheduled_date: "",
        scheduled_time: "",
        visit_type: "rotina",
        notes: "",
      });
    } catch (error: any) {
      toast.error("Erro ao agendar visita: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Agendar Nova Visita</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Loja</Label>
              {formData.store_id ? (
                <div className="flex items-center gap-2">
                  <Input value={formData.store_name} disabled />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVincularStore(true)}
                  >
                    Alterar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowVincularStore(true)}
                  className="w-full"
                >
                  Selecionar Loja
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduled_date">Data *</Label>
                <Input
                  id="scheduled_date"
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled_time">Horário</Label>
                <Input
                  id="scheduled_time"
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visit_type">Tipo de Visita</Label>
              <Select value={formData.visit_type} onValueChange={(value) => setFormData({ ...formData, visit_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rotina">Rotina</SelectItem>
                  <SelectItem value="auditoria">Auditoria</SelectItem>
                  <SelectItem value="reposicao">Reposição</SelectItem>
                  <SelectItem value="promocional">Promocional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Objetivos da visita, checklist, etc."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !formData.store_id}>
                {loading ? "Agendando..." : "Agendar Visita"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <VincularStoreDialog
        open={showVincularStore}
        onOpenChange={setShowVincularStore}
        onStoreLinked={handleStoreLinked}
      />
    </>
  );
};
