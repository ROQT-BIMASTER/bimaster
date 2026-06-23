/**
 * Card rico exibido no hover de um módulo do AppRail.
 *
 * Mostra: título, contagem de páginas, últimas páginas (até 3 de Recentes),
 * status/pendências quando houver, e link "Reabrir" para o último item
 * visitado dentro do módulo (se existir).
 */
import { useNavigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { resolveIcon } from "./icon";
import { getModuleAccent, accentStyle } from "./launcher/moduleColors";
import { useRecents } from "./launcher/useRecents";
import type { NavV2Module } from "./useNavV2Data";

interface Props {
  module: NavV2Module;
  isActive: boolean;
  pendentes?: number;
  statusLabel?: string;
}

export function RailTooltipCard({ module, isActive, pendentes, statusLabel }: Props) {
  const navigate = useNavigate();
  const { entries } = useRecents();
  const Icon = resolveIcon(module.icon);
  const token = getModuleAccent(module.code);

  const recentInModule = entries
    .filter((e) => e.moduleCode === module.code)
    .slice(0, 3);
  const reopen = recentInModule[0];

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

      {recentInModule.length > 0 && (
        <>
          <div
            className="mt-3 mb-1.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "hsl(var(--launcher-muted))" }}
          >
            Últimas páginas
          </div>
          <ul className="space-y-1">
            {recentInModule.map((r) => (
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
    </div>
  );
}
