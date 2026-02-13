import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LookerStudioReports } from "@/components/marketing/LookerStudioReports";
import { DashCortexReports } from "@/components/marketing/DashCortexReports";
import { PowerBIReports } from "@/components/marketing/PowerBIReports";
import { SocialMediaMonitoring } from "@/components/marketing/SocialMediaMonitoring";
import { ElevenLabsStudio } from "@/components/marketing/ElevenLabsStudio";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Instagram, LineChart, TrendingUp, Share2, Volume2, ArrowLeft, Rocket } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type MenuSection = "menu" | "looker" | "dashcortex" | "powerbi" | "social" | "elevenlabs";

export default function Marketing() {
  const [activeSection, setActiveSection] = useState<MenuSection>("menu");
  const navigate = useNavigate();
  const { t } = useLanguage();

  const menuItems = [
    { id: "mission-control" as const, title: t("mkt.mission_control"), description: t("mkt.mission_desc"), icon: Rocket, isNew: true, navigateTo: "/dashboard/marketing/mission-control" },
    { id: "looker" as MenuSection, title: "Instagram", description: t("mkt.instagram_desc"), icon: Instagram },
    { id: "dashcortex" as MenuSection, title: "DashCortex", description: t("mkt.dashcortex_desc"), icon: LineChart },
    { id: "powerbi" as MenuSection, title: "Power BI", description: t("mkt.powerbi_desc"), icon: TrendingUp },
    { id: "social" as MenuSection, title: t("mkt.social"), description: t("mkt.social_desc"), icon: Share2 },
    { id: "elevenlabs" as MenuSection, title: "ElevenLabs Studio", description: t("mkt.elevenlabs_desc"), icon: Volume2, isNew: true },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "looker": return <LookerStudioReports />;
      case "dashcortex": return <DashCortexReports />;
      case "powerbi": return <PowerBIReports />;
      case "social": return <SocialMediaMonitoring />;
      case "elevenlabs": return <ElevenLabsStudio />;
      default: return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{t("mkt.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("mkt.subtitle")}</p>
          </div>
          {activeSection !== "menu" && (
            <Button variant="outline" onClick={() => setActiveSection("menu")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />{t("mkt.back_menu")}
            </Button>
          )}
        </div>

        {activeSection === "menu" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const handleClick = () => {
                if ('navigateTo' in item && item.navigateTo) navigate(item.navigateTo);
                else if ('id' in item && item.id !== 'mission-control') setActiveSection(item.id as MenuSection);
              };
              return (
                <Card key={item.id} className="cursor-pointer hover:border-primary transition-colors relative" onClick={handleClick}>
                  {'isNew' in item && item.isNew && (
                    <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[10px]">{t("mkt.new")}</Badge>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg"><Icon className="h-6 w-6 text-primary" /></div>
                      <CardTitle className="text-xl">{item.title}</CardTitle>
                    </div>
                    <CardDescription className="mt-2">{item.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="secondary" className="w-full">{t("mkt.access")}</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="mt-6">{renderContent()}</div>
        )}
      </div>
    </DashboardLayout>
  );
}