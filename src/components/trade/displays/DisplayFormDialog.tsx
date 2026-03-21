import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, Image as ImageIcon, Wand2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TradeDisplay, useCreateDisplay, useUpdateDisplay } from "@/hooks/useTradeDisplays";

interface DisplayFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  display?: TradeDisplay | null;
}

const CATEGORIAS = [
  "Bandeja Híbrida",
  "Display de Chão",
  "Display Farma",
  "Display de Balcão",
  "Ponta de Gôndola",
  "Outro",
];

export function DisplayFormDialog({ open, onOpenChange, display }: DisplayFormDialogProps) {
  const createDisplay = useCreateDisplay();
  const updateDisplay = useUpdateDisplay();

  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [largura, setLargura] = useState("");
  const [profundidade, setProfundidade] = useState("");
  const [altura, setAltura] = useState("");
  const [material, setMaterial] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState("");
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (display) {
      setNome(display.nome);
      setCodigo(display.codigo || "");
      setDescricao(display.descricao || "");
      setCategoria(display.categoria || "");
      setLargura(display.largura_cm?.toString() || "");
      setProfundidade(display.profundidade_cm?.toString() || "");
      setAltura(display.altura_cm?.toString() || "");
      setMaterial(display.material || "");
      setAtivo(display.ativo);
      setFotoUrl(display.foto_url || "");
      setFotoPreview(display.foto_url || null);
    } else {
      setNome(""); setCodigo(""); setDescricao(""); setCategoria("");
      setLargura(""); setProfundidade(""); setAltura(""); setMaterial("");
      setAtivo(true); setFotoUrl(""); setFotoPreview(null);
    }
  }, [display, open]);

  const [optimizing, setOptimizing] = useState(false);

  const optimizeImageForBanner = async (base64: string): Promise<Blob | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("optimize-display-banner", {
        body: { imageBase64: base64 },
      });
      if (error) throw error;
      if (!data?.optimizedImage) throw new Error("No image returned");

      const b64 = data.optimizedImage.replace(/^data:image\/\w+;base64,/, "");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return new Blob([bytes], { type: "image/png" });
    } catch (err) {
      console.error("AI optimize failed:", err);
      return null;
    }
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setOptimizing(true);
    try {
      // Convert to base64 and optimize with AI
      const base64 = await fileToBase64(file);
      toast.info("🤖 Otimizando imagem com IA para formato banner...");
      const optimizedBlob = await optimizeImageForBanner(base64);

      const uploadFile = optimizedBlob || file;
      const ext = optimizedBlob ? "png" : file.name.split(".").pop();
      const path = `displays/${Date.now()}.${ext}`;
      
      const { error } = await supabase.storage.from("trade-banners").upload(path, uploadFile, { upsert: false });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("trade-banners").getPublicUrl(path);
      setFotoUrl(urlData.publicUrl);
      setFotoPreview(urlData.publicUrl);
      toast.success(optimizedBlob ? "Imagem otimizada e enviada ✨" : "Imagem enviada (otimização indisponível)");
    } catch {
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(false);
      setOptimizing(false);
    }
  };

  const handleOptimizeExisting = async () => {
    if (!fotoUrl) return;
    setOptimizing(true);
    try {
      toast.info("🤖 Otimizando imagem existente...");
      const { data, error } = await supabase.functions.invoke("optimize-display-banner", {
        body: { imageUrl: fotoUrl },
      });
      if (error) throw error;
      if (!data?.optimizedImage) throw new Error("No image returned");

      const b64 = data.optimizedImage.replace(/^data:image\/\w+;base64,/, "");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "image/png" });

      const path = `displays/${Date.now()}_optimized.png`;
      const { error: upError } = await supabase.storage.from("trade-banners").upload(path, blob, { upsert: false });
      if (upError) throw upError;

      const { data: urlData } = supabase.storage.from("trade-banners").getPublicUrl(path);
      setFotoUrl(urlData.publicUrl);
      setFotoPreview(urlData.publicUrl);
      toast.success("Imagem re-otimizada com sucesso ✨");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao otimizar imagem");
    } finally {
      setOptimizing(false);
    }
  };

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const payload = {
      nome: nome.trim(),
      codigo: codigo.trim() || null,
      descricao: descricao.trim() || null,
      categoria: categoria || null,
      largura_cm: largura ? parseFloat(largura) : null,
      profundidade_cm: profundidade ? parseFloat(profundidade) : null,
      altura_cm: altura ? parseFloat(altura) : null,
      material: material.trim() || null,
      foto_url: fotoUrl || null,
      ativo,
    };

    if (display) {
      await updateDisplay.mutateAsync({ id: display.id, ...payload });
    } else {
      await createDisplay.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const isLoading = createDisplay.isPending || updateDisplay.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{display ? "Editar Display" : "Novo Display"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Foto */}
          <div>
            <Label>Foto do Display</Label>
            <div className="mt-1.5">
              {fotoPreview ? (
                <div className="relative rounded-xl overflow-hidden border bg-muted aspect-video">
                  <img src={fotoPreview} alt="Preview" className="w-full h-full object-contain" />
                  <button
                    onClick={() => { setFotoUrl(""); setFotoPreview(null); }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "Enviando..." : "Clique ou arraste para enviar"}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Display de Chão 60cm" />
            </div>
            <div>
              <Label>Código</Label>
              <Input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ex: DSP-001" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dimensões */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Dimensões (cm)</Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              <div>
                <Label className="text-xs">Largura</Label>
                <Input type="number" value={largura} onChange={e => setLargura(e.target.value)} placeholder="60" />
              </div>
              <div>
                <Label className="text-xs">Profundidade</Label>
                <Input type="number" value={profundidade} onChange={e => setProfundidade(e.target.value)} placeholder="35" />
              </div>
              <div>
                <Label className="text-xs">Altura</Label>
                <Input type="number" value={altura} onChange={e => setAltura(e.target.value)} placeholder="210" />
              </div>
            </div>
          </div>

          <div>
            <Label>Material</Label>
            <Input value={material} onChange={e => setMaterial(e.target.value)} placeholder="Ex: MDF, Acrílico" />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição do display..." rows={3} />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            <Label>Ativo</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Salvando..." : display ? "Salvar" : "Criar Display"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
