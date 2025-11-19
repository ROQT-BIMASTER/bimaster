import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";

interface AccountForm {
  platform: string;
  username: string;
  account_name: string;
  access_token: string;
  region?: string;
  account_group?: string;
}

interface AccountsManagerProps {
  onAccountAdded: () => void;
}

export const AccountsManager = ({ onAccountAdded }: AccountsManagerProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<AccountForm>({
    platform: "instagram",
    username: "",
    account_name: "",
    access_token: "",
    region: "",
    account_group: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.username || !form.account_name || !form.access_token) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      const { error } = await supabase
        .from("social_media_accounts")
        .insert({
          user_id: user.id,
          platform: form.platform,
          username: form.username,
          account_name: form.account_name,
          access_token: form.access_token,
          region: form.region || null,
          account_group: form.account_group || null,
          status: "active",
        });

      if (error) throw error;

      toast.success("Conta adicionada com sucesso!");
      setOpen(false);
      setForm({
        platform: "instagram",
        username: "",
        account_name: "",
        access_token: "",
        region: "",
        account_group: "",
      });
      onAccountAdded();
    } catch (error: any) {
      toast.error(`Erro ao adicionar conta: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="w-4 h-4" />
        Adicionar Conta
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adicionar Nova Conta</DialogTitle>
            <DialogDescription>
              Configure uma nova conta de rede social para monitoramento
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="platform">Plataforma *</Label>
              <Select
                value={form.platform}
                onValueChange={(value) => setForm({ ...form, platform: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="twitter">Twitter</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="account_name">Nome de Identificação *</Label>
              <Input
                id="account_name"
                placeholder="Ex: Instagram Loja São Paulo"
                value={form.account_name}
                onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="username">Username/Handle *</Label>
              <Input
                id="username"
                placeholder="Ex: minha_empresa"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="access_token">Token de Acesso *</Label>
              <Input
                id="access_token"
                type="password"
                placeholder="Cole o token de acesso da API"
                value={form.access_token}
                onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                required
              />
            </div>

            <div>
              <Label htmlFor="region">Região (opcional)</Label>
              <Input
                id="region"
                placeholder="Ex: Sul, Sudeste, Norte"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="account_group">Grupo (opcional)</Label>
              <Input
                id="account_group"
                placeholder="Ex: Lojas Físicas, E-commerce"
                value={form.account_group}
                onChange={(e) => setForm({ ...form, account_group: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Adicionar Conta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
