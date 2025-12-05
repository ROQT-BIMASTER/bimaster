import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Kanban, Palette, Trophy, Bell, Rocket, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { MissionControlKPIs } from "./MissionControlKPIs";
import { LaunchTimelineVisual } from "./LaunchTimelineVisual";
import { TeamRanking } from "./TeamRanking";
import { SmartKanban } from "./SmartKanban";
import { CreativeHub } from "./CreativeHub";

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
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center">
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
          <MissionControlKPIs />
          <LaunchTimelineVisual />
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
          <TeamRanking />
        </TabsContent>
      </Tabs>
    </div>
  );
}
