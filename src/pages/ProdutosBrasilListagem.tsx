import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Search, ArrowLeft, Loader2, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_COLORS } from "@/hooks/useProdutoBrasil";

export default function ProdutosBrasilListagem() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos-brasil-list"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("produtos_brasil" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!search) return produtos;
    const s = search.toLowerCase();
    return produtos.filter((p: any) =>
      p.china_nome?.toLowerCase().includes(s) ||
      p.china_codigo?.toLowerCase().includes(s) ||
      p.nome_brasil?.toLowerCase().includes(s) ||
      p.codigo_brasil?.toLowerCase().includes(s)
    );
  }, [produtos, search]);

  const statusBadgeVariant = (status: string) => {
    const map: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
      produto_importado: "secondary",
      aguardando_precadastro: "outline",
      precadastro_em_andamento: "default",
      aguardando_regulatorio: "outline",
      aprovado_cadastro: "default",
      produto_ativo: "default",
    };
    return map[status] || "secondary";
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Cadastro Brasil</h1>
          <p className="text-sm text-muted-foreground">Produtos importados em processo de onboarding</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Nenhum produto encontrado. Vincule uma submissão China para iniciar o cadastro.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => navigate(`/dashboard/projetos/produto-brasil/${p.id}`)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-primary">{p.china_codigo}</span>
                    {p.nome_brasil && (
                      <span className="text-xs text-muted-foreground">→ {p.codigo_brasil || "sem código BR"}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">
                    {p.nome_brasil || p.china_nome || "Sem nome"}
                  </p>
                </div>
                <Badge variant={statusBadgeVariant(p.status)} className="text-[10px] shrink-0">
                  {PRODUCT_STATUS_LABELS[p.status] || p.status}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
