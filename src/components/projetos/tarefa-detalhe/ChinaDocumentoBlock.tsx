import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  FileText, Download, Upload, RotateCcw, Loader2, Ship, AlertTriangle, Eye,
} from "lucide-react";
import { ChinaDocPreviewDialog } from "@/components/china/ChinaDocPreviewDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { triggerBlobDownload } from "@/lib/utils/storage-download";
import type { ChinaDocDaTarefa } from "@/hooks/useChinaDocsDaTarefa";

interface Props {
  doc: ChinaDocDaTarefa;
}

// Tamanho máximo do upload (20 MB — política global de Storage).
import { UPLOAD_MAX_BYTES as MAX_SIZE } from "@/lib/upload/limits";

// Bloqueia executáveis e double-extension comuns.
const FORBIDDEN_EXT = /\.(exe|bat|cmd|sh|js|jar|com|scr|msi|dll|php|py|rb)(\.|$)/i;

const motivoSchema = z
  .string()
  .trim()
  .min(10, { message: "Descreva o motivo da devolução (mínimo 10 caracteres)." })
  .max(1000, { message: "Motivo deve ter até 1000 caracteres." });

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  pendente: "Pendente",
  enviado: "Enviado",
  enviado_brasil: "Enviado ao Brasil",
  enviado_parcial: "Envio parcial",
  em_revisao: "Em revisão",
  aprovado: "Aprovado",
  rejeitado: "Devolvido à China",
  contestado: "Contestado",
};

const STATUS_TONE: Record<string, string> = {
  rejeitado: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200",
  aprovado: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  enviado: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  enviado_brasil: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
};

/**
 * Bloco interativo de um documento da China dentro do Sheet da tarefa-espelho.
 *
 * Permite, do lado Brasil:
 *  - Baixar o arquivo original.
 *  - Substituir o arquivo (anexa nova versão e marca a origem como Brasil).
 *  - Devolver à China com motivo obrigatório (validação Zod, mínimo 10 chars).
 */
export function ChinaDocumentoBlock({ doc }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [motivoError, setMotivoError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["china-docs-da-tarefa"] });
    qc.invalidateQueries({ queryKey: ["china-mailbox-dataset"] });
    qc.invalidateQueries({ queryKey: ["china-inbox"] });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      let url: string | null = null;
      if (doc.arquivo_path) {
        const { data, error } = await supabase.storage
          .from("china-documentos")
          .createSignedUrl(doc.arquivo_path, 3600);
        if (error) throw error;
        url = data?.signedUrl ?? null;
      } else if (doc.arquivo_url) {
        url = doc.arquivo_url;
      }
      if (!url) {
        toast.error("Documento sem arquivo associado.");
        return;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      triggerBlobDownload(blobUrl, doc.nome_arquivo || doc.tipo_documento);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err: any) {
      toast.error("Erro ao baixar: " + (err?.message || "desconhecido"));
    } finally {
      setDownloading(false);
    }
  };

  const substituir = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_SIZE) {
        throw new Error("Arquivo excede 20 MB.");
      }
      if (FORBIDDEN_EXT.test(file.name)) {
        throw new Error("Tipo de arquivo não permitido.");
      }
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id;
      if (!uid) throw new Error("Sessão expirada.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${uid}/${doc.submissao_id}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("china-documentos")
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase
        .from("china_produto_documentos" as any)
        .update({
          arquivo_path: path,
          nome_arquivo: file.name,
          arquivo_url: null,
          status: "enviado",
        } as any)
        .eq("id", doc.documento_id);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      toast.success("Arquivo substituído e reenviado para análise.");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao substituir arquivo."),
  });

  const devolver = useMutation({
    mutationFn: async (motivoTexto: string) => {
      const { error } = await supabase
        .from("china_produto_documentos" as any)
        .update({
          status: "rejeitado",
          observacoes_brasil: motivoTexto,
        } as any)
        .eq("id", doc.documento_id);
      if (error) throw error;

      // Notifica a China (alerta + notificações). Best-effort.
      try {
        await supabase.rpc("notificar_devolucao_brasil" as any, {
          p_documento_id: doc.documento_id,
          p_submissao_id: doc.submissao_id,
          p_motivo: motivoTexto,
          p_severidade: "alta",
        } as any);
      } catch (notifyErr) {
        console.warn("[ChinaDocumentoBlock.devolver] falha ao notificar China:", notifyErr);
      }
    },
    onSuccess: () => {
      toast.success("Documento devolvido à China.");
      setDevolverOpen(false);
      setMotivo("");
      setMotivoError(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao devolver à China."),
  });

  const handleConfirmDevolver = () => {
    const parsed = motivoSchema.safeParse(motivo);
    if (!parsed.success) {
      setMotivoError(parsed.error.issues[0]?.message ?? "Motivo inválido.");
      return;
    }
    setMotivoError(null);
    devolver.mutate(parsed.data);
  };

  const status = doc.status || "rascunho";
  const isFinal = status === "aprovado";

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card">
      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4 text-primary" />
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">
            {doc.nome_arquivo || doc.tipo_documento}
          </p>
          <Badge variant="outline" className="text-[10px] h-4">{doc.tipo_documento}</Badge>
          <Badge className={`text-[10px] h-4 ${STATUS_TONE[status] || "bg-muted text-muted-foreground"}`}>
            {STATUS_LABEL[status] || status}
          </Badge>
        </div>

        {(doc.produto_codigo || doc.produto_nome) && (
          <p className="text-[11px] text-muted-foreground truncate">
            {doc.produto_codigo} · {doc.produto_nome}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Avatar className="h-4 w-4">
            <AvatarImage src={doc.vinculado_por_avatar || undefined} />
            <AvatarFallback className="text-[8px] bg-muted">
              {(doc.vinculado_por_nome || "?").substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-[10px] text-muted-foreground">
            Anexado por {doc.vinculado_por_nome || "Sistema"} ·{" "}
            {format(new Date(doc.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs gap-1.5"
            onClick={() => setPreviewOpen(true)}
            disabled={!doc.arquivo_path && !doc.arquivo_url}
          >
            <Eye className="h-3 w-3" />
            Visualizar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={handleDownload}
            disabled={downloading || (!doc.arquivo_path && !doc.arquivo_url)}
          >
            {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Baixar
          </Button>

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) substituir.mutate(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={() => fileRef.current?.click()}
            disabled={substituir.isPending || isFinal}
            title={isFinal ? "Documento aprovado não pode ser substituído" : undefined}
          >
            {substituir.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Substituir arquivo
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 text-rose-600 hover:text-rose-700"
            onClick={() => setDevolverOpen(true)}
            disabled={isFinal || status === "rejeitado"}
            title={isFinal ? "Documento já aprovado" : status === "rejeitado" ? "Já devolvido" : undefined}
          >
            <RotateCcw className="h-3 w-3" /> Devolver à China
          </Button>
        </div>
      </div>

      <Dialog open={devolverOpen} onOpenChange={(o) => { setDevolverOpen(o); if (!o) setMotivoError(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Devolver à China
            </DialogTitle>
            <DialogDescription className="text-xs">
              Descreva o motivo da devolução. A China verá esta justificativa na Caixa de Entrada
              para corrigir e reenviar o documento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Textarea
              value={motivo}
              onChange={(e) => { setMotivo(e.target.value); if (motivoError) setMotivoError(null); }}
              placeholder="Ex.: faltam campos obrigatórios na seção XYZ, peso bruto divergente, etc."
              rows={5}
              maxLength={1000}
              className="text-xs resize-none"
            />
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className={motivoError ? "text-destructive" : ""}>
                {motivoError ?? "Mínimo 10 caracteres."}
              </span>
              <span className="tabular-nums">{motivo.length}/1000</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDevolverOpen(false)}
              disabled={devolver.isPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmDevolver}
              disabled={devolver.isPending}
              className="gap-1.5"
            >
              {devolver.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ship className="h-3 w-3" />}
              Confirmar devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChinaDocPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        arquivoPath={doc.arquivo_path}
        arquivoUrl={doc.arquivo_url}
        nomeArquivo={doc.nome_arquivo}
        tipoDocumento={doc.tipo_documento}
      />
    </div>
  );
}
