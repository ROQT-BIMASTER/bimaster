/**
 * Seleciona entre a navegação v1 (AppSidebar clássico) e a v2 (AppRail).
 *
 * Default 'v1' (garantido por useNavVersion). v2 só é ativada quando o usuário
 * tem `user_ui_preferences.nav_version='v2'` (migration entregue em
 * docs/audit/2026-Q2/migrations-pendentes/ — ainda não aplicada).
 *
 * Rollback ≤ 5 min: trocar este componente por <AppSidebar/> ou flipar o default.
 */
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { useNavVersion } from "@/lib/featureFlags/navigationVersion";
import { AppRail } from "./AppRail";

interface SidebarSwitchProps {
  side?: "left" | "right";
}

export function SidebarSwitch({ side }: SidebarSwitchProps) {
  const { version } = useNavVersion();
  if (version === "v2") {
    return <AppRail side={side} />;
  }
  return <AppSidebar side={side} />;
}
