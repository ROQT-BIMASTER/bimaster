import { useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Workflow, FileText, Loader2, Upload, Send, RotateCw, AlertCircle, CheckCircle2,
  ShieldCheck, Package,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChecklistFlow, FlowItemFocusDrawer } from "@/components/china/inbox/ChecklistFlow";
import type { FlowItemContext } from "@/components/china/inbox/ChecklistFlow/types";
import {
  useChecklistB2C, useUploadArquivoB2C, useEnviarDocB2C,
  type ChecklistB2CItem,
} from "@/hooks/useChecklistB2C";
import { groupBySubmissao, type MailboxGroup } from "@/lib/china/groupMailboxItems";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import { cn } from "@/lib/utils";
import { SolicitarAprovacaoB2CDialog } from "./SolicitarAprovacaoB2CDialog";
import type { SubmissaoRow } from "@/components/china/VincularChinaTable";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissao: SubmissaoRow | null;
}

const STATUS_LABEL: Record<ChecklistB2CItem["status"], string> = {
  pendente: "Pendente",
  em_preparacao: "Em preparação",
  enviado_china: "Enviado à China",
  recebido_china: "Recebido pela China",
  aprovado_china: "Aprovado pela China",
  devolvido_china: "Devolvido pela China",
  arquivado: "Arquivado",
};

const STATUS_TONE: Record<ChecklistB2CItem["status"], string> = {
  pendente: "bg-muted text-muted-foreground",
  em_preparacao: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  enviado_china: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  recebido_china: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  aprovado_china: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  devolvido_china: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200",
  arquivado: "bg-muted text-muted-foreground",
};

/**
 * Painel unificado do checklist de uma submissão.
 *
 * Aba 1 — China → Brasil: usa o ChecklistFlow (n8n-like) já consolidado
 *   na Caixa de Entrada China para mostrar o estado por categoria.
 * Aba 2 — Brasil → China: itens pendentes/anexados que o Brasil precisa
 *   enviar à China, com opção de anexar arquivo e disparar aprovação interna.
 */
export function ChecklistSubmissaoSheet({ open, onOpenChange, submissao }: Props) {
  const submissaoId = submissao?.id ?? null;

  // Aba B2C
  const { data: b2cItens = [], isLoading: loadingB2C } = useChecklistB2C(submissaoId);
  const uploadB2C = useUploadArquivoB2C();
  const enviarB2C = useEnviarDocB2C();
  const [aprovacaoOpen, setAprovacaoOpen] = useState(false);

  // Aba C2B — monta MailboxGroup leve a partir dos docs da submissão
  const { data: docsDaSubmissao = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["china-checklist-sheet-docs", submissaoId],
    enabled: !!submissaoId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("china_produto_documentos" as any)
        .select("id, submissao_id, tipo_documento, status, nome_arquivo, arquivo_path, arquivo_url, created_at")
        .eq("submissao_id", submissaoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const group: MailboxGroup | null = useMemo(() => {
    if (!submissao) return null;
    const items: MailboxItem[] = (docsDaSubmissao as any[]).map((d) => ({
      id: d.id,
      documento_id: d.id,
      submissao_id: d.submissao_id,
      produto_codigo: submissao.produto_codigo,
      produto_nome: submissao.produto_nome,
      numero_ordem: submissao.numero_ordem ?? null,
      submissao_status: submissao.status,
      tipo_documento: d.tipo_documento,
      nome_arquivo: d.nome_arquivo,
      arquivo_path: d.arquivo_path,
      arquivo_url: d.arquivo_url,
      doc_status: d.status,
      created_at: d.created_at,
      horas_pendentes: 0,
      is_read: true,
      is_flagged: false,
      is_deleted: false,
    } as any));
    const groups = groupBySubmissao(items, items);
    return groups[0] ?? null;
  }, [submissao, docsDaSubmissao]);

  const [flowCtx, setFlowCtx] = useState<FlowItemContext | null>(null);

  const groupedB2C = useMemo(() => {
    return b2cItens.reduce<Record<string, ChecklistB2CItem[]>>((acc, it) => {
      (acc[it.categoria] ||= []).push(it);
      return acc;
    }, {});
  }, [b2cItens]);

  const elegiveisAprovacao = useMemo(
    () => b2cItens.filter((i) => !!i.arquivo_path && ["pendente", "em_preparacao", "devolvido_china"].includes(i.status)),
    [b2cItens],
  );

  const handlePickFile = async (item: ChecklistB2CItem) => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.size > 20 * 1024 * 1024) {
        alert("Arquivo acima de 20MB");
        return;
      }
      await uploadB2C.mutateAsync({ item, file: f });
    };
    input.click();
  };

  if (!submissao) return null;

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-3 space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-primary">{submissao.produto_codigo}</span>
                <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">{submissao.status}</Badge>
              </div>
              <SheetTitle className="text-sm truncate text-left">{submissao.produto_nome}</SheetTitle>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {submissao.numero_ordem && <>OC <span className="font-medium">{submissao.numero_ordem}</span> · </>}
            {submissao.formula_codigo && <>Fórmula <span className="font-medium">{submissao.formula_codigo}</span></>}
          </p>
        </SheetHeader>

        <Tabs defaultValue="c2b" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-2 h-9 shrink-0">
            <TabsTrigger value="c2b" className="text-xs h-7 gap-1">
              <Workflow className="h-3 w-3" /> China → Brasil
            </TabsTrigger>
            <TabsTrigger value="b2c" className="text-xs h-7 gap-1">
              <Send className="h-3 w-3" /> Brasil → China
              {elegiveisAprovacao.length > 0 && (
                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 ml-0.5">
                  {elegiveisAprovacao.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="c2b" className="flex-1 m-0 min-h-0">
            <ScrollArea className="h-full">
              <div className="p-3">
                {loadingDocs && !group && (
                  <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-[11px] text-muted-foreground">
                    Carregando documentos da submissão…
                  </div>
                )}
                {group && (
                  <ChecklistFlow
                    group={group}
                    perspective="brasil"
                    onFocusItem={(ctx) => setFlowCtx(ctx)}
                  />
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="b2c" className="flex-1 m-0 min-h-0 flex flex-col">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/20">
              <p className="text-[11px] text-muted-foreground">
                {b2cItens.length} {b2cItens.length === 1 ? "item" : "itens"} ·{" "}
                <span className="text-foreground font-medium">{elegiveisAprovacao.length}</span> prontos para aprovação interna
              </p>
              <Button
                size="sm"
                variant="default"
                className="h-7 text-[11px] gap-1.5"
                disabled={elegiveisAprovacao.length === 0}
                onClick={() => setAprovacaoOpen(true)}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Solicitar aprovação interna
              </Button>
            </div>

            <ScrollArea className="flex-1">
              {loadingB2C ? (
                <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
                </div>
              ) : b2cItens.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Nenhum item Brasil → China configurado para esta submissão.
                </div>
              ) : (
                <div className="p-3 space-y-4">
                  {Object.entries(groupedB2C).map(([cat, list]) => (
                    <div key={cat}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        {cat}
                      </p>
                      <div className="space-y-1.5">
                        {list.map((it) => (
                          <B2CRow
                            key={it.id}
                            item={it}
                            onPickFile={() => handlePickFile(it)}
                            onEnviar={() => enviarB2C.mutate(it.id)}
                            sending={enviarB2C.isPending}
                            uploading={uploadB2C.isPending}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>

    {flowCtx && (
      <FlowItemFocusDrawer
        context={flowCtx}
        group={group}
        perspective="brasil"
        open={!!flowCtx}
        onOpenChange={(o) => { if (!o) setFlowCtx(null); }}
      />
    )}

    {submissao && (
      <SolicitarAprovacaoB2CDialog
        open={aprovacaoOpen}
        onOpenChange={setAprovacaoOpen}
        submissaoId={submissao.id}
        submissaoCodigo={submissao.produto_codigo}
        submissaoNome={submissao.produto_nome}
        itensElegiveis={elegiveisAprovacao}
      />
    )}
    </>
  );
}

function B2CRow({
  item, onPickFile, onEnviar, sending, uploading,
}: {
  item: ChecklistB2CItem;
  onPickFile: () => void;
  onEnviar: () => void;
  sending: boolean;
  uploading: boolean;
}) {
  const podeEnviar =
    !!item.arquivo_path &&
    ["em_preparacao", "pendente", "devolvido_china"].includes(item.status);

  return (
    <div className={cn(
      "rounded-md border bg-card px-3 py-2",
      item.status === "devolvido_china" && "border-red-300",
      item.status === "aprovado_china" && "border-emerald-300/60",
    )}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-medium text-foreground truncate">{item.nome_documento}</p>
            {item.obrigatorio && (
              <Badge variant="outline" className="h-4 px-1 text-[9px]">obrig.</Badge>
            )}
            <Badge className={cn("h-4 px-1.5 text-[9px] font-normal", STATUS_TONE[item.status])}>
              {STATUS_LABEL[item.status]}
            </Badge>
          </div>
          {item.descricao && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{item.descricao}</p>
          )}
          {item.arquivo_nome && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              <FileText className="inline h-3 w-3 mr-1 -mt-0.5" />
              {item.arquivo_nome}
            </p>
          )}
          {item.motivo_devolucao && item.status === "devolvido_china" && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-sm bg-red-50 dark:bg-red-950/40 p-1.5">
              <AlertCircle className="h-3 w-3 text-red-700 dark:text-red-300 mt-0.5" />
              <p className="text-[10px] text-red-900 dark:text-red-200">
                <span className="font-semibold">Devolvido:</span> {item.motivo_devolucao}
              </p>
            </div>
          )}
          {item.status === "aprovado_china" && (
            <p className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Aprovado pela China
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={onPickFile} disabled={uploading}>
          <Upload className="h-3 w-3" />
          {item.arquivo_path
            ? item.status === "devolvido_china"
              ? "Substituir"
              : "Trocar"
            : "Anexar"}
        </Button>
        <Button
          size="sm"
          className="h-6 text-[10px] gap-1"
          onClick={onEnviar}
          disabled={!podeEnviar || sending}
        >
          {item.status === "devolvido_china" ? <RotateCw className="h-3 w-3" /> : <Send className="h-3 w-3" />}
          {item.status === "devolvido_china" ? "Reenviar" : "Enviar à China"}
        </Button>
      </div>
    </div>
  );
}
