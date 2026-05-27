/**
 * UrgentMessageBanner — banner global fixo no topo quando o usuário tem
 * mensagens urgentes não reconhecidas. Treme por ~0.6s ao aparecer e
 * pulsa enquanto persistir.
 *
 * "Reconhecer" marca todas as `notifications` do tipo `chat_urgent`
 * como lidas (read=true). Não apaga a mensagem original — só fecha o alerta.
 */
// Não usar hooks do react-router aqui — este banner pode ser montado fora do <Router>.
// Navegação é feita com window.location (cross-app friendly) — ver no-router-hooks.test.ts.
import { AlertOctagon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMencoesNotifications } from "@/hooks/useMencoesNotifications";
import { useMemo } from "react";

export function UrgentMessageBanner() {
  const { mencoes, marcarLida } = useMencoesNotifications();


  const urgentes = useMemo(
    () => (mencoes ?? []).filter((m) => m.type === "chat_urgent" && !m.read),
    [mencoes],
  );

  if (urgentes.length === 0) return null;

  const primeira = urgentes[0];

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] w-[min(640px,calc(100vw-1rem))] animate-shake"
    >
      <div className="bg-destructive text-destructive-foreground rounded-lg shadow-2xl border-2 border-destructive-foreground/20 px-4 py-3 flex items-center gap-3 animate-pulse-soft">
        <AlertOctagon className="h-6 w-6 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{primeira.title}</p>
          <p className="text-xs opacity-90 line-clamp-2">{primeira.message}</p>
          {urgentes.length > 1 && (
            <p className="text-[11px] opacity-80 mt-0.5">
              +{urgentes.length - 1} outra(s) mensagem(ns) urgente(s)
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {primeira.action_url && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                marcarLida.mutate([primeira.id]);
                navigate(primeira.action_url!);
              }}
            >
              Abrir agora
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive-foreground hover:bg-destructive-foreground/15"
            onClick={() => marcarLida.mutate(urgentes.map((u) => u.id))}
            title="Reconhecer e fechar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
