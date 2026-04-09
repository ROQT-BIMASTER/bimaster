import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Wand2, Copy, ExternalLink, Trash2, Image as ImageIcon } from "lucide-react";

interface StitchDesign {
  id: string;
  prompt: string;
  preview_url: string | null;
  html_code: string | null;
  figma_export_url: string | null;
  model_used: string | null;
  project_id_stitch: string | null;
  screen_id: string | null;
  created_at: string;
}

export const StitchDesignStudio = () => {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<"flash" | "pro">("flash");
  const [projectType, setProjectType] = useState<"web" | "mobile">("web");
  const [loading, setLoading] = useState(false);
  const [designs, setDesigns] = useState<StitchDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(true);

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

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Digite um prompt para gerar o design");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create project
      const { data: projectData, error: projectError } = await supabase.functions.invoke("stitch-proxy", {
        body: {
          action: "create_project",
          name: `Design ${new Date().toLocaleString("pt-BR")}`,
          type: projectType,
        },
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

      // Step 2: Generate screen
      const { data, error } = await supabase.functions.invoke("stitch-proxy", {
        body: {
          action: "generate_screen",
          project_id: parsedProjectId,
          prompt: prompt.trim(),
          model,
        },
      });

      if (error) throw error;

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
      const { error } = await supabase
        .from("stitch_designs")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Design removido");
      setDesigns((prev) => prev.filter((d) => d.id !== id));
    } catch {
      toast.error("Erro ao remover design");
    }
  };

  return (
    <div className="space-y-6">
      {/* Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Google Stitch — Design Studio
          </CardTitle>
          <CardDescription>
            Gere interfaces, mockups e layouts com IA usando prompts de texto. Powered by Gemini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={model} onValueChange={(v) => setModel(v as "flash" | "pro")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flash">Flash (rápido, 350/mês)</SelectItem>
                  <SelectItem value="pro">Pro (alta qualidade, 50/mês)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Projeto</Label>
              <Select value={projectType} onValueChange={(v) => setProjectType(v as "web" | "mobile")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              placeholder="Ex: Crie uma landing page moderna para uma marca de cosméticos naturais com hero section, grid de produtos e depoimentos..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
          </div>

          <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando design...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Gerar Design
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Gallery */}
      <Card>
        <CardHeader>
          <CardTitle>Galeria de Designs</CardTitle>
          <CardDescription>
            {designs.length} design(s) gerado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDesigns ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : designs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum design gerado ainda. Use o formulário acima para criar seu primeiro!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {designs.map((design) => (
                <Card key={design.id} className="overflow-hidden">
                  {design.preview_url ? (
                    <img
                      src={design.preview_url}
                      alt={design.prompt}
                      className="w-full h-48 object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm line-clamp-2">{design.prompt}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{design.model_used || "flash"}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(design.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {design.html_code && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyCode(design.html_code!)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          HTML
                        </Button>
                      )}
                      {design.figma_export_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(design.figma_export_url!, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Figma
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-destructive"
                        onClick={() => handleDelete(design.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
