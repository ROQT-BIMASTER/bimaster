import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InfluencerProfileCard } from "./InfluencerProfileCard";
import { AddInfluencerDialog } from "./AddInfluencerDialog";
import { InfluencerDiscovery } from "./InfluencerDiscovery";
import { InfluencerRecommendation } from "./InfluencerRecommendation";
import { Users, TrendingUp, Heart, Search, Info } from "lucide-react";
import { toast } from "sonner";

interface Influencer {
  id: string;
  platform: string;
  username: string;
  display_name: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  followers_count: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  fraud_score: number | null;
  status: string;
  notes: string | null;
}

export function InfluencerDashboard() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");

  const loadInfluencers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("influencers")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("followers_count", { ascending: false });

      if (error) throw error;
      setInfluencers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfluencers();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("influencers")
        .update({ status: "inactive" })
        .eq("id", id);
      if (error) throw error;
      toast.success("Influenciador removido");
      loadInfluencers();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const filtered = influencers.filter((i) => {
    const matchesSearch =
      !search ||
      i.username.toLowerCase().includes(search.toLowerCase()) ||
      (i.display_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = platformFilter === "all" || i.platform === platformFilter;
    return matchesSearch && matchesPlatform;
  });

  const totalFollowers = influencers.reduce((s, i) => s + i.followers_count, 0);
  const avgEngagement =
    influencers.length > 0
      ? influencers.reduce((s, i) => s + Number(i.engagement_rate), 0) / influencers.length
      : 0;

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Módulo de monitoramento de influenciadores. Cadastre manualmente ou, quando a integração Phyllo estiver ativa, os dados serão sincronizados automaticamente.
        </AlertDescription>
      </Alert>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Influenciadores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{influencers.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Alcance Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">
                {totalFollowers >= 1_000_000
                  ? `${(totalFollowers / 1_000_000).toFixed(1)}M`
                  : totalFollowers >= 1_000
                  ? `${(totalFollowers / 1_000).toFixed(1)}K`
                  : totalFollowers}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Engajamento Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{avgEngagement.toFixed(2)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Add */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar influenciador..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="twitter">Twitter / X</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 flex-wrap">
          <InfluencerRecommendation />
          <InfluencerDiscovery onAdded={loadInfluencers} />
          <AddInfluencerDialog onAdded={loadInfluencers} />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          Nenhum influenciador encontrado. Use o botão acima para adicionar.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((inf) => (
            <InfluencerProfileCard
              key={inf.id}
              influencer={inf}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
