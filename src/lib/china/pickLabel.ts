/**
 * pickLabel — escolhe o rótulo do idioma ativo do módulo China,
 * com fallback inteligente entre PT / ZH / EN para nunca devolver vazio.
 */
import type { ChinaLanguage } from "@/hooks/useChinaI18n";

export interface TriLabel {
  pt?: string | null;
  zh?: string | null;
  en?: string | null;
}

export function pickLabel(labels: TriLabel, lang: ChinaLanguage): string {
  const pt = (labels.pt || "").trim();
  const zh = (labels.zh || "").trim();
  const en = (labels.en || "").trim();
  const map = { pt, zh, en } as const;
  if (map[lang]) return map[lang];
  // Fallback chain: lang ativo → pt → en → zh → ""
  return pt || en || zh || "";
}
