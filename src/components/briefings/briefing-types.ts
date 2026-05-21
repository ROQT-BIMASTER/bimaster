// Tipos e helpers visuais para o módulo de Briefings

export const TIPO_META: Record<
  string,
  { label: string; emoji?: string; bg: string; fg: string }
> = {
  pdv: { label: "PDV", bg: "bg-pink-100 dark:bg-pink-950/40", fg: "text-pink-700 dark:text-pink-300" },
  embalagem: { label: "Embalagem", bg: "bg-amber-100 dark:bg-amber-950/40", fg: "text-amber-700 dark:text-amber-300" },
  evento: { label: "Evento", bg: "bg-purple-100 dark:bg-purple-950/40", fg: "text-purple-700 dark:text-purple-300" },
  campanha: { label: "Campanha", bg: "bg-indigo-100 dark:bg-indigo-950/40", fg: "text-indigo-700 dark:text-indigo-300" },
  ecommerce: { label: "E-commerce", bg: "bg-emerald-100 dark:bg-emerald-950/40", fg: "text-emerald-700 dark:text-emerald-300" },
  presskit: { label: "Press Kit", bg: "bg-rose-100 dark:bg-rose-950/40", fg: "text-rose-700 dark:text-rose-300" },
  catalogo: { label: "Catálogo", bg: "bg-blue-100 dark:bg-blue-950/40", fg: "text-blue-700 dark:text-blue-300" },
  material_interno: { label: "Material interno", bg: "bg-slate-100 dark:bg-slate-800/40", fg: "text-slate-700 dark:text-slate-300" },
};

export function getTipoMeta(tipo: string) {
  return (
    TIPO_META[tipo] ?? {
      label: tipo,
      bg: "bg-muted",
      fg: "text-muted-foreground",
    }
  );
}

export function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "rascunho":
      return { label: "Rascunho", className: "bg-muted text-muted-foreground" };
    case "em_andamento":
      return {
        label: "Em andamento",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      };
    case "em_aprovacao":
      return {
        label: "Em aprovação",
        className: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
      };
    case "concluido":
    case "aprovado":
      return {
        label: status === "aprovado" ? "Aprovado" : "Concluído",
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
      };
    case "reprovado":
      return {
        label: "Reprovado",
        className: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
      };
    default:
      return { label: status.replace(/_/g, " "), className: "bg-muted text-muted-foreground" };
  }
}

// Heurística para distinguir uma mensagem do agente que é, na verdade,
// um aviso técnico/de sistema (ex.: "instabilidade técnica", "canvas atualizado").
const SYSTEM_PATTERNS = [
  /^passei por uma instabilidade/i,
  /^o canvas foi atualizado/i,
  /^canvas atualizado/i,
  /^erro ao /i,
  /^não foi possível/i,
  /^instabilidade técnica/i,
];

export function isSystemNoteContent(content: string): boolean {
  if (!content) return false;
  const firstLine = content.trim().split("\n")[0];
  return SYSTEM_PATTERNS.some((rx) => rx.test(firstLine));
}
