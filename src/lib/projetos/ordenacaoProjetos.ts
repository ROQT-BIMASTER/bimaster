/**
 * Ordenação da lista de Projetos.
 *
 * Atende ao pedido dos usuários de ordem alfabética (e à necessidade de manter
 * a ordem padrão por criação). A escolha é preferência de UI, persistida em
 * localStorage por navegador.
 */
export type ProjetosOrdenacao = "padrao" | "az" | "za" | "recentes" | "prazo";

export const ORDENACAO_PROJETOS_OPCOES: { value: ProjetosOrdenacao; label: string }[] = [
  { value: "padrao", label: "Ordem padrão" },
  { value: "az", label: "Nome (A → Z)" },
  { value: "za", label: "Nome (Z → A)" },
  { value: "recentes", label: "Mais recentes" },
  { value: "prazo", label: "Prazo mais próximo" },
];

const STORAGE_KEY = "projetos:ordenacao";

export function lerOrdenacaoProjetos(): ProjetosOrdenacao {
  if (typeof window === "undefined") return "padrao";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) as ProjetosOrdenacao | null;
    if (raw && ORDENACAO_PROJETOS_OPCOES.some((o) => o.value === raw)) return raw;
  } catch {
    /* noop */
  }
  return "padrao";
}

export function salvarOrdenacaoProjetos(value: ProjetosOrdenacao): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* noop */
  }
}

interface OrdenavelProjeto {
  nome: string;
  created_at?: string | null;
  data_fim_prevista?: string | null;
}

/** Aplica a ordenação escolhida sem mutar o array original. */
export function ordenarProjetos<T extends OrdenavelProjeto>(projetos: T[], modo: ProjetosOrdenacao): T[] {
  if (modo === "padrao") return projetos;
  const list = [...projetos];
  const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
  switch (modo) {
    case "az":
      return list.sort((a, b) => collator.compare(a.nome ?? "", b.nome ?? ""));
    case "za":
      return list.sort((a, b) => collator.compare(b.nome ?? "", a.nome ?? ""));
    case "recentes":
      return list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    case "prazo":
      return list.sort((a, b) => {
        const av = a.data_fim_prevista ?? "";
        const bv = b.data_fim_prevista ?? "";
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
        return av.localeCompare(bv);
      });
    default:
      return list;
  }
}
