import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, PenLine, Bot } from "lucide-react";
import { materiaPrimaSchema } from "@/lib/validations/materia-prima";
import { useQuery } from "@tanstack/react-query";
import { NovaCategoriaMP } from "./NovaCategoriaMP";
import { CadastroIAStep } from "./CadastroIAStep";
import { Badge } from "@/components/ui/badge";

interface NovoMateriaPrimaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (productId: string, productName: string) => void;
}

type DialogMode = "choose" | "ai" | "form";

export const NovoMateriaPrimaDialog = ({ open, onOpenChange, onSuccess }: NovoMateriaPrimaDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [showNovaCategoriaDialog, setShowNovaCategoriaDialog] = useState(false);
  const [mode, setMode] = useState<DialogMode>("choose");
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());
  const [aiMethod, setAiMethod] = useState<"text" | "image" | null>(null);
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

  const resetDialog = () => {
    setMode("choose");
    setAiFilledFields(new Set());
    setAiMethod(null);
    setFormData({
      codigo: "",
      nome: "",
      categoria_id: "",
      unidade_medida_id: "",
      custo_unitario: "",
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) resetDialog();
    onOpenChange(isOpen);
  };

  const handleAIDataExtracted = (data: Record<string, any>, method: "text" | "image") => {
    const filled = new Set<string>();
    const updates: Record<string, string> = { ...formData };

    // Map AI fields to form fields
    const fieldMap: Record<string, string> = {
      codigo: "codigo",
      nome: "nome",
      custo_unitario: "custo_unitario",
    };

    for (const [aiKey, formKey] of Object.entries(fieldMap)) {
      const val = data[aiKey];
      if (val !== null && val !== undefined && val !== "") {
        updates[formKey] = String(val);
        filled.add(formKey);
      }
    }

    // Map unidade_medida sigla to ID
    if (data.unidade_medida && unidades) {
      const sigla = String(data.unidade_medida).toUpperCase().trim();
      const match = unidades.find(u => u.sigla.toUpperCase() === sigla);
      if (match) {
        updates.unidade_medida_id = match.id;
        filled.add("unidade_medida_id");
      }
    }

    // Map categoria name to ID
    if (data.categoria && categorias) {
      const catName = String(data.categoria).toLowerCase().trim();
      const match = categorias.find(c => c.nome.toLowerCase().trim() === catName);
      if (match) {
        updates.categoria_id = match.id;
        filled.add("categoria_id");
      }
    }

    setFormData(updates as typeof formData);
    setAiFilledFields(filled);
    setAiMethod(method);
    setMode("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = materiaPrimaSchema.parse({
        codigo: formData.codigo,
        nome: formData.nome,
        categoria_id: formData.categoria_id || null,
        unidade_medida_id: formData.unidade_medida_id,
        custo_unitario: parseFloat(formData.custo_unitario),
      });

      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session?.user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const insertData = {
        codigo: formData.codigo.trim(),
        nome: formData.nome.trim(),
        categoria_id: formData.categoria_id || null,
        unidade_medida_id: formData.unidade_medida_id,
        custo_unitario: parseFloat(formData.custo_unitario),
        status: "ativo",
        created_by: session.session.user.id,
      };

      const { data, error } = await supabase
        .from("fabrica_materias_primas")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      toast.success("Produto interno criado com sucesso");
      
      onSuccess?.(data.id, data.nome);
      handleOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao criar produto:", error);
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

  const renderAIBadge = (field: string) => {
    if (!aiFilledFields.has(field)) return null;
    return (
      <Badge variant="secondary" className="ml-2 gap-1 text-xs py-0 px-1.5">
        <Bot className="h-3 w-3" />
        IA
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar Produto Interno</DialogTitle>
          </DialogHeader>

          {/* Choose Mode */}
          {mode === "choose" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Como deseja cadastrar a matéria-prima?
              </p>
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => setMode("form")}
                >
                  <PenLine className="h-6 w-6" />
                  <div className="text-center">
                    <p className="font-medium">Preencher Manualmente</p>
                    <p className="text-xs text-muted-foreground">Digite os dados do produto</p>
                  </div>
                </Button>
                <Button
                  variant="gradient"
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => setMode("ai")}
                >
                  <Sparkles className="h-6 w-6" />
                  <div className="text-center">
                    <p className="font-medium">Cadastrar com IA</p>
                    <p className="text-xs opacity-90">Cole texto ou envie imagem do ERP</p>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* AI Step */}
          {mode === "ai" && (
            <CadastroIAStep
              onBack={() => setMode("choose")}
              onDataExtracted={handleAIDataExtracted}
              edgeFunctionName="extrair-materia-prima-ia"
            />
          )}

          {/* Form */}
          {mode === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {aiMethod && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary shrink-0" />
                  Campos com badge <Badge variant="secondary" className="gap-1 text-xs py-0 px-1.5 mx-1"><Bot className="h-3 w-3" />IA</Badge> foram preenchidos automaticamente. Revise antes de salvar.
                </div>
              )}

              <div>
                <div className="flex items-center">
                  <Label htmlFor="codigo">Código *</Label>
                  {renderAIBadge("codigo")}
                </div>
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
                <div className="flex items-center">
                  <Label htmlFor="nome">Nome *</Label>
                  {renderAIBadge("nome")}
                </div>
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
                  <div className="flex items-center">
                    <Label>Categoria (Opcional)</Label>
                    {renderAIBadge("categoria_id")}
                  </div>
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
                <div className="flex items-center">
                  <Label htmlFor="unidade">Unidade de Medida *</Label>
                  {renderAIBadge("unidade_medida_id")}
                </div>
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
                <div className="flex items-center">
                  <Label htmlFor="custo">Custo Unitário *</Label>
                  {renderAIBadge("custo_unitario")}
                </div>
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
                  onClick={() => aiMethod ? setMode("choose") : handleOpenChange(false)}
                  disabled={loading}
                >
                  {aiMethod ? "Voltar" : "Cancelar"}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Produto
                </Button>
              </div>
            </form>
          )}
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
