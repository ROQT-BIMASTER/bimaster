/**
 * Helper para garantir que formulários Supabase salvem corretamente
 */

export interface SaveOptions {
  showToast?: boolean;
  throwError?: boolean;
}

/**
 * Executa uma operação de insert/update garantindo tratamento correto de erros
 */
export async function executarSave<T>(
  promise: Promise<{ data: T | null; error: any }>,
  options: SaveOptions = {}
): Promise<T | null> {
  const { showToast = false, throwError = true } = options;

  try {
    const { data, error } = await promise;

    if (error) {
      console.error('Erro ao salvar:', error);
      
      // Mensagens de erro mais amigáveis
      let mensagem = error.message;
      
      if (error.code === '23505') {
        mensagem = 'Este registro já existe no sistema (chave duplicada)';
      } else if (error.code === '23503') {
        mensagem = 'Registro relacionado não encontrado';
      } else if (error.code === '42501') {
        mensagem = 'Sem permissão para esta operação';
      }

      if (throwError) {
        throw new Error(mensagem);
      }

      return null;
    }

    return data;
  } catch (error: any) {
    if (throwError) {
      throw error;
    }
    return null;
  }
}

/**
 * Valida campos obrigatórios antes de salvar
 */
export function validarCamposObrigatorios(
  data: Record<string, any>,
  camposObrigatorios: string[]
): { valido: boolean; erros: string[] } {
  const erros: string[] = [];

  for (const campo of camposObrigatorios) {
    const valor = data[campo];
    
    if (valor === undefined || valor === null || valor === '') {
      erros.push(`Campo obrigatório: ${campo}`);
    }
  }

  return {
    valido: erros.length === 0,
    erros,
  };
}

/**
 * Remove campos undefined ou null de um objeto antes de enviar ao Supabase
 */
export function limparPayload<T extends Record<string, any>>(payload: T): Partial<T> {
  const limpo: Partial<T> = {};

  for (const key in payload) {
    const valor = payload[key];
    
    // Manter valores 0, false, strings vazias, mas remover undefined/null
    if (valor !== undefined && valor !== null) {
      limpo[key] = valor;
    }
  }

  return limpo;
}

/**
 * Converte strings vazias em null (útil para campos opcionais)
 */
export function emptyToNull<T extends Record<string, any>>(data: T): T {
  const resultado: any = { ...data };

  for (const key in resultado) {
    if (resultado[key] === '') {
      resultado[key] = null;
    }
  }

  return resultado;
}
