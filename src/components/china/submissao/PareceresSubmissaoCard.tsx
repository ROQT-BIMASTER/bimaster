import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR, zhCN, enUS } from "date-fns/locale";
import { Paperclip, Send, MessageSquareWarning, Trash2, Pencil, Download, X, Loader2, MoreVertical, ClipboardList, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useChinaI18n } from "@/hooks/useChinaI18n";
import { useSubmissaoPareceres, type Parecer, type ParecerAnexo } from "@/hooks/useSubmissaoPareceres";
import { triggerBlobDownload } from "@/lib/utils/storage-download";
import { PromoverParecerChecklistDialog } from "./PromoverParecerChecklistDialog";

interface Props {
  submissaoId: string;
  isBrasilUser?: boolean;
  isChinaUser?: boolean;
  readOnly?: boolean;
  className?: string;
}

export function PareceresSubmissaoCard({
  submissaoId,
  isBrasilUser,
  isChinaUser,
  readOnly,
  className,
}: Props) {
  const { t, language } = useChinaI18n();
  const { pareceres, loading, publicar, editar, excluir } = useSubmissaoPareceres(submissaoId);

  const [texto, setTexto] = useState("");
  const [critico, setCritico] = useState(false);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const locale = language === "zh" ? zhCN : language === "en" ? enUS : ptBR;

  const lado: "brasil" | "china" = isChinaUser ? "china" : "brasil";

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const valid: File[] = [];
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(t("inbox.pareceres.tamanhoMax"));
        continue;
      }
      valid.push(f);
    }
    setArquivos((prev) => [...prev, ...valid]);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handlePublicar() {
    if (!texto.trim()) return;
    try {
      await publicar.mutateAsync({ texto, critico, lado, anexos: arquivos });
      setTexto("");
      setCritico(false);
      setArquivos([]);
      toast.success(t("inbox.pareceres.toastOk"));
    } catch (err: any) {
      toast.error(err?.message || t("inbox.pareceres.toastErr"));
    }
  }

  return (
    <section
      className={cn(
        "rounded-md border border-border bg-card/60 p-3 space-y-3",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4 text-primary" />
            {t("inbox.pareceres.titulo")}
            {pareceres.length > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                {pareceres.length}
              </Badge>
            )}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t("inbox.pareceres.subtitulo")}
          </p>
        </div>
      </header>

      {!readOnly && (
        <div className="space-y-2 rounded-md border border-dashed border-border/70 bg-background/40 p-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={t("inbox.pareceres.placeholder")}
            rows={3}
            className="resize-y text-sm"
          />
          {arquivos.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {arquivos.map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-[11px]">
                  {f.name}
                  <button
                    type="button"
                    onClick={() => setArquivos((p) => p.filter((_, idx) => idx !== i))}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox checked={critico} onCheckedChange={(v) => setCritico(!!v)} />
                {t("inbox.pareceres.marcarCritico")}
              </label>
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={pickFiles}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5" />
                {t("inbox.pareceres.anexar")}
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handlePublicar}
              disabled={!texto.trim() || publicar.isPending}
            >
              {publicar.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {publicar.isPending
                ? t("inbox.pareceres.publicando")
                : t("inbox.pareceres.publicar")}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground py-2">…</p>
      ) : pareceres.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 italic">
          {t("inbox.pareceres.vazio")}
        </p>
      ) : (
        <ul className="space-y-2">
          {pareceres.map((p) => (
            <ParecerItem
              key={p.id}
              parecer={p}
              submissaoId={submissaoId}
              locale={locale}
              language={language}
              tFn={t}
              canEdit={!readOnly}
              onEditar={(novo) => editar.mutateAsync({ id: p.id, texto: novo })}
              onExcluir={() => excluir.mutateAsync(p.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ParecerItem({
  parecer,
  submissaoId,
  locale,
  language,
  tFn,
  canEdit,
  onEditar,
  onExcluir,
}: {
  parecer: Parecer;
  submissaoId: string;
  locale: any;
  language: string;
  tFn: (k: string) => string;
  canEdit: boolean;
  onEditar: (novo: string) => Promise<unknown>;
  onExcluir: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(parecer.texto);
  const [promoverAnexo, setPromoverAnexo] = useState<ParecerAnexo | null>(null);
  const [promovidosLocal, setPromovidosLocal] = useState<Record<string, string>>({});

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id || null));
  }, []);

  const created = new Date(parecer.created_at);
  const isMine = meId === parecer.autor_id;
  const podeEditar =
    canEdit && isMine && Date.now() - created.getTime() < 15 * 60 * 1000;
  const podeExcluir = canEdit && isMine;

  const textoExibido =
    (language === "zh" && parecer.traducao_zh) ||
    (language === "en" && parecer.traducao_en) ||
    (language === "pt" && parecer.traducao_pt) ||
    parecer.texto;

  async function baixar(path: string, nome: string) {
    const { data, error } = await supabase.storage
      .from("china-pareceres")
      .download(path);
    if (error || !data) {
      toast.error(error?.message || "Erro");
      return;
    }
    const url = URL.createObjectURL(data);
    triggerBlobDownload(url, nome);
  }

  return (
    <li
      className={cn(
        "rounded-md border p-2.5 text-sm",
        parecer.critico
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-border bg-background/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant="outline"
            className={cn(
              "h-5 px-1.5 text-[10px]",
              parecer.autor_lado === "brasil"
                ? "border-blue-500/40 text-blue-500"
                : "border-rose-500/40 text-rose-500",
            )}
          >
            {parecer.autor_lado === "brasil"
              ? tFn("inbox.pareceres.ladoBR")
              : tFn("inbox.pareceres.ladoCN")}
          </Badge>
          <span className="text-xs font-medium truncate">
            {parecer.autor_nome || "—"}
          </span>
          {parecer.critico && (
            <Badge className="h-5 px-1.5 text-[10px] bg-amber-500/20 text-amber-600 border-amber-500/40 border">
              {tFn("inbox.pareceres.criticoBadge")}
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {format(created, "dd/MM/yy HH:mm", { locale })}
          {parecer.updated_at !== parecer.created_at && (
            <> · {tFn("inbox.pareceres.editadoEm")}</>
          )}
        </span>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setEditing(false);
                setDraft(parecer.texto);
              }}
            >
              {tFn("inbox.pareceres.cancelar")}
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={async () => {
                await onEditar(draft);
                setEditing(false);
              }}
            >
              {tFn("inbox.pareceres.salvar")}
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-snug">{textoExibido}</p>
      )}

      {parecer.anexos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {parecer.anexos.map((a) => (
            <Button
              key={a.id}
              variant="outline"
              size="sm"
              className="h-6 gap-1 text-[11px]"
              onClick={() => baixar(a.storage_path, a.nome_arquivo)}
              title={tFn("inbox.pareceres.baixar")}
            >
              <Download className="h-3 w-3" />
              {a.nome_arquivo}
            </Button>
          ))}
        </div>
      )}

      {(podeEditar || podeExcluir) && !editing && (
        <div className="mt-2 flex justify-end gap-1">
          {podeEditar && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px]"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              {tFn("inbox.pareceres.editar")}
            </Button>
          )}
          {podeExcluir && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-destructive"
              onClick={async () => {
                if (confirm(tFn("inbox.pareceres.confirmarExcluir"))) {
                  await onExcluir();
                }
              }}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {tFn("inbox.pareceres.excluir")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
