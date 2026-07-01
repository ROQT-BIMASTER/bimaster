/**
 * Marketing — Botão admin para rodar o sync de métricas do Windsor (Fase 1b).
 *
 * Invoca a Edge Function `windsor-sync` autenticado com o JWT do usuário
 * logado. Roda o pipeline por-conector (mkt_contas / mkt_metricas_conta /
 * mkt_posts). Distingue "licença/limite do Windsor" de "sem dados".
 */
import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUserRole } from "@/hooks/useUserRole";

interface ConectorResumo {
  slug: string;
  contas: number;
  metricas: number;
  posts: number;
  erro?: string;
}

interface WindsorSyncResult {
  por_conector: ConectorResumo[];
  total: { contas: number; metricas: number; posts: number };
  license_blocked?: boolean;
}

export function MarketingWindsorSyncButton() {
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [ultimaExecucao, setUltimaExecucao] = useState<Date | null>(null);
  const [resultado, setResultado] = useState<WindsorSyncResult | null>(null);

  if (!isAdmin) return null;

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<WindsorSyncResult>(
        "windsor-sync",
        { body: {} },
      );

      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 401 || status === 403) {
          toast.error("Sem permissão: faça login como admin.");
        } else if (status === 502) {
          toast.error("Windsor indisponível — ver logs da função.");
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

      // A função pode responder em shapes diferentes (por-conector, diagnóstico,
      // legado). Normalizamos para não estourar no render.
      const normalizado: WindsorSyncResult = {
        por_conector: Array.isArray((data as any)?.por_conector)
          ? ((data as any).por_conector as ConectorResumo[])
          : [],
        total: {
          contas: Number((data as any)?.total?.contas ?? 0),
          metricas: Number((data as any)?.total?.metricas ?? 0),
          posts: Number((data as any)?.total?.posts ?? 0),
        },
        license_blocked: Boolean((data as any)?.license_blocked),
      };

      setResultado(normalizado);
      setUltimaExecucao(new Date());

      const { total, license_blocked, por_conector } = normalizado;
      if (license_blocked) {
        toast.warning(
          "Feed do Windsor bloqueado (licença/limite). Verifique o plano da conta Windsor.",
        );
      } else if (por_conector.length === 0) {
        toast.info("Função respondeu sem dados por-conector.");
      } else {
        toast.success(
          `Sincronização concluída: ${total.contas} contas, ${total.metricas} métricas, ${total.posts} posts.`,
        );
      }
    } catch (e) {
      console.error("windsor-sync exception", e);
      toast.error("Falha ao sincronizar Windsor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleClick} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sincronizando…
          </>
        ) : (
          "Sincronizar métricas (Windsor)"
        )}
      </Button>

      <p className="text-xs text-muted-foreground max-w-xl">
        Executa o pipeline por conector (Instagram, Facebook orgânico, TikTok
        orgânico) e grava métricas de conta e posts. A catalogação de contas em
        mkt_windsor_map acontece como efeito do resolvedor de marca dentro do
        laço.
      </p>

      {ultimaExecucao && (
        <p className="text-xs text-muted-foreground">
          Última execução: {ultimaExecucao.toLocaleTimeString("pt-BR")}
        </p>
      )}

      {resultado?.license_blocked && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Feed do Windsor bloqueado</AlertTitle>
          <AlertDescription>
            Um ou mais conectores retornaram "license expired". Isso é limite
            de plano da conta Windsor — resolva o billing para o feed voltar.
          </AlertDescription>
        </Alert>
      )}

      {resultado && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Resultado por conector</p>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Conector</th>
                  <th className="px-3 py-2 font-medium text-right">Contas</th>
                  <th className="px-3 py-2 font-medium text-right">Métricas</th>
                  <th className="px-3 py-2 font-medium text-right">Posts</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {resultado.por_conector.map((c) => (
                  <tr key={c.slug} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{c.slug}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.contas}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.metricas}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.posts}</td>
                    <td className="px-3 py-2">
                      {c.erro === "license_blocked" ? (
                        <Badge variant="destructive">Licença/limite</Badge>
                      ) : c.erro ? (
                        <Badge variant="secondary">{c.erro}</Badge>
                      ) : (
                        <Badge variant="outline">OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30">
                <tr className="border-t border-border font-medium">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{resultado.total.contas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{resultado.total.metricas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{resultado.total.posts}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketingWindsorSyncButton;
