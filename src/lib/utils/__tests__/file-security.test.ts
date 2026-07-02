import { describe, it, expect } from "vitest";
import {
  validateFileForUpload,
  validateFilesForUpload,
  describeUploadError,
} from "@/lib/utils/file-security";
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_LABEL } from "@/lib/upload/limits";

/**
 * Testes do validador unificado de upload.
 *
 * Regra atual (sincronizada com backend / storage buckets):
 *   Limite único de UPLOAD_MAX_BYTES (1 GB) para QUALQUER extensão suportada,
 *   incluindo design (.ai, .psd) e vídeos (mp4/mov/webm).
 *
 * Se este limite mudar no futuro, atualize `src/lib/upload/limits.ts` e a
 * função SQL `public.upload_max_bytes()` na mesma migração — os testes abaixo
 * usam a constante importada para não divergir.
 */

function makeFile(
  name: string,
  type: string,
  sizeBytes: number,
  magicPrefix?: number[],
  magicOffset = 0,
): File {
  const realLen = (magicPrefix?.length ?? 0) + magicOffset;
  const buffer = new Uint8Array(Math.max(realLen, 16));
  if (magicPrefix) buffer.set(magicPrefix, magicOffset);
  const file = new File([buffer], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes, configurable: true });
  return file;
}

const MP4_MAGIC = [0x66, 0x74, 0x79, 0x70];
const WEBM_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const DOCX_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const JPG_MAGIC = [0xff, 0xd8, 0xff];
const PSD_MAGIC = [0x38, 0x42, 0x50, 0x53]; // "8BPS"

const MB = 1024 * 1024;
const ONE_GB = 1024 * MB;

describe("UPLOAD_MAX_BYTES — invariante de contrato com backend", () => {
  it("é exatamente 1 GB (1073741824 bytes)", () => {
    expect(UPLOAD_MAX_BYTES).toBe(ONE_GB);
  });

  it("rótulo legível é '1 GB'", () => {
    expect(UPLOAD_MAX_LABEL).toBe("1 GB");
  });
});

describe("validateFileForUpload — abaixo do limite unificado de 1 GB", () => {
  it("aceita MP4 de 500 MB", async () => {
    const file = makeFile("clip.mp4", "video/mp4", 500 * MB, MP4_MAGIC, 4);
    expect((await validateFileForUpload(file)).valid).toBe(true);
  });

  it("aceita PDF de 900 MB", async () => {
    const file = makeFile("doc.pdf", "application/pdf", 900 * MB, PDF_MAGIC);
    expect((await validateFileForUpload(file)).valid).toBe(true);
  });

  it("aceita PNG exatamente no limite (1 GB)", async () => {
    const file = makeFile("big.png", "image/png", ONE_GB, PNG_MAGIC);
    expect((await validateFileForUpload(file)).valid).toBe(true);
  });

  it("aceita ZIP de 15 MB", async () => {
    const file = makeFile("pacote.zip", "application/zip", 15 * MB, DOCX_MAGIC);
    expect((await validateFileForUpload(file)).valid).toBe(true);
  });
});

describe("validateFileForUpload — .ai e .psd (design)", () => {
  it("aceita .psd de 800 MB com MIME image/vnd.adobe.photoshop", async () => {
    const file = makeFile("layout.psd", "image/vnd.adobe.photoshop", 800 * MB, PSD_MAGIC);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(true);
  });

  it("aceita .psd de 800 MB com MIME genérico application/octet-stream", async () => {
    const file = makeFile("layout.psd", "application/octet-stream", 800 * MB, PSD_MAGIC);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(true);
  });

  it("aceita .ai (Illustrator moderno, magic %PDF) até 1 GB", async () => {
    const file = makeFile("logo.ai", "application/pdf", ONE_GB, PDF_MAGIC);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(true);
  });

  it("aceita .ai (Illustrator legado, magic %!PS)", async () => {
    const ps = [0x25, 0x21, 0x50, 0x53];
    const file = makeFile("legado.ai", "application/postscript", 200 * MB, ps);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(true);
  });

  it("rejeita .psd acima de 1 GB com SIZE_EXCEEDED", async () => {
    const file = makeFile("huge.psd", "image/vnd.adobe.photoshop", ONE_GB + MB, PSD_MAGIC);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("SIZE_EXCEEDED");
    expect(r.error).toContain("1 GB");
  });

  it("rejeita .ai acima de 1 GB com SIZE_EXCEEDED", async () => {
    const file = makeFile("huge.ai", "application/pdf", ONE_GB + MB, PDF_MAGIC);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("SIZE_EXCEEDED");
  });

  // Nota: validação por magic bytes é ambiente-dependente em jsdom
  // (File.slice + arrayBuffer não obedece Object.defineProperty(size)).
  // Cobertura de magic bytes fica para os testes E2E de upload real.

  it("lista '.ai' e '.psd' entre as extensões aceitas quando rejeita outra", async () => {
    const file = makeFile("clip.avi", "video/x-msvideo", 5 * MB);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/AI/);
    expect(r.error).toMatch(/PSD/);
    expect(r.error).toContain("1 GB");
  });
});

describe("validateFileForUpload — acima do limite unificado de 1 GB", () => {
  it("rejeita MP4 acima de 1 GB", async () => {
    const file = makeFile("big.mp4", "video/mp4", ONE_GB + MB, MP4_MAGIC, 4);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("SIZE_EXCEEDED");
    expect(r.error).toContain("1 GB");
  });

  it("rejeita PDF acima de 1 GB", async () => {
    const file = makeFile("big.pdf", "application/pdf", ONE_GB + 5 * MB, PDF_MAGIC);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("SIZE_EXCEEDED");
  });

  it("rejeita ZIP acima de 1 GB", async () => {
    const file = makeFile("pacote.zip", "application/zip", ONE_GB + MB, DOCX_MAGIC);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("SIZE_EXCEEDED");
  });
});

describe("validateFileForUpload — tipos não permitidos", () => {
  it("rejeita .avi (EXTENSION_NOT_ALLOWED)", async () => {
    const file = makeFile("clip.avi", "video/x-msvideo", 5 * MB);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("EXTENSION_NOT_ALLOWED");
  });

  it("rejeita .exe (EXTENSION_BLOCKED)", async () => {
    const file = makeFile("malware.exe", "application/x-msdownload", 1 * MB);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("EXTENSION_BLOCKED");
  });

  it("rejeita MIME divergente da extensão", async () => {
    const file = makeFile("fake.mp4", "application/x-shockwave-flash", 5 * MB, MP4_MAGIC, 4);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(false);
    expect(r.code).toBe("MIME_REJECTED");
  });

  it("bloqueia extensão dupla suspeita (report.pdf.exe)", async () => {
    const file = makeFile("report.pdf.exe", "application/pdf", 1 * MB);
    const r = await validateFileForUpload(file);
    expect(r.valid).toBe(false);
    expect(["EXTENSION_BLOCKED", "DOUBLE_EXTENSION"]).toContain(r.code);
  });
});

describe("validateFilesForUpload — batch", () => {
  it("retorna apenas inválidos", async () => {
    const ok = makeFile("ok.mp4", "video/mp4", 10 * MB, MP4_MAGIC, 4);
    const okPsd = makeFile("art.psd", "image/vnd.adobe.photoshop", 50 * MB, PSD_MAGIC);
    const tooBig = makeFile("big.psd", "image/vnd.adobe.photoshop", ONE_GB + MB, PSD_MAGIC);
    const wrong = makeFile("bad.avi", "video/x-msvideo", 5 * MB);
    const errors = await validateFilesForUpload([ok, okPsd, tooBig, wrong]);
    expect(errors.map((e) => e.file.name).sort()).toEqual(["bad.avi", "big.psd"]);
  });
});

describe("describeUploadError — mensagens amigáveis", () => {
  it("mapeia 'payload too large' do storage para orientação de limite de bucket", () => {
    const out = describeUploadError("Payload too large");
    expect(out.title).toMatch(/limite/i);
    expect(out.description).toContain(UPLOAD_MAX_LABEL);
  });

  it("traduz 'database schema is out of sync' (na verdade é cap de bucket) para mensagem clara", () => {
    const out = describeUploadError("The database schema is out of sync. Please run migrations or contact support.");
    expect(out.title).toMatch(/limite/i);
    expect(out.description).toContain(UPLOAD_MAX_LABEL);
    expect(out.description).not.toMatch(/schema/i);
  });

  it("mapeia 415 / 'mime type ... not supported' para tipo não permitido", () => {
    const out = describeUploadError("mime type application/foo is not supported");
    expect(out.title).toMatch(/tipo/i);
    expect(out.description).toMatch(/AI\/PSD|design/i);
  });

  it("preserva mensagem client-side de 'excede o limite'", () => {
    const raw = 'Arquivo ".psd" tem 1100.0 MB e excede o limite máximo de 1 GB (1024 MB) por arquivo.';
    const out = describeUploadError(raw);
    expect(out.description).toBe(raw);
  });

  it("mapeia 'file_size_limit' do bucket para orientação de limite", () => {
    const out = describeUploadError("The object exceeded the maximum allowed size (file_size_limit)");
    expect(out.description).toContain(UPLOAD_MAX_LABEL);
  });

  it("fallback preserva a mensagem crua", () => {
    const out = describeUploadError("Erro desconhecido xyz");
    expect(out.description).toBe("Erro desconhecido xyz");
  });
});

describe("boundary de extensão", () => {
  it("aceita .PSD em CAIXA ALTA", async () => {
    const file = makeFile("Layout.PSD", "image/vnd.adobe.photoshop", 1 * MB, PSD_MAGIC);
    expect((await validateFileForUpload(file)).valid).toBe(true);
  });

  it("aceita .AI em CAIXA ALTA", async () => {
    const file = makeFile("Logo.AI", "application/pdf", 1 * MB, PDF_MAGIC);
    expect((await validateFileForUpload(file)).valid).toBe(true);
  });

  it("aceita JPG normal", async () => {
    const file = makeFile("foto.jpg", "image/jpeg", 1 * MB, JPG_MAGIC);
    expect((await validateFileForUpload(file)).valid).toBe(true);
  });

  it("aceita WEBM normal", async () => {
    const file = makeFile("stream.webm", "video/webm", 10 * MB, WEBM_MAGIC);
    expect((await validateFileForUpload(file)).valid).toBe(true);
  });
});
