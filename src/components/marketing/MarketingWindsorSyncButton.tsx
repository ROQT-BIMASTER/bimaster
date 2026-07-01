/**
 * Marketing — Botão admin para disparar a descoberta do Windsor (Fase 1a).
 *
 * Invoca a Edge Function `windsor-sync` autenticado com o JWT do usuário
 * logado. Só renderiza para admins. Não persiste histórico — estado local.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";

interface WindsorSummary {
  linhas_recebidas: number;
  contas_catalogadas: number;
  sources?: Array<{ source: string; count: number }>;
}

export function MarketingWindsorSyncButton() {
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [ultimaExecucao, setUltimaExecucao] = useState<Date | null>(null);
  const [ultimoResumo, setUltimoResumo] = useState<WindsorSummary | null>(null);

  if (!isAdmin) return null;

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<WindsorSummary>(
        "windsor-sync",
        { body: {} },
      );

      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 401 || status === 403) {
          toast.error("Sem permissão: faça login como admin.");
        } else if (status === 502) {
          toast.error("Windsor indisponível ou chave inválida — ver logs da função.");
        } else {
          toast.error("Falha ao sincronizar Windsor.");
          console.error("windsor-sync error", error);
        }
        return;
      }

      if (!data) {
        toast.error("Resposta vazia da função.");
        return;
      }

      setUltimoResumo(data);
      setUltimaExecucao(new Date());
      toast.success(
        `Descoberta concluída: ${data.linhas_recebidas} linhas, ${data.contas_catalogadas} contas catalogadas`,
      );
    } catch (e) {
      console.error("windsor-sync exception", e);
      toast.error("Falha ao sincronizar Windsor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={handleClick} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sincronizando…
          </>
        ) : (
          "Sincronizar Windsor (descoberta)"
        )}
      </Button>

      <p className="text-xs text-muted-foreground max-w-xl">
        Cataloga as contas do Windsor em mkt_windsor_map. Não grava métricas
        ainda — preencha marca e plataforma nas contas antes da sincronização
        completa.
      </p>

      {ultimaExecucao && (
        <p className="text-xs text-muted-foreground">
          Última execução: {ultimaExecucao.toLocaleTimeString("pt-BR")}
        </p>
      )}

      {ultimoResumo?.sources && ultimoResumo.sources.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">
            Sources descobertos
          </p>
          <ul className="flex flex-wrap gap-2">
            {ultimoResumo.sources.map((s) => (
              <li key={s.source}>
                <Badge variant="secondary">
                  {s.source} · {s.count}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default MarketingWindsorSyncButton;
