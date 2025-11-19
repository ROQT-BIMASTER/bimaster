import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LookerStudioReports } from "@/components/marketing/LookerStudioReports";
import { DashCortexReports } from "@/components/marketing/DashCortexReports";
import { PowerBIReports } from "@/components/marketing/PowerBIReports";
import { SocialMediaMonitoring } from "@/components/marketing/SocialMediaMonitoring";
import { AIImageGenerator } from "@/components/marketing/AIImageGenerator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3 } from "lucide-react";

export default function Marketing() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Marketing</h1>
          <p className="text-muted-foreground mt-1">
            Relatórios e dashboards integrados
          </p>
        </div>
      </div>

      <Tabs defaultValue="looker" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="looker">Instagram</TabsTrigger>
          <TabsTrigger value="dashcortex">DashCortex</TabsTrigger>
          <TabsTrigger value="powerbi">Power BI</TabsTrigger>
          <TabsTrigger value="social">Redes Sociais</TabsTrigger>
          <TabsTrigger value="ai-images">Gerador IA</TabsTrigger>
        </TabsList>
        <TabsContent value="looker" className="mt-6">
          <LookerStudioReports />
        </TabsContent>
        <TabsContent value="dashcortex" className="mt-6">
          <DashCortexReports />
        </TabsContent>
        <TabsContent value="powerbi" className="mt-6">
          <PowerBIReports />
        </TabsContent>
        <TabsContent value="social" className="mt-6">
          <SocialMediaMonitoring />
        </TabsContent>
        <TabsContent value="ai-images" className="mt-6">
          <AIImageGenerator />
        </TabsContent>
      </Tabs>
      </div>
    </DashboardLayout>
  );
}
