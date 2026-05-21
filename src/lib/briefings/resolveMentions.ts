/**
 * Extrai @menções de um texto livre e resolve para user_ids reais
 * comparando com a lista de membros do briefing.
 *
 * Aceita formatos:
 *   "@Joao"           → match por primeiro nome
 *   "@Joao Silva"     → match por nome completo
 *   "@joao.silva"     → match por slug (dots e hifens viram espaço)
 *
 * A correspondência é case-insensitive, acento-insensitive e ignora
 * dois usuários sem nome. Em caso de empate, retorna o primeiro encontrado.
 */
export interface MentionableMember {
  user_id: string;
  nome: string | null;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function resolveMentionsFromText(
  body: string,
  members: MentionableMember[],
): string[] {
  if (!body) return [];
  const matches = body.match(/@([A-Za-zÀ-ÿ0-9._-]+(?:\s+[A-Za-zÀ-ÿ0-9._-]+){0,3})/g);
  if (!matches) return [];

  const dict = members
    .filter((m) => m.nome)
    .map((m) => ({
      user_id: m.user_id,
      norm: normalize(m.nome!.replace(/[._-]+/g, " ")),
      first: normalize(m.nome!.split(/\s+/)[0] ?? ""),
    }));

  const resolved = new Set<string>();

  for (const raw of matches) {
    const token = normalize(raw.replace(/^@/, "").replace(/[._-]+/g, " "));
    if (!token) continue;
    // 1. match exato pelo nome completo
    let hit = dict.find((d) => d.norm === token);
    // 2. match pelo primeiro nome (apenas se token é uma palavra)
    if (!hit && !/\s/.test(token)) {
      hit = dict.find((d) => d.first === token);
    }
    // 3. prefixo do nome completo
    if (!hit) hit = dict.find((d) => d.norm.startsWith(token));
    if (hit) resolved.add(hit.user_id);
  }

  return Array.from(resolved);
}
