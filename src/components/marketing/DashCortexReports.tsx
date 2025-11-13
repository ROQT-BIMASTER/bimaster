import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, ExternalLink, BarChart3 } from "lucide-react";
import { toast } from "sonner";

interface ReportConfig {
  title: string;
  url: string;
  enabled: boolean;
}

export const DashCortexReports = () => {
  const [reports, setReports] = useState<ReportConfig[]>([
    { title: "DashCortex Google Ads 3.0 BR", url: "", enabled: false },
    { title: "DashCortex Meta Ads | Data Bloo Conversion BR", url: "", enabled: false },
    { title: "DashCortex Meta Ads | Windsor.IA Conversion BR", url: "", enabled: false },
  ]);
  const [configOpen, setConfigOpen] = useState(false);
  const [editingReports, setEditingReports] = useState<ReportConfig[]>(reports);

  useEffect(() => {
    const savedReports = localStorage.getItem("dashcortex-reports");
    if (savedReports) {
      try {
        const parsed = JSON.parse(savedReports);
        setReports(parsed);
        setEditingReports(parsed);
      } catch (error) {
        console.error("Erro ao carregar configurações dos dashboards:", error);
      }
    }
  }, []);

  const handleSaveConfig = () => {
    localStorage.setItem("dashcortex-reports", JSON.stringify(editingReports));
    setReports(editingReports);
    setConfigOpen(false);
    toast.success("Configurações dos dashboards salvas com sucesso!");
  };

  const handleUpdateReport = (index: number, field: keyof ReportConfig, value: string | boolean) => {
    const updated = [...editingReports];
    updated[index] = { ...updated[index], [field]: value };
    setEditingReports(updated);
  };

  const activeReports = reports.filter(r => r.enabled && r.url);

  if (activeReports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Dashboards DashCortex
          </CardTitle>
          <CardDescription>
            Configure os URLs dos seus dashboards DashCortex para visualizá-los aqui
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button>
                <Settings className="mr-2 h-4 w-4" />
                Configurar Dashboards
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configurar Dashboards DashCortex</DialogTitle>
                <DialogDescription>
                  Configure os URLs dos seus dashboards. Cole o link de compartilhamento de cada dashboard.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {editingReports.map((report, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{report.title}</CardTitle>
                        <Switch
                          checked={report.enabled}
                          onCheckedChange={(checked) => handleUpdateReport(index, "enabled", checked)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor={`url-${index}`}>URL do Dashboard</Label>
                        <Input
                          id={`url-${index}`}
                          value={report.url}
                          onChange={(e) => handleUpdateReport(index, "url", e.target.value)}
                          placeholder="https://..."
                          className="mt-1.5"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfigOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveConfig}>
                  Salvar Configurações
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dashboards DashCortex</h2>
          <p className="text-muted-foreground">
            {activeReports.length} dashboard{activeReports.length !== 1 ? 's' : ''} configurado{activeReports.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Configurar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configurar Dashboards DashCortex</DialogTitle>
              <DialogDescription>
                Configure os URLs dos seus dashboards. Cole o link de compartilhamento de cada dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {editingReports.map((report, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{report.title}</CardTitle>
                      <Switch
                        checked={report.enabled}
                        onCheckedChange={(checked) => handleUpdateReport(index, "enabled", checked)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor={`url-${index}`}>URL do Dashboard</Label>
                      <Input
                        id={`url-${index}`}
                        value={report.url}
                        onChange={(e) => handleUpdateReport(index, "url", e.target.value)}
                        placeholder="https://..."
                        className="mt-1.5"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfigOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveConfig}>
                Salvar Configurações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="0" className="w-full">
        <TabsList>
          {activeReports.map((report, index) => (
            <TabsTrigger key={index} value={index.toString()}>
              {report.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {activeReports.map((report, index) => (
          <TabsContent key={index} value={index.toString()}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{report.title}</CardTitle>
                  <Button variant="outline" size="sm" asChild>
                    <a href={report.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir em nova aba
                    </a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="w-full" style={{ height: '600px' }}>
                  <iframe
                    src={report.url}
                    className="w-full h-full border-0 rounded-md"
                    title={report.title}
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
