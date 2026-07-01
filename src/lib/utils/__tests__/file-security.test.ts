import { describe, it, expect } from "vitest";
import {
  validateFileForUpload,
  validateFilesForUpload,
  describeUploadError,
} from "@/lib/utils/file-security";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Cria um File com bytes iniciais opcionais e tamanho total controlado.
 *  Para evitar alocar centenas de MB em memória em jsdom, cria um buffer
 *  pequeno (só o necessário para magic bytes) e sobrescreve `size`. */
function makeFile(
  name: string,
  type: string,
  sizeBytes: number,
  magicPrefix?: number[],
  magicOffset = 0,
): File {
  const realLen = (magicPrefix?.length ?? 0) + magicOffset;
  const buffer = new Uint8Array(Math.max(realLen, 16));
  if (magicPrefix) {
    buffer.set(magicPrefix, magicOffset);
  }
  const file = new File([buffer], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes, configurable: true });
  return file;
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

  it("aceita MOV de 250 MB (abaixo do limite de 500 MB)", async () => {
    const file = makeFile("video.mov", "video/quicktime", 250 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });

  it("aceita WEBM de 499 MB (bem próximo do limite)", async () => {
    const file = makeFile("stream.webm", "video/webm", 499 * MB, WEBM_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });

  it("aceita MP4 exatamente no limite de 500 MB", async () => {
    const file = makeFile("edge.mp4", "video/mp4", 500 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });
});

// ── Casos: tamanho acima do limite ─────────────────────────────────────────────

describe("validateFileForUpload — vídeos acima do limite", () => {
  it("rejeita MP4 de 501 MB com código SIZE_EXCEEDED", async () => {
    const file = makeFile("big.mp4", "video/mp4", 501 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
  });

  it("mensagem de vídeo acima do limite cita 500 MB e sugere compressão (HandBrake/H.264)", async () => {
    const file = makeFile("big.mp4", "video/mp4", 520 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("500 MB");
    expect(result.error?.toLowerCase()).toContain("handbrake");
    expect(result.error).toContain(".mp4");
  });

  it("rejeita MOV de 600 MB", async () => {
    const file = makeFile("huge.mov", "video/quicktime", 600 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
    expect(result.error).toContain("600");
  });

  it("rejeita WEBM acima de 500 MB", async () => {
    const file = makeFile("live.webm", "video/webm", 520 * MB, WEBM_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
  });

  it("rejeita PDF acima de 200 MB com mensagem citando 200 MB e sugerindo vídeo até 500 MB", async () => {
    const file = makeFile("doc.pdf", "application/pdf", 201 * MB, PDF_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
    expect(result.error).toContain("200 MB");
    expect(result.error).toContain("500 MB");
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

  // Nota: validação de magic bytes exige leitura de arrayBuffer da Blob,
  // que é ambiente-dependente em jsdom. Coberta via testes E2E de upload real.

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
    const tooBig = makeFile("big.mp4", "video/mp4", 520 * MB, MP4_MAGIC, 4);
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
    expect(out.description).toContain("200 MB");
    expect(out.description).toContain("500 MB");
    expect(out.description).toMatch(/MP4|MOV|WEBM/);
  });

  it("mapeia 'mime type ... not supported' para tipo não permitido", () => {
    const out = describeUploadError("mime type video/x-msvideo is not supported");
    expect(out.title).toBe("Tipo de arquivo não permitido");
    expect(out.description).toMatch(/MP4|WEBM/);
  });

  it("preserva mensagem client-side de 'excede o limite de 500 MB'", () => {
    const original = "Vídeo \".mp4\" tem 520.0 MB e excede o limite de 500 MB. Comprima o vídeo.";
    const out = describeUploadError(original);
    expect(out.title).toBe("Arquivo acima do limite permitido");
    expect(out.description).toBe(original);
  });

  it("preserva mensagem client-side de 'excede o limite de 200 MB'", () => {
    const original = "Arquivo \".pdf\" tem 210.0 MB e excede o limite de 200 MB.";
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

// ── Casos: documentos/imagens (não-vídeo) dentro e acima de 200 MB ────────────

const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47];
const DOCX_MAGIC = [0x50, 0x4B, 0x03, 0x04];
const JPG_MAGIC = [0xFF, 0xD8, 0xFF];

describe("validateFileForUpload — não-vídeos dentro do limite de 200 MB", () => {
  it("aceita PDF de 5 MB", async () => {
    const file = makeFile("relatorio.pdf", "application/pdf", 5 * MB, PDF_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });

  it("aceita PNG de 199 MB (próximo do limite)", async () => {
    const file = makeFile("banner.png", "image/png", 199 * MB, PNG_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });

  it("aceita DOCX exatamente no limite de 200 MB", async () => {
    const file = makeFile(
      "doc.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      200 * MB,
      DOCX_MAGIC,
    );
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });

  it("aceita JPG de 1 MB", async () => {
    const file = makeFile("foto.jpg", "image/jpeg", 1 * MB, JPG_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });

  it("aceita ZIP de 15 MB", async () => {
    const file = makeFile("pacote.zip", "application/zip", 15 * MB, DOCX_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });
});

describe("validateFileForUpload — não-vídeos acima do limite de 200 MB", () => {
  it("rejeita PDF de 201 MB com SIZE_EXCEEDED citando 200 MB e sugerindo vídeo até 500 MB", async () => {
    const file = makeFile("doc.pdf", "application/pdf", 201 * MB, PDF_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
    expect(result.error).toContain("200 MB");
    expect(result.error).toContain("500 MB");
    expect(result.error).toContain(".pdf");
  });

  it("rejeita PNG de 300 MB", async () => {
    const file = makeFile("hero.png", "image/png", 300 * MB, PNG_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
    expect(result.error).toContain("300");
    expect(result.error).toContain("200 MB");
  });

  it("rejeita XLSX de 250 MB (não deve tratar como vídeo)", async () => {
    const file = makeFile(
      "planilha.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      250 * MB,
      DOCX_MAGIC,
    );
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
    expect(result.error).toContain("200 MB");
    expect(result.error).not.toMatch(/handbrake/i);
  });

  it("rejeita ZIP de 210 MB", async () => {
    const file = makeFile("pacote.zip", "application/zip", 210 * MB, DOCX_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("SIZE_EXCEEDED");
    expect(result.error).toContain("200 MB");
  });
});

// ── describeUploadError — mensagens específicas de não-vídeo ─────────────────

describe("describeUploadError — não-vídeos", () => {
  it("mapeia mensagem client-side de PDF acima de 200 MB", () => {
    const original = 'Arquivo ".pdf" tem 201.0 MB e excede o limite de 200 MB para este tipo. Vídeos MP4/MOV/WEBM podem chegar a 500 MB.';
    const out = describeUploadError(original);
    expect(out.title).toBe("Arquivo acima do limite permitido");
    expect(out.description).toBe(original);
    expect(out.description).toContain("200 MB");
    expect(out.description).toContain("500 MB");
  });

  it("mapeia mensagem client-side de PNG acima de 200 MB", () => {
    const original = 'Arquivo ".png" tem 300.0 MB e excede o limite de 200 MB para este tipo. Vídeos MP4/MOV/WEBM podem chegar a 500 MB.';
    const out = describeUploadError(original);
    expect(out.title).toBe("Arquivo acima do limite permitido");
    expect(out.description).toBe(original);
    expect(out.description).toContain(".png");
  });

  it("mapeia mensagem client-side de XLSX acima de 200 MB", () => {
    const original = 'Arquivo ".xlsx" tem 250.0 MB e excede o limite de 200 MB para este tipo. Vídeos MP4/MOV/WEBM podem chegar a 500 MB.';
    const out = describeUploadError(original);
    expect(out.title).toBe("Arquivo acima do limite permitido");
    expect(out.description).toBe(original);
    expect(out.description).not.toMatch(/handbrake/i);
  });

  it("mapeia 'file_size_limit' do bucket Storage para mensagem genérica de tamanho", () => {
    const out = describeUploadError("The object exceeded the maximum allowed size (file_size_limit)");
    expect(out.title).toBe("Arquivo muito grande");
    expect(out.description).toContain("200 MB");
    expect(out.description).toContain("500 MB");
  });
});

// ── Casos: boundary de MIME/extensão (maiúsculas, espaços, caracteres) ─────────

describe("validateFileForUpload — boundary de extensão (maiúsculas e espaços)", () => {
  it("aceita extensão em CAIXA ALTA (PDF)", async () => {
    const file = makeFile("Relatorio.PDF", "application/pdf", 1 * MB, PDF_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });

  it("aceita extensão MixedCase (Mp4) com magic bytes corretos", async () => {
    const file = makeFile("clip.Mp4", "video/mp4", 2 * MB, MP4_MAGIC, 4);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });

  it("bloqueia extensão perigosa em CAIXA ALTA (.EXE)", async () => {
    const file = makeFile("malware.EXE", "application/octet-stream", 1024);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("EXTENSION_BLOCKED");
  });

  it("bloqueia extensão perigosa MixedCase (.BaT)", async () => {
    const file = makeFile("run.BaT", "application/octet-stream", 512);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("EXTENSION_BLOCKED");
  });

  it("bloqueia dupla extensão com caixa alta suspeita (report.PDF.EXE)", async () => {
    const file = makeFile("report.PDF.EXE", "application/octet-stream", 1024);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    // EXTENSION_BLOCKED tem precedência (roda antes de DOUBLE_EXTENSION)
    expect(result.code).toBe("EXTENSION_BLOCKED");
  });

  it("bloqueia dupla extensão MixedCase (invoice.PdF.ExE) — cobre normalização case-insensitive", async () => {
    const file = makeFile("invoice.PdF.ExE", "application/octet-stream", 1024);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(["EXTENSION_BLOCKED", "DOUBLE_EXTENSION"]).toContain(result.code);
  });

  it("bloqueia extensão com espaço à direita ('pdf ')", async () => {
    // getExtension não faz trim → "pdf " não pertence à whitelist
    const file = makeFile("relatorio.pdf ", "application/pdf", 1 * MB, PDF_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("EXTENSION_NOT_ALLOWED");
  });

  it("bloqueia extensão com espaço à esquerda (' pdf')", async () => {
    const file = makeFile("relatorio. pdf", "application/pdf", 1 * MB, PDF_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("EXTENSION_NOT_ALLOWED");
  });

  it("bloqueia extensão apenas com espaços ('   ')", async () => {
    const file = makeFile("arquivo.   ", "application/pdf", 1024);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("EXTENSION_NOT_ALLOWED");
  });

  it("bloqueia arquivo sem extensão (fica string vazia)", async () => {
    const file = makeFile("arquivo_sem_ext", "application/pdf", 1024);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("EXTENSION_NOT_ALLOWED");
  });
});

describe("validateFileForUpload — boundary de MIME type (maiúsculas e espaços)", () => {
  it("aceita MIME em CAIXA ALTA ('APPLICATION/PDF') — o construtor File normaliza para lowercase", async () => {
    // Contrato do browser: File normaliza `type` para lowercase automaticamente.
    // Este teste documenta esse comportamento e garante que a validação continua
    // funcionando quando o header chega em caixa alta.
    const file = makeFile("relatorio.pdf", "APPLICATION/PDF", 1 * MB, PDF_MAGIC);
    expect(file.type).toBe("application/pdf");
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });


  it("rejeita MIME com espaço à direita ('application/pdf ')", async () => {
    const file = makeFile("relatorio.pdf", "application/pdf ", 1 * MB, PDF_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("MIME_REJECTED");
  });

  it("rejeita MIME com espaço à esquerda (' application/pdf')", async () => {
    const file = makeFile("relatorio.pdf", " application/pdf", 1 * MB, PDF_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("MIME_REJECTED");
  });

  it("rejeita MIME inteiramente inválido ('foo/bar') para extensão válida (.pdf)", async () => {
    const file = makeFile("relatorio.pdf", "foo/bar", 1 * MB, PDF_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("MIME_REJECTED");
  });

  it("aceita MIME vazio (browsers antigos) desde que extensão e magic bytes sejam válidos", async () => {
    // A validação só bloqueia se file.type estiver preenchido e não estiver na whitelist.
    const file = makeFile("relatorio.pdf", "", 1 * MB, PDF_MAGIC);
    const result = await validateFileForUpload(file);
    expect(result.valid).toBe(true);
  });
});

