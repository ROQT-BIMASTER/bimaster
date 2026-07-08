import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, Rocket, XCircle } from "lucide-react";

interface Props {
  processoId: string;
  onPublicar: () => void;
  publicando: boolean;
}

export function StepRevisao({ processoId, onPublicar, publicando }: Props) {
  const { data: validacao, isLoading } = useQuery({
    queryKey: ["processo-validacao", processoId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_validar_processo" as any, {
        _processo_id: processoId,
      });
      if (error) throw error;
      return data as { ok: boolean; erros: string[]; avisos: string[] };
    },
  });

  const { data: resumo } = useQuery({
    queryKey: ["processo-resumo", processoId],
    queryFn: async () => {
      const [p, e, l] = await Promise.all([
        supabase.from("processos_operacionais" as any).select("*").eq("id", processoId).maybeSingle(),
        supabase.from("processo_etapas" as any).select("id, ordem, sla_minutos, rotina_fixa_id").eq("processo_id", processoId).order("ordem"),
        supabase.from("processo_ligacoes" as any).select("*").eq("processo_id", processoId),
      ]);
      return {
        processo: p.data as any,
        etapas: (e.data ?? []) as any[],
        ligacoes: (l.data ?? []) as any[],
      };
    },
  });

  const totalSla = (resumo?.etapas ?? []).reduce(
    (acc: number, x: any) => acc + (x.sla_minutos ?? 0),
    0,
  );

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{resumo?.etapas.length ?? 0} etapa(s)</Badge>
          <Badge variant="outline">{resumo?.ligacoes.length ?? 0} ligação(ões)</Badge>
          <Badge variant="outline">SLA total: {Math.round(totalSla / 60)}h {totalSla % 60}min</Badge>
          <Badge variant={resumo?.processo?.ativo ? "default" : "secondary"}>
            {resumo?.processo?.ativo ? "Ativo" : "Rascunho"}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Validação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {isLoading ? (
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Validando…
            </span>
          ) : validacao?.ok && (validacao?.erros ?? []).length === 0 ? (
            <span className="inline-flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Processo pronto para publicação.
            </span>
          ) : (
            <ul className="space-y-1">
              {(validacao?.erros ?? []).map((er, i) => (
                <li key={`e-${i}`} className="inline-flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" /> {er}
                </li>
              ))}
            </ul>
          )}
          {(validacao?.avisos ?? []).map((av, i) => (
            <div key={`a-${i}`} className="inline-flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4" /> {av}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={onPublicar}
          disabled={publicando || !(validacao?.ok ?? false) || (validacao?.erros ?? []).length > 0}
        >
          {publicando ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4 mr-1" />
          )}
          Publicar processo
        </Button>
      </div>
    </div>
  );
}
