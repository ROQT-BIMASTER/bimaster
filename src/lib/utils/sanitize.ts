/**
 * Sanitização de dados para prevenir XSS e injeção de código
 * Remove tags HTML, scripts e caracteres perigosos
 */

/**
 * Remove tags HTML e scripts de uma string
 */
export function sanitizeHtml(input: string): string {
  if (!input) return "";
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

/**
 * Sanitiza texto removendo apenas caracteres de controle perigosos
 * Mantém acentuação e pontuação normal
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  
  return input
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/<script/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

/**
 * Sanitiza CNPJ removendo caracteres não numéricos
 */
export function sanitizeCNPJ(input: string): string {
  if (!input) return "";
  return input.replace(/[^\d]/g, "");
}

/**
 * Sanitiza telefone mantendo apenas números, espaços, parênteses e hífen
 */
export function sanitizePhone(input: string): string {
  if (!input) return "";
  return input.replace(/[^\d\s()\-]/g, "");
}

/**
 * Sanitiza email removendo espaços e convertendo para lowercase
 */
export function sanitizeEmail(input: string): string {
  if (!input) return "";
  return input.trim().toLowerCase().replace(/\s/g, "");
}

/**
 * Sanitiza valores monetários
 */
export function sanitizeCurrency(input: string | number): number {
  if (typeof input === "number") return input;
  if (!input) return 0;
  
  const cleaned = input
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  
  return parseFloat(cleaned) || 0;
}

/**
 * Sanitiza código/referência alfanumérica
 * Permite apenas letras, números, hífen e underscore
 */
export function sanitizeCode(input: string): string {
  if (!input) return "";
  return input.replace(/[^a-zA-Z0-9\-_]/g, "").toUpperCase();
}

/**
 * Sanitiza objeto completo recursivamente
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (typeof value === "string") {
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === "string" ? sanitizeText(item) : 
        typeof item === "object" ? sanitizeObject(item) : 
        item
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

/**
 * Mapeia erros do Supabase para mensagens seguras
 * Previne vazamento de informações técnicas
 */
export function getSafeErrorMessage(error: any): string {
  const errorMsg = error?.message?.toLowerCase() || "";
  
  const errorMap: Record<string, string> = {
    "permission denied": "Você não tem permissão para esta operação",
    "jwt expired": "Sua sessão expirou. Faça login novamente",
    "invalid jwt": "Sessão inválida. Faça login novamente",
    "violates foreign key": "Dados relacionados não encontrados",
    "violates check constraint": "Os dados fornecidos são inválidos",
    "violates unique constraint": "Este registro já existe",
    "duplicate key": "Este registro já existe no sistema",
    "violates not-null": "Campo obrigatório não preenchido",
    "network error": "Erro de conexão. Verifique sua internet",
    "fetch failed": "Erro de conexão. Tente novamente",
    "timeout": "A operação demorou muito. Tente novamente",
  };
  
  for (const [key, message] of Object.entries(errorMap)) {
    if (errorMsg.includes(key)) {
      console.error("[SECURITY] Mapped error:", key);
      return message;
    }
  }
  
  // Log completo no console para debug, mas retorna mensagem genérica
  console.error("[SECURITY] Unhandled error:", {
    message: error?.message,
    code: error?.code,
    details: error?.details,
  });
  
  return "Ocorreu um erro inesperado. Entre em contato com o suporte se o problema persistir";
}
