import { useState, useEffect } from "react";
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

interface EditarContaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: any;
  onSuccess: () => void;
  parentAccounts: any[];
}

export function EditarContaDialog({ open, onOpenChange, account, onSuccess, parentAccounts }: EditarContaDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departamentoId, setDepartamentoId] = useState<string>(account.departamento_id || "");
  const [categoriaDre, setCategoriaDre] = useState<string>(account.categoria_dre || "");
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
      code: account.code,
      name: account.name,
      account_type: account.account_type,
      nivel: account.nivel,
      natureza: account.natureza,
      is_group: account.is_group,
      permite_lancamento: account.permite_lancamento,
      parent_account_id: account.parent_account_id,
      description: account.description || "",
      is_active: account.is_active,
    },
  });

  useEffect(() => {
    if (account) {
      form.reset({
        code: account.code,
        name: account.name,
        account_type: account.account_type,
        nivel: account.nivel,
        natureza: account.natureza,
        is_group: account.is_group,
        permite_lancamento: account.permite_lancamento,
        parent_account_id: account.parent_account_id,
        description: account.description || "",
        is_active: account.is_active,
      });
      setDepartamentoId(account.departamento_id || "");
      setCategoriaDre(account.categoria_dre || "");
      setAiSuggestion(null);
    }
  }, [account, form]);

  const onSubmit = async (data: ChartOfAccountsFormData) => {
    setIsSubmitting(true);
    try {
      const accountData = {
        ...data,
        departamento_id: departamentoId || null,
        categoria_dre: categoriaDre || null,
        // Se o usuário escolheu manualmente, marcar como manual
        departamento_definido_manualmente: departamentoId !== account.departamento_id,
        departamento_confianca: aiSuggestion?.confianca || account.departamento_confianca || null,
      };

      const { error } = await supabase
        .from("trade_chart_of_accounts")
        .update(accountData as any)
        .eq("id", account.id);

      if (error) throw error;

      toast.success("Conta atualizada com sucesso!");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao atualizar conta:", error);
      toast.error(error.message || "Erro ao atualizar conta");
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
          <DialogTitle>Editar Conta Contábil</DialogTitle>
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

            {/* Categoria DRE */}
            <div className="space-y-2 border rounded-lg p-4 bg-primary/5">
              <Label className="text-sm font-medium">Categoria DRE</Label>
              <p className="text-xs text-muted-foreground">Define como esta conta aparece na DRE. Deixe vazio para classificação automática.</p>
              <Select value={categoriaDre} onValueChange={setCategoriaDre}>
                <SelectTrigger>
                  <SelectValue placeholder="Automático (regras de texto)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Automático (regras de texto)</SelectItem>
                  <SelectItem value="receita_bruta">Receita Bruta</SelectItem>
                  <SelectItem value="deducoes">Deduções e Abatimentos</SelectItem>
                  <SelectItem value="custo_vendas">Custo de Vendas</SelectItem>
                  <SelectItem value="despesas_fixas">Despesas Fixas</SelectItem>
                  <SelectItem value="impostos_lucro">Impostos s/ Lucro (IRPJ/CSLL)</SelectItem>
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
                if (value && value !== account.departamento_id) {
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

              {account.departamento_definido_manualmente && (
                <p className="text-xs text-muted-foreground">
                  ✓ Departamento definido manualmente
                </p>
              )}

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

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="is_group"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Grupo</FormLabel>
                      <FormDescription>
                        Sintética
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
                      <FormLabel>Lançamento</FormLabel>
                      <FormDescription>
                        Analítica
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

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Ativa</FormLabel>
                      <FormDescription>
                        Status
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
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
                {isSubmitting ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
