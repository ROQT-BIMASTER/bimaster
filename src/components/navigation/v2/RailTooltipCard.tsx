/**
 * Card rico exibido no hover de uma categoria (ou módulo) do AppRail.
 *
 * Modo categoria (padrão do rail compacto):
 *  - título da categoria + ícone
 *  - lista compacta de módulos (até 6, com "+N mais" quando excede)
 *  - rodapé: "Abrir painel →"
 *
 * Modo módulo (legado):
 *  - título + contagem
 *  - últimas páginas visitadas (Recentes filtrados pelo moduleCode)
 *  - link "Reabrir"
 */
import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { resolveIcon } from "./icon";
import { getModuleAccent, accentStyle } from "./launcher/moduleColors";
import { useRecents } from "./launcher/useRecents";
import type { NavV2Category, NavV2Module } from "./useNavV2Data";

interface CategoryProps {
  category: NavV2Category;
  module?: never;
  isActive: boolean;
  pendentes?: number;
  statusLabel?: string;
}

interface ModuleProps {
  module: NavV2Module;
  category?: never;
  isActive: boolean;
  pendentes?: number;
  statusLabel?: string;
}

type Props = CategoryProps | ModuleProps;

export function RailTooltipCard(props: Props) {
  if ("category" in props && props.category) {
    return <CategoryCard {...props} />;
  }
  return <ModuleCardTip {...(props as ModuleProps)} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-launcher-theme="dark"
      className="w-[260px] rounded-lg p-3"
      style={{
        background: "hsl(var(--launcher-surface))",
        color: "hsl(var(--launcher-foreground))",
        boxShadow:
          "0 12px 32px -8px hsl(0 0% 0% / 0.5), inset 0 0 0 1px hsl(var(--launcher-border))",
      }}
    >
      {children}
    </div>
  );
}

function CategoryCard({ category, isActive, pendentes, statusLabel }: CategoryProps) {
  const Icon = resolveIcon(category.icon ?? null);
  const token = getModuleAccent(category.key);
  const totalPages = category.modules.reduce((a, m) => a + m.pages.length, 0);
  const visible = category.modules.slice(0, 6);
  const overflow = category.modules.length - visible.length;

  return (
    <Shell>
      <div className="flex items-start gap-2.5">
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
          style={accentStyle(token)}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-semibold leading-tight truncate">
              {category.label}
            </div>
            {isActive && (
              <span
                className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{
                  background: `hsl(var(${token}))`,
                  color: "hsl(var(--launcher-surface))",
                }}
              >
                Aqui
              </span>
            )}
          </div>
          <div
            className="text-[10px]"
            style={{ color: "hsl(var(--launcher-muted))" }}
          >
            {category.modules.length} módulos · {totalPages} páginas
            {typeof pendentes === "number" && pendentes > 0 && (
              <>
                {" · "}
                <span style={{ color: `hsl(var(${token}))` }}>{pendentes} pendentes</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="mt-3 mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "hsl(var(--launcher-muted))" }}
      >
        Módulos
      </div>
      <ul className="space-y-1">
        {visible.map((m) => {
          const ModIcon = resolveIcon(m.icon);
          const mTok = getModuleAccent(m.code);
          return (
            <li
              key={m.code}
              className="flex items-center gap-2 text-[11px]"
              style={{ color: "hsl(var(--launcher-foreground))" }}
            >
              <span
                className="h-4 w-4 rounded flex items-center justify-center shrink-0"
                style={accentStyle(mTok)}
              >
                <ModIcon className="h-2.5 w-2.5" />
              </span>
              <span className="flex-1 truncate">{m.label}</span>
              <span
                className="text-[10px]"
                style={{ color: "hsl(var(--launcher-muted))" }}
              >
                {m.pages.length}
              </span>
            </li>
          );
        })}
        {overflow > 0 && (
          <li
            className="text-[10px] pl-6"
            style={{ color: "hsl(var(--launcher-muted))" }}
          >
            +{overflow} módulos
          </li>
        )}
      </ul>

      {statusLabel && (
        <div
          className="mt-3 flex items-center gap-1.5 text-[10px]"
          style={{ color: "hsl(var(--launcher-muted))" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: `hsl(var(${token}))` }}
          />
          {statusLabel}
        </div>
      )}

      <div
        className="mt-3 pt-2 flex items-center justify-end text-[10px] font-medium"
        style={{
          borderTop: "1px solid hsl(var(--launcher-border))",
          color: `hsl(var(${token}))`,
        }}
      >
        Abrir painel <ArrowUpRight className="h-2.5 w-2.5 ml-0.5" />
      </div>
    </Shell>
  );
}

function ModuleCardTip({ module, isActive, pendentes, statusLabel }: ModuleProps) {
  const navigate = useNavigate();
  const { entries } = useRecents();
  const Icon = resolveIcon(module.icon);
  const token = getModuleAccent(module.code);

  const recent = entries
    .filter((e) => e.moduleCode === module.code)
    .slice(0, 3);
  const reopen = recent[0];

  return (
    <Shell>
      <div className="flex items-start gap-2.5">
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
          style={accentStyle(token)}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-semibold leading-tight truncate">
              {module.label}
            </div>
            {isActive && (
              <span
                className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{
                  background: `hsl(var(${token}))`,
                  color: "hsl(var(--launcher-surface))",
                }}
              >
                Aqui
              </span>
            )}
          </div>
          <div
            className="text-[10px]"
            style={{ color: "hsl(var(--launcher-muted))" }}
          >
            {module.pages.length} {module.pages.length === 1 ? "página" : "páginas"}
            {typeof pendentes === "number" && pendentes > 0 && (
              <>
                {" · "}
                <span style={{ color: `hsl(var(${token}))` }}>{pendentes} pendentes</span>
              </>
            )}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <>
          <div
            className="mt-3 mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "hsl(var(--launcher-muted))" }}
          >
            Últimas páginas
          </div>
          <ul className="space-y-1">
            {recent.map((r) => (
              <li
                key={r.route}
                className="text-[11px] truncate"
                style={{ color: "hsl(var(--launcher-foreground))" }}
              >
                · {r.pageLabel}
              </li>
            ))}
          </ul>
        </>
      )}

      {statusLabel && (
        <div
          className="mt-3 flex items-center gap-1.5 text-[10px]"
          style={{ color: "hsl(var(--launcher-muted))" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: `hsl(var(${token}))` }}
          />
          {statusLabel}
        </div>
      )}

      {reopen && (
        <button
          type="button"
          onClick={() => navigate(reopen.route)}
          className="mt-3 flex items-center gap-1 text-[10px] font-medium ml-auto hover:underline w-full justify-end"
          style={{ color: `hsl(var(${token}))` }}
        >
          Reabrir <ArrowUpRight className="h-2.5 w-2.5" />
        </button>
      )}
    </Shell>
  );
}
