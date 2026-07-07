/**
 * MembrosAuditLog — histórico de entradas e saídas de colaboradores do projeto.
 *
 * Lê de `projeto_tarefa_acesso_audit` filtrando pelos motivos
 * `membro_projeto_adicionado` e `membro_projeto_removido`. A RLS permite leitura
 * para admin, coordenadores e gestores de produto do projeto (além do próprio
 * afetado e do ator).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, UserMinus, ShieldCheck, Loader2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AuditRow {
  id: string;
  motivo: string;
  papel_anterior: string | null;
  papel_novo: string | null;
  ator_id: string | null;
  user_afetado_id: string;
  created_at: string;
}

interface ProfileMini {
  id: string;
  nome: string | null;
  avatar_url: string | null;
}

interface Props {
  projetoId: string;
  darkBg?: boolean;
}

export function MembrosAuditLog({ projetoId, darkBg = false }: Props) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["membros-audit-log", projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projeto_tarefa_acesso_audit")
        .select("id, motivo, papel_anterior, papel_novo, ator_id, user_afetado_id, created_at")
        .eq("projeto_id", projetoId)
        .in("motivo", ["membro_projeto_adicionado", "membro_projeto_removido"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const userIds = Array.from(
    new Set(
      rows.flatMap((r) => [r.ator_id, r.user_afetado_id].filter(Boolean) as string[])
    )
  );

  const { data: profiles = {} } = useQuery({
    queryKey: ["membros-audit-profiles", projetoId, userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url")
        .in("id", userIds);
      if (error) throw error;
      const map: Record<string, ProfileMini> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p; });
      return map;
    },
  });

  const textMuted = darkBg ? "text-white/60" : "text-muted-foreground";

  return (
    <Card className={darkBg ? "bg-white/5 border-white/10" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className={cn("text-base flex items-center gap-2", darkBg && "text-white")}>
          <ShieldCheck className="h-4 w-4" />
          Histórico de acessos da equipe
        </CardTitle>
        <p className={cn("text-xs", textMuted)}>
          Registro de quem adicionou ou removeu cada colaborador do projeto.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className={cn("text-sm py-6 text-center", textMuted)}>
            Nenhum evento registrado até o momento.
          </p>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {rows.map((r) => {
              const isAdd = r.motivo === "membro_projeto_adicionado";
              const ator = r.ator_id ? profiles[r.ator_id] : null;
              const afetado = profiles[r.user_afetado_id];
              const dt = new Date(r.created_at);
              const papel = r.papel_novo || r.papel_anterior || "membro";
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3",
                    darkBg ? "border-white/10 bg-white/5" : "bg-card"
                  )}
                >
                  <div
                    className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                      isAdd
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-red-500/15 text-red-600 dark:text-red-400"
                    )}
                  >
                    {isAdd ? <UserPlus className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={afetado?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[9px]">
                          {(afetado?.nome ?? "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className={cn("text-sm font-medium truncate", darkBg && "text-white")}>
                        {afetado?.nome ?? "Usuário removido"}
                      </span>
                      <Badge
                        variant={isAdd ? "default" : "destructive"}
                        className="text-[9px] h-4 px-1.5"
                      >
                        {isAdd ? "Adicionado" : "Removido"}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize">
                        {papel.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className={cn("text-xs mt-1 flex items-center gap-1.5 flex-wrap", textMuted)}>
                      <span>por</span>
                      {ator ? (
                        <>
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={ator.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[8px]">
                              {(ator.nome ?? "?").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className={cn("font-medium", darkBg && "text-white/80")}>
                            {ator.nome ?? "Desconhecido"}
                          </span>
                        </>
                      ) : (
                        <span className="italic">sistema</span>
                      )}
                      <span>·</span>
                      <span title={format(dt, "dd/MM/yyyy HH:mm", { locale: ptBR })}>
                        {formatDistanceToNow(dt, { addSuffix: true, locale: ptBR })}
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
