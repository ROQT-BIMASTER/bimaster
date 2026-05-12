import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { usePageBgColor } from "@/hooks/usePageBgColor";
import { getBgPaletteVars } from "@/lib/colorUtils";
import { ChinaCommunicationFab } from "@/components/china/ChinaCommunicationFab";
import { ChinaLanguageSwitcher } from "@/components/china/ChinaLanguageSwitcher";
import { I18nextProvider } from "react-i18next";
import { chinaI18n } from "@/i18n/china";

interface ChinaPageShellProps {
  children: ReactNode;
  /** Renderizar o FAB de comunicação flutuante. Padrão: true */
  showCommunicationFab?: boolean;
}

/**
 * Shell padrão das telas do módulo Fábrica China.
 *
 * Provê:
 *  - SidebarProvider + AppSidebar (resolve a reclamação de "menu lateral some").
 *  - Cor de fundo customizável (usePageBgColor) com paleta WCAG-AA via
 *    getBgPaletteVars — mesma identidade visual de Projetos.
 *  - FAB de comunicação rápida (chat com China) acessível em qualquer tela.
 *
 * Não altera o InboxDrawerProvider (já é global em App.tsx).
 */
export function ChinaPageShell({ children, showCommunicationFab = true }: ChinaPageShellProps) {
  const { bgColor } = usePageBgColor();

  return (
    <I18nextProvider i18n={chinaI18n} defaultNS="china">
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <main
            className="flex-1 overflow-auto"
            style={
              bgColor
                ? ({ backgroundColor: bgColor, color: "hsl(var(--foreground))", ...getBgPaletteVars(bgColor) } as React.CSSProperties)
                : undefined
            }
          >
            <div className="p-6 w-full space-y-6">
              <div className="flex justify-end">
                <ChinaLanguageSwitcher />
              </div>
              {children}
            </div>
          </main>
          {showCommunicationFab && <ChinaCommunicationFab />}
        </div>
      </SidebarProvider>
    </I18nextProvider>
  );
}
