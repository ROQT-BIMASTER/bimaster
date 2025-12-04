import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Palette, Sparkles, Image, Wand2, Download, Copy, 
  Instagram, FileImage, Mail, Video, Loader2, Check,
  Layout, Type, RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Template {
  id: string;
  tipo: string;
  nome: string;
  descricao: string;
  preview_url?: string;
}

const taskTypeConfig: Record<string, { icon: React.ReactNode; color: string; ratio: string }> = {
  post_instagram: { icon: <Instagram className="h-4 w-4" />, color: "bg-pink-500", ratio: "1:1" },
  post_tiktok: { icon: <Video className="h-4 w-4" />, color: "bg-black", ratio: "9:16" },
  catalogo: { icon: <FileImage className="h-4 w-4" />, color: "bg-blue-500", ratio: "A4" },
  email: { icon: <Mail className="h-4 w-4" />, color: "bg-green-500", ratio: "600px" },
  banner: { icon: <Layout className="h-4 w-4" />, color: "bg-purple-500", ratio: "16:9" },
  arte: { icon: <Palette className="h-4 w-4" />, color: "bg-amber-500", ratio: "Livre" }
};

function AIImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const generateImage = async () => {
    if (!prompt.trim()) {
      toast.error("Digite uma descrição para a imagem");
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-marketing-image', {
        body: { prompt, style: 'professional' }
      });

      if (error) throw error;
      
      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success("Imagem gerada com sucesso!");
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error("Erro ao gerar imagem. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Descreva a imagem que deseja criar</label>
        <Textarea
          placeholder="Ex: Uma foto profissional de produto cosmético em fundo branco com iluminação suave..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={generateImage} disabled={generating} className="flex-1">
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Gerar com IA
            </>
          )}
        </Button>
        <Button variant="outline" onClick={() => setPrompt("")}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {generatedImage && (
        <div className="relative rounded-lg overflow-hidden border">
          <img src={generatedImage} alt="Generated" className="w-full" />
          <div className="absolute bottom-2 right-2 flex gap-2">
            <Button size="sm" variant="secondary">
              <Download className="h-4 w-4 mr-1" />
              Baixar
            </Button>
            <Button size="sm" variant="secondary">
              <Copy className="h-4 w-4 mr-1" />
              Usar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateSelector({ onSelect }: { onSelect: (template: Template) => void }) {
  const templates: Template[] = [
    { id: '1', tipo: 'post_instagram', nome: 'Post Produto', descricao: 'Template para destaque de produto' },
    { id: '2', tipo: 'post_instagram', nome: 'Carrossel', descricao: 'Template para posts múltiplos' },
    { id: '3', tipo: 'banner', nome: 'Banner Promocional', descricao: 'Para campanhas e promoções' },
    { id: '4', tipo: 'email', nome: 'Newsletter', descricao: 'Template de email marketing' },
    { id: '5', tipo: 'catalogo', nome: 'Ficha Técnica', descricao: 'Apresentação de produto' }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {templates.map(template => {
        const config = taskTypeConfig[template.tipo] || taskTypeConfig.arte;
        return (
          <div
            key={template.id}
            className="p-3 rounded-lg border bg-card hover:border-primary cursor-pointer transition-all"
            onClick={() => onSelect(template)}
          >
            <div className={cn(
              "w-full aspect-video rounded-md mb-2 flex items-center justify-center",
              config.color, "bg-opacity-10"
            )}>
              {config.icon}
            </div>
            <h4 className="font-medium text-sm">{template.nome}</h4>
            <p className="text-[10px] text-muted-foreground">{template.descricao}</p>
            <Badge variant="outline" className="mt-1 text-[10px]">
              {config.ratio}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

function QuickPrompts() {
  const prompts = [
    "Foto profissional de produto cosmético",
    "Banner promocional com desconto",
    "Imagem lifestyle com modelo",
    "Background abstrato moderno",
    "Composição flat lay de produtos"
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((prompt, i) => (
        <Badge 
          key={i} 
          variant="secondary" 
          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          {prompt}
        </Badge>
      ))}
    </div>
  );
}

export function CreativeHub() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Creative Hub
          <Badge variant="secondary" className="ml-2 text-[10px]">
            <Sparkles className="h-3 w-3 mr-1" />
            IA Integrada
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="generator" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="generator" className="text-xs">
              <Wand2 className="h-3 w-3 mr-1" />
              Gerador IA
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">
              <Layout className="h-3 w-3 mr-1" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="assets" className="text-xs">
              <Image className="h-3 w-3 mr-1" />
              Assets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generator" className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Sugestões rápidas</h4>
              <QuickPrompts />
            </div>
            <AIImageGenerator />
          </TabsContent>

          <TabsContent value="templates">
            <ScrollArea className="h-[400px]">
              <TemplateSelector onSelect={setSelectedTemplate} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="assets">
            <div className="text-center py-12 text-muted-foreground">
              <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Biblioteca de assets em desenvolvimento</p>
              <p className="text-sm">Em breve: fotos de produtos, logos, elementos gráficos</p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
