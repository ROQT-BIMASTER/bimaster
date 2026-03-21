import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useCreateBanner, useUpdateBanner, type TradeBanner } from "@/hooks/useTradeBanners";
import { Upload, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editBanner?: TradeBanner | null;
}

export function BannerFormDialog({ open, onOpenChange, editBanner }: Props) {
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const [uploading, setUploading] = useState(false);
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
  }, [editBanner, open]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("trade-banners").upload(path, file);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
            <div className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-[hsl(330,81%,60%)] transition-colors">
              <label className="cursor-pointer flex flex-col items-center gap-2">
                {uploading ? (
                  <span className="text-sm text-muted-foreground">Enviando...</span>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Clique ou arraste uma imagem</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
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

          <Button onClick={handleSubmit} className="w-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(330,81%,60%)] text-white hover:brightness-110" disabled={createBanner.isPending || updateBanner.isPending}>
            {editBanner ? "Salvar Alterações" : "Criar Banner"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
