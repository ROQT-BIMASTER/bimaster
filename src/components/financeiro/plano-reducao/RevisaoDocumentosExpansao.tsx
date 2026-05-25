import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { labelMesLongo } from "@/lib/financeiro/periodoMeses";
import { FileText, Info } from "lucide-react";

interface DocRow {
  id: string;
  numero_documento: string | null;
  parcela: number | null;
  tipo_documento: string | null;
  empresa_nome: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  valor_original: number;
  valor_pago: number;
  status: string | null;
  portador: string | null;
}

interface Props {
  fornecedorCodigo: string;
  fornecedorNome: string;
  meses: string[];
  empresaNome?: string | null;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const parsed = parseLocalDate(d);
  if (!parsed) return d;
  try {
    return format(parsed, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return d;
  }
}

function statusVariant(s: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!s) return "secondary";
  const x = s.toLowerCase();
  if (x === "pago") return "default";
  if (x === "cancelado") return "destructive";
  if (x === "vencido") return "destructive";
  return "secondary";
}

export function RevisaoDocumentosExpansao({ fornecedorCodigo, fornecedorNome, meses, empresaNome }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["revisao-docs-mes", fornecedorCodigo, meses, empresaNome || null],
    enabled: !!fornecedorCodigo,
    queryFn: async () => {
      const result: Record<string, DocRow[]> = {};
      await Promise.all(
        meses.map(async (m) => {
          const { data, error } = await supabase.rpc("rpc_get_revisao_documentos_mes", {
            p_fornecedor_codigo: fornecedorCodigo,
            p_mes: m,
            p_empresa_nome: empresaNome || null,
          } as any);
          if (error) throw error;
          result[m] = (data || []) as DocRow[];
        }),
      );
      return result;
    },
  });

  if (!fornecedorCodigo) {
    return (
      <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4" />
        Este item ainda não está vinculado a um fornecedor do Contas a Pagar. Use o
        botão <strong>Vincular</strong> para habilitar o detalhamento por documento.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  const mesesComDocs = meses.filter((m) => (data?.[m]?.length || 0) > 0);

  if (mesesComDocs.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
        <Info className="h-4 w-4" />
        Nenhum pagamento registrado no Contas a Pagar para {fornecedorNome} no
        período exibido.
      </div>
    );
  }

  return (
    <div className="bg-muted/30 border-y border-border">
      <div className="px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <FileText className="h-3.5 w-3.5" />
        Documentos do Contas a Pagar que compõem os valores mês a mês de
        <span className="font-medium text-foreground"> {fornecedorNome}</span>
        <span className="ml-1">(cód. {fornecedorCodigo})</span>
      </div>

      <div className="px-4 pb-3 space-y-4">
        {mesesComDocs.map((m) => {
          const docs = data?.[m] || [];
          const total = docs.reduce((s, d) => s + Number(d.valor_pago || 0), 0);
          return (
            <div key={m}>
              <div className="flex items-baseline justify-between mb-1">
                <div className="text-xs font-semibold uppercase tracking-wide">
                  {labelMesLongo(m)} <span className="text-muted-foreground font-normal">— {docs.length} {docs.length === 1 ? "documento" : "documentos"}</span>
                </div>
                <div className="text-xs tabular-nums">
                  <span className="text-muted-foreground">Total pago: </span>
                  <span className="font-semibold">{formatCurrency(total)}</span>
                </div>
              </div>
              <div className="rounded-md border border-border bg-background overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium">Documento</th>
                      <th className="text-left px-2 py-1.5 font-medium">Tipo</th>
                      <th className="text-left px-2 py-1.5 font-medium">Empresa</th>
                      <th className="text-left px-2 py-1.5 font-medium">Emissão</th>
                      <th className="text-left px-2 py-1.5 font-medium">Vencimento</th>
                      <th className="text-left px-2 py-1.5 font-medium">Pagamento</th>
                      <th className="text-left px-2 py-1.5 font-medium">Portador</th>
                      <th className="text-right px-2 py-1.5 font-medium">Original</th>
                      <th className="text-right px-2 py-1.5 font-medium">Pago</th>
                      <th className="text-left px-2 py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-2 py-1.5 font-mono">
                          {d.numero_documento || "—"}
                          {d.parcela ? <span className="text-muted-foreground"> /{d.parcela}</span> : null}
                        </td>
                        <td className="px-2 py-1.5">{d.tipo_documento || "—"}</td>
                        <td className="px-2 py-1.5 truncate max-w-[160px]" title={d.empresa_nome || ""}>{d.empresa_nome || "—"}</td>
                        <td className="px-2 py-1.5 tabular-nums">{fmtDate(d.data_emissao)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{fmtDate(d.data_vencimento)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{fmtDate(d.data_pagamento)}</td>
                        <td className="px-2 py-1.5 truncate max-w-[140px]" title={d.portador || ""}>{d.portador || "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatCurrency(Number(d.valor_original || 0))}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums font-medium">{formatCurrency(Number(d.valor_pago || 0))}</td>
                        <td className="px-2 py-1.5">
                          <Badge variant={statusVariant(d.status)} className="text-[10px] h-4">
                            {d.status || "—"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
