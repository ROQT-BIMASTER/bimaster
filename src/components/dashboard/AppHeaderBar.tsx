import logoHuugs from "@/assets/logo-huugs.jpg";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface AppHeaderBarProps {
  /** Conteúdo opcional renderizado à direita (ações contextuais da página). */
  rightSlot?: React.ReactNode;
  /** Conteúdo opcional renderizado logo após o logo (ex.: breadcrumb compacto). */
  centerSlot?: React.ReactNode;
  /** Quando true, o trigger de menu lateral não é renderizado. */
  hideSidebarTrigger?: boolean;
  className?: string;
}

/**
 * Barra de cabeçalho única e reutilizável usada por TODOS os shells
 * autenticados (DashboardLayout e layouts paralelos com SidebarProvider).
 *
 * Renderiza sempre o logo no topo-esquerdo (com `data-testid="app-logo"`),
 * o trigger do menu lateral e um slot opcional à direita para ações da página.
 *
 * Centraliza a renderização do logo para impedir layouts paralelos sem logo
 * e para evitar duplicação.
 */
export function AppHeaderBar({
  rightSlot,
  centerSlot,
  hideSidebarTrigger,
  className,
}: AppHeaderBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-[52px] border-b border-border flex items-center justify-between gap-2 sm:gap-3 px-2 sm:px-4 bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <img
          src={logoHuugs}
          alt="Huugs MakeUp"
          data-testid="app-logo"
          className="h-6 sm:h-7 md:h-8 w-auto max-w-[96px] sm:max-w-[120px] md:max-w-[140px] object-contain shrink-0"
        />
        {!hideSidebarTrigger && <SidebarTrigger aria-label="Alternar menu lateral" />}
        {centerSlot && <div className="min-w-0 truncate">{centerSlot}</div>}
      </div>
      {rightSlot && <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">{rightSlot}</div>}
    </header>
  );
}
