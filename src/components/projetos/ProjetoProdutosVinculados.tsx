import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, Package, X, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProjetoProdutosVinculadosProps {
  projetoId: string;
  isCoordinator: boolean;
}

export function ProjetoProdutosVinculados({ projetoId, isCoordinator }: ProjetoProdutosVinculadosProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  // Fetch linked products
  const { data: vinculos = [], isLoading } = useQuery({
    queryKey: ["projeto-produto-vinculos", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_produto_vinculos" as any)
        .select("id, produto_id, origem, created_at")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch product details
      const produtoIds = data.map((v: any) => v.produto_id);
      const { data: produtos } = await supabase
        .from("fabrica_produtos")
        .select("id, codigo, nome, sku, foto_url")
        .in("id", produtoIds);

      const produtoMap = new Map((produtos || []).map((p: any) => [p.id, p]));
      return data.map((v: any) => ({
        ...v,
        produto: produtoMap.get(v.produto_id) || null,
      }));
    },
  });

  // Search products
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ["search-produtos-vinculo", search],
    queryFn: async () => {
      const q = search.trim();
      if (q.length < 2) return [];
      const { data } = await supabase
        .from("fabrica_produtos")
        .select("id, codigo, nome, sku, foto_url")
        .or(`nome.ilike.%${q}%,codigo.ilike.%${q}%,sku.ilike.%${q}%`)
        .eq("ativo", true)
        .limit(10);
      return data || [];
    },
    enabled: search.trim().length >= 2,
  });

  const linkedIds = useMemo(() => new Set(vinculos.map((v: any) => v.produto_id)), [vinculos]);
  const filteredResults = searchResults.filter((p: any) => !linkedIds.has(p.id));

  const addVinculo = useMutation({
    mutationFn: async ({ produtoId, origem }: { produtoId: string; origem: string }) => {
      const { error } = await supabase
        .from("projeto_produto_vinculos" as any)
        .insert({ projeto_id: projetoId, produto_id: produtoId, origem, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-produto-vinculos", projetoId] });
      setSearch("");
      toast.success("Produto vinculado ao projeto");
    },
    onError: () => toast.error("Erro ao vincular produto"),
  });

  const removeVinculo = useMutation({
    mutationFn: async (vinculoId: string) => {
      const { error } = await supabase
        .from("projeto_produto_vinculos" as any)
        .delete()
        .eq("id", vinculoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projeto-produto-vinculos", projetoId] });
      toast.success("Produto desvinculado");
    },
    onError: () => toast.error("Erro ao desvincular produto"),
  });

  return (
    <div className="space-y-3">
      <Separator />
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Produtos Vinculados</span>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
          {vinculos.length}
        </Badge>
      </div>

      {isCoordinator && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar produto por nome, código ou SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
          {search.trim().length >= 2 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {searching ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filteredResults.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">Nenhum produto encontrado</p>
              ) : (
                filteredResults.map((p: any) => (
                  <button
                    key={p.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors text-sm"
                    onClick={() => addVinculo.mutate({ produtoId: p.id, origem: "brasil" })}
                  >
                    <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono text-xs text-muted-foreground">{p.codigo || p.sku}</span>
                    <span className="truncate flex-1">{p.nome}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : vinculos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhum produto vinculado a este projeto.</p>
      ) : (
        <ScrollArea className="max-h-40">
          <div className="space-y-1">
            {vinculos.map((v: any) => (
              <div key={v.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/30 group transition-colors">
                <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono text-[11px] text-muted-foreground">{v.produto?.codigo || v.produto?.sku || "—"}</span>
                <span className="text-sm truncate flex-1">{v.produto?.nome || "Produto removido"}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                  {v.origem === "china" ? "China" : "Brasil"}
                </Badge>
                {isCoordinator && (
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => removeVinculo.mutate(v.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
