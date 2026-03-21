import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateMaterial, useUpdateMaterial, type TradeMaterial } from "@/hooks/useTradeMateriais";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS = [
  "Banner PDV", "Display de chão", "Wobbler", "Adesivo", "Totem", "Faixa de gôndola", "Stopper", "Outros"
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  material?: TradeMaterial | null;
}

export function MaterialFormDialog({ open, onOpenChange, material }: Props) {
  const create = useCreateMaterial();
  const update = useUpdateMaterial();
  const isEditing = !!material;
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    categoria: "Outros",
    foto_url: "",
    estoque_total: 0,
    estoque_minimo: 0,
    estoque_atual: 0,
    max_por_solicitacao: 5,
    max_por_loja_mes: 10,
    prazo_entrega: "5 a 10 dias úteis",
    politica_uso: "",
    exibir_estoque: true,
    permitir_sem_estoque: false,
    requer_aprovacao: true,
    ativo: true,
  });

  useEffect(() => {
    if (material) {
      setForm({
        nome: material.nome,
        descricao: material.descricao || "",
        categoria: material.categoria,
        foto_url: material.foto_url || "",
        estoque_total: material.estoque_total,
        estoque_minimo: material.estoque_minimo,
        estoque_atual: material.estoque_atual,
        max_por_solicitacao: material.max_por_solicitacao || 5,
        max_por_loja_mes: material.max_por_loja_mes || 10,
        prazo_entrega: material.prazo_entrega || "",
        politica_uso: material.politica_uso || "",
        exibir_estoque: material.exibir_estoque,
        permitir_sem_estoque: material.permitir_sem_estoque,
        requer_aprovacao: material.requer_aprovacao,
        ativo: material.ativo,
      });
    } else {
      setForm({
        nome: "", descricao: "", categoria: "Outros", foto_url: "",
        estoque_total: 0, estoque_minimo: 0, estoque_atual: 0,
        max_por_solicitacao: 5, max_por_loja_mes: 10,
        prazo_entrega: "5 a 10 dias úteis", politica_uso: "",
        exibir_estoque: true, permitir_sem_estoque: false,
        requer_aprovacao: true, ativo: true,
      });
    }
  }, [material, open]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `materiais/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("trade-assets").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("trade-assets").getPublicUrl(path);
      setForm(f => ({ ...f, foto_url: urlData.publicUrl }));
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const payload = { ...form };
    if (isEditing && material) {
      await update.mutateAsync({ id: material.id, ...payload });
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await create.mutateAsync({ ...payload, created_by: user?.id } as any);
    }
    onOpenChange(false);
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Material" : "Novo Material"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Foto */}
          <div>
            <Label>Foto</Label>
            {form.foto_url ? (
              <div className="relative w-full h-40 rounded-lg overflow-hidden bg-muted mt-1">
                <img src={form.foto_url} alt="" className="w-full h-full object-cover" />
                <button
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                  onClick={() => setForm(f => ({ ...f, foto_url: "" }))}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition mt-1">
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                  <div className="text-center">
                    <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Clique para upload</span>
                  </div>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
              </label>
            )}
          </div>

          {/* Nome + Categoria */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} />
          </div>

          {/* Estoque */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Estoque Total</Label>
              <Input type="number" value={form.estoque_total} onChange={e => setForm(f => ({ ...f, estoque_total: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Estoque Atual</Label>
              <Input type="number" value={form.estoque_atual} onChange={e => setForm(f => ({ ...f, estoque_atual: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Estoque Mínimo</Label>
              <Input type="number" value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>

          {/* Limites */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Máx por Solicitação</Label>
              <Input type="number" value={form.max_por_solicitacao} onChange={e => setForm(f => ({ ...f, max_por_solicitacao: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <Label>Máx por Loja/Mês</Label>
              <Input type="number" value={form.max_por_loja_mes} onChange={e => setForm(f => ({ ...f, max_por_loja_mes: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>

          {/* Prazo + Política */}
          <div>
            <Label>Prazo de Entrega</Label>
            <Input value={form.prazo_entrega} onChange={e => setForm(f => ({ ...f, prazo_entrega: e.target.value }))} />
          </div>
          <div>
            <Label>Política de Uso</Label>
            <Textarea value={form.politica_uso} onChange={e => setForm(f => ({ ...f, politica_uso: e.target.value }))} rows={2} />
          </div>

          {/* Toggles */}
          <div className="space-y-3 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Label>Exibir estoque para o usuário</Label>
              <Switch checked={form.exibir_estoque} onCheckedChange={v => setForm(f => ({ ...f, exibir_estoque: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Permitir solicitação sem estoque</Label>
              <Switch checked={form.permitir_sem_estoque} onCheckedChange={v => setForm(f => ({ ...f, permitir_sem_estoque: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Requer aprovação</Label>
              <Switch checked={form.requer_aprovacao} onCheckedChange={v => setForm(f => ({ ...f, requer_aprovacao: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo no catálogo</Label>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? "Salvar" : "Criar Material"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
