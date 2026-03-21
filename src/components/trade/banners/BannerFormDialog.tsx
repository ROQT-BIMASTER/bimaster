import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useCreateBanner, useUpdateBanner, type TradeBanner } from "@/hooks/useTradeBanners";
import { Upload, Image as ImageIcon, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editBanner?: TradeBanner | null;
}

export function BannerFormDialog({ open, onOpenChange, editBanner }: Props) {
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const [uploading, setUploading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [useAiOptimize, setUseAiOptimize] = useState(false);
  const [aiWidth, setAiWidth] = useState("1200");
  const [aiHeight, setAiHeight] = useState("400");
  const [aiQuality, setAiQuality] = useState("alta");
  const [form, setForm] = useState({
    titulo: "",
    imagem_url: "",
    link_destino: "",
    posicao: 0,
    data_inicio: new Date().toISOString().slice(0, 16),
    data_fim: "",
    ativo: true,
  });

  useEffect(() => {
    if (editBanner) {
      setForm({
        titulo: editBanner.titulo,
        imagem_url: editBanner.imagem_url,
        link_destino: editBanner.link_destino || "",
        posicao: editBanner.posicao,
        data_inicio: editBanner.data_inicio.slice(0, 16),
        data_fim: editBanner.data_fim?.slice(0, 16) || "",
        ativo: editBanner.ativo,
      });
    } else {
      setForm({
        titulo: "",
        imagem_url: "",
        link_destino: "",
        posicao: 0,
        data_inicio: new Date().toISOString().slice(0, 16),
        data_fim: "",
        ativo: true,
      });
    }
    setUseAiOptimize(false);
  }, [editBanner, open]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(",");
    const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png";
    const bytes = atob(parts[1]);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  const optimizeWithAI = async (base64: string): Promise<string> => {
    setOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("optimize-banner-image", {
        body: {
          imageBase64: base64,
          width: parseInt(aiWidth),
          height: parseInt(aiHeight),
          quality: aiQuality,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("Rate limit")) {
          toast.error("Limite de requisições excedido. Tente novamente em alguns segundos.");
        } else if (data.error.includes("Credits")) {
          toast.error("Créditos de IA esgotados.");
        } else {
          throw new Error(data.error);
        }
        return base64;
      }

      toast.success("Imagem otimizada com IA!");
      return data.optimizedImage;
    } catch (err) {
      console.error("AI optimization failed:", err);
      toast.error("Falha na otimização com IA. Usando imagem original.");
      return base64;
    } finally {
      setOptimizing(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      let fileToUpload: File | Blob = file;

      if (useAiOptimize) {
        const base64 = await fileToBase64(file);
        const optimizedBase64 = await optimizeWithAI(base64);
        if (optimizedBase64 !== base64) {
          fileToUpload = base64ToBlob(optimizedBase64);
        }
      }

      const ext = file.name.split(".").pop() || "png";
      const path = `${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("trade-banners").upload(path, fileToUpload);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("trade-banners").getPublicUrl(path);
      setForm(f => ({ ...f, imagem_url: publicUrl }));
      toast.success("Imagem enviada");
    } catch {
      toast.error("Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.titulo || !form.imagem_url) {
      toast.error("Preencha título e imagem");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      titulo: form.titulo,
      imagem_url: form.imagem_url,
      link_destino: form.link_destino || null,
      posicao: form.posicao,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      ativo: form.ativo,
      created_by: user?.id || null,
    };

    if (editBanner) {
      await updateBanner.mutateAsync({ id: editBanner.id, ...payload });
    } else {
      await createBanner.mutateAsync(payload as any);
    }
    onOpenChange(false);
  };

  const isProcessing = uploading || optimizing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editBanner ? "Editar Banner" : "Novo Banner"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
          </div>

          <div>
            <Label>Imagem</Label>
            {form.imagem_url && (
              <img src={form.imagem_url} alt="Preview" className="w-full h-32 object-cover rounded-xl mb-2" />
            )}
            <div className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-primary transition-colors">
              <label className="cursor-pointer flex flex-col items-center gap-2">
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {optimizing ? "Otimizando com IA..." : "Enviando..."}
                    </span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Clique ou arraste uma imagem</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={isProcessing} />
              </label>
            </div>
          </div>

          {/* AI Optimization Toggle */}
          <div className="rounded-xl border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <Checkbox
                id="ai-optimize"
                checked={useAiOptimize}
                onCheckedChange={(v) => setUseAiOptimize(v === true)}
              />
              <label htmlFor="ai-optimize" className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
                <Sparkles className="h-4 w-4 text-[hsl(330,81%,60%)]" />
                Otimizar imagem com IA
              </label>
            </div>

            {useAiOptimize && (
              <div className="space-y-3 pl-6">
                <p className="text-xs text-muted-foreground">
                  A IA ajustará o tamanho e a qualidade da imagem automaticamente ao fazer o upload.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Largura (px)</Label>
                    <Input
                      type="number"
                      value={aiWidth}
                      onChange={e => setAiWidth(e.target.value)}
                      placeholder="1200"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Altura (px)</Label>
                    <Input
                      type="number"
                      value={aiHeight}
                      onChange={e => setAiHeight(e.target.value)}
                      placeholder="400"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Qualidade</Label>
                  <Select value={aiQuality} onValueChange={setAiQuality}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="média">Média</SelectItem>
                      <SelectItem value="máxima">Máxima</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>Link de destino (opcional)</Label>
            <Input value={form.link_destino} onChange={e => setForm(f => ({ ...f, link_destino: e.target.value }))} placeholder="https://... ou /dashboard/..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="datetime-local" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            </div>
            <div>
              <Label>Fim (opcional)</Label>
              <Input type="datetime-local" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Posição</Label>
              <Input type="number" value={form.posicao} onChange={e => setForm(f => ({ ...f, posicao: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
              <Label>Ativo</Label>
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] text-white hover:brightness-110" disabled={createBanner.isPending || updateBanner.isPending || isProcessing}>
            {editBanner ? "Salvar Alterações" : "Criar Banner"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
