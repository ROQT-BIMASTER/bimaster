import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface NovaMateriaPrimaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovaMateriaPrimaDialog({ open, onOpenChange, onSuccess }: NovaMateriaPrimaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    categoria_id: "",
    fornecedor_id: "",
    unidade_medida_id: "",
    estoque_atual: "0",
    estoque_minimo: "0",
    custo_unitario: "0",
    status: "disponivel",
    data_validade: "",
    lote: "",
    observacoes: "",
  });

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    try {
      const [categoriasRes, fornecedoresRes, unidadesRes] = await Promise.all([
        supabase.from("fabrica_categorias_mp").select("*").eq("ativa", true).order("nome"),
        supabase.from("fabrica_fornecedores").select("*").eq("ativo", true).order("razao_social"),
        supabase.from("fabrica_unidades_medida").select("*").order("sigla"),
      ]);

      if (categoriasRes.data) setCategorias(categoriasRes.data);
      if (fornecedoresRes.data) setFornecedores(fornecedoresRes.data);
      if (unidadesRes.data) setUnidades(unidadesRes.data);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("fabrica_materias_primas").insert({
        ...formData,
        estoque_atual: parseFloat(formData.estoque_atual),
        estoque_minimo: parseFloat(formData.estoque_minimo),
        custo_unitario: parseFloat(formData.custo_unitario),
        data_validade: formData.data_validade || null,
        lote: formData.lote || null,
        observacoes: formData.observacoes || null,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Matéria-prima cadastrada com sucesso!");
      onSuccess();
      onOpenChange(false);
      setFormData({
        codigo: "",
        nome: "",
        categoria_id: "",
        fornecedor_id: "",
        unidade_medida_id: "",
        estoque_atual: "0",
        estoque_minimo: "0",
        custo_unitario: "0",
        status: "disponivel",
        data_validade: "",
        lote: "",
        observacoes: "",
      });
    } catch (error: any) {
      console.error("Erro ao cadastrar:", error);
      toast.error(error.message || "Erro ao cadastrar matéria-prima");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Nova Matéria-Prima</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                placeholder="MP-001"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome da matéria-prima"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={formData.categoria_id} onValueChange={(v) => setFormData({ ...formData, categoria_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select value={formData.fornecedor_id} onValueChange={(v) => setFormData({ ...formData, fornecedor_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((forn) => (
                    <SelectItem key={forn.id} value={forn.id}>
                      {forn.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unidade de Medida *</Label>
              <Select value={formData.unidade_medida_id} onValueChange={(v) => setFormData({ ...formData, unidade_medida_id: v })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((un) => (
                    <SelectItem key={un.id} value={un.id}>
                      {un.sigla} - {un.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estoque Atual</Label>
              <Input
                type="number"
                step="0.001"
                value={formData.estoque_atual}
                onChange={(e) => setFormData({ ...formData, estoque_atual: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Estoque Mínimo</Label>
              <Input
                type="number"
                step="0.001"
                value={formData.estoque_minimo}
                onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Custo Unitário (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.custo_unitario}
                onChange={(e) => setFormData({ ...formData, custo_unitario: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="quarentena">Quarentena</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de Validade</Label>
              <Input
                type="date"
                value={formData.data_validade}
                onChange={(e) => setFormData({ ...formData, data_validade: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Lote</Label>
              <Input
                placeholder="Número do lote"
                value={formData.lote}
                onChange={(e) => setFormData({ ...formData, lote: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Informações adicionais..."
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
