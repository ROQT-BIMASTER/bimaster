/**
 * Valida matematicamente os dígitos verificadores de um CNPJ.
 * Aceita CNPJ formatado (00.000.000/0000-00) ou apenas dígitos.
 *
 * Retorna `true` se o CNPJ tem 14 dígitos e os DVs estão corretos.
 * Retorna `false` para CNPJs com tamanho inválido, todos dígitos iguais ou DV incorreto.
 */
export function validateCnpjDV(cnpj: string): boolean {
  if (!cnpj) return false;

  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;

  // Rejeita sequências repetidas (00000000000000, 11111111111111, etc.)
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDV = (base: string, weights: number[]): number => {
    const sum = base
      .split("")
      .reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const dv1 = calcDV(digits.slice(0, 12), weights1);
  if (dv1 !== parseInt(digits[12], 10)) return false;

  const dv2 = calcDV(digits.slice(0, 13), weights2);
  if (dv2 !== parseInt(digits[13], 10)) return false;

  return true;
}
