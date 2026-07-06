import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}
interface State {
  hasError: boolean;
  error?: Error;
  info?: ErrorInfo;
}

/**
 * ErrorBoundary local do Chat. Mantém o resto da aplicação utilizável caso
 * algum hook do chat (presence, realtime, useLocation acidental, etc.) falhe.
 *
 * O fallback exibe detalhes técnicos do erro (mensagem + stack do componente)
 * em um bloco recolhível — sem isso, um crash de qualquer subárvore do chat
 * vira apenas "Chat indisponível", inviabilizando o diagnóstico.
 */
export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    logger.error("ChatErrorBoundary caught error", {
      component: this.props.name ?? "Chat",
      metadata: { message: error.message, stack: info.componentStack },
    });
    // Também logar no console cru para inspeção em produção
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error("[ChatErrorBoundary]", this.props.name ?? "Chat", error, info.componentStack);
    }
  }

  reset = () => this.setState({ hasError: false, error: undefined, info: undefined });

  private copyDetails = async () => {
    const { error, info } = this.state;
    const text = [
      `Chat boundary: ${this.props.name ?? "Chat"}`,
      `Mensagem: ${error?.message ?? "—"}`,
      "",
      "Stack:",
      error?.stack ?? "—",
      "",
      "Component stack:",
      info?.componentStack ?? "—",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* noop */
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      const { error, info } = this.state;
      return (
        <div
          role="alert"
          className="m-3 p-4 rounded-md border border-destructive/30 bg-destructive/5 flex flex-col items-start gap-2"
          data-testid="chat-error-fallback"
        >
          <p className="text-sm font-semibold text-foreground">Chat indisponível</p>
          <p className="text-xs text-muted-foreground">
            Ocorreu um erro ao carregar o chat. Tente novamente ou recarregue a página.
          </p>
          {error?.message && (
            <p className="text-xs font-mono text-destructive break-all">
              {error.message}
            </p>
          )}
          <details className="w-full text-xs mt-1">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
              Detalhes técnicos
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded bg-background/60 border border-border p-2 text-[11px] leading-snug whitespace-pre-wrap break-all">
{`Boundary: ${this.props.name ?? "Chat"}
Mensagem: ${error?.message ?? "—"}

Stack:
${error?.stack ?? "—"}

Component stack:
${info?.componentStack ?? "—"}`}
            </pre>
          </details>
          <div className="flex gap-2 mt-1 flex-wrap">
            <button
              onClick={this.reset}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-accent transition-colors"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => window.location.reload()}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Recarregar página
            </button>
            <button
              onClick={this.copyDetails}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-accent transition-colors"
            >
              Copiar detalhes
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
