import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { SocialMediaCharts } from "./SocialMediaCharts";
import { SocialMediaSentiment } from "./SocialMediaSentiment";
import { MultiAccountDashboard } from "./social/MultiAccountDashboard";
import { InfluencerDashboard } from "./influencers/InfluencerDashboard";
import { EditorialCalendar } from "./EditorialCalendar";
import { SchedulePostDialog } from "./SchedulePostDialog";
import { supabase } from "@/integrations/supabase/client";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";

interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  account_name: string;
}

export const SocialMediaMonitoring = () => {
  const [activeTab, setActiveTab] = useState("accounts");
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("social_media_accounts")
        .select("id, platform, username, account_name")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
    }
  };

  const handlePostScheduled = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <ScrollableTabsList className="sm:grid-cols-6">
          <TabsTrigger value="accounts">Gerenciar Contas</TabsTrigger>
          <TabsTrigger value="influencers">Influenciadores</TabsTrigger>
          <TabsTrigger value="calendar">Calendário Editorial</TabsTrigger>
          <TabsTrigger value="realtime">Métricas (Legacy)</TabsTrigger>
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
          <TabsTrigger value="sentiment">Sentimento</TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="accounts" className="space-y-6">
          <MultiAccountDashboard />
        </TabsContent>

        <TabsContent value="influencers" className="space-y-6">
          <InfluencerDashboard />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Agendamento de Posts</h2>
            <SchedulePostDialog accounts={accounts} onPostScheduled={handlePostScheduled} />
          </div>
          <EditorialCalendar key={refreshKey} />
        </TabsContent>


        <TabsContent value="realtime" className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Esta aba está obsoleta. Use a aba "Gerenciar Contas" para gerenciar múltiplas contas de redes sociais com funcionalidades avançadas.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="charts" className="space-y-6">
          <SocialMediaCharts />
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-6">
          <SocialMediaSentiment />
        </TabsContent>
      </Tabs>
    </div>
  );
};
