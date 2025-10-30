import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface AtribuirVisitaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface User {
  id: string;
  nome: string;
  email: string;
}

export const AtribuirVisitaDialog = ({ open, onOpenChange, onSuccess }: AtribuirVisitaDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [subordinados, setSubordinados] = useState<User[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    user_id: "",
    store_id: "",
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: "09:00",
    visit_type: "routine",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      fetchSubordinados();
      fetchStores();
    }
  }, [open]);

  const fetchSubordinados = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar usuários subordinados ao supervisor atual
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!profile) return;

      // Buscar vendedores e promotores subordinados
      const { data: subordinates, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("supervisor_id", user.id)
        .eq("aprovado", true);

      if (error) throw error;
      setSubordinados(subordinates || []);
    } catch (error) {
      console.error("Erro ao buscar subordinados:", error);
      toast.error("Erro ao carregar equipe");
    }
  };

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error("Erro ao buscar lojas:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.user_id || !formData.store_id) {
      toast.error("Selecione um usuário e uma loja");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const visitCode = `V-${Date.now()}`;
      
      const { error } = await supabase
        .from("visits")
        .insert({
          visit_code: visitCode,
          user_id: formData.user_id,
          store_id: formData.store_id,
          scheduled_date: formData.scheduled_date,
          scheduled_time: formData.scheduled_time,
          visit_type: formData.visit_type,
          status: "scheduled",
          notes: formData.notes,
        });

      if (error) throw error;

      toast.success("Visita atribuída com sucesso!");
      onSuccess?.();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Erro ao atribuir visita:", error);
      toast.error("Erro ao atribuir visita: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: "",
      store_id: "",
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: "09:00",
      visit_type: "routine",
      notes: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Atribuir Visita
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Atribuir para *</Label>
            <Select value={formData.user_id} onValueChange={(value) => setFormData({ ...formData, user_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um membro da equipe" />
              </SelectTrigger>
              <SelectContent>
                {subordinados.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    Nenhum subordinado encontrado
                  </div>
                ) : (
                  subordinados.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex flex-col">
                        <span>{user.nome}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Loja/PDV *</Label>
            <Select value={formData.store_id} onValueChange={(value) => setFormData({ ...formData, store_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma loja" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {stores.map((store) => (
                  <SelectItem key={store.id} value={store.id}>
                    <div className="flex flex-col">
                      <span>{store.name}</span>
                      {store.city && (
                        <span className="text-xs text-muted-foreground">{store.city}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <input
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Horário *</Label>
              <input
                type="time"
                value={formData.scheduled_time}
                onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Visita</Label>
            <Select value={formData.visit_type} onValueChange={(value) => setFormData({ ...formData, visit_type: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Rotina</SelectItem>
                <SelectItem value="audit">Auditoria</SelectItem>
                <SelectItem value="promotion">Promoção</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Adicione observações sobre a visita..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Atribuindo...
                </>
              ) : (
                "Atribuir Visita"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
