import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { MarketingInsightsChat } from "./MarketingInsightsChat";

interface ReportConfig {
  title: string;
  url: string;
  enabled: boolean;
}

export function LookerStudioReports() {
  const [reports, setReports] = useState<ReportConfig[]>([
    { title: "Relatório 1", url: "", enabled: false },
    { title: "Relatório 2", url: "", enabled: false },
    { title: "Relatório 3", url: "", enabled: false },
  ]);
  const [configOpen, setConfigOpen] = useState(false);
  const [editingReports, setEditingReports] = useState<ReportConfig[]>(reports);

  // Carregar configurações do localStorage
  useEffect(() => {
    const savedReports = localStorage.getItem("looker_studio_reports");
    if (savedReports) {
      try {
        const parsed = JSON.parse(savedReports);
        setReports(parsed);
        setEditingReports(parsed);
      } catch (error) {
        console.error("Erro ao carregar relatórios:", error);
      }
    }
  }, []);

  const handleSaveConfig = () => {
    localStorage.setItem("looker_studio_reports", JSON.stringify(editingReports));
    setReports(editingReports);
    setConfigOpen(false);
    toast.success("Configurações dos relatórios salvas com sucesso!");
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
          <CardTitle>Configurar Relatórios</CardTitle>
          <CardDescription>
            Configure até 3 relatórios do Looker Studio para visualização integrada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Nenhum relatório configurado ainda. Clique no botão abaixo para adicionar seus relatórios do Looker Studio.
          </p>
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button>
                <Settings className="h-4 w-4 mr-2" />
                Configurar Relatórios
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Configurar Relatórios Looker Studio</DialogTitle>
                <DialogDescription>
                  Adicione as URLs dos relatórios do Looker Studio que deseja visualizar
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {editingReports.map((report, index) => (
                  <div key={index} className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`title-${index}`} className="font-semibold">
                        Relatório {index + 1}
                      </Label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={report.enabled}
                          onChange={(e) => handleUpdateReport(index, "enabled", e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-muted-foreground">Ativo</span>
                      </label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`title-${index}`}>Título</Label>
                      <Input
                        id={`title-${index}`}
                        value={report.title}
                        onChange={(e) => handleUpdateReport(index, "title", e.target.value)}
                        placeholder="Nome do relatório"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`url-${index}`}>URL do Looker Studio</Label>
                      <Input
                        id={`url-${index}`}
                        value={report.url}
                        onChange={(e) => handleUpdateReport(index, "url", e.target.value)}
                        placeholder="https://lookerstudio.google.com/..."
                      />
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfigOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveConfig}>
                  Salvar Configurações
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {activeReports.length} relatório{activeReports.length !== 1 ? "s" : ""} configurado{activeReports.length !== 1 ? "s" : ""}
        </div>
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Configurar Relatórios Looker Studio</DialogTitle>
              <DialogDescription>
                Edite as URLs dos relatórios do Looker Studio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {editingReports.map((report, index) => (
                <div key={index} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`title-${index}`} className="font-semibold">
                      Relatório {index + 1}
                    </Label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={report.enabled}
                        onChange={(e) => handleUpdateReport(index, "enabled", e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-muted-foreground">Ativo</span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`title-${index}`}>Título</Label>
                    <Input
                      id={`title-${index}`}
                      value={report.title}
                      onChange={(e) => handleUpdateReport(index, "title", e.target.value)}
                      placeholder="Nome do relatório"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`url-${index}`}>URL do Looker Studio</Label>
                    <Input
                      id={`url-${index}`}
                      value={report.url}
                      onChange={(e) => handleUpdateReport(index, "url", e.target.value)}
                      placeholder="https://lookerstudio.google.com/..."
                    />
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfigOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveConfig}>
                Salvar Configurações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="0" className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${activeReports.length}, 1fr)` }}>
          {activeReports.map((report, index) => (
            <TabsTrigger key={index} value={index.toString()}>
              {report.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {activeReports.map((report, index) => (
          <TabsContent key={index} value={index.toString()} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{report.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a
                      href={report.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir no Looker Studio
                    </a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="w-full rounded-lg overflow-hidden border bg-card" style={{ height: "calc(100vh - 300px)" }}>
                  <iframe
                    src={report.url}
                    className="w-full h-full"
                    frameBorder="0"
                    allowFullScreen
                    sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <MarketingInsightsChat 
        dashboardType="looker"
        activeDashboards={activeReports}
      />
    </div>
  );
}
