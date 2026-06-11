import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowDownToLine, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissaoId: string | null;
}

interface Doc {
  id: string;
  tipo_documento: string;
  status: string;
  arquivo_path: string | null;
  observacao: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  rascunho: "Rascunho",
  enviado_brasil: "Enviado",
  enviado_parcial: "Enviado parcial",
  em_revisao: "Em revisão",
  aprovado: "Aprovado",
  rejeitado: "Devolvido",
};

const STATUS_TONE: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  rascunho: "bg-muted text-muted-foreground",
  enviado_brasil: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  enviado_parcial: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  em_revisao: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  aprovado: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  rejeitado: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200",
};

/**
 * Painel lateral somente-leitura: lista os documentos que a China enviou ao Brasil
 * dentro desta submissão (perspectiva Brasil). A ação real de aprovar/devolver
 * acontece na aba "Submissão China" (Kanban) ou no Sheet da tarefa-espelho.
 */
export function ChecklistC2BSheet({ open, onOpenChange, submissaoId }: Props) {
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["china-checklist-c2b", submissaoId],
    enabled: !!submissaoId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_documentos" as any)
        .select("id, tipo_documento, status, arquivo_path, observacao, created_at")
        .eq("submissao_id", submissaoId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Doc[];
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-base flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4 text-primary" />
            Checklist China → Brasil
          </SheetTitle>
          <SheetDescription className="text-xs">
            Documentos vindos da China nesta submissão. Use a aba "Submissão China" do projeto
            para aprovar, devolver ou criar lotes de aprovação.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
            </div>
          ) : docs.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Nenhum documento da China ainda nesta submissão.
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {docs.map((d) => (
                <li key={d.id} className="px-3 py-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{d.tipo_documento}</p>
                      {d.observacao && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{d.observacao}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(d.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Badge className={`h-4 px-1.5 text-[9px] font-normal ${STATUS_TONE[d.status] || ""}`}>
                      {STATUS_LABEL[d.status] || d.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
