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
        <div className="p-4 text-xs text-muted-foreground bg-card border border-border rounded-md m-3">
          <p className="font-medium text-foreground mb-1">Chat indisponível</p>
          <p>Ocorreu um erro ao carregar o chat. Recarregue a página para tentar novamente.</p>
          <button
            onClick={this.reset}
            className="mt-2 text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
