import { z } from "zod";

/**
 * Linha do Produto — campo obrigatório que identifica a categoria
 * do produto (ex.: Lip, Eye, Face, Skin Care).
 *
 * Regras:
 *  - Não vazio (após trim).
 *  - Tamanho 1–60 caracteres.
 *  - Apenas letras (Unicode, com acentos), números, espaço, hífen, barra `/`
 *    e vírgula. Bloqueia símbolos arbitrários (`!@#$%`, etc.).
 */
export const linhaProdutoSchema = z
  .string({ required_error: "Informe a Linha do Produto." })
  .trim()
  .min(1, "Informe a Linha do Produto.")
  .max(60, "Linha do Produto deve ter até 60 caracteres.")
  .regex(
    /^[\p{L}\p{N}\s\-\/,]+$/u,
    "Use apenas letras, números, espaço, hífen, barra ou vírgula.",
  );

export function validateLinhaProduto(value: string | undefined | null): string | null {
  const result = linhaProdutoSchema.safeParse(value ?? "");
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "Linha do Produto inválida.";
}
