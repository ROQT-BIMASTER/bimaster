// src/components/briefings/cofre/UploadDocumentoDialog.tsx
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { validateFileForUpload } from "@/lib/utils/file-security";
import { CATEGORIA_LABELS, type BriefingDocumento } from "@/hooks/useBriefingCofre";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  briefingId: string;
  /** Se preenchido, faz upload contra um item de checklist existente (atualiza em vez de inserir). */
  documentoAlvo?: BriefingDocumento | null;
  /** Descrição inicial (ex.: texto de um comentário sendo anexado ao cofre). */
  descricaoInicial?: string;
  /** Arquivo pré-selecionado (ex.: captura de câmera vinda do composer). */
  initialFile?: File | null;
  /** Callback após sucesso, recebe id e nome do documento criado/atualizado. */
  onUploaded?: (doc: { id: string; nome: string }) => void;
}

export function UploadDocumentoDialog({
  open, onOpenChange, briefingId, documentoAlvo, descricaoInicial, initialFile, onUploaded,
}: Props) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [fornecedor, setFornecedor] = useState("");
  const [lote, setLote] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [uploading, setUploading] = useState(false);

  // Pre-fill quando vier de um item do checklist ou descrição externa
  if (open && documentoAlvo && !nome && !file) {
    setNome(documentoAlvo.nome);
    setCategoria(documentoAlvo.categoria);
    if (documentoAlvo.descricao) setDescricao(documentoAlvo.descricao);
  }
  if (open && !documentoAlvo && descricaoInicial && !descricao) {
    setDescricao(descricaoInicial);
  }
  if (open && initialFile && !file) {
    setFile(initialFile);
    if (!nome) setNome(initialFile.name.replace(/\.[^.]+$/, ""));
  }


  const reset = () => {
    setFile(null); setNome(""); setDescricao(""); setCategoria("geral");
    setFornecedor(""); setLote(""); setDataEntrega("");
  };

  const handleSubmit = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    if (!nome.trim()) return toast.error("Dê um nome ao documento");

    setUploading(true);
    try {
      const validation = await validateFileForUpload(file);
      if (!validation.valid) {
        toast.error(validation.error || "Arquivo inválido");
        return;
      }

      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão expirada");

      const docId = documentoAlvo?.id ?? crypto.randomUUID();
      const ext = file.name.split(".").pop() ?? "bin";
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${briefingId}/${docId}/${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("briefing-cofre")
        .upload(path, file, {
          contentType: file.type || `application/${ext}`,
          upsert: true,
        });
      if (upErr) throw upErr;

      const patch = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        categoria,
        fornecedor_nome: fornecedor.trim() || null,
        lote: lote.trim() || null,
        data_entrega: dataEntrega || null,
        storage_path: path,
        mime_type: file.type || null,
        tamanho_bytes: file.size,
        status: "recebido" as const,
      };

      if (documentoAlvo) {
        const { error } = await (supabase as any)
          .from("briefing_documentos")
          .update(patch)
          .eq("id", documentoAlvo.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("briefing_documentos")
          .insert({
            id: docId,
            briefing_id: briefingId,
            created_by: uid,
            ...patch,
          });
        if (error) throw error;
      }

      toast.success("Documento enviado");
      qc.invalidateQueries({ queryKey: ["briefing-documentos", briefingId] });
      onUploaded?.({ id: docId, nome: nome.trim() });
      // Push incremental para RR-Tasks (best-effort; ignora se task não criada)
      try {
        const { data: b } = await (supabase as any)
          .from("briefings")
          .select("rrtask_page_id")
          .eq("id", briefingId)
          .maybeSingle();
        if (b?.rrtask_page_id) {
          await supabase.functions.invoke("rrtask-sync-documentos", {
            body: { briefing_id: briefingId },
          });
        }
      } catch { /* silencioso */ }
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {documentoAlvo ? `Anexar arquivo · ${documentoAlvo.nome}` : "Novo documento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="file" className="text-xs">Arquivo</Label>
            <Input
              id="file" type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIA_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fornecedor / parceiro</Label>
              <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Lote / entrega</Label>
              <Input value={lote} onChange={(e) => setLote(e.target.value)} placeholder="ex.: Lote 01" />
            </div>
            <div>
              <Label className="text-xs">Data de entrega</Label>
              <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea
              rows={2} value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={uploading}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {uploading ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
