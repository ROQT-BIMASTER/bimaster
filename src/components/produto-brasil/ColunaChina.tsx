import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, FileText, Palette, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProdutoBrasil } from "@/hooks/useProdutoBrasil";

interface Props {
  produto: ProdutoBrasil;
}

function useSubmissaoChina(submissaoId: string | null) {
  return useQuery({
    queryKey: ["china-submissao-detail", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_produto_submissoes" as any)
        .select("*")
        .eq("id", submissaoId!)
        .single() as any);
      if (error) throw error;
      return data as any;
    },
  });
}

function useCoresChina(submissaoId: string | null) {
  return useQuery({
    queryKey: ["china-cores", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_produto_cores" as any)
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("ordem") as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

function useDocumentosChina(submissaoId: string | null) {
  return useQuery({
    queryKey: ["china-docs", submissaoId],
    enabled: !!submissaoId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("china_produto_documentos" as any)
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("created_at") as any);
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function ColunaChina({ produto }: Props) {
  const [coresOpen, setCoresOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const hasSubmissao = !!produto.submissao_china_id;

  const { data: submissao, isLoading: loadingSub } = useSubmissaoChina(produto.submissao_china_id);
  const { data: cores = [] } = useCoresChina(produto.submissao_china_id);
  const { data: documentos = [] } = useDocumentosChina(produto.submissao_china_id);

  const basicFields = [
    { label: "Nome do Produto", value: submissao?.produto_nome || produto.china_nome },
    { label: "Código", value: submissao?.produto_codigo || produto.china_codigo },
    { label: "EAN", value: produto.china_ean },
    { label: "Categoria", value: produto.china_categoria },
    { label: "Descrição", value: produto.china_descricao },
  ];

  const technicalFields = hasSubmissao && submissao ? [
    { label: "EAN Unidade", value: submissao.ean_unidade },
    { label: "EAN Display", value: submissao.ean_display },
    { label: "EAN Caixa Master", value: submissao.ean_caixa_master },
    { label: "Peso Líquido (g)", value: submissao.peso_liquido_g?.toString() },
    { label: "Peso Bruto (g)", value: submissao.peso_bruto_g?.toString() },
    { label: "Fórmula", value: submissao.formula_codigo },
    { label: "Qtd Total", value: submissao.qty_total?.toString() },
    { label: "Nº Ordem", value: submissao.numero_ordem },
  ] : [];

  const totalQtyCores = cores.reduce((acc: number, c: any) => acc + (c.quantidade || 0), 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="text-lg">🇨🇳</span>
          <Package className="h-4 w-4 text-primary" />
          Dados da China
          <Badge variant="secondary" className="text-[10px] ml-auto">Somente Leitura</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic fields */}
        {basicFields.map((f) => (
          <div key={f.label}>
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <div className="mt-1 text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2 min-h-[36px]">
              {f.value || <span className="text-muted-foreground italic">—</span>}
            </div>
          </div>
        ))}

        {/* Technical fields from submissão */}
        {hasSubmissao && loadingSub && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Carregando dados da submissão...
          </div>
        )}

        {technicalFields.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Dados Técnicos</p>
            <div className="grid grid-cols-2 gap-3">
              {technicalFields.map((f) => (
                <div key={f.label}>
                  <label className="text-[11px] font-medium text-muted-foreground">{f.label}</label>
                  <div className="mt-0.5 text-sm text-foreground bg-muted/50 rounded px-2 py-1.5">
                    {f.value || <span className="text-muted-foreground italic">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cores */}
        {cores.length > 0 && (
          <Collapsible open={coresOpen} onOpenChange={setCoresOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left border-t border-border pt-3 hover:bg-accent/30 rounded px-1 py-1 transition-colors">
              <Palette className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground flex-1">
                Cores ({cores.length}) — {totalQtyCores} un.
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${coresOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-2">
              {cores.map((cor: any) => (
                <div key={cor.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                  {cor.cor_hex && (
                    <div
                      className="w-5 h-5 rounded-full border border-border shrink-0"
                      style={{ backgroundColor: cor.cor_hex }}
                    />
                  )}
                  {cor.foto_url && (
                    <img
                      src={cor.foto_url}
                      alt={cor.cor_nome}
                      className="w-8 h-8 rounded object-cover border border-border shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cor.cor_nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {cor.grupo} • {cor.quantidade} un.
                      {cor.codigo_barras_ean && ` • EAN: ${cor.codigo_barras_ean}`}
                    </p>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Documentos */}
        {documentos.length > 0 && (
          <Collapsible open={docsOpen} onOpenChange={setDocsOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left border-t border-border pt-3 hover:bg-accent/30 rounded px-1 py-1 transition-colors">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground flex-1">
                Documentos ({documentos.length})
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${docsOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1.5">
              {documentos.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-2 bg-muted/30 rounded px-3 py-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{doc.nome_arquivo || doc.tipo_documento}</p>
                    <p className="text-[11px] text-muted-foreground">{doc.tipo_documento}</p>
                  </div>
                  <Badge variant={doc.status === "aprovado" ? "default" : "secondary"} className="text-[10px] shrink-0">
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
