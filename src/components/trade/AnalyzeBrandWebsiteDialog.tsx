import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Globe, Sparkles, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

interface AnalyzeBrandWebsiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  brandName: string;
  onSuccess: () => void;
}

interface AnalysisResult {
  brand: {
    description: string;
    mission?: string;
    categories?: string[];
  };
  products: Array<{
    name: string;
    description?: string;
    category: string;
    sku?: string;
  }>;
  products_count: number;
}

export function AnalyzeBrandWebsiteDialog({ 
  open, 
  onOpenChange, 
  brandId, 
  brandName,
  onSuccess 
}: AnalyzeBrandWebsiteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const handleAnalyze = async () => {
    if (!websiteUrl.trim()) {
      toast.error("Digite a URL do site da marca");
      return;
    }

    // Validar URL
    try {
      new URL(websiteUrl);
    } catch {
      toast.error("URL inválida. Use o formato: https://exemplo.com");
      return;
    }

    setLoading(true);
    setResult(null);
    setProgress(0);

    try {
      console.log('🚀 Iniciando análise do site:', websiteUrl);
      
      // Simulação de progresso
      setStatusMessage("Conectando ao site...");
      setProgress(10);
      
      // Timeout de 60 segundos
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: A análise está demorando muito. Tente um site menor ou tente novamente.')), 60000)
      );
      
      const analysisPromise = (async () => {
        setStatusMessage("Coletando conteúdo do site...");
        setProgress(30);
        
        const { data, error } = await supabase.functions.invoke('analyze-brand-website', {
          body: { website_url: websiteUrl }
        });
        
        setStatusMessage("Processando com IA...");
        setProgress(70);
        
        return { data, error };
      })();
      
      const { data, error } = await Promise.race([analysisPromise, timeoutPromise]) as any;

      if (error) {
        console.error('Erro da função:', error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setStatusMessage("Finalizando análise...");
      setProgress(100);
      
      console.log('✅ Análise concluída:', data);
      setResult(data);
      
      toast.success(
        `Análise concluída! ${data.products_count} produtos encontrados.`,
        { duration: 4000 }
      );
    } catch (error: any) {
      console.error("Erro ao analisar site:", error);
      
      if (error.message?.includes('429')) {
        toast.error("Limite de requisições excedido. Aguarde alguns instantes e tente novamente.");
      } else if (error.message?.includes('402')) {
        toast.error("Créditos insuficientes. Adicione créditos em Configurações.");
      } else {
        toast.error(error.message || "Erro ao analisar site da marca");
      }
    } finally {
      setLoading(false);
      setProgress(0);
      setStatusMessage("");
    }
  };

  const handleSave = async () => {
    if (!result) return;

    setSaving(true);
    try {
      console.log('💾 Salvando dados no banco...');
      
      const { data, error } = await supabase.functions.invoke('save-brand-analysis', {
        body: {
          brand_id: brandId,
          brand_data: result.brand,
          products: result.products,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        `Dados salvos com sucesso! ${data.products_inserted} produtos cadastrados.`,
        { duration: 4000 }
      );
      
      onSuccess();
      handleClose();
      
    } catch (error: any) {
      console.error("Erro ao salvar:", error);
      toast.error(error.message || "Erro ao salvar dados");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setWebsiteUrl("");
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Analisar Site da Marca com IA
          </DialogTitle>
          <DialogDescription>
            Cole a URL do site de <strong>{brandName}</strong> para extrair automaticamente informações sobre a marca e seus produtos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input de URL */}
          {!result && (
            <div className="space-y-2">
              <Label htmlFor="website">URL do Site</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://exemplo.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    disabled={loading}
                    className="pl-10"
                  />
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={loading || !websiteUrl.trim()}
                  className="min-w-[120px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analisar
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                A IA irá acessar o site e extrair informações sobre a marca e produtos.
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <Card className="p-6 bg-muted/50">
              <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="space-y-2 w-full">
                  <p className="text-sm font-medium">{statusMessage || "Processando site..."}</p>
                  <Progress value={progress} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    {progress < 30 && "Acessando o site e coletando informações..."}
                    {progress >= 30 && progress < 70 && "Extraindo conteúdo da página..."}
                    {progress >= 70 && progress < 100 && "Analisando com IA e estruturando dados..."}
                    {progress === 100 && "Análise concluída!"}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Resultados da Análise */}
          {result && !loading && (
            <ScrollArea className="h-[50vh]">
              <div className="space-y-4 pr-4">
                <Card className="p-4 border-primary/20 bg-primary/5">
                  <div className="flex items-start gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-sm">Análise Concluída</h4>
                      <p className="text-xs text-muted-foreground">
                        Revise os dados extraídos antes de salvar
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Informações da Marca */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    📋 Descrição da Marca
                  </h4>
                  <Card className="p-4">
                    <p className="text-sm whitespace-pre-wrap">{result.brand.description}</p>
                    
                    {result.brand.mission && (
                      <>
                        <Separator className="my-3" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Missão:</p>
                          <p className="text-sm">{result.brand.mission}</p>
                        </div>
                      </>
                    )}

                    {result.brand.categories && result.brand.categories.length > 0 && (
                      <>
                        <Separator className="my-3" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Categorias:</p>
                          <div className="flex flex-wrap gap-1">
                            {result.brand.categories.map((cat: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </Card>
                </div>

                {/* Produtos Encontrados */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    🛍️ Produtos Encontrados ({result.products_count})
                  </h4>
                  
                  {result.products.length === 0 ? (
                    <Card className="p-4">
                      <p className="text-sm text-muted-foreground text-center">
                        Nenhum produto foi encontrado no site
                      </p>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {result.products.map((product: any, idx: number) => (
                        <Card key={idx} className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="font-medium text-sm">{product.name}</h5>
                              <Badge variant="outline" className="text-xs">
                                {product.category}
                              </Badge>
                            </div>
                            
                            {product.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {product.description}
                              </p>
                            )}
                            
                            {product.sku && (
                              <p className="text-xs text-muted-foreground">
                                SKU: {product.sku}
                              </p>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-2 pt-2 sticky bottom-0 bg-background pb-2">
                  <Button
                    onClick={handleClose}
                    variant="outline"
                    className="flex-1"
                    disabled={saving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Descartar
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="flex-1"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Salvar Dados
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
