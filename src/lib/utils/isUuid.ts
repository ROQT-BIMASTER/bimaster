/**
 * Verifica se um valor é um UUID canônico (v1–v5).
 *
 * Uso principal: guardar mutations de DELETE contra ids temporários
 * (`temp-…`) criados por updates otimistas, evitando erros
 * `invalid input syntax for type uuid` no Postgres.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}
