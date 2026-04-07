import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Heart, MessageCircle, Eye, Users, TrendingUp, Image, Film, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

interface InstagramAccountDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(220, 70%, 50%)",
  "hsl(340, 70%, 50%)",
  "hsl(160, 70%, 40%)",
  "hsl(40, 80%, 50%)",
  "hsl(280, 60%, 50%)",
  "hsl(200, 70%, 45%)",
];

export const InstagramAccountDetails = ({
  open,
  onOpenChange,
  accountId,
  accountName,
}: InstagramAccountDetailsProps) => {
  const [activeTab, setActiveTab] = useState("posts");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [audience, setAudience] = useState<any>(null);
  const [growth, setGrowth] = useState<any[]>([]);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

  const fetchData = async (action: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-insights", {
        body: { accountId, action },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar dados");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadTab = async (tab: string, force = false) => {
    if (loadedTabs.has(tab) && !force) return;

    let data;
    switch (tab) {
      case "posts":
        data = await fetchData("get_recent_media");
        if (data?.posts) setPosts(data.posts);
        break;
      case "stories":
        data = await fetchData("get_stories");
        if (data?.stories) setStories(data.stories);
        const reelsData = await fetchData("get_reels");
        if (reelsData?.reels) setReels(reelsData.reels);
        break;
      case "audience":
        data = await fetchData("get_audience_insights");
        if (data) setAudience(data);
        break;
      case "growth":
        data = await fetchData("get_growth");
        if (data?.growth) setGrowth(data.growth);
        break;
    }

    setLoadedTabs((prev) => new Set(prev).add(tab));
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    loadTab(tab);
  };

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) {
      loadTab("posts");
    } else {
      setLoadedTabs(new Set());
    }
  };

  const parseGenderAge = (genderAge: Record<string, number>) => {
    if (!genderAge || Object.keys(genderAge).length === 0) return { genderData: [], ageData: [] };

    const genderTotals: Record<string, number> = {};
    const ageTotals: Record<string, number> = {};

    Object.entries(genderAge).forEach(([key, value]) => {
      const [gender, age] = key.split(".");
      const genderLabel = gender === "M" ? "Masculino" : gender === "F" ? "Feminino" : "Outros";
      genderTotals[genderLabel] = (genderTotals[genderLabel] || 0) + value;
      ageTotals[age] = (ageTotals[age] || 0) + value;
    });

    return {
      genderData: Object.entries(genderTotals).map(([name, value]) => ({ name, value })),
      ageData: Object.entries(ageTotals)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, value]) => ({ name, value })),
    };
  };

  const parseTopItems = (items: Record<string, number>, limit = 10) => {
    return Object.entries(items || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, value]) => ({ name, value }));
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-pink-500">●</span>
            {accountName} — Instagram Insights
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="stories">Stories/Reels</TabsTrigger>
            <TabsTrigger value="audience">Audiência</TabsTrigger>
            <TabsTrigger value="growth">Crescimento</TabsTrigger>
          </TabsList>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <TabsContent value="posts" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{posts.length} posts recentes</p>
              <Button variant="ghost" size="sm" onClick={() => loadTab("posts", true)}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {posts.map((post) => (
                <Card key={post.id} className="overflow-hidden">
                  {post.media_url && (
                    <div className="aspect-square bg-muted relative">
                      <img
                        src={post.media_url}
                        alt={post.caption?.slice(0, 50) || "Post"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <Badge
                        variant="secondary"
                        className="absolute top-2 right-2 text-xs"
                      >
                        {post.media_type === "VIDEO" ? (
                          <Film className="w-3 h-3 mr-1" />
                        ) : (
                          <Image className="w-3 h-3 mr-1" />
                        )}
                        {post.media_type}
                      </Badge>
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {post.caption || "Sem legenda"}
                    </p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3 text-red-500" />
                        {post.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3 text-blue-500" />
                        {post.comments}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {post.timestamp &&
                        formatDistanceToNow(new Date(post.timestamp), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
            {posts.length === 0 && !loading && (
              <p className="text-center text-muted-foreground py-8">Nenhum post encontrado</p>
            )}
          </TabsContent>

          <TabsContent value="stories" className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Eye className="w-4 h-4" /> Stories Ativos
              </h3>
              {stories.length === 0 && !loading ? (
                <p className="text-sm text-muted-foreground">Nenhum story ativo no momento</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {stories.map((story) => (
                    <Card key={story.id} className="p-3 space-y-2">
                      {story.media_url && (
                        <img
                          src={story.media_url}
                          alt="Story"
                          className="w-full aspect-[9/16] object-cover rounded"
                          loading="lazy"
                        />
                      )}
                      <div className="grid grid-cols-3 gap-1 text-xs text-center">
                        <div>
                          <p className="text-muted-foreground">Impressões</p>
                          <p className="font-semibold">{story.impressions}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Alcance</p>
                          <p className="font-semibold">{story.reach}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Respostas</p>
                          <p className="font-semibold">{story.replies}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Film className="w-4 h-4" /> Reels Recentes
              </h3>
              {reels.length === 0 && !loading ? (
                <p className="text-sm text-muted-foreground">Nenhum reel encontrado</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {reels.map((reel) => (
                    <Card key={reel.id} className="p-3 space-y-2">
                      {reel.thumbnail_url && (
                        <img
                          src={reel.thumbnail_url}
                          alt="Reel"
                          className="w-full aspect-[9/16] object-cover rounded"
                          loading="lazy"
                        />
                      )}
                      <p className="text-xs text-muted-foreground line-clamp-2">{reel.caption}</p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-red-500" />
                          {reel.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 text-blue-500" />
                          {reel.comments}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="audience" className="space-y-6">
            {audience ? (
              <>
                {(() => {
                  const { genderData, ageData } = parseGenderAge(audience.gender_age);
                  return (
                    <>
                      {genderData.length > 0 && (
                        <Card className="p-4">
                          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" /> Gênero
                          </h3>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie
                                data={genderData}
                                cx="50%"
                                cy="50%"
                                outerRadius={70}
                                dataKey="value"
                                label={({ name, percent }) =>
                                  `${name} ${(percent * 100).toFixed(0)}%`
                                }
                              >
                                {genderData.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </Card>
                      )}

                      {ageData.length > 0 && (
                        <Card className="p-4">
                          <h3 className="font-semibold text-foreground mb-3">Faixa Etária</h3>
                          <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={ageData}>
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 11 }} />
                              <Tooltip />
                              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </Card>
                      )}
                    </>
                  );
                })()}

                {Object.keys(audience.cities || {}).length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-semibold text-foreground mb-3">Top Cidades</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={parseTopItems(audience.cities)} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {Object.keys(audience.countries || {}).length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-semibold text-foreground mb-3">Top Países</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={parseTopItems(audience.countries)} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}
              </>
            ) : (
              !loading && (
                <p className="text-center text-muted-foreground py-8">
                  Dados de audiência não disponíveis. Verifique se o token possui a permissão
                  instagram_manage_insights.
                </p>
              )
            )}
          </TabsContent>

          <TabsContent value="growth" className="space-y-4">
            {growth.length > 0 ? (
              <Card className="p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Seguidores — Últimos 30 dias
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={growth}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => format(new Date(d), "dd/MM")}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(d) => format(new Date(d as string), "dd/MM/yyyy")}
                    />
                    <Line
                      type="monotone"
                      dataKey="followers"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            ) : (
              !loading && (
                <p className="text-center text-muted-foreground py-8">
                  Dados de crescimento não disponíveis. Verifique se o token possui a permissão
                  instagram_manage_insights.
                </p>
              )
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
