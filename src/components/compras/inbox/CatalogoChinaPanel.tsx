import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen, Plus, Search } from "lucide-react";
import { EmitirOCDialog } from "@/components/china/EmitirOCDialog";

interface CatalogoChinaPanelProps {
  onCreated: () => void;
}

export function CatalogoChinaPanel({ onCreated }: CatalogoChinaPanelProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["catalogo-china", search],
    queryFn: async () => {
      let q = supabase
        .from("china_produto_submissoes" as any)
        .select("id, produto_codigo, produto_nome, qty_total, ean_caixa_master, status, aprovado_em, created_at, foto_url")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (search.trim()) {
        q = q.or(`produto_codigo.ilike.%${search}%,produto_nome.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      const seen = new Set<string>();
      return ((data as any[]) || []).filter((s) => {
        if (!s.produto_codigo || seen.has(s.produto_codigo)) return false;
        seen.add(s.produto_codigo);
        return true;
      });
    },
  });

  const list = useMemo(() => items, [items]);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-3 space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Catálogo China</h3>
          <Badge variant="secondary" className="ml-auto text-[10px]">{list.length} produtos</Badge>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar código ou nome..."
            className="pl-7 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <p className="p-4 text-xs text-muted-foreground text-center">Carregando catálogo...</p>
        ) : list.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nenhum produto" description="Cadastre uma submissão China para popular o catálogo." />
        ) : (
          <div className="p-2 grid gap-1.5">
            {list.map((p) => (
              <Card key={p.id} className="p-2.5 flex items-center gap-3 hover:bg-muted/40 transition">
                <div className="h-10 w-10 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {p.foto_url ? (
                    <img src={p.foto_url} alt={p.produto_codigo} className="h-full w-full object-cover" />
                  ) : (
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.produto_codigo}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.produto_nome}</div>
                </div>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelected(p)}>
                  <Plus className="h-3.5 w-3.5" /> Nova OC
                </Button>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {selected && (
        <EmitirOCDialog
          open={!!selected}
          onOpenChange={(o) => { if (!o) setSelected(null); }}
          submissao={selected}
          onSuccess={() => { setSelected(null); onCreated(); }}
        />
      )}
    </div>
  );
}
