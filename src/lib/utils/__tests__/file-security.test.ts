import { describe, it, expect } from "vitest";
import {
  validateFileForUpload,
  validateFilesForUpload,
  describeUploadError,
} from "@/lib/utils/file-security";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Cria um File com bytes iniciais opcionais e tamanho total controlado. */
function makeFile(
  name: string,
  type: string,
  sizeBytes: number,
  magicPrefix?: number[],
  magicOffset = 0,
): File {
  const buffer = new Uint8Array(Math.max(sizeBytes, (magicPrefix?.length ?? 0) + magicOffset));
  if (magicPrefix) {
    buffer.set(magicPrefix, magicOffset);
  }
  return new File([buffer], name, { type });
}

const MP4_MAGIC = [0x66, 0x74, 0x79, 0x70]; // "ftyp" at offset 4
const WEBM_MAGIC = [0x1A, 0x45, 0xDF, 0xA3];
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

const MB = 1024 * 1024;

// ── Casos: tamanho abaixo do limite ────────────────────────────────────────────

describe("validateFileForUpload — vídeos dentro do limite", () => {
  it("aceita MP4 de 5 MB com MIME e magic bytes corretos", async () => {
    const file = makeFile("clip.mp4", "video/mp4", 5 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("aceita MOV de 50 MB (abaixo do limite de 100 MB)", async () => {
    const file = makeFile("video.mov", "video/quicktime", 50 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });

  it("aceita WEBM de 99 MB (bem próximo do limite)", async () => {
    const file = makeFile("stream.webm", "video/webm", 99 * MB, WEBM_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });

  it("aceita MP4 exatamente no limite de 100 MB", async () => {
    const file = makeFile("edge.mp4", "video/mp4", 100 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });
});

// ── Casos: tamanho acima do limite ─────────────────────────────────────────────

describe("validateFileForUpload — vídeos acima do limite", () => {
  it("rejeita MP4 de 101 MB com código SIZE_EXCEEDED", async () => {
    const file = makeFile("big.mp4", "video/mp4", 101 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
  });

  it("mensagem de vídeo acima do limite cita 100 MB e sugere compressão (HandBrake/H.264)", async () => {
    const file = makeFile("big.mp4", "video/mp4", 150 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("100 MB");
    expect(result.error?.toLowerCase()).toContain("handbrake");
    expect(result.error).toContain(".mp4");
  });

  it("rejeita MOV de 200 MB", async () => {
    const file = makeFile("huge.mov", "video/quicktime", 200 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
    expect(result.error).toContain("200");
  });

  it("rejeita WEBM acima de 100 MB", async () => {
    const file = makeFile("live.webm", "video/webm", 120 * MB, WEBM_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
  });

  it("rejeita PDF acima de 20 MB com mensagem citando 20 MB e sugerindo vídeo até 100 MB", async () => {
    const file = makeFile("doc.pdf", "application/pdf", 21 * MB, PDF_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
    expect(result.error).toContain("20 MB");
    expect(result.error).toContain("100 MB");
  });
});

// ── Casos: tipo não permitido ──────────────────────────────────────────────────

describe("validateFileForUpload — tipos não permitidos", () => {
  it("rejeita .avi (vídeo não whitelisted) com EXTENSION_NOT_ALLOWED", async () => {
    const file = makeFile("clip.avi", "video/x-msvideo", 5 * MB);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("EXTENSION_NOT_ALLOWED");
    expect(result.error).toContain(".avi");
    expect(result.error).toContain("MP4");
    expect(result.error).toContain("MOV");
    expect(result.error).toContain("WEBM");
  });

  it("rejeita .mkv com mensagem listando formatos aceitos", async () => {
    const file = makeFile("movie.mkv", "video/x-matroska", 5 * MB);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("EXTENSION_NOT_ALLOWED");
    expect(result.error).toMatch(/PDF|Office|MP4/);
  });

  it("rejeita .exe com EXTENSION_BLOCKED (perigoso)", async () => {
    const file = makeFile("malware.exe", "application/x-msdownload", 1 * MB);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("EXTENSION_BLOCKED");
    expect(result.error).toContain(".exe");
  });

  it("rejeita MP4 renomeado com MIME inválido (application/x-shockwave-flash)", async () => {
    const file = makeFile("fake.mp4", "application/x-shockwave-flash", 5 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("MIME_REJECTED");
    expect(result.error).toContain("application/x-shockwave-flash");
  });

  it("rejeita MP4 com magic bytes inválidos (arquivo falsificado)", async () => {
    // Bytes iniciais explicitamente errados (não contêm "ftyp" no offset 4)
    const wrongBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A]);
    const file = new File([wrongBytes], "fake.mp4", { type: "video/mp4" });
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("MAGIC_BYTES_MISMATCH");
    expect(result.error).toContain("fake.mp4");
  });

  it("rejeita extensão dupla suspeita (report.pdf.exe)", async () => {
    const file = makeFile("report.pdf.exe", "application/pdf", 1 * MB);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    // .exe cai primeiro em EXTENSION_BLOCKED
    expect(["EXTENSION_BLOCKED", "DOUBLE_EXTENSION"]).toContain(result.code);
  });
});

// ── validateFilesForUpload (batch) ────────────────────────────────────────────

describe("validateFilesForUpload — múltiplos arquivos", () => {
  it("retorna apenas os arquivos inválidos", async () => {
    const ok = makeFile("ok.mp4", "video/mp4", 10 * MB, MP4_MAGIC, 4);
    const tooBig = makeFile("big.mp4", "video/mp4", 150 * MB, MP4_MAGIC, 4);
    const wrongType = makeFile("bad.avi", "video/x-msvideo", 5 * MB);
    const errors = await validateFilesForUpload([ok, tooBig, wrongType]);
    expect(errors).toHaveLength(2);
    expect(errors.map(e => e.file.name).sort()).toEqual(["bad.avi", "big.mp4"]);
  });

  it("retorna lista vazia quando todos os arquivos são válidos", async () => {
    const a = makeFile("a.mp4", "video/mp4", 1 * MB, MP4_MAGIC, 4);
    const b = makeFile("b.webm", "video/webm", 1 * MB, WEBM_MAGIC);
    const errors = await validateFilesForUpload([a, b]);
    expect(errors).toEqual([]);
  });
});

// ── describeUploadError — mensagens amigáveis ─────────────────────────────────

describe("describeUploadError", () => {
  it("mapeia 'payload too large' do backend para mensagem de limite", () => {
    const out = describeUploadError("Payload too large");
    expect(out.title).toBe("Arquivo muito grande");
    expect(out.description).toContain("20 MB");
    expect(out.description).toContain("100 MB");
    expect(out.description).toMatch(/MP4|MOV|WEBM/);
  });

  it("mapeia 'mime type ... not supported' para tipo não permitido", () => {
    const out = describeUploadError("mime type video/x-msvideo is not supported");
    expect(out.title).toBe("Tipo de arquivo não permitido");
    expect(out.description).toMatch(/MP4|WEBM/);
  });

  it("preserva mensagem client-side de 'excede o limite de 100 MB'", () => {
    const original = "Vídeo \".mp4\" tem 150.0 MB e excede o limite de 100 MB. Comprima o vídeo.";
    const out = describeUploadError(original);
    expect(out.title).toBe("Arquivo acima do limite permitido");
    expect(out.description).toBe(original);
  });

  it("preserva mensagem client-side de 'excede o limite de 20 MB'", () => {
    const original = "Arquivo \".pdf\" tem 25.0 MB e excede o limite de 20 MB.";
    const out = describeUploadError(original);
    expect(out.title).toBe("Arquivo acima do limite permitido");
    expect(out.description).toBe(original);
  });

  it("mapeia mensagem de extensão para tipo não permitido", () => {
    const out = describeUploadError("Extensão \".avi\" não é suportada.");
    expect(out.title).toBe("Tipo de arquivo não permitido");
    expect(out.description).toContain(".avi");
  });

  it("fallback genérico quando não reconhece o padrão", () => {
    const out = describeUploadError("Network error xyz");
    expect(out.title).toBe("Falha ao enviar arquivo");
    expect(out.description).toBe("Network error xyz");
  });
});
