import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { logger } from "@/lib/logger";
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
import { Plus, Loader2, BadgeCheck, Sparkles, Users, TrendingUp, Heart } from "lucide-react";
import { getInfluencerAvatarUrl } from "@/lib/utils/influencer-avatar";
import { REGIOES, REGIOES_UFS, getUFsByRegiao } from "@/lib/constants/regioes";
import { useApifyProfileLookup } from "@/hooks/useApifyProfile";
import { InfluencerAvatar } from "./InfluencerAvatar";

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

const APIFY_PLATFORMS = new Set(["instagram", "tiktok"]);

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

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

  // Lookup automático via Apify quando platform = IG/TikTok
  const lookupEnabled = open && APIFY_PLATFORMS.has(form.platform) && form.username.trim().length >= 2;
  const { data: enriched, loading: lookingUp, error: lookupError } = useApifyProfileLookup(
    form.username,
    form.platform,
    lookupEnabled,
  );

  // Auto-preenche o formulário quando o lookup retorna
  useEffect(() => {
    if (!enriched) return;
    setForm((f) => ({
      ...f,
      display_name: enriched.display_name || f.display_name,
      profile_url: enriched.profile_url || f.profile_url,
      followers_count: String(enriched.followers_count || ""),
      engagement_rate: String(enriched.engagement_rate || ""),
      avg_likes: String(enriched.avg_likes || ""),
      avg_comments: String(enriched.avg_comments || ""),
    }));
  }, [enriched]);

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
        display_name: form.display_name || enriched?.display_name || null,
        profile_url: form.profile_url || enriched?.profile_url || null,
        avatar_url: enriched?.avatar_url || getInfluencerAvatarUrl(form.platform, cleanUsername),
        followers_count: parseInt(form.followers_count) || 0,
        engagement_rate: parseFloat(form.engagement_rate) || 0,
        avg_likes: parseInt(form.avg_likes) || 0,
        avg_comments: parseInt(form.avg_comments) || 0,
        regiao: form.regiao || null,
        uf: form.uf || null,
        notes: form.notes || null,
        // Campos enriquecidos da Apify
        bio: enriched?.bio || null,
        is_verified: enriched?.is_verified || false,
        is_private: enriched?.is_private || false,
        business_category: enriched?.business_category || null,
        external_url: enriched?.external_url || null,
        posts_count: enriched?.posts_count ?? null,
        following_count: enriched?.following_count ?? null,
        data_source: enriched ? "apify" : "manual",
        last_synced_at: enriched ? new Date().toISOString() : null,
      } as any);

      if (error) throw error;

      // Se temos posts enriquecidos, faz upsert deles também (chama sync depois pra simplificar)
      if (enriched && enriched.latest_posts.length > 0) {
        try {
          const { data: { id: insertedId } } = await supabase
            .from("influencers")
            .select("id")
            .eq("user_id", user.id)
            .eq("platform", form.platform)
            .eq("username", cleanUsername)
            .order("created_at", { ascending: false })
            .limit(1)
            .single() as any;
          if (insertedId) {
            await supabase.functions.invoke("apify-sync-influencer", {
              body: { influencer_id: insertedId },
            });
          }
        } catch (e) {
          logger.warn("post-sync falhou (não crítico):", e);
        }
      }

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
      logger.error(err);
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
            Digite o @username e os dados serão buscados automaticamente.
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
            <Label className="flex items-center gap-2">
              Username *
              {lookingUp && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </Label>
            <Input
              placeholder="@username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            {APIFY_PLATFORMS.has(form.platform) && (
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                Dados oficiais serão preenchidos automaticamente
              </p>
            )}
          </div>

          {/* Preview do perfil enriquecido */}
          {enriched && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <InfluencerAvatar
                    platform={enriched.platform}
                    username={enriched.username}
                    displayName={enriched.display_name}
                    avatarUrl={enriched.avatar_url}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-sm truncate">{enriched.display_name}</p>
                      {enriched.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground">@{enriched.username}</p>
                  </div>
                </div>
                {enriched.bio && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{enriched.bio}</p>
                )}
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {formatNumber(enriched.followers_count)}</span>
                  <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {enriched.engagement_rate}%</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {formatNumber(enriched.avg_likes)}</span>
                </div>
                {enriched.business_category && (
                  <Badge variant="secondary" className="text-[10px]">{enriched.business_category}</Badge>
                )}
                {enriched.latest_posts.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {enriched.latest_posts.length} posts recentes serão coletados
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {lookupError && form.username.trim().length >= 2 && APIFY_PLATFORMS.has(form.platform) && (
            <p className="text-[10px] text-amber-600">
              {lookupError}. Você ainda pode preencher os dados manualmente.
            </p>
          )}

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
