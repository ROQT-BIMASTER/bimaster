import { useState, useMemo } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatThread } from "./ChatThread";
import { ConversaInfoPanel } from "./ConversaInfoPanel";
import { ChinaChatPanel } from "@/components/china/ChinaChatPanel";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { useChinaSubmissoesChat } from "@/hooks/chat/useChinaSubmissoesChat";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnablePushBanner } from "@/components/notifications/EnablePushBanner";
import { useSuporteAgenteTrigger } from "@/hooks/useSuporteAgenteTrigger";
import { useAuth } from "@/contexts/AuthContext";

/** Modo do chat: pessoas (conversas/grupos) ou submissões China. */
export type ChatModo = "pessoas" | "submissoes";

interface Props {
  initialConversaId?: string | null;
  className?: string;
  /** Mostra painel de info (3ª coluna) — default true em desktop. */
  defaultShowInfo?: boolean;
}

export function ChatLayout({ initialConversaId = null, className, defaultShowInfo = false }: Props) {
  const [conversaId, setConversaId] = useState<string | null>(initialConversaId);
  const [showInfo, setShowInfo] = useState(defaultShowInfo);
  const [modo, setModo] = useState<ChatModo>("pessoas");
  const isMobile = useIsMobile();
  const { isChinaUser, isBrasilUser } = useChinaUserContext();
  const { data: submissoes = [] } = useChinaSubmissoesChat();
  const { user } = useAuth();
  useSuporteAgenteTrigger(user?.id);

  // Quando seleciona uma submissão, precisamos do nome do produto para
  // passar ao ChinaChatPanel. Pego direto da lista carregada pelo hook.
  const submissaoSelecionada = useMemo(
    () => (modo === "submissoes" && conversaId ? submissoes.find((s) => s.id === conversaId) ?? null : null),
    [modo, conversaId, submissoes],
  );

  // Tipo de remetente para o ChinaChatPanel — Brasil é o default para
  // usuários do bimaster; só usuário marcado como departamento China
  // entra como tipo "china".
  const tipoRemetente: "brasil" | "china" = isChinaUser ? "china" : "brasil";

  // Ao trocar de modo, limpa a seleção pra evitar carregar componente
  // errado com id de outro escopo.
  const trocarModo = (novo: ChatModo) => {
    setModo(novo);
    setConversaId(null);
    setShowInfo(false);
  };

  const renderPainelCentro = () => {
    if (modo === "submissoes") {
      if (!conversaId) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <Package className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">Selecione uma submissão</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Escolha uma submissão na lista ao lado para abrir o chat de tratativa
              entre Brasil e China sobre aquele produto.
            </p>
          </div>
        );
      }
      if (!submissaoSelecionada) {
        // submissão pode ainda estar carregando ou foi removida; placeholder neutro
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <Package className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <p className="text-sm text-muted-foreground">Carregando submissão...</p>
          </div>
        );
      }
      const produtoNome =
        submissaoSelecionada.produto_nome ??
        submissaoSelecionada.produto_codigo ??
        "Submissão";
      return (
        <div className="flex-1 min-w-0 overflow-auto">
          <ChinaChatPanel
            submissaoId={submissaoSelecionada.id}
            produtoNome={produtoNome}
            tipoRemetente={tipoRemetente}
          />
        </div>
      );
    }

    // Modo "pessoas" — comportamento original
    if (!conversaId) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <MessageSquare className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold">Selecione uma conversa</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Escolha uma conversa na lista ao lado ou crie uma nova para começar a trocar mensagens com sua equipe.
          </p>
        </div>
      );
    }
    return <ChatThread conversaId={conversaId} onShowInfo={() => setShowInfo((v) => !v)} />;
  };

  // Quem vê o toggle: usuários da China (sempre) ou Brasil que tenham
  // ao menos 1 submissão acessível. Heurística para esconder o toggle
  // de usuários sem nenhum contexto China — evita ruído de UI.
  const podeAlternarModo = isChinaUser || isBrasilUser; // Brasil é o default — assume true pra não esconder por race condition de loading. O hook de submissões respeitará RLS.

  if (isMobile) {
    return (
      <div className={cn("flex h-full w-full bg-background", className)}>
        {!conversaId ? (
          <ChatSidebar
            conversaSelecionada={null}
            onSelectConversa={setConversaId}
            modo={modo}
            onModoChange={trocarModo}
            podeAlternarModo={podeAlternarModo}
            className="w-full"
          />
        ) : (
          <div className="flex flex-col h-full w-full">
            <div className="px-2 py-1 border-b border-border flex items-center bg-card">
              <Button size="sm" variant="ghost" onClick={() => setConversaId(null)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            </div>
            <div className="flex-1 min-h-0">{renderPainelCentro()}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full w-full bg-background overflow-hidden", className)}>
      <EnablePushBanner />
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        <ChatSidebar
          conversaSelecionada={conversaId}
          onSelectConversa={(id) => { setConversaId(id); }}
          modo={modo}
          onModoChange={trocarModo}
          podeAlternarModo={podeAlternarModo}
          className="w-[320px] shrink-0"
        />
        <div className="flex-1 min-w-0 flex">
          {renderPainelCentro()}
          {modo === "pessoas" && showInfo && conversaId && (
            <ConversaInfoPanel
              conversaId={conversaId}
              onClose={() => setShowInfo(false)}
              className="w-[300px] shrink-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
