import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}
interface State {
  hasError: boolean;
}

/**
 * ErrorBoundary local do Chat. Mantém o resto da aplicação utilizável caso
 * algum hook do chat (presence, realtime, useLocation acidental, etc.) falhe.
 */
export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("ChatErrorBoundary caught error", {
      component: this.props.name ?? "Chat",
      metadata: { message: error.message, stack: info.componentStack },
    });
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;
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
          <div className="flex gap-2 mt-1">
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
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
