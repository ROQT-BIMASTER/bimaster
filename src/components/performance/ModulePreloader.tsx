import { useModulePreloader } from "@/hooks/useModulePreloader";

/**
 * Headless: dispara preload de chunks dos módulos a que o usuário tem acesso.
 * Montar uma única vez dentro de PermissionsProvider.
 */
export function ModulePreloader() {
  useModulePreloader();
  return null;
}
