/**
 * Componente invisível: registra a rota atual em "Recentes" do Launcher v2.
 * Renderizado dentro do AppRail (só monta quando nav_version='v2').
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { findActiveModule, type NavV2Category } from "../useNavV2Data";
import { useRecents } from "./useRecents";

interface Props {
  categories: NavV2Category[];
}

export function RecordRecents({ categories }: Props) {
  const location = useLocation();
  const { record } = useRecents();

  useEffect(() => {
    if (!categories.length) return;
    const active = findActiveModule(categories, location.pathname);
    if (!active) return;
    const page = active.module.pages.find((p) =>
      location.pathname.startsWith(p.route),
    );
    if (!page) return;
    record({
      route: page.route,
      moduleCode: active.module.code,
      moduleLabel: active.module.label,
      pageLabel: page.label,
      icon: active.module.icon,
    });
  }, [location.pathname, categories, record]);

  return null;
}
