import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  Settings
} from "lucide-react";
import { toast } from "sonner";

interface SocialMetrics {
  followers: number;
  engagement: number;
  posts: number;
  reach: number;
}

export const SocialMediaMonitoring = () => {
  const [editMode, setEditMode] = useState(false);
  const [accounts, setAccounts] = useState({
    instagram: localStorage.getItem("social_instagram") || "",
    facebook: localStorage.getItem("social_facebook") || "",
    twitter: localStorage.getItem("social_twitter") || "",
    youtube: localStorage.getItem("social_youtube") || "",
    linkedin: localStorage.getItem("social_linkedin") || "",
    tiktok: localStorage.getItem("social_tiktok") || "",
  });

  const handleSave = () => {
    Object.entries(accounts).forEach(([key, value]) => {
      localStorage.setItem(`social_${key}`, value);
    });
    toast.success("Contas de redes sociais salvas com sucesso!");
    setEditMode(false);
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

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Monitoramento de Redes Sociais</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe todas as suas redes sociais em um único lugar
            </p>
          </div>
          <Button
            variant={editMode ? "default" : "outline"}
            onClick={() => setEditMode(!editMode)}
          >
            <Settings className="w-4 h-4 mr-2" />
            {editMode ? "Cancelar" : "Configurar Contas"}
          </Button>
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
            <Button onClick={handleSave} className="w-full">
              Salvar Configurações
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
                  value="0"
                  trend="+0%"
                />
                <MetricCard
                  icon={Heart}
                  label="Engajamento Médio"
                  value="0%"
                  trend="+0%"
                />
                <MetricCard
                  icon={Eye}
                  label="Alcance Total"
                  value="0"
                  trend="+0%"
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
                        <span className="font-semibold">0</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Posts</span>
                        <span className="font-semibold">0</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Engajamento</span>
                        <span className="font-semibold">0%</span>
                      </div>
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
