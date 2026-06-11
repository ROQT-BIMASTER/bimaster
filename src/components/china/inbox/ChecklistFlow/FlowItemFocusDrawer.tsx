import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, ImageIcon, Loader2, Maximize2, Send, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useUploadChinaDocumento } from "@/hooks/useUploadChinaDocumento";
import { detectThumbKind } from "@/hooks/useChinaDocThumbnail";
import { getSignedUrl } from "@/lib/utils/storage-helper";
import {
  BUCKET_LABEL,
  FLOW_TONE,
  bucketForDoc,
  bucketToTone,
  iconForBucket,
} from "@/lib/china/flowTones";
import type { FlowItemContext } from "./types";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import type { MailboxGroup } from "@/lib/china/groupMailboxItems";
import { DrawerParecerActions } from "./DrawerParecerActions";
import { DrawerRevisoesList } from "./DrawerRevisoesList";


interface Props {
  open: boolean;
  context: FlowItemContext | null;
  perspective: "china" | "brasil";
  group?: MailboxGroup | null;
  onOpenChange: (open: boolean) => void;
  onEnviarBrasil?: (item: MailboxItem) => void;
  onOpenSubmissao?: (submissaoId: string) => void;
}


/**
 * FlowItemFocusDrawer — Sheet focado para concluir uma etapa do checklist
 * sem sair da Caixa de Entrada. Permite anexar/substituir arquivo, registrar
 * observação ao Brasil e despachar.
 */
export function FlowItemFocusDrawer({
  open,
  context,
  perspective,
  group,
  onOpenChange,
  onEnviarBrasil,
  onOpenSubmissao,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [observacao, setObservacao] = useState("");
  const [focusOpen, setFocusOpen] = useState(false);
  const { uploadAndAttach, updateObservacaoChina, isUploading } = useUploadChinaDocumento();

  // Live doc: deriva do group atual (reativo a invalidações de query pós-upload),
  // caindo para o snapshot do context se group não foi passado.
  const liveDoc: MailboxItem | null = (() => {
    if (!context) return null;
    if (group?.docs?.length) {
      const matches = group.docs.filter((d) => d.tipo_documento === context.tipo);
      if (matches.length > 0) {
        matches.sort(
          (a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
        );
        return matches[0];
      }
    }
    return context.doc ?? null;
  })();

  useEffect(() => {
    setObservacao(liveDoc?.observacoes_china ?? "");
  }, [liveDoc?.documento_id, context?.tipo, context?.submissaoId]);

  if (!context) return null;

  const { docType, tipo, category, submissaoId, produtoCodigo, produtoNome } = context;
  const doc = liveDoc;
  const bucket = bucketForDoc(doc);
  const tone = bucketToTone(bucket);
  const cfg = FLOW_TONE[tone];
  const BucketIcon = iconForBucket(bucket);

  const labelPt = docType?.labelPt ?? tipo;
  const labelCn = docType?.labelCn;

  const isChina = perspective === "china";
  const isChinaCategory = category.fluxo === "china_envia";
  const isBrasilCategory = category.fluxo === "brasil_envia";

  // China pode anexar em categorias china_envia; Brasil pode anexar em brasil_envia.
  const canUpload =
    (isChina && isChinaCategory) || (!isChina && isBrasilCategory);

  // Botão "Enviar ao Brasil": China + categoria china_envia + doc anexado e
  // ainda não aprovado/enviado. Cobre rascunho recém-anexado e reenvio após
  // devolução (rejeitado).
  const status = (doc?.doc_status || "").toLowerCase();
  const canEnviarBrasil =
    isChina &&
    isChinaCategory &&
    !!doc &&
    !!doc.documento_id &&
    (status === "" || status === "rascunho" || status === "pendente" || status === "rejeitado") &&
    !!onEnviarBrasil;

  const isRejected = bucket === "rejeitado";
  const isApproved = bucket === "aprovado";

  const handleFileChosen = async (file: File | null) => {
    if (!file) return;
    await uploadAndAttach({
      submissaoId,
      tipo,
      file,
      status: "rascunho",
      observacoesChina: isChinaCategory ? observacao : undefined,
    });
  };

  const handleSalvarObservacao = async () => {
    if (!doc?.documento_id) return;
    await updateObservacaoChina(doc.documento_id, observacao);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="border-b border-border bg-card/40 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-1.5 text-[10.5px] tabular-nums text-muted-foreground">
                <span className="font-mono">{produtoCodigo}</span>
                <span className="opacity-50">·</span>
                <span className="truncate">{produtoNome}</span>
              </div>
              <SheetTitle className="text-sm font-semibold leading-tight">
                {labelPt}
              </SheetTitle>
              {labelCn && (
                <div className="text-[11px] text-muted-foreground/80">{labelCn}</div>
              )}
              <div className="flex items-center gap-1.5 pt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 gap-1 border px-1.5 text-[10px] uppercase",
                    cfg.border,
                    cfg.bg,
                    cfg.text,
                  )}
                >
                  <BucketIcon className="h-3 w-3" />
                  {BUCKET_LABEL[bucket]}
                </Badge>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {category.labelPt}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => onOpenChange(false)}
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Documento atual */}
          {doc && (doc.arquivo_path || doc.arquivo_url) ? (
            <div className="space-y-2 rounded-md border border-border bg-card/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Documento anexado
                </p>
                {doc.nome_arquivo && (
                  <span className="truncate text-[11px] text-muted-foreground">
                    {doc.nome_arquivo}
                  </span>
                )}
              </div>
              <DocBigPreview doc={doc} onExpand={() => setFocusOpen(true)} />
              {canUpload && !isApproved && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-full gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Substituir arquivo
                </Button>
              )}
            </div>
          ) : canUpload ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors",
                "border-border bg-muted/20 hover:border-primary/40 hover:bg-primary/5",
                isUploading && "opacity-60",
              )}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Upload className="h-5 w-5 text-primary" />
              )}
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {isUploading ? "Subindo arquivo…" : "Anexar documento"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Clique para escolher um arquivo do seu computador
                </p>
              </div>
            </button>
          ) : (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
              Este item é responsabilidade de outro lado do fluxo.
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={docType?.accept}
            multiple={false}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              void handleFileChosen(f);
              e.target.value = "";
            }}
          />

          {/* Ações de parecer + histórico de revisões */}
          {doc?.documento_id && (
            <>
              <DrawerParecerActions
                documentoId={doc.documento_id}
                submissaoId={submissaoId}
                tipoDocumento={tipo}
                tipoDocumentoLabel={labelPt}
                bucket={bucket}
                isReceiver={
                  (isChina && isBrasilCategory) ||
                  (!isChina && isChinaCategory)
                }
                isSender={
                  (isChina && isChinaCategory) ||
                  (!isChina && isBrasilCategory)
                }
              />
              <DrawerRevisoesList
                submissaoId={submissaoId}
                documentoId={doc.documento_id}
              />
            </>
          )}


          {isChina && isChinaCategory && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Observação ao Brasil
              </label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informações relevantes para a análise do Brasil…"
                rows={3}
                className="text-xs"
              />
              {doc?.documento_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={handleSalvarObservacao}
                  disabled={isUploading}
                >
                  Salvar observação
                </Button>
              )}
            </div>
          )}

          {/* Aviso quando Brasil pediu correção */}
          {isRejected && doc?.observacoes_brasil && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">
                Brasil solicitou correção
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/90">
                {doc.observacoes_brasil}
              </p>
            </div>
          )}

          {isApproved && (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-700">
              Etapa concluída — nada mais a fazer.
            </div>
          )}
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2 border-t border-border bg-card/30 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => onOpenSubmissao?.(submissaoId)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir submissão
          </Button>
          {canEnviarBrasil && doc && (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => onEnviarBrasil!(doc)}
              disabled={isUploading}
            >
              <Send className="h-3.5 w-3.5" />
              {isRejected ? "Reenviar correção" : "Enviar ao Brasil"}
            </Button>
          )}
        </div>
      </SheetContent>

      <DocFocusDialog
        open={focusOpen}
        onOpenChange={setFocusOpen}
        doc={doc}
      />
    </Sheet>
  );
}

/**
 * useDocSignedUrl — resolve signed URL para qualquer tipo de arquivo do
 * bucket `china-documentos` (imagem, PDF, outros). Usado nas previews
 * grandes/focadas do drawer.
 */
function useDocSignedUrl(doc: MailboxItem | null) {
  const path = doc?.arquivo_path ?? null;
  const fallback = doc?.arquivo_url ?? null;
  const q = useQuery({
    queryKey: ["china-doc-signed-any", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { signedUrl } = await getSignedUrl("china-documentos", path as string);
      return signedUrl;
    },
  });
  return path ? q.data ?? null : fallback;
}

/**
 * DocBigPreview — preview generosa (object-contain) com botão para abrir
 * modo foco em Dialog.
 */
function DocBigPreview({
  doc,
  onExpand,
}: {
  doc: MailboxItem;
  onExpand: () => void;
}) {
  const kind = detectThumbKind(doc.nome_arquivo || doc.arquivo_path || "");
  const url = useDocSignedUrl(doc);

  return (
    <div className="relative w-full overflow-hidden rounded-md border border-border bg-muted/20">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="absolute right-2 top-2 z-10 h-7 w-7 shadow"
        onClick={onExpand}
        title="Abrir em tela cheia"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>

      {kind === "image" ? (
        url ? (
          <img
            src={url}
            alt={doc.nome_arquivo ?? ""}
            className="mx-auto block max-h-[440px] w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex h-64 w-full animate-pulse items-center justify-center bg-muted/40">
            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
          </div>
        )
      ) : kind === "pdf" ? (
        <button
          type="button"
          onClick={onExpand}
          className="flex h-48 w-full flex-col items-center justify-center gap-1.5 bg-rose-500/5 transition hover:bg-rose-500/10"
        >
          <FileText className="h-10 w-10 text-rose-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">
            PDF · clique para abrir
          </span>
          {doc.nome_arquivo && (
            <span className="px-3 text-[11px] text-muted-foreground line-clamp-1">
              {doc.nome_arquivo}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onExpand}
          className="flex h-40 w-full flex-col items-center justify-center gap-1.5 transition hover:bg-muted/40"
        >
          <FileText className="h-10 w-10 text-muted-foreground/60" />
          {doc.nome_arquivo && (
            <span className="px-3 text-[11px] text-muted-foreground line-clamp-1">
              {doc.nome_arquivo}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * DocFocusDialog — Dialog em tela cheia com a imagem (object-contain)
 * ou PDF embutido via iframe.
 */
function DocFocusDialog({
  open,
  onOpenChange,
  doc,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: MailboxItem | null;
}) {
  const kind = detectThumbKind(doc?.nome_arquivo || doc?.arquivo_path || "");
  const url = useDocSignedUrl(open ? doc : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 h-[90vh] flex flex-col gap-0">
        <DialogHeader className="border-b border-border px-4 py-2.5">
          <DialogTitle className="truncate text-sm font-semibold">
            {doc?.nome_arquivo ?? "Documento"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto bg-muted/30">
          {!url ? (
            <div className="flex h-full w-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : kind === "image" ? (
            <div className="flex h-full w-full items-center justify-center p-4">
              <img
                src={url}
                alt={doc?.nome_arquivo ?? ""}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : kind === "pdf" ? (
            <iframe
              src={url}
              title={doc?.nome_arquivo ?? "PDF"}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              Pré-visualização não disponível para este tipo de arquivo.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

