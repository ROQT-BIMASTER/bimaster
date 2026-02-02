import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NovaRedeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (chainName: string) => void;
}

export const NovaRedeDialog = ({ open, onOpenChange, onSuccess }: NovaRedeDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    branch_count: 1,
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from("store_chains")
        .insert({
          name: formData.name,
          cnpj: formData.cnpj || null,
          branch_count: formData.branch_count || 1,
          contact_name: formData.contact_name || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          notes: formData.notes || null,
          created_by: session.session?.user.id,
        });

      if (error) throw error;

      toast({
        title: "Rede criada",
        description: "Nova rede cadastrada com sucesso.",
      });

      onOpenChange(false);
      onSuccess?.(formData.name);
      setFormData({ name: "", cnpj: "", branch_count: 1, contact_name: "", contact_email: "", contact_phone: "", notes: "" });
    } catch (error: any) {
      toast({
        title: "Erro ao criar rede",
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
          <DialogTitle>Nova Rede de Lojas</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="name">Nome da Rede *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) =>
                  setFormData({ ...formData, cnpj: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="branch_count">Nº de Lojas da Rede</Label>
              <Input
                id="branch_count"
                type="number"
                min={1}
                value={formData.branch_count}
                onChange={(e) =>
                  setFormData({ ...formData, branch_count: parseInt(e.target.value) || 1 })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Total de lojas que fazem parte desta rede
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contact_name">Nome do Contato</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) =>
                  setFormData({ ...formData, contact_name: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="contact_phone">Telefone do Contato</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) =>
                  setFormData({ ...formData, contact_phone: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="contact_email">E-mail do Contato</Label>
            <Input
              id="contact_email"
              type="email"
              value={formData.contact_email}
              onChange={(e) =>
                setFormData({ ...formData, contact_email: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Rede"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};