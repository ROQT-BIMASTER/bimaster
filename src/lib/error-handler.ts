/**
 * Sistema centralizado de tratamento de erros
 * Fornece mensagens amigáveis e logging adequado
 */

import { logger } from './logger';
import { PostgrestError } from '@supabase/supabase-js';

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

interface ErrorContext {
  userId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

/**
 * Obtém mensagem amigável para erros Supabase
 */
export function getSupabaseErrorMessage(error: PostgrestError): string {
  const errorMap: Record<string, string> = {
    '23505': 'Este registro já existe no sistema.',
    '23503': 'Não foi possível completar a operação. Verifique os dados relacionados.',
    '23502': 'Campos obrigatórios não foram preenchidos.',
    '42501': 'Você não tem permissão para realizar esta ação.',
    '42P01': 'Recurso não encontrado no sistema.',
    'PGRST116': 'Nenhum registro encontrado.',
    'PGRST301': 'Limite de requisições excedido. Tente novamente em alguns instantes.',
  };

  return errorMap[error.code] || error.message || 'Erro ao processar sua solicitação.';
}

/**
 * Obtém mensagem amigável para erros de autenticação
 */
export function getAuthErrorMessage(error: any): string {
  const message = error?.message || '';
  
  if (message.includes('Invalid login credentials')) {
    return 'Email ou senha incorretos.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Por favor, confirme seu email antes de fazer login.';
  }
  if (message.includes('User already registered')) {
    return 'Este email já está cadastrado.';
  }
  if (message.includes('Password should be at least')) {
    return 'A senha deve ter no mínimo 6 caracteres.';
  }
  if (message.includes('rate limit')) {
    return 'Muitas tentativas. Por favor, aguarde alguns minutos.';
  }
  if (message.includes('Network request failed') || message.includes('Failed to fetch')) {
    return 'Erro de conexão. Verifique sua internet.';
  }
  
  return 'Erro de autenticação. Tente novamente.';
}

/**
 * Obtém mensagem amigável para erros de network
 */
export function getNetworkErrorMessage(error: any): string {
  if (!navigator.onLine) {
    return 'Sem conexão com a internet. Verifique sua rede.';
  }
  
  if (error?.message?.includes('timeout')) {
    return 'A operação demorou muito. Tente novamente.';
  }
  
  return 'Erro de conexão. Tente novamente em alguns instantes.';
}

/**
 * Handler centralizado de erros
 */
export function handleError(error: unknown, context?: ErrorContext): string {
  // Log do erro
  logger.error(
    'Error handled',
    error instanceof Error ? error : new Error(String(error)),
    context
  );

  // Erro customizado da aplicação
  if (error instanceof AppError) {
    return error.message;
  }

  // Erro do Supabase (PostgrestError)
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return getSupabaseErrorMessage(error as PostgrestError);
  }

  // Erro de rede
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return getNetworkErrorMessage(error);
  }

  // Erro genérico
  if (error instanceof Error) {
    // Em desenvolvimento, mostrar mensagem completa
    if (import.meta.env.DEV) {
      return error.message;
    }
    // Em produção, mensagem genérica
    return 'Ocorreu um erro inesperado. Tente novamente.';
  }

  return 'Ocorreu um erro inesperado. Tente novamente.';
}

/**
 * Wrapper para chamadas assíncronas com tratamento de erro
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: ErrorContext
): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (error) {
    const errorMessage = handleError(error, context);
    return { data: null, error: errorMessage };
  }
}

/**
 * Validação de dados com tratamento de erro
 */
export function validateOrThrow<T>(
  data: unknown,
  validator: (data: unknown) => T,
  errorMessage: string = 'Dados inválidos'
): T {
  try {
    return validator(data);
  } catch (error) {
    throw new AppError(errorMessage, 'VALIDATION_ERROR', 400);
  }
}
