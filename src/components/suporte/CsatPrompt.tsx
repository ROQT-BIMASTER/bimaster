import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const sb = supabase as any;

interface Props {
  ticketId: string;
}

export function CsatPrompt({ ticketId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [score, setScore] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [comentario, setComentario] = useState("");

  const existente = useQuery({
    queryKey: ["suporte", "csat", ticketId, user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await sb
        .from("suporte_csat")
        .select("id, score, comentario")
        .eq("ticket_id", ticketId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as { id: string; score: number; comentario: string | null } | null;
    },
  });

  const enviar = useMutation({
    mutationFn: async () => {
      if (score < 1 || score > 5) throw new Error("Selecione de 1 a 5 estrelas");
      const { error } = await sb.from("suporte_csat").insert({
        ticket_id: ticketId,
        user_id: user!.id,
        score,
        comentario: comentario.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Obrigado pela avaliação");
      qc.invalidateQueries({ queryKey: ["suporte", "csat", ticketId, user?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar avaliação"),
  });

  if (existente.data) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-3 flex items-center gap-2 text-sm">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={`h-4 w-4 ${s <= existente.data!.score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
            ))}
          </div>
          <span className="text-muted-foreground">Você já avaliou este atendimento.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="text-sm font-medium">Como foi este atendimento?</div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              className="p-0.5"
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setScore(s)}
            >
              <Star className={`h-6 w-6 transition-colors ${
                (hover || score) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
              }`} />
            </button>
          ))}
          {score > 0 && <span className="text-xs text-muted-foreground ml-2">{score} de 5</span>}
        </div>
        <Textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value.slice(0, 500))}
          placeholder="Comentário (opcional)"
          className="text-sm min-h-[60px]"
        />
        <Button size="sm" onClick={() => enviar.mutate()} disabled={score === 0 || enviar.isPending}>
          Enviar avaliação
        </Button>
      </CardContent>
    </Card>
  );
}
