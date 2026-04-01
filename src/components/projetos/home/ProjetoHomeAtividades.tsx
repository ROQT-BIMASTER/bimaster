import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, MessageSquare, CheckCircle2, UserPlus, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const tipoIcones: Record<string, React.ElementType> = {
  comentou: MessageSquare,
  concluiu: CheckCircle2,
  atribuiu: UserPlus,
  criou: FileText,
};

export function ProjetoHomeAtividades() {
  const { user } = useAuth();

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ["home-atividades-recentes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_atividades")
        .select("id, tipo, descricao, created_at, projeto_id")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!data?.length) return [];

      const projetoIds = [...new Set(data.map(a => a.projeto_id))];
      const { data: projetos } = await supabase
        .from("projetos")
        .select("id, nome, cor")
        .in("id", projetoIds);

      const pMap = Object.fromEntries((projetos || []).map(p => [p.id, p]));

      return data.map(a => ({
        ...a,
        projeto_nome: pMap[a.projeto_id]?.nome || "Projeto",
        projeto_cor: pMap[a.projeto_id]?.cor || "#6366f1",
      }));
    },
    enabled: !!user?.id,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Atividade Recente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : atividades.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Nenhuma atividade recente
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {atividades.map(a => {
              const Icon = tipoIcones[a.tipo] || Activity;
              return (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <div
                    className="mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${a.projeto_cor}20` }}
                  >
                    <Icon className="h-3 w-3" style={{ color: a.projeto_cor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground line-clamp-2">{a.descricao || a.tipo}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a.projeto_cor }} />
                      <span className="text-[10px] text-muted-foreground truncate">{a.projeto_nome}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
