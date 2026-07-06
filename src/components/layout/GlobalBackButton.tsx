import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Botão de voltar global.
 *
 * Regras:
 * - Aparece automaticamente em qualquer rota interna com profundidade >= 3
 *   segmentos (ex.: `/dashboard/projetos/123`). Dashboards de módulo
 *   (`/dashboard/projetos`) e a raiz (`/dashboard`) ficam sem botão.
 * - Rotas fora do dashboard (auth, portal cliente, etc.) e telas que não
 *   passam pelo DashboardLayout não são afetadas.
 * - Comportamento híbrido: tenta `history.back()`; se não houver histórico
 *   dentro do app (referrer externo ou aba nova), sobe um nível na rota.
 * - Páginas que já têm o próprio botão de voltar podem ocultar o global
 *   adicionando o atributo `data-hide-global-back` em qualquer ancestral,
 *   ou passando `?noback=1` na URL.
 */
export function GlobalBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  const segments = location.pathname.split("/").filter(Boolean);

  // Só mostra em rotas internas do dashboard com profundidade >= 3.
  // Ex.: /dashboard/projetos/123 → mostra. /dashboard/projetos → não mostra.
  const isDashboard = segments[0] === "dashboard";
  if (!isDashboard || segments.length < 3) return null;

  // Opt-out por query param (ex.: telas em modo apresentação / kiosk).
  if (new URLSearchParams(location.search).get("noback") === "1") return null;

  const handleClick = () => {
    // Se houver histórico interno, volta. window.history.length inclui a
    // entrada atual — >1 significa que existe ao menos uma anterior nessa aba.
    // Referrer vazio ou de outro origin indica aba nova / entrada direta.
    const sameOriginReferrer =
      typeof document !== "undefined" &&
      document.referrer &&
      (() => {
        try {
          return new URL(document.referrer).origin === window.location.origin;
        } catch {
          return false;
        }
      })();

    if (window.history.length > 1 && sameOriginReferrer) {
      navigate(-1);
      return;
    }

    // Fallback: sobe um nível na rota atual.
    const parent = "/" + segments.slice(0, -1).join("/");
    navigate(parent || "/dashboard");
  };

  return (
    <div
      className="mb-3 flex items-center"
      data-global-back-button
    >
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 -ml-2",
          "text-sm font-medium text-muted-foreground",
          "hover:text-foreground hover:bg-muted/60 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        aria-label="Voltar"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Voltar</span>
      </button>
    </div>
  );
}
