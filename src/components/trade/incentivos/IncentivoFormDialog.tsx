import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCreateIncentivo, useUpdateIncentivo, type TradeIncentivo } from "@/hooks/useTradeIncentivos";
import { toast } from "sonner";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { Upload, X, Loader2, Wand2 } from "lucide-react";
import { AiBannerGenerator } from "@/components/trade/AiBannerGenerator";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editIncentivo?: TradeIncentivo | null;
}

const TIPOS = [
  { value: "visitas", label: "Meta de Visitas", icon: "📍" },
  { value: "fotos", label: "Meta de Fotos", icon: "📸" },
  { value: "vendas", label: "Meta de Vendas", icon: "💰" },
  { value: "ranking", label: "Ranking da Equipe", icon: "🏆" },
  { value: "bonus", label: "Bônus Especial", icon: "🎁" },
];

export function IncentivoFormDialog({ open, onOpenChange, editIncentivo }: Props) {
  const createIncentivo = useCreateIncentivo();
  const updateIncentivo = useUpdateIncentivo();
  const [uploading, setUploading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    tipo: "visitas",
    meta_valor: 0,
    meta_unidade: "unidades",
    recompensa: "",
    icone: "🎯",
    data_inicio: weekStart,
    data_fim: weekEnd,
    ativo: true,
    banner_url: "",
  });

  useEffect(() => {
    if (editIncentivo) {
      setForm({
        titulo: editIncentivo.titulo,
        descricao: editIncentivo.descricao || "",
        tipo: editIncentivo.tipo,
        meta_valor: editIncentivo.meta_valor,
        meta_unidade: editIncentivo.meta_unidade,
        recompensa: editIncentivo.recompensa || "",
        icone: editIncentivo.icone,
        data_inicio: editIncentivo.data_inicio,
        data_fim: editIncentivo.data_fim,
        ativo: editIncentivo.ativo,
        banner_url: editIncentivo.banner_url || "",
      });
    } else {
      setForm({
        titulo: "",
        descricao: "",
        tipo: "visitas",
        meta_valor: 0,
        meta_unidade: "unidades",
        recompensa: "",
        icone: "🎯",
        data_inicio: weekStart,
        data_fim: weekEnd,
        ativo: true,
        banner_url: "",
      });
    }
  }, [editIncentivo, open]);

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
        body: { imageBase64: base64 },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error("Falha na otimização com IA. Usando imagem original.");
        return base64;
      }
      toast.success("🤖 Imagem otimizada com IA para o formato de banner!");
      return data.optimizedImage;
    } catch {
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
      const base64 = await fileToBase64(file);
      toast.info("🤖 Otimizando imagem com IA...");
      const optimizedBase64 = await optimizeWithAI(base64);
      const fileToUpload = optimizedBase64 !== base64 ? base64ToBlob(optimizedBase64) : file;
      const ext = optimizedBase64 !== base64 ? "png" : (file.name.split(".").pop() || "png");
      const path = `incentivos/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("trade-banners").upload(path, fileToUpload);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("trade-banners").getPublicUrl(path);
      setForm(f => ({ ...f, banner_url: publicUrl }));
      toast.success("Banner enviado");
    } catch {
      toast.error("Erro no upload do banner");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.titulo) {
      toast.error("Preencha o título");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...form, banner_url: form.banner_url || null, created_by: user?.id || null };

    if (editIncentivo) {
      await updateIncentivo.mutateAsync({ id: editIncentivo.id, ...payload });
    } else {
      await createIncentivo.mutateAsync(payload as any);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editIncentivo ? "Editar Incentivo" : "Criar Incentivo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Banner upload */}
          <div>
            <Label>Banner (opcional)</Label>
            {form.banner_url ? (
              <div className="relative mt-1">
                <img src={form.banner_url} alt="Banner" className="w-full h-32 object-cover rounded-xl border" />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2 h-7 w-7 rounded-full"
                  onClick={() => setForm(f => ({ ...f, banner_url: "" }))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="mt-1 flex items-center justify-center gap-2 h-28 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                {uploading || optimizing ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">{optimizing ? "Otimizando com IA..." : "Enviando..."}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Upload className="h-6 w-6" />
                    <span className="text-xs">Clique para enviar banner</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading || optimizing} />
              </label>
            )}
          </div>

          <div>
            <Label>Título</Label>
            <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder='Ex: "Meta PDV — Semana 12"' />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => {
                const t = TIPOS.find(t => t.value === v);
                setForm(f => ({ ...f, tipo: v, icone: t?.icon || f.icone }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ícone/Emoji</Label>
              <Input value={form.icone} onChange={e => setForm(f => ({ ...f, icone: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Meta (valor)</Label>
              <Input type="number" value={form.meta_valor} onChange={e => setForm(f => ({ ...f, meta_valor: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={form.meta_unidade} onChange={e => setForm(f => ({ ...f, meta_unidade: e.target.value }))} placeholder="Ex: PDVs, fotos, R$" />
            </div>
          </div>

          <div>
            <Label>Recompensa</Label>
            <Input value={form.recompensa} onChange={e => setForm(f => ({ ...f, recompensa: e.target.value }))} placeholder='Ex: "R$50 de bônus", "Day off"' />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="date" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            <Label>Ativo</Label>
          </div>

          <Button onClick={handleSubmit} className="w-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] text-white hover:brightness-110" disabled={createIncentivo.isPending || updateIncentivo.isPending}>
            {editIncentivo ? "Salvar Alterações" : "Criar Incentivo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
