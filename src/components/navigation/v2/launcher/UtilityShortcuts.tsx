/**
 * UtilityShortcuts — fonte única dos atalhos utilitários da v2.
 *
 * Consumido por:
 *  - AppRail (cluster fixo no rodapé)
 *  - LauncherDialog (bloco "Atalhos" no topo + participa do filtro de busca)
 *
 * Visibilidade espelha a regra do AppSidebar v1: Chat / Aprovações do Chat
 * exigem isAdmin OU alguma permissão de módulo ≠ integracao_erp. Instalar/
 * Atualizar App é sempre visível.
 */
import { Download, Inbox, MessageCircle, RefreshCw, type LucideIcon } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { usePWA } from "@/contexts/PWAContext";

export interface UtilityShortcut {
  key: "chat" | "chat-aprovacoes" | "install";
  label: string;
  description: string;
  route: string;
  icon: LucideIcon;
  /** Quando definido, indica "estado de atenção" (ex.: needRefresh). */
  attention?: boolean;
  /** Contador opcional para badge. */
  badgeCount?: number;
  /** Termos para o filtro de busca do Launcher. */
  keywords: string[];
}

export function useUtilityShortcuts(): UtilityShortcut[] {
  const { isAdmin } = useUserRole();
  const { hasModulePermission } = useModulePermissions();
  const { needRefresh } = usePWA();

  // Mesma heurística do AppSidebar v1 (linha 1303): tem algum módulo ≠ ERP?
  const hasAnyNonErp =
    isAdmin ||
    [
      "projetos",
      "comercial",
      "trade",
      "marketing",
      "financeiro",
      "fabrica",
      "china",
      "design_studio",
      "crm",
    ].some((code) => hasModulePermission(code));

  const shortcuts: UtilityShortcut[] = [];

  if (hasAnyNonErp) {
    shortcuts.push({
      key: "chat",
      label: "Chat",
      description: "Conversas e mensageria interna",
      route: "/dashboard/chat",
      icon: MessageCircle,
      keywords: ["chat", "mensagem", "conversa"],
    });
    shortcuts.push({
      key: "chat-aprovacoes",
      label: "Aprovações do Chat",
      description: "Itens aguardando sua aprovação no chat",
      route: "/dashboard/chat/aprovacoes",
      icon: Inbox,
      keywords: ["aprovacoes", "aprovações", "chat", "pendentes"],
    });
  }

  shortcuts.push({
    key: "install",
    label: needRefresh ? "Atualizar App" : "Instalar App",
    description: needRefresh
      ? "Nova versão disponível — recarregar"
      : "Adicionar à tela inicial",
    route: "/dashboard/instalar-app",
    icon: needRefresh ? RefreshCw : Download,
    attention: needRefresh,
    keywords: ["instalar", "atualizar", "pwa", "app", "install", "update"],
  });

  return shortcuts;
}
