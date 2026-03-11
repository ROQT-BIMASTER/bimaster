import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tag, Plus, Trash2, Loader2, Link2 } from "lucide-react";
import { useConciliacaoBancaria } from "@/hooks/useConciliacaoBancaria";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function GestaoCategoriasPluggy() {
  const { categoryRules, categoryRulesLoading, createCategoryRule, deleteCategoryRule, fetchCategories } = useConciliacaoBancaria();
  const [showDialog, setShowDialog] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [newRule, setNewRule] = useState({ description: "", categoryId: "", categoryName: "", contaContabilId: "" });

  // Fetch chart of accounts
  const { data: chartAccounts } = useQuery({
    queryKey: ["chart-of-accounts-for-rules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trade_chart_of_accounts")
        .select("id, codigo, descricao")
        .order("codigo");
      return data || [];
    },
  });

  const handleLoadCategories = async () => {
    setLoadingCategories(true);
    try {
      const result = await fetchCategories();
      setCategories(result?.categories || []);
    } catch {
      // Error handled in hook
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleCreate = () => {
    if (!newRule.description || !newRule.categoryId) return;
    createCategoryRule.mutate({
      description: newRule.description,
      categoryId: newRule.categoryId,
      categoryName: newRule.categoryName,
      contaContabilId: newRule.contaContabilId || undefined,
    });
    setShowDialog(false);
    setNewRule({ description: "", categoryId: "", categoryName: "", contaContabilId: "" });
  };

  const flattenCategories = (cats: any[], parentName = ""): { id: string; name: string }[] => {
    const result: { id: string; name: string }[] = [];
    for (const cat of cats) {
      const fullName = parentName ? `${parentName} > ${cat.description || cat.name}` : (cat.description || cat.name);
      result.push({ id: cat.id, name: fullName });
      if (cat.subcategories) {
        result.push(...flattenCategories(cat.subcategories, fullName));
      }
    }
    return result;
  };

  const flatCategories = flattenCategories(categories);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Tag className="h-4 w-4" />
          Regras de Categorização
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleLoadCategories} disabled={loadingCategories}>
            {loadingCategories ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Tag className="h-3 w-3 mr-1" />}
            Carregar Categorias
          </Button>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Nova Regra
          </Button>
        </div>
      </div>

      {/* Rules List */}
      <Card>
        <CardContent className="pt-6">
          {categoryRulesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : categoryRules.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma regra criada. Crie regras para categorizar transações automaticamente.
            </p>
          ) : (
            <div className="space-y-2">
              {categoryRules.map((rule: any) => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Tag className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{rule.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">
                          {rule.category_name || rule.category_id}
                        </Badge>
                        {rule.trade_chart_of_accounts && (
                          <>
                            <Link2 className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary" className="text-[10px]">
                              {rule.trade_chart_of_accounts.codigo} - {rule.trade_chart_of_accounts.descricao}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteCategoryRule.mutate(rule.id)}
                    disabled={deleteCategoryRule.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Rule Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Regra de Categorização</DialogTitle>
            <DialogDescription>
              Defina um padrão de descrição para categorizar transações automaticamente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Descrição / Padrão</Label>
              <Input
                placeholder="Ex: MC DONALDS, UBER, SHELL..."
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Transações contendo este texto serão categorizadas automaticamente
              </p>
            </div>

            <div className="space-y-2">
              <Label>Categoria Pluggy</Label>
              {flatCategories.length > 0 ? (
                <Select
                  value={newRule.categoryId}
                  onValueChange={(v) => {
                    const cat = flatCategories.find((c) => c.id === v);
                    setNewRule({ ...newRule, categoryId: v, categoryName: cat?.name || "" });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {flatCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="ID da categoria"
                    value={newRule.categoryId}
                    onChange={(e) => setNewRule({ ...newRule, categoryId: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Clique "Carregar Categorias" para ver opções disponíveis
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Conta Contábil (Plano de Contas)</Label>
              <Select
                value={newRule.contaContabilId}
                onValueChange={(v) => setNewRule({ ...newRule, contaContabilId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular ao plano de contas (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {(chartAccounts || []).map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.codigo} - {acc.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newRule.description || !newRule.categoryId || createCategoryRule.isPending}>
              {createCategoryRule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
