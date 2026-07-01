/**
 * Admin — Configurações → Marketing → Integrações
 *
 * Hospeda ações administrativas de integrações do módulo de marketing.
 * Fase 1a: botão de descoberta do Windsor.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketingWindsorSyncButton } from "@/components/marketing/MarketingWindsorSyncButton";
import { useUserRole } from "@/hooks/useUserRole";

export default function MarketingIntegracoesPage() {
  const { isAdmin, loading } = useUserRole() as { isAdmin: boolean; loading?: boolean };

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>
              Esta página é restrita a administradores.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Integrações de Marketing
        </h1>
        <p className="text-sm text-muted-foreground">
          Ações administrativas das conexões de dados do módulo de marketing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sincronização de métricas (Windsor)</CardTitle>
          <CardDescription>
            Roda o pipeline por conector (Instagram, Facebook orgânico, TikTok
            orgânico) e grava métricas de conta e posts. A catalogação de
            contas em mkt_windsor_map ocorre como efeito do resolvedor de
            marca dentro do laço — não há mais chamada ao endpoint /all.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <MarketingWindsorSyncButton />
        </CardContent>
      </Card>
    </div>
  );
}
