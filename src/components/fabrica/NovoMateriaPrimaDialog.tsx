import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { materiaPrimaSchema } from "@/lib/validations/materia-prima";
import { useQuery } from "@tanstack/react-query";
import { NovaCategoriaMP } from "./NovaCategoriaMP";

interface NovoMateriaPrimaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (productId: string, productName: string) => void;
}

export const NovoMateriaPrimaDialog = ({ open, onOpenChange, onSuccess }: NovoMateriaPrimaDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [showNovaCategoriaDialog, setShowNovaCategoriaDialog] = useState(false);
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    categoria_id: "",
    unidade_medida_id: "",
    custo_unitario: "",
  });

  // Buscar categorias
  const { data: categorias, refetch: refetchCategorias } = useQuery({
    queryKey: ["categorias-mp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_categorias_mp")
        .select("id, nome")
        .eq("ativa", true)
        .order("nome");

      if (error) throw error;
      return (data || []) as Array<{id: string; nome: string}>;
    },
    enabled: open,
  });

  // Buscar unidades de medida
  const { data: unidades } = useQuery<Array<{id: string; sigla: string; nome: string}>>({
    queryKey: ["unidades-medida"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrica_unidades_medida")
        .select("*");

      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        sigla: d.sigla,
        nome: d.nome
      }));
    },
    enabled: open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar dados
      const validatedData = materiaPrimaSchema.parse({
        codigo: formData.codigo,
        nome: formData.nome,
        categoria_id: formData.categoria_id || null,
        unidade_medida_id: formData.unidade_medida_id,
        custo_unitario: parseFloat(formData.custo_unitario),
      });

      console.log("Dados validados:", validatedData);

      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session?.user) {
        toast.error("Usuário não autenticado");
        return;
      }

      console.log("Usuário autenticado:", session.session.user.id);

      const insertData = {
        codigo: formData.codigo.trim(),
        nome: formData.nome.trim(),
        categoria_id: formData.categoria_id || null,
        unidade_medida_id: formData.unidade_medida_id,
        custo_unitario: parseFloat(formData.custo_unitario),
        status: "ativo",
        created_by: session.session.user.id,
      };

      console.log("Dados para inserir:", insertData);

      const { data, error } = await supabase
        .from("fabrica_materias_primas")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Erro detalhado do Supabase:", error);
        throw error;
      }

      console.log("Produto criado com sucesso:", data);

      toast.success("Produto interno criado com sucesso");
      
      onSuccess?.(data.id, data.nome);
      onOpenChange(false);
      setFormData({
        codigo: "",
        nome: "",
        categoria_id: "",
        unidade_medida_id: "",
        custo_unitario: "",
      });
    } catch (error: any) {
      console.error("Erro completo ao criar produto:", error);
      if (error.errors) {
        const firstError = error.errors?.[0];
        toast.error(firstError?.message || "Erro de validação");
      } else {
        toast.error(error.message || "Erro ao criar produto interno");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar Produto Interno</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="Ex: MP001"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Apenas letras, números, hífen e underscore
              </p>
            </div>

            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do produto"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Categoria (Opcional)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNovaCategoriaDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nova
                </Button>
              </div>
              <Select
                value={formData.categoria_id}
                onValueChange={(v) => setFormData({ ...formData, categoria_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="unidade">Unidade de Medida *</Label>
              <Select
                value={formData.unidade_medida_id}
                onValueChange={(v) => setFormData({ ...formData, unidade_medida_id: v })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidades?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.sigla} - {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="custo">Custo Unitário *</Label>
              <Input
                id="custo"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.custo_unitario}
                onChange={(e) => setFormData({ ...formData, custo_unitario: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Produto
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <NovaCategoriaMP
        open={showNovaCategoriaDialog}
        onOpenChange={setShowNovaCategoriaDialog}
        onSuccess={(categoryId, categoryName) => {
          refetchCategorias();
          setFormData({ ...formData, categoria_id: categoryId });
          toast.success(`Categoria "${categoryName}" criada com sucesso`);
        }}
      />
    </>
  );
};
