import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtoEdit?: any;
  onSuccess: () => void;
}

export function NovoProdutoAcabadoDialog({ open, onOpenChange, produtoEdit, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    descricao: "",
    formula_id: "",
    unidade_medida_id: "",
    tipo: "ACABADO",
    tempo_producao_minutos: "",
    rendimento: "",
    foto_url: "",
    ativo: true,
  });

  const { data: formulas } = useQuery({
    queryKey: ["formulas-ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_formulas")
        .select("id, produto_id, versao, fabrica_produtos(nome)")
        .eq("ativa", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: unidades } = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_unidades_medida")
        .select("*")
        .order("sigla");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (produtoEdit && open) {
      setFormData({
        codigo: produtoEdit.codigo || "",
        nome: produtoEdit.nome || "",
        descricao: produtoEdit.descricao || "",
        formula_id: produtoEdit.formula_id || "",
        unidade_medida_id: produtoEdit.unidade_medida_id || "",
        tipo: produtoEdit.tipo || "ACABADO",
        tempo_producao_minutos: produtoEdit.tempo_producao_minutos?.toString() || "",
        rendimento: produtoEdit.rendimento?.toString() || "",
        foto_url: produtoEdit.foto_url || "",
        ativo: produtoEdit.ativo ?? true,
      });
    } else if (!produtoEdit && open) {
      setFormData({
        codigo: "",
        nome: "",
        descricao: "",
        formula_id: "",
        unidade_medida_id: "",
        tipo: "ACABADO",
        tempo_producao_minutos: "",
        rendimento: "",
        foto_url: "",
        ativo: true,
      });
    }
  }, [produtoEdit, open]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const payload = {
        codigo: formData.codigo.trim().toUpperCase(),
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || null,
        formula_id: formData.formula_id || null,
        unidade_medida_id: formData.unidade_medida_id || null,
        tipo: formData.tipo,
        tempo_producao_minutos: formData.tempo_producao_minutos ? parseInt(formData.tempo_producao_minutos) : null,
        rendimento: formData.rendimento ? parseFloat(formData.rendimento) : null,
        foto_url: formData.foto_url.trim() || null,
        ativo: formData.ativo,
        created_by: user.id,
      };

      console.log("💾 Salvando produto:", payload);

      if (produtoEdit) {
        console.log("✏️ Atualizando produto existente:", produtoEdit.id);
        const { data, error } = await supabase
          .from("fabrica_produtos")
          .update(payload)
          .eq("id", produtoEdit.id)
          .select();

        if (error) {
          console.error("❌ Erro ao atualizar:", error);
          throw error;
        }
        console.log("✅ Produto atualizado:", data);
      } else {
        console.log("➕ Inserindo novo produto");
        const { data, error } = await supabase
          .from("fabrica_produtos")
          .insert([payload])
          .select();

        if (error) {
          console.error("❌ Erro ao inserir:", error);
          throw error;
        }
        console.log("✅ Produto inserido:", data);
      }
    },
    onSuccess: () => {
      toast.success(produtoEdit ? "Produto atualizado!" : "Produto cadastrado com sucesso!");
      onSuccess();
      onOpenChange(false);
      // Limpar form ao fechar
      setTimeout(() => {
        if (!produtoEdit) {
          setFormData({
            codigo: "",
            nome: "",
            descricao: "",
            formula_id: "",
            unidade_medida_id: "",
            tipo: "ACABADO",
            tempo_producao_minutos: "",
            rendimento: "",
            foto_url: "",
            ativo: true,
          });
        }
      }, 300);
    },
    onError: (error: any) => {
      console.error("Erro ao salvar produto:", error);
      toast.error("Erro ao salvar: " + (error.message || "Erro desconhecido"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.codigo.trim()) {
      toast.error("Código é obrigatório");
      return;
    }

    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    // Produto pode ser salvo SEM fórmula inicialmente
    // A fórmula será vinculada depois, quando for criada
    console.log("🚀 Iniciando salvamento do produto");
    salvarMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {produtoEdit ? "Editar Produto Acabado" : "Novo Produto Acabado"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="PROD-001"
                required
              />
            </div>

            <div>
              <Label htmlFor="tipo">Tipo de Produto</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACABADO">Produto Acabado</SelectItem>
                  <SelectItem value="INTER">Intermediário</SelectItem>
                  <SelectItem value="MP">Matéria-Prima</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="nome">Nome do Produto *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome do produto"
              required
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição do produto"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="formula">Fórmula (BOM) {formData.tipo === "ACABADO" ? "(opcional - pode ser vinculada depois)" : ""}</Label>
            <Select
              value={formData.formula_id || "SEM_FORMULA"}
              onValueChange={(value) => setFormData({ ...formData, formula_id: value === "SEM_FORMULA" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhuma fórmula vinculada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SEM_FORMULA">Nenhuma fórmula</SelectItem>
                {formulas?.map((formula: any) => (
                  <SelectItem key={formula.id} value={formula.id}>
                    {formula.fabrica_produtos?.nome} (v{formula.versao})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.tipo === "ACABADO" && !formData.formula_id && (
              <p className="text-xs text-muted-foreground mt-1">
                ℹ️ Você pode criar a fórmula depois e vinculá-la ao produto
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unidade">Unidade de Medida</Label>
              <Select
                value={formData.unidade_medida_id}
                onValueChange={(value) => setFormData({ ...formData, unidade_medida_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {unidades?.map((unidade) => (
                    <SelectItem key={unidade.id} value={unidade.id}>
                      {unidade.sigla} - {unidade.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="rendimento">Rendimento</Label>
              <Input
                id="rendimento"
                type="number"
                step="0.001"
                value={formData.rendimento}
                onChange={(e) => setFormData({ ...formData, rendimento: e.target.value })}
                placeholder="Ex: 1000"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tempo_producao">Tempo de Produção (minutos)</Label>
            <Input
              id="tempo_producao"
              type="number"
              value={formData.tempo_producao_minutos}
              onChange={(e) => setFormData({ ...formData, tempo_producao_minutos: e.target.value })}
              placeholder="Ex: 60"
            />
          </div>

          <div>
            <Label htmlFor="foto_url">URL da Foto (opcional)</Label>
            <Input
              id="foto_url"
              type="url"
              value={formData.foto_url}
              onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvarMutation.isPending}>
              {salvarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {produtoEdit ? "Atualizar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
