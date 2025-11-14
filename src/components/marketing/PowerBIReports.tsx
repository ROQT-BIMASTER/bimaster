import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { MarketingInsightsChat } from "./MarketingInsightsChat";

export const PowerBIReports = () => {
  const [reportUrls, setReportUrls] = useState({
    dashboard1: localStorage.getItem("powerbi_dashboard1") || "",
    dashboard2: localStorage.getItem("powerbi_dashboard2") || "",
    dashboard3: localStorage.getItem("powerbi_dashboard3") || "",
  });

  const [editMode, setEditMode] = useState(false);

  const handleSave = () => {
    localStorage.setItem("powerbi_dashboard1", reportUrls.dashboard1);
    localStorage.setItem("powerbi_dashboard2", reportUrls.dashboard2);
    localStorage.setItem("powerbi_dashboard3", reportUrls.dashboard3);
    toast.success("URLs do Power BI salvas com sucesso!");
    setEditMode(false);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Power BI Reports</h2>
          <Button
            variant={editMode ? "default" : "outline"}
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? "Cancelar" : "Configurar URLs"}
          </Button>
        </div>

        {editMode ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="dashboard1">Dashboard 1 - Métricas Gerais</Label>
              <Input
                id="dashboard1"
                placeholder="Cole aqui a URL do embed do Power BI"
                value={reportUrls.dashboard1}
                onChange={(e) =>
                  setReportUrls({ ...reportUrls, dashboard1: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="dashboard2">Dashboard 2 - Campanhas e ROI</Label>
              <Input
                id="dashboard2"
                placeholder="Cole aqui a URL do embed do Power BI"
                value={reportUrls.dashboard2}
                onChange={(e) =>
                  setReportUrls({ ...reportUrls, dashboard2: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="dashboard3">Dashboard 3 - Conversões</Label>
              <Input
                id="dashboard3"
                placeholder="Cole aqui a URL do embed do Power BI"
                value={reportUrls.dashboard3}
                onChange={(e) =>
                  setReportUrls({ ...reportUrls, dashboard3: e.target.value })
                }
              />
            </div>
            <Button onClick={handleSave} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Salvar Configurações
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="dashboard1" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dashboard1">Métricas Gerais</TabsTrigger>
              <TabsTrigger value="dashboard2">Campanhas & ROI</TabsTrigger>
              <TabsTrigger value="dashboard3">Conversões</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard1" className="space-y-4">
              {reportUrls.dashboard1 ? (
                <>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(reportUrls.dashboard1, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir em nova aba
                    </Button>
                  </div>
                  <iframe
                    src={reportUrls.dashboard1}
                    className="w-full border-0 rounded-lg"
                    style={{ height: "800px" }}
                    title="Power BI Dashboard 1"
                  />
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Configure a URL do dashboard para visualizar
                </div>
              )}
            </TabsContent>

            <TabsContent value="dashboard2" className="space-y-4">
              {reportUrls.dashboard2 ? (
                <>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(reportUrls.dashboard2, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir em nova aba
                    </Button>
                  </div>
                  <iframe
                    src={reportUrls.dashboard2}
                    className="w-full border-0 rounded-lg"
                    style={{ height: "800px" }}
                    title="Power BI Dashboard 2"
                  />
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Configure a URL do dashboard para visualizar
                </div>
              )}
            </TabsContent>

            <TabsContent value="dashboard3" className="space-y-4">
              {reportUrls.dashboard3 ? (
                <>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(reportUrls.dashboard3, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir em nova aba
                    </Button>
                  </div>
                  <iframe
                    src={reportUrls.dashboard3}
                    className="w-full border-0 rounded-lg"
                    style={{ height: "800px" }}
                    title="Power BI Dashboard 3"
                  />
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Configure a URL do dashboard para visualizar
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </Card>

      <MarketingInsightsChat 
        dashboardType="looker"
        activeDashboards={[
          { title: "Dashboard 1 - Métricas Gerais", url: reportUrls.dashboard1 },
          { title: "Dashboard 2 - Campanhas e ROI", url: reportUrls.dashboard2 },
          { title: "Dashboard 3 - Conversões", url: reportUrls.dashboard3 },
        ].filter(d => d.url)}
      />
    </div>
  );
};
