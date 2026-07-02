import { useMemo, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Upload,
  Sparkles,
  Loader2,
  Download,
  AlertTriangle,
  Calendar as CalendarIcon,
  Trash2,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useFornecedorContrato,
  resolveFornecedorKey,
  type FornecedorContrato,
} from "@/hooks/useFornecedorContrato";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { formatCurrency } from "@/lib/formatters";
import { useConfirm } from "@/hooks/useConfirm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedorCodigo: string | null | undefined;
  fornecedorNome: string;
}

import { UPLOAD_MAX_BYTES as MAX_SIZE } from "@/lib/upload/limits";
const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function fmtDate(s: string | null): string {
  const d = parseLocalDate(s);
  return d ? format(d, "dd/MM/yyyy", { locale: ptBR }) : "—";
}

export function FornecedorContratoDialog({
  open,
  onOpenChange,
  fornecedorCodigo,
  fornecedorNome,
}: Props) {
  const confirm = useConfirm();
  const key = resolveFornecedorKey(fornecedorCodigo, fornecedorNome);
  const { data: contratos = [], isLoading, refetch } = useFornecedorContrato(
    fornecedorCodigo,
    fornecedorNome,
  );
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("ativo");
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const contratoAtivo = useMemo(
    () => contratos.find((c) => c.tipo === "ativo") || null,
    [contratos],
  );
  const cancelamentos = useMemo(
    () => contratos.filter((c) => c.tipo === "cancelamento"),
    [contratos],
  );

  // Form state
  const [form, setForm] = useState({
    numero_contrato: "",
    data_vigencia_inicio: "",
    data_vigencia_fim: "",
    valor_mensal: "",
    valor_total: "",
    observacoes: "",
  });

  const resetForm = () => {
    setForm({
      numero_contrato: "",
      data_vigencia_inicio: "",
      data_vigencia_fim: "",
      valor_mensal: "",
      valor_total: "",
      observacoes: "",
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["fornecedor-contratos"] });
    refetch();
  };

  async function handleSubmit(tipo: "ativo" | "cancelamento") {
    if (!key) {
      toast.error("Fornecedor inválido");
      return;
    }
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecione o arquivo do contrato");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Arquivo maior que 20MB");
      return;
    }
    if (!ALLOWED_MIMES.includes(file.type)) {
      toast.error("Formato não suportado (PDF, DOCX, PNG ou JPG)");
      return;
    }
    if (tipo === "ativo" && !form.data_vigencia_inicio) {
      toast.error("Data de início da vigência é obrigatória");
      return;
    }
    if (tipo === "cancelamento" && !form.data_vigencia_fim) {
      toast.error("Data do término é obrigatória");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const safeKey = key.replace(/[^a-zA-Z0-9_-]+/g, "_");
      const path = `${safeKey}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("fornecedor-contratos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      // Se está criando "ativo" e já existe um, move o antigo para histórico (cancelamento auto)
      if (tipo === "ativo" && contratoAtivo) {
        await supabase
          .from("fornecedor_contratos" as any)
          .update({
            tipo: "cancelamento",
            data_vigencia_fim:
              contratoAtivo.data_vigencia_fim ||
              new Date().toISOString().slice(0, 10),
            observacoes:
              (contratoAtivo.observacoes ? contratoAtivo.observacoes + " | " : "") +
              "Substituído por novo contrato ativo",
          })
          .eq("id", contratoAtivo.id);
      }

      const { data: userData } = await supabase.auth.getUser();
      const { error: insErr } = await supabase
        .from("fornecedor_contratos" as any)
        .insert({
          fornecedor_codigo: key,
          fornecedor_nome: fornecedorNome,
          tipo,
          data_vigencia_inicio: form.data_vigencia_inicio || null,
          data_vigencia_fim: form.data_vigencia_fim || null,
          numero_contrato: form.numero_contrato || null,
          valor_mensal: form.valor_mensal ? Number(form.valor_mensal) : null,
          valor_total: form.valor_total ? Number(form.valor_total) : null,
          observacoes: form.observacoes || null,
          arquivo_path: path,
          arquivo_nome: file.name,
          arquivo_mime: file.type,
          arquivo_tamanho: file.size,
          criado_por: userData.user?.id || null,
        });
      if (insErr) throw insErr;

      toast.success(
        tipo === "ativo" ? "Contrato ativo registrado" : "Cancelamento registrado",
      );
      resetForm();
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar contrato");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(contrato: FornecedorContrato) {
    if (!contrato.arquivo_path) return;
    const { data, error } = await supabase.storage
      .from("fornecedor-contratos")
      .download(contrato.arquivo_path);
    if (error || !data) {
      toast.error("Falha ao baixar arquivo");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = contrato.arquivo_nome || "contrato";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleAnalisar(contrato: FornecedorContrato) {
    setAnalyzingId(contrato.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "fornecedor-contrato-analise",
        { body: { contrato_id: contrato.id } },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Análise concluída");
      invalidate();
    } catch (e: any) {
      const msg = e?.message || "Falha na análise";
      if (msg.toLowerCase().includes("rate") || msg.includes("429")) {
        toast.error("Muitas análises seguidas. Aguarde alguns instantes.");
      } else if (msg.includes("402")) {
        toast.error("Créditos de IA insuficientes no workspace.");
      } else {
        toast.error(msg);
      }
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm({ title: "Remover este contrato definitivamente?", destructive: true }))) return;
    const { error } = await supabase
      .from("fornecedor_contratos" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contrato removido");
    invalidate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contrato — {fornecedorNome}
          </DialogTitle>
          <DialogDescription>
            Gerencie o contrato ativo, registre cancelamento e gere análise por IA.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="ativo">Contrato Ativo</TabsTrigger>
            <TabsTrigger value="cancelamento">Cancelamento</TabsTrigger>
            <TabsTrigger value="historico">
              Histórico
              {contratos.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">
                  {contratos.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4 pr-3">
            {/* ATIVO */}
            <TabsContent value="ativo" className="mt-0 space-y-4">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando…</div>
              ) : contratoAtivo ? (
                <ContratoCard
                  contrato={contratoAtivo}
                  analyzing={analyzingId === contratoAtivo.id}
                  onAnalisar={() => handleAnalisar(contratoAtivo)}
                  onDownload={() => handleDownload(contratoAtivo)}
                  onDelete={() => handleDelete(contratoAtivo.id)}
                />
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum contrato ativo registrado.
                </div>
              )}

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3">
                  {contratoAtivo ? "Substituir contrato ativo" : "Novo contrato ativo"}
                </h4>
                <FormFields
                  form={form}
                  setForm={setForm}
                  requireInicio
                  fileRef={fileRef}
                />
                <div className="flex justify-end mt-3">
                  <Button onClick={() => handleSubmit("ativo")} disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Salvar contrato ativo
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* CANCELAMENTO */}
            <TabsContent value="cancelamento" className="mt-0 space-y-4">
              {cancelamentos.length > 0 ? (
                <div className="space-y-3">
                  {cancelamentos.map((c) => (
                    <ContratoCard
                      key={c.id}
                      contrato={c}
                      analyzing={analyzingId === c.id}
                      onAnalisar={() => handleAnalisar(c)}
                      onDownload={() => handleDownload(c)}
                      onDelete={() => handleDelete(c.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum cancelamento registrado.
                </div>
              )}

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3">
                  Registrar cancelamento
                </h4>
                <FormFields
                  form={form}
                  setForm={setForm}
                  requireFim
                  fileRef={fileRef}
                />
                <div className="flex justify-end mt-3">
                  <Button onClick={() => handleSubmit("cancelamento")} disabled={uploading} variant="secondary">
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Salvar cancelamento
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* HISTÓRICO */}
            <TabsContent value="historico" className="mt-0 space-y-3">
              {contratos.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  <History className="h-4 w-4 inline mr-2" />
                  Sem registros para este fornecedor.
                </div>
              ) : (
                contratos.map((c) => (
                  <ContratoCard
                    key={c.id}
                    contrato={c}
                    analyzing={analyzingId === c.id}
                    onAnalisar={() => handleAnalisar(c)}
                    onDownload={() => handleDownload(c)}
                    onDelete={() => handleDelete(c.id)}
                  />
                ))
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Subcomponents ---------------- */

function FormFields({
  form,
  setForm,
  requireInicio,
  requireFim,
  fileRef,
}: {
  form: any;
  setForm: (f: any) => void;
  requireInicio?: boolean;
  requireFim?: boolean;
  fileRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Label className="text-xs">Arquivo (PDF, DOCX, PNG, JPG · máx. 20MB)</Label>
        <Input ref={fileRef} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" />
      </div>
      <div>
        <Label className="text-xs">
          Início da vigência {requireInicio && <span className="text-destructive">*</span>}
        </Label>
        <Input
          type="date"
          value={form.data_vigencia_inicio}
          onChange={(e) => setForm({ ...form, data_vigencia_inicio: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">
          Fim da vigência {requireFim && <span className="text-destructive">*</span>}
        </Label>
        <Input
          type="date"
          value={form.data_vigencia_fim}
          onChange={(e) => setForm({ ...form, data_vigencia_fim: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Nº do contrato</Label>
        <Input
          value={form.numero_contrato}
          onChange={(e) => setForm({ ...form, numero_contrato: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-xs">Valor mensal</Label>
        <Input
          type="number"
          step="0.01"
          value={form.valor_mensal}
          onChange={(e) => setForm({ ...form, valor_mensal: e.target.value })}
        />
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Observações</Label>
        <Textarea
          rows={2}
          value={form.observacoes}
          onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
        />
      </div>
    </div>
  );
}

function ContratoCard({
  contrato,
  analyzing,
  onAnalisar,
  onDownload,
  onDelete,
}: {
  contrato: FornecedorContrato;
  analyzing: boolean;
  onAnalisar: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const analise = contrato.analise_ia_json as any;
  return (
    <div className="rounded-md border bg-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge
              variant={contrato.tipo === "ativo" ? "default" : "secondary"}
              className="text-[10px]"
            >
              {contrato.tipo === "ativo" ? "Ativo" : "Cancelamento"}
            </Badge>
            {contrato.numero_contrato && (
              <span className="text-xs text-muted-foreground">
                Nº {contrato.numero_contrato}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              Vigência: {fmtDate(contrato.data_vigencia_inicio)} →{" "}
              {fmtDate(contrato.data_vigencia_fim)}
            </span>
            {contrato.valor_mensal != null && (
              <span>Mensal: {formatCurrency(Number(contrato.valor_mensal))}</span>
            )}
          </div>
          {contrato.arquivo_nome && (
            <div className="mt-1 text-xs flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="truncate">{contrato.arquivo_nome}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={onDownload} title="Baixar">
            <Download className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onAnalisar} disabled={analyzing} title="Analisar com IA">
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} title="Remover">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {contrato.resumo_ia && (
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          <div className="flex items-center gap-1 font-medium mb-1">
            <Sparkles className="h-3 w-3" />
            Resumo da IA
          </div>
          <p className="whitespace-pre-wrap text-foreground">{contrato.resumo_ia}</p>
        </div>
      )}

      {analise && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {analise.partes && (
            <InfoRow label="Partes">
              {analise.partes?.contratante || "—"} / {analise.partes?.contratada || "—"}
            </InfoRow>
          )}
          {analise.vigencia && (
            <InfoRow label="Renovação automática">
              {analise.vigencia?.renovacao_automatica ? "Sim" : "Não"}
            </InfoRow>
          )}
          {analise.multa_rescisao && (
            <InfoRow label="Multa rescisão">{analise.multa_rescisao}</InfoRow>
          )}
          {analise.prazo_aviso_previo && (
            <InfoRow label="Aviso prévio">{analise.prazo_aviso_previo}</InfoRow>
          )}
          {analise.valores?.reajuste && (
            <InfoRow label="Reajuste">{analise.valores.reajuste}</InfoRow>
          )}
          {Array.isArray(analise.clausulas_criticas) &&
            analise.clausulas_criticas.length > 0 && (
              <div className="col-span-2 rounded-md border p-2">
                <div className="font-medium text-xs mb-1">Cláusulas críticas</div>
                <ul className="list-disc pl-4 space-y-0.5 text-xs">
                  {analise.clausulas_criticas.map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          {Array.isArray(analise.alertas) && analise.alertas.length > 0 && (
            <div className="col-span-2 rounded-md border border-warning/30 bg-warning/5 p-2">
              <div className="font-medium text-xs mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-warning" />
                Alertas
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-xs">
                {analise.alertas.map((c: string, i: number) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {contrato.analise_ia_em && (
        <div className="text-[10px] text-muted-foreground">
          Última análise: {fmtDate(contrato.analise_ia_em.slice(0, 10))}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
        {label}
      </div>
      <div className="text-xs mt-0.5 break-words">{children}</div>
    </div>
  );
}
