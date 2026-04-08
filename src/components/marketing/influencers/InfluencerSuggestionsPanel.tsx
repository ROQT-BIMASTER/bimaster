import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UserPlus, Check, X, Loader2, Sparkles, Users, ChevronDown, ChevronUp,
  Instagram, Youtube, Twitter, Globe,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

interface Suggestion {
  id: string;
  username: string;
  display_name: string | null;
  platform: string;
  profile_url: string | null;
  followers_count: number;
  engagement_rate: number;
  niche: string | null;
  reason: string | null;
  score: number;
  status: string;
  created_at: string;
}

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  twitter: Twitter,
  tiktok: Globe,
  facebook: Globe,
  linkedin: Globe,
};

export function InfluencerSuggestionsPanel({ onApproved }: { onApproved?: () => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("influencer_suggestions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("score", { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const { data, error } = await supabase.functions.invoke("influencer-autopilot", {
        body: { action: "discover_new" },
      });
      if (error) throw error;
      const count = data?.data?.suggestions_count || 0;
      toast.success(`${count} novos influenciadores sugeridos pelo Autopilot`);
      loadSuggestions();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao buscar sugestões");
    } finally {
      setDiscovering(false);
    }
  };

  const handleApprove = async (suggestion: Suggestion) => {
    setProcessingIds(prev => new Set(prev).add(suggestion.id));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // Create influencer
      const { error: insertError } = await supabase.from("influencers").insert({
        user_id: user.id,
        username: suggestion.username,
        display_name: suggestion.display_name,
        platform: suggestion.platform,
        profile_url: suggestion.profile_url,
        followers_count: suggestion.followers_count,
        engagement_rate: suggestion.engagement_rate,
        status: "active",
      });
      if (insertError) throw insertError;

      // Mark as approved
      await supabase
        .from("influencer_suggestions")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", suggestion.id);

      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
      toast.success(`@${suggestion.username} adicionado ao painel`);
      onApproved?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar");
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  };

  const handleReject = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      await supabase
        .from("influencer_suggestions")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", id);

      setSuggestions(prev => prev.filter(s => s.id !== id));
      toast.success("Sugestão rejeitada");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao rejeitar");
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleApproveAll = async () => {
    const filtered = getFiltered();
    for (const s of filtered) {
      await handleApprove(s);
    }
  };

  const getFiltered = () =>
    suggestions.filter(s => platformFilter === "all" || s.platform === platformFilter);

  const filtered = getFiltered();
  const pendingCount = suggestions.length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card className="border-amber-200 dark:border-amber-800">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-amber-600" />
                Sugestões do Autopilot
                {pendingCount > 0 && (
                  <Badge className="bg-amber-500 text-white text-[10px] animate-pulse">
                    {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={(e) => { e.stopPropagation(); handleDiscover(); }}
                  disabled={discovering}
                >
                  {discovering ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  Descobrir Novos
                </Button>
                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
            {!expanded && pendingCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {pendingCount} influenciador{pendingCount > 1 ? "es" : ""} aguardando sua aprovação
              </p>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {pendingCount === 0 ? (
              <div className="text-center py-6 space-y-3">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma sugestão pendente. Clique em "Descobrir Novos" para que o Autopilot encontre influenciadores ideais para sua marca.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <Select value={platformFilter} onValueChange={setPlatformFilter}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
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
                  {filtered.length > 1 && (
                    <Button size="sm" variant="default" className="text-xs" onClick={handleApproveAll}>
                      <Check className="h-3 w-3 mr-1" /> Aprovar Todos ({filtered.length})
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {filtered.map((s) => {
                    const PIcon = platformIcons[s.platform] || Globe;
                    const isProcessing = processingIds.has(s.id);
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors"
                      >
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <PIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">@{s.username}</span>
                            {s.display_name && (
                              <span className="text-xs text-muted-foreground truncate">{s.display_name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <Badge variant="outline" className="text-[10px] capitalize">{s.platform}</Badge>
                            <span>{(s.followers_count || 0).toLocaleString("pt-BR")} seguidores</span>
                            <span>•</span>
                            <span>{s.engagement_rate}% eng.</span>
                            {s.niche && <><span>•</span><span>{s.niche}</span></>}
                          </div>
                          {s.reason && (
                            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 italic">
                              💡 {s.reason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-[10px] font-semibold tabular-nums">
                            {Number(s.score).toFixed(0)}pts
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700"
                            onClick={() => handleApprove(s)}
                            disabled={isProcessing}
                            title="Aprovar"
                          >
                            {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600 hover:bg-red-100 hover:text-red-700"
                            onClick={() => handleReject(s.id)}
                            disabled={isProcessing}
                            title="Rejeitar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
