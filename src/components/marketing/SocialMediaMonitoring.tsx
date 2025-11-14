import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Instagram, 
  Facebook, 
  Twitter, 
  Youtube, 
  Linkedin, 
  TrendingUp,
  Users,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Settings,
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SocialMetrics {
  followers: number;
  engagement: number;
  posts: number;
  reach: number;
  likes?: number;
  comments?: number;
  shares?: number;
}

interface TokenConfig {
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  linkedin: string;
  tiktok: string;
}

export const SocialMediaMonitoring = () => {
  const [editMode, setEditMode] = useState(false);
  const [configMode, setConfigMode] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [metrics, setMetrics] = useState<Record<string, SocialMetrics>>({});
  
  const [accounts, setAccounts] = useState({
    instagram: localStorage.getItem("social_instagram_username") || "",
    facebook: localStorage.getItem("social_facebook_username") || "",
    twitter: localStorage.getItem("social_twitter_username") || "",
    youtube: localStorage.getItem("social_youtube_username") || "",
    linkedin: localStorage.getItem("social_linkedin_username") || "",
    tiktok: localStorage.getItem("social_tiktok_username") || "",
  });

  const [tokens, setTokens] = useState<TokenConfig>({
    instagram: localStorage.getItem("social_instagram_token") || "",
    facebook: localStorage.getItem("social_facebook_token") || "",
    twitter: localStorage.getItem("social_twitter_token") || "",
    youtube: localStorage.getItem("social_youtube_token") || "",
    linkedin: localStorage.getItem("social_linkedin_token") || "",
    tiktok: localStorage.getItem("social_tiktok_token") || "",
  });

  useEffect(() => {
    // Carrega métricas salvas
    const savedMetrics = localStorage.getItem("social_metrics");
    if (savedMetrics) {
      setMetrics(JSON.parse(savedMetrics));
    }
  }, []);

  const fetchMetrics = async (platform: string) => {
    const username = accounts[platform as keyof typeof accounts];
    const token = tokens[platform as keyof typeof tokens];
    
    if (!username || !token) {
      toast.error(`Configure o usuário e token de acesso para ${platform}`);
      return;
    }

    setLoading({ ...loading, [platform]: true });

    try {
      const { data, error } = await supabase.functions.invoke('social-media-metrics', {
        body: { platform, username, token }
      });

      if (error) throw error;

      setMetrics(prev => {
        const updated = { ...prev, [platform]: data };
        localStorage.setItem("social_metrics", JSON.stringify(updated));
        return updated;
      });

      toast.success(`Métricas do ${platform} atualizadas!`);
    } catch (error: any) {
      toast.error(`Erro ao buscar métricas do ${platform}: ${error.message}`);
    } finally {
      setLoading({ ...loading, [platform]: false });
    }
  };

  const handleSaveAccounts = () => {
    Object.entries(accounts).forEach(([key, value]) => {
      localStorage.setItem(`social_${key}_username`, value);
    });
    toast.success("Contas salvas com sucesso!");
    setEditMode(false);
  };

  const handleSaveTokens = () => {
    Object.entries(tokens).forEach(([key, value]) => {
      localStorage.setItem(`social_${key}_token`, value);
    });
    toast.success("Tokens de API salvos com sucesso!");
    setConfigMode(false);
  };

  const socialNetworks = [
    {
      id: "instagram",
      name: "Instagram",
      icon: Instagram,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
    {
      id: "facebook",
      name: "Facebook",
      icon: Facebook,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      id: "twitter",
      name: "Twitter/X",
      icon: Twitter,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
    },
    {
      id: "youtube",
      name: "YouTube",
      icon: Youtube,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      icon: Linkedin,
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
    },
    {
      id: "tiktok",
      name: "TikTok",
      icon: Users,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  const MetricCard = ({ icon: Icon, label, value, trend }: any) => (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
        {trend && (
          <Badge variant="secondary" className="gap-1">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </Badge>
        )}
      </div>
    </Card>
  );

  const hasAnyToken = Object.values(tokens).some(token => token !== "");

  return (
    <div className="space-y-6">
      {!hasAnyToken && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Configure os tokens de API das redes sociais para começar a monitorar suas métricas.
            <Button 
              variant="link" 
              className="ml-2 h-auto p-0"
              onClick={() => setConfigMode(true)}
            >
              Configurar agora
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Monitoramento de Redes Sociais</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe todas as suas redes sociais em um único lugar
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setConfigMode(!configMode)}
            >
              <Settings className="w-4 h-4 mr-2" />
              {configMode ? "Cancelar" : "Tokens API"}
            </Button>
            <Button
              variant={editMode ? "default" : "outline"}
              onClick={() => setEditMode(!editMode)}
            >
              <Users className="w-4 h-4 mr-2" />
              {editMode ? "Cancelar" : "Contas"}
            </Button>
          </div>
        </div>

        {editMode ? (
          <div className="space-y-4">
            {socialNetworks.map((network) => (
              <div key={network.id}>
                <Label htmlFor={network.id} className="flex items-center gap-2">
                  <network.icon className={`w-4 h-4 ${network.color}`} />
                  {network.name}
                </Label>
                <Input
                  id={network.id}
                  placeholder={`@usuario ou URL do perfil`}
                  value={accounts[network.id as keyof typeof accounts]}
                  onChange={(e) =>
                    setAccounts({ ...accounts, [network.id]: e.target.value })
                  }
                />
              </div>
            ))}
            <Button onClick={handleSaveAccounts} className="w-full">
              Salvar Usuários
            </Button>
          </div>
        ) : configMode ? (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Como obter tokens de API:</strong>
                <ul className="mt-2 space-y-2 list-disc list-inside">
                  <li><strong>Instagram:</strong> Acesse Meta for Developers → Instagram Basic Display API</li>
                  <li><strong>Facebook:</strong> Graph API Explorer → Gerar Token de Acesso</li>
                  <li><strong>Twitter:</strong> Developer Portal → Create App → Bearer Token</li>
                  <li><strong>YouTube:</strong> Google Cloud Console → YouTube Data API v3 → Credenciais</li>
                  <li><strong>LinkedIn:</strong> LinkedIn Developers → Create App → OAuth 2.0</li>
                  <li><strong>TikTok:</strong> TikTok for Developers → Create App → Access Token</li>
                </ul>
              </AlertDescription>
            </Alert>

            {socialNetworks.map((network) => (
              <div key={network.id} className="space-y-2">
                <Label htmlFor={`token-${network.id}`} className="flex items-center gap-2">
                  <network.icon className={`w-4 h-4 ${network.color}`} />
                  {network.name} - Token de Acesso
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`token-${network.id}`}
                    type="password"
                    placeholder="Insira seu token de API"
                    value={tokens[network.id as keyof TokenConfig]}
                    onChange={(e) =>
                      setTokens({ ...tokens, [network.id]: e.target.value })
                    }
                  />
                  {tokens[network.id as keyof TokenConfig] && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => fetchMetrics(network.id)}
                      disabled={loading[network.id]}
                    >
                      {loading[network.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button onClick={handleSaveTokens} className="w-full">
              Salvar Tokens
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="instagram">Instagram</TabsTrigger>
              <TabsTrigger value="facebook">Facebook</TabsTrigger>
              <TabsTrigger value="twitter">Twitter</TabsTrigger>
              <TabsTrigger value="youtube">YouTube</TabsTrigger>
              <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
              <TabsTrigger value="tiktok">TikTok</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  icon={Users}
                  label="Seguidores Totais"
                  value={Object.values(metrics).reduce((sum, m) => sum + (m?.followers || 0), 0).toLocaleString()}
                />
                <MetricCard
                  icon={Heart}
                  label="Engajamento Médio"
                  value={`${(Object.values(metrics).reduce((sum, m) => sum + (m?.engagement || 0), 0) / Math.max(Object.keys(metrics).length, 1)).toFixed(1)}%`}
                />
                <MetricCard
                  icon={Eye}
                  label="Alcance Total"
                  value={Object.values(metrics).reduce((sum, m) => sum + (m?.reach || 0), 0).toLocaleString()}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {socialNetworks.map((network) => (
                  <Card key={network.id} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 ${network.bgColor} rounded-lg`}>
                          <network.icon className={`w-6 h-6 ${network.color}`} />
                        </div>
                        <div>
                          <h3 className="font-semibold">{network.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {accounts[network.id as keyof typeof accounts] || "Não configurado"}
                          </p>
                        </div>
                      </div>
                    </div>
                      <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Seguidores</span>
                        <span className="font-semibold">
                          {metrics[network.id]?.followers?.toLocaleString() || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Posts</span>
                        <span className="font-semibold">
                          {metrics[network.id]?.posts?.toLocaleString() || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Engajamento</span>
                        <span className="font-semibold">
                          {metrics[network.id]?.engagement ? `${metrics[network.id].engagement.toFixed(1)}%` : "-"}
                        </span>
                      </div>
                      {tokens[network.id as keyof TokenConfig] && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => fetchMetrics(network.id)}
                          disabled={loading[network.id]}
                        >
                          {loading[network.id] ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <TrendingUp className="w-4 h-4 mr-2" />
                          )}
                          Atualizar
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              <Card className="p-6">
                <h3 className="font-semibold mb-4">Posts Recentes</h3>
                <div className="text-center py-8 text-muted-foreground">
                  Configure as contas para visualizar os posts recentes
                </div>
              </Card>
            </TabsContent>

            {socialNetworks.map((network) => (
              <TabsContent key={network.id} value={network.id} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <MetricCard icon={Users} label="Seguidores" value="0" trend="+0%" />
                  <MetricCard icon={Heart} label="Curtidas" value="0" trend="+0%" />
                  <MetricCard icon={MessageCircle} label="Comentários" value="0" trend="+0%" />
                  <MetricCard icon={Share2} label="Compartilhamentos" value="0" trend="+0%" />
                </div>

                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Análise de Performance</h3>
                  <div className="text-center py-8 text-muted-foreground">
                    Configure a conta do {network.name} para visualizar métricas detalhadas
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Posts Recentes</h3>
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum post encontrado
                  </div>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Nota Importante</h3>
        <p className="text-sm text-muted-foreground">
          Para obter métricas reais das redes sociais, você precisará integrar as APIs oficiais de cada plataforma.
          Esta interface está pronta para receber esses dados. Entre em contato com o suporte para configurar as integrações.
        </p>
      </Card>
    </div>
  );
};
