import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { LookerStudioReports } from "@/components/marketing/LookerStudioReports";
import { DashCortexReports } from "@/components/marketing/DashCortexReports";
import { PowerBIReports } from "@/components/marketing/PowerBIReports";
import { SocialMediaMonitoring } from "@/components/marketing/SocialMediaMonitoring";
import { AIImageGenerator } from "@/components/marketing/AIImageGenerator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Instagram, LineChart, TrendingUp, Share2, Sparkles, Video, ArrowLeft } from "lucide-react";

type MenuSection = 
  | "menu"
  | "looker"
  | "dashcortex"
  | "powerbi"
  | "social"
  | "ai-images"
  | "pollo";

const menuItems = [
  {
    id: "looker" as MenuSection,
    title: "Instagram",
    description: "Análises e métricas do Instagram",
    icon: Instagram,
  },
  {
    id: "dashcortex" as MenuSection,
    title: "DashCortex",
    description: "Relatórios integrados DashCortex",
    icon: LineChart,
  },
  {
    id: "powerbi" as MenuSection,
    title: "Power BI",
    description: "Dashboards e visualizações Power BI",
    icon: TrendingUp,
  },
  {
    id: "social" as MenuSection,
    title: "Redes Sociais",
    description: "Gerenciar contas e métricas sociais",
    icon: Share2,
  },
  {
    id: "ai-images" as MenuSection,
    title: "Gerador IA",
    description: "Gerar imagens com inteligência artificial",
    icon: Sparkles,
  },
  {
    id: "pollo" as MenuSection,
    title: "Pollo AI",
    description: "Efeitos e edição de vídeo com IA",
    icon: Video,
  },
];

export default function Marketing() {
  const [activeSection, setActiveSection] = useState<MenuSection>("menu");

  const renderContent = () => {
    switch (activeSection) {
      case "looker":
        return <LookerStudioReports />;
      case "dashcortex":
        return <DashCortexReports />;
      case "powerbi":
        return <PowerBIReports />;
      case "social":
        return <SocialMediaMonitoring />;
      case "ai-images":
        return <AIImageGenerator />;
      case "pollo":
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pollo AI - Efeitos de Vídeo</CardTitle>
                <CardDescription>
                  Para usar o Pollo AI com login do Google, é necessário abrir em uma nova aba.
                  Iframes têm restrições de segurança que impedem o login social.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => window.open("https://pollo.ai/pt/app/pro-effects", "_blank")}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Video className="h-5 w-5" />
                  Abrir Pollo AI em Nova Aba
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  O login do Google funcionará normalmente na nova aba
                </p>
              </CardContent>
            </Card>
            <div className="w-full h-[calc(100vh-24rem)] rounded-lg overflow-hidden border border-border">
              <iframe
                src="https://pollo.ai/pt/app/pro-effects"
                className="w-full h-full"
                title="Pollo AI"
                allow="camera; microphone"
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Marketing</h1>
            <p className="text-muted-foreground mt-1">
              Relatórios e dashboards integrados
            </p>
          </div>
          {activeSection !== "menu" && (
            <Button
              variant="outline"
              onClick={() => setActiveSection("menu")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Menu
            </Button>
          )}
        </div>

        {activeSection === "menu" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setActiveSection(item.id)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{item.title}</CardTitle>
                    </div>
                    <CardDescription className="mt-2">
                      {item.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="secondary" className="w-full">
                      Acessar
                    </Button>
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
