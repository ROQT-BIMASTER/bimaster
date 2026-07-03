/**
 * Handler compartilhado para colar imagens no campo Descrição da tarefa.
 *
 * Fluxo:
 * 1. Detecta itens `image/*` no clipboard.
 * 2. Insere placeholder `![Enviando…](uploading)` na posição do cursor.
 * 3. Sobe via `uploadTarefaAnexoToStorage` (reaproveita validação, RLS,
 *    magic bytes, telemetria e cria o registro em `projeto_tarefa_anexos`
 *    — a imagem passa a aparecer também na aba Anexos).
 * 4. Substitui o placeholder por `![nome](sb-storage://projeto-anexos/<path>)`.
 *
 * Falha de upload: remove o placeholder e mostra toast (já preparado pelo
 * `describeUploadError`).
 */
import { toast } from "sonner";
import { uploadTarefaAnexoToStorage } from "@/lib/utils/uploadTarefaAnexo";
import { describeUploadError } from "@/lib/utils/file-security";
import { toStorageRef } from "./descricaoStorageRef";

const ACCEPTED = /^image\/(png|jpeg|jpg|webp|gif)$/i;

interface HandlePasteParams {
  event: React.ClipboardEvent<HTMLTextAreaElement>;
  userId: string | undefined;
  tarefaId: string | undefined;
  value: string;
  onChange: (next: string) => void;
}

export async function handleDescricaoImagePaste({
  event,
  userId,
  tarefaId,
  value,
  onChange,
}: HandlePasteParams): Promise<boolean> {
  if (!userId || !tarefaId) return false;
  const items = event.clipboardData?.items;
  if (!items || items.length === 0) return false;

  const imageFiles: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === "file" && ACCEPTED.test(it.type)) {
      const f = it.getAsFile();
      if (f) imageFiles.push(f);
    }
  }
  if (imageFiles.length === 0) return false;

  event.preventDefault();

  const textarea = event.currentTarget;
  const start = textarea.selectionStart ?? value.length;
  const end = textarea.selectionEnd ?? value.length;

  // Um marcador único por imagem para poder substituir depois do upload.
  const uploads = imageFiles.map((file) => {
    const token = `__uploading_${Date.now()}_${Math.random().toString(36).slice(2, 8)}__`;
    return { file, token, placeholder: `![Enviando ${file.name || "imagem"}…](${token})` };
  });

  const insertion = uploads.map((u) => u.placeholder).join("\n");
  const before = value.slice(0, start);
  const after = value.slice(end);
  const glue = before.length && !before.endsWith("\n") ? "\n" : "";
  const trail = after.length && !after.startsWith("\n") ? "\n" : "";
  let working = `${before}${glue}${insertion}${trail}${after}`;
  onChange(working);

  // Sobe em paralelo mas substitui um a um conforme concluem.
  await Promise.all(
    uploads.map(async (u) => {
      try {
        const result = await uploadTarefaAnexoToStorage({
          file: u.file,
          userId,
          tarefaId,
        });
        const ref = toStorageRef("projeto-anexos", result.storagePath);
        const finalMd = `![${result.nome}](${ref})`;
        working = working.replace(u.placeholder, finalMd);
        onChange(working);
      } catch (err: any) {
        working = working.replace(u.placeholder, "");
        onChange(working);
        const { title, description } = describeUploadError(err?.message || String(err));
        toast.error(title, { description });
      }
    }),
  );

  return true;
}
