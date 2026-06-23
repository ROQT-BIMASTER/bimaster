/**
 * Card colorido de módulo (grade da área direita).
 */
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { resolveIcon } from "../icon";
import { getModuleAccent, accentStyle } from "./moduleColors";
import type { NavV2Module } from "../useNavV2Data";

interface Props {
  module: NavV2Module;
  description?: string;
  isCurrent: boolean;
  pendentes?: number;
  onSelect: (mod: NavV2Module, opts?: { openFirst?: boolean }) => void;
}

export function ModuleCard({
  module,
  description,
  isCurrent,
  pendentes,
  onSelect,
}: Props) {
  const Icon = resolveIcon(module.icon);
  const token = getModuleAccent(module.code);
  const pageCount = module.pages.length;
  const hasMultiple = pageCount > 1;

  return (
    <button
      type="button"
      onClick={(e) => {
        const openFirst = e.shiftKey || e.metaKey || e.ctrlKey;
        onSelect(module, { openFirst });
      }}
      title={
        hasMultiple
          ? "Clique para ver as páginas · Shift+Click abre a primeira"
          : undefined
      }
      className="group relative flex flex-col gap-3 rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2"
      style={{
        background: "hsl(var(--launcher-surface-elevated))",
        boxShadow: "inset 0 0 0 1px hsl(var(--launcher-border))",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
          style={accentStyle(token)}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[14px] font-semibold leading-tight truncate"
              style={{ color: "hsl(var(--launcher-foreground))" }}
            >
              {module.label}
            </span>
            {isCurrent && (
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: `hsl(var(${token}))` }}
              />
            )}
          </div>
          {description && (
            <p
              className="text-[11px] mt-0.5 line-clamp-2 leading-snug"
              style={{ color: "hsl(var(--launcher-muted))" }}
            >
              {description}
            </p>
          )}
        </div>
        {hasMultiple && (
          <ChevronRight
            className="h-4 w-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
            style={{ color: "hsl(var(--launcher-muted))" }}
          />
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span style={{ color: "hsl(var(--launcher-muted))" }}>
          {pageCount} {pageCount === 1 ? "página" : "páginas"}
        </span>
        {typeof pendentes === "number" && pendentes > 0 && (
          <>
            <span
              className="h-1 w-1 rounded-full"
              style={{ background: "hsl(var(--launcher-muted))" }}
            />
            <span style={{ color: `hsl(var(${token}))` }}>
              {pendentes} pendentes
            </span>
          </>
        )}
        {isCurrent && (
          <>
            <span
              className="h-1 w-1 rounded-full"
              style={{ background: "hsl(var(--launcher-muted))" }}
            />
            <span style={{ color: `hsl(var(${token}))` }}>aqui</span>
          </>
        )}
      </div>
    </button>
  );
}
