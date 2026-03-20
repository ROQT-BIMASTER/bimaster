// _shared/validate.ts — Input validation with Zod (SEG-4)
import { z } from "https://esm.sh/zod@3.22.4";

export { z };

/**
 * Parse and validate a JSON body against a Zod schema.
 * Returns validated data or throws ValidationError.
 */
export function validateBody<T extends z.ZodTypeAny>(
  body: unknown,
  schema: T
): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.issues);
  }
  return result.data;
}

/**
 * Sanitize a string: remove control chars, trim, limit length.
 */
export function sanitizeString(input: string, maxLength = 10000): string {
  // Remove control characters except newlines and tabs
  // deno-lint-ignore no-control-regex
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, maxLength);
}

export class ValidationError extends Error {
  status = 400;
  issues: z.ZodIssue[];
  constructor(issues: z.ZodIssue[]) {
    super("Payload inválido");
    this.name = "ValidationError";
    this.issues = issues;
  }
}
