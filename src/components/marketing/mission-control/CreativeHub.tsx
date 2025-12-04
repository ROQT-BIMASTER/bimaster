import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Palette, Sparkles, Image, Wand2, Download, Copy, 
  Instagram, FileImage, Mail, Video, Loader2, Check,
  Layout, Type, RefreshCw, Upload, Trash2, Eye, X,
  FileVideo, File, Filter, Search, Plus, FolderOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Template {
  id: string;
  tipo: string;
  nome: string;
  descricao: string;
  preview_url?: string;
}

interface MarketingAsset {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  storage_path: string;
  url_publica: string;
  tamanho_bytes: number | null;
  mime_type: string | null;
  lancamento_id: string | null;
  tarefa_id: string | null;
  tags: string[] | null;
  uploaded_by: string | null;
  created_at: string;
  lancamento?: { nome_lancamento: string } | null;
}

const taskTypeConfig: Record<string, { icon: React.ReactNode; color: string; ratio: string }> = {
  post_instagram: { icon: <Instagram className="h-4 w-4" />, color: "bg-pink-500", ratio: "1:1" },
  post_tiktok: { icon: <Video className="h-4 w-4" />, color: "bg-black", ratio: "9:16" },
  catalogo: { icon: <FileImage className="h-4 w-4" />, color: "bg-blue-500", ratio: "A4" },
  email: { icon: <Mail className="h-4 w-4" />, color: "bg-green-500", ratio: "600px" },
  banner: { icon: <Layout className="h-4 w-4" />, color: "bg-purple-500", ratio: "16:9" },
  arte: { icon: <Palette className="h-4 w-4" />, color: "bg-amber-500", ratio: "Livre" }
};

const assetTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  imagem: { icon: <Image className="h-4 w-4" />, label: "Imagem", color: "bg-blue-500" },
  video: { icon: <FileVideo className="h-4 w-4" />, label: "Vídeo", color: "bg-purple-500" },
  catalogo: { icon: <FileImage className="h-4 w-4" />, label: "Catálogo", color: "bg-amber-500" },
  arte: { icon: <Palette className="h-4 w-4" />, label: "Arte", color: "bg-pink-500" },
  documento: { icon: <File className="h-4 w-4" />, label: "Documento", color: "bg-gray-500" }
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

function UploadAssetDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    tipo: "imagem",
    lancamento_id: ""
  });

  const { data: lancamentos } = useQuery({
    queryKey: ['lancamentos-for-upload'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos_produtos')
        .select('id, nome_lancamento')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(files);
    if (files.length === 1 && !formData.nome) {
      setFormData(prev => ({ ...prev, nome: files[0].name.split('.')[0] }));
    }
  }, [formData.nome]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      if (files.length === 1 && !formData.nome) {
        setFormData(prev => ({ ...prev, nome: files[0].name.split('.')[0] }));
      }
    }
  };

  const getFileType = (file: File): string => {
    if (file.type.startsWith('image/')) return 'imagem';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type === 'application/pdf') return 'catalogo';
    return 'documento';
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Selecione pelo menos um arquivo");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('marketing-assets')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('marketing-assets')
          .getPublicUrl(fileName);

        // Save metadata
        const tipo = selectedFiles.length === 1 ? formData.tipo : getFileType(file);
        const nome = selectedFiles.length === 1 ? formData.nome : file.name.split('.')[0];

        const { error: insertError } = await supabase
          .from('marketing_assets')
          .insert({
            nome,
            descricao: formData.descricao || null,
            tipo,
            storage_path: fileName,
            url_publica: publicUrl,
            tamanho_bytes: file.size,
            mime_type: file.type,
            lancamento_id: formData.lancamento_id || null,
            uploaded_by: user.id
          });

        if (insertError) throw insertError;
      }

      toast.success(`${selectedFiles.length} arquivo(s) enviado(s) com sucesso!`);
      setOpen(false);
      setSelectedFiles([]);
      setFormData({ nome: "", descricao: "", tipo: "imagem", lancamento_id: "" });
      onSuccess();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Erro ao fazer upload dos arquivos");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload de Assets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload de Assets</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
              "hover:border-primary/50 cursor-pointer"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input
              id="file-upload"
              type="file"
              multiple
              accept="image/*,video/*,application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Arraste arquivos ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">
              Imagens, Vídeos e PDFs (máx. 50MB)
            </p>
          </div>

          {/* Selected files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Arquivos selecionados ({selectedFiles.length})</Label>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm">
                    {file.type.startsWith('image/') && <Image className="h-4 w-4" />}
                    {file.type.startsWith('video/') && <FileVideo className="h-4 w-4" />}
                    {file.type === 'application/pdf' && <FileImage className="h-4 w-4" />}
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {(file.size / 1024 / 1024).toFixed(1)}MB
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFiles(prev => prev.filter((_, idx) => idx !== i));
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form fields (only for single file) */}
          {selectedFiles.length === 1 && (
            <>
              <div className="space-y-2">
                <Label>Nome do asset</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome do arquivo"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(assetTypeConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          {config.icon}
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Descrição do asset"
                  rows={2}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Vincular a lançamento (opcional)</Label>
            <Select
              value={formData.lancamento_id}
              onValueChange={(v) => setFormData(prev => ({ ...prev, lancamento_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um lançamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {lancamentos?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome_lancamento}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={uploading || selectedFiles.length === 0}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Enviar {selectedFiles.length > 0 && `(${selectedFiles.length})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssetGallery() {
  const queryClient = useQueryClient();
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [previewAsset, setPreviewAsset] = useState<MarketingAsset | null>(null);

  const { data: assets, isLoading, refetch } = useQuery({
    queryKey: ['marketing-assets', filterTipo, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('marketing_assets')
        .select(`
          *,
          lancamento:lancamentos_produtos(nome_lancamento)
        `)
        .order('created_at', { ascending: false });

      if (filterTipo !== "all") {
        query = query.eq('tipo', filterTipo);
      }

      if (searchTerm) {
        query = query.ilike('nome', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MarketingAsset[];
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (asset: MarketingAsset) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('marketing-assets')
        .remove([asset.storage_path]);
      
      if (storageError) console.error('Storage delete error:', storageError);

      // Delete metadata
      const { error } = await supabase
        .from('marketing_assets')
        .delete()
        .eq('id', asset.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-assets'] });
      toast.success("Asset excluído com sucesso");
    },
    onError: () => {
      toast.error("Erro ao excluir asset");
    }
  });

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const isImage = (mime: string | null) => mime?.startsWith('image/');
  const isVideo = (mime: string | null) => mime?.startsWith('video/');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(assetTypeConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    {config.icon}
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <UploadAssetDialog onSuccess={refetch} />
      </div>

      {/* Gallery */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
        </div>
      ) : assets?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Nenhum asset encontrado</p>
          <p className="text-sm">Faça upload de imagens, vídeos ou catálogos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets?.map((asset) => {
            const config = assetTypeConfig[asset.tipo] || assetTypeConfig.documento;
            return (
              <div
                key={asset.id}
                className="group relative rounded-lg border bg-card overflow-hidden hover:shadow-md transition-all"
              >
                {/* Preview */}
                <div 
                  className="aspect-square bg-muted flex items-center justify-center cursor-pointer"
                  onClick={() => setPreviewAsset(asset)}
                >
                  {isImage(asset.mime_type) ? (
                    <img
                      src={asset.url_publica}
                      alt={asset.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : isVideo(asset.mime_type) ? (
                    <video
                      src={asset.url_publica}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className={cn("p-4 rounded-full", config.color, "bg-opacity-10")}>
                      {config.icon}
                    </div>
                  )}
                </div>

                {/* Actions overlay */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 w-7 p-0"
                    onClick={() => setPreviewAsset(asset)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = asset.url_publica;
                      a.download = asset.nome;
                      a.click();
                    }}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      if (confirm('Excluir este asset?')) {
                        deleteMutation.mutate(asset);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* Type badge */}
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {config.label}
                  </Badge>
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className="text-sm font-medium truncate">{asset.nome}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {formatFileSize(asset.tamanho_bytes)}
                    </span>
                    {asset.lancamento && (
                      <Badge variant="outline" className="text-[9px] px-1">
                        🚀 {asset.lancamento.nome_lancamento}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewAsset} onOpenChange={() => setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewAsset?.nome}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center">
            {previewAsset && isImage(previewAsset.mime_type) && (
              <img
                src={previewAsset.url_publica}
                alt={previewAsset.nome}
                className="max-h-[70vh] rounded-lg"
              />
            )}
            {previewAsset && isVideo(previewAsset.mime_type) && (
              <video
                src={previewAsset.url_publica}
                controls
                className="max-h-[70vh] rounded-lg"
              />
            )}
            {previewAsset && !isImage(previewAsset.mime_type) && !isVideo(previewAsset.mime_type) && (
              <div className="text-center py-12">
                <FileImage className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <Button onClick={() => window.open(previewAsset.url_publica, '_blank')}>
                  <Eye className="h-4 w-4 mr-2" />
                  Abrir em nova aba
                </Button>
              </div>
            )}
          </div>
          {previewAsset?.descricao && (
            <p className="text-sm text-muted-foreground mt-2">{previewAsset.descricao}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
            <span>Tamanho: {formatFileSize(previewAsset?.tamanho_bytes || 0)}</span>
            <span>Tipo: {previewAsset?.mime_type}</span>
            <span>
              Upload: {previewAsset?.created_at && format(new Date(previewAsset.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          </div>
        </DialogContent>
      </Dialog>
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
        <Tabs defaultValue="assets" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="assets" className="text-xs">
              <Image className="h-3 w-3 mr-1" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="generator" className="text-xs">
              <Wand2 className="h-3 w-3 mr-1" />
              Gerador IA
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">
              <Layout className="h-3 w-3 mr-1" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assets">
            <AssetGallery />
          </TabsContent>

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
        </Tabs>
      </CardContent>
    </Card>
  );
}
