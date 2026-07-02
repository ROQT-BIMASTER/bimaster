/**
 * ChecklistItemPainel — painel lateral que permite anexar arquivos e
 * registrar parecer de um único item do checklist China, sem sair da
 * tela "Status do Checklist". Substitui o salto para a Ficha do Produto
 * + Modo Foco quando o usuário só precisa atuar em um item.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Loader2,
  Send,
  FileText,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadAndGetSignedUrl, getSignedUrl } from "@/lib/utils/storage-helper";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { ChecklistItemAdminPanel } from "./ChecklistItemAdminPanel";
import { bucketForDoc } from "@/lib/china/flowTones";

interface DocRow {
  id: string;
  tipo_documento: string;
  status: string;
  nome_arquivo: string | null;
  arquivo_path: string | null;
  arquivo_url: string | null;
  observacao: string | null;
  previsao_envio: string | null;
  oficializado_em: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissaoId: string;
  tipoDocumento: string | null;
  labelPt: string;
  labelCn?: string;
  fluxo: "china_envia" | "brasil_envia";
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "rascunho", label: "Rascunho" },
  { value: "pendente", label: "Pendente análise" },
  { value: "aprovado", label: "Aprovado" },
  { value: "ciencia", label: "Ciente" },
  { value: "contestado", label: "Contestado" },
  { value: "rejeitado", label: "Rejeitado" },
];

const STATUS_CLS: Record<string, string> = {
  aprovado: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  ciencia: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  enviado: "bg-primary/15 text-primary border-primary/30",
  enviado_brasil: "bg-primary/15 text-primary border-primary/30",
  pendente: "bg-primary/15 text-primary border-primary/30",
  contestado: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  rejeitado: "bg-rose-500/15 text-rose-500 border-rose-500/30",
  rascunho: "bg-muted text-muted-foreground border-border",
  planejado: "bg-muted text-muted-foreground border-border",
};

import { UPLOAD_MAX_BYTES as MAX_BYTES } from "@/lib/upload/limits";

export function ChecklistItemPainel({
  open,
  onOpenChange,
  submissaoId,
  tipoDocumento,
  labelPt,
  labelCn,
  fluxo,
}: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [parecerStatus, setParecerStatus] = useState<string>("pendente");
  const [observacao, setObservacao] = useState("");
  const [savingParecer, setSavingParecer] = useState(false);

  const { data: versoes = [], isLoading } = useQuery({
    queryKey: ["checklist-item-painel", submissaoId, tipoDocumento],
    enabled: !!submissaoId && !!tipoDocumento && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_documentos" as any)
        .select(
          "id, tipo_documento, status, nome_arquivo, arquivo_path, arquivo_url, observacao, previsao_envio, oficializado_em, created_at",
        )
        .eq("submissao_id", submissaoId)
        .eq("tipo_documento", tipoDocumento!)
        .neq("status", "planejado")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as DocRow[];
    },
  });

  const ultimaVersao = versoes[0];
  const FluxoIcon = fluxo === "china_envia" ? ArrowUpRight : ArrowDownLeft;
  const fluxoLabel = fluxo === "china_envia" ? "China envia" : "Brasil envia";

  // Sincroniza estado do parecer com a última versão ao abrir
  useEffect(() => {
    if (!open || !ultimaVersao) {
      setParecerStatus("pendente");
      setObservacao("");
      return;
    }
    setParecerStatus(ultimaVersao.status || "pendente");
    setObservacao(ultimaVersao.observacao ?? "");
  }, [open, ultimaVersao?.id]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["checklist-item-painel", submissaoId, tipoDocumento] });
    qc.invalidateQueries({ queryKey: ["china-checklist-status-docs", submissaoId] });
    qc.invalidateQueries({ queryKey: ["china-ficha-docs", submissaoId] });
    qc.invalidateQueries({ queryKey: ["china-unified-timeline"] });
  };

  const handleFileChosen = async (file: File) => {
    if (!tipoDocumento) return;
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo excede 20 MB.");
      return;
    }
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada — faça login novamente.");
        return;
      }
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${session.user.id}/${submissaoId}/${tipoDocumento}/${Date.now()}_${safeName}`;
      const { signedUrl, error } = await uploadAndGetSignedUrl(
        "china-documentos",
        path,
        file,
      );
      if (error || !signedUrl) {
        logger.error("[ChecklistItemPainel] upload error", { error });
        toast.error("Falha no upload do arquivo.");
        return;
      }

      // Se existe placeholder "planejado" ou rascunho sem arquivo, atualiza-o.
      const placeholder = versoes.find(
        (v) => v.status === "planejado" || (!v.arquivo_path && v.status === "rascunho"),
      );
      const dbRes = placeholder
        ? await supabase
            .from("china_produto_documentos" as any)
            .update({
              arquivo_url: signedUrl,
              arquivo_path: path,
              nome_arquivo: file.name,
              status: "pendente",
            } as any)
            .eq("id", placeholder.id)
        : await supabase.from("china_produto_documentos" as any).insert({
            submissao_id: submissaoId,
            tipo_documento: tipoDocumento,
            arquivo_url: signedUrl,
            arquivo_path: path,
            nome_arquivo: file.name,
            status: "pendente",
          } as any);
      if (dbRes.error) {
        logger.error("[ChecklistItemPainel] insert error", { error: dbRes.error });
        toast.error("Arquivo enviado, mas houve falha ao registrar.");
        return;
      }
      toast.success("Arquivo anexado com sucesso.");
      invalidate();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const salvarParecer = useMutation({
    mutationFn: async () => {
      if (!ultimaVersao) {
        // Cria registro só de parecer (sem arquivo) — útil para "Ciente"/"Contestado"
        // antes mesmo do upload.
        const { error } = await supabase.from("china_produto_documentos" as any).insert({
          submissao_id: submissaoId,
          tipo_documento: tipoDocumento,
          status: parecerStatus,
          observacao: observacao.trim() || null,
        } as any);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("china_produto_documentos" as any)
        .update({
          status: parecerStatus,
          observacao: observacao.trim() || null,
        } as any)
        .eq("id", ultimaVersao.id);
      if (error) throw error;
    },
    onMutate: () => setSavingParecer(true),
    onSettled: () => setSavingParecer(false),
    onSuccess: () => {
      toast.success("Parecer registrado.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao salvar parecer."),
  });

  const enviarAoBrasil = useMutation({
    mutationFn: async () => {
      if (!ultimaVersao) throw new Error("Anexe um arquivo antes de enviar.");
      const { error } = await supabase
        .from("china_produto_documentos" as any)
        .update({
          status: "enviado_brasil",
          oficializado_em: new Date().toISOString(),
        } as any)
        .eq("id", ultimaVersao.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento enviado ao Brasil.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao enviar."),
  });

  const handleDownload = async (doc: DocRow) => {
    if (doc.arquivo_path) {
      const { signedUrl } = await getSignedUrl("china-documentos", doc.arquivo_path);
      if (signedUrl) {
        const a = document.createElement("a");
        a.href = signedUrl;
        a.download = doc.nome_arquivo || "documento";
        a.rel = "noopener";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
    }
    toast.error("Arquivo indisponível.");
  };

  const statusAtual = ultimaVersao?.status ?? "nao_criado";
  const statusLabel = useMemo(() => {
    const opt = STATUS_OPTIONS.find((o) => o.value === statusAtual);
    if (opt) return opt.label;
    if (statusAtual === "enviado_brasil") return "Enviado ao Brasil";
    return "Não criado";
  }, [statusAtual]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[520px] overflow-y-auto"
      >
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <FluxoIcon className="h-3.5 w-3.5" />
            <span>{fluxoLabel}</span>
          </div>
          <SheetTitle className="text-base">{labelPt}</SheetTitle>
          {labelCn && (
            <SheetDescription className="text-xs">{labelCn}</SheetDescription>
          )}
          <Badge
            variant="outline"
            className={cn(
              "w-fit h-5 px-2 text-[10.5px] font-medium",
              STATUS_CLS[statusAtual] ?? "bg-muted text-muted-foreground border-border",
            )}
          >
            {statusLabel}
          </Badge>
        </SheetHeader>

        <Separator className="my-4" />

        {/* Upload */}
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Anexar arquivo
          </h3>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileChosen(f);
            }}
          />
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center"
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileChosen(f);
            }}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Arraste o arquivo aqui ou clique no botão abaixo. Limite 20&nbsp;MB.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 gap-1.5 text-xs"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? "Enviando..." : "Selecionar arquivo"}
            </Button>
          </div>
        </section>

        {/* Parecer */}
        <section className="mt-5 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Parecer
          </h3>
          <Select value={parecerStatus} onValueChange={setParecerStatus}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Selecione o parecer" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Observação (opcional)"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="min-h-[80px] text-xs"
            maxLength={2000}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={savingParecer}
              onClick={() => salvarParecer.mutate()}
            >
              {savingParecer ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Salvar parecer
            </Button>
            {ultimaVersao && ultimaVersao.status !== "enviado_brasil" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                disabled={enviarAoBrasil.isPending}
                onClick={() => enviarAoBrasil.mutate()}
              >
                {enviarAoBrasil.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Enviar ao Brasil
              </Button>
            )}
          </div>
        </section>

        {/* Histórico */}
        <section className="mt-5 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Versões enviadas ({versoes.length})
          </h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : versoes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma versão anexada ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {versoes.map((v) => (
                <li
                  key={v.id}
                  className="flex items-start gap-2 rounded-md border border-border/60 bg-card px-3 py-2"
                >
                  <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {v.nome_arquivo ?? "Sem arquivo"}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground">
                      {format(
                        new Date(v.oficializado_em ?? v.created_at),
                        "dd/MM/yyyy HH:mm",
                        { locale: ptBR },
                      )}
                      {" · "}
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-0.5 h-4 px-1.5 text-[9.5px] font-medium",
                          STATUS_CLS[v.status] ?? "bg-muted text-muted-foreground border-border",
                        )}
                      >
                        {STATUS_OPTIONS.find((o) => o.value === v.status)?.label ??
                          (v.status === "enviado_brasil"
                            ? "Enviado ao Brasil"
                            : v.status)}
                      </Badge>
                    </p>
                    {v.observacao && (
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                        {v.observacao}
                      </p>
                    )}
                  </div>
                  {v.arquivo_path && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => handleDownload(v)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pareceres + Comentários administrativos */}
        {ultimaVersao?.id && (
          <section className="mt-5 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pareceres e comentários
            </h3>
            <ChecklistItemAdminPanel
              documentoId={ultimaVersao.id}
              submissaoId={submissaoId}
              tipoDocumento={tipoDocumento!}
              tipoDocumentoLabel={labelPt}
              bucket={bucketForDoc({ doc_status: ultimaVersao.status })}
              lado={fluxo === "china_envia" ? "china" : "brasil"}
              isReceiver={fluxo === "brasil_envia"}
              isSender={fluxo === "china_envia"}
            />
          </section>
        )}
      </SheetContent>
    </Sheet>
  );
}

