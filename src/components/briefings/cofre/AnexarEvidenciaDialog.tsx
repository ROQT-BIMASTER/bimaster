// src/components/briefings/cofre/AnexarEvidenciaDialog.tsx
// Dialog dedicado para anexar evidências (foto, documento, planilha) ao cofre
// do briefing, com tabulação obrigatória. Pode ser acionado pelo compositor do
// chat (origem="chat") ou pelo botão do cofre (origem="upload"/"evidencia").
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Camera, Upload } from "lucide-react";
import { validateFileForUpload } from "@/lib/utils/file-security";
import { CATEGORIA_LABELS } from "@/hooks/useBriefingCofre";
import { useQueryClient } from "@tanstack/react-query";

type EvidenciaOrigem = "upload" | "chat" | "evidencia";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  briefingId: string;
  /** Origem do disparo — afeta apenas registro analítico/em chat. */
  origem?: EvidenciaOrigem;
  /** Chamado após inserir o documento com sucesso. */
  onAnexado?: (doc: {
    id: string;
    nome: string;
    is_oficial: boolean;
    is_checklist_item: boolean;
    categoria: string;
  }) => void;
}

function stripExt(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function AnexarEvidenciaDialog({
  open,
  onOpenChange,
  briefingId,
  origem = "evidencia",
  onAnexado,
}: Props) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [isOficial, setIsOficial] = useState<"sim" | "nao" | "">("");
  const [criarChecklist, setCriarChecklist] = useState<"sim" | "nao" | "">("");
  const [categoriaChecklist, setCategoriaChecklist] = useState("evidencia");
  const [fornecedor, setFornecedor] = useState("");
  const [dataRef, setDataRef] = useState("");
  const [uploading, setUploading] = useState(false);

  const previewUrl = useMemo(() => {
    if (!file || !file.type.startsWith("image/")) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const reset = () => {
    setFile(null);
    setNome("");
    setDescricao("");
    setIsOficial("");
    setCriarChecklist("");
    setCategoriaChecklist("evidencia");
    setFornecedor("");
    setDataRef("");
  };

  const handleFile = (f: File | null) => {
    setFile(f);
    if (f && !nome.trim()) setNome(stripExt(f.name));
  };

  const podeSalvar =
    !!file && nome.trim().length > 0 && isOficial !== "" && criarChecklist !== "";

  const handleSubmit = async () => {
    if (!file) return toast.error("Selecione um arquivo");
    if (!nome.trim()) return toast.error("Dê um nome à evidência");
    if (!isOficial) return toast.error("Informe se é documento oficial");
    if (!criarChecklist)
      return toast.error("Informe se deve virar item próprio do checklist");

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

      const docId = crypto.randomUUID();
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${briefingId}/${docId}/${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("briefing-cofre")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        });
      if (upErr) throw upErr;

      const ehOficial = isOficial === "sim";
      const viraChecklist = criarChecklist === "sim";
      const categoriaFinal = viraChecklist ? categoriaChecklist : "evidencia";

      const insertRow: Record<string, unknown> = {
        id: docId,
        briefing_id: briefingId,
        created_by: uid,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        categoria: categoriaFinal,
        fornecedor_nome: fornecedor.trim() || null,
        data_entrega: dataRef || null,
        storage_path: path,
        mime_type: file.type || null,
        tamanho_bytes: file.size,
        status: "recebido",
        is_oficial: ehOficial,
        is_checklist_item: viraChecklist,
        origem,
      };

      const { error: insErr } = await (supabase as any)
        .from("briefing_documentos")
        .insert(insertRow);
      if (insErr) throw insErr;

      toast.success(
        ehOficial
          ? "Evidência oficial registrada no cofre"
          : "Evidência anexada ao cofre",
      );
      qc.invalidateQueries({ queryKey: ["briefing-documentos", briefingId] });

      onAnexado?.({
        id: docId,
        nome: nome.trim(),
        is_oficial: ehOficial,
        is_checklist_item: viraChecklist,
        categoria: categoriaFinal,
      });
      // Push incremental para RR-Tasks (best-effort)
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
      toast.error(err?.message || "Falha ao anexar evidência");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Anexar evidência
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Passo 1 — Arquivo */}
          <div className="space-y-2">
            <Label htmlFor="evidencia-file" className="text-xs font-semibold">
              1. Arquivo da evidência
            </Label>
            <Input
              id="evidencia-file"
              type="file"
              accept="image/*,application/pdf,.xls,.xlsx,.csv,.doc,.docx,.ppt,.pptx,.ai,.psd,application/postscript,application/illustrator,image/vnd.adobe.photoshop"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-2">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="h-16 w-16 rounded object-cover border border-border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                    {file.name.split(".").pop()?.toUpperCase() ?? "FILE"}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || "tipo desconhecido"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Passo 2 — Tabulação */}
          {file && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  2. Tabulação obrigatória
                </Label>

                <div>
                  <Label className="text-xs">Nome da evidência</Label>
                  <Input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="ex.: Foto do mobiliário Ruby Rose na loja"
                  />
                </div>

                <div>
                  <Label className="text-xs">Descrição / contexto</Label>
                  <Textarea
                    rows={2}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder="Onde foi capturada, motivo, observações…"
                  />
                </div>

                <div className="rounded-md border border-border p-2.5 space-y-1.5">
                  <Label className="text-xs">É um documento oficial?</Label>
                  <RadioGroup
                    value={isOficial}
                    onValueChange={(v) => setIsOficial(v as "sim" | "nao")}
                    className="flex gap-4"
                  >
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <RadioGroupItem value="sim" id="ofi-sim" /> Sim
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <RadioGroupItem value="nao" id="ofi-nao" /> Não
                    </label>
                  </RadioGroup>
                  <p className="text-[10px] text-muted-foreground">
                    Marcar como oficial reforça rastreabilidade na exportação.
                  </p>
                </div>

                <div className="rounded-md border border-border p-2.5 space-y-1.5">
                  <Label className="text-xs">
                    Criar item próprio no checklist deste briefing?
                  </Label>
                  <RadioGroup
                    value={criarChecklist}
                    onValueChange={(v) => setCriarChecklist(v as "sim" | "nao")}
                    className="flex gap-4"
                  >
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <RadioGroupItem value="sim" id="chk-sim" /> Sim
                    </label>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <RadioGroupItem value="nao" id="chk-nao" /> Não
                    </label>
                  </RadioGroup>
                  {criarChecklist === "sim" && (
                    <div className="mt-2">
                      <Label className="text-xs">Categoria do item</Label>
                      <Select
                        value={categoriaChecklist}
                        onValueChange={setCategoriaChecklist}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORIA_LABELS).map(([k, l]) => (
                            <SelectItem key={k} value={k} className="text-xs">
                              {l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Fornecedor / parceiro</Label>
                    <Input
                      value={fornecedor}
                      onChange={(e) => setFornecedor(e.target.value)}
                      placeholder="opcional"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Data de referência</Label>
                    <Input
                      type="date"
                      value={dataRef}
                      onChange={(e) => setDataRef(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!podeSalvar || uploading}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {uploading ? "Enviando..." : "Salvar evidência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
