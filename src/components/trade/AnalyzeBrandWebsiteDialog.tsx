import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Globe, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AnalyzeBrandWebsiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brandId: string;
  brandName: string;
  onSuccess: () => void;
}

export function AnalyzeBrandWebsiteDialog({ 
  open, 
  onOpenChange, 
  brandId, 
  brandName,
  onSuccess 
}: AnalyzeBrandWebsiteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [result, setResult] = useState<any>(null);

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

    try {
      console.log('🚀 Iniciando análise do site:', websiteUrl);
      
      const { data, error } = await supabase.functions.invoke('analyze-brand-website', {
        body: {
          brand_id: brandId,
          website_url: websiteUrl,
        }
      });

      if (error) {
        console.error('Erro da função:', error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('✅ Análise concluída:', data);
      setResult(data);
      
      toast.success(
        `Análise concluída! ${data.products_count} produtos encontrados.`,
        { duration: 5000 }
      );
      
      onSuccess();
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

        <div className="space-y-4 py-4">
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
              A IA irá acessar o site, extrair informações sobre a marca e produtos, e atualizar automaticamente no sistema.
            </p>
          </div>

          {loading && (
            <Card className="p-4 bg-muted/50">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Processando...</p>
                  <p className="text-xs text-muted-foreground">
                    Coletando conteúdo do site e analisando com IA. Isso pode levar alguns segundos.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {result && (
            <Card className="p-4 space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  ✅ Análise Concluída
                </h4>
                
                <div className="space-y-3">
                  {result.brand?.description && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Descrição da Marca:</p>
                      <p className="text-sm">{result.brand.description.substring(0, 200)}...</p>
                    </div>
                  )}

                  {result.brand?.categories && result.brand.categories.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Categorias:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.brand.categories.map((cat: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Produtos Encontrados:</p>
                    <p className="text-2xl font-bold text-primary">{result.products_count}</p>
                  </div>

                  {result.products && result.products.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Primeiros produtos:</p>
                      <ul className="text-sm space-y-1">
                        {result.products.slice(0, 5).map((product: any, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-muted-foreground">•</span>
                            <span>
                              <strong>{product.name}</strong>
                              {product.category && (
                                <span className="text-muted-foreground"> - {product.category}</span>
                              )}
                            </span>
                          </li>
                        ))}
                        {result.products.length > 5 && (
                          <li className="text-muted-foreground text-xs">
                            ... e mais {result.products.length - 5} produtos
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={handleClose} className="w-full">
                Concluir
              </Button>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
