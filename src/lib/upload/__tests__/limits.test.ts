import { describe, it, expect } from "vitest";
import {
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_LABEL,
  isWithinUploadLimit,
  uploadSizeExceededMessage,
} from "@/lib/upload/limits";

/**
 * Contrato do limite unificado de upload.
 *
 * Estes testes existem para GARANTIR paridade entre o frontend e o backend
 * (função SQL `public.upload_max_bytes()` + `file_size_limit` dos buckets do
 * Storage, sincronizados pela Edge Function `storage-bucket-upload-limits`).
 *
 * Se algum destes valores mudar sem uma migração + resync, o CI quebra aqui.
 */
describe("upload/limits — contrato", () => {
  it("UPLOAD_MAX_BYTES é exatamente 1 GB (1073741824)", () => {
    expect(UPLOAD_MAX_BYTES).toBe(1024 * 1024 * 1024);
    expect(UPLOAD_MAX_BYTES).toBe(1_073_741_824);
  });

  it("UPLOAD_MAX_LABEL é '1 GB' (usado em toda a UI)", () => {
    expect(UPLOAD_MAX_LABEL).toBe("1 GB");
  });

  it("isWithinUploadLimit aceita arquivos iguais ou menores que 1 GB", () => {
    expect(isWithinUploadLimit(0)).toBe(true);
    expect(isWithinUploadLimit(500 * 1024 * 1024)).toBe(true);
    expect(isWithinUploadLimit(UPLOAD_MAX_BYTES)).toBe(true);
  });

  it("isWithinUploadLimit rejeita arquivos acima de 1 GB", () => {
    expect(isWithinUploadLimit(UPLOAD_MAX_BYTES + 1)).toBe(false);
    expect(isWithinUploadLimit(2 * UPLOAD_MAX_BYTES)).toBe(false);
  });

  it("uploadSizeExceededMessage cita o rótulo unificado", () => {
    expect(uploadSizeExceededMessage("logo.ai")).toContain(UPLOAD_MAX_LABEL);
    expect(uploadSizeExceededMessage("logo.ai")).toContain("logo.ai");
    expect(uploadSizeExceededMessage()).toContain(UPLOAD_MAX_LABEL);
  });
});
