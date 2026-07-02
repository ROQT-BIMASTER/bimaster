import { useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Download,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MentionInput } from "@/components/projetos/MentionInput";
import { cn } from "@/lib/utils";
import {
  useAdicionarComentario,
  useComentariosPorDocumento,
  useExcluirComentario,
  type ComentarioAnexo,
} from "@/hooks/useChinaDocComentarios";
import { useChinaItemMentionableUsers } from "@/hooks/useChinaItemMentionableUsers";
import {
  downloadStorageBlob,
  triggerBlobDownload,
} from "@/lib/utils/storage-download";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const BUCKET = "china-documentos";
const MAX_FILES = 5;
import { UPLOAD_MAX_BYTES as MAX_BYTES } from "@/lib/upload/limits";

interface Props {
  documentoId: string;
  submissaoId: string;
  tipoDocumento: string;
  lado: "brasil" | "china";
}

export function DrawerComentariosTab({
  documentoId,
  submissaoId,
  tipoDocumento,
  lado,
}: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [texto, setTexto] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: comentarios = [], isLoading } =
    useComentariosPorDocumento(documentoId);
  const { data: mentionables = [] } =
    useChinaItemMentionableUsers(submissaoId);
  const adicionar = useAdicionarComentario();
  const excluir = useExcluirComentario();

  function handleFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.size <= MAX_BYTES);
    setFiles((p) => [...p, ...arr].slice(0, MAX_FILES));
  }

  async function submit(conteudo: string, mentionIds: string[]) {
    if (!conteudo.trim() && files.length === 0) return;
    await adicionar.mutateAsync({
      documento_id: documentoId,
      submissao_id: submissaoId,
      tipo_documento: tipoDocumento,
      lado,
      conteudo,
      mentions: mentionIds,
      anexos: files,
    });
    setTexto("");
    setFiles([]);
  }

  async function baixar(a: ComentarioAnexo, key: string) {
    setDownloading(key);
    try {
      const r = await downloadStorageBlob(a.path, a.nome, BUCKET);
      if (r.error || !r.blob) {
        toast.error(r.error || "Falha ao baixar arquivo.");
        return;
      }
      triggerBlobDownload(r.blobUrl, r.filename);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-3">
      {/* Composer */}
      <div className="space-y-2 rounded-md border border-border bg-card/40 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Novo comentário ou complemento
        </div>
        <MentionInput
          value={texto}
          onChange={setTexto}
          onSubmit={submit}
          users={mentionables}
          placeholder="Escreva um comentário, dúvida ou nota administrativa. Use @ para mencionar colegas."
          minRows={3}
          showSendButton={false}
        />

        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <Badge key={i} variant="secondary" className="gap-1 text-[10.5px]">
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[140px] truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-[11px]"
            onClick={() => fileRef.current?.click()}
            disabled={adicionar.isPending}
          >
            <Upload className="h-3.5 w-3.5" />
            Anexar
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-7 text-[11px]"
            disabled={
              adicionar.isPending || (!texto.trim() && files.length === 0)
            }
            onClick={() => {
              // Reaproveita pipeline de menções do MentionInput: como showSendButton=false,
              // disparo manualmente buscando ids inferidos por @nome.
              const ids = mentionables
                .filter((m) => texto.includes(`@${m.nome}`))
                .map((m) => m.id);
              void submit(texto, ids);
            }}
          >
            {adicionar.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Publicar"
            )}
          </Button>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando comentários…
        </div>
      ) : comentarios.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
          Nenhum comentário ainda.
        </div>
      ) : (
        <ol className="space-y-2">
          {comentarios.map((c) => {
            const isAutor = user?.id === c.autor_id;
            const iniciais = c.autor_nome
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <li
                key={c.id}
                className="space-y-1.5 rounded-md border border-border bg-card/30 p-2.5"
              >
                <div className="flex items-start gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                      {iniciais || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11.5px] font-medium text-foreground/90">
                        {c.autor_nome}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-4 px-1 text-[9px] uppercase",
                          c.lado === "brasil"
                            ? "border-emerald-500/40 text-emerald-700"
                            : "border-rose-500/40 text-rose-700",
                        )}
                      >
                        {c.lado}
                      </Badge>
                      {c.ref_rodada != null && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1 font-mono text-[9px] tabular-nums"
                        >
                          ↪ R{c.ref_rodada}
                        </Badge>
                      )}
                      <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                        {format(new Date(c.created_at), "dd/MM/yy HH:mm", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    {c.conteudo && (
                      <p className="whitespace-pre-wrap text-[12px] leading-snug text-foreground/90">
                        <HighlightMentions text={c.conteudo} />
                      </p>
                    )}
                    {c.anexos.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {c.anexos.map((a, i) => (
                          <Button
                            key={i}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 gap-1 px-1.5 text-[10.5px]"
                            onClick={() => baixar(a, `${c.id}-${i}`)}
                            disabled={downloading === `${c.id}-${i}`}
                            title={a.nome}
                          >
                            {downloading === `${c.id}-${i}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                            <span className="max-w-[140px] truncate">
                              {a.nome}
                            </span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  {isAutor && (
                    <button
                      type="button"
                      onClick={() =>
                        excluir.mutate({ id: c.id, documento_id: documentoId })
                      }
                      className="text-muted-foreground/60 transition hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function HighlightMentions({ text }: { text: string }) {
  const parts = text.split(/(@[^\s@]+(?:\s[^\s@]+)?)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("@") ? (
          <span
            key={i}
            className="rounded bg-primary/10 px-1 font-medium text-primary"
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
