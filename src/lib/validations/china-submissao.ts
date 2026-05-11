import { z } from "zod";

/**
 * Linha do Produto — campo opcional que identifica a categoria
 * do produto (ex.: Lip, Eye, Face, Skin Care).
 *
 * Regras (apenas quando preenchido):
 *  - Tamanho até 60 caracteres.
 *  - Apenas letras (Unicode, com acentos), números, espaço, hífen, barra `/`
 *    e vírgula. Bloqueia símbolos arbitrários (`!@#$%`, etc.).
 *
 * Vazio/branco é aceito e tratado como "não informado".
 */
export const linhaProdutoSchema = z
  .string()
  .trim()
  .max(60, "Linha do Produto deve ter até 60 caracteres.")
  .regex(
    /^[\p{L}\p{N}\s\-\/,]*$/u,
    "Use apenas letras, números, espaço, hífen, barra ou vírgula.",
  )
  .optional()
  .nullable();

export function validateLinhaProduto(value: string | undefined | null): string | null {
  // Vazio é válido (campo não obrigatório)
  if (value == null || value.trim() === "") return null;
  const result = linhaProdutoSchema.safeParse(value);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "Linha do Produto inválida.";
}
