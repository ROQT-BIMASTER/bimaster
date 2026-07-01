import { describe, it, expect, beforeEach } from "vitest";
import {
  clearUploadAudit,
  getUploadAudit,
  reportUploadError,
  reportUploadRejection,
  reportUploadSuccess,
  __internal,
} from "@/lib/telemetry/uploadTelemetry";

const file = { name: "clip.mp4", type: "video/mp4", size: 5_000_000 };
const base = { file, tarefaId: "t1", userId: "u1" };

beforeEach(() => clearUploadAudit());

describe("uploadTelemetry", () => {
  it("registra sucesso com storagePath", () => {
    const ev = reportUploadSuccess({ ...base, storagePath: "u1/t1/1_clip.mp4" });
    expect(ev.status).toBe("success");
    expect(ev.storagePath).toBe("u1/t1/1_clip.mp4");
    expect(getUploadAudit()).toHaveLength(1);
  });

  it("infere size_exceeded a partir de mensagem client-side", () => {
    const ev = reportUploadRejection({ ...base, error: new Error("Arquivo excede o máximo de 100MB") });
    expect(ev.status).toBe("rejected");
    expect(ev.reason).toBe("size_exceeded");
  });

  it("infere payload_too_large_backend a partir do erro do storage", () => {
    const ev = reportUploadRejection({ ...base, error: new Error("Payload too large") });
    expect(ev.reason).toBe("payload_too_large_backend");
  });

  it("infere invalid_type a partir de mensagem de MIME/extensão", () => {
    const ev = reportUploadRejection({ ...base, error: "Tipo de arquivo não permitido" });
    expect(ev.reason).toBe("invalid_type");
  });

  it("marca storage_upload_failed explicitamente", () => {
    const ev = reportUploadError({ ...base, error: new Error("network"), reason: "storage_upload_failed" });
    expect(ev.status).toBe("error");
    expect(ev.reason).toBe("storage_upload_failed");
  });

  it("marca metadata_insert_failed explicitamente", () => {
    const ev = reportUploadError({ ...base, error: new Error("RLS"), reason: "metadata_insert_failed" });
    expect(ev.reason).toBe("metadata_insert_failed");
  });

  it("mantém buffer capado (drop dos mais antigos)", () => {
    for (let i = 0; i < 210; i++) {
      reportUploadSuccess({ ...base, storagePath: `u1/t1/${i}_clip.mp4` });
    }
    expect(getUploadAudit()).toHaveLength(200);
    expect(getUploadAudit()[199].storagePath).toBe("u1/t1/209_clip.mp4");
  });

  it("inferReasonFromError cobre unknown", () => {
    expect(__internal.inferReasonFromError(new Error("boom")).reason).toBe("unknown");
  });
});
