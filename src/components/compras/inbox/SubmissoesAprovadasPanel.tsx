import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FileStack, Plus, Search } from "lucide-react";
import { EmitirOCDialog } from "@/components/china/EmitirOCDialog";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SubmissoesAprovadasPanelProps {
  onCreated: () => void;
}

export function SubmissoesAprovadasPanel({ onCreated }: SubmissoesAprovadasPanelProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["submissoes-aprovadas", search],
    queryFn: async () => {
      let q = supabase
        .from("china_produto_submissoes" as any)
        .select("id, produto_codigo, produto_nome, qty_total, ean_caixa_master, status, aprovado_em, created_at")
        .is("deleted_at", null)
        .in("status", ["aprovada", "homologada", "em_producao_homologada", "aprovado"])
        .order("aprovado_em", { ascending: false, nullsFirst: false })
        .limit(200);
      if (search.trim()) {
        q = q.or(`produto_codigo.ilike.%${search}%,produto_nome.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-3 space-y-2">
        <div className="flex items-center gap-2">
          <FileStack className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Submissões aprovadas</h3>
          <Badge variant="secondary" className="ml-auto text-[10px]">{items.length}</Badge>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-7 h-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <p className="p-4 text-xs text-muted-foreground text-center">Carregando...</p>
        ) : items.length === 0 ? (
          <EmptyState icon={FileStack} title="Sem submissões aprovadas" description="Submissões prontas para virar OC aparecerão aqui." />
        ) : (
          <div className="p-2 grid gap-1.5">
            {items.map((s) => {
              const dt = parseLocalDate(s.aprovado_em || s.created_at);
              return (
                <Card key={s.id} className="p-2.5 flex items-center gap-3 hover:bg-muted/40">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.produto_codigo}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.produto_nome}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Qty {(s.qty_total ?? 0).toLocaleString("pt-BR")} · {s.status}
                      {dt ? ` · ${format(dt, "dd MMM yyyy", { locale: ptBR })}` : ""}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelected(s)}>
                    <Plus className="h-3.5 w-3.5" /> Emitir OC
                  </Button>
                </Card>
              );
            })}
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
