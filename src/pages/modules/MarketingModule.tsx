import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  MessageSquare, 
  Calendar, 
  Image, 
  ArrowRight,
  LineChart,
  Brain,
  Users,
  Activity,
  Sparkles,
  Eye,
  Send,
  ChevronDown,
  Zap,
  Plus,
  Volume2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const MarketingModule = () => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const { data: stats } = useQuery({
    queryKey: ['marketing-module-stats'],
    queryFn: async () => {
      const [postsRes, conversasRes] = await Promise.all([
        supabase.from("social_media_posts").select("*", { count: "exact", head: true }),
        supabase.from("whatsapp_conversations").select("*", { count: "exact", head: true })
      ]);

      return {
        totalPosts: postsRes.count || 0,
        conversasWhatsApp: conversasRes.count || 0,
        campanhasAtivas: 12,
        alcanceTotal: 15420
      };
    }
  });

  // Módulos secundários agrupados
  const secondaryModules = {
    "Conteúdo e Criação": [
      { title: "ElevenLabs Studio", to: "/dashboard/marketing/elevenlabs", icon: Volume2, color: "text-purple-600", disabled: false },
      { title: "Calendário Editorial", to: "#", icon: Calendar, color: "text-orange-600", disabled: true },
      { title: "Gerador de Imagens", to: "#", icon: Image, color: "text-purple-600", disabled: true },
      { title: "Monitoramento", to: "#", icon: Users, color: "text-green-600", disabled: true },
    ],
    "Inteligência Artificial": [
      { title: "Agente IA", to: "#", icon: Brain, color: "text-purple-600", disabled: true },
      { title: "Análise de Sentimento", to: "#", icon: Sparkles, color: "text-indigo-600", disabled: true },
    ],
    "Analytics e BI": [
      { title: "DashCortex Reports", to: "#", icon: LineChart, color: "text-blue-600", disabled: true },
      { title: "Power BI", to: "#", icon: BarChart3, color: "text-yellow-600", disabled: true },
      { title: "Looker Studio", to: "#", icon: Activity, color: "text-orange-600", disabled: true },
    ],
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Marketing Digital</h1>
          <p className="text-muted-foreground mt-1">
            Campanhas, redes sociais e comunicação
          </p>
        </div>

        {/* Ações Rápidas */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <Button 
            asChild
            size="lg"
            className="h-14 gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
          >
            <Link to="/dashboard/marketing/social">
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Plus className="h-5 w-5" />
              </div>
              <span className="font-semibold">Nova Campanha</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-14 gap-3 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-400"
          >
            <Link to="/dashboard/marketing/whatsapp">
              <div className="p-1.5 bg-green-200 dark:bg-green-800 rounded-lg">
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="font-semibold">WhatsApp</span>
            </Link>
          </Button>

          <Button 
            asChild
            size="lg"
            variant="outline"
            className="h-14 gap-3 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:hover:bg-purple-900 dark:text-purple-400"
          >
            <Link to="/dashboard/marketing/elevenlabs">
              <div className="p-1.5 bg-purple-200 dark:bg-purple-800 rounded-lg">
                <Volume2 className="h-5 w-5" />
              </div>
              <span className="font-semibold">ElevenLabs Studio</span>
            </Link>
          </Button>
        </div>

        {/* Módulos Principais - 4 cards destacados com métricas */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {/* Posts Agendados */}
          <Link to="/dashboard/marketing/social">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                    <Send className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {stats?.totalPosts || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Posts Agendados</h3>
                  <p className="text-xs text-muted-foreground">Programados</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Campanhas Ativas */}
          <Link to="/dashboard/marketing/social">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-purple-100 dark:bg-purple-900/50 rounded-xl">
                    <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {stats?.campanhasAtivas || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Campanhas Ativas</h3>
                  <p className="text-xs text-muted-foreground">Em execução</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* WhatsApp */}
          <Link to="/dashboard/marketing/whatsapp">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-green-100 dark:bg-green-900/50 rounded-xl">
                    <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {stats?.conversasWhatsApp || 0}
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Conversas</h3>
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Alcance Total */}
          <Link to="/dashboard/marketing/social">
            <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 border-l-4 border-l-orange-500 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 bg-orange-100 dark:bg-orange-900/50 rounded-xl">
                    <Eye className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {((stats?.alcanceTotal || 0) / 1000).toFixed(1)}k
                  </p>
                  <h3 className="text-sm font-medium text-foreground mt-1">Alcance Total</h3>
                  <p className="text-xs text-muted-foreground">Impressões</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Módulos Secundários - Accordion */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Zap className="h-4 w-4" />
            <span>Mais funcionalidades</span>
          </div>

          {Object.entries(secondaryModules).map(([category, modules]) => (
            <Collapsible
              key={category}
              open={openSections[category]}
              onOpenChange={() => toggleSection(category)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <span className="font-medium text-sm">{category}</span>
                <ChevronDown 
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    openSections[category] && "rotate-180"
                  )} 
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex flex-wrap gap-2 pl-2">
                  {modules.map((module) => (
                    module.disabled ? (
                      <span 
                        key={module.title}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-dashed text-muted-foreground text-sm cursor-not-allowed"
                      >
                        <module.icon className="h-4 w-4" />
                        <span>{module.title}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Em breve</span>
                      </span>
                    ) : (
                      <Link 
                        key={module.to} 
                        to={module.to}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-background border hover:bg-muted/50 hover:border-primary/30 transition-colors text-sm"
                      >
                        <module.icon className={cn("h-4 w-4", module.color)} />
                        <span>{module.title}</span>
                      </Link>
                    )
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

      </div>
    </DashboardLayout>
  );
};

export default MarketingModule;
