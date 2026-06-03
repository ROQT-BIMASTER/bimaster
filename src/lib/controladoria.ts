/**
 * Helpers de status para a Controladoria de Produtos (RR-Produtos espelhado).
 * Mapeia os status textuais que vêm do Notion em "tons" visuais.
 */

export const WF_FIELDS = [
  "Briefing",
  "Primária",
  "Etiqueta Bula",
  "Etiqueta Fundo",
  "Etiqueta Provador",
  "Etiqueta Display",
  "Display",
  "Provador",
  "QR Code",
  "Desenho Técnico",
  "Caixa Master",
  "Aprovação Licenciador",
] as const;

export type WfField = (typeof WF_FIELDS)[number];
export type WfTone = "done" | "prog" | "block" | "idle";

const DONE = ["OK", "APROVADO", "AF APROVADA"];
const PROG = ["EM ANDAMENTO", "AF ENVIADA", "EM APROVAÇÃO", "RECEBIDO"];
const BLOCK = ["INCOMPLETO", "AGUARDANDO INFORMAÇÃO", "NÃO RECEBIDO"];

export function wfTone(v?: string | null): WfTone {
  if (!v) return "idle";
  const up = v.toUpperCase();
  if (DONE.includes(up)) return "done";
  if (PROG.includes(up)) return "prog";
  if (BLOCK.includes(up)) return "block";
  return "idle";
}

export function emGargalo(p: {
  wf?: Record<string, string | null> | null;
  composicao_pt?: boolean | null;
  anvisa?: string | null;
}): boolean {
  const wfBlock = Object.values(p.wf ?? {}).some(
    (v) => v != null && BLOCK.includes(String(v).toUpperCase()),
  );
  return wfBlock || !p.composicao_pt || !p.anvisa;
}
