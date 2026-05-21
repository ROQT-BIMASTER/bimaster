import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Props {
  briefingId: string;
  refreshKey?: number;
}

interface Instancia {
  id: string;
  status: string;
  etapa_atual_ordem: number;
  titulo: string | null;
  prazo_lote: string | null;
  created_at: string;
}

interface Etapa {
  id: string;
  nome: string;
  ordem: number;
}

interface Aprovador {
  id: string;
  etapa_id: string;
  usuario_id: string | null;
  status: string;
  observacao: string | null;
}

interface Profile {
  id: string;
  nome: string | null;
  email: string | null;
}

export function AprovacaoTimeline({ briefingId, refreshKey }: Props) {
  const [instancia, setInstancia] = useState<Instancia | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [aprovadores, setAprovadores] = useState<Aprovador[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let canceled = false;
    (async () => {
      setLoading(true);
      const { data: insts } = await supabase
        .from("fluxo_aprovacao_instancias")
        .select("id, status, etapa_atual_ordem, titulo, prazo_lote, created_at, config_id")
        .eq("briefing_id", briefingId)
        .order("created_at", { ascending: false })
        .limit(1);
      const inst = (insts ?? [])[0] as any;
      if (canceled) return;
      if (!inst) {
        setInstancia(null);
        setEtapas([]);
        setAprovadores([]);
        setLoading(false);
        return;
      }
      setInstancia(inst);
      const [{ data: ets }, { data: aps }] = await Promise.all([
        supabase
          .from("fluxo_aprovacao_etapas")
          .select("id, nome, ordem")
          .eq("config_id", inst.config_id)
          .eq("ativo", true)
          .order("ordem"),
        supabase
          .from("fluxo_aprovacao_aprovadores")
          .select("id, etapa_id, usuario_id, status, observacao")
          .eq("instancia_id", inst.id),
      ]);
      if (canceled) return;
      setEtapas((ets ?? []) as Etapa[]);
      const lista = (aps ?? []) as Aprovador[];
      setAprovadores(lista);

      const ids = Array.from(new Set(lista.map((a) => a.usuario_id).filter(Boolean) as string[]));
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome, email")
          .in("id", ids);
        const map: Record<string, Profile> = {};
        (profs ?? []).forEach((p: any) => (map[p.id] = p));
        setProfiles(map);
      }
      setLoading(false);
    })();
    return () => {
      canceled = true;
    };
  }, [briefingId, refreshKey]);

  if (loading) {
    return <div className="text-xs text-muted-foreground">Carregando aprovação…</div>;
  }
  if (!instancia) return null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Fluxo de aprovação</div>
          <div className="text-[11px] text-muted-foreground">
            Status: <span className="capitalize">{instancia.status.replace(/_/g, " ")}</span>
            {instancia.prazo_lote && ` · Prazo ${instancia.prazo_lote}`}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {etapas.map((etapa, idx) => {
          const aps = aprovadores.filter((a) => a.etapa_id === etapa.id);
          const aprovado = aps.length > 0 && aps.every((a) => a.status === "aprovado");
          const reprovado = aps.some((a) => a.status === "reprovado");
          const ativa = idx === instancia.etapa_atual_ordem && instancia.status === "pendente";
          const futura = idx > instancia.etapa_atual_ordem && instancia.status === "pendente";

          const Icon = reprovado
            ? XCircle
            : aprovado
              ? CheckCircle2
              : ativa
                ? Clock
                : AlertCircle;

          const tone = reprovado
            ? "text-red-600"
            : aprovado
              ? "text-emerald-600"
              : ativa
                ? "text-blue-600"
                : "text-muted-foreground/60";

          return (
            <div key={etapa.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-0.5">
                <Icon className={cn("h-4 w-4", tone)} />
                {idx < etapas.length - 1 && <div className="w-px flex-1 bg-border min-h-[20px] mt-1" />}
              </div>
              <div
                className={cn(
                  "flex-1 pb-2",
                  futura && "opacity-50",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-medium", ativa && "text-blue-700")}>
                    {etapa.nome}
                  </span>
                  {ativa && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-1.5 py-0.5 rounded">
                      em andamento
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {aps.map((a) => {
                    const p = a.usuario_id ? profiles[a.usuario_id] : null;
                    const nome = p?.nome ?? p?.email ?? "Usuário";
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px]"
                        title={a.observacao ?? undefined}
                      >
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {nome.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{nome}</span>
                        <span
                          className={cn(
                            "text-[10px]",
                            a.status === "aprovado" && "text-emerald-600",
                            a.status === "reprovado" && "text-red-600",
                            a.status === "pendente" && "text-muted-foreground",
                          )}
                        >
                          · {a.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
