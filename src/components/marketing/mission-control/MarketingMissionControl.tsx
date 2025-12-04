import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, Kanban, Palette, Trophy, 
  Bell, Settings, Rocket, RefreshCw 
} from "lucide-react";
import { MissionControlKPIs } from "./MissionControlKPIs";
import { LaunchTimelineVisual } from "./LaunchTimelineVisual";
import { TeamRanking } from "./TeamRanking";
import { SmartKanban } from "./SmartKanban";
import { CreativeHub } from "./CreativeHub";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function MarketingMissionControl() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['mission-control-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['launch-timeline'] });
    queryClient.invalidateQueries({ queryKey: ['team-ranking'] });
    queryClient.invalidateQueries({ queryKey: ['kanban-tasks'] });
    toast.success("Dados atualizados!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Mission Control
              <Badge variant="secondary" className="text-[10px] animate-pulse">
                LIVE
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Central de comando das tarefas de marketing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
              3
            </span>
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-background">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-2 data-[state=active]:bg-background">
            <Kanban className="h-4 w-4" />
            <span className="hidden sm:inline">Kanban</span>
          </TabsTrigger>
          <TabsTrigger value="creative" className="gap-2 data-[state=active]:bg-background">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Creative Hub</span>
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-2 data-[state=active]:bg-background">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Ranking</span>
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6 mt-0">
          {/* KPIs */}
          <MissionControlKPIs />

          {/* Timeline */}
          <LaunchTimelineVisual />

          {/* Grid: Kanban Preview + Ranking */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SmartKanban />
            </div>
            <div>
              <TeamRanking />
            </div>
          </div>
        </TabsContent>

        {/* Kanban Tab */}
        <TabsContent value="kanban" className="mt-0">
          <SmartKanban />
        </TabsContent>

        {/* Creative Hub Tab */}
        <TabsContent value="creative" className="mt-0">
          <CreativeHub />
        </TabsContent>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TeamRanking />
            <div className="space-y-6">
              {/* Badges Section */}
              <BadgesShowcase />
              {/* Recent Activity */}
              <RecentActivity />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Badges Showcase Component
function BadgesShowcase() {
  const { data: badges } = useQuery({
    queryKey: ['marketing-badges'],
    queryFn: async () => {
      const { data } = await supabase
        .from('marketing_badges')
        .select('*')
        .order('pontos_necessarios', { ascending: true });
      return data || [];
    }
  });

  const iconMap: Record<string, React.ReactNode> = {
    Star: <Star className="h-6 w-6" />,
    Zap: <Zap className="h-6 w-6" />,
    Palette: <Palette className="h-6 w-6" />,
    Flame: <Flame className="h-6 w-6" />,
    Trophy: <Trophy className="h-6 w-6" />,
    Users: <Users className="h-6 w-6" />,
    Rocket: <Rocket className="h-6 w-6" />,
    CheckCircle: <CheckCircle className="h-6 w-6" />,
    Sun: <Sun className="h-6 w-6" />,
    Crown: <Crown className="h-6 w-6" />,
    Award: <Award className="h-6 w-6" />
  };

  const colorMap: Record<string, string> = {
    bronze: "from-amber-700 to-amber-900",
    silver: "from-gray-300 to-gray-500",
    gold: "from-amber-400 to-amber-600",
    orange: "from-orange-400 to-orange-600",
    purple: "from-purple-400 to-purple-600",
    blue: "from-blue-400 to-blue-600",
    green: "from-green-400 to-green-600",
    yellow: "from-yellow-400 to-yellow-600",
    gradient: "from-pink-500 via-purple-500 to-blue-500"
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          Conquistas Disponíveis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 gap-3">
          {badges?.slice(0, 10).map(badge => (
            <div 
              key={badge.id}
              className="flex flex-col items-center p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-white mb-1",
                "bg-gradient-to-br opacity-50 group-hover:opacity-100 transition-opacity",
                colorMap[badge.cor] || colorMap.gold
              )}>
                {iconMap[badge.icone] || <Award className="h-6 w-6" />}
              </div>
              <span className="text-[10px] text-center font-medium line-clamp-1">
                {badge.nome}
              </span>
              <span className="text-[8px] text-muted-foreground">
                {badge.pontos_necessarios}pts
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Recent Activity Component  
function RecentActivity() {
  const { data: activity } = useQuery({
    queryKey: ['marketing-recent-activity'],
    queryFn: async () => {
      const { data } = await supabase
        .from('marketing_points_history')
        .select('*, profiles:user_id(nome)')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    }
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          {activity && activity.length > 0 ? (
            <div className="space-y-3">
              {activity.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{item.descricao || item.tipo}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.profiles?.nome}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    +{item.pontos}pts
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma atividade recente
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Import missing components
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Star, Zap, Flame, Users, CheckCircle, Sun, Crown, Award, Activity 
} from "lucide-react";
import { cn } from "@/lib/utils";
