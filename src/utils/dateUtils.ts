/**
 * Utilitários para tratamento de datas sem problemas de timezone
 * 
 * O Supabase retorna datas no formato 'YYYY-MM-DD' que são interpretadas
 * como UTC quando usamos new Date() ou parseISO(), causando shift de 1 dia
 * em timezones como Brasil (UTC-3).
 * 
 * Essas funções garantem que as datas sejam interpretadas como data local.
 */

import { format as dateFnsFormat, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Parseia uma string de data (YYYY-MM-DD) como data local, sem timezone shift.
 * 
 * @param dateString - Data no formato 'YYYY-MM-DD' ou ISO string
 * @returns Date object representando a data local
 */
export function parseLocalDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  
  // Se a data está no formato YYYY-MM-DD, adiciona T00:00:00 para evitar timezone shift
  // Isso faz com que a data seja interpretada como local, não UTC
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month é 0-indexed
  }
  
  // Se já tem timezone info ou horário, usa parseISO mas ajusta para local
  if (dateString.includes('T')) {
    const parsed = parseISO(dateString);
    // Se é apenas data sem horário real (00:00:00), ajusta para timezone local
    if (dateString.includes('T00:00:00') || dateString.endsWith('T00:00:00.000Z')) {
      const [year, month, day] = dateString.substring(0, 10).split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return parsed;
  }
  
  // Fallback: tenta como YYYY-MM-DD
  const [year, month, day] = dateString.substring(0, 10).split('-').map(Number);
  if (year && month && day) {
    return new Date(year, month - 1, day);
  }
  
  return new Date(dateString);
}

/**
 * Formata uma data para exibição, tratando corretamente o timezone.
 * 
 * @param dateValue - String de data ou Date object
 * @param formatStr - String de formato (date-fns)
 * @returns String formatada ou fallback
 */
export function formatLocalDate(
  dateValue: string | Date | null | undefined,
  formatStr: string = 'dd/MM/yyyy'
): string {
  if (!dateValue) return '-';
  
  const date = typeof dateValue === 'string' ? parseLocalDate(dateValue) : dateValue;
  if (!date || isNaN(date.getTime())) return '-';
  
  return dateFnsFormat(date, formatStr, { locale: ptBR });
}

/**
 * Obtém a chave de agrupamento (YYYY-MM-DD) de uma data de forma consistente.
 * 
 * @param dateValue - String de data ou Date object
 * @returns String no formato 'YYYY-MM-DD'
 */
export function getDateKey(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '';
  
  if (typeof dateValue === 'string') {
    // Se já está no formato correto, retorna diretamente
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    // Extrai apenas a parte da data
    return dateValue.substring(0, 10);
  }
  
  // Se é Date object, formata para YYYY-MM-DD
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Compara se uma data (string ou Date) é igual a outra data (Date).
 * Ignora horário, compara apenas ano/mês/dia.
 */
export function isSameDay(
  dateValue: string | Date | null | undefined,
  compareDate: Date
): boolean {
  if (!dateValue) return false;
  
  const date = typeof dateValue === 'string' ? parseLocalDate(dateValue) : dateValue;
  if (!date) return false;
  
  return (
    date.getFullYear() === compareDate.getFullYear() &&
    date.getMonth() === compareDate.getMonth() &&
    date.getDate() === compareDate.getDate()
  );
}

/**
 * Obtém a data de hoje no início do dia (00:00:00) local.
 */
export function getToday(): Date {
  // Usa o fuso horário do Brasil para garantir consistência com o banco de dados
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parseInt(parts.find(p => p.type === 'year')!.value);
  const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
  const day = parseInt(parts.find(p => p.type === 'day')!.value);
  return new Date(year, month, day);
}
