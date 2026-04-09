import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { chartOfAccountsSchema, type ChartOfAccountsFormData } from "@/lib/validations/chart-of-accounts";
import { Sparkles, Loader2 } from "lucide-react";

interface NovaContaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  parentAccounts: any[];
}

export function NovaContaDialog({ open, onOpenChange, onSuccess, parentAccounts }: NovaContaDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departamentoId, setDepartamentoId] = useState<string>("");
  const [tipoCategoria, setTipoCategoria] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);

  // Buscar departamentos
  const { data: departamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departamentos')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      
      if (error) throw error;
      return data;
    }
  });

  const form = useForm<ChartOfAccountsFormData>({
    resolver: zodResolver(chartOfAccountsSchema),
    defaultValues: {
      code: "",
      name: "",
      account_type: "expense",
      nivel: 3,
      natureza: "D",
      is_group: false,
      permite_lancamento: true,
      parent_account_id: null,
      description: "",
      is_active: true,
    },
  });

  const onSubmit = async (data: ChartOfAccountsFormData) => {
    setIsSubmitting(true);
    try {
      const accountData = {
        ...data,
        departamento_id: departamentoId || null,
        tipo_categoria: tipoCategoria || null,
        departamento_definido_manualmente: !!departamentoId,
        departamento_confianca: aiSuggestion?.confianca || null,
      };

      const { error } = await supabase
        .from("trade_chart_of_accounts")
        .insert(accountData as any);

      if (error) throw error;

      toast.success("Conta criada com sucesso!");
      form.reset();
      setDepartamentoId("");
      setAiSuggestion(null);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao criar conta:", error);
      toast.error(error.message || "Erro ao criar conta");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnalyzeWithAI = async () => {
    const formValues = form.getValues();
    
    if (!formValues.code || !formValues.name) {
      toast.error("Preencha código e nome da conta antes de analisar");
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('classificar-conta-departamento', {
        body: {
          accountCode: formValues.code,
          accountName: formValues.name,
          accountDescription: formValues.description || "",
          accountType: formValues.account_type
        }
      });

      if (error) {
        if (error.message?.includes('429')) {
          toast.error("Limite de requisições excedido. Aguarde um momento.");
        } else if (error.message?.includes('402')) {
          toast.error("Créditos insuficientes. Contate o administrador.");
        } else {
          throw error;
        }
        return;
      }

      if (data?.success) {
        setAiSuggestion(data);
        setDepartamentoId(data.departamento_id);
        toast.success(
          `IA sugeriu: ${data.departamento_nome} (${Math.round(data.confianca * 100)}% de confiança)`
        );
      }
    } catch (error: any) {
      console.error('Erro na análise:', error);
      toast.error("Erro ao analisar com IA");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isGroup = form.watch("is_group");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Conta Contábil</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código *</FormLabel>
                    <FormControl>
                      <Input placeholder="1.1.01" {...field} />
                    </FormControl>
                    <FormDescription>Formato: números e pontos</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nivel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível *</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Conta *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Caixa e Equivalentes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="account_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Conta *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="asset">Ativo</SelectItem>
                        <SelectItem value="liability">Passivo</SelectItem>
                        <SelectItem value="revenue">Receita</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="budget">Verba</SelectItem>
                        <SelectItem value="cost_center">Centro de Custo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="natureza"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Natureza *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="D">Débito (D)</SelectItem>
                        <SelectItem value="C">Crédito (C)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="parent_account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta Pai (Hierarquia)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sem conta pai (conta raiz)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">Sem conta pai</SelectItem>
                      {parentAccounts
                        .filter(a => a.is_group)
                        .map(acc => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Descrição opcional da conta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo Categoria (Receita/Despesa) */}
            <div className="space-y-2 border rounded-lg p-4 bg-primary/5">
              <Label className="text-sm font-medium">Tipo de Categoria</Label>
              <p className="text-xs text-muted-foreground">Define se esta conta é de Receita ou Despesa para fins de DRE.</p>
              <Select
                value=""
                onValueChange={(val) => {
                  // Store in a hidden field - we'll pass it on submit
                  (form as any).__tipoCategoriaOverride = val || null;
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Não definido (automático)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Não definido</SelectItem>
                  <SelectItem value="R">Receita</SelectItem>
                  <SelectItem value="D">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Departamento */}
            <div className="space-y-3 border rounded-lg p-4 bg-accent/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Departamento</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyzeWithAI}
                  disabled={isAnalyzing || !form.watch('code') || !form.watch('name')}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-2" />
                      Analisar com IA
                    </>
                  )}
                </Button>
              </div>

              <Select value={departamentoId} onValueChange={(value) => {
                setDepartamentoId(value);
                if (value) {
                  setAiSuggestion(null); // Limpar sugestão se usuário escolher manualmente
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {departamentos?.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {aiSuggestion && (
                <div className="text-xs bg-primary/10 text-primary p-3 rounded-md border border-primary/20">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-semibold">{aiSuggestion.departamento_nome}</p>
                      <p className="text-xs opacity-80 mt-0.5">
                        Confiança: {Math.round(aiSuggestion.confianca * 100)}%
                      </p>
                      <p className="text-xs mt-1.5 leading-relaxed">
                        {aiSuggestion.justificativa}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="is_group"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Conta Sintética (Grupo)</FormLabel>
                      <FormDescription>
                        Agrupa outras contas
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue("permite_lancamento", false);
                          }
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="permite_lancamento"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Permite Lançamento</FormLabel>
                      <FormDescription>
                        Conta analítica
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isGroup}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Criar Conta"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
