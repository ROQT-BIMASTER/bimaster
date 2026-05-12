/**
 * ResumeDraftBanner — busca o último rascunho não finalizado do usuário
 * e oferece retomada com um clique. Mostra apenas quando o usuário entra
 * em /dashboard/fabrica-china/nova SEM um submissaoId na rota.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FileClock, X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  /** Se true, o banner não é renderizado (estamos editando um rascunho específico). */
  hidden?: boolean;
}

export function ResumeDraftBanner({ hidden }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const { data: rascunho } = useQuery({
    queryKey: ["china-last-rascunho", user?.id],
    enabled: !!user?.id && !hidden,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("china_produto_submissoes" as any)
        .select("id, produto_codigo, produto_nome, numero_ordem, updated_at, created_at")
        .eq("created_by", user!.id)
        .eq("status", "rascunho")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  if (hidden || dismissed || !rascunho) return null;

  const titulo = rascunho.numero_ordem
    || rascunho.produto_codigo
    || rascunho.produto_nome
    || "rascunho sem identificação";

  const quando = rascunho.updated_at
    ? format(new Date(rascunho.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : "";

  return (
    <Card className="p-3 border-warning/30 bg-warning/5 flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-warning/15 flex items-center justify-center shrink-0">
        <FileClock className="h-4 w-4 text-warning" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Você tem um rascunho não finalizado: <span className="font-semibold">{titulo}</span>
        </p>
        {quando && (
          <p className="text-xs text-muted-foreground">Última edição: {quando}</p>
        )}
      </div>
      <Button
        size="sm"
        className="gap-1"
        onClick={() => navigate(`/dashboard/fabrica-china/nova/${rascunho.id}`)}
      >
        Retomar de onde parei
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => setDismissed(true)}
        title="Dispensar"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );
}
