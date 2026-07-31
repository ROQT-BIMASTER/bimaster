/**
 * Mensagens padronizadas de erro para falhas do backend ao BUSCAR dados
 * e anexos (consultas, assinaturas de arquivo, downloads).
 *
 * Objetivo: o usuário nunca ver um erro técnico cru ("PGRST116",
 * "permission denied for table ..."), e sim uma mensagem clara sobre o
 * recurso que falhou e o que fazer em seguida.
 *
 * Uso:
 *   toastErroDados(e, "anexos");           // toast.error padronizado
 *   mensagemErroDados(e, "tarefas");       // string para UI inline
 */
import { toast } from "sonner";

export type RecursoDados =
  | "dados"
  | "tarefas"
  | "anexos"
  | "pre-visualizacao"
  | "download"
  | "historico"
  | "documentos";

const RECURSO_NOME: Record<RecursoDados, string> = {
  dados: "os dados",
  tarefas: "as tarefas",
  anexos: "os anexos",
  "pre-visualizacao": "a pré-visualização",
  download: "o pacote de download",
  historico: "o histórico",
  documentos: "os documentos",
};

export const FALHA_GENERICA_DADOS = "Tente novamente em instantes.";

/** Título curto e sem pontuação final. */
export function tituloErroDados(recurso: RecursoDados = "dados"): string {
  return `Não foi possível carregar ${RECURSO_NOME[recurso] ?? RECURSO_NOME.dados}`;
}

function codigoDoErro(e: unknown): string | null {
  const code = (e as { code?: string | number } | null)?.code;
  return code === undefined || code === null ? null : String(code);
}

function textoDoErro(e: unknown): string {
  if (typeof e === "string") return e.trim();
  const msg = (e as { message?: string } | null)?.message;
  return typeof msg === "string" ? msg.trim() : "";
}

/**
 * Traduz o erro do backend em uma descrição amigável, sempre não vazia.
 */
export function mensagemErroDados(e: unknown, recurso: RecursoDados = "dados"): string {
  const nome = RECURSO_NOME[recurso] ?? RECURSO_NOME.dados;
  const code = codigoDoErro(e);
  const texto = textoDoErro(e);
  const lower = texto.toLowerCase();

  if (code === "42501" || lower.includes("permission denied") || lower.includes("row-level security")) {
    return `Você não tem permissão para acessar ${nome}.`;
  }
  if (code === "PGRST301" || code === "429" || lower.includes("too many requests")) {
    return "Limite de requisições excedido. Aguarde alguns instantes e tente novamente.";
  }
  if (code === "401" || code === "403" || lower.includes("jwt") || lower.includes("not authenticated")) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("timeout") ||
    lower.includes("aborted")
  ) {
    return "Falha de conexão com o servidor. Verifique sua internet e tente novamente.";
  }
  if (code === "404" || lower.includes("object not found") || lower.includes("not found")) {
    return `Não encontramos ${nome} no servidor. O item pode ter sido removido.`;
  }
  if (texto.length > 0) return texto;
  return FALHA_GENERICA_DADOS;
}

/** Toast padronizado de falha ao buscar dados/anexos. */
export function toastErroDados(e: unknown, recurso: RecursoDados = "dados") {
  toast.error(tituloErroDados(recurso), { description: mensagemErroDados(e, recurso) });
}
