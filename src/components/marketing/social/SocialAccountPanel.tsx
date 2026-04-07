import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share, Send, Loader2, ImageIcon, Users, DollarSign, FileText, User, BarChart3, ExternalLink, Eye } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

interface Account {
  id: string;
  phyllo_account_id: string | null;
  username: string | null;
  platform: string | null;
}

interface Props {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted))", "#f59e0b", "#10b981", "#8b5cf6"];

function ProfileTab({ phylloAccountId }: { phylloAccountId: string }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["social-profile", phylloAccountId],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("phyllo-proxy", {
        body: { action: "get_profile", account_id: phylloAccountId },
      });
      return data?.data || data || null;
    },
    enabled: !!phylloAccountId,
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>;
  if (!profile) return <p className="text-sm text-muted-foreground text-center py-8">Dados do perfil não disponíveis.</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.image_url || profile.profile_image_url} alt={profile.username} />
          <AvatarFallback className="text-lg">{(profile.username || "?")[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground">{profile.full_name || profile.username}</h3>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.platform && (
            <Badge variant="outline" className="mt-1 text-xs capitalize">{profile.platform}</Badge>
          )}
        </div>
      </div>

      {profile.bio && (
        <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-foreground">{Number(profile.follower_count ?? profile.followers ?? 0).toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">Seguidores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-foreground">{Number(profile.following_count ?? profile.following ?? 0).toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">Seguindo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold text-foreground">{Number(profile.content_count ?? profile.media_count ?? 0).toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">Posts</p>
          </CardContent>
        </Card>
      </div>

      {profile.url && (
        <Button variant="outline" size="sm" className="w-full gap-2" asChild>
          <a href={profile.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Ver perfil na plataforma
          </a>
        </Button>
      )}
    </div>
  );
}

function EngagementTab({ phylloAccountId }: { phylloAccountId: string }) {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["social-engagement", phylloAccountId],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("phyllo-proxy", {
        body: { action: "get_engagement", account_id: phylloAccountId, limit: 50 },
      });
      return data?.data?.data || data?.data || [];
    },
    enabled: !!phylloAccountId,
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>;
  if (!Array.isArray(posts) || !posts.length) return <p className="text-sm text-muted-foreground text-center py-8">Dados de engajamento não disponíveis.</p>;

  const totalLikes = posts.reduce((sum: number, p: any) => sum + (p.engagement?.like_count ?? p.like_count ?? 0), 0);
  const totalComments = posts.reduce((sum: number, p: any) => sum + (p.engagement?.comment_count ?? p.comment_count ?? 0), 0);
  const totalShares = posts.reduce((sum: number, p: any) => sum + (p.engagement?.share_count ?? p.share_count ?? 0), 0);
  const totalViews = posts.reduce((sum: number, p: any) => sum + (p.engagement?.view_count ?? p.view_count ?? 0), 0);
  const totalEngagement = totalLikes + totalComments + totalShares;
  const avgEngagement = posts.length > 0 ? (totalEngagement / posts.length).toFixed(0) : "0";

  const top10 = [...posts]
    .map((p: any) => ({
      name: (p.title || p.description || "Post").substring(0, 15),
      likes: p.engagement?.like_count ?? p.like_count ?? 0,
      comments: p.engagement?.comment_count ?? p.comment_count ?? 0,
      shares: p.engagement?.share_count ?? p.share_count ?? 0,
    }))
    .sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares))
    .slice(0, 10);

  const bestPost = posts.reduce((best: any, p: any) => {
    const eng = (p.engagement?.like_count ?? p.like_count ?? 0) + (p.engagement?.comment_count ?? p.comment_count ?? 0) + (p.engagement?.share_count ?? p.share_count ?? 0);
    const bestEng = (best?.engagement?.like_count ?? best?.like_count ?? 0) + (best?.engagement?.comment_count ?? best?.comment_count ?? 0) + (best?.engagement?.share_count ?? best?.share_count ?? 0);
    return eng > bestEng ? p : best;
  }, posts[0]);

  return (
    <div className="space-y-5 max-h-[60vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Heart className="h-4 w-4 mx-auto mb-1 text-destructive" />
            <p className="text-lg font-bold text-foreground">{totalLikes.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">Curtidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <MessageCircle className="h-4 w-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold text-foreground">{totalComments.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">Comentários</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Share className="h-4 w-4 mx-auto mb-1 text-accent-foreground" />
            <p className="text-lg font-bold text-foreground">{totalShares.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">Compartilhamentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold text-foreground">{totalViews.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">Visualizações</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground mb-1">Engajamento médio por post</p>
          <p className="text-2xl font-bold text-foreground">{Number(avgEngagement).toLocaleString("pt-BR")}</p>
        </CardContent>
      </Card>

      {top10.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Top 10 Posts por Engajamento</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={top10} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="likes" stackId="a" fill="hsl(var(--destructive))" name="Curtidas" />
              <Bar dataKey="comments" stackId="a" fill="hsl(var(--primary))" name="Comentários" />
              <Bar dataKey="shares" stackId="a" fill="hsl(var(--accent))" name="Compartilhamentos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {bestPost && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-primary mb-1">🏆 Melhor Post</p>
            <p className="text-sm text-foreground line-clamp-2">{bestPost.title || bestPost.description || "Sem legenda"}</p>
            <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
              <span><Heart className="h-3 w-3 inline mr-0.5" />{bestPost.engagement?.like_count ?? bestPost.like_count ?? 0}</span>
              <span><MessageCircle className="h-3 w-3 inline mr-0.5" />{bestPost.engagement?.comment_count ?? bestPost.comment_count ?? 0}</span>
              <span><Share className="h-3 w-3 inline mr-0.5" />{bestPost.engagement?.share_count ?? bestPost.share_count ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ContentTab({ phylloAccountId }: { phylloAccountId: string }) {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["social-content", phylloAccountId],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("phyllo-proxy", {
        body: { action: "get_engagement", account_id: phylloAccountId, limit: 20 },
      });
      return data?.data?.data || data?.data || [];
    },
    enabled: !!phylloAccountId,
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>;
  if (!Array.isArray(posts) || !posts.length) return <p className="text-sm text-muted-foreground text-center py-8">Nenhum conteúdo encontrado.</p>;

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
      {posts.map((post: any, idx: number) => (
        <Card key={post.id || idx}>
          <CardContent className="p-4">
            <div className="flex gap-3">
              {post.thumbnail_url || post.media_url ? (
                <img src={post.thumbnail_url || post.media_url} alt="" className="w-16 h-16 rounded-md object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground line-clamp-2">{post.title || post.description || "Sem legenda"}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{post.engagement?.like_count ?? post.like_count ?? 0}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{post.engagement?.comment_count ?? post.comment_count ?? 0}</span>
                  <span className="flex items-center gap-1"><Share className="h-3 w-3" />{post.engagement?.share_count ?? post.share_count ?? 0}</span>
                </div>
                {post.published_at && (
                  <p className="text-xs text-muted-foreground mt-1">{new Date(post.published_at).toLocaleDateString("pt-BR")}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AudienceTab({ phylloAccountId }: { phylloAccountId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["social-audience", phylloAccountId],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("phyllo-proxy", {
        body: { action: "get_audience", account_id: phylloAccountId },
      });
      return data?.data || data || null;
    },
    enabled: !!phylloAccountId,
  });

  if (isLoading) return <div className="h-48 bg-muted animate-pulse rounded-lg" />;
  if (!data) return <p className="text-sm text-muted-foreground text-center py-8">Dados de audiência não disponíveis.</p>;

  const genderData = data.demographics?.gender?.map((g: any) => ({
    name: g.name === "MALE" ? "Masculino" : g.name === "FEMALE" ? "Feminino" : g.name,
    value: g.value || g.percentage,
  })) || [];

  const ageData = data.demographics?.age?.map((a: any) => ({
    name: a.name,
    value: a.value || a.percentage,
  })) || [];

  const cityData = (data.demographics?.city || data.demographics?.cities || []).slice(0, 6).map((c: any) => ({
    name: c.name,
    value: c.value || c.percentage,
  }));

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto">
      {genderData.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Gênero</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}%`}>
                {genderData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {ageData.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Faixa Etária</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ageData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {cityData.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-2">Cidades</h4>
          <div className="space-y-2">
            {cityData.map((c: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-foreground">{c.name}</span>
                <span className="text-muted-foreground">{c.value}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IncomeTab({ phylloAccountId }: { phylloAccountId: string }) {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["social-income", phylloAccountId],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("phyllo-proxy", {
        body: { action: "get_income", account_id: phylloAccountId, limit: 50 },
      });
      return data?.data?.data || data?.data || [];
    },
    enabled: !!phylloAccountId,
  });

  if (isLoading) return <div className="h-32 bg-muted animate-pulse rounded-lg" />;
  if (!Array.isArray(transactions) || !transactions.length) return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação encontrada.</p>;

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-2">Data</th>
            <th className="text-left py-2">Tipo</th>
            <th className="text-right py-2">Valor</th>
            <th className="text-left py-2">Plataforma</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx: any, idx: number) => (
            <tr key={tx.id || idx} className="border-b last:border-0">
              <td className="py-2 text-foreground">{tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString("pt-BR") : "—"}</td>
              <td className="py-2"><Badge variant="outline" className="text-xs">{tx.type || tx.transaction_type || "—"}</Badge></td>
              <td className="py-2 text-right font-medium text-foreground">
                {tx.currency || "USD"} {Number(tx.amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </td>
              <td className="py-2 text-muted-foreground">{tx.platform_name || tx.platform || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PublishTab({ phylloAccountId, platform }: { phylloAccountId: string; platform: string }) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [postType, setPostType] = useState("POST");
  const [visibility, setVisibility] = useState("PUBLIC");

  const handlePublish = async () => {
    if (!description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("phyllo-proxy", {
        body: {
          action: "publish_content",
          account_id: phylloAccountId,
          type: postType,
          title: title || undefined,
          description,
          media_url: mediaUrl || undefined,
          visibility,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Conteúdo publicado com sucesso!");
      setTitle("");
      setDescription("");
      setMediaUrl("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao publicar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={postType} onValueChange={setPostType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="POST">Post</SelectItem>
              <SelectItem value="REEL">Reel</SelectItem>
              <SelectItem value="STORY">Story</SelectItem>
              <SelectItem value="VIDEO">Vídeo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Visibilidade</Label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC">Público</SelectItem>
              <SelectItem value="PRIVATE">Privado</SelectItem>
              <SelectItem value="UNLISTED">Não listado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Título (opcional)</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do post" />
      </div>
      <div className="space-y-2">
        <Label>Descrição / Legenda</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Escreva a legenda..." rows={4} />
      </div>
      <div className="space-y-2">
        <Label>URL da Mídia (opcional)</Label>
        <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." />
      </div>
      <Button onClick={handlePublish} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
        Publicar
      </Button>
    </div>
  );
}

export function SocialAccountPanel({ account, open, onOpenChange }: Props) {
  const phylloAccountId = account.phyllo_account_id || account.id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>@{account.username || "Conta"}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="profile" className="mt-4">
          <TabsList className="w-full grid grid-cols-6">
            <TabsTrigger value="profile" className="text-xs gap-1"><User className="h-3 w-3" />Perfil</TabsTrigger>
            <TabsTrigger value="content" className="text-xs gap-1"><FileText className="h-3 w-3" />Conteúdo</TabsTrigger>
            <TabsTrigger value="audience" className="text-xs gap-1"><Users className="h-3 w-3" />Audiência</TabsTrigger>
            <TabsTrigger value="engagement" className="text-xs gap-1"><BarChart3 className="h-3 w-3" />Engajamento</TabsTrigger>
            <TabsTrigger value="income" className="text-xs gap-1"><DollarSign className="h-3 w-3" />Receita</TabsTrigger>
            <TabsTrigger value="publish" className="text-xs gap-1"><Send className="h-3 w-3" />Publicar</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab phylloAccountId={phylloAccountId} />
          </TabsContent>
          <TabsContent value="content">
            <ContentTab phylloAccountId={phylloAccountId} />
          </TabsContent>
          <TabsContent value="audience">
            <AudienceTab phylloAccountId={phylloAccountId} />
          </TabsContent>
          <TabsContent value="engagement">
            <EngagementTab phylloAccountId={phylloAccountId} />
          </TabsContent>
          <TabsContent value="income">
            <IncomeTab phylloAccountId={phylloAccountId} />
          </TabsContent>
          <TabsContent value="publish">
            <PublishTab phylloAccountId={phylloAccountId} platform={account.platform || "instagram"} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
