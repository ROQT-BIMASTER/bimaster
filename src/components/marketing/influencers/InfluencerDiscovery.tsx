import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sparkles, Search, Plus, Loader2, Users, TrendingUp, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface DiscoveredInfluencer {
  username: string;
  display_name: string;
  platform: string;
  profile_url: string | null;
  avatar_url: string | null;
  followers_count: number;
  engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  niche: string | null;
  reason: string;
}

interface InfluencerDiscoveryProps {
  onAdded: () => void;
}

const EXAMPLE_QUERIES = [
  "#fitness",
  "#skincare",
  "tech reviewers",
  "Natura",
  "moda sustentável",
  "foodies SP",
];

export function InfluencerDiscovery({ onAdded }: InfluencerDiscoveryProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [results, setResults] = useState<DiscoveredInfluencer[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("discover-influencers", {
        body: {
          query: query.trim(),
          platform: platform !== "all" ? platform : undefined,
          min_followers: minFollowers ? Number(minFollowers) : undefined,
          max_followers: maxFollowers ? Number(maxFollowers) : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error === "phyllo_not_configured") {
          toast.error("Credenciais Phyllo não configuradas. Contate o administrador.");
        } else {
          toast.error(data.message || "Erro na busca");
        }
        return;
      }

      setResults(data?.data || []);
      if ((data?.data || []).length === 0) {
        toast.info("Nenhum influenciador encontrado. Tente termos diferentes.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao buscar influenciadores");
    } finally {
      setLoading(false);
    }
  };

  const handleMonitor = async (inf: DiscoveredInfluencer) => {
    setAdding(inf.username);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("influencers").insert({
        user_id: user.id,
        platform: inf.platform,
        username: inf.username,
        display_name: inf.display_name,
        profile_url: inf.profile_url,
        avatar_url: inf.avatar_url,
        followers_count: inf.followers_count,
        engagement_rate: inf.engagement_rate,
        avg_likes: inf.avg_likes,
        avg_comments: inf.avg_comments,
        status: "active",
        notes: inf.reason,
      });

      if (error) {
        if (error.code === "23505") {
          toast.warning("Este influenciador já está sendo monitorado.");
        } else {
          throw error;
        }
      } else {
        toast.success(`${inf.display_name || inf.username} adicionado ao monitoramento!`);
        onAdded();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao adicionar influenciador");
    } finally {
      setAdding(null);
    }
  };

  const formatFollowers = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Descobrir com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Descobrir Influenciadores
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Busque por perfil, #hashtag, marca ou descrição..."
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
            </Button>
          </div>

          {/* Example chips */}
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <Badge
                key={q}
                variant="secondary"
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => {
                  setQuery(q);
                }}
              >
                {q}
              </Badge>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Plataforma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="twitter">Twitter / X</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Min seguidores"
              className="w-[140px]"
              value={minFollowers}
              onChange={(e) => setMinFollowers(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Max seguidores"
              className="w-[140px]"
              value={maxFollowers}
              onChange={(e) => setMaxFollowers(e.target.value)}
            />
          </div>

          {/* Results */}
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Buscando influenciadores...
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {results.map((inf, idx) => (
                <Card key={`${inf.username}-${idx}`} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      {inf.avatar_url ? (
                        <img
                          src={inf.avatar_url}
                          alt={inf.username}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Users className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {inf.display_name || inf.username}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          @{inf.username}
                        </p>
                        <Badge variant="outline" className="mt-1 text-xs capitalize">
                          {inf.platform}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {formatFollowers(inf.followers_count)}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {Number(inf.engagement_rate).toFixed(2)}%
                      </span>
                      {inf.niche && (
                        <Badge variant="secondary" className="text-xs">
                          {inf.niche}
                        </Badge>
                      )}
                    </div>

                    {inf.reason && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {inf.reason}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => handleMonitor(inf)}
                        disabled={adding === inf.username}
                      >
                        {adding === inf.username ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                        Monitorar
                      </Button>
                      {inf.profile_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a href={inf.profile_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
