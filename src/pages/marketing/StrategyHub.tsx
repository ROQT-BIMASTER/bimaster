import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Palette, GitBranch, Target, FileText, Calendar, BarChart3, Lightbulb } from "lucide-react";
import { AgencyClientsHub } from "@/components/marketing/strategy/AgencyClientsHub";
import { BrandStrategyCanvas } from "@/components/marketing/strategy/BrandStrategyCanvas";
import { ContentFunnelPlanner } from "@/components/marketing/strategy/ContentFunnelPlanner";
import { CompetitorAnalysis } from "@/components/marketing/strategy/CompetitorAnalysis";
import { AIBriefingGenerator } from "@/components/marketing/strategy/AIBriefingGenerator";
import { UnifiedEditorialCalendar } from "@/components/marketing/strategy/UnifiedEditorialCalendar";
import { ClientPerformanceReport } from "@/components/marketing/strategy/ClientPerformanceReport";

type Section = "menu" | "clients" | "brand" | "funnel" | "competitor" | "briefing" | "calendar" | "report";

const menuItems = [
  { id: "clients" as Section, title: "Central de Clientes", description: "Gerencie todos os clientes da agência com KPIs e contratos", icon: Users },
  { id: "brand" as Section, title: "Brand Strategy Canvas", description: "Personas, SWOT, tom de voz e posicionamento com IA", icon: Palette, isNew: true },
  { id: "funnel" as Section, title: "Funil de Conteúdo", description: "Planeje conteúdo mapeado à jornada do cliente", icon: GitBranch },
  { id: "competitor" as Section, title: "Análise Competitiva", description: "Inteligência competitiva com monitoramento e IA", icon: Target },
  { id: "briefing" as Section, title: "Gerador de Briefing IA", description: "Crie briefings profissionais automaticamente", icon: FileText, isNew: true },
  { id: "calendar" as Section, title: "Calendário Editorial", description: "Visão unificada multi-cliente com drag-and-drop", icon: Calendar },
  { id: "report" as Section, title: "Relatório de Performance", description: "Relatórios executivos gerados por IA", icon: BarChart3 },
];

export default function StrategyHub() {
  const [activeSection, setActiveSection] = useState<Section>("menu");

  const renderContent = () => {
    switch (activeSection) {
      case "clients": return <AgencyClientsHub />;
      case "brand": return <BrandStrategyCanvas />;
      case "funnel": return <ContentFunnelPlanner />;
      case "competitor": return <CompetitorAnalysis />;
      case "briefing": return <AIBriefingGenerator />;
      case "calendar": return <UnifiedEditorialCalendar />;
      case "report": return <ClientPerformanceReport />;
      default: return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Estratégia</h1>
            <p className="text-muted-foreground mt-1">Planejamento estratégico completo para seus clientes</p>
          </div>
          {activeSection !== "menu" && (
            <Button variant="outline" onClick={() => setActiveSection("menu")} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Voltar ao Menu
            </Button>
          )}
        </div>

        {activeSection === "menu" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.id} className="cursor-pointer hover:border-primary transition-colors relative" onClick={() => setActiveSection(item.id)}>
                  {item.isNew && (
                    <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-[10px]">NOVO</Badge>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg"><Icon className="h-6 w-6 text-primary" /></div>
                      <CardTitle className="text-xl">{item.title}</CardTitle>
                    </div>
                    <CardDescription className="mt-2">{item.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="secondary" className="w-full">Acessar</Button>
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
