import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, X } from "lucide-react";

interface AuditoriaGondolaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId?: string;
  storeId: string;
  onSuccess?: () => void;
}

interface ConcorrenteForm {
  nome: string;
  quantidade_frentes: number;
}

interface FormData {
  product_id: string;
  preco_praticado: number;
  produto_presente: boolean;
  quantidade_frentes: number;
  conforme_planograma: boolean;
  concorrentes_presentes: boolean;
  observacoes: string;
}

export function AuditoriaGondolaDialog({
  open,
  onOpenChange,
  visitId,
  storeId,
  onSuccess,
}: AuditoriaGondolaDialogProps) {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      produto_presente: true,
      quantidade_frentes: 0,
      conforme_planograma: false,
      concorrentes_presentes: false,
    }
  });
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [concorrentes, setConcorrentes] = useState<ConcorrenteForm[]>([]);

  const produtoPresente = watch("produto_presente");
  const concorrentesPresentes = watch("concorrentes_presentes");

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("active", true)
        .order("name");
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);

  const addConcorrente = () => {
    setConcorrentes([...concorrentes, { nome: "", quantidade_frentes: 0 }]);
  };

  const removeConcorrente = (index: number) => {
    setConcorrentes(concorrentes.filter((_, i) => i !== index));
  };

  const updateConcorrente = (index: number, field: keyof ConcorrenteForm, value: any) => {
    const updated = [...concorrentes];
    (updated[index] as any)[field] = value;
    setConcorrentes(updated);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const auditData = {
        visit_id: visitId || null,
        store_id: storeId,
        product_id: data.product_id,
        preco_praticado: data.preco_praticado || null,
        produto_presente: data.produto_presente,
        quantidade_frentes: data.quantidade_frentes,
        conforme_planograma: data.conforme_planograma,
        concorrentes_presentes: data.concorrentes_presentes,
        concorrentes_detalhes: JSON.parse(JSON.stringify(concorrentes.length > 0 ? concorrentes : [])),
        observacoes: data.observacoes || null,
        created_by: user?.id,
      };

      const { error } = await supabase
        .from("gondola_audits")
        .insert([auditData]);

      if (error) throw error;

      toast({
        title: "Auditoria registrada",
        description: "Os dados da gôndola foram salvos com sucesso.",
      });

      reset();
      setConcorrentes([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auditoria de Gôndola</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="product_id">Produto *</Label>
            <select
              id="product_id"
              {...register("product_id", { required: "Selecione um produto" })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Selecione um produto</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku && `(${p.sku})`}
                </option>
              ))}
            </select>
            {errors.product_id && (
              <p className="text-sm text-destructive">{errors.product_id.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="produto_presente">Produto Presente</Label>
            <Switch
              id="produto_presente"
              {...register("produto_presente")}
            />
          </div>

          {produtoPresente && (
            <>
              <div className="space-y-2">
                <Label htmlFor="preco_praticado">Preço Praticado (R$)</Label>
                <Input
                  id="preco_praticado"
                  type="number"
                  step="0.01"
                  {...register("preco_praticado")}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantidade_frentes">Quantidade de Frentes *</Label>
                <Input
                  id="quantidade_frentes"
                  type="number"
                  {...register("quantidade_frentes", { 
                    required: "Campo obrigatório",
                    min: { value: 0, message: "Mínimo 0" }
                  })}
                />
                {errors.quantidade_frentes && (
                  <p className="text-sm text-destructive">{errors.quantidade_frentes.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="conforme_planograma">Conforme Planograma</Label>
                <Switch
                  id="conforme_planograma"
                  {...register("conforme_planograma")}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="concorrentes_presentes">Concorrentes Presentes</Label>
            <Switch
              id="concorrentes_presentes"
              {...register("concorrentes_presentes")}
            />
          </div>

          {concorrentesPresentes && (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Label>Detalhes dos Concorrentes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addConcorrente}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              {concorrentes.map((conc, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label>Nome do Concorrente</Label>
                    <Input
                      value={conc.nome}
                      onChange={(e) => updateConcorrente(index, "nome", e.target.value)}
                      placeholder="Ex: Marca X"
                    />
                  </div>
                  <div className="w-32">
                    <Label>Frentes</Label>
                    <Input
                      type="number"
                      value={conc.quantidade_frentes}
                      onChange={(e) => updateConcorrente(index, "quantidade_frentes", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeConcorrente(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              {...register("observacoes")}
              placeholder="Observações adicionais sobre a auditoria..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Auditoria
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
