import { useEffect, useRef } from "react";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

/**
 * Mapa moduleCode → import dinâmico da página principal do módulo.
 * Module codes desconhecidos são silenciosamente ignorados.
 */
export const MODULE_LOADERS: Record<string, () => Promise<unknown>> = {
  financeiro: () => import("@/pages/Financeiro"),
  contas_pagar: () => import("@/pages/ContasAPagar"),
  contas_receber: () => import("@/pages/ContasAReceber"),
  fluxo_caixa: () => import("@/pages/FluxoDeCaixa"),
  conciliacao: () => import("@/pages/financeiro/ConciliacaoBancaria"),

  trade: () => import("@/pages/modules/MarketingModule"),
  marketing: () => import("@/pages/modules/MarketingModule"),
  influencers: () => import("@/pages/marketing/InfluencersPage"),

  fabrica: () => import("@/pages/ChinaFabrica"),
  fabrica_tabelas_preco: () => import("@/pages/FabricaTabelasPreco"),
  composicao: () => import("@/pages/CentralComposicao"),
  embalagens: () => import("@/pages/CentralEmbalagens"),
  amostras: () => import("@/pages/CentralAmostras"),

  china: () => import("@/pages/ChinaCaixaEntrada"),
  china_ordens: () => import("@/pages/ChinaOrdens"),
  china_torre: () => import("@/pages/ChinaTorreContainers"),

  comercial: () => import("@/pages/modules/ComercialModule"),
  prospects: () => import("@/pages/modules/ProspectsModule"),
  comercial_mapa: () => import("@/pages/ComercialMapa"),

  projetos: () => import("@/pages/Projetos"),
  central_trabalho: () => import("@/pages/CentralTrabalho"),
  central_aprovacoes: () => import("@/pages/CentralAprovacoes"),
};

/**
 * Pré-carrega em background os chunks dos módulos a que o usuário tem acesso,
 * após sessão autenticada e permissões prontas. Idempotente por sessão.
 */
export function useModulePreloader() {
  const { session } = useAuth();
  const { loading, permissionsReady, modules } = usePermissions();
  const preloadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!session || loading || !permissionsReady) return;
    if (!modules || modules.length === 0) return;

    const ric: (cb: IdleRequestCallback) => number =
      (globalThis as any).requestIdleCallback ??
      ((cb: IdleRequestCallback) =>
        setTimeout(
          () => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline),
          200,
        ) as unknown as number);

    const handle = ric(() => {
      for (const moduleCode of modules) {
        if (preloadedRef.current.has(moduleCode)) continue;
        const loader = MODULE_LOADERS[moduleCode];
        if (!loader) continue;

        preloadedRef.current.add(moduleCode);
        loader().catch((err) => {
          logger.warn?.(`[modulePreloader] falhou para ${moduleCode}`, err);
        });
      }
    });

    return () => {
      const cic: ((h: number) => void) | undefined = (globalThis as any).cancelIdleCallback;
      if (cic && typeof handle === "number") cic(handle);
    };
  }, [session, loading, permissionsReady, modules]);
}
