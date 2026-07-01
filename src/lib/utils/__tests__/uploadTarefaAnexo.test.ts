import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do supabase client ANTES de importar o helper
const uploadMock = vi.fn();
const insertMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, file: File) => uploadMock(bucket, path, file),
      }),
    },
    from: (table: string) => ({
      insert: (row: any) => {
        insertMock(table, row);
        return {
          select: (cols: string) => {
            selectMock(cols);
            return { single: () => singleMock() };
          },
        };
      },
    }),
  },
}));

import { uploadTarefaAnexoToStorage } from "@/lib/utils/uploadTarefaAnexo";

const MP4_MAGIC = [0x66, 0x74, 0x79, 0x70];
const MB = 1024 * 1024;

function makeFile(name: string, type: string, sizeBytes: number, magicPrefix?: number[], magicOffset = 0): File {
  const buffer = new Uint8Array(Math.max(sizeBytes, (magicPrefix?.length ?? 0) + magicOffset));
  if (magicPrefix) buffer.set(magicPrefix, magicOffset);
  return new File([buffer], name, { type });
}

beforeEach(() => {
  uploadMock.mockReset().mockResolvedValue({ error: null });
  insertMock.mockReset();
  selectMock.mockReset();
  singleMock.mockReset().mockResolvedValue({ data: { id: "anexo-1" }, error: null });
});

describe("uploadTarefaAnexoToStorage — fluxo compartilhado tarefa+subtarefa", () => {
  it("faz upload de MP4 válido para bucket 'projeto-anexos' com path canônico", async () => {
    const file = makeFile("clip.mp4", "video/mp4", 5 * MB, MP4_MAGIC, 4);
    const result = await uploadTarefaAnexoToStorage({
      file,
      userId: "user-42",
      tarefaId: "tarefa-99",
    });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [bucket, path] = uploadMock.mock.calls[0];
    expect(bucket).toBe("projeto-anexos");
    // Path: <uid>/<tarefaId>/<ts>_<nome>
    expect(path).toMatch(/^user-42\/tarefa-99\/\d+_clip\.mp4$/);
    expect(result.id).toBe("anexo-1");
    expect(result.storagePath).toBe(path);
  });

  it("bloqueia .exe antes de chamar o storage (mesma regra usada por subtarefa)", async () => {
    const file = makeFile("malware.exe", "application/x-msdownload", 1 * MB);
    await expect(
      uploadTarefaAnexoToStorage({ file, userId: "u1", tarefaId: "t1" }),
    ).rejects.toThrow(/não é permitido|segurança/i);
    expect(uploadMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("bloqueia vídeo acima de 100 MB antes de tocar no storage", async () => {
    const file = makeFile("big.mp4", "video/mp4", 150 * MB, MP4_MAGIC, 4);
    await expect(
      uploadTarefaAnexoToStorage({ file, userId: "u1", tarefaId: "t1" }),
    ).rejects.toThrow(/100 MB/);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("deduplica lista de notificados e remove o próprio uploader", async () => {
    const file = makeFile("ok.mp4", "video/mp4", 1 * MB, MP4_MAGIC, 4);
    await uploadTarefaAnexoToStorage({
      file,
      userId: "user-42",
      tarefaId: "t1",
      notificarIds: ["user-42", "user-1", "user-1", "user-2", "", undefined as any],
    });
    expect(insertMock).toHaveBeenCalledTimes(1);
    const [, row] = insertMock.mock.calls[0];
    expect(row.notificados.sort()).toEqual(["user-1", "user-2"]);
    expect(row.tarefa_id).toBe("t1");
    expect(row.user_id).toBe("user-42");
    expect(row.nome).toBe("ok.mp4");
  });

  it("propaga erro do storage.upload sem tentar insert", async () => {
    uploadMock.mockResolvedValueOnce({ error: new Error("Payload too large") });
    const file = makeFile("ok.mp4", "video/mp4", 1 * MB, MP4_MAGIC, 4);
    await expect(
      uploadTarefaAnexoToStorage({ file, userId: "u", tarefaId: "t" }),
    ).rejects.toThrow(/Payload too large/);
    expect(insertMock).not.toHaveBeenCalled();
  });
});
