import { useState, useMemo, useEffect } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatThread } from "./ChatThread";
import { ConversaInfoPanel } from "./ConversaInfoPanel";
import { ChinaChatPanel } from "@/components/china/ChinaChatPanel";
import { BriefingChatPanel } from "./BriefingChatPanel";
import { ProjetoChatPanel } from "./ProjetoChatPanel";
import { TarefaChatPanel } from "./TarefaChatPanel";
import { useChinaUserContext } from "@/hooks/useChinaUserContext";
import { useChinaSubmissoesChat } from "@/hooks/chat/useChinaSubmissoesChat";
import { useTemAcessoBriefings } from "@/hooks/chat/useTemAcessoBriefings";
import { useTemAcessoProjetos } from "@/hooks/chat/useTemAcessoProjetos";
import { useTemAcessoTarefas } from "@/hooks/chat/useTemAcessoTarefas";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Package, FileText, Briefcase, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnablePushBanner } from "@/components/notifications/EnablePushBanner";
import { useSuporteAgenteTrigger } from "@/hooks/useSuporteAgenteTrigger";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";

/** Modo do chat: pessoas, submissões China, briefings, projetos ou tarefas. */
export type ChatModo = "pessoas" | "submissoes" | "briefings" | "projetos" | "tarefas";

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
  const [autoOpenDialog, setAutoOpenDialog] = useState<"aprovacao" | "urgente" | null>(null);
  const isMobile = useIsMobile();
  const { isChinaUser, isBrasilUser } = useChinaUserContext();
  const { data: submissoes = [] } = useChinaSubmissoesChat();
  const podeVerBriefings = useTemAcessoBriefings();
  const podeVerProjetos = useTemAcessoProjetos();
  const podeVerTarefas = useTemAcessoTarefas();
  const { user } = useAuth();
  useSuporteAgenteTrigger(user?.id);

  // Deep-link de Briefings/Projetos/Submissões: ?conversaId=...&abrir=aprovacao|urgente
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("conversaId");
    const abrir = params.get("abrir");
    if (convId) {
      setModo("pessoas");
      setConversaId(convId);
      if (abrir === "aprovacao" || abrir === "urgente") {
        setAutoOpenDialog(abrir);
      }
      // Limpa a URL para evitar reabrir no refresh
      const url = new URL(window.location.href);
      url.searchParams.delete("conversaId");
      url.searchParams.delete("abrir");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

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
    if (modo === "tarefas") {
      if (!conversaId) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <CheckSquare className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">Selecione uma tarefa</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Escolha uma tarefa ou subtarefa na lista para abrir o chat e
              responder a mensagens trocadas dentro dela.
            </p>
          </div>
        );
      }
      return (
        <div className="flex-1 min-w-0 flex">
          <TarefaChatPanel tarefaId={conversaId} />
        </div>
      );
    }

    if (modo === "projetos") {
      if (!conversaId) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <Briefcase className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">Selecione um projeto</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Escolha um projeto na lista para ver o chat geral, comentários das
              tarefas e menções a você.
            </p>
          </div>
        );
      }
      return (
        <div className="flex-1 min-w-0 flex">
          <ProjetoChatPanel projetoId={conversaId} />
        </div>
      );
    }

    if (modo === "briefings") {
      if (!conversaId) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <FileText className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">Selecione um briefing</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Escolha um briefing na lista para ver atividade, comentários e menções a você.
            </p>
          </div>
        );
      }
      return (
        <div className="flex-1 min-w-0 flex">
          <BriefingChatPanel briefingId={conversaId} />
        </div>
      );
    }

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

  // Quem vê o toggle de Submissões: apenas usuários com permissão ao módulo
  // Fábrica China (code "china"). Não-membros do módulo não devem nem
  // saber que existem submissões — mesmo que tecnicamente algum dia uma
  // RLS deixe vazar uma linha, o ponto de entrada na UI fica travado.
  const { hasModulePermission } = useImpersonation();
  const podeAlternarModo = hasModulePermission("china");

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
            podeVerBriefings={podeVerBriefings}
            podeVerProjetos={podeVerProjetos}
            podeVerTarefas={podeVerTarefas}
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
          podeVerBriefings={podeVerBriefings}
          podeVerProjetos={podeVerProjetos}
          podeVerTarefas={podeVerTarefas}
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
