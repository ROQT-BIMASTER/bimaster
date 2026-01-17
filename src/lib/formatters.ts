/**
 * Funções utilitárias de formatação reutilizáveis
 * Evita duplicação de código em toda aplicação
 */

/**
 * Formata valor monetário em Real Brasileiro
 */
export function formatCurrency(value: number, showCents: boolean = true): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(value);
}

/**
 * Formata valor monetário de forma inteligente com sufixo M (milhões) ou K (milhares)
 * Ideal para dashboards e cards onde o espaço é limitado
 * 
 * @param value - Valor numérico a ser formatado
 * @param options - Opções de formatação
 * @returns String formatada (ex: "R$ 76,8M" ou "R$ 568,2K")
 */
export function formatCurrencySmart(
  value: number, 
  options: { 
    showFullOnHover?: boolean; 
    decimals?: number;
    threshold?: { millions?: number; thousands?: number };
  } = {}
): { formatted: string; full: string; suffix: string | null } {
  const { 
    decimals = 1, 
    threshold = { millions: 1000000, thousands: 1000 } 
  } = options;
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  const fullFormatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  
  if (absValue >= (threshold.millions || 1000000)) {
    const millions = value / 1000000;
    return {
      formatted: `${sign}R$ ${Math.abs(millions).toFixed(decimals).replace('.', ',')}M`,
      full: fullFormatted,
      suffix: 'M'
    };
  }
  
  if (absValue >= (threshold.thousands || 1000)) {
    const thousands = value / 1000;
    return {
      formatted: `${sign}R$ ${Math.abs(thousands).toFixed(decimals).replace('.', ',')}K`,
      full: fullFormatted,
      suffix: 'K'
    };
  }
  
  return {
    formatted: new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value),
    full: fullFormatted,
    suffix: null
  };
}

/**
 * Versão simplificada que retorna apenas a string formatada
 */
export function formatCurrencyCompact(value: number, decimals: number = 1): string {
  return formatCurrencySmart(value, { decimals }).formatted;
}

/**
 * Formata número com separadores de milhar
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formata percentual
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/**
 * Formata data para pt-BR
 */
export function formatDate(date: string | Date, format: 'short' | 'long' | 'full' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const formats = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { day: '2-digit', month: 'long', year: 'numeric' },
    full: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' },
  } as const;

  return new Intl.DateTimeFormat('pt-BR', formats[format] as any).format(d);
}

/**
 * Formata data e hora para pt-BR
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Formata data relativa (há X dias, há X horas)
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'agora há pouco';
  if (diffMins < 60) return `há ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
  if (diffHours < 24) return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  if (diffDays < 30) return `há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
  
  return formatDate(d);
}

/**
 * Formata CPF (000.000.000-00)
 */
export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CNPJ (00.000.000/0000-00)
 */
export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata telefone (11) 98888-8888
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
}

/**
 * Formata CEP (00000-000)
 */
export function formatCEP(cep: string): string {
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
}

/**
 * Trunca texto com reticências
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Formata bytes em unidade legível
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Capitaliza primeira letra de cada palavra
 */
export function capitalize(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Formata duração em minutos para formato legível
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}
