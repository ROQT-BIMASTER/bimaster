import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FolderKanban, MessageSquarePlus, Send, Loader2, Clock, User,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  submissaoId: string;
}

interface VinculoComTarefa {
  id: string;
  tarefa_id: string;
  projeto_id: string;
  secao_id: string | null;
  created_at: string;
  tarefa?: {
    titulo: string;
    status: string;
    estagio: string | null;
    codigo: string | null;
  };
  projeto?: { nome: string; cor: string | null };
  secao?: { nome: string };
}

interface Comentario {
  id: string;
  conteudo: string;
  created_at: string;
  user_id: string;
  autor?: { nome: string; avatar_url: string | null };
}

export function TarefasVinculadasPanel({ submissaoId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [novoComentario, setNovoComentario] = useState("");

  // Fetch vinculos with task/project info
  const { data: vinculos = [], isLoading } = useQuery({
    queryKey: ["composicao-tarefas-vinculadas", submissaoId],
    queryFn: async () => {
      const { data: vincs, error } = await (supabase
        .from("china_submissao_tarefa_vinculos" as any)
        .select("id, tarefa_id, projeto_id, secao_id, created_at")
        .eq("submissao_id", submissaoId) as any);
      if (error) throw error;
      if (!vincs || vincs.length === 0) return [];

      const tarefaIds = [...new Set((vincs as any[]).map((v: any) => v.tarefa_id))];
      const projetoIds = [...new Set((vincs as any[]).map((v: any) => v.projeto_id))];
      const secaoIds = (vincs as any[]).map((v: any) => v.secao_id).filter(Boolean);

      const [tarefasRes, projetosRes, secoesRes] = await Promise.all([
        supabase.from("projeto_tarefas").select("id, titulo, status, estagio, codigo").in("id", tarefaIds),
        supabase.from("projetos").select("id, nome, cor").in("id", projetoIds),
        secaoIds.length > 0
          ? supabase.from("projeto_secoes").select("id, nome").in("id", secaoIds)
          : Promise.resolve({ data: [] }),
      ]);

      const tarefaMap = Object.fromEntries((tarefasRes.data || []).map((t: any) => [t.id, t]));
      const projetoMap = Object.fromEntries((projetosRes.data || []).map((p: any) => [p.id, p]));
      const secaoMap = Object.fromEntries(((secoesRes as any).data || []).map((s: any) => [s.id, s]));

      return (vincs as any[]).map((v: any) => ({
        ...v,
        tarefa: tarefaMap[v.tarefa_id] || null,
        projeto: projetoMap[v.projeto_id] || null,
        secao: v.secao_id ? secaoMap[v.secao_id] || null : null,
      })) as VinculoComTarefa[];
    },
  });

  // Fetch comments for expanded task
  const { data: comentarios = [], isLoading: loadingComments } = useQuery({
    queryKey: ["tarefa-comentarios-composicao", expandedTask],
    enabled: !!expandedTask,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_tarefa_comentarios")
        .select("*")
        .eq("tarefa_id", expandedTask!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data as any[]).map((c: any) => c.user_id))];
      let profiles: Record<string, { nome: string; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id, nome, avatar_url").in("id", userIds);
        if (p) profiles = Object.fromEntries(p.map((x: any) => [x.id, { nome: x.nome, avatar_url: x.avatar_url }]));
      }

      return (data as any[]).map((c: any) => ({
        ...c,
        autor: profiles[c.user_id] || { nome: "Usuário", avatar_url: null },
      })) as Comentario[];
    },
  });

  // Add comment mutation
  const addComment = useMutation({
    mutationFn: async ({ tarefaId, conteudo }: { tarefaId: string; conteudo: string }) => {
      const { error } = await supabase.from("projeto_tarefa_comentarios").insert({
        tarefa_id: tarefaId,
        user_id: user!.id,
        conteudo,
        mentions: [],
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarefa-comentarios-composicao", expandedTask] });
      setNovoComentario("");
      toast.success("Atualização adicionada");
    },
    onError: () => toast.error("Erro ao adicionar atualização"),
  });

  const handleSendComment = () => {
    if (!expandedTask || !novoComentario.trim()) return;
    addComment.mutate({ tarefaId: expandedTask, conteudo: novoComentario.trim() });
  };

  const statusIcon = (status: string) => {
    if (status === "concluida") return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (status === "em_andamento") return <Clock className="h-4 w-4 text-warning" />;
    return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (vinculos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-sm">Nenhuma tarefa vinculada</p>
          <p className="text-xs mt-1">As tarefas são vinculadas automaticamente pela tela <strong>Vincular China</strong>.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {vinculos.map((vinc) => {
        const isExpanded = expandedTask === vinc.tarefa_id;
        return (
          <Card key={vinc.id} className={isExpanded ? "border-primary/40" : ""}>
            <CardContent className="p-0">
              {/* Task header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedTask(isExpanded ? null : vinc.tarefa_id)}
              >
                {statusIcon(vinc.tarefa?.status || "")}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {vinc.tarefa?.titulo || "Tarefa não encontrada"}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {vinc.projeto && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-normal gap-1">
                        <FolderKanban className="h-2.5 w-2.5" />
                        {vinc.projeto.nome}
                      </Badge>
                    )}
                    {vinc.secao && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-normal">
                        {vinc.secao.nome}
                      </Badge>
                    )}
                    {vinc.tarefa?.codigo && (
                      <span className="text-[10px] text-muted-foreground font-mono">{vinc.tarefa.codigo}</span>
                    )}
                  </div>
                </div>
                <Badge
                  variant={vinc.tarefa?.status === "concluida" ? "success" : vinc.tarefa?.status === "em_andamento" ? "warning" : "secondary"}
                  className="text-[10px] shrink-0"
                >
                  {vinc.tarefa?.status?.replace(/_/g, " ") || "—"}
                </Badge>
                <MessageSquarePlus className={`h-4 w-4 transition-transform ${isExpanded ? "text-primary rotate-45" : "text-muted-foreground"}`} />
              </div>

              {/* Expanded: comments + add */}
              {isExpanded && (
                <div className="border-t px-4 pb-4 pt-3 space-y-3">
                  {loadingComments ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : comentarios.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Nenhuma atualização registrada</p>
                  ) : (
                    <ScrollArea className="max-h-[280px]">
                      <div className="space-y-2.5">
                        {comentarios.map((c) => (
                          <div key={c.id} className="flex gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              {c.autor?.avatar_url ? (
                                <img src={c.autor.avatar_url} className="w-7 h-7 rounded-full object-cover" alt="" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{c.autor?.nome || "Usuário"}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(c.created_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">{c.conteudo}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  {/* Add comment */}
                  <div className="flex gap-2">
                    <Textarea
                      value={novoComentario}
                      onChange={(e) => setNovoComentario(e.target.value)}
                      placeholder="Adicionar atualização..."
                      className="text-xs min-h-[60px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendComment();
                      }}
                    />
                    <Button
                      size="icon"
                      className="shrink-0 self-end"
                      disabled={!novoComentario.trim() || addComment.isPending}
                      onClick={handleSendComment}
                    >
                      {addComment.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
