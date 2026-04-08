import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { getInfluencerAvatarUrl } from "@/lib/utils/influencer-avatar";
import { REGIOES, REGIOES_UFS, getUFsByRegiao } from "@/lib/constants/regioes";

interface Props {
  onAdded: () => void;
}

const platforms = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "Twitter / X" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
];

export function AddInfluencerDialog({ onAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    platform: "instagram",
    username: "",
    display_name: "",
    profile_url: "",
    followers_count: "",
    engagement_rate: "",
    avg_likes: "",
    avg_comments: "",
    regiao: "",
    uf: "",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!form.username.trim()) {
      toast.error("Username é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const cleanUsername = form.username.trim().replace(/^@/, "");
      const { error } = await supabase.from("influencers").insert({
        user_id: user.id,
        platform: form.platform,
        username: cleanUsername,
        display_name: form.display_name || null,
        profile_url: form.profile_url || null,
        avatar_url: getInfluencerAvatarUrl(form.platform, cleanUsername),
        followers_count: parseInt(form.followers_count) || 0,
        engagement_rate: parseFloat(form.engagement_rate) || 0,
        avg_likes: parseInt(form.avg_likes) || 0,
        avg_comments: parseInt(form.avg_comments) || 0,
        regiao: form.regiao || null,
        uf: form.uf || null,
        notes: form.notes || null,
      });

      if (error) throw error;

      toast.success("Influenciador adicionado!");
      setOpen(false);
      setForm({
        platform: "instagram",
        username: "",
        display_name: "",
        profile_url: "",
        followers_count: "",
        engagement_rate: "",
        avg_likes: "",
        avg_comments: "",
        regiao: "",
        uf: "",
        notes: "",
      });
      onAdded();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao adicionar influenciador");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" /> Adicionar Influenciador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Influenciador</DialogTitle>
          <DialogDescription>
            Cadastre manualmente um influenciador para monitoramento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Plataforma</Label>
            <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Username *</Label>
            <Input
              placeholder="@username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div>
            <Label>Nome de exibição</Label>
            <Input
              placeholder="Nome completo"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </div>

          <div>
            <Label>URL do perfil</Label>
            <Input
              placeholder="https://instagram.com/username"
              value={form.profile_url}
              onChange={(e) => setForm({ ...form, profile_url: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Seguidores</Label>
              <Input
                type="number"
                placeholder="10000"
                value={form.followers_count}
                onChange={(e) => setForm({ ...form, followers_count: e.target.value })}
              />
            </div>
            <div>
              <Label>Engajamento (%)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="3.5"
                value={form.engagement_rate}
                onChange={(e) => setForm({ ...form, engagement_rate: e.target.value })}
              />
            </div>
            <div>
              <Label>Média de Likes</Label>
              <Input
                type="number"
                placeholder="500"
                value={form.avg_likes}
                onChange={(e) => setForm({ ...form, avg_likes: e.target.value })}
              />
            </div>
            <div>
              <Label>Média de Comentários</Label>
              <Input
                type="number"
                placeholder="50"
                value={form.avg_comments}
                onChange={(e) => setForm({ ...form, avg_comments: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Região</Label>
              <Select value={form.regiao} onValueChange={(v) => setForm({ ...form, regiao: v, uf: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {REGIOES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado/UF</Label>
              <Select value={form.uf} onValueChange={(v) => setForm({ ...form, uf: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(form.regiao ? (getUFsByRegiao(form.regiao) || []) : Object.values(REGIOES_UFS).flat().sort()).map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea
              placeholder="Observações sobre o influenciador..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
