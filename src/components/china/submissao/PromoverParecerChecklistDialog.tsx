/**
 * PromoverParecerChecklistDialog — promove um anexo de parecer da
 * submissão China para item oficial do checklist
 * (`china_produto_documentos`).
 *
 * Espelha o fluxo de `chat/PromoverChecklistDialog.tsx`:
 *   1. baixa blob do anexo em `china-pareceres`
 *   2. faz upload em `china-documentos/<uid>/<submissao>/<tipo>/...`
 *   3. chama `rpc_china_promover_anexo_parecer_ao_checklist` (cria
 *      linha no checklist + marca anexo origem como promovido)
 */
import { useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMergedChinaChecklist } from "@/hooks/useMergedChinaChecklist";
import { downloadStorageBlob } from "@/lib/utils/storage-download";
import { toast } from "sonner";
import type { ParecerAnexo } from "@/hooks/useSubmissaoPareceres";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anexo: ParecerAnexo;
  parecerId: string;
  submissaoId: string;
  onPromoted?: (documentoId: string) => void;
}

const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv", txt: "text/plain", zip: "application/zip",
};

export function PromoverParecerChecklistDialog({
  open, onOpenChange, anexo, parecerId, submissaoId, onPromoted,
}: Props) {
  const checklist = useMergedChinaChecklist(submissaoId);
  const [categoriaKey, setCategoriaKey] = useState<string>("");
  const [tipoDoc, setTipoDoc] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const tiposDaCategoria = useMemo(() => {
    if (!categoriaKey) return [];
    const cat = checklist.categories.find((c) => c.key === categoriaKey);
    if (!cat) return [];
    return cat.tipos
      .filter((t) => !checklist.hiddenSet.has(t))
      .map((t) => checklist.getDocType(t))
      .filter((dt): dt is NonNullable<typeof dt> => !!dt);
  }, [categoriaKey, checklist]);

  const reset = () => {
    setCategoriaKey("");
    setTipoDoc("");
  };

  const promover = async () => {
    if (!categoriaKey) return toast.error("Selecione uma categoria");
    if (!tipoDoc) return toast.error("Selecione um tipo de documento");

    setLoading(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData?.user?.id) throw new Error("Sessão expirada");
      const uid = userData.user.id;

      const r = await downloadStorageBlob(anexo.storage_path, "china-pareceres");
      if (!r || !r.blob) throw new Error(r?.error || "Falha ao baixar anexo origem");

      const ext = (anexo.nome_arquivo.split(".").pop() || "").toLowerCase();
      const candidates = [anexo.mime, r.contentType, r.blob.type, EXT_MIME[ext], "application/octet-stream"];
      const contentType = candidates.find((m) => !!m && !m.includes("text/html")) || "application/octet-stream";

      const blob = new Blob([r.blob], { type: contentType });
      const timestamp = Date.now();
      const safeName = anexo.nome_arquivo.replace(/[^\w.\-]+/g, "_").slice(0, 80);
      const novoPath = `${uid}/${submissaoId}/${tipoDoc}/${timestamp}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("china-documentos")
        .upload(novoPath, blob, { contentType, upsert: false });
      if (upErr) throw new Error(`Falha ao gravar no Cofre: ${upErr.message}`);

      const { data: docId, error: rpcErr } = await supabase.rpc(
        "rpc_china_promover_anexo_parecer_ao_checklist" as any,
        {
          p_parecer_id: parecerId,
          p_anexo_id: anexo.id,
          p_tipo_documento: tipoDoc,
          p_novo_arquivo_path: novoPath,
          p_novo_nome_arquivo: anexo.nome_arquivo,
        } as any,
      );
      if (rpcErr) throw rpcErr;

      toast.success("Documento promovido ao checklist");
      if (docId && onPromoted) onPromoted(docId as string);
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error("Falha ao promover: " + (e?.message ?? ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Promover ao Checklist
          </DialogTitle>
          <DialogDescription>
            Adiciona o anexo deste parecer como item oficial do checklist da submissão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/30">
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{anexo.nome_arquivo}</p>
              <p className="text-[10px] text-muted-foreground">
                {anexo.tamanho ? `${(anexo.tamanho / 1024).toFixed(0)} KB` : ""}
                {anexo.mime ? ` · ${anexo.mime}` : ""}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Categoria *</label>
            <Select
              value={categoriaKey}
              onValueChange={(v) => { setCategoriaKey(v); setTipoDoc(""); }}
              disabled={loading || checklist.isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {checklist.categories.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.labelPt}{c.labelCn ? <span className="text-muted-foreground ml-1">{c.labelCn}</span> : null}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Tipo de documento *</label>
            <Select
              value={tipoDoc}
              onValueChange={setTipoDoc}
              disabled={loading || !categoriaKey || tiposDaCategoria.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  !categoriaKey ? "Selecione a categoria primeiro"
                    : tiposDaCategoria.length === 0 ? "Nenhum tipo disponível"
                    : "Selecione o tipo"
                } />
              </SelectTrigger>
              <SelectContent>
                {tiposDaCategoria.map((t) => (
                  <SelectItem key={t.tipo} value={t.tipo}>{t.labelPt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={promover} disabled={loading || !tipoDoc}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Promovendo...</>
            ) : (
              <>Promover</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
