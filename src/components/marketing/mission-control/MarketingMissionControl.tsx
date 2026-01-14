import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Kanban, Palette, Trophy, Bell, Rocket, RefreshCw, Megaphone, FileText, Zap, CheckSquare, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { MissionControlKPIs } from "./MissionControlKPIs";
import { LaunchTimelineVisual } from "./LaunchTimelineVisual";
import { TeamRanking } from "./TeamRanking";
import { SmartKanban } from "./SmartKanban";
import { CreativeHub } from "./CreativeHub";
import { CampaignsList } from "./campaigns/CampaignsList";
import { ApprovalsList } from "./approvals/ApprovalsList";
import { AlertsCenter } from "./alerts/AlertsCenter";
import { TemplatesManager } from "./templates/TemplatesManager";
import { AutomationsManager } from "./automations/AutomationsManager";
import { WorkflowBoard } from "./workflow/WorkflowBoard";

export function MarketingMissionControl() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['mission-control-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['launch-timeline'] });
    queryClient.invalidateQueries({ queryKey: ['team-ranking'] });
    queryClient.invalidateQueries({ queryKey: ['kanban-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['marketing-approvals'] });
    queryClient.invalidateQueries({ queryKey: ['marketing-alerts'] });
    toast.success("Dados atualizados!");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Mission Control
              <Badge variant="secondary" className="text-[10px] animate-pulse">LIVE</Badge>
            </h1>
            <p className="text-sm text-muted-foreground">Central de comando das tarefas de marketing</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          <Button variant="outline" size="icon" className="relative" onClick={() => setActiveTab("alerts")}>
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center">3</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-background">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="kanban" className="gap-2 data-[state=active]:bg-background">
            <Kanban className="h-4 w-4" />
            <span className="hidden sm:inline">Kanban</span>
          </TabsTrigger>
          <TabsTrigger value="workflow" className="gap-2 data-[state=active]:bg-background">
            <GitBranch className="h-4 w-4" />
            <span className="hidden sm:inline">Workflow</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2 data-[state=active]:bg-background">
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">Campanhas</span>
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2 data-[state=active]:bg-background">
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Aprovações</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2 data-[state=active]:bg-background">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Alertas</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 data-[state=active]:bg-background">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="automations" className="gap-2 data-[state=active]:bg-background">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Automações</span>
          </TabsTrigger>
          <TabsTrigger value="creative" className="gap-2 data-[state=active]:bg-background">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Creative</span>
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-2 data-[state=active]:bg-background">
            <Trophy className="h-4 w-4" />
            <span className="hidden sm:inline">Ranking</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-0">
          <MissionControlKPIs />
          <LaunchTimelineVisual />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2"><SmartKanban /></div>
            <div><TeamRanking /></div>
          </div>
        </TabsContent>
        <TabsContent value="kanban" className="mt-0"><SmartKanban /></TabsContent>
        <TabsContent value="workflow" className="mt-0"><WorkflowBoard /></TabsContent>
        <TabsContent value="campaigns" className="mt-0"><CampaignsList /></TabsContent>
        <TabsContent value="approvals" className="mt-0"><ApprovalsList /></TabsContent>
        <TabsContent value="alerts" className="mt-0"><AlertsCenter /></TabsContent>
        <TabsContent value="templates" className="mt-0"><TemplatesManager /></TabsContent>
        <TabsContent value="automations" className="mt-0"><AutomationsManager /></TabsContent>
        <TabsContent value="creative" className="mt-0"><CreativeHub /></TabsContent>
        <TabsContent value="ranking" className="mt-0"><TeamRanking /></TabsContent>
      </Tabs>
    </div>
  );
}
