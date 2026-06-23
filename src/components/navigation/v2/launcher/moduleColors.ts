/**
 * Cor por módulo no Launcher v2.
 *
 * Estratégia:
 * 1. Overrides explícitos por module.code (mantém Fábrica laranja, China vermelho, etc).
 * 2. Fallback: hash determinístico → 1 das 8 paletas semânticas (--launcher-accent-N).
 *
 * Retorna apenas referências a tokens HSL (sem hex hardcoded).
 */

export type LauncherAccentToken =
  | "--launcher-accent-1"
  | "--launcher-accent-2"
  | "--launcher-accent-3"
  | "--launcher-accent-4"
  | "--launcher-accent-5"
  | "--launcher-accent-6"
  | "--launcher-accent-7"
  | "--launcher-accent-8";

const OVERRIDES: Record<string, LauncherAccentToken> = {
  fabrica: "--launcher-accent-1",
  fabrica_china: "--launcher-accent-2",
  china: "--launcher-accent-2",
  composicao: "--launcher-accent-3",
  estoque: "--launcher-accent-4",
  embalagem: "--launcher-accent-5",
  etiqueta: "--launcher-accent-6",
  etiqueta_bula: "--launcher-accent-6",
  financeiro: "--launcher-accent-7",
  projetos: "--launcher-accent-5",
  marketing: "--launcher-accent-2",
  trade: "--launcher-accent-2",
  vendas: "--launcher-accent-1",
  admin: "--launcher-accent-7",
};

const POOL: LauncherAccentToken[] = [
  "--launcher-accent-1",
  "--launcher-accent-2",
  "--launcher-accent-3",
  "--launcher-accent-4",
  "--launcher-accent-5",
  "--launcher-accent-6",
  "--launcher-accent-7",
  "--launcher-accent-8",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getModuleAccent(code: string): LauncherAccentToken {
  const key = code.toLowerCase().replace(/[\s-]+/g, "_");
  return OVERRIDES[key] ?? POOL[hash(key) % POOL.length];
}

/** Helpers para gerar estilos inline a partir do token. */
export function accentStyle(token: LauncherAccentToken) {
  return {
    background: `hsl(var(${token}) / 0.18)`,
    color: `hsl(var(${token}))`,
    boxShadow: `inset 0 0 0 1px hsl(var(${token}) / 0.35)`,
  } as React.CSSProperties;
}
