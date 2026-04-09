import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2, Wand2, Copy, ExternalLink, Trash2, Image as ImageIcon,
  LayoutTemplate, Palette, Eye, GitBranch, Download
} from "lucide-react";
import { TemplateLibrary } from "./studio/TemplateLibrary";
import { DesignPreview } from "./studio/DesignPreview";
import { VersionCompare } from "./studio/VersionCompare";
import { ApprovalFlow } from "./studio/ApprovalFlow";
import { BrandKitManager } from "./studio/BrandKitManager";
import { ExportOptions } from "./studio/ExportOptions";

interface StitchDesign {
  id: string;
  prompt: string;
  preview_url: string | null;
  html_code: string | null;
  figma_export_url: string | null;
  model_used: string | null;
  project_id_stitch: string | null;
  screen_id: string | null;
  parent_design_id: string | null;
  version_number: number;
  status: string;
  created_at: string;
}

export const StitchDesignStudio = ({ initialTab }: { initialTab?: string }) => {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<"flash" | "pro">("flash");
  const [projectType, setProjectType] = useState<"web" | "mobile">("web");
  const [loading, setLoading] = useState(false);
  const [designs, setDesigns] = useState<StitchDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(true);
  const [previewDesign, setPreviewDesign] = useState<StitchDesign | null>(null);
  const [compareDesigns, setCompareDesigns] = useState<StitchDesign[] | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab || "gerar");

  useEffect(() => {
    loadDesigns();
  }, []);

  const loadDesigns = async () => {
    try {
      const { data, error } = await supabase
        .from("stitch_designs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setDesigns((data as StitchDesign[]) || []);
    } catch (err) {
      console.error("Erro ao carregar designs:", err);
    } finally {
      setLoadingDesigns(false);
    }
  };

  // Build brand kit context for prompt
  const getBrandKitContext = async (): Promise<string> => {
    try {
      const { data } = await supabase
        .from("brand_kits")
        .select("cores_primarias, cores_secundarias, fontes, diretrizes_visuais")
        .eq("is_default", true)
        .limit(1);
      if (!data?.[0]) return "";
      const kit = data[0] as { cores_primarias: string[]; cores_secundarias: string[]; fontes: string[]; diretrizes_visuais: string | null };
      const parts: string[] = [];
      if (kit.cores_primarias?.length) parts.push(`Use as cores primárias: ${kit.cores_primarias.join(", ")}`);
      if (kit.cores_secundarias?.length) parts.push(`Cores secundárias: ${kit.cores_secundarias.join(", ")}`);
      if (kit.fontes?.length) parts.push(`Fontes: ${kit.fontes.join(", ")}`);
      if (kit.diretrizes_visuais) parts.push(kit.diretrizes_visuais);
      return parts.length > 0 ? `\n\nDiretrizes de marca: ${parts.join(". ")}` : "";
    } catch {
      return "";
    }
  };

  const handleGenerate = async (parentId?: string) => {
    if (!prompt.trim()) {
      toast.error("Digite um prompt para gerar o design");
      return;
    }
    setLoading(true);
    try {
      const brandContext = await getBrandKitContext();
      const fullPrompt = prompt.trim() + brandContext;

      const { data: projectData, error: projectError } = await supabase.functions.invoke("stitch-proxy", {
        body: { action: "create_project", name: `Design ${new Date().toLocaleString("pt-BR")}`, type: projectType },
      });
      if (projectError) throw projectError;

      const projectId = projectData?.data?.result?.content?.[0]?.text;
      let parsedProjectId = "default";
      try {
        if (projectId) {
          const parsed = JSON.parse(projectId);
          parsedProjectId = parsed.project_id || "default";
        }
      } catch { /* use default */ }

      const { error } = await supabase.functions.invoke("stitch-proxy", {
        body: { action: "generate_screen", project_id: parsedProjectId, prompt: fullPrompt, model },
      });
      if (error) throw error;

      // If variation, update parent link
      if (parentId) {
        const parentDesign = designs.find((d) => d.id === parentId);
        const versionCount = designs.filter((d) => d.parent_design_id === parentId || d.id === parentId).length;
        // The stitch-proxy already saved the design; we'll update it on next load
      }

      toast.success("Design gerado com sucesso!");
      setPrompt("");
      loadDesigns();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao gerar design";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("stitch_designs").delete().eq("id", id);
      if (error) throw error;
      toast.success("Design removido");
      setDesigns((prev) => prev.filter((d) => d.id !== id));
      if (previewDesign?.id === id) setPreviewDesign(null);
    } catch {
      toast.error("Erro ao remover design");
    }
  };

  const handleSelectTemplate = (templatePrompt: string) => {
    setPrompt(templatePrompt);
    setActiveTab("gerar");
    toast.success("Template carregado! Ajuste o prompt e clique em Gerar.");
  };

  const handleGenerateVariation = (design: StitchDesign) => {
    setPrompt(design.prompt + "\n\nGere uma variação visual diferente mantendo o mesmo conceito.");
    setActiveTab("gerar");
    toast.info("Prompt de variação carregado. Clique em Gerar Design.");
  };

  const handleStatusChange = (designId: string, newStatus: string) => {
    setDesigns((prev) => prev.map((d) => d.id === designId ? { ...d, status: newStatus } : d));
  };

  const statusColors: Record<string, string> = {
    rascunho: "secondary",
    em_revisao: "default",
    aprovado: "default",
    publicado: "default",
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="gerar" className="text-xs"><Wand2 className="h-3 w-3 mr-1" /> Gerar</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs"><LayoutTemplate className="h-3 w-3 mr-1" /> Templates</TabsTrigger>
          <TabsTrigger value="galeria" className="text-xs"><ImageIcon className="h-3 w-3 mr-1" /> Galeria</TabsTrigger>
          <TabsTrigger value="brandkit" className="text-xs"><Palette className="h-3 w-3 mr-1" /> Brand Kit</TabsTrigger>
          <TabsTrigger value="versoes" className="text-xs"><GitBranch className="h-3 w-3 mr-1" /> Versões</TabsTrigger>
        </TabsList>

        {/* TAB: Generate */}
        <TabsContent value="gerar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" /> Google Stitch — Design Studio
              </CardTitle>
              <CardDescription>Gere interfaces, mockups e layouts com IA. Brand Kit aplicado automaticamente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Select value={model} onValueChange={(v) => setModel(v as "flash" | "pro")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flash">Flash (rápido)</SelectItem>
                      <SelectItem value="pro">Pro (alta qualidade)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Projeto</Label>
                  <Select value={projectType} onValueChange={(v) => setProjectType(v as "web" | "mobile")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web">Web</SelectItem>
                      <SelectItem value="mobile">App Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prompt</Label>
                <Textarea
                  placeholder="Ex: Crie uma landing page moderna para cosméticos naturais..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                />
              </div>
              <Button onClick={() => handleGenerate()} disabled={loading || !prompt.trim()} className="w-full">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : <><Wand2 className="h-4 w-4 mr-2" /> Gerar Design</>}
              </Button>
            </CardContent>
          </Card>

          {/* Live Preview */}
          {previewDesign && (
            <DesignPreview htmlCode={previewDesign.html_code} onClose={() => setPreviewDesign(null)} />
          )}
        </TabsContent>

        {/* TAB: Templates */}
        <TabsContent value="templates">
          <TemplateLibrary onSelectTemplate={handleSelectTemplate} />
        </TabsContent>

        {/* TAB: Gallery */}
        <TabsContent value="galeria" className="space-y-4">
          {/* Compare Mode */}
          {compareDesigns && (
            <VersionCompare designs={compareDesigns} onClose={() => setCompareDesigns(null)} />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Galeria de Designs</CardTitle>
              <CardDescription>{designs.length} design(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDesigns ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : designs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum design gerado. Use a aba "Gerar" para criar!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {designs.map((design) => (
                    <Card key={design.id} className="overflow-hidden">
                      {design.preview_url ? (
                        <img src={design.preview_url} alt={design.prompt} className="w-full h-40 object-cover cursor-pointer" loading="lazy" onClick={() => setPreviewDesign(design)} />
                      ) : design.html_code ? (
                        <div className="w-full h-40 cursor-pointer relative group" onClick={() => setPreviewDesign(design)}>
                          <iframe
                            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://cdn.jsdelivr.net/npm/tailwindcss@2/dist/tailwind.min.css" rel="stylesheet"><style>body{margin:0;transform:scale(0.3);transform-origin:0 0;width:333%;height:333%;}</style></head><body>${design.html_code}</body></html>`}
                            className="w-full h-full border-0 pointer-events-none"
                            sandbox=""
                            title="Thumbnail"
                          />
                          <div className="absolute inset-0 bg-background/0 group-hover:bg-background/30 transition-colors flex items-center justify-center">
                            <Eye className="h-6 w-6 text-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-40 bg-muted flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <CardContent className="p-3 space-y-2">
                        <p className="text-xs line-clamp-2">{design.prompt}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">{design.model_used || "flash"}</Badge>
                          <Badge variant={statusColors[design.status] as "secondary" | "default"} className="text-xs">{design.status}</Badge>
                          {design.version_number > 1 && <Badge variant="outline" className="text-xs">V{design.version_number}</Badge>}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(design.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setPreviewDesign(design)}>
                            <Eye className="h-3 w-3 mr-1" /> Preview
                          </Button>
                          {design.html_code && (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleCopyCode(design.html_code!)}>
                              <Copy className="h-3 w-3 mr-1" /> HTML
                            </Button>
                          )}
                          <ExportOptions htmlCode={design.html_code} designId={design.id} />
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleGenerateVariation(design)}>
                            <GitBranch className="h-3 w-3 mr-1" /> Variação
                          </Button>
                          {design.figma_export_url && (
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => window.open(design.figma_export_url!, "_blank")}>
                              <ExternalLink className="h-3 w-3 mr-1" /> Figma
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-xs h-7 ml-auto text-destructive" onClick={() => handleDelete(design.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Inline Approval */}
                        <ApprovalFlow designId={design.id} currentStatus={design.status} onStatusChange={(s) => handleStatusChange(design.id, s)} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: Brand Kit */}
        <TabsContent value="brandkit">
          <BrandKitManager />
        </TabsContent>

        {/* TAB: Versions */}
        <TabsContent value="versoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" /> Comparação de Versões
              </CardTitle>
              <CardDescription>Selecione 2 designs para comparar lado a lado</CardDescription>
            </CardHeader>
            <CardContent>
              {designs.length < 2 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Gere pelo menos 2 designs para usar a comparação.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {designs.map((d) => (
                      <Card
                        key={d.id}
                        className={`cursor-pointer transition-all ${compareDesigns?.some((cd) => cd.id === d.id) ? "ring-2 ring-primary" : ""}`}
                        onClick={() => {
                          if (!compareDesigns) {
                            setCompareDesigns([d]);
                          } else if (compareDesigns.length === 1) {
                            if (compareDesigns[0].id !== d.id) {
                              setCompareDesigns([compareDesigns[0], d]);
                            }
                          } else {
                            setCompareDesigns([d]);
                          }
                        }}
                      >
                        <CardContent className="p-3">
                          <p className="text-xs line-clamp-2 font-medium">{d.prompt}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">V{d.version_number}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(d.created_at).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {compareDesigns && compareDesigns.length === 2 && (
                    <VersionCompare designs={compareDesigns} onClose={() => setCompareDesigns(null)} />
                  )}
                  {compareDesigns && compareDesigns.length === 1 && (
                    <p className="text-sm text-muted-foreground text-center">Selecione mais 1 design para comparar</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
