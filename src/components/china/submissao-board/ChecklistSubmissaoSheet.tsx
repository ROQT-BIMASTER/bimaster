import { useMemo, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChecklistFlow, FlowItemFocusDrawer } from "@/components/china/inbox/ChecklistFlow";
import type { FlowItemContext } from "@/components/china/inbox/ChecklistFlow/types";
import { groupBySubmissao, type MailboxGroup } from "@/lib/china/groupMailboxItems";
import type { MailboxItem } from "@/hooks/useChinaMailbox";
import { useMergedChinaChecklist } from "@/hooks/useMergedChinaChecklist";
import { SolicitarAprovacaoB2CDialog, type B2CElegivelItem } from "./SolicitarAprovacaoB2CDialog";
import { NovoItemBrasilEnviaDialog } from "./NovoItemBrasilEnviaDialog";
import type { SubmissaoRow } from "@/components/china/VincularChinaTable";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissao: SubmissaoRow | null;
  /**
   * Filtra a visualização do checklist por lado. Quando informado, apenas
   * a seção correspondente aparece — usado pelos botões "Checklist China →
   * Brasil" e "Checklist Brasil → China" do header do projeto, para que
   * cada botão mostre só a responsabilidade do seu lado.
   */
  side?: "c2b" | "b2c" | "both";
}

/**
 * Painel unificado do checklist de uma submissão.
 *
 * Mostra o mesmo `ChecklistFlow` (n8n-like) renderizado na Caixa de Entrada China.
 * Aqui, sob a perspectiva Brasil, o usuário consegue:
 *  - Acompanhar os documentos enviados pela China (categorias `china_envia`).
 *  - Anexar/aprovar documentos do lado Brasil (categorias `brasil_envia`),
 *    incluindo itens pré-configurados pela China.
 *  - Adicionar novos itens Brasil → China direto na fonte de verdade
 *    (china_checklist_custom_*), mantendo um canal único entre os dois lados.
 *  - Disparar aprovação interna em lote dos itens Brasil → China anexados.
 */
export function ChecklistSubmissaoSheet({ open, onOpenChange, submissao }: Props) {
  const submissaoId = submissao?.id ?? null;

  const [aprovacaoOpen, setAprovacaoOpen] = useState(false);
  const [novoItemOpen, setNovoItemOpen] = useState(false);
  const [flowCtx, setFlowCtx] = useState<FlowItemContext | null>(null);

  // Documentos físicos da submissão — alimentam o MailboxGroup do ChecklistFlow
  const { data: docsDaSubmissao = [] } = useQuery({
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

  const merged = useMergedChinaChecklist(submissaoId);

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

  // Itens Brasil → China elegíveis para aprovação interna:
  // tipos do merged.categoriesBrasilEnvia que já tenham documento anexado
  // (status diferente de aprovado/rejeitado) na submissão.
  const elegiveisAprovacao: B2CElegivelItem[] = useMemo(() => {
    if (!submissaoId) return [];
    const docsByTipo = new Map<string, any>();
    for (const d of docsDaSubmissao as any[]) {
      docsByTipo.set(d.tipo_documento, d);
    }
    const out: B2CElegivelItem[] = [];
    for (const cat of merged.categoriesBrasilEnvia) {
      for (const tipo of cat.tipos) {
        const doc = docsByTipo.get(tipo);
        if (!doc || !doc.arquivo_path) continue;
        if (doc.status === "aprovado") continue;
        const cfg = merged.getDocType(tipo);
        out.push({
          tipo,
          label: cfg?.labelPt || tipo,
          arquivoNome: doc.nome_arquivo ?? null,
        });
      }
    }
    return out;
  }, [merged, docsDaSubmissao, submissaoId]);

  if (!submissao) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-4 py-3 space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-primary">
                    {submissao.produto_codigo}
                  </span>
                  <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase">
                    {submissao.status}
                  </Badge>
                </div>
                <SheetTitle className="text-sm truncate text-left">
                  {submissao.produto_nome}
                </SheetTitle>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {submissao.numero_ordem && (
                <>OC <span className="font-medium">{submissao.numero_ordem}</span> · </>
              )}
              {submissao.formula_codigo && (
                <>Fórmula <span className="font-medium">{submissao.formula_codigo}</span></>
              )}
            </p>
          </SheetHeader>

          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/20">
            <p className="text-[11px] text-muted-foreground">
              <span className="text-foreground font-medium">{elegiveisAprovacao.length}</span>{" "}
              {elegiveisAprovacao.length === 1 ? "item anexado" : "itens anexados"} pelo Brasil pronto(s) para aprovação interna
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
            <div className="p-3">
              {group ? (
                <ChecklistFlow
                  group={group}
                  perspective="brasil"
                  layout="split"
                  onAddBrasilItem={() => setNovoItemOpen(true)}
                  onFocusItem={(ctx) => setFlowCtx(ctx)}
                />
              ) : (
                <div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-center text-[11px] text-muted-foreground">
                  Carregando checklist…
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {flowCtx && group && (
        <FlowItemFocusDrawer
          context={flowCtx}
          group={group}
          perspective="brasil"
          open={!!flowCtx}
          onOpenChange={(o) => { if (!o) setFlowCtx(null); }}
        />
      )}

      <SolicitarAprovacaoB2CDialog
        open={aprovacaoOpen}
        onOpenChange={setAprovacaoOpen}
        submissaoId={submissao.id}
        submissaoCodigo={submissao.produto_codigo}
        submissaoNome={submissao.produto_nome}
        itensElegiveis={elegiveisAprovacao}
      />

      <NovoItemBrasilEnviaDialog
        open={novoItemOpen}
        onOpenChange={setNovoItemOpen}
        submissaoId={submissao.id}
      />
    </>
  );
}
