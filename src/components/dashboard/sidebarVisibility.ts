/**
 * Regras puras de visibilidade dos atalhos da sidebar.
 * Mantidas isoladas para garantir testabilidade e refletir exatamente
 * as guards aplicadas no AppSidebar:
 *
 *   - Relatórios de Projetos:    {isAdminOrSupervisor && ...}
 *   - Calendário Corporativo:    {isAdmin && ...}
 */

export interface RoleFlags {
  isAdmin: boolean;
  isAdminOrSupervisor: boolean;
}

export const canSeeProjetosRelatorios = ({ isAdminOrSupervisor }: RoleFlags): boolean =>
  Boolean(isAdminOrSupervisor);

export const canSeeCalendarioCorporativo = ({ isAdmin }: RoleFlags): boolean =>
  Boolean(isAdmin);
