import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Check, X, Inbox } from "lucide-react";
import { useMeusConvitesPendentes } from "@/hooks/useProjetoConvites";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ProjetosConvites() {
  const { data: convites = [], isLoading, refetch } = useMeusConvitesPendentes();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const handleAccept = async (token: string, projetoId: string) => {
    const { data, error } = await supabase.rpc("accept_projeto_convite" as any, { _token: token });
    if (error || !(data as any)?.ok) {
      toast.error("Não foi possível aceitar: " + ((data as any)?.error || error?.message));
      return;
    }
    toast.success("Convite aceito!");
    qc.invalidateQueries({ queryKey: ["meus_convites_pendentes"] });
    navigate(`/dashboard/projetos/${projetoId}`);
  };

  const handleDecline = async (token: string) => {
    const { data, error } = await supabase.rpc("decline_projeto_convite" as any, { _token: token });
    if (error || !(data as any)?.ok) {
      toast.error("Erro ao recusar.");
      return;
    }
    toast.success("Convite recusado.");
    refetch();
  };

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Meus convites</h1>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && convites.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Você não tem convites pendentes.</p>
          </CardContent>
        </Card>
      )}

      {convites.map((c: any) => (
        <Card key={c.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>{c.projetos?.nome || "Projeto"}</span>
              <Badge variant="secondary">{c.papel}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {c.mensagem && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-primary pl-3">
                "{c.mensagem}"
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Convite recebido{" "}
              {formatDistanceToNow(new Date(c.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
              {" · "}expira{" "}
              {formatDistanceToNow(new Date(c.expires_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleAccept(c.token, c.projeto_id)}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecline(c.token)}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Recusar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
