/**
 * Bloco de uma categoria: título + descrição + contagem + grade de ModuleCards.
 */
import { ModuleCard } from "./ModuleCard";
import type { NavV2Category, NavV2Module } from "../useNavV2Data";

interface Props {
  category: NavV2Category;
  description?: string;
  activeModuleCode?: string | null;
  onSelectModule: (mod: NavV2Module) => void;
}

export function CategoryBlock({
  category,
  description,
  activeModuleCode,
  onSelectModule,
}: Props) {
  const totalPages = category.modules.reduce(
    (acc, m) => acc + m.pages.length,
    0,
  );

  return (
    <section className="space-y-3">
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2
            className="text-[18px] font-semibold leading-tight"
            style={{ color: "hsl(var(--launcher-foreground))" }}
          >
            {category.label}
          </h2>
          {description && (
            <p
              className="text-[12px] mt-0.5"
              style={{ color: "hsl(var(--launcher-muted))" }}
            >
              {description}
            </p>
          )}
        </div>
        <div
          className="text-[11px] shrink-0"
          style={{ color: "hsl(var(--launcher-muted))" }}
        >
          {category.modules.length} módulos · {totalPages} páginas
        </div>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {category.modules.map((mod) => (
          <ModuleCard
            key={mod.code}
            module={mod}
            isCurrent={activeModuleCode === mod.code}
            onSelect={onSelectModule}
          />
        ))}
      </div>
    </section>
  );
}
